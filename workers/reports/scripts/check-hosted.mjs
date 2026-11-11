import assert from 'node:assert/strict';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!/^[a-f0-9]{32}$/i.test(account || '') || !token) throw new Error('Deployment credentials are missing.');
const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/subdomain`, {
  headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error(`Could not read the Workers public subdomain (HTTP ${response.status}).`);
const data = await response.json();
const subdomain = data.result?.subdomain;
if (!data.success || !/^[a-z0-9-]+$/i.test(subdomain || '')) throw new Error('Could not verify the Workers public subdomain.');
const endpoint = `https://stepping-stones-reports.${subdomain}.workers.dev/api/reports`;
// Read-only checks never create a fictional public condition observation.
const summary = await fetch(endpoint, { headers: { Origin: 'https://smcqueen2.github.io' }, signal: AbortSignal.timeout(20_000) });
assert.equal(summary.status, 200, 'Published reports service is not ready.');
assert.equal(summary.headers.get('Access-Control-Allow-Origin'), 'https://smcqueen2.github.io');
const value = await summary.json();
assert.equal(value.schemaVersion, 1);
assert.equal(value.counts.length, 5);
assert.equal(value.counts.reduce((sum, count) => sum + count, 0), value.total);
assert.ok(Math.abs(Date.now() - Date.parse(value.generatedAt)) < 120_000, 'Report summary is stale.');
assert.equal(Object.hasOwn(value, 'reporter_hash'), false);
const options = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://smcqueen2.github.io' } });
assert.equal(options.status, 204);
console.log(`Verified reports endpoint: ${endpoint}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Community observations\n- Database: stepping-stones-observations (${process.env.CLOUDFLARE_REPORTS_DATABASE_ID})\n- Public endpoint: ${endpoint}\n- Set repository variable REPORTS_ENDPOINT to that URL, then run Build and Deploy Pages.\n- Set CLOUDFLARE_REPORTS_DEPLOY_ENABLED=true for future relevant main-push deployments.\n- No subscription upgrade or R2 resource is provisioned.\n`);
}
