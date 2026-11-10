export function gaugeSeries(response) {
  const points = [];
  for (const point of Array.isArray(response?.data) ? response.data : []) {
    if (!(typeof point?.y === 'number' || typeof point?.y === 'string' && point.y.trim() !== '')) continue;
    const value = Number(point.y);
    if (!Number.isFinite(value)) continue;
    const epoch = Date.parse(point.x);
    if (Number.isFinite(epoch)) points.push({ time: point.x, value, epoch });
  }
  // Parse each provider timestamp once, rather than twice per sort comparison.
  return points.sort((a, b) => a.epoch - b.epoch).map(({ time, value }) => ({ time, value }));
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
        buckets.set(Math.floor(time / 600000), { time: point.time, value: point.value, epoch: time });
      }
    }
    return [...buckets.values()].sort((a, b) => a.epoch - b.epoch).map(({ time, value }) => ({ time, value }));
  };
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString(), river: sample(river), tide: sample(tide) };
}
