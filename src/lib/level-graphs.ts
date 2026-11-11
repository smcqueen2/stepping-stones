import type { LivePayload, LocalGauge } from './types';
import { localGaugeStatus } from './local-monitoring';
import riverReference from '../data/river-reference.json';

const ns = 'http://www.w3.org/2000/svg';
const minute = 60000;
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function levelLine(points: unknown, from: number, to: number, minimumRange: number, reference?: { low: number; high: number }) {
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
  const range = reference && finite(reference.low) && finite(reference.high) && reference.high > reference.low ? reference : undefined;
  const displayLow = Math.min(low, range?.low ?? low);
  const displayHigh = Math.max(high, range?.high ?? high);
  // Keep a nearly steady river nearly flat rather than magnifying millimetre noise.
  const span = Math.max(displayHigh - displayLow, minimumRange);
  const base = (displayHigh + displayLow - span) / 2;
  const yPosition = (value: number) => (range ? 64 : 49) - (value - base) / span * (range ? 52 : 42);
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
    const y = yPosition(point.value).toFixed(2);
    path += `${length ? 'L' : 'M'}${x},${y}`;
    length++;
  }
  if (length > 1) paths.push(path);
  if (!paths.length) return undefined;
  return { paths, low, high, latest: readings[readings.length - 1], count: readings.length,
    reference: range ? { ...range, lowY: yPosition(range.low), highY: yPosition(range.high) } : undefined };
}

export function renderLevelGraphs(live: LivePayload | undefined, fresh: boolean, stale: boolean, now: number, staleAfter = 120, loading = !live, localRiver?: LocalGauge | null) {
  for (const role of ['river', 'tide'] as const) {
    const host = document.getElementById(`${role}-level-graph`);
    if (!host) continue;
    host.replaceChildren();
    delete host.dataset.reference;
    const local = role === 'river' && localRiver !== undefined;
    const status = local ? localGaugeStatus(localRiver ?? undefined, 'ewenny', now, staleAfter) : { available: fresh, stale };
    const history = local ? localRiver?.history : live?.recentLevels;
    // These reviewed NRW values belong to this gauge/parameter only, on its own metre scale.
    const reference = local && localRiver?.stationId === riverReference.stationId
      && localRiver.parameterId === riverReference.parameterId && localRiver.unit === riverReference.unit
      && localRiver.datum === riverReference.datum && localRiver.source === riverReference.source ? riverReference : undefined;
    const from = Date.parse(history?.from ?? '');
    const to = Date.parse(history?.to ?? '');
    const points = local ? localRiver?.history?.points : live?.recentLevels?.[role];
    const chart = status.available && to - from === 12 * 60 * minute && to <= now + 10 * minute && now - to <= staleAfter * minute
      ? levelLine(points, from, to, role === 'river' ? .1 : 2, reference) : undefined;
    if (!chart || now - chart.latest.at > staleAfter * minute || chart.latest.at > now + 10 * minute) {
      host.dataset.available = 'false';
      const message = document.createElement('p');
      message.className = 'level-graph-empty';
      message.textContent = status.stale ? 'History out of date' : loading ? 'Loading recent levels…' : 'History unavailable';
      host.append(message);
      continue;
    }
    host.dataset.available = 'true';
    host.dataset.reference = chart.reference ? 'all-year' : 'none';
    const source = live?.sourceStations.find(station => station?.role === role);
    const name = (local ? localRiver?.name : typeof source?.stationTitle === 'string' ? source.stationTitle.trim() : '') || (role === 'river' ? 'River gauge' : 'Regional tide gauge');
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', chart.reference ? '0 0 200 76' : '0 0 200 56');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    const unit = role === 'river' ? 'metres at the gauge' : 'metres above Ordnance Datum';
    const context = chart.reference ? ` NRW year-round typical low ${chart.reference.low.toFixed(3)} and high ${chart.reference.high.toFixed(3)} metres, checked ${riverReference.checkedOn}. These are not monthly averages or crossing-safety thresholds.` : '';
    svg.setAttribute('aria-label', `${role === 'river' ? 'River' : 'Regional tide'} level at ${name}, ${clock.format(from)} to ${clock.format(to)} local time. Observed range ${chart.low.toFixed(3)} to ${chart.high.toFixed(3)} ${unit}. Last reading ${clock.format(chart.latest.at)}. Gaps over 45 minutes are left open. Each graph has its own scale.${context}`);
    if (chart.reference) {
      for (const kind of ['high', 'low'] as const) {
        const line = document.createElementNS(ns, 'line');
        line.classList.add('level-graph-reference', `level-graph-reference-${kind}`);
        line.setAttribute('x1', '4'); line.setAttribute('x2', '196');
        const y = chart.reference[kind === 'high' ? 'highY' : 'lowY'];
        line.setAttribute('y1', y.toFixed(2)); line.setAttribute('y2', y.toFixed(2));
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.append(line);
      }
    }
    for (const d of chart.paths) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.append(path);
    }
    const plot = document.createElement('div');
    plot.className = 'level-graph-plot';
    plot.append(svg);
    if (chart.reference) {
      // Keep labels aligned with the SVG when the expanded tile increases plot height.
      const highTop = Math.min(48, Math.max(0, chart.reference.highY - 14));
      const lowTop = Math.min(64, Math.max(highTop + 14, chart.reference.lowY + 2));
      for (const kind of ['high', 'low'] as const) {
        const label = document.createElement('span');
        label.className = 'level-graph-reference-label';
        label.setAttribute('aria-hidden', 'true');
        label.style.top = `${(kind === 'high' ? highTop : lowTop) / 76 * 100}%`;
        label.textContent = `Typical ${kind} ${chart.reference[kind].toFixed(3)}m`;
        plot.append(label);
      }
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
    if (chart.reference) {
      const sourceLink = document.createElement('a');
      sourceLink.href = riverReference.sourceUrl;
      sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer';
      sourceLink.textContent = 'NRW typical range · all year';
      sourceLink.title = `Reference levels checked ${riverReference.checkedOn}; not monthly averages or safe-crossing levels.`;
      caption.append(document.createElement('br'), sourceLink);
    }
    host.append(plot, times, caption);
  }
}
