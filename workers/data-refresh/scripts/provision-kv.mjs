import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identifier } from './prepare-ci-config.mjs';

export const namespaceTitle = 'stepping-stones-data-snapshots';

/** One classic namespace, reused on every deployment. No billing, R2 or state-backend APIs. */
export async function provisionNamespace({ accountId, token, namespaceId, fetcher = fetch } = {}) {
  const account = identifier(accountId, 'CLOUDFLARE_ACCOUNT_ID');
  const selected = namespaceId ? identifier(namespaceId, 'CLOUDFLARE_KV_NAMESPACE_ID') : undefined;
  if (typeof token !== 'string' || !token.trim()) throw new Error('Configure Actions secret CLOUDFLARE_API_TOKEN.');
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces`;
  async function request(url, method = 'GET', body) {
    let response;
    try {
      response = await fetcher(url, { method, redirect: 'error', signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}) });
    } catch { throw new Error('Cloudflare KV request failed or timed out; no automatic create retry was attempted.'); }
    let data;
    try { data = await response.json(); } catch { throw new Error('Cloudflare KV returned an invalid response.'); }
    if (!response.ok || data?.success !== true) {
      // Never print a provider body, credential, or request headers.
      throw new Error(`Cloudflare KV request failed (HTTP ${response.status}). Check the account and token's Workers KV read/write permissions.`);
    }
    return data;
  }
  const namespaces = [];
  for (let page = 1; ; page++) {
    if (page > 100) throw new Error('Cloudflare KV pagination exceeded the setup limit; no namespace created.');
    const data = await request(`${base}?page=${page}&per_page=100`);
    if (!Array.isArray(data.result) || data.result.some(item => !item || typeof item.title !== 'string'
      || !/^[a-f0-9]{32}$/i.test(item.id) || /^0+$/.test(item.id))) {
      throw new Error('Cloudflare KV returned an invalid namespace list; no namespace created.');
    }
    namespaces.push(...data.result);
    if (data.result.length < 100) break;
  }
  const matches = namespaces.filter(item => selected ? item.id.toLowerCase() === selected : item.title === namespaceTitle);
  if (matches.length > 1) throw new Error('Ambiguous snapshot namespaces; select CLOUDFLARE_KV_NAMESPACE_ID explicitly.');
  if (selected && matches.length !== 1) throw new Error('Selected snapshot namespace does not exist in this account; no replacement created.');
  if (matches[0]) {
    if (matches[0].mode) throw new Error('This proof of concept requires classic KV storage; no changes made.');
    return { id: identifier(matches[0].id, 'CLOUDFLARE_KV_NAMESPACE_ID'), created: false };
  }
  const data = await request(base, 'POST', { title: namespaceTitle });
  if (data.result?.title !== namespaceTitle || data.result?.mode) throw new Error('Could not verify the newly created classic snapshot namespace.');
  return { id: identifier(data.result?.id, 'CLOUDFLARE_KV_NAMESPACE_ID'), created: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await provisionNamespace({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN, namespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID });
    if (process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV, `CLOUDFLARE_KV_NAMESPACE_ID=${result.id}\n`);
    console.log(`${result.created ? 'Created' : 'Reused'} classic snapshot KV namespace: ${result.id}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
