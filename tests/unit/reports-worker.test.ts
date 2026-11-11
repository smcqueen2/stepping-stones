import { randomUUID } from 'node:crypto';
import { createReportsWorker, cooldownMs, hourMs, reporterHash } from '../../workers/reports/src/service.mjs';
import { reportsDatabase } from '../helpers/reports-db';

const origin = 'https://smcqueen2.github.io';
const time = Date.parse('2026-11-11T20:00:00Z');
let db: ReturnType<typeof reportsDatabase>;
let env: Record<string, any>;
let clock: number;
let provider: ReturnType<typeof vi.fn>;
let worker: ReturnType<typeof createReportsWorker>;
const report = () => ({ id: randomUUID(), deviceId: randomUUID(), condition: 2, token: 'fixture-token' });
const post = (body: unknown, headers: Record<string, string> = {}) => worker.fetch(new Request('https://reports.example/api/reports', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
}), env);
const get = () => worker.fetch(new Request('https://reports.example/api/reports', { headers: { Origin: origin } }), env);
beforeEach(() => {
  db = reportsDatabase(); clock = time;
  env = { REPORTS: db, SUBMISSIONS: { limit: vi.fn().mockResolvedValue({ success: true }) }, ALLOWED_ORIGINS: origin,
    TURNSTILE_SITE_KEY: '0x4AAAAAAA-realistic-public-fixture', TURNSTILE_SECRET_KEY: 'not-a-real-secret' };
  provider = vi.fn().mockImplementation(async () => Response.json({ success: true, hostname: 'smcqueen2.github.io', action: 'stone_observation' }));
  worker = createReportsWorker({ now: () => clock, fetcher: provider });
});
afterEach(() => db.sqlite.close());

it('stores all five conditions with server receipt time and exposes only recent aggregate counts', async () => {
  for (let condition = 0; condition < 5; condition++) expect((await post({ ...report(), condition })).status).toBe(201);
  const summary = await (await get()).json();
  expect(summary.counts).toEqual([1, 1, 1, 1, 1]);
  expect(summary.total).toBe(5);
  expect(summary.lastReportAt).toBe(new Date(time).toISOString());
  expect(Object.keys(summary).sort()).toEqual(['counts', 'generatedAt', 'lastReportAt', 'schemaVersion', 'siteKey', 'total', 'windowStart']);
  clock += hourMs;
  expect((await (await get()).json()).total).toBe(0);
});

it('makes retries idempotent, including an expired verification token', async () => {
  const body = report();
  expect((await post(body)).status).toBe(201);
  provider.mockImplementation(async () => Response.json({ success: false }));
  const retry = await post(body);
  expect(retry.status).toBe(200);
  expect((await retry.json()).duplicate).toBe(true);
  expect(provider).toHaveBeenCalledTimes(1);
  expect((await (await get()).json()).total).toBe(1);
  expect((await post({ ...body, condition: 4 })).status).toBe(409);
});

it('enforces an atomic rolling device cooldown and allows a new report at the boundary', async () => {
  const body = report();
  const responses = await Promise.all([0, 1, 2].map(condition => post({ ...body, id: randomUUID(), condition })));
  expect(responses.filter(response => response.status === 201)).toHaveLength(1);
  expect(responses.filter(response => response.status === 429)).toHaveLength(2);
  expect(responses.find(response => response.status === 429)!.headers.get('Retry-After')).toBe('900');
  clock += cooldownMs;
  expect((await post({ ...body, id: randomUUID() })).status).toBe(201);
});

it.each([-1, 5, 2.2, '2', null])('rejects invalid condition %s without calling the provider', async condition => {
  expect((await post({ ...report(), condition })).status).toBe(400);
  expect(provider).not.toHaveBeenCalled();
});

it('rejects extra fields, client dates, missing identifiers, large bodies and incorrect content types', async () => {
  expect((await post({ ...report(), observedAt: '2020-01-01' })).status).toBe(400);
  expect((await post({ ...report(), deviceId: '' })).status).toBe(400);
  expect((await post({ ...report(), token: 'x'.repeat(5000) })).status).toBe(413);
  expect((await post(report(), { 'Content-Type': 'text/plain' })).status).toBe(400);
  expect(provider).not.toHaveBeenCalled();
});

it.each([{ success: false }, { success: true, hostname: 'other.example', action: 'stone_observation' },
  { success: true, hostname: 'smcqueen2.github.io', action: 'other' }])('rejects invalid verification without saving a report', async result => {
  provider.mockImplementation(async () => Response.json(result));
  expect((await post(report())).status).toBe(403);
  expect((await (await get()).json()).total).toBe(0);
});

it('treats provider failures, database errors and quota exhaustion as unavailable', async () => {
  provider.mockRejectedValue(new Error('private-provider-detail'));
  const response = await post(report());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'unavailable' });
  env.REPORTS = { prepare: () => { throw new Error('quota'); } };
  const failed = await get();
  expect(failed.status).toBe(503);
  expect(await failed.json()).not.toHaveProperty('total');
});

it('fails closed on missing setup or production test keys and rejects unrelated origins/methods', async () => {
  expect((await post(report(), { Origin: 'https://other.example' })).status).toBe(403);
  expect((await worker.fetch(new Request('https://reports.example/api/reports', { method: 'POST' }), env)).status).toBe(403);
  expect((await worker.fetch(new Request('https://reports.example/api/reports', { method: 'DELETE' }), env)).status).toBe(405);
  expect((await worker.fetch(new Request('https://reports.example/__scheduled'), env)).status).toBe(404);
  delete env.TURNSTILE_SECRET_KEY;
  expect((await get()).status).toBe(503);
  env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
  expect((await get()).status).toBe(503);
});

it('honours network burst limits before body processing and never logs or stores raw device/IP identifiers', async () => {
  env.SUBMISSIONS.limit.mockResolvedValue({ success: false });
  expect((await post(report())).status).toBe(429);
  expect(provider).not.toHaveBeenCalled();
  env.SUBMISSIONS.limit.mockResolvedValue({ success: true });
  const body = report(); await post(body);
  const row = db.sqlite.prepare('SELECT * FROM observations').get()!;
  expect(row.reporter_hash).toBe(await reporterHash(body.deviceId));
  expect(JSON.stringify(row)).not.toContain(body.deviceId);
});

it('removes only expired reports during bounded retention cleanup', async () => {
  await post(report());
  clock += 91 * 24 * hourMs;
  await post(report());
  await worker.scheduled({}, env);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM observations').get()!.count).toBe(1);
});
