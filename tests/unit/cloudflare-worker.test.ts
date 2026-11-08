import { refreshSnapshot, serveSnapshot, snapshotKey } from '../../workers/data-refresh/src/service.mjs';
import { monitoringFixture, warningFixture } from '../fixtures/monitoring';
import config from '../../public/data/config.json';

const now = new Date('2026-11-08T08:00:00Z');
const earlier = '2026-11-08T07:30:00Z';
function initial() {
  return { schemaVersion: 1, refreshedAt: earlier, config,
    live: { generatedAt: earlier, current: { state: 'Likely Passable' } },
    forecast: { generatedAt: earlier, hours: [] }, monitoring: monitoringFixture(now.getTime()) };
}
function environment(value: unknown = null) {
  let stored = structuredClone(value);
  return { ALLOWED_ORIGINS: 'https://smcqueen2.github.io', NRW_API_KEY: 'fixture-only-private-key', SNAPSHOTS: {
    get: vi.fn(async () => structuredClone(stored)),
    put: vi.fn(async (_key: string, body: string) => { stored = JSON.parse(body); }),
  } };
}
beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('publishes one snapshot while reusing the shared generators and keeping keys private', async () => {
  const old = initial(); const env = environment(old);
  const model = vi.fn().mockResolvedValue({ live: { generatedAt: now.toISOString() }, forecast: { hours: ['new'] } });
  const monitoring = vi.fn().mockResolvedValue(monitoringFixture(now.getTime()));
  await refreshSnapshot(env, { now, model, monitoring });
  expect(env.SNAPSHOTS.put).toHaveBeenCalledTimes(1);
  expect(env.SNAPSHOTS.put.mock.calls[0][0]).toBe(snapshotKey);
  const published = JSON.parse(env.SNAPSHOTS.put.mock.calls[0][1]);
  expect(published.refreshedAt).toBe(now.toISOString());
  expect(published.forecast.hours).toEqual(['new']);
  expect(monitoring).toHaveBeenCalledWith({ key: env.NRW_API_KEY, previous: old.monitoring.floodWarnings, now });
  expect(JSON.stringify(published)).not.toContain(env.NRW_API_KEY);
});

it('publishes new warning data even if the model fails, retaining old model timestamps/config', async () => {
  const old = initial(); old.config = { ...config, weights: { tide: .5, river: .3, rain: .2 } };
  const env = environment(old);
  const monitoring = monitoringFixture(now.getTime());
  monitoring.floodWarnings = { status: 'available', attemptedAt: now.toISOString(), checkedAt: now.toISOString(), warnings: [warningFixture(now.getTime())] };
  const result = await refreshSnapshot(env, { now, model: vi.fn().mockRejectedValue(new Error('gauge down')),
    monitoring: vi.fn().mockResolvedValue(monitoring) });
  expect(result.live).toEqual(old.live);
  expect(result.forecast).toEqual(old.forecast);
  expect(result.config).toEqual(old.config);
  expect(result.monitoring.floodWarnings.warnings[0].severity).toBe(2);
});

it('retains the previous monitoring timestamp/last warning on a monitoring pipeline failure', async () => {
  const old = initial(); const env = environment(old);
  const result = await refreshSnapshot(env, { now,
    model: vi.fn().mockResolvedValue({ live: { generatedAt: now.toISOString() }, forecast: { hours: [] } }),
    monitoring: vi.fn().mockRejectedValue(new Error('monitoring down')) });
  expect(result.monitoring).toEqual(old.monitoring);
  expect(result.refreshedAt).toBe(now.toISOString());
});

it('does not overwrite or refresh clocks if both pipelines fail, or if existing storage cannot be read', async () => {
  const env = environment(initial());
  const model = vi.fn().mockRejectedValue(new Error('down'));
  const monitoring = vi.fn().mockRejectedValue(new Error('down'));
  await expect(refreshSnapshot(env, { now, model, monitoring })).rejects.toThrow('No data pipeline');
  expect(env.SNAPSHOTS.put).not.toHaveBeenCalled();
  env.SNAPSHOTS.get.mockRejectedValueOnce(new Error('KV unavailable'));
  model.mockClear(); monitoring.mockClear();
  await expect(refreshSnapshot(env, { now, model, monitoring })).rejects.toThrow('KV unavailable');
  expect(model).not.toHaveBeenCalled(); expect(monitoring).not.toHaveBeenCalled();
});

it('serves only saved public fields with exact-origin CORS and never fetches providers on a visit', async () => {
  const env = environment({ ...initial(), secret: 'not-a-public-field' });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const response = await serveSnapshot(new Request('https://test.workers.dev/data/snapshot.json', { headers: { Origin: 'https://smcqueen2.github.io' } }), env);
  expect(response.status).toBe(200);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://smcqueen2.github.io');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.text()).not.toContain('not-a-public-field');
  expect(fetcher).not.toHaveBeenCalled();
  expect(env.SNAPSHOTS.get).toHaveBeenCalledTimes(1);
});

it('returns unavailable before the first refresh and when KV is unavailable', async () => {
  const env = environment(); const request = new Request('https://test.workers.dev/data/snapshot.json');
  expect((await serveSnapshot(request, env)).status).toBe(503);
  env.SNAPSHOTS.get.mockRejectedValueOnce(new Error('private internal detail'));
  const failed = await serveSnapshot(request, env);
  expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('private internal detail');
});

it('rejects unapproved origins and all public refresh/write paths, and supports HEAD/preflight', async () => {
  const env = environment(initial());
  const url = 'https://test.workers.dev/data/snapshot.json';
  expect((await serveSnapshot(new Request(url, { headers: { Origin: 'https://unrelated.example' } }), env)).status).toBe(403);
  expect((await serveSnapshot(new Request(url, { method: 'POST' }), env)).status).toBe(405);
  expect((await serveSnapshot(new Request('https://test.workers.dev/__scheduled'), env)).status).toBe(404);
  expect(env.SNAPSHOTS.get).not.toHaveBeenCalled();
  expect((await serveSnapshot(new Request(url, { method: 'HEAD' }), env)).status).toBe(200);
  expect(await (await serveSnapshot(new Request(url, { method: 'HEAD' }), env)).text()).toBe('');
  const options = await serveSnapshot(new Request(url, { method: 'OPTIONS', headers: { Origin: 'https://smcqueen2.github.io' } }), env);
  expect(options.status).toBe(204);
  expect(options.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS');
  expect(env.SNAPSHOTS.put).not.toHaveBeenCalled();
});
