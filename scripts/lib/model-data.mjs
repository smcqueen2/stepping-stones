import {
  classifyState,
  clamp,
  detectExtrema,
  linearTrendPerHour,
  normalizeToRange,
  createTideProjector,
  riskScore,
  summarizeForecast,
} from './forecast-model.mjs';
import { pickPreferredTideStation } from './station-selection.mjs';
import { futureRainWindow, projectRiverReading } from './forecast-window.mjs';
import { coastalTideTiming } from './tide-timing.mjs';
import { gaugeSeries, recentLevels } from './recent-levels.mjs';

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

async function requestJson(url, fetcher) {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(15000),
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

function latestParameter(station, expectedType) {
  const typed = (station.parameters ?? []).find((parameter) => parameter.typeText?.english === expectedType);
  if (typed) {
    return typed;
  }
  return (station.parameters ?? [])[0];
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

export async function buildModelData({ config, now = new Date(), fetcher = fetch }) {
  const fetchJson = url => requestJson(url, fetcher);
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

  const riverSeries = gaugeSeries(riverSeriesResponse);
  const tideSeries = gaugeSeries(tideSeriesResponse);

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

    rainForecast = hourly.time.map((time, index) => ({
        timestamp: new Date(`${time}:00Z`).toISOString(),
        rainfallMm: Number.isFinite(hourly.rain?.[index])
          ? Number(hourly.rain[index])
          : Number(hourly.precipitation?.[index] ?? 0),
        precipitationProbabilityPct: Number(hourly.precipitation_probability?.[index] ?? 0),
      }));
  } catch (error) {
    console.warn('Open-Meteo fetch failed, using dry fallback forecast.', error);
    rainForecast = buildFallbackRainForecast(now);
  }

  const hourlyWindow = futureRainWindow(rainForecast, now);

  let tideTiming;
  try {
    // Offshore Ogmore grid cell, not the inland stones. Separate from the regional NRW risk model.
    const marine = await fetchJson('https://marine-api.open-meteo.com/v1/marine?latitude=51.461&longitude=-3.631&hourly=sea_level_height_msl&past_days=1&forecast_days=3&timezone=GMT&timeformat=unixtime&cell_selection=sea');
    tideTiming = coastalTideTiming(marine, iso(now));
    if (!tideTiming) console.warn('Coastal tide timings unavailable: incomplete marine forecast.');
  } catch (error) {
    console.warn('Coastal tide timings unavailable; retaining river/gauge forecast.', error);
  }

  const projectTide = createTideProjector(tideExtrema, tideLatest.value, (tideMax - tideMin) / 2 || 0.5);
  const forecastHours = hourlyWindow.map((hour, index, all) => {
    const target = hour.timestamp;

    const projectedTide = projectTide(target);

    const cumulativeRain = all
      .slice(Math.max(0, index - 5), index + 1)
      .reduce((sum, h) => sum + Number(h.rainfallMm || 0), 0);

    const projectedRiver = projectRiverReading(riverLatest.value, riverTrend, riverLatest.time, target, cumulativeRain);

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
  const oldestObservationAt =
    Date.parse(riverLatest.time) < Date.parse(tideLatest.time) ? riverLatest.time : tideLatest.time;

  const ageMinutes = Math.max(0, Math.round((Date.now() - Date.parse(oldestObservationAt)) / 60000));

  const freshness = {
    generatedAt: iso(now),
    latestObservationAt,
    oldestObservationAt,
    ageMinutes,
    stale: ageMinutes > config.freshness.staleAfterMinutes,
    staleReason: selectedTide.reason,
  };

  const live = {
    generatedAt: iso(now),
    tideTiming,
    recentLevels: recentLevels(riverSeries, tideSeries, iso(now)),
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
      riskComponents: {
        tide: Number(currentComponents.tide.toFixed(3)),
        river: Number(currentComponents.river.toFixed(3)),
        rain: Number(currentComponents.rain.toFixed(3)),
      },
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

  return { live, forecast };
}
