// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import type { Mock } from 'vitest';
import { installCommunityReports } from '../../src/lib/community-reports';

const html = readFileSync('index.html', 'utf8').match(/<body[^>]*>([\s\S]*)<\/body>/)![1];
let dispose: () => void;
let fetcher: Mock<typeof fetch>;
let callbacks: Record<string, any>;
let counts: number[];
const slider = () => document.querySelector<HTMLInputElement>('#report-condition')!;
const button = () => document.querySelector<HTMLButtonElement>('#observation-submit')!;
const status = () => document.getElementById('observation-status')!;
const summary = () => ({ schemaVersion: 1, generatedAt: new Date().toISOString(), windowStart: new Date(Date.now() - 3_600_000).toISOString(),
  total: counts.reduce((a, b) => a + b, 0), counts, lastReportAt: counts.some(Boolean) ? new Date(Date.now() - 60_000).toISOString() : null,
  siteKey: '0x4AAAAAAA-public-fixture-only' });
const submitForm = () => document.getElementById('observation-form')!.dispatchEvent(new SubmitEvent('submit', { cancelable: true }));
async function start(): Promise<void> {
  dispose = installCommunityReports({ endpoint: 'http://127.0.0.1:8788/api/reports', fetcher });
  await vi.waitFor(() => expect(slider().disabled).toBe(false));
}
async function choose(value = 2): Promise<void> {
  slider().value = String(value); slider().dispatchEvent(new Event('input'));
  await vi.waitFor(() => expect(button().disabled).toBe(false));
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime('2026-11-11T20:00:00Z');
  document.body.innerHTML = html; localStorage.clear();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  counts = [0, 0, 0, 0, 0];
  fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => options?.method === 'POST'
    ? Response.json({ ok: true, receivedAt: new Date().toISOString(), nextAllowedAt: new Date(Date.now() + 900_000).toISOString() }, { status: 201 })
    : Response.json(summary()));
  window.turnstile = {
    render: vi.fn((_element, options) => { callbacks = options; queueMicrotask(() => callbacks.callback('fixture-token')); return 'widget'; }),
    reset: vi.fn(() => queueMicrotask(() => callbacks.callback('new-fixture-token'))), remove: vi.fn(),
  };
  dispose = () => {};
});
afterEach(() => { dispose(); delete window.turnstile; vi.restoreAllMocks(); vi.useRealTimers(); });

it('requires a deliberate choice and bot verification, including tapping the middle position', async () => {
  await start();
  expect(button().disabled).toBe(true);
  expect(window.turnstile!.render).not.toHaveBeenCalled();
  slider().click();
  await vi.waitFor(() => expect(button().disabled).toBe(false));
  expect(slider().getAttribute('aria-valuetext')).toContain('Partly submerged');
  for (const value of [0, 4]) {
    slider().value = String(value); slider().dispatchEvent(new Event('input'));
    expect(slider().getAttribute('aria-valuetext')).toContain(value === 0 ? 'Completely submerged' : 'Stones clear');
  }
  callbacks['expired-callback']();
  expect(button().disabled).toBe(true);
});

it('stays disabled without an endpoint and never invents a count or changes the outlook', () => {
  const headline = document.getElementById('outlook-title')!.textContent;
  dispose = installCommunityReports({ endpoint: '', fetcher }); submitForm();
  expect(status().textContent).toContain('not connected');
  expect(button().disabled).toBe(true);
  expect(document.getElementById('community-count')!.textContent).toContain('unavailable');
  expect(document.getElementById('outlook-title')!.textContent).toBe(headline);
  expect(fetcher).not.toHaveBeenCalled();
});

it('submits only condition, identifiers and token, prevents double clicks, and confirms success', async () => {
  await start(); await choose(0); submitForm(); submitForm();
  await vi.waitFor(() => expect(status().textContent).toContain('has been saved'));
  const posts = fetcher.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(posts).toHaveLength(1);
  expect(Object.keys(JSON.parse(String(posts[0][1]?.body))).sort()).toEqual(['condition', 'deviceId', 'id', 'token']);
  expect(JSON.parse(String(posts[0][1]?.body)).condition).toBe(0);
  expect(button().disabled).toBe(true);
  expect(document.activeElement).toBe(status());
});

it('reuses the same submission ID after an unconfirmed response', async () => {
  await start(); await choose();
  fetcher.mockImplementation(async (_url, options) => options?.method === 'POST'
    ? Promise.reject(new Error('connection lost')) : Response.json(summary()));
  submitForm();
  await vi.waitFor(() => expect(status().textContent).toContain('could not be confirmed'));
  await vi.waitFor(() => expect(button().disabled).toBe(false)); submitForm();
  await vi.waitFor(() => expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2));
  const posts = fetcher.mock.calls.filter(([, options]) => options?.method === 'POST');
  expect(JSON.parse(String(posts[0][1]?.body)).id).toBe(JSON.parse(String(posts[1][1]?.body)).id);
});

it('shows actual zero, majority and mixed summaries with all five conditions', async () => {
  await start();
  expect(document.getElementById('community-count')!.textContent).toBe('0 reports in the past hour');
  expect(document.getElementById('community-breakdown')!.children).toHaveLength(5);
  counts = [0, 0, 3, 1, 0]; await vi.advanceTimersByTimeAsync(60_000);
  expect(document.getElementById('community-detail')!.textContent).toContain('Most reported partly submerged');
  counts = [1, 0, 1, 0, 0]; await vi.advanceTimersByTimeAsync(60_000);
  expect(document.getElementById('community-detail')!.textContent).toContain('mixed conditions');
});

it('shows unavailable for stale summaries instead of zero', async () => {
  await start();
  fetcher.mockImplementation(async () => Response.json({ ...summary(), generatedAt: new Date(Date.now() - 180_000).toISOString() }));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(document.getElementById('community-count')!.textContent).toContain('unavailable');
  expect(button().disabled).toBe(true);
  expect(document.getElementById('community-summary')!.hidden).toBe(true);
});

it('handles cooldown and verification failures with accessible retry feedback', async () => {
  await start(); await choose(); callbacks['error-callback']();
  expect(button().disabled).toBe(true);
  const retry = document.querySelector<HTMLButtonElement>('#observation-verify-retry')!;
  expect(retry.hidden).toBe(false); retry.click();
  await vi.waitFor(() => expect(button().disabled).toBe(false));
  fetcher.mockImplementation(async (_url, options) => options?.method === 'POST'
    ? Response.json({ error: 'cooldown' }, { status: 429, headers: { 'Retry-After': '900' } }) : Response.json(summary()));
  submitForm();
  await vi.waitFor(() => expect(status().textContent).toContain('wait 15 minutes'));
  expect(button().disabled).toBe(true);
});

it('pauses polling in hidden tabs and removes widgets and listeners on disposal', async () => {
  await start(); await choose();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
  const calls = fetcher.mock.calls.length;
  await vi.advanceTimersByTimeAsync(120_000); expect(fetcher).toHaveBeenCalledTimes(calls);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
  await vi.waitFor(() => expect(fetcher.mock.calls.length).toBe(calls + 1));
  dispose(); expect(window.turnstile!.remove).toHaveBeenCalledWith('widget');
  await vi.advanceTimersByTimeAsync(120_000); expect(fetcher).toHaveBeenCalledTimes(calls + 1);
});

it('continues when browser storage is blocked', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  await start(); await choose(); submitForm();
  await vi.waitFor(() => expect(status().textContent).toContain('has been saved'));
});
