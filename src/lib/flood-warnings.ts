import areas from '../../data/nrw-warning-areas.json';
import type { FloodWarnings, StateLabel, WarningSnapshot } from './types';

// Operational expiry: 15-min source publication + 15-min build + 15-min client refresh.
// This is an information-age limit, not a hydrological risk threshold or delivery guarantee.
export const warningMaxAgeMinutes = 45;
export const officialWarningUrl = (id = '102FWB402A') => `https://flood-warning.naturalresources.wales/Detail/${id}`;
const names = ['Severe Flood Warning', 'Flood Warning', 'Flood Alert', 'Warning no longer in force'];
const time = (value: unknown, now: number) => typeof value === 'string' && /(Z|[+-]\d{2}:\d{2})$/i.test(value)
  && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now + 10 * 60000;
function validSnapshot(snapshot: WarningSnapshot | undefined, now: number): snapshot is WarningSnapshot {
  if (!snapshot || !time(snapshot.checkedAt, now) || !Array.isArray(snapshot.warnings) || snapshot.warnings.length > areas.length) return false;
  const ids = new Set();
  return snapshot.warnings.every(warning => {
    const area = areas.find(item => item.id === warning?.areaId);
    if (!area || ids.has(area.id) || warning.scope !== area.scope || warning.areaName !== area.name
      || !Number.isInteger(warning.severity) || warning.severity < 1 || warning.severity > 4
      || warning.severityName !== names[warning.severity - 1]
      || typeof warning.description !== 'string' || !warning.description.trim() || warning.description.length > 1000
      || typeof warning.message !== 'string' || !warning.message.trim() || warning.message.length > 12000
      || typeof warning.tidal !== 'boolean' || !time(warning.raisedAt, now)
      || !time(warning.updatedAt, now) || !time(warning.severityChangedAt, now)
      || Date.parse(warning.updatedAt) > Date.parse(snapshot.checkedAt) + 10 * 60000
      || warning.sourceUrl !== officialWarningUrl(area.id)) return false;
    ids.add(area.id);
    return true;
  });
}

/** An older deployment/cache must not erase a newer warning already seen by this tab. */
export function retainWarningState(current: FloodWarnings | undefined, previous: FloodWarnings | undefined, now = Date.now()): FloodWarnings | undefined {
  const snapshot = (data?: FloodWarnings) => data?.status === 'available' ? data : data?.status === 'unavailable' ? data.lastKnown : undefined;
  const incoming = snapshot(current);
  const old = snapshot(previous);
  const incomingValid = validSnapshot(incoming, now);
  const oldValid = validSnapshot(old, now);
  const conflict = oldValid && incomingValid && old.checkedAt === incoming.checkedAt
    && JSON.stringify(old.warnings) !== JSON.stringify(incoming.warnings);
  const priority = (snapshot: WarningSnapshot) => Math.min(4, ...snapshot.warnings.map(warning => warning.severity));
  const useOld = oldValid && (!incomingValid || Date.parse(old.checkedAt) > Date.parse(incoming.checkedAt)
    || conflict && priority(old) <= priority(incoming));
  const latest = useOld ? old : incomingValid ? incoming : undefined;
  if (current?.status === 'available' && latest === incoming && !conflict) return current;
  if (!current && !latest) return undefined;
  return { status: 'unavailable', attemptedAt: current?.attemptedAt ?? new Date(now).toISOString(),
    reason: current?.status === 'unavailable' ? current.reason : 'unverified-response', ...(latest ? { lastKnown: latest } : {}) };
}

/** A stale/failed check may retain a warning, but can never establish an all-clear. */
export function floodWarningSummary(payload?: FloodWarnings, now = Date.now(), updateFailed = false) {
  const snapshot = payload?.status === 'available' ? payload : payload?.status === 'unavailable' ? payload.lastKnown : undefined;
  const valid = validSnapshot(snapshot, now);
  const verified = valid && payload?.status === 'available' && !updateFailed
    && now - Date.parse(snapshot.checkedAt) <= warningMaxAgeMinutes * 60000;
  const active = valid ? snapshot.warnings.filter(warning => warning.severity !== 4).sort((a, b) => a.severity - b.severity) : [];
  const highest = active[0];
  const severity = highest?.severity;
  const danger = severity === 1 || severity === 2;
  const removed = verified && !highest && snapshot.warnings.some(warning => warning.severity === 4);
  const headline = !verified ? highest ? `Last known: NRW ${highest.severityName}` : 'NRW warning status unavailable'
    : highest ? `NRW ${highest.severityName}` : removed ? 'NRW warning no longer in force' : 'No active NRW warnings';
  const areaDescription = highest ? `${highest.areaName}${highest.scope === 'local' ? '' : ' · wider area'}. ` : '';
  const detail = !verified ? `${areaDescription}Current warning status cannot be verified. Check NRW.`
    : danger ? `${areaDescription}${severity === 1 ? 'Severe flooding. Danger to life.' : 'Flooding is expected.'}`
      : highest ? `${areaDescription}Flooding is possible. Be prepared.` : 'For the monitored areas. This does not mean the stones are safe.';
  return { verified, headline, detail, highest, warnings: valid ? snapshot.warnings : [],
    checkedAt: valid ? snapshot.checkedAt : undefined,
    tone: danger ? severity === 1 ? 'severe' : 'danger' : highest ? 'caution' : verified ? 'quiet' : 'unknown',
    sourceUrl: officialWarningUrl(highest?.areaId),
    advice: danger ? 'Do not cross' : highest ? 'Caution' : undefined,
    adviceDetail: danger ? verified ? `An NRW ${highest.severityName} affects the area. Do not attempt the crossing.`
      : 'An NRW warning was last reported here. Current status is unverified; do not attempt the crossing.'
      : highest ? verified ? 'NRW reports possible flooding in the area. Use extra caution.' : 'An NRW alert was last reported. Current status is unverified.' : undefined,
  };
}

export function applyWarningAdvice(model: { available: boolean; state: string }, warning: ReturnType<typeof floodWarningSummary>) {
  if (warning.advice === 'Do not cross') return { state: 'Do not cross', style: 'Likely Unpassable' as StateLabel, detail: warning.adviceDetail };
  if (warning.advice === 'Caution' && (!model.available || model.state === 'Likely Passable')) {
    return { state: 'Caution', style: 'Caution' as StateLabel, detail: warning.adviceDetail };
  }
  return undefined;
}

const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
const setText = (id: string, value: string) => { const node = document.getElementById(id); if (node && node.textContent !== value) node.textContent = value; };
export function renderFloodWarnings(summary: ReturnType<typeof floodWarningSummary>) {
  const host = document.getElementById('nrw-warning');
  if (host) host.dataset.tone = summary.tone;
  setText('nrw-warning-title', summary.headline);
  setText('nrw-warning-detail', summary.detail);
  setText('nrw-warning-checked', summary.checkedAt ? `${summary.verified ? 'Checked' : 'Last verified'} ${clock.format(Date.parse(summary.checkedAt))}` : '');
  const link = document.getElementById('nrw-warning-link');
  link?.setAttribute('href', summary.sourceUrl);
  const details = document.getElementById('nrw-warning-messages');
  if (!details) return;
  const signature = JSON.stringify([summary.headline, summary.checkedAt, summary.warnings]);
  if (details.dataset.content === signature) return;
  details.dataset.content = signature;
  details.replaceChildren();
  const status = document.createElement('p');
  status.textContent = `${summary.headline}. ${summary.detail}${summary.checkedAt ? ` Last successful check: ${clock.format(Date.parse(summary.checkedAt))}.` : ''}`;
  details.append(status);
  for (const warning of summary.warnings) {
    const article = document.createElement('article');
    const heading = document.createElement('h4');
    const link = document.createElement('a');
    link.href = officialWarningUrl(warning.areaId); link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = `${warning.areaName} · ${warning.severityName}`;
    heading.append(link);
    const dates = document.createElement('p');
    dates.className = 'muted small';
    dates.textContent = `Issued ${clock.format(Date.parse(warning.raisedAt))} · Message updated ${clock.format(Date.parse(warning.updatedAt))} · Severity changed ${clock.format(Date.parse(warning.severityChangedAt))}`;
    const description = document.createElement('p'); description.textContent = warning.description;
    const message = document.createElement('p'); message.className = 'nrw-message'; message.textContent = warning.message;
    article.append(heading, dates, description, message); details.append(article);
  }
}
