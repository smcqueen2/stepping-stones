import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identifier } from '../../data-refresh/scripts/prepare-ci-config.mjs';

/** Return only credential metadata; never expose the bearer value or provider error body. */
export async function deploymentTokenIdentity({ accountId, token, fetcher = fetch } = {}) {
  const account = identifier(accountId, 'CLOUDFLARE_ACCOUNT_ID');
  if (typeof token !== 'string' || !token.trim()) throw new Error('Configure CLOUDFLARE_API_TOKEN.');
  for (const [kind, route] of [['account', `/accounts/${account}/tokens/verify`], ['user', '/user/tokens/verify']]) {
    let response;
    let data;
    try {
      response = await fetcher(`https://api.cloudflare.com/client/v4${route}`, {
        headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15_000),
      });
      data = await response.json();
    } catch { throw new Error('Deployment credential verification was unavailable.'); }
    if (!response.ok || data?.success !== true) continue;
    if (!/^[a-f0-9]{32}$/i.test(data.result?.id || '') || data.result?.status !== 'active') {
      throw new Error('The deployment credential is inactive or returned invalid metadata.');
    }
    return { kind, id: data.result.id.toLowerCase(), status: 'active' };
  }
  throw new Error('Cloudflare did not recognise the deployment credential for this account or user.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const identity = await deploymentTokenIdentity({ accountId: process.env.CLOUDFLARE_ACCOUNT_ID, token: process.env.CLOUDFLARE_API_TOKEN });
    console.log(`Verified deployment credential metadata: ${JSON.stringify(identity)}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
