import { loadPreferredTideStation, pickPreferredTideStation } from '../../scripts/lib/station-selection.mjs';

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

describe('lazy tide metadata fetching', () => {
  const now = '2026-11-10T12:00:00Z';
  const specs = [{ stationId: 72839, priority: 0 }, { stationId: 72639, priority: 1 }, { stationId: 72439, priority: 2 }];
  it('does not fetch unused fallback metadata when the primary is current', async () => {
    const load = vi.fn(async spec => ({ ...spec, latestTime: '2026-11-10T11:45:00Z' }));
    const selected = await loadPreferredTideStation(specs, load, 120, now);
    expect(selected.station.stationId).toBe(72839);
    expect(selected.stale).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('continues after stale or unavailable stations and selects the first fresh fallback', async () => {
    const load = vi.fn().mockResolvedValueOnce({ ...specs[0], latestTime: '2026-11-10T06:00:00Z' })
      .mockRejectedValueOnce(new Error('station unavailable'))
      .mockResolvedValueOnce({ ...specs[2], latestTime: '2026-11-10T11:30:00Z' });
    const selected = await loadPreferredTideStation(specs, load, 120, now);
    expect(selected.station.stationId).toBe(72439);
    expect(selected.usedFallback).toBe(true);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('checks every station before selecting the freshest stale reading', async () => {
    const candidates = specs.map((spec, i) => ({ ...spec, latestTime: `2026-11-10T0${6 + i}:00:00Z` }));
    const load = vi.fn(async spec => candidates.find(c => c.stationId === spec.stationId));
    expect(await loadPreferredTideStation(specs, load, 120, now)).toEqual(pickPreferredTideStation(candidates, 120, now));
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('skips missing metadata, preserves priority order and fails when no source can be used', async () => {
    const load = vi.fn().mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ ...specs[1], latestTime: '2026-11-10T11:30:00Z' });
    expect((await loadPreferredTideStation([...specs].reverse(), load, 120, now)).station.stationId).toBe(72639);
    expect(load.mock.calls.map(call => call[0].stationId)).toEqual([72839, 72639]);
    await expect(loadPreferredTideStation(specs, async () => undefined, 120, now)).rejects.toThrow('No tide station');
  });
});
