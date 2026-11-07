// @vitest-environment jsdom
import { applyWarningAdvice, floodWarningSummary, renderFloodWarnings, retainWarningState } from '../../src/lib/flood-warnings';
import { warningFixture } from '../fixtures/monitoring';
import type { FloodWarnings } from '../../src/lib/types';

const now = Date.parse('2026-11-07T12:00:00Z');
const iso = (minutes: number) => new Date(now + minutes * 60000).toISOString();
const payload = (severity?: 1 | 2 | 3 | 4): FloodWarnings => ({ status: 'available', attemptedAt: iso(-5), checkedAt: iso(-5), warnings: severity ? [warningFixture(now, severity)] : [] });

it.each([undefined, 1, 2, 3, 4] as const)('presents verified severity %s without converting absence into a safety guarantee', severity => {
  const result = floodWarningSummary(payload(severity), now);
  expect(result.verified).toBe(true);
  if (!severity) { expect(result.headline).toBe('No active NRW warnings'); expect(result.detail).toContain('does not mean the stones are safe'); }
  if (severity === 1 || severity === 2) expect(result.advice).toBe('Do not cross');
  if (severity === 3) expect(result.advice).toBe('Caution');
  if (severity === 4) { expect(result.headline).toContain('no longer in force'); expect(result.advice).toBeUndefined(); }
});

it('uses the highest active severity while keeping withdrawals out of the ranking', () => {
  const data = payload(4);
  const alert = warningFixture(now, 3); alert.areaId = '102WABF20'; alert.areaName = 'Rivers Llynfi and Ogmore'; alert.scope = 'catchment'; alert.sourceUrl = 'https://flood-warning.naturalresources.wales/Detail/102WABF20';
  if (data.status === 'available') data.warnings.push(alert);
  const result = floodWarningSummary(data, now);
  expect(result.advice).toBe('Caution'); expect(result.detail).toContain('wider area');
  expect(applyWarningAdvice({ available: true, state: 'Likely Unpassable' }, result)).toBeUndefined();
  expect(applyWarningAdvice({ available: false, state: 'Data unavailable' }, result)?.state).toBe('Caution');
});

it('ages the check, not the warning issue time, and never calls stale or failed data an all-clear', () => {
  expect(floodWarningSummary(payload(2), now).advice).toBe('Do not cross');
  expect(floodWarningSummary(payload(), now + 41 * 60000)).toMatchObject({ verified: false, headline: 'NRW warning status unavailable' });
  expect(floodWarningSummary(payload(), now, true).verified).toBe(false);
  expect(floodWarningSummary(undefined, now).verified).toBe(false);
  const oldWarning = floodWarningSummary(payload(2), now + 60 * 60000);
  expect(oldWarning).toMatchObject({ verified: false, advice: 'Do not cross' });
  expect(oldWarning.headline).toContain('Last known');
});

it('retains last-known warnings through an outage and rejects future, malformed or unrelated snapshots', () => {
  const previous = payload(2);
  if (previous.status !== 'available') throw new Error('fixture');
  expect(floodWarningSummary({ status: 'unavailable', attemptedAt: iso(0), reason: 'request-failed', lastKnown: previous }, now)).toMatchObject({ verified: false, advice: 'Do not cross' });
  previous.checkedAt = iso(30);
  expect(floodWarningSummary(previous, now).advice).toBeUndefined();
  previous.checkedAt = iso(-5); previous.warnings[0].severity = 9 as 2;
  expect(floodWarningSummary(previous, now).verified).toBe(false);
  previous.warnings[0] = warningFixture(now); previous.warnings[0].areaId = 'unrelated';
  expect(floodWarningSummary(previous, now).verified).toBe(false);
});

it('does not let an older deployment or a failed response erase a newer known warning', () => {
  const known = payload(2);
  const olderClear = payload();
  if (olderClear.status === 'available') olderClear.checkedAt = iso(-20);
  let state = retainWarningState(olderClear, known, now);
  expect(floodWarningSummary(state, now)).toMatchObject({ verified: false, advice: 'Do not cross' });
  state = retainWarningState(payload(), known, now);
  expect(floodWarningSummary(state, now)).toMatchObject({ verified: false, advice: 'Do not cross' });
  state = retainWarningState(known, payload(), now);
  expect(floodWarningSummary(state, now)).toMatchObject({ verified: false, advice: 'Do not cross' });
  state = retainWarningState(undefined, state, now);
  expect(floodWarningSummary(state, now).advice).toBe('Do not cross');
  const newClear = payload();
  if (newClear.status === 'available') newClear.checkedAt = iso(0);
  state = retainWarningState(newClear, state, now);
  expect(floodWarningSummary(state, now)).toMatchObject({ verified: true, headline: 'No active NRW warnings' });
});

it('renders commentary as text, uses official links, preserves focus and includes source timestamps', () => {
  document.body.innerHTML = '<div id="nrw-warning"><strong id="nrw-warning-title"></strong><p id="nrw-warning-detail"></p><span id="nrw-warning-checked"></span><a id="nrw-warning-link"></a></div><div id="nrw-warning-messages"></div>';
  const data = payload(2); if (data.status !== 'available') throw new Error('fixture');
  data.warnings[0].message = '<img src=x onerror=alert(1)> TEST ONLY';
  const summary = floodWarningSummary(data, now);
  renderFloodWarnings(summary);
  expect(document.querySelector('img')).toBeNull();
  expect(document.querySelector('.nrw-message')!.textContent).toContain('<img');
  expect(document.getElementById('nrw-warning-link')!.getAttribute('href')).toBe('https://flood-warning.naturalresources.wales/Detail/102FWB402A');
  expect(document.getElementById('nrw-warning-messages')!.textContent).toContain('Severity changed');
  const link = document.querySelector<HTMLAnchorElement>('#nrw-warning-messages a')!;
  link.focus(); renderFloodWarnings(summary);
  expect(document.activeElement).toBe(link);
  document.body.innerHTML = '';
});
