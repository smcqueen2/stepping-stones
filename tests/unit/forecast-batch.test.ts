import { createTideProjector, summarizeForecast } from '../../scripts/lib/forecast-model.mjs';
import { projectTideLevel } from '../../src/lib/model';

it('matches the independent tide model across a full forecast without mutating the observations', () => {
  const extrema = [
    { type: 'high' as const, time: '2026-10-25T12:30:00Z', value: 2.1 },
    { type: 'high' as const, time: '2026-10-25T00:00:00Z', value: 2.4 },
    { type: 'low' as const, time: '2026-10-25T06:15:00Z', value: -2.1 },
  ];
  const original = structuredClone(extrema);
  const projector = createTideProjector(extrema, .4, 1.5);
  for (let hour = 0; hour < 48; hour++) {
    const time = new Date(Date.parse('2026-10-25T00:00:00Z') + hour * 3600000).toISOString();
    expect(projector(time)).toBe(projectTideLevel(time, extrema, .4, 1.5));
  }
  expect(extrema).toEqual(original);
});

it('preserves the existing empty, zero-median and single-extremum fallback behaviour', () => {
  for (const extrema of [[], [{ type: 'low' as const, time: '2026-11-10T12:00:00Z', value: 0 }],
    [{ type: 'low' as const, time: '2026-11-10T06:00:00Z', value: -1 },
      { type: 'high' as const, time: '2026-11-10T12:00:00Z', value: 1 }]]) {
    for (const mean of [0, .7]) for (const amplitude of [0, 1.2]) {
      const time = '2026-11-10T13:00:00Z';
      expect(createTideProjector(extrema, mean, amplitude)(time)).toBe(projectTideLevel(time, extrema, mean, amplitude));
    }
  }
});

it('retains UK summary text across the daylight-saving change and consecutive uses', () => {
  for (const [timestamp, label] of [['2026-10-25T00:30:00Z', '25 Oct, 01:30'],
    ['2026-10-25T01:30:00Z', '25 Oct, 01:30'], ['2026-11-10T23:00:00Z', '10 Nov, 23:00'],
    ['not-a-date', 'Invalid Date']]) {
    const hours = [{ timestamp, riskScore: .8, state: 'Likely Unpassable' as const,
      projectedTideLevelMAOD: 1, projectedRiverLevelM: .4, rainfallMm: 0, precipitationProbabilityPct: 0,
      riskComponents: { tide: .8, river: .4, rain: 0 } }];
    expect(summarizeForecast(hours)).toEqual({ highestRiskWindow: `${label} (Likely Unpassable)`,
      likelyUnpassableHours: 1, cautionHours: 0, likelyPassableHours: 0 });
  }
  expect(summarizeForecast([])).toEqual({ highestRiskWindow: 'No forecast data',
    likelyUnpassableHours: 0, cautionHours: 0, likelyPassableHours: 0 });
});
