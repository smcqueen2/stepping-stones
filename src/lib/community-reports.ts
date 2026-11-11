import { observationConditions as conditions, newReportId, parseReportSummary, reportsEndpoint } from './report-contract';
import type { ReportSummary } from './report-contract';

interface Turnstile {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global { interface Window { turnstile?: Turnstile } }

let widgetScript: Promise<Turnstile> | undefined;
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (widgetScript) return widgetScript;
  widgetScript = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timeout = window.setTimeout(fail, 15_000);
    function fail(): void {
      window.clearTimeout(timeout); script.remove(); widgetScript = undefined;
      reject(new Error('Verification could not load.'));
    }
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.turnstile) resolve(window.turnstile); else fail();
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return widgetScript;
}

const deviceStorageKey = 'ogmore-observation-device-v1';
const pendingStorageKey = 'ogmore-observation-pending-v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const refreshMs = 60_000;

export function installCommunityReports({ endpoint: configuredEndpoint = import.meta.env.VITE_REPORTS_ENDPOINT,
  fetcher = fetch }: { endpoint?: string; fetcher?: typeof fetch } = {}): () => void {
  const form = document.querySelector<HTMLFormElement>('#observation-form');
  const slider = document.querySelector<HTMLInputElement>('#report-condition');
  const submit = document.querySelector<HTMLButtonElement>('#observation-submit');
  const status = document.getElementById('observation-status');
  const count = document.getElementById('community-count');
  const detail = document.getElementById('community-detail');
  const widget = document.getElementById('observation-verification');
  const retry = document.querySelector<HTMLButtonElement>('#observation-verify-retry');
  const dialog = document.querySelector<HTMLDialogElement>('#report');
  if (!form || !slider || !submit || !status || !count || !detail || !widget || !retry || !dialog) return () => {};
  let endpoint: string | undefined;
  try { endpoint = reportsEndpoint(configuredEndpoint); } catch { /* Invalid settings cannot receive submissions. */ }
  let disposed = false;
  let chosen = false;
  let sending = false;
  let verifying = false;
  let token = '';
  let summary: ReportSummary | undefined;
  let lastAttempt = 0;
  let widgetId: string | undefined;
  let widgetKey: string | undefined;
  let requestId: string | undefined;
  let deviceId: string | undefined;
  let requestCondition: number | undefined;
  let nextAllowed = 0;
  let timer: number | undefined;
  let summaryRequest: AbortController | undefined;
  let submitRequest: AbortController | undefined;

  try {
    const saved = localStorage.getItem(deviceStorageKey);
    if (saved && uuid.test(saved)) deviceId = saved;
    const pending = JSON.parse(localStorage.getItem(pendingStorageKey) || 'null');
    if (pending && uuid.test(pending.id) && Number.isInteger(pending.condition) && pending.condition >= 0 && pending.condition <= 4) {
      requestId = pending.id; requestCondition = pending.condition;
    }
  } catch { /* Storage is optional; session-only reporting still works. */ }
  deviceId ??= newReportId();

  function updateButton(): void {
    submit!.disabled = !endpoint || !summary || !chosen || !token || sending || nextAllowed > Date.now();
    slider!.disabled = !endpoint || !summary || sending;
    submit!.textContent = sending ? 'Sending…' : 'Submit observation';
  }

  function unavailable(): void {
    summary = undefined;
    count!.textContent = 'Community reports unavailable';
    detail!.textContent = 'Recent observations could not be checked.';
    document.getElementById('community-summary')!.hidden = true;
    if (!sending) status!.textContent = endpoint ? 'Reporting is temporarily unavailable. Please try again shortly.' : 'Shared reporting is not connected yet.';
    updateButton();
  }

  function renderSummary(): void {
    if (!summary) return;
    count!.textContent = `${summary.total} ${summary.total === 1 ? 'report' : 'reports'} in the past hour`;
    if (!summary.total) detail!.textContent = 'No recent observations. Always assess conditions from the bank.';
    else {
      const largest = Math.max(...summary.counts);
      const winners = summary.counts.flatMap((value, index) => value === largest ? [index] : []);
      const latest = Math.max(0, Math.floor((Date.now() - Date.parse(summary.lastReportAt!)) / 60_000));
      const when = latest < 1 ? 'just now' : `${latest} ${latest === 1 ? 'minute' : 'minutes'} ago`;
      const description = winners.length === 1 && largest > summary.total / 2
        ? `Most reported ${conditions[winners[0]][0].toLowerCase()}.` : 'Reports describe mixed conditions.';
      detail!.textContent = `${description} Latest ${when}.`;
    }
    document.getElementById('community-breakdown')!.replaceChildren(...conditions.map(([label], index) => {
      const row = document.createElement('li');
      const name = document.createElement('span'); name.textContent = label;
      const value = document.createElement('span'); value.textContent = String(summary!.counts[index]);
      row.append(name, value); return row;
    }));
    document.getElementById('community-summary')!.hidden = false;
    document.getElementById('community-summary-title')!.textContent = count!.textContent;
  }

  async function verify(): Promise<void> {
    if (disposed || !summary || verifying || sending || nextAllowed > Date.now()) return;
    verifying = true; retry!.hidden = true;
    try {
      const api = await loadTurnstile();
      if (disposed || !summary) return;
      if (widgetId && widgetKey === summary.siteKey) { api.reset(widgetId); return; }
      if (widgetId) api.remove(widgetId);
      widgetKey = summary.siteKey;
      widgetId = api.render(widget!, { sitekey: summary.siteKey, action: 'stone_observation', size: 'flexible', appearance: 'interaction-only',
        callback: (value: string) => {
          if (!disposed) {
            token = value;
            if (chosen && !sending && status!.textContent?.startsWith('Verification')) status!.textContent = 'Ready to submit your observation.';
            updateButton();
          }
        },
        'expired-callback': () => { if (!disposed) { token = ''; updateButton(); } },
        'error-callback': () => {
          if (!disposed) { token = ''; status!.textContent = 'Verification could not complete. Please retry.'; retry!.hidden = false; updateButton(); }
          return true;
        },
      });
    } catch {
      if (!disposed) { status!.textContent = 'Verification could not load. Please retry.'; retry!.hidden = false; }
    } finally { verifying = false; }
  }

  function choose(): void {
    const condition = conditions[Number(slider!.value)];
    if (!condition || slider!.disabled) return;
    chosen = true;
    if (requestCondition !== Number(slider!.value)) {
      requestId = undefined; requestCondition = undefined;
      try { localStorage.removeItem(pendingStorageKey); } catch { /* Session-only retries are still available. */ }
    }
    slider!.setAttribute('aria-valuetext', `${condition[0]}. ${condition[1]}`);
    document.getElementById('condition-label')!.textContent = condition[0];
    document.getElementById('condition-description')!.textContent = condition[1];
    status!.textContent = nextAllowed > Date.now()
      ? `Thank you. You can send another observation in ${Math.ceil((nextAllowed - Date.now()) / 60_000)} minutes.`
      : 'Your observation describes what you can see now. It does not confirm a safe crossing.';
    if (!widgetId && !verifying) void verify();
    updateButton();
  }

  function schedule(): void {
    window.clearTimeout(timer);
    if (!disposed && !document.hidden && endpoint) timer = window.setTimeout(() => void refresh(), refreshMs);
  }

  async function refresh(): Promise<void> {
    if (!endpoint || disposed || document.hidden || summaryRequest) return;
    if (summary && Date.now() - Date.parse(summary.generatedAt) > 120_000) unavailable();
    const controller = new AbortController(); summaryRequest = controller;
    lastAttempt = Date.now();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetcher(endpoint, { signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error' });
      if (!response.ok) throw new Error('unavailable');
      const value = parseReportSummary(await response.json());
      if (disposed || controller.signal.aborted || summaryRequest !== controller) return;
      if (widgetId && widgetKey !== value.siteKey) { window.turnstile?.remove(widgetId); widgetId = undefined; token = ''; }
      summary = value; renderSummary();
      if (!chosen && !sending) status!.textContent = 'Choose the conditions you can see, then submit.';
      updateButton();
      if (dialog!.open && !widgetId) void verify();
    } catch { if (!disposed && summaryRequest === controller) unavailable(); }
    finally {
      window.clearTimeout(timeout);
      if (summaryRequest === controller) summaryRequest = undefined;
      schedule();
    }
  }

  async function send(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (submit!.disabled || sending || !endpoint) return;
    sending = true; requestId ??= newReportId(); requestCondition = Number(slider!.value);
    try {
      localStorage.setItem(deviceStorageKey, deviceId!);
      localStorage.setItem(pendingStorageKey, JSON.stringify({ id: requestId, condition: requestCondition }));
    } catch { /* Browser storage is optional. */ }
    updateButton(); status!.textContent = 'Sending your observation…';
    const controller = new AbortController(); submitRequest = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'omit', redirect: 'error', signal: controller.signal,
        body: JSON.stringify({ id: requestId, deviceId, condition: requestCondition, token }) });
      const result = await response.json();
      if (disposed) return;
      if (!response.ok) {
        if (response.status === 429) {
          const seconds = Number(response.headers.get('Retry-After'));
          nextAllowed = Date.now() + Math.max(1, Math.min(900, Number.isFinite(seconds) ? seconds : 60)) * 1000;
          status!.textContent = `Please wait ${Math.ceil((nextAllowed - Date.now()) / 60_000)} minutes before submitting again.`;
        } else if (result.error === 'verification') status!.textContent = 'Please complete verification and try again.';
        else status!.textContent = 'Your observation could not be confirmed. Please try again; retries will not add a duplicate.';
      } else if (result.ok === true && Number.isFinite(Date.parse(result.receivedAt)) && Number.isFinite(Date.parse(result.nextAllowedAt))) {
        nextAllowed = Date.parse(result.nextAllowedAt);
        const minutes = Math.max(0, Math.ceil((nextAllowed - Date.now()) / 60_000));
        status!.textContent = `Thank you — your observation has been saved.${minutes ? ` You can send another in ${minutes} minutes.` : ''}`;
        requestId = undefined; requestCondition = undefined;
        try { localStorage.removeItem(pendingStorageKey); } catch { /* Nothing to clear. */ }
        summaryRequest?.abort(); summaryRequest = undefined; void refresh();
      } else throw new Error('unconfirmed');
      status!.focus({ preventScroll: true });
    } catch {
      if (!disposed) { status!.textContent = 'Your observation could not be confirmed. Please try again; retries will not add a duplicate.'; status!.focus({ preventScroll: true }); }
    } finally {
      window.clearTimeout(timeout); token = ''; sending = false; submitRequest = undefined;
      if (!disposed) { updateButton(); if (widgetId) window.turnstile?.reset(widgetId); }
    }
  }

  function visibility(): void {
    if (document.hidden) window.clearTimeout(timer);
    else if (Date.now() - lastAttempt >= refreshMs) void refresh();
    else schedule();
  }
  const dialogObserver = new MutationObserver(() => { if (dialog!.open && !widgetId) void verify(); });
  dialogObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  slider.addEventListener('input', choose);
  slider.addEventListener('click', choose);
  form.addEventListener('submit', send);
  retry.addEventListener('click', verify);
  document.addEventListener('visibilitychange', visibility);
  unavailable();
  if (endpoint) { count.textContent = 'Checking community reports…'; void refresh(); }
  return () => {
    disposed = true; dialogObserver.disconnect(); window.clearTimeout(timer);
    summaryRequest?.abort(); submitRequest?.abort();
    if (widgetId) window.turnstile?.remove(widgetId);
    slider.removeEventListener('input', choose); slider.removeEventListener('click', choose);
    form.removeEventListener('submit', send); retry.removeEventListener('click', verify);
    document.removeEventListener('visibilitychange', visibility);
  };
}
