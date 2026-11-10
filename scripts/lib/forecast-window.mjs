/** Keep the next 24 hours, not the provider's first 24 rows from midnight. */
export function futureRainWindow(rows, now, count = 24) {
  const start = now.getTime();
  const future = rows.map(row => ({ row, time: Date.parse(row.timestamp) }))
    .filter(point => point.time >= start).sort((a, b) => a.time - b.time)
    .slice(0, count).map(point => point.row);
  // Missing forecast hours are an error; a dry forecast is not an observation.
  if (future.length < count) throw new Error('Insufficient future rainfall hours');
  return future;
}

export function projectRiverReading(value, trend, observedAt, targetAt, cumulativeRain) {
  const hoursAhead = Math.max(0, (Date.parse(targetAt) - Date.parse(observedAt)) / 3_600_000);
  return value + trend * hoursAhead + cumulativeRain * .006;
}
