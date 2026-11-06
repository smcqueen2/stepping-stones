import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(path.join(root, 'index.html'), 'utf-8');

describe('single-page structure contract', () => {
  it('keeps readings, forecast and reporting in addressable dialogs', () => {
    for (const id of ['live', 'forecast', 'report']) {
      expect(html).toContain(`<dialog id="${id}"`);
    }
    for (const id of ['history', 'about']) {
      expect(html).not.toContain(`<dialog id="${id}"`);
      expect(html).toContain(`data-page-view="${id}"`);
    }
  });

  it('contains jump links for section navigation', () => {
    for (const hash of ['#live', '#forecast', '#history', '#about', '#report']) {
      expect(html).toContain(`href="${hash}"`);
    }
  });

  it('contains public observation form controls', () => {
    expect(html).toContain('id="observation-form"');
    expect(html).toContain('id="report-condition" name="condition" type="range"');
    expect(html).toContain('id="community-count"');
    expect(html).not.toContain('datetime-local');
    expect(html).toContain('id="observation-submit"');
  });
});
