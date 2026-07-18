import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyState,
  clamp,
  detectExtrema,
  linearTrendPerHour,
  normalizeToRange,
  projectTideLevel,
  riskScore,
  summarizeForecast,
} from './lib/forecast-model.mjs';
import { pickPreferredTideStation } from './lib/station-selection.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataOutDir = process.env.DATA_OUT_DIR
  ? path.resolve(rootDir, process.env.DATA_OUT_DIR)
  : path.resolve(rootDir, 'public/data');

const NRW_BASE = 'https://rivers-and-seas.naturalresources.wales';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

const STATIONS = {
  river: {
    id: 4083,
    expectedParameter: 110,
    expectedType: 'River Level',
  },
  tideCandidates: [
    { id: 72839, expectedParameter: 10254, expectedType: 'Tide Level', priority: 0 },
    { id: 72639, expectedType: 'Tide Level', priority: 1 },
    { id: 72439, expectedType: 'Tide Level', priority: 2 },
  ],
};

const RAIN_LOCATION = {
  latitude: 51.4759,
  longitude: -3.6206,
};

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'stepping-stones-data-generator/1.1',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

async function readConfig() {
  const configPath = path.join(rootDir, 'public/data/config.json');
  const content = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(content);
}

function toSeries(apiResponse) {
  return (apiResponse?.data ?? [])
    .map((point) => ({ time: point.x, value: Number(point.y) }))
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(Date.parse(point.time)))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
}

function latestParameter(station, expectedType) {
  const typed = (station.parameters ?? []).find((parameter) => parameter.typeText?.english === expectedType);
  if (typed) {
    return typed;
  }
  return (station.parameters ?? [])[0];
}

function nowUtc() {
  return new Date();
}

function iso(date) {
  return date.toISOString();
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function formatReason(state, freshness) {
  if (freshness.stale) {
    return 'Data feed appears stale; use extra caution and assess conditions in person.';
  }

  if (state === 'Likely Passable') {
    return 'Model currently indicates lower risk, but crossing can still change quickly.';
  }

  if (state === 'Caution') {
    return 'Mixed conditions suggest greater care is needed before attempting to cross.';
  }

  return 'Model indicates higher likelihood that stones may be submerged or difficult to cross.';
}

function interpolateRain(hourly, fallbackHours = 24) {
  const result = [];
  for (let i = 0; i < fallbackHours; i += 1) {
    const item = hourly[i];
    if (!item) {
      break;
    }
    result.push(item);
  }
  return result;
}

function buildFallbackRainForecast(startDate) {
  return Array.from({ length: 24 }, (_, hour) => ({
    timestamp: iso(addHours(startDate, hour)),
    rainfallMm: 0,
    precipitationProbabilityPct: 0,
  }));
}

function rainInfluence(rainfallMm, probabilityPct, mmForHighRisk) {
  return clamp((rainfallMm / mmForHighRisk) * 0.7 + (probabilityPct / 100) * 0.3);
}

async function main() {
  const config = await readConfig();

  const now = nowUtc();
  const from48h = addHours(now, -48);

  const riverStation = await fetchJson(
    `${NRW_BASE}/Station/GetData/${STATIONS.river.id}?includeStationParameters=true`,
  );
  const riverParameter = latestParameter(riverStation, STATIONS.river.expectedType);

  const tideCandidates = [];
  for (const candidate of STATIONS.tideCandidates) {
    try {
      const station = await fetchJson(
        `${NRW_BASE}/Station/GetData/${candidate.id}?includeStationParameters=true`,
      );
      const parameter = latestParameter(station, candidate.expectedType);

      if (!parameter) continue;

      tideCandidates.push({
        priority: candidate.priority,
        stationId: station.id,
        stationTitle: station.title?.english ?? `Station ${station.id}`,
        parameterId: parameter.id,
        latestTime: parameter.latestTime,
        latestValue: Number(parameter.latestValue),
        unit: parameter.unit,
      });
    } catch (error) {
      console.warn(`Unable to load tide candidate ${candidate.id}, skipping.`, error);
    }
  }

  const selectedTide = pickPreferredTideStation(
    tideCandidates,
    config.freshness.staleAfterMinutes,
    iso(now),
  );

  const tideStationMeta = selectedTide.station;

  const [riverSeriesResponse, tideSeriesResponse] = await Promise.all([
    fetchJson(
      `${NRW_BASE}/graph/getdata?parameterId=${riverParameter.id}&from=${encodeURIComponent(
        iso(from48h),
      )}&to=${encodeURIComponent(iso(now))}`,
    ),
    fetchJson(
      `${NRW_BASE}/graph/getdata?parameterId=${tideStationMeta.parameterId}&from=${encodeURIComponent(
        iso(from48h),
      )}&to=${encodeURIComponent(iso(now))}`,
    ),
  ]);

  const riverSeries = toSeries(riverSeriesResponse);
  const tideSeries = toSeries(tideSeriesResponse);

  if (riverSeries.length < 8 || tideSeries.length < 8) {
    throw new Error('Insufficient river/tide data to generate forecast');
  }

  const riverLatest = riverSeries[riverSeries.length - 1];
  const tideLatest = tideSeries[tideSeries.length - 1];

  const riverTrend = linearTrendPerHour(riverSeries.slice(-32));
  const tideTrend = linearTrendPerHour(tideSeries.slice(-32));

  const tideExtrema = detectExtrema(tideSeries);

  const tideValues = tideSeries.map((p) => p.value);
  const riverValues = riverSeries.map((p) => p.value);
  const tideMin = Math.min(...tideValues);
  const tideMax = Math.max(...tideValues);
  const riverMin = Math.min(...riverValues);
  const riverMax = Math.max(...riverValues);

  let rainForecast;

  try {
    const rainResponse = await fetchJson(
      `${OPEN_METEO_BASE}?latitude=${RAIN_LOCATION.latitude}&longitude=${RAIN_LOCATION.longitude}&hourly=precipitation_probability,precipitation,rain&forecast_days=2&timezone=UTC`,
    );

    const hourly = rainResponse.hourly;

    rainForecast = interpolateRain(
      hourly.time.map((time, index) => ({
        timestamp: new Date(`${time}:00Z`).toISOString(),
        rainfallMm: Number.isFinite(hourly.rain?.[index])
          ? Number(hourly.rain[index])
          : Number(hourly.precipitation?.[index] ?? 0),
        precipitationProbabilityPct: Number(hourly.precipitation_probability?.[index] ?? 0),
      })),
    );
  } catch (error) {
    console.warn('Open-Meteo fetch failed, using dry fallback forecast.', error);
    rainForecast = buildFallbackRainForecast(now);
  }

  const hourlyWindow = rainForecast.slice(0, 24);

  if (hourlyWindow.length < 24) {
    const lastTime = hourlyWindow.length
      ? new Date(hourlyWindow[hourlyWindow.length - 1].timestamp)
      : now;

    for (let i = hourlyWindow.length; i < 24; i += 1) {
      hourlyWindow.push({
        timestamp: iso(addHours(lastTime, i - hourlyWindow.length + 1)),
        rainfallMm: 0,
        precipitationProbabilityPct: 0,
      });
    }
  }

  const forecastHours = hourlyWindow.map((hour, index, all) => {
    const target = hour.timestamp;

    const projectedTide = projectTideLevel(
      target,
      tideExtrema,
      tideLatest.value,
      (tideMax - tideMin) / 2 || 0.5,
    );

    const cumulativeRain = all
      .slice(Math.max(0, index - 5), index + 1)
      .reduce((sum, h) => sum + Number(h.rainfallMm || 0), 0);

    const projectedRiver = riverLatest.value + riverTrend * index + cumulativeRain * 0.006;

    const components = {
      tide: normalizeToRange(projectedTide, tideMin, tideMax),
      river: normalizeToRange(projectedRiver, riverMin, riverMax),
      rain: rainInfluence(
        Number(hour.rainfallMm ?? 0),
        Number(hour.precipitationProbabilityPct ?? 0),
        config.rainScaling.millimetresForHighRisk,
      ),
    };

    const score = riskScore(components, config.weights);

    return {
      timestamp: target,
      projectedTideLevelMAOD: Number(projectedTide.toFixed(3)),
      projectedRiverLevelM: Number(projectedRiver.toFixed(3)),
      rainfallMm: Number(Number(hour.rainfallMm ?? 0).toFixed(2)),
      precipitationProbabilityPct: Number(hour.precipitationProbabilityPct ?? 0),
      riskComponents: {
        tide: Number(components.tide.toFixed(3)),
        river: Number(components.river.toFixed(3)),
        rain: Number(components.rain.toFixed(3)),
      },
      riskScore: Number(score.toFixed(3)),
      state: classifyState(score, config.stateThresholds),
    };
  });

  const currentRain = forecastHours[0] ?? { rainfallMm: 0, precipitationProbabilityPct: 0 };
  const currentComponents = {
    tide: normalizeToRange(tideLatest.value, tideMin, tideMax),
    river: normalizeToRange(riverLatest.value, riverMin, riverMax),
    rain: rainInfluence(
      Number(currentRain.rainfallMm),
      Number(currentRain.precipitationProbabilityPct),
      config.rainScaling.millimetresForHighRisk,
    ),
  };

  const currentScore = riskScore(currentComponents, config.weights);
  const currentState = classifyState(currentScore, config.stateThresholds);

  const shortTarget = iso(addMinutes(now, 90));
  const shortPrediction = forecastHours.reduce((closest, point) => {
    if (!closest) return point;
    const distance = Math.abs(Date.parse(point.timestamp) - Date.parse(shortTarget));
    const closestDistance = Math.abs(Date.parse(closest.timestamp) - Date.parse(shortTarget));
    return distance < closestDistance ? point : closest;
  }, null);

  const latestObservationAt =
    Date.parse(riverLatest.time) > Date.parse(tideLatest.time) ? riverLatest.time : tideLatest.time;

  const ageMinutes = Math.max(0, Math.round((Date.now() - Date.parse(latestObservationAt)) / 60000));

  const freshness = {
    generatedAt: iso(now),
    latestObservationAt,
    ageMinutes,
    stale: ageMinutes > config.freshness.staleAfterMinutes,
    staleReason: selectedTide.reason,
  };

  const live = {
    generatedAt: iso(now),
    sourceStations: [
      {
        role: 'river',
        stationId: riverStation.id,
        stationTitle: riverStation.title?.english ?? `Station ${riverStation.id}`,
        parameterId: riverParameter.id,
        source: 'NRW',
      },
      {
        role: 'tide',
        stationId: tideStationMeta.stationId,
        stationTitle: tideStationMeta.stationTitle,
        parameterId: tideStationMeta.parameterId,
        source: 'NRW',
      },
    ],
    freshness,
    current: {
      riverLevelM: Number(riverLatest.value.toFixed(3)),
      riverTrendMPerHour: Number(riverTrend.toFixed(4)),
      tideLevelMAOD: Number(tideLatest.value.toFixed(3)),
      tideTrendMPerHour: Number(tideTrend.toFixed(4)),
      riskScore: Number(currentScore.toFixed(3)),
      state: currentState,
      reason: formatReason(currentState, freshness),
    },
    shortHorizonPrediction: {
      horizonMinutes: 90,
      predictedRiverLevelM: Number((shortPrediction?.projectedRiverLevelM ?? riverLatest.value).toFixed(3)),
      projectedTideLevelMAOD: Number((shortPrediction?.projectedTideLevelMAOD ?? tideLatest.value).toFixed(3)),
      riskScore: Number((shortPrediction?.riskScore ?? currentScore).toFixed(3)),
      state: shortPrediction?.state ?? currentState,
    },
  };

  const forecast = {
    generatedAt: iso(now),
    horizonHours: 24,
    summary: summarizeForecast(forecastHours),
    hours: forecastHours,
  };

  await fs.mkdir(dataOutDir, { recursive: true });
  await fs.writeFile(path.join(dataOutDir, 'live.json'), `${JSON.stringify(live, null, 2)}\n`);
  await fs.writeFile(path.join(dataOutDir, 'forecast.json'), `${JSON.stringify(forecast, null, 2)}\n`);

  console.log(`Generated live + forecast data in ${dataOutDir}`);
}

main().catch((error) => {
  console.error('Data generation failed:', error);
  process.exitCode = 1;
});
