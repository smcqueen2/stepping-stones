import type { FloodWarning, MonitoringPayload } from '../../src/lib/types';

export function monitoringFixture(now: number): MonitoringPayload {
  const iso = (minutes: number) => new Date(now + minutes * 60000).toISOString();
  const gauge = (stationId: number, parameterId: number, name: string, value: number) => ({
    stationId, parameterId, name, unit: 'm' as const, datum: 'unspecified' as const, source: 'NRW' as const,
    sourceUrl: `https://rivers-and-seas.naturalresources.wales/Station/${stationId}`, status: 'available' as const,
    value, observedAt: iso(-10), trendMPerHour: .1,
    history: { from: iso(-720), to: iso(0), points: [{ time: iso(-30), value: value - .01 }, { time: iso(-10), value }] },
  });
  return { schemaVersion: 1, generatedAt: iso(-5),
    gauges: { ewenny: gauge(4099, 64, 'Ewenny at Keepers Lodge', .27), downstream: gauge(4115, 112, 'Ogmore at Penybont', .6) },
    floodWarnings: { status: 'available', attemptedAt: iso(-5), checkedAt: iso(-5), warnings: [] } };
}
export function warningFixture(now: number, severity: 1 | 2 | 3 | 4 = 2): FloodWarning {
  return { areaId: '102FWB402A', areaName: 'Tidal area at Ogmore Castle', scope: 'local', severity,
    severityName: ['Severe Flood Warning', 'Flood Warning', 'Flood Alert', 'Warning no longer in force'][severity - 1],
    description: 'TEST FIXTURE ONLY — Ogmore Castle area', message: 'TEST FIXTURE ONLY — not live warning information.',
    tidal: true, raisedAt: new Date(now - 2 * 86400000).toISOString(), severityChangedAt: new Date(now - 86400000).toISOString(),
    updatedAt: new Date(now - 3600000).toISOString(), sourceUrl: 'https://flood-warning.naturalresources.wales/Detail/102FWB402A' };
}
