import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(path.join(root, 'index.html'), 'utf-8');

describe('single-page structure contract', () => {
  it('contains all required section anchors', () => {
    for (const id of ['live', 'forecast', 'history', 'about', 'report']) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('contains jump links for section navigation', () => {
    for (const hash of ['#live', '#forecast', '#history', '#about', '#report']) {
      expect(html).toContain(`href="${hash}"`);
    }
  });

  it('contains public observation form controls', () => {
    expect(html).toContain('id="observation-form"');
    expect(html).toContain('name="observed_state"');
    expect(html).toContain('name="observations[]"');
    expect(html).toContain('id="observation-submit"');
  });
});
