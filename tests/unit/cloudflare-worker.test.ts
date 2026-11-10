import { refreshModelSnapshot, refreshMonitoringSnapshot, serveSnapshot, snapshotKey, monitoringKey } from '../../workers/data-refresh/src/service.mjs';
import { monitoringFixture, warningFixture } from '../fixtures/monitoring';
import config from '../../public/data/config.json';

const now = new Date('2026-11-08T08:00:00Z');
const earlier = '2026-11-08T07:30:00Z';
function initial() {
  return { schemaVersion: 1, refreshedAt: earlier, config,
    live: { generatedAt: earlier, current: { state: 'Likely Passable' } },
    forecast: { generatedAt: earlier, hours: [] }, monitoring: monitoringFixture(now.getTime()) };
}
function monitorRecord() { return { schemaVersion: 1, refreshedAt: earlier, monitoring: monitoringFixture(now.getTime()) }; }
function environment(model: unknown = null, monitoring: unknown = null) {
  const records = new Map([[snapshotKey, structuredClone(model)], [monitoringKey, structuredClone(monitoring)]]);
  return { ALLOWED_ORIGINS: 'https://smcqueen2.github.io', NRW_API_KEY: 'fixture-only-private-key', records, SNAPSHOTS: {
    get: vi.fn(async (key: string) => structuredClone(records.get(key) ?? null)),
    put: vi.fn(async (key: string, body: string) => { records.set(key, JSON.parse(body)); }),
  } };
}
const request = () => new Request('https://test.workers.dev/data/snapshot.json', { headers: { Origin: 'https://smcqueen2.github.io' } });
beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('writes only the model record, preserving legacy warning timestamps and never serialising credentials', async () => {
  const old = initial(); const env = environment(old, monitorRecord());
  const model = vi.fn().mockResolvedValue({ live: { generatedAt: now.toISOString() }, forecast: { hours: ['new'] } });
  await refreshModelSnapshot(env, { now, model });
  expect(env.SNAPSHOTS.put).toHaveBeenCalledTimes(1);
  expect(env.SNAPSHOTS.put.mock.calls[0][0]).toBe(snapshotKey);
  const published = JSON.parse(env.SNAPSHOTS.put.mock.calls[0][1]);
  expect(published.refreshedAt).toBe(now.toISOString());
  expect(published.forecast.hours).toEqual(['new']);
  expect(published.monitoring).toEqual(old.monitoring);
  expect(env.records.get(monitoringKey)).toEqual(monitorRecord());
  expect(JSON.stringify(published)).not.toContain(env.NRW_API_KEY);
});

it('writes only the monitoring record and restores the last warning from its own prior snapshot', async () => {
  const previous = monitorRecord(); const old = initial(); const env = environment(old, previous);
  const monitoring = vi.fn().mockResolvedValue(monitoringFixture(now.getTime()));
  await refreshMonitoringSnapshot(env, { now, monitoring });
  expect(monitoring).toHaveBeenCalledWith({ key: env.NRW_API_KEY, previous: previous.monitoring.floodWarnings, now });
  expect(env.SNAPSHOTS.put.mock.calls[0][0]).toBe(monitoringKey);
  expect(env.records.get(snapshotKey)).toEqual(old);
  expect(env.SNAPSHOTS.get).toHaveBeenCalledTimes(1);
});

it('migrates the existing combined warning cache when no separate monitoring record exists', async () => {
  const old = initial(); const env = environment(old);
  const monitoring = vi.fn().mockResolvedValue(old.monitoring);
  await refreshMonitoringSnapshot(env, { now, monitoring });
  expect(monitoring).toHaveBeenCalledWith({ key: env.NRW_API_KEY, previous: old.monitoring.floodWarnings, now });
  expect(env.SNAPSHOTS.get.mock.calls.map(call => call[0])).toEqual([monitoringKey, snapshotKey]);
  expect(env.records.get(snapshotKey)).toEqual(old);
});

it('publishes a new warning even when the independent model job fails, without refreshing old model clocks/config', async () => {
  const old = initial(); old.config = { ...config, weights: { tide: .5, river: .3, rain: .2 } };
  const env = environment(old, monitorRecord()); const monitoring = monitoringFixture(now.getTime());
  monitoring.floodWarnings = { status: 'available', attemptedAt: now.toISOString(), checkedAt: now.toISOString(), warnings: [warningFixture(now.getTime())] };
  await expect(refreshModelSnapshot(env, { now, model: vi.fn().mockRejectedValue(new Error('gauge down')) })).rejects.toThrow('gauge down');
  await refreshMonitoringSnapshot(env, { now, monitoring: vi.fn().mockResolvedValue(monitoring) });
  const result = await (await serveSnapshot(request(), env)).json();
  expect(result.live).toEqual(old.live); expect(result.forecast).toEqual(old.forecast); expect(result.config).toEqual(old.config);
  expect(result.monitoring.floodWarnings.warnings[0].severity).toBe(2);
  expect(result.refreshedAt).toBe(now.toISOString());
});

it('keeps the previous monitoring and warning clocks when monitoring fails while the model updates', async () => {
  const previous = monitorRecord(); const env = environment(initial(), previous);
  await expect(refreshMonitoringSnapshot(env, { now, monitoring: vi.fn().mockRejectedValue(new Error('monitoring down')) })).rejects.toThrow('monitoring down');
  await refreshModelSnapshot(env, { now, model: vi.fn().mockResolvedValue({ live: { generatedAt: now.toISOString() }, forecast: { hours: [] } }) });
  const result = await (await serveSnapshot(request(), env)).json();
  expect(result.monitoring).toEqual(previous.monitoring);
  expect(result.refreshedAt).toBe(now.toISOString());
});

it('does not overwrite data or advance clocks if both independent jobs fail', async () => {
  const old = initial(); const previous = monitorRecord(); const env = environment(old, previous);
  await expect(refreshModelSnapshot(env, { now, model: vi.fn().mockRejectedValue(new Error('down')) })).rejects.toThrow('down');
  await expect(refreshMonitoringSnapshot(env, { now, monitoring: vi.fn().mockRejectedValue(new Error('down')) })).rejects.toThrow('down');
  expect(env.SNAPSHOTS.put).not.toHaveBeenCalled();
  expect(env.records.get(snapshotKey)).toEqual(old); expect(env.records.get(monitoringKey)).toEqual(previous);
});

it('aborts before fetching providers if prior storage cannot be verified or read', async () => {
  const env = environment(initial(), monitorRecord());
  env.SNAPSHOTS.get.mockRejectedValue(new Error('KV unavailable'));
  const model = vi.fn(); const monitoring = vi.fn();
  await expect(refreshModelSnapshot(env, { now, model })).rejects.toThrow('KV unavailable');
  await expect(refreshMonitoringSnapshot(env, { now, monitoring })).rejects.toThrow('KV unavailable');
  expect(model).not.toHaveBeenCalled(); expect(monitoring).not.toHaveBeenCalled(); expect(env.SNAPSHOTS.put).not.toHaveBeenCalled();
});

it('serves only explicit public fields with exact-origin CORS and no provider fetches on visits', async () => {
  const env = environment({ ...initial(), secret: 'not-a-public-field' }, { ...monitorRecord(), secret: 'not-a-public-field' });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const response = await serveSnapshot(request(), env);
  expect(response.status).toBe(200); expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://smcqueen2.github.io');
  expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(await response.text()).not.toContain('not-a-public-field');
  expect(fetcher).not.toHaveBeenCalled(); expect(env.SNAPSHOTS.get).toHaveBeenCalledTimes(2);
});

it('retains the legacy combined public payload while the monitoring job is first starting', async () => {
  const old = initial(); const env = environment(old);
  expect(await (await serveSnapshot(request(), env)).json()).toEqual(old);
});

it('can publish monitoring without a model, but returns unavailable when neither job has saved data', async () => {
  expect((await serveSnapshot(request(), environment())).status).toBe(503);
  const env = environment(null, monitorRecord()); const response = await serveSnapshot(request(), env);
  expect(response.status).toBe(200);
  const result = await response.json(); expect(result.monitoring).toEqual(monitorRecord().monitoring);
  expect(result.live).toBeUndefined(); expect(result.config).toEqual(config);
});

it('returns a generic unavailable response for unreadable or malformed records instead of assuming no warning', async () => {
  const env = environment(initial(), { schemaVersion: 1, refreshedAt: earlier, monitoring: {} });
  expect((await serveSnapshot(request(), env)).status).toBe(503);
  env.SNAPSHOTS.get.mockRejectedValueOnce(new Error('private internal detail'));
  const failed = await serveSnapshot(request(), env);
  expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('private internal detail');
});

it('rejects unapproved origins and public refresh/write paths, and supports HEAD/preflight', async () => {
  const env = environment(initial(), monitorRecord()); const url = 'https://test.workers.dev/data/snapshot.json';
  expect((await serveSnapshot(new Request(url, { headers: { Origin: 'https://unrelated.example' } }), env)).status).toBe(403);
  expect((await serveSnapshot(new Request(url, { method: 'POST' }), env)).status).toBe(405);
  expect((await serveSnapshot(new Request('https://test.workers.dev/__scheduled'), env)).status).toBe(404);
  expect(env.SNAPSHOTS.get).not.toHaveBeenCalled();
  const head = await serveSnapshot(new Request(url, { method: 'HEAD' }), env);
  expect(head.status).toBe(200); expect(await head.text()).toBe('');
  const options = await serveSnapshot(new Request(url, { method: 'OPTIONS', headers: { Origin: 'https://smcqueen2.github.io' } }), env);
  expect(options.status).toBe(204); expect(options.headers.get('Access-Control-Allow-Methods')).toBe('GET, HEAD, OPTIONS');
  expect(env.SNAPSHOTS.put).not.toHaveBeenCalled();
});
