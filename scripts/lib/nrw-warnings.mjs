import areas from '../../data/nrw-warning-areas.json' with { type: 'json' };

export const NRW_WARNING_ENDPOINT = 'https://api.naturalresources.wales/floodwarnings/v3/all';
export const warningUrl = id => `https://flood-warning.naturalresources.wales/Detail/${id}`;
const severityNames = ['Severe Flood Warning', 'Flood Warning', 'Flood Alert', 'Warning no longer in force'];
const cleanText = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit ? value.trim() : undefined;

function time(value, now) {
  // Never guess the time zone of an unqualified provider timestamp.
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) throw new Error('Unqualified warning timestamp');
  const at = Date.parse(value);
  if (!Number.isFinite(at) || at > now.getTime() + 10 * 60000) throw new Error('Invalid warning timestamp');
  return new Date(at).toISOString();
}

/** The supported v3 contract is one complete GeoJSON FeatureCollection, not the public website's HTML. */
export function parseWarningFeed(feed, now = new Date()) {
  if (feed?.type !== 'FeatureCollection' || !Array.isArray(feed.features) || feed.features.length > 5000
    || feed.nextLink || feed.links?.next || feed.exceededTransferLimit || feed.hasMore
    || Array.isArray(feed.links) && feed.links.some(link => link?.rel === 'next')
    || typeof feed.numberMatched === 'number' && feed.numberMatched > feed.features.length) throw new Error('Incomplete warning feed');
  const warnings = [];
  const seen = new Set();
  for (const feature of feed.features) {
    const p = feature?.properties;
    const id = cleanText(p?.FWACODE, 30);
    // A broken feature could conceal a relevant area; it cannot confirm a clean local result.
    if (feature?.type !== 'Feature' || !id) throw new Error('Invalid warning feature');
    const area = areas.find(item => item.id === id);
    if (!area) continue;
    if (seen.has(id)) throw new Error('Duplicate warning area');
    seen.add(id);
    const severity = typeof p.SEVERITYVALUE === 'number' ? p.SEVERITYVALUE
      : typeof p.SEVERITYVALUE === 'string' && /^[1-4]$/.test(p.SEVERITYVALUE) ? Number(p.SEVERITYVALUE) : NaN;
    const name = severityNames[severity - 1];
    if (!name || typeof p.SEVERITY !== 'string' || p.SEVERITY.toLowerCase() !== name.toLowerCase()) throw new Error('Unknown warning severity');
    const description = cleanText(p.DESCRIPTION, 1000);
    const message = cleanText(p.RIM_ENGLISH, 12000);
    if (!description || !message) throw new Error('Incomplete warning message');
    const tidal = p.TIDAL === true || p.TIDAL === 'True' || p.TIDAL === 'true';
    if (![true, false, 'True', 'False', 'true', 'false'].includes(p.TIDAL)) throw new Error('Unknown warning type');
    warnings.push({ areaId: id, areaName: area.name, scope: area.scope, severity, severityName: name,
      description, message, tidal, raisedAt: time(p.TIMERAISED, now),
      severityChangedAt: time(p.SEVERITY_CHANGED, now), updatedAt: time(p.RIM_CHANGED, now), sourceUrl: warningUrl(id) });
  }
  return warnings;
}

/** Do not log response bodies, request headers, keys or provider errors. */
export async function fetchWarnings({ key, previous, fetcher = fetch, now = new Date() }) {
  const attemptedAt = now.toISOString();
  const unavailable = reason => ({ status: 'unavailable', attemptedAt, reason,
    ...(previous?.status === 'available' ? { lastKnown: { checkedAt: previous.checkedAt, warnings: previous.warnings } }
      : previous?.lastKnown ? { lastKnown: previous.lastKnown } : {}) });
  if (!key?.trim()) return unavailable('not-configured');
  try {
    const response = await fetcher(NRW_WARNING_ENDPOINT, { signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/geo+json, application/json', 'Ocp-Apim-Subscription-Key': key.trim(),
        'User-Agent': 'stepping-stones-data-generator/1.2', 'Cache-Control': 'no-cache' } });
    if (response.status !== 200 || response.headers.has('content-range')) return unavailable(response.status === 401 || response.status === 403 ? 'authentication' : 'request-failed');
    // Reject a demonstrably old intermediary cache even when the HTTP request succeeds.
    const age = response.headers.get('age');
    if (age !== null && (!/^\d+$/.test(age) || Number(age) > 15 * 60)) return unavailable('stale-response');
    try {
      const warnings = parseWarningFeed(await response.json(), now);
      return { status: 'available', attemptedAt, checkedAt: attemptedAt, warnings };
    } catch {
      return unavailable('invalid-response');
    }
  } catch {
    return unavailable('request-failed');
  }
}
