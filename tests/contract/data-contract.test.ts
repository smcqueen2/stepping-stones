import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readJson(relativePath: string) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf-8'));
}

describe('data contracts', () => {
  it('config exposes required knobs', () => {
    const config = readJson('public/data/config.json');

    expect(config.stateThresholds.likelyPassableMax).toBeTypeOf('number');
    expect(config.stateThresholds.cautionMax).toBeTypeOf('number');
    expect(config.weights.tide + config.weights.river + config.weights.rain).toBeCloseTo(1, 3);
  });

  it('live payload includes required fields and valid state label', () => {
    const live = readJson('public/data/live.json');

    expect(typeof live.generatedAt).toBe('string');
    expect(Array.isArray(live.sourceStations)).toBe(true);
    expect(['Likely Passable', 'Caution', 'Likely Unpassable']).toContain(live.current.state);
    expect(typeof live.shortHorizonPrediction.horizonMinutes).toBe('number');
  });

  it('forecast payload includes hourly rows and valid states', () => {
    const forecast = readJson('public/data/forecast.json');

    expect(Array.isArray(forecast.hours)).toBe(true);
    expect(forecast.hours.length).toBeGreaterThan(0);

    for (const hour of forecast.hours) {
      expect(typeof hour.timestamp).toBe('string');
      expect(typeof hour.riskScore).toBe('number');
      expect(['Likely Passable', 'Caution', 'Likely Unpassable']).toContain(hour.state);
    }
  });
});
