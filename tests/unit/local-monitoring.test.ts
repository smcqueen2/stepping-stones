import { LOCAL_STATIONS, fetchLocalGauge } from '../../scripts/lib/local-monitoring.mjs';
import { localGaugeStatus } from '../../src/lib/local-monitoring';
import { monitoringFixture } from '../fixtures/monitoring';

const now = new Date('2026-11-07T12:00:00Z');
const metadata = () => ({ id: 4099, status: 1, parameters: [{ id: 64, locationId: 4099, typeText: { english: 'River Level' }, unit: 'm' }] });
const readings = () => ({ data: Array.from({ length: 12 }, (_, i) => ({ x: new Date(now.getTime() - (12 - i) * 15 * 60000).toISOString(), y: .2 + i / 1000 })) });

it('uses Keepers Lodge parameter 64 with real observations/history and its own datum identity', async () => {
  const fetchJson = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(readings());
  const gauge = await fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now);
  expect(gauge).toMatchObject({ stationId: 4099, parameterId: 64, unit: 'm', datum: 'unspecified', status: 'available' });
  expect(gauge.value).toBeCloseTo(.211);
  expect(fetchJson.mock.calls[1][0]).toContain('parameterId=64');
  expect(gauge.history.points).toHaveLength(12);
  expect(gauge.observedAt).toBe('2026-11-07T11:45:00.000Z');
  expect(gauge.trendMPerHour).toBe(.004);
  expect(LOCAL_STATIONS.downstream).toMatchObject({ stationId: 4115, parameterId: 112 });
});

it.each(['wrong station', 'wrong parameter', 'wrong unit', 'wrong type', 'offline'])('rejects %s without substituting another gauge', async problem => {
  const meta = metadata();
  if (problem === 'wrong station') meta.id = 4083;
  if (problem === 'wrong parameter') meta.parameters[0].id = 110;
  if (problem === 'wrong unit') meta.parameters[0].unit = 'mAOD';
  if (problem === 'wrong type') meta.parameters[0].typeText.english = 'Rainfall';
  if (problem === 'offline') meta.status = 0;
  const fetchJson = vi.fn().mockResolvedValue(meta);
  expect(await fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now)).toMatchObject({ status: 'unavailable', stationId: 4099 });
  expect(fetchJson).toHaveBeenCalledTimes(1);
});

it('keeps gauge failures independent and discards missing/future values instead of inventing zero', async () => {
  expect(await fetchLocalGauge(LOCAL_STATIONS.downstream, vi.fn().mockRejectedValue(new Error('offline')), now)).toMatchObject({ status: 'unavailable', stationId: 4115 });
  const fetchJson = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce({ data: [
    { x: '2026-11-07T11:45:00Z', y: null }, { x: '2026-11-08T11:45:00Z', y: 9 },
  ] });
  expect((await fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now)).status).toBe('unavailable');
});

it('ages each station independently, accepts real zero and rejects substituted sources', () => {
  const data = monitoringFixture(now.getTime());
  const river = data.gauges.ewenny;
  expect(localGaugeStatus(river, 'ewenny', now.getTime())).toMatchObject({ available: true, ageMinutes: 10 });
  river.value = 0;
  expect(localGaugeStatus(river, 'ewenny', now.getTime()).available).toBe(true);
  expect(localGaugeStatus(river, 'ewenny', now.getTime() + 121 * 60000)).toMatchObject({ available: false, stale: true });
  expect(localGaugeStatus(data.gauges.downstream, 'ewenny', now.getTime()).available).toBe(false);
  river.observedAt = '2026-11-07T12:30:00Z';
  expect(localGaugeStatus(river, 'ewenny', now.getTime()).available).toBe(false);
});
