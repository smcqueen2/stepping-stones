import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identifier } from './prepare-ci-config.mjs';

/** These arguments are API result objects, including the schedules response's nested array. */
export function deploymentDetails(account, worker, scheduleResult) {
  if (worker?.subdomain?.enabled !== true || typeof account?.subdomain !== 'string'
    || !/^[a-z0-9-]+$/.test(account.subdomain)) throw new Error('The public workers.dev route is not enabled.');
  const schedules = scheduleResult?.schedules;
  if (!Array.isArray(schedules) || schedules.length !== 1 || schedules[0]?.cron !== '*/15 * * * *') {
    throw new Error('The expected quarter-hour schedule could not be verified.');
  }
  return { endpoint: `https://stepping-stones-data.${account.subdomain}.workers.dev/data/snapshot.json`, cron: schedules[0].cron };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const account = identifier(process.env.CLOUDFLARE_ACCOUNT_ID, 'CLOUDFLARE_ACCOUNT_ID');
    const namespace = identifier(process.env.CLOUDFLARE_KV_NAMESPACE_ID, 'CLOUDFLARE_KV_NAMESPACE_ID');
    const base = `https://api.cloudflare.com/client/v4/accounts/${account}`;
    async function request(route) {
      try { return await fetch(base + route, { redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } }); }
      catch { throw new Error('Hosted Worker check failed or timed out.'); }
    }
    async function get(route) {
      const response = await request(route);
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(`Worker configuration check failed: HTTP ${response.status}`);
      return data.result;
    }
    const [subdomain, worker, schedules, settings] = await Promise.all([
      get('/workers/subdomain'), get('/workers/workers/stepping-stones-data'),
      get('/workers/scripts/stepping-stones-data/schedules'), get('/workers/scripts/stepping-stones-data/settings'),
    ]);
    console.log(JSON.stringify(deploymentDetails(subdomain, worker, schedules)));
    console.log(JSON.stringify({ usageModel: settings.usage_model, configuredLimits: settings.limits }));
    const stored = await request(`/storage/kv/namespaces/${namespace}/values/latest%3Av1`);
    if (stored.status === 404) console.log('No saved snapshot yet; wait for the first successful Cron refresh.');
    else {
      if (!stored.ok) throw new Error(`Saved snapshot check failed: HTTP ${stored.status}`);
      const snapshot = await stored.json();
      if (snapshot?.schemaVersion !== 1 || !Number.isFinite(Date.parse(snapshot.refreshedAt))) {
        throw new Error('Saved snapshot schema/timestamp could not be verified.');
      }
      console.log(JSON.stringify({ savedSnapshotAt: snapshot.refreshedAt, modelGeneratedAt: snapshot.live?.generatedAt,
        forecastHours: snapshot.forecast?.hours?.length, monitoringGeneratedAt: snapshot.monitoring?.generatedAt,
        warningStatus: snapshot.monitoring?.floodWarnings?.status }));
    }
    console.log('Public routing propagation and source freshness still require an HTTP smoke check; usage model alone does not confirm a Free subscription.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
