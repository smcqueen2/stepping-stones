export const hourMs = 60 * 60_000;
export const cooldownMs = 15 * 60_000;
const retentionMs = 90 * 24 * hourMs;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const route = '/api/reports';

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...headers,
  } });
}

function cors(response, origin) {
  const result = new Response(response.body, response);
  result.headers.set('Vary', 'Origin');
  result.headers.set('Cache-Control', 'no-store');
  if (origin) {
    result.headers.set('Access-Control-Allow-Origin', origin);
    result.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    result.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    result.headers.set('Access-Control-Expose-Headers', 'Retry-After');
    result.headers.set('Access-Control-Max-Age', '600');
  }
  return result;
}

async function bodyJSON(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) throw new Error('format');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('format');
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error('size'); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

export async function reporterHash(deviceId) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`stone-observation:${deviceId.toLowerCase()}`));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function summary(db, now, siteKey) {
  const result = await db.prepare(`SELECT condition, COUNT(*) AS count, MAX(received_at) AS latest
    FROM observations WHERE received_at > ? AND received_at <= ? GROUP BY condition`)
    .bind(now - hourMs, now).all();
  if (!result.success || !Array.isArray(result.results)) throw new Error('database');
  const counts = [0, 0, 0, 0, 0];
  let latest = 0;
  for (const row of result.results) {
    if (!Number.isInteger(row.condition) || row.condition < 0 || row.condition > 4
      || !Number.isSafeInteger(row.count) || row.count < 1 || !Number.isSafeInteger(row.latest)) throw new Error('database');
    counts[row.condition] = row.count;
    latest = Math.max(latest, row.latest);
  }
  return { schemaVersion: 1, generatedAt: new Date(now).toISOString(), windowStart: new Date(now - hourMs).toISOString(),
    total: counts.reduce((a, b) => a + b, 0), counts, lastReportAt: latest ? new Date(latest).toISOString() : null, siteKey };
}

/** Server-side validation is mandatory. No request bodies or network identifiers are logged. */
async function verifyToken(body, env, origin, fetcher) {
  const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: body.token, idempotency_key: body.id }),
  });
  if (!response.ok) throw new Error('verification');
  const value = await response.json();
  return value.success === true && (env.LOCAL_DEVELOPMENT === 'true'
    || (value.hostname === new URL(origin).hostname && value.action === 'stone_observation'));
}

export function createReportsWorker({ now = Date.now, fetcher = fetch, cache } = {}) {
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const origin = request.headers.get('Origin');
      const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim());
      const permittedOrigin = origin && allowed.includes(origin) ? origin : undefined;
      if (origin && !permittedOrigin) return json({ error: 'origin' }, 403);
      const respond = (value, status = 200, headers) => cors(json(value, status, headers), permittedOrigin);
      if (url.pathname !== route) return respond({ error: 'not-found' }, 404);
      if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), permittedOrigin);
      if (!['GET', 'POST'].includes(request.method)) return respond({ error: 'method' }, 405, { Allow: 'GET, POST, OPTIONS' });
      if (request.method === 'POST' && !permittedOrigin) return respond({ error: 'origin' }, 403);
      const local = env.LOCAL_DEVELOPMENT === 'true';
      if (!env.REPORTS || !env.SUBMISSIONS || !env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY
        || (!local && (/^[123]x0/.test(env.TURNSTILE_SECRET_KEY) || /^[123]x0/.test(env.TURNSTILE_SITE_KEY)))) {
        return respond({ error: 'unavailable' }, 503);
      }
      const edgeCache = cache ?? globalThis.caches?.default;
      const cacheKey = new Request(`${url.origin}${route}`);
      try {
        if (request.method === 'GET') {
          const saved = await edgeCache?.match(cacheKey);
          if (saved) return cors(saved, permittedOrigin);
          const value = await summary(env.REPORTS, now(), env.TURNSTILE_SITE_KEY);
          if (edgeCache && ctx) {
            // Only public aggregates are cached. The browser revalidates on each refresh.
            ctx.waitUntil(edgeCache.put(cacheKey, json(value, 200, { 'Cache-Control': 'public, max-age=60' })).catch(() => {}));
          }
          return respond(value);
        }
        // A generous per-network burst limit supplements the database's atomic device cooldown.
        const limit = await env.SUBMISSIONS.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' });
        if (!limit.success) return respond({ error: 'rate-limit' }, 429, { 'Retry-After': '60' });
        let body;
        try { body = await bodyJSON(request); } catch (error) {
          return respond({ error: 'invalid-report' }, error.message === 'size' ? 413 : 400);
        }
        if (!body || Object.keys(body).sort().join(',') !== 'condition,deviceId,id,token'
          || !uuid.test(body.id) || !uuid.test(body.deviceId) || !Number.isInteger(body.condition)
          || body.condition < 0 || body.condition > 4 || typeof body.token !== 'string' || body.token.length < 1 || body.token.length > 2048) {
          return respond({ error: 'invalid-report' }, 400);
        }
        const hash = await reporterHash(body.deviceId);
        const id = body.id.toLowerCase();
        // Idempotent retries can recover a saved report even when its Turnstile token has expired.
        const previous = await env.REPORTS.prepare('SELECT condition, reporter_hash, received_at FROM observations WHERE id = ?').bind(id).first();
        if (previous) {
          if (previous.reporter_hash !== hash || previous.condition !== body.condition) return respond({ error: 'conflict' }, 409);
          return respond({ ok: true, duplicate: true, receivedAt: new Date(previous.received_at).toISOString(),
            nextAllowedAt: new Date(previous.received_at + cooldownMs).toISOString() });
        }
        if (!await verifyToken(body, env, permittedOrigin, fetcher)) return respond({ error: 'verification' }, 403);
        const received = now();
        // One SQL statement makes the cooldown atomic across simultaneous submissions and locations.
        const result = await env.REPORTS.prepare(`INSERT INTO observations (id, condition, received_at, reporter_hash)
          SELECT ?, ?, ?, ? WHERE NOT EXISTS
          (SELECT 1 FROM observations WHERE reporter_hash = ? AND received_at > ?)
          ON CONFLICT(id) DO NOTHING RETURNING id`)
          .bind(id, body.condition, received, hash, hash, received - cooldownMs).all();
        if (!result.success) throw new Error('database');
        if (!result.results?.length) {
          const latest = await env.REPORTS.prepare('SELECT id, condition, received_at FROM observations WHERE reporter_hash = ? ORDER BY received_at DESC LIMIT 1').bind(hash).first();
          if (latest?.id === id && latest.condition === body.condition) {
            return respond({ ok: true, duplicate: true, receivedAt: new Date(latest.received_at).toISOString(),
              nextAllowedAt: new Date(latest.received_at + cooldownMs).toISOString() });
          }
          const retry = Math.max(1, Math.ceil(((latest?.received_at || received) + cooldownMs - received) / 1000));
          return respond({ error: 'cooldown' }, 429, { 'Retry-After': String(retry) });
        }
        if (edgeCache) await edgeCache.delete(cacheKey).catch(() => {});
        return respond({ ok: true, duplicate: false, receivedAt: new Date(received).toISOString(), nextAllowedAt: new Date(received + cooldownMs).toISOString() }, 201);
      } catch {
        // Provider errors and exhausted quotas must never be represented as zero reports or success.
        return respond({ error: 'unavailable' }, 503);
      }
    },
    async scheduled(_event, env) {
      // Bounded maintenance; no environmental data or other database is touched.
      const result = await env.REPORTS.prepare(`DELETE FROM observations WHERE id IN
        (SELECT id FROM observations WHERE received_at < ? ORDER BY received_at LIMIT 1000)`)
        .bind(now() - retentionMs).run();
      if (!result.success) throw new Error('Observation retention cleanup failed.');
    },
  };
}
