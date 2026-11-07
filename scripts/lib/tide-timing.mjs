// Coastal timing guidance only. Never use these MSL heights in the NRW AOD risk model.
export function coastalTideTiming(response, generatedAt) {
  const times = response?.hourly?.time;
  const levels = response?.hourly?.sea_level_height_msl;
  if (!Array.isArray(times) || !Array.isArray(levels) || times.length !== levels.length
      || !Number.isFinite(response.latitude) || !Number.isFinite(response.longitude)
      || response.hourly_units?.time !== 'unixtime' || response.hourly_units?.sea_level_height_msl !== 'm') return undefined;
  const events = [];
  for (let i = 1; i < times.length - 1; i++) {
    const [before, value, after] = levels.slice(i - 1, i + 2);
    if (![before, value, after, times[i - 1], times[i], times[i + 1]].every(Number.isFinite)) continue;
    // Do not interpolate across missing or irregular forecast steps.
    if (times[i] - times[i - 1] !== 3600 || times[i + 1] - times[i] !== 3600) continue;
    const type = value > before && value >= after ? 'high' : value < before && value <= after ? 'low' : undefined;
    if (!type) continue;
    const offset = .5 * (before - after) / (before - 2 * value + after);
    const time = new Date(Math.round((times[i] + offset * 3600) / 1800) * 1800000).toISOString();
    events.push({ type, time });
  }
  const from = times[0] * 1000;
  const to = times.at(-1) * 1000;
  const generated = Date.parse(generatedAt);
  if (!Number.isFinite(generated) || !Number.isFinite(from) || !Number.isFinite(to)
      || from > generated || to < generated + 24 * 3600000 || events.length < 4) return undefined;
  return {
    generatedAt, source: 'Open-Meteo Marine', location: 'Ogmore coast',
    latitude: response.latitude, longitude: response.longitude,
    validFrom: new Date(from).toISOString(), validTo: new Date(to).toISOString(), events,
  };
}
