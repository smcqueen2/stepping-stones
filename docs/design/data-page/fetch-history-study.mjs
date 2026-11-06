import { writeFile } from 'node:fs/promises';

const base = 'https://rivers-and-seas.naturalresources.wales';
const to = new Date();
const from = new Date(to.getTime() - 7 * 86400000);
const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};
const snapshot = { fetchedAt: to.toISOString(), from: from.toISOString(), sources: [] };
await Promise.all([
  { role: 'river', station: 4083, parameter: 110 },
  { role: 'tide', station: 72839, parameter: 10254 }
].map(async (source) => {
  const [station, response] = await Promise.all([
    fetchJson(`${base}/Station/GetData/${source.station}?includeStationParameters=true`),
    fetchJson(`${base}/graph/getdata?parameterId=${source.parameter}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
  ]);
  const parameter = station.parameters.find((p) => p.id === source.parameter);
  const parsed = (response.data || []).map((p) => ({ time: p.x, value: p.y == null ? NaN : Number(p.y) }))
    .filter((p) => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.time)))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const points = [...new Map(parsed.map((p) => [p.time, p])).values()];
  const result = { ...source, title: station.title?.english, unit: parameter?.unit, points };
  snapshot.sources.push(result);
  console.log(JSON.stringify({ role: source.role, title: result.title, unit: result.unit, count: points.length, first: points[0], last: points.at(-1) }));
}));
snapshot.sources.sort((a, b) => a.role.localeCompare(b.role));
const weather = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=51.4759&longitude=-3.6206&hourly=precipitation&past_days=7&forecast_days=1&timezone=UTC`);
snapshot.rain = weather.hourly.time.map((time, index) => ({ time: `${time}:00Z`, value: weather.hourly.precipitation[index] }))
  .filter((p) => p.value != null && Number.isFinite(p.value) && Date.parse(p.time) <= to.getTime() && Date.parse(p.time) >= from.getTime());
console.log(JSON.stringify({ role: 'modelled precipitation', unit: weather.hourly_units.precipitation, count: snapshot.rain.length, first: snapshot.rain[0], last: snapshot.rain.at(-1) }));
await writeFile(new URL('./history-study.json', import.meta.url), JSON.stringify(snapshot));
