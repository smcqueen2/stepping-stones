import { generateModelData } from './generate-data.mjs';
import { generateMonitoringData } from './generate-monitoring.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Independent feeds: a failed forecast must not prevent publication of an official warning.
export async function generateAllData({ model = generateModelData, monitoring = generateMonitoringData } = {}) {
  const results = await Promise.allSettled([Promise.resolve().then(model), Promise.resolve().then(monitoring)]);
  if (results[0].status === 'rejected') console.warn('Model update unavailable; existing model timestamps are retained and will expire normally.');
  if (results[1].status === 'rejected') console.warn('Local monitoring update unavailable; existing warning timestamps must not be treated as a new check.');
  return results.some(result => result.status === 'fulfilled');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await generateAllData() ? 0 : 1;
}
