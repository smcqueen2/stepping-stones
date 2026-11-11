import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identifier } from '../../data-refresh/scripts/prepare-ci-config.mjs';

export const databaseName = 'stepping-stones-observations';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function databaseIdentifier(value) {
  if (typeof value !== 'string' || !uuid.test(value) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value)) {
    throw new Error('Configure CLOUDFLARE_REPORTS_DATABASE_ID with an existing D1 database UUID.');
  }
  return value.toLowerCase();
}

export function reportsConfig(template, { accountId, databaseId, siteKey } = {}) {
  const account = identifier(accountId, 'CLOUDFLARE_ACCOUNT_ID');
  const database = databaseIdentifier(databaseId);
  if (typeof siteKey !== 'string' || !/^[a-z0-9_-]{20,100}$/i.test(siteKey) || /^[123]x0/.test(siteKey)) {
    throw new Error('Configure TURNSTILE_SITE_KEY with a real public Turnstile site key; production rejects test keys.');
  }
  if (template.name !== 'stepping-stones-reports' || template.vars.LOCAL_DEVELOPMENT !== 'false'
    || template.d1_databases?.length !== 1 || template.d1_databases[0].binding !== 'REPORTS') {
    throw new Error('Refusing a non-production or ambiguous reports configuration.');
  }
  return { ...template, account_id: account,
    vars: { ...template.vars, TURNSTILE_SITE_KEY: siteKey },
    d1_databases: [{ ...template.d1_databases[0], database_id: database }] };
}

/** Reuse one named D1 database. Never delete, replace, change billing, or retry an uncertain create. */
export async function provisionReports({ accountId, token, databaseId, fetcher = fetch } = {}) {
  const account = identifier(accountId, 'CLOUDFLARE_ACCOUNT_ID');
  const selected = databaseId ? databaseIdentifier(databaseId) : undefined;
  if (typeof token !== 'string' || !token.trim()) throw new Error('Configure CLOUDFLARE_API_TOKEN.');
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`;
  async function request(url, method = 'GET', body) {
    let response;
    try {
      response = await fetcher(url, { method, redirect: 'error', signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch { throw new Error('D1 request failed or timed out; no automatic create retry was attempted.'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('D1 returned an invalid response.'); }
    if (!response.ok || data.success !== true) throw new Error(`D1 request failed (HTTP ${response.status}). Check account D1 Edit permission on the deployment token.`);
    return data.result;
  }
  const databases = [];
  for (let page = 1; ; page++) {
    if (page > 100) throw new Error('D1 pagination exceeded the setup limit; no database created.');
    const data = await request(`${base}?page=${page}&per_page=100`);
    if (!Array.isArray(data) || data.some(item => !item || typeof item.name !== 'string' || !uuid.test(item.uuid))) {
      throw new Error('D1 returned an invalid database list; no database created.');
    }
    databases.push(...data);
    if (data.length < 100) break;
  }
  const matches = databases.filter(item => selected ? item.uuid.toLowerCase() === selected : item.name === databaseName);
  if (matches.length > 1) throw new Error('Ambiguous report databases; select CLOUDFLARE_REPORTS_DATABASE_ID explicitly.');
  if (selected && !matches.length) throw new Error('Selected report database was not found; no replacement created.');
  if (matches[0]) {
    if (matches[0].name !== databaseName) throw new Error('The selected database belongs to another application; no changes made.');
    return { id: databaseIdentifier(matches[0].uuid), created: false };
  }
  const created = await request(base, 'POST', { name: databaseName, primary_location_hint: 'weur' });
  if (created?.name !== databaseName) throw new Error('Could not verify the created report database.');
  return { id: databaseIdentifier(created.uuid), created: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.env.TURNSTILE_SECRET_KEY || /^[123]x0/.test(process.env.TURNSTILE_SECRET_KEY)) {
      throw new Error('Configure a real TURNSTILE_SECRET_KEY Actions secret before provisioning reports.');
    }
    const template = JSON.parse(await readFile(new URL('../wrangler.json', import.meta.url), 'utf8'));
    // Validate all public settings before provisioning anything.
    reportsConfig(template, { accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      databaseId: '11111111-1111-4111-8111-111111111111', siteKey: process.env.TURNSTILE_SITE_KEY });
    const result = await provisionReports({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN, databaseId: process.env.CLOUDFLARE_REPORTS_DATABASE_ID });
    const config = reportsConfig(template, { accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      databaseId: result.id, siteKey: process.env.TURNSTILE_SITE_KEY });
    await writeFile(new URL('../wrangler.ci.json', import.meta.url), `${JSON.stringify(config, null, 2)}\n`);
    if (process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV, `CLOUDFLARE_REPORTS_DATABASE_ID=${result.id}\n`);
    console.log(`${result.created ? 'Created' : 'Reused'} reports D1 database: ${result.id}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
