import {
  classifyState,
  detectExtrema,
  linearTrendPerHour,
  projectTideLevel,
  riskScore,
  semidiurnalIntervalHours,
} from '../../src/lib/model';

describe('state classification', () => {
  const thresholds = { likelyPassableMax: 0.45, cautionMax: 0.7 };

  it('uses likely passable below lower threshold', () => {
    expect(classifyState(0.44, thresholds)).toBe('Likely Passable');
  });

  it('uses caution at lower threshold', () => {
    expect(classifyState(0.45, thresholds)).toBe('Caution');
  });

  it('uses likely unpassable at high threshold', () => {
    expect(classifyState(0.7, thresholds)).toBe('Likely Unpassable');
  });
});

describe('risk and trend math', () => {
  it('calculates weighted risk score', () => {
    const score = riskScore(
      { tide: 0.8, river: 0.4, rain: 0.1 },
      { tide: 0.45, river: 0.35, rain: 0.2 },
    );

    expect(score).toBeCloseTo(0.52, 2);
  });

  it('calculates positive linear trend per hour', () => {
    const trend = linearTrendPerHour([
      { time: '2026-07-19T00:00:00Z', value: 0.2 },
      { time: '2026-07-19T01:00:00Z', value: 0.23 },
      { time: '2026-07-19T02:00:00Z', value: 0.26 },
      { time: '2026-07-19T03:00:00Z', value: 0.29 },
    ]);

    expect(trend).toBeGreaterThan(0.025);
    expect(trend).toBeLessThan(0.035);
  });
});

describe('tide projection', () => {
  it('detects extrema and semidiurnal interval', () => {
    const points = [
      { time: '2026-07-19T00:00:00Z', value: -1.0 },
      { time: '2026-07-19T03:00:00Z', value: 1.0 },
      { time: '2026-07-19T06:00:00Z', value: -1.0 },
      { time: '2026-07-19T09:00:00Z', value: 1.0 },
      { time: '2026-07-19T12:00:00Z', value: -1.0 },
      { time: '2026-07-19T15:00:00Z', value: 1.0 },
    ];

    const extrema = detectExtrema(points);
    const interval = semidiurnalIntervalHours(extrema);

    expect(extrema.length).toBeGreaterThan(1);
    expect(interval).toBeGreaterThan(8);
    expect(interval).toBeLessThan(14);
  });

  it('projects tide near high shortly after high reference', () => {
    const extrema = [
      { type: 'high' as const, time: '2026-07-19T00:00:00Z', value: 2 },
      { type: 'low' as const, time: '2026-07-19T06:00:00Z', value: -2 },
      { type: 'high' as const, time: '2026-07-19T12:00:00Z', value: 2 },
    ];

    const projected = projectTideLevel('2026-07-19T13:00:00Z', extrema, 0, 2);

    expect(projected).toBeGreaterThan(1);
  });
});
