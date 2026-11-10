import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identifier } from './prepare-ci-config.mjs';

export function checkWarningSecretPlacement(model, monitoring) {
  if (!Array.isArray(model?.bindings) || !Array.isArray(monitoring?.bindings)) throw new Error('Worker bindings could not be verified.');
  const hasKey = settings => settings.bindings.some(binding => binding.name === 'NRW_API_KEY' && binding.type === 'secret_text');
  if (hasKey(model) && !hasKey(monitoring)) {
    throw new Error('Before deploying the model Worker, configure NRW_API_KEY privately on stepping-stones-monitoring. Secret values cannot be migrated through the API.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const account = identifier(process.env.CLOUDFLARE_ACCOUNT_ID, 'CLOUDFLARE_ACCOUNT_ID');
    const settings = await Promise.all(['stepping-stones-data', 'stepping-stones-monitoring'].map(async name => {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${name}/settings`, {
        redirect: 'error', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
      });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error('Could not verify warning-secret placement; existing model deployment retained.');
      return data.result;
    }));
    checkWarningSecretPlacement(...settings);
    console.log('Warning-secret placement checked using binding names only.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
