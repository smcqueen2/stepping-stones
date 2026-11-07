import type { LivePayload } from './types';

const ns = 'http://www.w3.org/2000/svg';
const minute = 60000;
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function levelLine(points: unknown, from: number, to: number, minimumRange: number) {
  if (!Array.isArray(points) || points.length > 100 || !finite(from) || !finite(to) || to <= from || to - from > 24 * 60 * minute) return undefined;
  const readings: { at: number; value: number; breakBefore: boolean }[] = [];
  let broken = false;
  for (const point of points) {
    const at = Date.parse(point?.time);
    if (!finite(at) || !finite(point?.value) || at < from || at > to) { broken = true; continue; }
    if (readings.length && at <= readings[readings.length - 1].at) return undefined;
    readings.push({ at, value: point.value, breakBefore: broken });
    broken = false;
  }
  if (readings.length < 2) return undefined;
  const low = Math.min(...readings.map(point => point.value));
  const high = Math.max(...readings.map(point => point.value));
  // Keep a nearly steady river nearly flat rather than magnifying millimetre noise.
  const span = Math.max(high - low, minimumRange);
  const base = (high + low - span) / 2;
  const paths: string[] = [];
  let path = '';
  let length = 0;
  for (let i = 0; i < readings.length; i++) {
    const point = readings[i];
    if (point.breakBefore || i > 0 && point.at - readings[i - 1].at > 45 * minute) {
      if (length > 1) paths.push(path);
      path = ''; length = 0;
    }
    const x = (4 + (point.at - from) / (to - from) * 192).toFixed(2);
    const y = (49 - (point.value - base) / span * 42).toFixed(2);
    path += `${length ? 'L' : 'M'}${x},${y}`;
    length++;
  }
  if (length > 1) paths.push(path);
  if (!paths.length) return undefined;
  return { paths, low, high, latest: readings[readings.length - 1], count: readings.length };
}

export function renderLevelGraphs(live: LivePayload | undefined, fresh: boolean, stale: boolean, now: number, staleAfter = 120, loading = !live) {
  const history = live?.recentLevels;
  const from = Date.parse(history?.from ?? '');
  const to = Date.parse(history?.to ?? '');
  for (const role of ['river', 'tide'] as const) {
    const host = document.getElementById(`${role}-level-graph`);
    if (!host) continue;
    host.replaceChildren();
    const chart = fresh && to - from === 12 * 60 * minute && to <= now + 10 * minute && now - to <= staleAfter * minute
      ? levelLine(history?.[role], from, to, role === 'river' ? .1 : 2) : undefined;
    if (!chart || now - chart.latest.at > staleAfter * minute || chart.latest.at > now + 10 * minute) {
      host.dataset.available = 'false';
      const message = document.createElement('p');
      message.className = 'level-graph-empty';
      message.textContent = stale ? 'History out of date' : loading ? 'Loading recent levels…' : 'History unavailable';
      host.append(message);
      continue;
    }
    host.dataset.available = 'true';
    const source = live?.sourceStations.find(station => station?.role === role);
    const name = (typeof source?.stationTitle === 'string' ? source.stationTitle.trim() : '') || (role === 'river' ? 'River gauge' : 'Regional tide gauge');
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 200 56');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    const unit = role === 'river' ? 'metres at the gauge' : 'metres above Ordnance Datum';
    svg.setAttribute('aria-label', `${role === 'river' ? 'River' : 'Regional tide'} level at ${name}, ${clock.format(from)} to ${clock.format(to)} local time. Observed range ${chart.low.toFixed(3)} to ${chart.high.toFixed(3)} ${unit}. Last reading ${clock.format(chart.latest.at)}. Gaps over 45 minutes are left open. Each graph has its own scale.`);
    for (const d of chart.paths) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(path);
    }
    const times = document.createElement('div');
    times.className = 'level-graph-times';
    for (const at of [from, to]) {
      const label = document.createElement('time');
      label.dateTime = new Date(at).toISOString();
      label.textContent = clock.format(at);
      times.append(label);
    }
    const caption = document.createElement('p');
    caption.className = 'level-graph-source';
    caption.textContent = role === 'river' ? 'Past 12h · observed' : `${name.replace(/\s+tide gauge$/i, '')} · regional`;
    host.append(svg, times, caption);
  }
}
