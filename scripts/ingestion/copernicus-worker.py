#!/usr/bin/env python3
"""
Long-running Copernicus Marine worker process.

Reads JSON requests from stdin, performs copernicusmarine.subset() + xarray parse,
writes JSON responses to stdout. Single authenticated session for the entire run.

Protocol:
  - All logging goes to stderr (not stdout)
  - All protocol messages are JSON-per-line on stdout
  - Worker sends {"id":"ready","ok":true} when ready to accept requests
  - Requests: {"id":"req-1","action":"subset","dataset_id":"...","variables":[...],...}
  - Responses: {"id":"req-1","ok":true,"data":{...}} or {"id":"req-1","ok":false,"error":"..."}
  - Shutdown: {"action":"shutdown"}
"""

import sys
import json
import os
import tempfile
import threading

import numpy as np
import xarray as xr

# Redirect stdout during import to prevent copernicusmarine from leaking
# version/info messages into the JSON protocol on stdout
_real_stdout = sys.stdout
sys.stdout = sys.stderr
try:
    import copernicusmarine
finally:
    sys.stdout = _real_stdout


def log(msg):
    """Write log messages to stderr (not stdout, which is for JSON responses)."""
    print(msg, file=sys.stderr, flush=True)


def is_valid_value(val, var_name):
    """
    Filter out fill values and physically impossible values.
    CMEMS datasets use various fill values: 9999, 9.96921e+36, -32767, etc.
    """
    if val is None:
        return False

    if np.isnan(val) or np.isinf(val):
        return False

    # Common fill value patterns
    abs_val = abs(val)
    if abs_val > 9000:
        return False

    var_lower = var_name.lower()

    # Primary production (nppv) can reach 2000+ mg C/m³/day in productive coastal waters
    # Must check BEFORE the generic >1000 filter below
    if 'nppv' in var_lower:
        return 0 <= val <= 5000

    if abs_val > 1000 and abs_val < 10000:
        return False

    # Variable-specific validation (physically plausible ranges)

    if 'temp' in var_lower or 'thetao' in var_lower or 'to' in var_lower or 'sst' in var_lower:
        if val < -5 or val > 50:
            return False

    if 'sal' in var_lower or 'so' in var_lower:
        if val < 0 or val > 50:
            return False

    if 'chl' in var_lower:
        if val < 0 or val > 100:
            return False

    if 'kd' in var_lower or 'atten' in var_lower:
        if val < 0 or val > 10:
            return False

    if 'o2' in var_lower or 'oxygen' in var_lower:
        if val < 0 or val > 500:
            return False

    if 'no3' in var_lower or 'nitrate' in var_lower:
        if val < 0 or val > 100:
            return False

    if 'po4' in var_lower or 'phosphate' in var_lower:
        if val < 0 or val > 20:
            return False

    if any(x in var_lower for x in ['uo', 'vo', 'velocity', 'current']):
        if abs_val > 10:
            return False

    if 'vhm' in var_lower or ('wave' in var_lower and 'height' in var_lower):
        if val < 0 or val > 30:
            return False

    if 'vtm' in var_lower or 'period' in var_lower:
        if val < 0 or val > 30:
            return False

    return True


def parse_netcdf(file_path):
    """
    Parse a NetCDF file into the CopernicusTimeseries JSON format.
    Returns dict with datasetId, variables, records, source.
    """
    ds = xr.open_dataset(file_path)

    try:
        # Get dimensions
        times = ds.time.values if 'time' in ds.dims else []
        depths = ds.depth.values if 'depth' in ds.dims else [0]

        if 'latitude' in ds.dims or 'latitude' in ds.coords:
            lats = ds.latitude.values
        else:
            lats = ds.lat.values

        if 'longitude' in ds.dims or 'longitude' in ds.coords:
            lons = ds.longitude.values
        else:
            lons = ds.lon.values

        times = [str(t) for t in times]
        depths = [float(d) for d in depths]

        # Filter depths to only keep 0m, 5m, and 10m (within 1.5m tolerance)
        target_depths = [0, 5, 10]
        filtered_depths = []
        for target in target_depths:
            closest = min(depths, key=lambda d: abs(d - target)) if depths else None
            if closest is not None and abs(closest - target) <= 1.5:
                if closest not in filtered_depths:
                    filtered_depths.append(closest)
        depths = filtered_depths if filtered_depths else [0]

        lat = float(lats[0] if len(lats.shape) == 1 else lats[0, 0])
        lon = float(lons[0] if len(lons.shape) == 1 else lons[0, 0])

        var_names = [v for v in ds.data_vars
                     if v not in ['latitude', 'longitude', 'lat', 'lon', 'time', 'depth']]

        records = []
        for time_idx, time_val in enumerate(times):
            for depth_idx, depth_val in enumerate(depths):
                variables = {}
                for var in var_names:
                    try:
                        if 'depth' in ds[var].dims:
                            val = ds[var].isel(time=time_idx, depth=depth_idx).values
                        else:
                            val = ds[var].isel(time=time_idx).values

                        # Handle spatial grids - take mean of non-NaN values
                        if hasattr(val, 'shape') and len(val.shape) >= 2:
                            val = np.nanmean(val)
                        elif hasattr(val, 'item'):
                            val = val.item()
                        elif hasattr(val, '__len__') and len(val) > 0:
                            val = float(val[0])

                        if is_valid_value(val, var):
                            variables[var.lower()] = float(val)
                    except Exception:
                        pass

                if variables:
                    records.append({
                        'time': time_val,
                        'depth': depth_val,
                        'lat': lat,
                        'lon': lon,
                        'variables': variables
                    })

        return {
            'datasetId': ds.attrs.get('id', 'unknown'),
            'variables': var_names,
            'records': records,
            'source': 'copernicus'
        }
    finally:
        ds.close()


def handle_subset(request):
    """
    Handle a subset request: call copernicusmarine.subset() to download,
    then parse the NetCDF inline.
    """
    req_id = request['id']
    timeout_seconds = request.get('timeout_seconds', 90)

    # Create a temporary file for the NetCDF output
    tmp_fd, tmp_path = tempfile.mkstemp(suffix='.nc', prefix='cmems_worker_')
    os.close(tmp_fd)

    # Split into directory + filename (copernicusmarine.subset needs them separate)
    tmp_dir = os.path.dirname(tmp_path)
    tmp_name = os.path.basename(tmp_path)

    result = [None]
    error = [None]

    def do_subset():
        try:
            subset_kwargs = {
                'dataset_id': request['dataset_id'],
                'minimum_longitude': request['minimum_longitude'],
                'maximum_longitude': request['maximum_longitude'],
                'minimum_latitude': request['minimum_latitude'],
                'maximum_latitude': request['maximum_latitude'],
                'start_datetime': request['start_datetime'],
                'end_datetime': request['end_datetime'],
                'output_directory': tmp_dir,
                'output_filename': tmp_name,
                'overwrite': True,
            }

            variables = request.get('variables')
            if variables:
                subset_kwargs['variables'] = variables

            # Redirect stdout to stderr during subset to prevent copernicusmarine
            # library from leaking progress/info messages into the JSON protocol
            original_stdout = sys.stdout
            sys.stdout = sys.stderr
            try:
                copernicusmarine.subset(**subset_kwargs)
            finally:
                sys.stdout = original_stdout

            # Verify the file was actually created before parsing
            if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
                error[0] = f'subset produced no output file (exists={os.path.exists(tmp_path)}, size={os.path.getsize(tmp_path) if os.path.exists(tmp_path) else 0})'
                return

            # Parse the downloaded NetCDF
            result[0] = parse_netcdf(tmp_path)
        except (Exception, SystemExit) as e:
            # Catch SystemExit too — copernicusmarine raises it on auth failures
            error[0] = f'{type(e).__name__}: {e}'

    # Run subset in a thread with timeout
    thread = threading.Thread(target=do_subset, daemon=True)
    thread.start()
    thread.join(timeout=timeout_seconds)

    # Clean up temp file
    try:
        os.unlink(tmp_path)
    except OSError:
        pass

    if thread.is_alive():
        return {
            'id': req_id,
            'ok': False,
            'error': f'Timeout after {timeout_seconds}s',
            'error_type': 'timeout'
        }

    if error[0]:
        return {
            'id': req_id,
            'ok': False,
            'error': error[0],
            'error_type': 'subset_error'
        }

    if result[0] is None:
        return {
            'id': req_id,
            'ok': False,
            'error': 'No result produced',
            'error_type': 'empty_result'
        }

    return {
        'id': req_id,
        'ok': True,
        'data': result[0]
    }


def send_response(response):
    """Write a JSON response to stdout and flush."""
    sys.stdout.write(json.dumps(response) + '\n')
    sys.stdout.flush()


def main():
    log('Copernicus worker starting...')

    # Suppress copernicusmarine progress bars and info logging
    os.environ['COPERNICUSMARINE_DISABLE_PROGRESS_BAR'] = 'True'

    # Do NOT call copernicusmarine.login() here!
    # The CI workflow runs `copernicusmarine login` in a dedicated step before ingestion,
    # which caches credentials at ~/.copernicusmarine/.copernicusmarine-credentials.
    # Calling login() again outputs an interactive "overwrite?" prompt to STDOUT,
    # which corrupts the JSON-per-line protocol and crashes the worker.
    log('Using cached credentials from CI login step (no worker-level login)')

    # Signal readiness
    send_response({'id': 'ready', 'ok': True, 'message': 'worker_ready'})
    log('Worker ready, waiting for requests...')

    # Main loop: read JSON requests from stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            send_response({
                'id': 'unknown',
                'ok': False,
                'error': f'Invalid JSON: {e}',
                'error_type': 'parse_error'
            })
            continue

        req_id = request.get('id', 'unknown')
        action = request.get('action', 'subset')

        if action == 'ping':
            send_response({'id': req_id, 'ok': True, 'message': 'pong'})
        elif action == 'shutdown':
            log('Shutdown requested, exiting...')
            send_response({'id': req_id, 'ok': True, 'message': 'shutting_down'})
            break
        elif action == 'subset':
            response = handle_subset(request)
            send_response(response)
        else:
            send_response({
                'id': req_id,
                'ok': False,
                'error': f'Unknown action: {action}',
                'error_type': 'unknown_action'
            })

    log('Worker exiting cleanly.')


if __name__ == '__main__':
    main()
