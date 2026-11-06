import './style.css';
import { installSceneLighting } from './lib/scene-lighting';
import { installSceneWeather } from './lib/scene-weather';
import { installCrossingOutlook, type OutlookData } from './lib/crossing-outlook';
import { installDialogs } from './lib/dialogs';
import { installHistoryLoader } from './lib/history-loader';
import type { ConfigPayload, ForecastPayload, LivePayload } from './lib/types';

const forecastClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Data request failed: ' + response.status);
  return await response.json() as T;
}

function renderForecast(payload?: ForecastPayload): void {
  const timeline = document.getElementById('forecast-timeline');
  const summary = document.getElementById('forecast-summary');
  if (!timeline || !summary) return;
  const hours = (payload?.hours ?? []).filter(hour => Date.parse(hour.timestamp) >= Date.now());
  timeline.replaceChildren(...hours.map(hour => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'timeline-item';
    button.dataset.forecastTime = hour.timestamp;
    button.setAttribute('aria-pressed', 'false');
    const time = document.createElement('span');
    time.className = 'forecast-time';
    time.textContent = forecastClock.format(new Date(hour.timestamp));
    const state = document.createElement('p');
    state.textContent = hour.state;
    const values = document.createElement('p');
    values.className = 'muted';
    values.textContent = 'River ' + hour.projectedRiverLevelM.toFixed(2) + ' m · Tide ' + hour.projectedTideLevelMAOD.toFixed(2) + ' mAOD';
    const rain = document.createElement('p');
    rain.className = 'muted';
    rain.textContent = 'Rain ' + hour.rainfallMm.toFixed(1) + ' mm (' + hour.precipitationProbabilityPct + '%)';
    button.append(time, state, values, rain);
    return button;
  }));
  const highest = hours.reduce<(typeof hours)[number] | undefined>((best, hour) => !best || hour.riskScore > best.riskScore ? hour : best, undefined);
  const cards = [
    ['Highest predicted risk', highest ? forecastClock.format(new Date(highest.timestamp)) + ' · ' + highest.state : 'Unavailable'],
    ['Likely Unpassable hours', String(hours.filter(hour => hour.state === 'Likely Unpassable').length)],
    ['Caution hours', String(hours.filter(hour => hour.state === 'Caution').length)],
    ['Likely Passable hours', String(hours.filter(hour => hour.state === 'Likely Passable').length)],
  ];
  summary.replaceChildren(...cards.map(([name, value]) => {
    const card = document.createElement('article');
    card.className = 'card';
    const title = document.createElement('h3');
    title.textContent = name;
    const content = document.createElement('p');
    content.textContent = value;
    card.append(title, content);
    return card;
  }));
}

function normalizeEndpoint(raw: string | undefined): string {
  if (!raw) {
    return '';
  }

  const endpoint = raw.trim();
  if (!endpoint || endpoint.includes('REPLACE_WITH_EMAIL')) {
    return '';
  }

  return endpoint;
}

function configureObservationForm(config: ConfigPayload, live: LivePayload): void {
  const form = document.getElementById('observation-form') as HTMLFormElement | null;
  const submitButton = document.getElementById('observation-submit') as HTMLButtonElement | null;
  const status = document.getElementById('observation-status');
  const nextInput = document.getElementById('observation-next') as HTMLInputElement | null;
  const modelState = document.getElementById('model-live-state') as HTMLInputElement | null;
  const modelRisk = document.getElementById('model-live-risk') as HTMLInputElement | null;
  const modelGenerated = document.getElementById('model-generated-at') as HTMLInputElement | null;

  if (!form || !submitButton || !status || !nextInput || !modelState || !modelRisk || !modelGenerated) {
    return;
  }

  modelState.value = live.current.state;
  modelRisk.value = String(live.current.riskScore);
  modelGenerated.value = live.generatedAt;
  nextInput.value = `${window.location.origin}${window.location.pathname}?observation=thanks#report`;

  const queryState = new URLSearchParams(window.location.search).get('observation');
  if (queryState === 'thanks') {
    status.textContent =
      config.observationSubmission?.successMessage ??
      'Thanks. Your observation has been submitted and will help improve the model.';
  }

  const endpoint = normalizeEndpoint(config.observationSubmission?.endpoint);
  const enabled = Boolean(config.observationSubmission?.enabled && endpoint);

  if (!enabled) {
    form.removeAttribute('action');
    submitButton.disabled = true;
    status.textContent =
      config.observationSubmission?.disabledMessage ??
      'Observation form is temporarily unavailable while the submit endpoint is being configured.';
    return;
  }

  form.action = endpoint;
}


const disposeDialogs = installDialogs();
const disposeHistory = installHistoryLoader();
const disposeLighting = installSceneLighting();
const disposeWeather = installSceneWeather();
const outlook = installCrossingOutlook();
const refreshInterval = 15 * 60_000;
let data: OutlookData = {};
let lastAttempt = 0;
let dataTimer: number | undefined;
let requestTimeout: number | undefined;
let dataRequest: AbortController | undefined;
let disposed = false;

function scheduleData(): void {
  window.clearTimeout(dataTimer);
  if (!disposed && !document.hidden) dataTimer = window.setTimeout(syncData, Math.max(1000, lastAttempt + refreshInterval - Date.now()));
}

async function refreshData(): Promise<void> {
  lastAttempt = Date.now();
  dataRequest = new AbortController();
  requestTimeout = window.setTimeout(() => dataRequest?.abort(), 10_000);
  const base = import.meta.env.BASE_URL + 'data/';
  try {
    const results = await Promise.allSettled([
      fetchJson<LivePayload>(base + 'live.json', dataRequest.signal),
      fetchJson<ForecastPayload>(base + 'forecast.json', dataRequest.signal),
      fetchJson<ConfigPayload>(base + 'config.json', dataRequest.signal),
    ] as const);
    if (disposed) return;
    const [live, forecast, config] = results;
    if (live.status === 'fulfilled' && live.value?.freshness && live.value?.current && Array.isArray(live.value?.sourceStations)) data.live = live.value;
    if (forecast.status === 'fulfilled' && Array.isArray(forecast.value?.hours)) data.forecast = forecast.value;
    if (config.status === 'fulfilled' && typeof config.value?.freshness?.staleAfterMinutes === 'number') data.config = config.value;
    data.updateFailed = results.some(result => result.status === 'rejected');
    renderForecast(data.forecast);
    outlook.setData(data);
    if (data.config && data.live) configureObservationForm(data.config, data.live);
  } catch {
    if (!disposed) outlook.setData({ ...data, updateFailed: true });
  } finally {
    window.clearTimeout(requestTimeout);
    dataRequest = undefined;
    if (!disposed) scheduleData();
  }
}

function syncData(): void {
  window.clearTimeout(dataTimer);
  if (disposed || document.hidden) return;
  if (!dataRequest && Date.now() - lastAttempt >= refreshInterval) void refreshData();
  else if (!dataRequest) scheduleData();
}
document.addEventListener('visibilitychange', syncData);
syncData();

// Keep WebGL out of the initial bundle and skip it entirely for reduced motion.
const riverCanvas = document.querySelector<HTMLCanvasElement>('#river-flow');
const riverMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let disposeRiver: (() => void) | undefined;
let riverLoading = false;
let riverDisposed = false;

async function startRiver(): Promise<void> {
  if (!riverCanvas || riverMotion.matches || riverLoading || disposeRiver || riverDisposed) return;
  riverLoading = true;
  try {
    const { mountRiverFlow } = await import('./lib/river-flow');
    if (riverDisposed || riverMotion.matches) return;
    const dispose = await mountRiverFlow(riverCanvas);
    if (riverDisposed) dispose();
    else disposeRiver = dispose;
  } catch (error) {
    riverCanvas.style.visibility = 'hidden';
    riverCanvas.dataset.waterState = 'unavailable';
    console.warn('Using the static hero illustration.', error);
  } finally {
    riverLoading = false;
  }
}

riverMotion.addEventListener('change', startRiver);
void startRiver();

import.meta.hot?.dispose(() => {
  disposed = true;
  dataRequest?.abort();
  window.clearTimeout(dataTimer);
  window.clearTimeout(requestTimeout);
  document.removeEventListener('visibilitychange', syncData);
  disposeDialogs();
  disposeHistory();
  outlook.dispose();
  disposeLighting();
  disposeWeather();
  riverDisposed = true;
  riverMotion.removeEventListener('change', startRiver);
  disposeRiver?.();
});
