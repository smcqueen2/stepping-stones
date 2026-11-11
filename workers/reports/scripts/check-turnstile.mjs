import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Check the secret privately without solving a challenge or creating an observation. */
export async function checkTurnstileSecret({ secret, fetcher = fetch } = {}) {
  if (typeof secret !== 'string' || !secret.trim() || /^[123]x0/.test(secret)) {
    throw new Error('Configure a real TURNSTILE_SECRET_KEY Actions secret.');
  }
  let result;
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ secret, response: 'deployment-check-deliberately-invalid-token' }),
    });
    if (!response.ok) throw new Error();
    result = await response.json();
  } catch { throw new Error('Turnstile secret check was unavailable; no resources provisioned.'); }
  // A recognised secret rejects this invalid token. A bad secret has a different provider error.
  if (result?.success !== false || !Array.isArray(result['error-codes']) || result['error-codes'].length !== 1
    || result['error-codes'][0] !== 'invalid-input-response') {
    throw new Error('Turnstile did not confirm the expected secret check. Verify TURNSTILE_SECRET_KEY privately; no resources provisioned.');
  }
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await checkTurnstileSecret({ secret: process.env.TURNSTILE_SECRET_KEY });
    console.log('Turnstile recognised the secret and rejected the deliberately invalid token. No observation was submitted.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
