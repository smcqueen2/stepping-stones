import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL_STATIONS, fetchLocalGauge } from './lib/local-monitoring.mjs';
import { fetchWarnings } from './lib/nrw-warnings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function generateMonitoringData({ outDir = path.resolve(root, process.env.DATA_OUT_DIR || 'public/data'),
  cachePath = path.join(root, '.cache/nrw-warnings.json'), key = process.env.NRW_API_KEY, now = new Date(), fetcher = fetch } = {}) {
  let previous;
  try { previous = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch { /* No successful warning response cached. */ }
  const fetchJson = async url => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'User-Agent': 'stepping-stones-data-generator/1.2' } });
    if (!response.ok) throw new Error('NRW gauge request failed');
    return response.json();
  };
  const [ewenny, downstream, floodWarnings] = await Promise.all([
    fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now),
    fetchLocalGauge(LOCAL_STATIONS.downstream, fetchJson, now),
    fetchWarnings({ key, previous, fetcher, now }),
  ]);
  const payload = { schemaVersion: 1, generatedAt: now.toISOString(), gauges: { ewenny, downstream }, floodWarnings };
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'monitoring.json'), `${JSON.stringify(payload, null, 2)}\n`);
  if (floodWarnings.status === 'available') {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, `${JSON.stringify(floodWarnings)}\n`);
  }
  console.log(`Local NRW gauges: Ewenny ${ewenny.status}, Penybont ${downstream.status}. Warnings: ${floodWarnings.status}${floodWarnings.reason ? ` (${floodWarnings.reason})` : ''}.`);
  return payload;
}
