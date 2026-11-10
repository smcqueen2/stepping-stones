import { readFile } from 'node:fs/promises';

const configs = await Promise.all(['wrangler.json', 'wrangler.monitoring.json'].map(async name =>
  JSON.parse(await readFile(new URL(`../${name}`, import.meta.url), 'utf8'))));
const ids = configs.map(config => config.kv_namespaces?.find(binding => binding.binding === 'SNAPSHOTS')?.id);
if (ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{32}$/i.test(id) || /^0+$/.test(id)) || ids[0] !== ids[1]) {
  console.error('Deployment is not configured: set the same valid SNAPSHOTS namespace ID in both Wrangler source configurations.');
  process.exitCode = 1;
}
