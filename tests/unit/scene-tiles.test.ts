// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installSceneTiles } from '../../src/lib/scene-tiles';
import { floodWarningSummary, renderFloodWarnings } from '../../src/lib/flood-warnings';
import { warningFixture } from '../fixtures/monitoring';

const markup = readFileSync(resolve('index.html'), 'utf8');
const toggle = (id: string) => document.querySelector<HTMLButtonElement>(`[aria-controls="${id}"]`)!;
let dispose: () => void;
beforeEach(() => {
  document.body.innerHTML = new DOMParser().parseFromString(markup, 'text/html').body.innerHTML;
  dispose = installSceneTiles();
});
afterEach(() => { dispose(); document.body.innerHTML = ''; });

it('starts compact and expands either graph independently through the large header target', () => {
  for (const id of ['outlook-details', 'river-details', 'tide-details']) {
    expect(document.getElementById(id)!.hidden).toBe(true);
    expect(toggle(id).getAttribute('aria-expanded')).toBe('false');
  }
  toggle('river-details').querySelector('path')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  toggle('tide-details').click();
  expect(document.getElementById('river-level-graph')!.closest('[hidden]')).toBeNull();
  expect(document.getElementById('tide-level-graph')!.closest('[hidden]')).toBeNull();
  expect(document.getElementById('outlook-details')!.hidden).toBe(true);
  toggle('river-details').click();
  expect(toggle('river-details').getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById('river-details')!.hidden).toBe(true);
});

it('keeps warning advice and the quick report link outside the collapsed content across data updates', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  const checkedAt = new Date(now).toISOString();
  for (const severity of [1, 2, 3] as const) {
    renderFloodWarnings(floodWarningSummary({ status: 'available', checkedAt, attemptedAt: checkedAt,
      warnings: [warningFixture(now, severity)] }, now));
    expect(document.getElementById('nrw-warning')!.closest('[hidden]')).toBeNull();
    expect(document.getElementById('nrw-warning-title')!.textContent).toContain('NRW');
    expect(document.getElementById('outlook-details')!.hidden).toBe(true);
  }
  expect(document.querySelector('.community-reports a')!.closest('[hidden]')).toBeNull();
  toggle('outlook-details').click();
  renderFloodWarnings(floodWarningSummary(undefined, now));
  expect(document.getElementById('outlook-details')!.hidden).toBe(false);
  expect(document.getElementById('nrw-warning-title')!.textContent).toContain('unavailable');
});

it('closes an expanded panel with Escape and restores focus to its visible control', () => {
  const button = toggle('outlook-details');
  button.click();
  const forecast = document.querySelector<HTMLButtonElement>('[data-outlook-minutes="0"]')!;
  forecast.focus();
  forecast.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(document.getElementById('outlook-details')!.hidden).toBe(true);
  expect(document.activeElement).toBe(button);
  const unrelated = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.getElementById('report')!.dispatchEvent(unrelated);
  expect(unrelated.defaultPrevented).toBe(false);
});

it('removes its listeners when the page module is replaced', () => {
  dispose();
  toggle('river-details').click();
  expect(document.getElementById('river-details')!.hidden).toBe(true);
});
