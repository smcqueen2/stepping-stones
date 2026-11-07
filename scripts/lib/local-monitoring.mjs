import { gaugeSeries, recentLevels } from './recent-levels.mjs';
import { linearTrendPerHour } from './forecast-model.mjs';

export const LOCAL_STATIONS = {
  ewenny: { stationId: 4099, parameterId: 64, name: 'Ewenny at Keepers Lodge' },
  downstream: { stationId: 4115, parameterId: 112, name: 'Ogmore at Penybont' },
};
const base = 'https://rivers-and-seas.naturalresources.wales';

/** Reuse the existing NRW JSON transport and series parser; never substitute another station's zero. */
export async function fetchLocalGauge(spec, fetchJson, now = new Date()) {
  const identity = { ...spec, unit: 'm', datum: 'unspecified', source: 'NRW',
    sourceUrl: `${base}/Station/${spec.stationId}` };
  try {
    const station = await fetchJson(`${base}/Station/GetData/${spec.stationId}?includeStationParameters=true`);
    const parameter = station?.parameters?.find(item => item.id === spec.parameterId
      && item.locationId === spec.stationId && item.typeText?.english === 'River Level' && item.unit === 'm');
    if (station?.id !== spec.stationId || station.status !== 1 || !parameter) throw new Error('Gauge metadata unavailable');
    const from = new Date(now.getTime() - 48 * 3600000).toISOString();
    const response = await fetchJson(`${base}/graph/getdata?parameterId=${spec.parameterId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(now.toISOString())}`);
    const series = gaugeSeries(response).filter(point => Date.parse(point.time) <= now.getTime());
    // Duplicate timestamps are ambiguous; keep one actual reading at each instant.
    const unique = [...new Map(series.map(point => [Date.parse(point.time), point])).values()];
    const latest = unique.at(-1);
    if (!latest) throw new Error('No usable gauge readings');
    const history = recentLevels(unique, [], now.toISOString());
    return { ...identity, status: 'available', observedAt: latest.time, value: latest.value,
      trendMPerHour: unique.length >= 8 ? Number(linearTrendPerHour(unique.slice(-32)).toFixed(4)) : null,
      history: { from: history.from, to: history.to, points: history.river } };
  } catch {
    return { ...identity, status: 'unavailable' };
  }
}
