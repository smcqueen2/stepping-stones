/** Keep the next 24 hours, not the provider's first 24 rows from midnight. */
export function futureRainWindow(rows, now, count = 24, timeOf = row => Date.parse(row.timestamp)) {
  const start = now.getTime();
  const future = rows.map(row => ({ row, time: timeOf(row) }))
    .filter(point => point.time >= start).sort((a, b) => a.time - b.time)
    .slice(0, count).map(point => point.row);
  // Missing forecast hours are an error; a dry forecast is not an observation.
  if (future.length < count) throw new Error('Insufficient future rainfall hours');
  return future;
}

/** Validate every provider time, but defer ISO formatting until the future rows are selected. */
export function rainfallRows(hourly) {
  return hourly.time.map((time, index) => {
    const timestamp = Date.parse(`${time}:00Z`);
    if (!Number.isFinite(timestamp)) throw new RangeError('Invalid time value');
    return { timestamp,
      rainfallMm: Number.isFinite(hourly.rain?.[index]) ? Number(hourly.rain[index]) : Number(hourly.precipitation?.[index] ?? 0),
      precipitationProbabilityPct: Number(hourly.precipitation_probability?.[index] ?? 0) };
  });
}

export function projectRiverReading(value, trend, observedAt, targetAt, cumulativeRain) {
  const hoursAhead = Math.max(0, (Date.parse(targetAt) - Date.parse(observedAt)) / 3_600_000);
  return value + trend * hoursAhead + cumulativeRain * .006;
}
