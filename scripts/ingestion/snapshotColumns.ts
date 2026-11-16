/**
 * Which columns of a findr_conditions_snapshots row one ingestion run writes.
 *
 * MET Norway and Open-Meteo both upsert the same (rectangle_code, snapshot_day)
 * row and have different coverage, so a run sends only the columns it has a
 * value for: a null from one source must not erase what the other filled.
 *
 * Except for columns derived from other columns in the same row. tide_phase and
 * tide_flow_speed_ms are worked out (calculate_tide_phase /
 * calculate_tide_flow_speed) from captured_at and the next high and low that
 * this run also writes. When those functions answer null (turns implausibly far
 * apart, or the next turn further off than the gap after it), dropping the null
 * kept the phase from an earlier run against the new times. Measured
 * 2026-11-16 09:17Z: 25K8, flooding to high water at 15:30, stored 'mid_ebb' at
 * 1.2 m/s from an earlier run that day; 4 of 146 rows were like it.
 *
 * So whenever the tide times are written, the derived tide columns are written
 * with them, null included.
 */

/** Always sent: the identity, the trigger's input, and which feed last wrote. */
const ALWAYS_SEND = new Set(['rectangle_code', 'captured_at', 'source']);

/** Derived from the tide times; travel with them. */
const TIDE_TIMES = ['next_high_tide_iso', 'next_low_tide_iso'] as const;
const TIDE_DERIVED = ['tide_phase', 'tide_flow_speed_ms'] as const;

const present = (v: unknown) => v !== null && v !== undefined;

export function snapshotColumnsToWrite<T extends Record<string, unknown>>(row: T): Partial<T> {
  const writesTideTimes = TIDE_TIMES.some((k) => present(row[k]));
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key, value]) =>
        ALWAYS_SEND.has(key) ||
        present(value) ||
        (writesTideTimes && (TIDE_DERIVED as readonly string[]).includes(key)),
    ),
  ) as Partial<T>;
}
