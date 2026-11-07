export function gaugeSeries(response) {
  return (Array.isArray(response?.data) ? response.data : [])
    .filter(point => (typeof point?.y === 'number' || typeof point?.y === 'string' && point.y.trim() !== '')
      && Number.isFinite(Number(point.y)) && Number.isFinite(Date.parse(point.x)))
    .map(point => ({ time: point.x, value: Number(point.y) }))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

export function recentLevels(river, tide, generatedAt) {
  const to = Date.parse(generatedAt);
  const from = to - 12 * 3600000;
  const sample = points => {
    // Retain an actual reading from each ten-minute bucket; never manufacture readings.
    const buckets = new Map();
    for (const point of points) {
      const time = Date.parse(point.time);
      if (Number.isFinite(time) && Number.isFinite(point.value) && time >= from && time <= to) {
        buckets.set(Math.floor(time / 600000), { time: point.time, value: point.value });
      }
    }
    return [...buckets.values()].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  };
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString(), river: sample(river), tide: sample(tide) };
}
