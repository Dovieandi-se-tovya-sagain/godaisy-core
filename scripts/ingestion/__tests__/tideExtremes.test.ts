import { pickNextExtremes, tideTimeMs } from '../tideExtremes';

// A WorldTides series as fetchWorldTides now returns it: starting 14 h before
// UTC midnight, so the first high and low are yesterday's.
const WT = [
  { time: '2026-11-15T12:09:49+0000', type: 'low', epochMs: Date.parse('2026-11-15T12:09:49Z') },
  { time: '2026-11-15T18:13:55+0000', type: 'high', epochMs: Date.parse('2026-11-15T18:13:55Z') },
  { time: '2026-11-16T00:31:00+0000', type: 'low', epochMs: Date.parse('2026-11-16T00:31:00Z') },
  { time: '2026-11-16T06:40:00+0000', type: 'high', epochMs: Date.parse('2026-11-16T06:40:00Z') },
  { time: '2026-11-16T12:55:00+0000', type: 'low', epochMs: Date.parse('2026-11-16T12:55:00Z') },
  { time: '2026-11-16T19:02:00+0000', type: 'high', epochMs: Date.parse('2026-11-16T19:02:00Z') },
];

describe('pickNextExtremes', () => {
  it('skips the turns already past and returns the next high and low after the capture', () => {
    expect(pickNextExtremes(WT, Date.parse('2026-11-16T09:30:00Z'))).toEqual({
      nextHigh: '2026-11-16T19:02:00+0000',
      nextLow: '2026-11-16T12:55:00+0000',
    });
  });

  it('is not fooled by the series starting the day before (the bug)', () => {
    const first = pickNextExtremes(WT, Date.parse('2026-11-16T01:00:00Z'));
    expect(first).toEqual({ nextHigh: '2026-11-16T06:40:00+0000', nextLow: '2026-11-16T12:55:00+0000' });
  });

  it('treats a turn exactly at the capture as past', () => {
    expect(pickNextExtremes(WT, Date.parse('2026-11-16T06:40:00Z')).nextHigh).toBe('2026-11-16T19:02:00+0000');
  });

  it('returns null where the series has nothing left', () => {
    expect(pickNextExtremes(WT, Date.parse('2026-11-16T20:00:00Z'))).toEqual({ nextHigh: null, nextLow: null });
    expect(pickNextExtremes(null, 0)).toEqual({ nextHigh: null, nextLow: null });
  });

  it('does not depend on the series being sorted', () => {
    const shuffled = [WT[5], WT[0], WT[3], WT[4], WT[1], WT[2]];
    expect(pickNextExtremes(shuffled, Date.parse('2026-11-16T01:00:00Z'))).toEqual({
      nextHigh: '2026-11-16T06:40:00+0000',
      nextLow: '2026-11-16T12:55:00+0000',
    });
  });

  it('reads Stormglass ISO times and mixed-case types', () => {
    const sg = [
      { time: '2026-11-16T03:00:00+00:00', type: 'High' },
      { time: '2026-11-16T10:00:00+00:00', type: 'LOW' },
      { time: '2026-11-16T15:00:00+00:00', type: 'high' },
    ];
    expect(pickNextExtremes(sg, Date.parse('2026-11-16T05:00:00Z'))).toEqual({
      nextHigh: '2026-11-16T15:00:00+00:00',
      nextLow: '2026-11-16T10:00:00+00:00',
    });
  });

  it('skips unreadable times and unknown types', () => {
    const bad = [
      { time: 'nope', type: 'high' },
      { time: '2026-11-16T10:00:00Z', type: 'slack' },
      { time: '2026-11-16T11:00:00Z', type: 'low' },
    ];
    expect(pickNextExtremes(bad, Date.parse('2026-11-16T05:00:00Z'))).toEqual({ nextHigh: null, nextLow: '2026-11-16T11:00:00Z' });
  });
});

describe('tideTimeMs', () => {
  it('reads NOAA GMT times as UTC, whatever the machine time zone', () => {
    expect(tideTimeMs({ time: '2026-11-16 04:12', type: 'high' })).toBe(Date.parse('2026-11-16T04:12:00Z'));
    expect(tideTimeMs({ time: '2026-11-16 04:12:30', type: 'high' })).toBe(Date.parse('2026-11-16T04:12:30Z'));
  });
  it('prefers the epoch the source gave', () => {
    expect(tideTimeMs({ time: 'whatever', type: 'low', epochMs: 42 })).toBe(42);
  });
});
