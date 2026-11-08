import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModelData } from './lib/model-data.mjs';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
export async function generateModelData() {
  const dataOutDir = path.resolve(rootDir, process.env.DATA_OUT_DIR || 'public/data');
  const config = JSON.parse(await fs.readFile(path.join(rootDir, 'public/data/config.json'), 'utf8'));
  const { live, forecast } = await buildModelData({ config });
  await fs.mkdir(dataOutDir, { recursive: true });
  await fs.writeFile(path.join(dataOutDir, 'live.json'), `${JSON.stringify(live, null, 2)}\n`);
  await fs.writeFile(path.join(dataOutDir, 'forecast.json'), `${JSON.stringify(forecast, null, 2)}\n`);
  console.log(`Generated live + forecast data in ${dataOutDir}`);
  return { live, forecast };
}
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  generateModelData().catch(error => { console.error('Data generation failed:', error); process.exitCode = 1; });
}
