import { LOCAL_STATIONS, fetchLocalGauge } from '../../scripts/lib/local-monitoring.mjs';
import { localGaugeStatus } from '../../src/lib/local-monitoring';
import { monitoringFixture } from '../fixtures/monitoring';

const now = new Date('2026-11-07T12:00:00Z');
const metadata = (spec = LOCAL_STATIONS.ewenny) => ({ id: spec.stationId, status: 1, parameters: [{ id: spec.parameterId, locationId: spec.stationId, typeText: { english: 'River Level' }, unit: 'm' }] });
const readings = (count = 12, stepMinutes = 15) => ({ data: Array.from({ length: count }, (_, i) => ({ x: new Date(now.getTime() - (count - i) * stepMinutes * 60000).toISOString(), y: .2 + i / 1000 })) });

it('uses Keepers Lodge parameter 64 with real observations/history and its own datum identity', async () => {
  const fetchJson = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValue(readings());
  const gauge = await fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now);
  expect(gauge).toMatchObject({ stationId: 4099, parameterId: 64, unit: 'm', datum: 'unspecified', status: 'available' });
  expect(gauge.value).toBeCloseTo(.211);
  expect(fetchJson.mock.calls[1][0]).toContain('parameterId=64');
  expect(gauge.history.points).toHaveLength(12);
  expect(gauge.observedAt).toBe('2026-11-07T11:45:00.000Z');
  expect(gauge.trendMPerHour).toBe(.004);
  expect(LOCAL_STATIONS.downstream).toMatchObject({ stationId: 4115, parameterId: 112 });
});

it.each([LOCAL_STATIONS.ewenny, LOCAL_STATIONS.downstream])('uses the smaller window for a complete $name graph and trend', async spec => {
  const full = readings(192);
  const fetchJson = vi.fn().mockResolvedValueOnce(metadata(spec)).mockResolvedValueOnce({ data: full.data.slice(-48) });
  const gauge = await fetchLocalGauge(spec, fetchJson, now);
  expect(fetchJson).toHaveBeenCalledTimes(2);
  expect(new URL(fetchJson.mock.calls[1][0]).searchParams.get('from')).toBe('2026-11-07T00:00:00.000Z');
  expect(gauge).toMatchObject({ status: 'available', stationId: spec.stationId, parameterId: spec.parameterId,
    observedAt: '2026-11-07T11:45:00.000Z', value: .391, trendMPerHour: .004 });
  expect(gauge.history.points).toHaveLength(48);
  expect(gauge.history.points[0]).toEqual({ time: '2026-11-07T00:00:00.000Z', value: .344 });
  expect(gauge.history).toMatchObject({ from: '2026-11-07T00:00:00.000Z', to: now.toISOString() });
});

it('retrieves the original range when half-hour readings need more than 12 hours for the trend', async () => {
  const full = readings(96, 30);
  const fetchJson = vi.fn().mockResolvedValueOnce(metadata())
    .mockResolvedValueOnce({ data: full.data.slice(-24) }).mockResolvedValueOnce(full);
  const gauge = await fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now);
  expect(new URL(fetchJson.mock.calls[2][0]).searchParams.get('from')).toBe('2026-11-05T12:00:00.000Z');
  expect(gauge).toMatchObject({ status: 'available', observedAt: '2026-11-07T11:30:00.000Z', trendMPerHour: .002 });
  expect(gauge.value).toBe(full.data.at(-1)?.y);
  expect(gauge.history.points).toHaveLength(24);
});

it('counts unique past observations rather than duplicates or future rows when choosing the range', async () => {
  const short = readings(8).data.flatMap(point => [point, point, point, point]);
  short.push(...Array.from({ length: 40 }, (_, i) => ({ x: new Date(now.getTime() + (i + 1) * 60000).toISOString(), y: 9 })));
  const fetchJson = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce({ data: short }).mockResolvedValueOnce(readings(64));
  const gauge = await fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now);
  expect(fetchJson).toHaveBeenCalledTimes(3);
  expect(gauge).toMatchObject({ status: 'available', value: .263, trendMPerHour: .004 });
});

it('recovers through the original range if the shorter request fails', async () => {
  const fetchJson = vi.fn().mockResolvedValueOnce(metadata()).mockRejectedValueOnce(new Error('short request failed')).mockResolvedValueOnce(readings(48));
  expect(await fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now)).toMatchObject({ status: 'available', value: .247, trendMPerHour: .004 });
});

it('retains the real stale observation when no readings fall in the shorter window', async () => {
  const old = readings().data.map(point => ({ ...point, x: new Date(Date.parse(point.x) - 24 * 3600000).toISOString() }));
  const fetchJson = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: old });
  const gauge = await fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now);
  expect(gauge).toMatchObject({ status: 'available', observedAt: '2026-11-06T11:45:00.000Z', trendMPerHour: .004 });
  expect(gauge.history.points).toEqual([]);
  expect(localGaugeStatus(gauge, 'ewenny', now.getTime())).toMatchObject({ stale: true, available: false });
});

it('reports unavailable if the necessary full range fails instead of using an incomplete trend', async () => {
  const fetchJson = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(readings(8)).mockRejectedValueOnce(new Error('full request failed'));
  expect(await fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now)).toMatchObject({ status: 'unavailable' });
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
