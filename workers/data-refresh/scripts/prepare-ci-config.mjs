import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function identifier(value, name) {
  if (typeof value !== 'string' || !/^[a-f0-9]{32}$/i.test(value.trim()) || /^0+$/.test(value.trim())) {
    throw new Error(`Configure repository Actions variable ${name} with a valid Cloudflare identifier.`);
  }
  return value.trim().toLowerCase();
}

/** Copy only the public deployment IDs; never serialise a token or the environment. */
export function deploymentConfig(template, { accountId, namespaceId } = {}) {
  const account = identifier(accountId, 'CLOUDFLARE_ACCOUNT_ID');
  const namespace = identifier(namespaceId, 'CLOUDFLARE_KV_NAMESPACE_ID');
  if (template.kv_namespaces?.filter(binding => binding.binding === 'SNAPSHOTS').length !== 1) {
    throw new Error('Worker configuration must contain exactly one SNAPSHOTS binding.');
  }
  return { ...template, account_id: account,
    kv_namespaces: template.kv_namespaces.map(binding => binding.binding === 'SNAPSHOTS'
      ? { ...binding, id: namespace } : { ...binding }) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const configs = [];
    for (const stem of ['wrangler', 'wrangler.monitoring']) {
      const template = JSON.parse(await readFile(new URL(`../${stem}.json`, import.meta.url), 'utf8'));
      const config = deploymentConfig(template, { accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        namespaceId: process.env.CLOUDFLARE_KV_NAMESPACE_ID });
      configs.push({ target: new URL(`../${stem}.ci.json`, import.meta.url), config });
    }
    // Validate both before writing. Adjacent files preserve relative entrypoint paths.
    for (const { target, config } of configs) await writeFile(target, `${JSON.stringify(config, null, 2)}\n`);
    console.log('Prepared ignored CI configurations; source configurations unchanged.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
