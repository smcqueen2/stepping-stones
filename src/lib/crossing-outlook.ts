import type { ConfigPayload, ForecastPayload, LivePayload, StateLabel } from './types';

export type OutlookData = { live?: LivePayload; forecast?: ForecastPayload; config?: ConfigPayload; loaded?: boolean; updateFailed?: boolean };
export type OutlookSelection = number | string;
type Outlook = {
  available: true; score: number; state: StateLabel; at: number; river: number; tide: number; ageMinutes: number;
} | { available: false; state: string; detail: string; stale: boolean };
const minute = 60_000;
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
const fullClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const stateClass: Record<StateLabel, string> = { 'Likely Passable': 'state-good', Caution: 'state-caution', 'Likely Unpassable': 'state-bad' };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Count elapsed time in an open tab, rather than trusting a frozen age flag. */
export function readingAge(live: LivePayload, now = Date.now()): number {
  const observed = Date.parse(live.freshness.oldestObservationAt ?? live.freshness.latestObservationAt);
  const generated = Date.parse(live.generatedAt);
  if (!Number.isFinite(observed) || !Number.isFinite(generated) || observed > now + 10 * minute || generated > now + 10 * minute) return Infinity;
  const stored = finite(live.freshness.ageMinutes) ? live.freshness.ageMinutes : Infinity;
  return Math.ceil(Math.max(0, (now - observed) / minute, stored + Math.max(0, (now - generated) / minute)));
}

/** A future button must select a nearby future prediction, never a past row. */
export function selectOutlook(data: OutlookData, selection: OutlookSelection = 0, now = Date.now()): Outlook {
  const live = data.live;
  const unavailable = (state: string, detail: string, stale = false): Outlook => ({ available: false, state, detail, stale });
  if (!live) return unavailable(data.loaded ? 'Data unavailable' : 'Loading conditions…', 'Fresh readings are needed to show the crossing outlook.');
  const age = readingAge(live, now);
  const staleAfter = data.config?.freshness.staleAfterMinutes ?? 120;
  if (!Number.isFinite(age)) return unavailable('Data unavailable', 'The reading timestamp could not be verified.');
  if (live.freshness.stale || age > staleAfter) return unavailable('Data out of date', `Readings are ${age} minutes old. Check conditions on site.`, true);
  let score: number, state: StateLabel, river: number, tide: number, at: number;
  if (selection === 0) {
    ({ riskScore: score, state, riverLevelM: river, tideLevelMAOD: tide } = live.current);
    at = now;
  } else {
    const forecast = data.forecast;
    const generated = Date.parse(forecast?.generatedAt ?? '');
    if (!forecast || !Number.isFinite(generated) || now - generated > staleAfter * minute || generated > now + 10 * minute) {
      return unavailable('Forecast unavailable', 'The current readings remain available under Now.');
    }
    const target = typeof selection === 'number' ? now + selection * minute : Date.parse(selection);
    if (!Number.isFinite(target) || target < now) return unavailable('Forecast time passed', 'Choose Now or another future time.');
    const hours = forecast.hours.filter(hour => Date.parse(hour.timestamp) >= now);
    const nearest = hours.reduce<(typeof hours)[number] | undefined>((best, hour) => !best
      || Math.abs(Date.parse(hour.timestamp) - target) < Math.abs(Date.parse(best.timestamp) - target) ? hour : best, undefined);
    if (!nearest || Math.abs(Date.parse(nearest.timestamp) - target) > 45 * minute) return unavailable('Forecast unavailable', 'There is no prediction close to this time.');
    ({ riskScore: score, state, projectedRiverLevelM: river, projectedTideLevelMAOD: tide } = nearest);
    at = Date.parse(nearest.timestamp);
  }
  if (!finite(score) || score < 0 || score > 1 || !Object.hasOwn(stateClass, state) || !finite(river) || !finite(tide)) {
    return unavailable('Data unavailable', 'The selected prediction could not be verified.');
  }
  return { available: true, score, state, at, river, tide, ageMinutes: age };
}

/** A bounded illustration of combined risk, not a conversion from gauge metres. */
export function waterAppearance(score?: number, state?: StateLabel) {
  if (!finite(score)) return { coverage: .5, currentSpeed: 1, title: 'A changing crossing.', description: 'The water illustration is awaiting fresh readings.' };
  const t = Math.max(0, Math.min(1, (score - .35) / .43));
  const coverage = t * t * (3 - 2 * t);
  const label = state ?? (score < .45 ? 'Likely Passable' : score < .7 ? 'Caution' : 'Likely Unpassable');
  const copy = label === 'Likely Passable'
    ? { title: 'Room above the river.', description: 'Lower predicted water around the stones.' }
    : label === 'Caution'
      ? { title: 'The water is gaining.', description: 'Some stone tops may be covered.' }
      : { title: 'A river in full flow.', description: 'Most stone tops may be submerged.' };
  return { coverage, currentSpeed: .75 + coverage * .95, ...copy };
}

let activeVisual = waterAppearance();
export function getSceneCrossingVisual() { return activeVisual; }

export function installCrossingOutlook() {
  let data: OutlookData = {};
  let selection: OutlookSelection = 0;
  let disposed = false;
  let timer: number | undefined;
  const hero = document.querySelector<HTMLElement>('.hero-art');
  const river = document.querySelector<HTMLImageElement>('#river-high');
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-outlook-minutes]'));
  const text = (id: string, value: string) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  function label(id: string, value: string, state?: StateLabel): void {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = value;
    node.classList.remove('state-good', 'state-caution', 'state-bad', 'state-pending');
    node.classList.add(state ? stateClass[state] : 'state-pending');
  }
  function render(): void {
    const now = Date.now();
    const outlook = selectOutlook(data, selection, now);
    const current = selectOutlook(data, 0, now);
    activeVisual = waterAppearance(outlook.available ? outlook.score : undefined, outlook.available ? outlook.state : undefined);
    label('outlook-state', outlook.state, outlook.available ? outlook.state : undefined);
    text('outlook-title', activeVisual.title);
    text('outlook-description', outlook.available ? activeVisual.description : outlook.detail);
    text('outlook-horizon', selection === 0 ? 'Now' : outlook.available ? clock.format(outlook.at) : typeof selection === 'number' ? `+${selection / 60} hours` : 'Selected time');
    const levels = outlook.available ? `River ${outlook.river.toFixed(2)} m · Tide ${outlook.tide.toFixed(2)} mAOD` : '';
    text('outlook-context', levels);
    const generated = Date.parse(data.live?.generatedAt ?? '');
    text('outlook-as-of', data.updateFailed ? 'Data update delayed.' : '');
    if (hero) {
      hero.dataset.conditions = outlook.available ? 'known' : !data.loaded ? 'loading' : outlook.stale ? 'stale' : 'unavailable';
      hero.dataset.riverCoverage = activeVisual.coverage.toFixed(4);
      hero.style.setProperty('--river-coverage', activeVisual.coverage.toFixed(4));
      hero.setAttribute('aria-label', `Watercolour Ogmore Castle and stepping stones. ${outlook.available ? `${outlook.state}: ${activeVisual.description}` : 'Water outlook unavailable; illustration only.'}`);
    }
    buttons.forEach(button => {
      const minutes = Number(button.dataset.outlookMinutes);
      button.setAttribute('aria-pressed', String(selection === minutes));
      button.disabled = minutes !== 0 && !selectOutlook(data, minutes, now).available;
    });
    document.querySelectorAll<HTMLButtonElement>('[data-forecast-time]').forEach(button => {
      button.disabled = !selectOutlook(data, button.dataset.forecastTime!, now).available;
      button.setAttribute('aria-pressed', String(selection === button.dataset.forecastTime));
    });
    label('live-state', current.state, current.available ? current.state : undefined);
    text('live-reason', current.available ? data.live!.current.reason : current.detail);
    text('data-freshness', current.available ? `Readings ${current.ageMinutes} minutes old. Sources: ${data.live!.sourceStations.map(station => station.stationTitle).join(', ')}.` : current.detail);
    text('outlook-freshness', current.available ? `Readings ${current.ageMinutes} min old.` : current.state);
    if (data.live) {
      const value = data.live.current;
      const trend = (n: number) => !finite(n) ? 'Unavailable' : Math.abs(n) < .005 ? 'Steady' : `${n > 0 ? 'Rising' : 'Falling'} (${n >= 0 ? '+' : ''}${n.toFixed(3)} m/h)`;
      text('river-value', finite(value.riverLevelM) ? `${value.riverLevelM.toFixed(3)} m` : '--');
      text('tide-value', finite(value.tideLevelMAOD) ? `${value.tideLevelMAOD.toFixed(3)} mAOD` : '--');
      text('river-trend', trend(value.riverTrendMPerHour));
      text('tide-trend', trend(value.tideTrendMPerHour));
      text('footer-updated', Number.isFinite(generated) ? fullClock.format(generated) : 'unavailable');
    }
    if (data.loaded && activeVisual.coverage > .01 && river?.dataset.src && !river.hasAttribute('src')) {
      river.src = river.dataset.src;
      void river.decode().then(() => {
        if (disposed) return;
        river.classList.add('is-ready');
        text('outlook-art-status', '');
      }).catch(() => {
        if (disposed) return;
        river.removeAttribute('src');
        text('outlook-art-status', 'Water illustration unavailable. Refer to the outlook above.');
      });
    }
  }
  function sync(): void {
    window.clearTimeout(timer);
    if (disposed || document.hidden) return;
    render();
    timer = window.setTimeout(sync, minute - Date.now() % minute);
  }
  function click(event: Event): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-outlook-minutes], [data-forecast-time]');
    if (!button || button.disabled) return;
    selection = button.dataset.forecastTime ?? Number(button.dataset.outlookMinutes);
    render();
    button.closest<HTMLDialogElement>('dialog')?.close();
  }
  document.addEventListener('click', click);
  document.addEventListener('visibilitychange', sync);
  render();
  sync();
  return {
    setData(next: OutlookData) { data = { ...next, loaded: true }; render(); },
    dispose() {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener('click', click);
      document.removeEventListener('visibilitychange', sync);
      activeVisual = waterAppearance();
    },
  };
}
