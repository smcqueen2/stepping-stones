import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../wrangler.json', import.meta.url), 'utf8'));
const id = config.kv_namespaces?.find(binding => binding.binding === 'SNAPSHOTS')?.id;
if (typeof id !== 'string' || !/^[a-f0-9]{32}$/i.test(id) || /^0+$/.test(id)) {
  console.error('Deployment is not configured: create a Workers KV namespace and replace the placeholder SNAPSHOTS ID in wrangler.json.');
  process.exitCode = 1;
}
