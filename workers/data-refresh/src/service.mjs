import config from '../../../public/data/config.json' with { type: 'json' };
import { buildModelData } from '../../../scripts/lib/model-data.mjs';
import { buildMonitoringData } from '../../../scripts/lib/monitoring-data.mjs';

export const snapshotKey = 'latest:v1';
export const monitoringKey = 'monitoring:v1';

async function readRecord(env, key) {
  const snapshot = await env.SNAPSHOTS.get(key, { type: 'json', cacheTtl: 30 });
  if (snapshot !== null && (snapshot?.schemaVersion !== 1 || !Number.isFinite(Date.parse(snapshot.refreshedAt)))) {
    throw new Error('Stored snapshot could not be verified');
  }
  if (snapshot && key === monitoringKey && (!snapshot.monitoring?.gauges || !snapshot.monitoring?.floodWarnings
    || snapshot.monitoring.schemaVersion !== 1)) throw new Error('Stored monitoring could not be verified');
  return snapshot;
}

/** One model write per run; an unsuccessful calculation never advances its saved clock. */
export async function refreshModelSnapshot(env, { now = new Date(), model = buildModelData } = {}) {
  // Once monitoring has migrated, avoid parsing/rewriting the larger combined record.
  const monitoring = await readRecord(env, monitoringKey);
  const previous = monitoring ? undefined : await readRecord(env, snapshotKey);
  // The UI consumes hourly predictions; skip unused locale-formatted summary work on Free.
  const result = await model({ config, now, includeSummary: false });
  const snapshot = {
    schemaVersion: 1,
    refreshedAt: now.toISOString(),
    config, live: result.live, forecast: result.forecast,
    // Preserve the legacy warning cache during migration; its own timestamps never change here.
    monitoring: previous?.monitoring,
  };
  await env.SNAPSHOTS.put(snapshotKey, JSON.stringify(snapshot));
  console.log('Data refresh: model fulfilled.');
  return snapshot;
}

/** Independent monitoring job, including the last-known warning cache across a legacy migration. */
export async function refreshMonitoringSnapshot(env, { now = new Date(), monitoring = buildMonitoringData } = {}) {
  const previous = await readRecord(env, monitoringKey);
  const legacy = previous ? undefined : await readRecord(env, snapshotKey);
  const result = await monitoring({ key: env.NRW_API_KEY,
    previous: (previous?.monitoring ?? legacy?.monitoring)?.floodWarnings, now });
  const snapshot = { schemaVersion: 1, refreshedAt: now.toISOString(), monitoring: result };
  await env.SNAPSHOTS.put(monitoringKey, JSON.stringify(snapshot));
  console.log('Data refresh: monitoring fulfilled.');
  return snapshot;
}

async function readSnapshot(env) {
  const [model, monitoring] = await Promise.all([readRecord(env, snapshotKey), readRecord(env, monitoringKey)]);
  if (!model && !monitoring) return null;
  const newest = monitoring && (!model || Date.parse(monitoring.refreshedAt) >= Date.parse(model.refreshedAt)) ? monitoring : model;
  return { schemaVersion: 1,
    refreshedAt: newest.refreshedAt,
    config: model?.config ?? config, live: model?.live, forecast: model?.forecast,
    monitoring: monitoring?.monitoring ?? model?.monitoring };
}

function headersFor(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (origin && !allowed.includes(origin)) return undefined;
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
  };
}

/** Visitors only read the saved snapshot; HTTP requests never trigger provider fetches. */
export async function serveSnapshot(request, env) {
  const headers = headersFor(request, env);
  if (!headers) return new Response('Origin not allowed', { status: 403 });
  const reply = (value, status = 200) => new Response(request.method === 'HEAD' ? null : JSON.stringify(value), { status, headers });
  if (new URL(request.url).pathname !== '/data/snapshot.json') return reply({ error: 'Not found' }, 404);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    ...headers, 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Accept',
  } });
  if (!['GET', 'HEAD'].includes(request.method)) return reply({ error: 'Method not allowed' }, 405);
  try {
    const snapshot = await readSnapshot(env);
    if (!snapshot) return reply({ error: 'Data not ready; waiting for the first scheduled refresh' }, 503);
    // Explicit public fields only. Environment secrets and internal errors are never serialised.
    const { schemaVersion, refreshedAt, live, forecast, monitoring, config: publicConfig } = snapshot;
    return reply({ schemaVersion, refreshedAt, live, forecast, monitoring, config: publicConfig });
  } catch {
    return reply({ error: 'Saved data is unavailable' }, 503);
  }
}
