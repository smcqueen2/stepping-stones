import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMonitoringData } from './lib/monitoring-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function generateMonitoringData({ outDir = path.resolve(root, process.env.DATA_OUT_DIR || 'public/data'),
  cachePath = path.join(root, '.cache/nrw-warnings.json'), key = process.env.NRW_API_KEY, now = new Date(), fetcher = fetch } = {}) {
  let previous;
  try { previous = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch { /* No successful warning response cached. */ }
  const payload = await buildMonitoringData({ key, previous, now, fetcher });
  const { gauges: { ewenny, downstream }, floodWarnings } = payload;
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'monitoring.json'), `${JSON.stringify(payload, null, 2)}\n`);
  if (floodWarnings.status === 'available') {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, `${JSON.stringify(floodWarnings)}\n`);
  }
  console.log(`Local NRW gauges: Ewenny ${ewenny.status}, Penybont ${downstream.status}. Warnings: ${floodWarnings.status}${floodWarnings.reason ? ` (${floodWarnings.reason})` : ''}.`);
  return payload;
}
