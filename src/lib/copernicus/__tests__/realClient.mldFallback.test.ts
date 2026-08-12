/**
 * MLD must survive a dataset that does not carry the bottom-temperature variable.
 *
 * Mixed layer depth and bottom temperature are requested in ONE subset call, and
 * copernicusmarine fails the whole call when any requested variable is absent. Without a fallback,
 * routing bottom temperature at a product lacking `tob` costs the region its MLD as well — and
 * silently, because every error in that loop is swallowed, no truth-check watches MLD, and it feeds
 * only a display card. NWS would have dropped from 703 of 800 cells to zero with nothing to say so.
 *
 * These tests drive the private fetchAndParse so no worker, network or credentials are involved.
 */
import { RealCopernicusProvider } from '../realClient';

type Call = { dataset: string; variables: string[] };

/**
 * Stand in for a CMEMS subset response with one usable record. `hasValidData` only requires a
 * record carrying at least one finite value.
 */
const timeseries = (variables: string[]) => ({
  datasetId: 'stub',
  variables,
  records: [{ time: '2026-08-12T00:00:00Z', variables: Object.fromEntries(variables.map(v => [v, 12.5])) }],
  source: 'copernicus' as const,
});

/**
 * @param rejectVariable a variable the fake dataset does not have; requesting it throws the same
 *                       VARIABLE_NOT_FOUND shape realClient raises for the worker's error_type.
 */
function stubProvider(region: string, rejectVariable: string | null) {
  const provider = new RealCopernicusProvider(region);
  const calls: Call[] = [];
  jest
    .spyOn(provider as unknown as { fetchAndParse: (...a: unknown[]) => unknown }, 'fetchAndParse')
    .mockImplementation(async (...args: unknown[]) => {
      const dataset = args[0] as string;
      const variables = (args[1] as string[]) ?? [];
      calls.push({ dataset, variables });
      if (rejectVariable && variables.includes(rejectVariable)) {
        throw new Error(`VARIABLE_NOT_FOUND: VariableDoesNotExist: ${rejectVariable}`);
      }
      return timeseries(variables.length ? variables : ['thetao']);
    });
  return { provider, calls };
}

const mldCalls = (calls: Call[]) => calls.filter(c => c.variables.includes('mlotst'));

describe('MLD fallback when a dataset lacks the bottom-temperature variable', () => {
  // NWS coordinates (northern North Sea) with an explicit window — fetchBundle derives its date
  // fallbacks from `start`, so it must be a real ISO string.
  const at = { lat: 54.5, lon: -2.0, start: '2026-08-12T00:00:00.000Z', end: '2026-08-12T00:00:00.000Z' };

  it('NWS asks for mlotst and tob together', async () => {
    const { provider, calls } = stubProvider('NWS', null);
    await provider.fetchBundle(at);

    const mld = mldCalls(calls);
    expect(mld.length).toBeGreaterThan(0);
    // The routing this guards: NWS gets bottom temperature via the MLD call, not its own fetch.
    expect(mld[0].variables).toEqual(expect.arrayContaining(['mlotst', 'tob']));
  });

  it('retries without tob when the dataset rejects it, and still asks for MLD', async () => {
    const { provider, calls } = stubProvider('NWS', 'tob');
    await provider.fetchBundle(at);

    const mld = mldCalls(calls);
    expect(mld.length).toBeGreaterThanOrEqual(2);
    expect(mld[0].variables).toContain('tob');       // the attempt that fails
    expect(mld[1].variables).toEqual(['mlotst']);    // the narrowed retry, which succeeds

    // The point of the whole exercise: a second, narrower MLD request is actually issued rather
    // than the region losing mixed layer depth along with the variable it never had.
  });

  it('does not keep re-asking for a variable already known to be absent', async () => {
    const { provider, calls } = stubProvider('NWS', 'tob');
    await provider.fetchBundle(at);

    // Narrowing is held outside the padding and date-fallback loops, so exactly one call should
    // ever include `tob`. Re-asking would spend a CMEMS request per padding per date on something
    // that cannot succeed.
    expect(mldCalls(calls).filter(c => c.variables.includes('tob'))).toHaveLength(1);
  });

  it('leaves an unrelated failure to the ordinary retry path', async () => {
    const provider = new RealCopernicusProvider('NWS');
    const calls: Call[] = [];
    jest
      .spyOn(provider as unknown as { fetchAndParse: (...a: unknown[]) => unknown }, 'fetchAndParse')
      .mockImplementation(async (...args: unknown[]) => {
        const variables = (args[1] as string[]) ?? [];
        calls.push({ dataset: args[0] as string, variables });
        if (variables.includes('mlotst')) throw new Error('timeout after 120s');
        return timeseries(variables.length ? variables : ['thetao']);
      });

    await provider.fetchBundle(at);

    // A timeout must not be mistaken for a missing variable — narrowing on it would quietly stop
    // requesting bottom temperature for a region that has it.
    expect(mldCalls(calls).every(c => c.variables.includes('tob'))).toBe(true);
  });
});
