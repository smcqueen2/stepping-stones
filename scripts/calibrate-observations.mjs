import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyState } from './lib/forecast-model.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const observationsPath = process.argv[2] || path.join(rootDir, 'data/observations.json');
const configPath = path.join(rootDir, 'public/data/config.json');

function statePenalty(predicted, observed) {
  if (predicted === observed) return 0;
  if (
    (predicted === 'Likely Passable' && observed === 'Likely Unpassable') ||
    (predicted === 'Likely Unpassable' && observed === 'Likely Passable')
  ) {
    return 2;
  }
  return 1;
}

async function main() {
  const [configText, observationsText] = await Promise.all([
    fs.readFile(configPath, 'utf-8'),
    fs.readFile(observationsPath, 'utf-8'),
  ]);

  const config = JSON.parse(configText);
  const observations = JSON.parse(observationsText);

  const validRows = observations.filter(
    (row) =>
      Number.isFinite(row.riskScoreAtTime) &&
      ['Likely Passable', 'Caution', 'Likely Unpassable'].includes(row.observedState),
  );

  if (!validRows.length) {
    console.log('No valid observations. Expect rows with riskScoreAtTime and observedState.');
    return;
  }

  let best = {
    likelyPassableMax: config.stateThresholds.likelyPassableMax,
    cautionMax: config.stateThresholds.cautionMax,
    penalty: Number.POSITIVE_INFINITY,
  };

  for (let passable = 0.25; passable <= 0.65; passable += 0.01) {
    for (let caution = passable + 0.08; caution <= 0.9; caution += 0.01) {
      const thresholds = {
        likelyPassableMax: Number(passable.toFixed(2)),
        cautionMax: Number(caution.toFixed(2)),
      };

      const penalty = validRows.reduce((sum, row) => {
        const predicted = classifyState(row.riskScoreAtTime, thresholds);
        return sum + statePenalty(predicted, row.observedState);
      }, 0);

      if (penalty < best.penalty) {
        best = { ...thresholds, penalty };
      }
    }
  }

  console.log('Observation rows considered:', validRows.length);
  console.log('Current thresholds:', config.stateThresholds);
  console.log('Suggested thresholds:', {
    likelyPassableMax: best.likelyPassableMax,
    cautionMax: best.cautionMax,
  });
  console.log('Penalty score (lower is better):', best.penalty);
}

main().catch((error) => {
  console.error('Calibration failed:', error);
  process.exitCode = 1;
});
