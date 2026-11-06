// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { installCommunityReports } from '../../src/lib/community-reports';

const html = readFileSync(path.resolve('index.html'), 'utf8').match(/<body[^>]*>([\s\S]*)<\/body>/)![1];
let dispose: () => void;
const slider = () => document.querySelector<HTMLInputElement>('#report-condition')!;
const button = () => document.querySelector<HTMLButtonElement>('#observation-submit')!;
const status = () => document.getElementById('observation-status')!;
beforeEach(() => {
  document.body.innerHTML = html;
  vi.stubGlobal('fetch', vi.fn());
  dispose = installCommunityReports();
});
afterEach(() => { dispose(); vi.unstubAllGlobals(); });

it('requires a deliberate choice, including a tap on the unchanged middle position', () => {
  expect(button().disabled).toBe(true);
  expect(slider().disabled).toBe(false);
  slider().click();
  expect(button().disabled).toBe(false);
  expect(slider().getAttribute('aria-valuetext')).toContain('Partly submerged');
  for (const value of [0, 4]) {
    slider().value = String(value);
    slider().dispatchEvent(new Event('input'));
    expect(slider().getAttribute('aria-valuetext')).toContain(value === 0 ? 'Completely submerged' : 'Clear and passable');
  }
});

it('keeps the preview explicit, with no submission, storage, invented count or change to the prediction', () => {
  const headline = document.getElementById('outlook-title')!.textContent;
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  slider().value = '0';
  slider().dispatchEvent(new Event('input'));
  const event = new SubmitEvent('submit', { cancelable: true });
  document.getElementById('observation-form')!.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(status().textContent).toBe('Your selection: completely submerged. Nothing has been sent.');
  expect(document.activeElement).toBe(status());
  expect(document.getElementById('community-count')!.textContent).toContain('coming soon');
  expect(document.getElementById('outlook-title')!.textContent).toBe(headline);
  expect(fetch).not.toHaveBeenCalled();
  expect(storage).not.toHaveBeenCalled();
  storage.mockRestore();
});
