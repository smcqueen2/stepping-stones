import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../data-refresh/package.json', import.meta.url));
const { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = require('miniflare');
const origin = 'https://smcqueen2.github.io';
const mf = new Miniflare(convertV4MiniflareOptions({ log: new Log(LogLevel.ERROR),
  modules: ['index.mjs', 'service.mjs'].map(name => ({ type: 'ESModule', path: fileURLToPath(new URL(`../src/${name}`, import.meta.url)) })),
  compatibilityDate: '2026-11-01',
  d1Databases: ['REPORTS'],
  ratelimits: { SUBMISSIONS: { namespace_id: '517311', simple: { limit: 20, period: 60 } } },
  bindings: { ALLOWED_ORIGINS: origin, TURNSTILE_SITE_KEY: '0x4AAAAAAA-integration-fixture', TURNSTILE_SECRET_KEY: 'integration-fixture-only' },
  // Local provider fixture; no real observation, credential, or Cloudflare resource is used.
  outboundService: async request => {
    assert.equal(request.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    return Response.json({ success: true, hostname: 'smcqueen2.github.io', action: 'stone_observation' });
  },
}));
const url = 'http://reports.test/api/reports';
const post = value => mf.dispatchFetch(url, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
try {
  const db = await mf.getD1Database('REPORTS');
  const migration = await readFile(new URL('../migrations/0001_observations.sql', import.meta.url), 'utf8');
  for (const statement of migration.split(';').filter(value => value.trim())) await db.prepare(statement).run();
  const initial = await mf.dispatchFetch(url, { headers: { Origin: origin } });
  assert.equal(initial.status, 200);
  assert.equal((await initial.json()).total, 0);
  const report = { id: randomUUID(), deviceId: randomUUID(), condition: 2, token: 'fixture-token' };
  assert.equal((await post(report)).status, 201);
  const retry = await post(report);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).duplicate, true);
  const blocked = await post({ ...report, id: randomUUID() });
  assert.equal(blocked.status, 429);
  const deviceId = randomUUID();
  const concurrent = await Promise.all([0, 1, 2].map(condition => post({ ...report, id: randomUUID(), deviceId, condition })));
  assert.equal(concurrent.filter(response => response.status === 201).length, 1);
  assert.equal(concurrent.filter(response => response.status === 429).length, 2);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM observations').first()).count, 2);
  const stored = await db.prepare('SELECT reporter_hash FROM observations LIMIT 1').first();
  assert.match(stored.reporter_hash, /^[a-f0-9]{64}$/);
  const summary = await (await mf.dispatchFetch(url, { headers: { Origin: origin } })).json();
  assert.equal(summary.total, 2);
  assert.equal(summary.counts.reduce((sum, count) => sum + count, 0), 2);
  assert.equal(JSON.stringify(summary).includes(stored.reporter_hash), false);
  assert.equal((await mf.dispatchFetch(url, { method: 'POST', headers: { Origin: 'https://unrelated.example' } })).status, 403);
  console.log('Local Workers/D1 integration passed: persistence, atomic cooldown, concurrent writes, idempotent retry, summary and origin checks.');
} finally { await mf.dispose(); }
