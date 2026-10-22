import './style.css';
import type { ConfigPayload, ForecastPayload, LivePayload, StateLabel } from './lib/types';

const stateClass: Record<StateLabel, string> = {
  'Likely Passable': 'state-good',
  Caution: 'state-caution',
  'Likely Unpassable': 'state-bad',
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function asTrend(value: number): string {
  if (Math.abs(value) < 0.005) {
    return 'Steady';
  }
  return value > 0 ? 'Rising' : 'Falling';
}

function asTrendDelta(value: number, unit: string): string {
  return `${asTrend(value)} (${value >= 0 ? '+' : ''}${value.toFixed(3)} ${unit}/h)`;
}

function setStateLabel(el: HTMLElement, state: StateLabel): void {
  el.textContent = state;
  el.classList.remove('state-pending', 'state-good', 'state-caution', 'state-bad');
  el.classList.add(stateClass[state]);
}

function waterScale(score: number): number {
  return 0.28 + score * 0.7;
}

function setRiverVisual(currentScore: number, predictedScore: number): void {
  const root = document.documentElement;
  root.style.setProperty('--river-current-level', waterScale(currentScore).toFixed(3));
  root.style.setProperty('--river-predicted-level', waterScale(predictedScore).toFixed(3));
}

function renderForecastTimeline(payload: ForecastPayload): void {
  const container = document.getElementById('forecast-timeline');
  if (!container) return;

  const rows = payload.hours.map((hour) => {
    const time = new Date(hour.timestamp).toLocaleString('en-GB', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return `
      <article class="timeline-item">
        <h4>${time}</h4>
        <p class="small"><strong>${hour.state}</strong></p>
        <p class="small">Risk: ${(hour.riskScore * 100).toFixed(0)}%</p>
        <p class="small">Rain: ${hour.rainfallMm.toFixed(1)}mm (${hour.precipitationProbabilityPct}%)</p>
      </article>
    `;
  });

  container.innerHTML = rows.join('');
}

function renderForecastSummary(payload: ForecastPayload): void {
  const el = document.getElementById('forecast-summary');
  if (!el) return;

  el.innerHTML = `
    <article class="card"><h3>Highest risk window</h3><p>${payload.summary.highestRiskWindow}</p></article>
    <article class="card"><h3>Likely Unpassable hours</h3><p class="metric">${payload.summary.likelyUnpassableHours}</p></article>
    <article class="card"><h3>Caution hours</h3><p class="metric">${payload.summary.cautionHours}</p></article>
    <article class="card"><h3>Likely Passable hours</h3><p class="metric">${payload.summary.likelyPassableHours}</p></article>
  `;
}

function installScrollAnimations(): void {
  const sections = document.querySelectorAll<HTMLElement>('.animate-on-scroll');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion || !('IntersectionObserver' in window)) {
    sections.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    },
    { threshold: 0.2 },
  );

  sections.forEach((el) => observer.observe(el));
}

function installHeroLayerReveal(): void {
  const layers = Array.from(document.querySelectorAll<HTMLElement>('.hero-layer'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    layers.forEach((layer) => layer.classList.add('is-visible'));
    return;
  }

  layers.forEach((layer, index) => {
    window.setTimeout(() => layer.classList.add('is-visible'), 200 + index * 220);
  });
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

async function loadAndRender(): Promise<void> {
  const dataBase = `${import.meta.env.BASE_URL}data`;

  const [live, forecast, config] = await Promise.all([
    fetchJson<LivePayload>(`${dataBase}/live.json`),
    fetchJson<ForecastPayload>(`${dataBase}/forecast.json`),
    fetchJson<ConfigPayload>(`${dataBase}/config.json`),
  ]);

  const liveState = document.getElementById('live-state');
  const statusPill = document.getElementById('status-pill');
  const liveReason = document.getElementById('live-reason');
  const riverValue = document.getElementById('river-value');
  const riverTrend = document.getElementById('river-trend');
  const tideValue = document.getElementById('tide-value');
  const tideTrend = document.getElementById('tide-trend');
  const freshness = document.getElementById('data-freshness');
  const footerUpdated = document.getElementById('footer-updated');

  if (!liveState || !statusPill || !liveReason || !riverValue || !riverTrend || !tideValue || !tideTrend || !freshness || !footerUpdated) {
    return;
  }

  setStateLabel(liveState, live.current.state);
  statusPill.textContent = live.current.state;
  statusPill.classList.add(stateClass[live.current.state]);

  liveReason.textContent = live.current.reason;
  riverValue.textContent = `${live.current.riverLevelM.toFixed(3)} m`;
  riverTrend.textContent = `Trend: ${asTrendDelta(live.current.riverTrendMPerHour, 'm')}`;

  tideValue.textContent = `${live.current.tideLevelMAOD.toFixed(3)} mAOD`;
  tideTrend.textContent = `Trend: ${asTrendDelta(live.current.tideTrendMPerHour, 'm')}`;

  if (live.freshness.stale) {
    freshness.textContent = `${config.messaging.staleWarning} Last observation ${live.freshness.ageMinutes} mins ago.`;
  } else {
    freshness.textContent = `Data age: ${live.freshness.ageMinutes} mins. Sources: ${live.sourceStations.map((s) => s.stationTitle).join(', ')}.`;
  }

  const generatedAt = new Date(live.generatedAt).toLocaleString('en-GB');
  footerUpdated.textContent = generatedAt;

  renderForecastSummary(forecast);
  renderForecastTimeline(forecast);

  setRiverVisual(live.current.riskScore, live.shortHorizonPrediction.riskScore);
  configureObservationForm(config, live);
}

installScrollAnimations();
installHeroLayerReveal();

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
  riverDisposed = true;
  riverMotion.removeEventListener('change', startRiver);
  disposeRiver?.();
});

loadAndRender().catch((error) => {
  const liveState = document.getElementById('live-state');
  if (liveState) {
    liveState.textContent = 'Data unavailable';
    liveState.classList.add('state-caution');
  }
  const reason = document.getElementById('live-reason');
  if (reason) {
    reason.textContent = `Unable to load current data. ${String(error)}`;
  }
});
