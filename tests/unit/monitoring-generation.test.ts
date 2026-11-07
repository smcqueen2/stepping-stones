import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import feed from '../fixtures/nrw-warning-feed.json';
import { generateMonitoringData } from '../../scripts/generate-monitoring.mjs';
import { generateAllData } from '../../scripts/generate-all-data.mjs';

const now = new Date('2026-11-07T12:00:00Z');
let directory: string;
beforeEach(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'stepping-stones-monitoring-')); });
afterEach(async () => {
  const allowed = path.join(os.tmpdir(), 'stepping-stones-monitoring-');
  if (!path.resolve(directory).startsWith(allowed)) throw new Error('Unexpected test directory');
  await fs.rm(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

it('publishes and caches warnings when both gauge requests fail, preserving source timestamps and excluding keys', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const cachePath = path.join(directory, 'cache/warnings.json');
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('/floodwarnings/')) return new Response(JSON.stringify(feed));
    throw new Error('gauge down');
  });
  const result = await generateMonitoringData({ outDir: directory, cachePath, key: 'fixture-secret', now, fetcher });
  expect(result.gauges.ewenny.status).toBe('unavailable');
  expect(result.gauges.downstream.status).toBe('unavailable');
  expect(result.floodWarnings.status).toBe('available');
  const cache = JSON.parse(await fs.readFile(cachePath, 'utf8'));
  expect(cache.checkedAt).toBe(now.toISOString());
  const out = await fs.readFile(path.join(directory, 'monitoring.json'), 'utf8');
  expect(out).not.toContain('fixture-secret');
  const later = new Date(now.getTime() + 15 * 60000);
  const failure = vi.fn().mockRejectedValue(new Error('failure'));
  const failed = await generateMonitoringData({ outDir: directory, cachePath, key: 'fixture-secret', now: later, fetcher: failure });
  expect(failed.floodWarnings).toMatchObject({ status: 'unavailable', lastKnown: { checkedAt: now.toISOString() } });
  expect(JSON.parse(await fs.readFile(cachePath, 'utf8')).checkedAt).toBe(now.toISOString());
});

it('runs the model and monitoring independently, and fails the overall build only if neither can publish', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const monitoring = vi.fn().mockResolvedValue(undefined);
  expect(await generateAllData({ model: vi.fn().mockRejectedValue(new Error('model')), monitoring })).toBe(true);
  expect(monitoring).toHaveBeenCalledOnce();
  expect(await generateAllData({ model: vi.fn().mockResolvedValue(undefined), monitoring: vi.fn().mockRejectedValue(new Error('monitoring')) })).toBe(true);
  expect(await generateAllData({ model: vi.fn().mockRejectedValue(new Error('model')), monitoring: vi.fn().mockRejectedValue(new Error('monitoring')) })).toBe(false);
});
