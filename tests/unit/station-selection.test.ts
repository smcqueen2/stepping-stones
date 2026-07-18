import { pickPreferredTideStation } from '../../scripts/lib/station-selection.mjs';

describe('pickPreferredTideStation', () => {
  const now = '2026-07-19T10:00:00Z';

  it('uses primary when fresh', () => {
    const result = pickPreferredTideStation(
      [
        {
          priority: 0,
          stationId: 72839,
          latestTime: '2026-07-19T09:40:00Z',
        },
        {
          priority: 1,
          stationId: 72639,
          latestTime: '2026-07-19T09:50:00Z',
        },
      ],
      120,
      now,
    );

    expect(result.station.stationId).toBe(72839);
    expect(result.usedFallback).toBe(false);
    expect(result.stale).toBe(false);
  });

  it('falls back when primary stale', () => {
    const result = pickPreferredTideStation(
      [
        {
          priority: 0,
          stationId: 72839,
          latestTime: '2026-07-19T04:40:00Z',
        },
        {
          priority: 1,
          stationId: 72639,
          latestTime: '2026-07-19T09:40:00Z',
        },
      ],
      120,
      now,
    );

    expect(result.station.stationId).toBe(72639);
    expect(result.usedFallback).toBe(true);
    expect(result.stale).toBe(false);
  });

  it('marks stale when all stale', () => {
    const result = pickPreferredTideStation(
      [
        {
          priority: 0,
          stationId: 72839,
          latestTime: '2026-07-18T20:40:00Z',
        },
        {
          priority: 1,
          stationId: 72639,
          latestTime: '2026-07-18T22:40:00Z',
        },
      ],
      120,
      now,
    );

    expect(result.stale).toBe(true);
  });
});
