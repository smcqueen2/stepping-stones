import { futureRainWindow, projectRiverReading } from '../../scripts/lib/forecast-window.mjs';

describe('future forecast generation', () => {
  it('starts after the current time when the provider returns hours from midnight', () => {
    const start = Date.parse('2026-10-24T00:00:00Z');
    const now = new Date('2026-10-24T16:40:00Z');
    const rows = Array.from({ length: 48 }, (_, i) => ({ timestamp: new Date(start + i * 3_600_000).toISOString() }));
    const result = futureRainWindow(rows, now);
    expect(result).toHaveLength(24);
    expect(result[0].timestamp).toBe('2026-10-24T17:00:00.000Z');
    expect(result.at(-1).timestamp).toBe('2026-10-25T16:00:00.000Z');
  });
  it('refuses to manufacture dry future hours from an insufficient response', () => {
    expect(() => futureRainWindow([], new Date())).toThrow('Insufficient');
  });
  it('preserves row identity and duplicate order while sorting offsets and excluding invalid or old times', () => {
    const first = { timestamp: '2026-10-24T18:00:00+01:00', rain: 1 };
    const duplicate = { timestamp: '2026-10-24T17:00:00Z', rain: 2 };
    const later = { timestamp: '2026-10-24T18:00:00Z', rain: 3 };
    const rows = [later, { timestamp: 'invalid' }, first, duplicate, { timestamp: '2026-10-24T16:00:00Z' }];
    const before = [...rows];
    const result = futureRainWindow(rows, new Date('2026-10-24T16:40:00Z'), 3);
    expect(result).toEqual([first, duplicate, later]);
    expect(result[0]).toBe(first); expect(result[1]).toBe(duplicate); expect(rows).toEqual(before);
  });
  it('projects river trend from observation time rather than a row index from midnight', () => {
    expect(projectRiverReading(1.5, .1, '2026-10-24T16:30:00Z', '2026-10-24T18:00:00Z', 0)).toBeCloseTo(1.65);
    expect(projectRiverReading(1.5, .1, '2026-10-24T16:30:00Z', '2026-10-24T18:00:00Z', 2)).toBeCloseTo(1.662);
  });
});
