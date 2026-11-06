/** Keep the next 24 hours, not the provider's first 24 rows from midnight. */
export function futureRainWindow(rows, now, count = 24) {
  const future = rows.filter(row => Date.parse(row.timestamp) >= now.getTime())
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).slice(0, count);
  // Missing forecast hours are an error; a dry forecast is not an observation.
  if (future.length < count) throw new Error('Insufficient future rainfall hours');
  return future;
}

export function projectRiverReading(value, trend, observedAt, targetAt, cumulativeRain) {
  const hoursAhead = Math.max(0, (Date.parse(targetAt) - Date.parse(observedAt)) / 3_600_000);
  return value + trend * hoursAhead + cumulativeRain * .006;
}
