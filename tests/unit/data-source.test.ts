import { dataEndpoint, loadData } from '../../src/lib/data-source';
import { monitoringFixture } from '../fixtures/monitoring';
import config from '../../public/data/config.json';

const endpoint = 'https://stepping-stones-data.example.workers.dev/data/snapshot.json';
const signal = new AbortController().signal;
const parts = () => ({ live: { freshness: {}, current: {}, sourceStations: [] }, forecast: { hours: [] }, config, monitoring: monitoringFixture(Date.now()) });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

it('keeps the existing four static files when no Worker endpoint is selected', async () => {
  const data = parts();
  const fetcher = vi.fn(async (url: RequestInfo | URL) => response(data[String(url).split('/').at(-1)!.replace('.json', '') as keyof typeof data]));
  const result = await loadData({ base: '/stepping-stones/data/', signal, fetcher });
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(fetcher.mock.calls.map(call => String(call[0]))).toEqual(['live', 'forecast', 'config', 'monitoring'].map(name => `/stepping-stones/data/${name}.json`));
  expect(Object.values(result).every(part => part.status === 'fulfilled')).toBe(true);
});

it('loads all four parts from one Worker request and preserves their individual timestamps', async () => {
  const data = parts(); const snapshot = { schemaVersion: 1, refreshedAt: new Date().toISOString(), ...data };
  const fetcher = vi.fn().mockResolvedValue(response(snapshot));
  const result = await loadData({ base: '/data/', endpoint, signal, fetcher });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledWith(endpoint, { cache: 'no-store', signal, credentials: 'omit' });
  expect(result.monitoring).toEqual({ status: 'fulfilled', value: data.monitoring });
});

it('keeps independent monitoring usable when the Worker has no model yet', async () => {
  const data = parts();
  const fetcher = vi.fn().mockResolvedValue(response({ schemaVersion: 1, refreshedAt: new Date().toISOString(), config, monitoring: data.monitoring }));
  const result = await loadData({ base: '/data/', endpoint, signal, fetcher });
  expect(result.live.status).toBe('rejected'); expect(result.forecast.status).toBe('rejected');
  expect(result.monitoring.status).toBe('fulfilled');
});

it('does not silently fall back to older Pages data when the selected Worker fails', async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ error: 'not ready' }, 503));
  await expect(loadData({ base: '/data/', endpoint, signal, fetcher })).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledOnce();
});

it('rejects invalid/future snapshots and malformed parts instead of manufacturing valid status', async () => {
  for (const body of [{}, { schemaVersion: 2, refreshedAt: new Date().toISOString() },
    { schemaVersion: 1, refreshedAt: new Date(Date.now() + 3600000).toISOString(), ...parts() }]) {
    await expect(loadData({ base: '/data/', endpoint, signal, fetcher: vi.fn().mockResolvedValue(response(body)) })).rejects.toThrow();
  }
  const result = await loadData({ base: '/data/', endpoint, signal,
    fetcher: vi.fn().mockResolvedValue(response({ schemaVersion: 1, refreshedAt: new Date().toISOString(), ...parts(), monitoring: {} })) });
  expect(result.monitoring.status).toBe('rejected'); expect(result.live.status).toBe('fulfilled');
});

it('reports an independent static-file failure while preserving successful files', async () => {
  const data = parts();
  const fetcher = vi.fn(async (url: RequestInfo | URL) => String(url).includes('monitoring') ? response({}, 500)
    : response(data[String(url).split('/').at(-1)!.replace('.json', '') as keyof typeof data]));
  const result = await loadData({ base: '/data/', signal, fetcher });
  expect(result.monitoring.status).toBe('rejected'); expect(result.live.status).toBe('fulfilled');
});

it('allows blank/default, HTTPS and loopback development URLs while rejecting credential/query/HTTP mistakes', () => {
  expect(dataEndpoint('')).toBeUndefined();
  expect(dataEndpoint(endpoint)).toBe(endpoint);
  expect(dataEndpoint('http://127.0.0.1:8787/data/snapshot.json')).toContain('127.0.0.1');
  for (const value of ['http://remote.example/data/snapshot.json', 'https://user:secret@example.com/data/snapshot.json',
    endpoint + '?key=secret', endpoint + '#secret', 'https://example.com/data/live.json', 'not-a-url']) {
    expect(() => dataEndpoint(value)).toThrow();
  }
});
