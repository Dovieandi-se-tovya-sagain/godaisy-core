import { snapshotColumnsToWrite } from '../snapshotColumns';

const base = {
  rectangle_code: '25K8',
  captured_at: '2026-11-16T09:17:15.643Z',
  source: 'ingest:met',
  wave_height_m: null as number | null,
  sst_c: 12.1 as number | null,
  next_high_tide_iso: '2026-11-16T15:30:52+0000' as string | null,
  next_low_tide_iso: '2026-11-16T20:59:24+0000' as string | null,
  tide_phase: null as string | null,
  tide_flow_speed_ms: null as number | null,
};

describe('snapshotColumnsToWrite', () => {
  it('drops ordinary nulls so one source does not erase another', () => {
    const out = snapshotColumnsToWrite(base);
    expect(out).not.toHaveProperty('wave_height_m');
    expect(out.sst_c).toBe(12.1);
    expect(out.rectangle_code).toBe('25K8');
  });

  it('writes a null tide phase and flow alongside new tide times (25K8, 2026-11-16)', () => {
    const out = snapshotColumnsToWrite(base);
    expect(out).toHaveProperty('tide_phase', null);
    expect(out).toHaveProperty('tide_flow_speed_ms', null);
    expect(out.next_high_tide_iso).toBe(base.next_high_tide_iso);
  });

  it('leaves the stored tide columns alone when this run has no tide times', () => {
    const out = snapshotColumnsToWrite({ ...base, next_high_tide_iso: null, next_low_tide_iso: null });
    expect(out).not.toHaveProperty('tide_phase');
    expect(out).not.toHaveProperty('tide_flow_speed_ms');
    expect(out).not.toHaveProperty('next_high_tide_iso');
  });

  it('always sends the identity, capture time and source, even if null', () => {
    const out = snapshotColumnsToWrite({ ...base, source: null as unknown as string });
    expect(out).toHaveProperty('source', null);
  });
});
