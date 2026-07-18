import type { ConfigPayload, ForecastHour, StateLabel } from './types';

const DEFAULT_SEMIDIURNAL_HOURS = 12.42;

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function classifyState(score: number, thresholds: ConfigPayload['stateThresholds']): StateLabel {
  if (score < thresholds.likelyPassableMax) {
    return 'Likely Passable';
  }
  if (score < thresholds.cautionMax) {
    return 'Caution';
  }
  return 'Likely Unpassable';
}

export function normalizeToRange(value: number, min: number, max: number): number {
  if (Number.isNaN(value) || max <= min) {
    return 0.5;
  }
  return clamp((value - min) / (max - min));
}

export function linearTrendPerHour(points: Array<{ time: string; value: number }>): number {
  if (points.length < 2) {
    return 0;
  }

  const samples = points
    .map((p) => ({ t: Date.parse(p.time) / 3600000, y: p.value }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.y));

  if (samples.length < 2) {
    return 0;
  }

  const meanX = samples.reduce((sum, p) => sum + p.t, 0) / samples.length;
  const meanY = samples.reduce((sum, p) => sum + p.y, 0) / samples.length;

  let numerator = 0;
  let denominator = 0;

  for (const sample of samples) {
    numerator += (sample.t - meanX) * (sample.y - meanY);
    denominator += (sample.t - meanX) ** 2;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

export function detectExtrema(points: Array<{ time: string; value: number }>): Array<{ type: 'high' | 'low'; time: string; value: number }> {
  const extrema: Array<{ type: 'high' | 'low'; time: string; value: number }> = [];

  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1].value;
    const current = points[i].value;
    const next = points[i + 1].value;

    if (current > prev && current >= next) {
      extrema.push({ type: 'high', time: points[i].time, value: current });
    }

    if (current < prev && current <= next) {
      extrema.push({ type: 'low', time: points[i].time, value: current });
    }
  }

  return extrema;
}

export function median(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

export function semidiurnalIntervalHours(extrema: Array<{ type: 'high' | 'low'; time: string }>): number {
  const highTimes = extrema.filter((e) => e.type === 'high').map((e) => Date.parse(e.time));
  const lowTimes = extrema.filter((e) => e.type === 'low').map((e) => Date.parse(e.time));

  const intervals = [highTimes, lowTimes]
    .flatMap((series) => series.slice(1).map((time, index) => (time - series[index]) / 3600000))
    .filter((hours) => hours > 8 && hours < 16);

  return intervals.length > 0 ? median(intervals) : DEFAULT_SEMIDIURNAL_HOURS;
}

export function projectTideLevel(
  targetTimeIso: string,
  extrema: Array<{ type: 'high' | 'low'; time: string; value: number }>,
  fallbackMean: number,
  fallbackAmplitude: number,
): number {
  if (extrema.length === 0) {
    return fallbackMean;
  }

  const sortedExtrema = [...extrema].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const reference = sortedExtrema[sortedExtrema.length - 1];
  const intervalHours = semidiurnalIntervalHours(sortedExtrema);

  const mean = median(sortedExtrema.map((e) => e.value)) || fallbackMean;
  const ampFromExtrema = (Math.max(...sortedExtrema.map((e) => e.value)) - Math.min(...sortedExtrema.map((e) => e.value))) / 2;
  const amplitude = ampFromExtrema > 0 ? ampFromExtrema : fallbackAmplitude;

  const dtHours = (Date.parse(targetTimeIso) - Date.parse(reference.time)) / 3600000;
  const base = Math.cos((2 * Math.PI * dtHours) / intervalHours);
  const phase = reference.type === 'high' ? base : -base;

  return mean + amplitude * phase;
}

export function riskScore(
  components: { tide: number; river: number; rain: number },
  weights: ConfigPayload['weights'],
): number {
  return clamp(
    components.tide * weights.tide + components.river * weights.river + components.rain * weights.rain,
  );
}

export function summarizeForecast(hours: ForecastHour[]): {
  highestRiskWindow: string;
  likelyUnpassableHours: number;
  cautionHours: number;
  likelyPassableHours: number;
} {
  if (hours.length === 0) {
    return {
      highestRiskWindow: 'No forecast data',
      likelyUnpassableHours: 0,
      cautionHours: 0,
      likelyPassableHours: 0,
    };
  }

  const likelyUnpassableHours = hours.filter((h) => h.state === 'Likely Unpassable').length;
  const cautionHours = hours.filter((h) => h.state === 'Caution').length;
  const likelyPassableHours = hours.filter((h) => h.state === 'Likely Passable').length;

  const highest = [...hours].sort((a, b) => b.riskScore - a.riskScore)[0];
  const timestamp = new Date(highest.timestamp).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    highestRiskWindow: `${timestamp} (${highest.state})`,
    likelyUnpassableHours,
    cautionHours,
    likelyPassableHours,
  };
}
