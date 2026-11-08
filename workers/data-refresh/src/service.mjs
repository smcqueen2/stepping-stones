import config from '../../../public/data/config.json' with { type: 'json' };
import { buildModelData } from '../../../scripts/lib/model-data.mjs';
import { buildMonitoringData } from '../../../scripts/lib/monitoring-data.mjs';

export const snapshotKey = 'latest:v1';

async function readSnapshot(env) {
  const snapshot = await env.SNAPSHOTS.get(snapshotKey, { type: 'json', cacheTtl: 30 });
  if (snapshot !== null && (snapshot?.schemaVersion !== 1 || !Number.isFinite(Date.parse(snapshot.refreshedAt)))) {
    throw new Error('Stored snapshot could not be verified');
  }
  return snapshot;
}

/** One public-data KV write per run. Preserve each section's actual timestamps on partial failure. */
export async function refreshSnapshot(env, { now = new Date(), model = buildModelData, monitoring = buildMonitoringData } = {}) {
  const previous = await readSnapshot(env);
  const results = await Promise.allSettled([
    Promise.resolve().then(() => model({ config, now })),
    Promise.resolve().then(() => monitoring({ key: env.NRW_API_KEY, previous: previous?.monitoring?.floodWarnings, now })),
  ]);
  const modelResult = results[0];
  const monitoringResult = results[1];
  if (modelResult.status === 'rejected' && monitoringResult.status === 'rejected') {
    // Do not overwrite a known warning or advance any clock when neither pipeline succeeded.
    throw new Error('No data pipeline could refresh');
  }
  const snapshot = {
    schemaVersion: 1,
    refreshedAt: now.toISOString(),
    config: modelResult.status === 'fulfilled' ? config : previous?.config ?? config,
    live: modelResult.status === 'fulfilled' ? modelResult.value.live : previous?.live,
    forecast: modelResult.status === 'fulfilled' ? modelResult.value.forecast : previous?.forecast,
    monitoring: monitoringResult.status === 'fulfilled' ? monitoringResult.value : previous?.monitoring,
  };
  await env.SNAPSHOTS.put(snapshotKey, JSON.stringify(snapshot));
  console.log(`Data refresh: model ${modelResult.status}, monitoring ${monitoringResult.status}.`);
  return snapshot;
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
