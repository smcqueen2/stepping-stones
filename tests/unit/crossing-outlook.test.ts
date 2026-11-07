// @vitest-environment jsdom
import { crossingReason, installCrossingOutlook, selectOutlook, waterAppearance, type OutlookData } from '../../src/lib/crossing-outlook';
import type { ForecastHour, LivePayload } from '../../src/lib/types';
import { monitoringFixture, warningFixture } from '../fixtures/monitoring';

const now = Date.parse('2026-10-24T16:40:00Z');
const iso = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
const weights = { tide: .45, river: .35, rain: .2 };
function fixture(): OutlookData {
  const live: LivePayload = {
    generatedAt: iso(-5), sourceStations: [],
    tideTiming: { generatedAt: iso(-5), source: 'Open-Meteo Marine', location: 'Ogmore coast', latitude: 51.458, longitude: -3.708,
      validFrom: iso(-1440), validTo: iso(2880), events: [{ type: 'low', time: iso(-160) }, { type: 'high', time: iso(200) },
        { type: 'low', time: iso(590) }, { type: 'high', time: iso(950) }] },
    freshness: { generatedAt: iso(-5), latestObservationAt: iso(-10), ageMinutes: 5, stale: false },
    current: { riverLevelM: .8, tideLevelMAOD: -1.2, riverTrendMPerHour: .1, tideTrendMPerHour: .2,
      riskScore: .3, riskComponents: { river: .3, tide: .3, rain: .3 }, state: 'Likely Passable', reason: 'Lower predicted risk.' },
    shortHorizonPrediction: { horizonMinutes: 90, predictedRiverLevelM: 1, projectedTideLevelMAOD: 0, riskScore: .9, state: 'Likely Unpassable' },
  };
  const hour = (at: number, risk: number): ForecastHour => ({
    timestamp: iso(at), projectedRiverLevelM: 1.1, projectedTideLevelMAOD: 2.2, rainfallMm: .5, precipitationProbabilityPct: 60,
    riskComponents: { tide: risk, river: risk, rain: risk }, riskScore: risk,
    state: risk < .45 ? 'Likely Passable' : risk < .7 ? 'Caution' : 'Likely Unpassable',
  });
  return { live, monitoring: monitoringFixture(now), config: { freshness: { staleAfterMinutes: 120, severeStaleAfterMinutes: 360 },
    stateThresholds: { likelyPassableMax: .45, cautionMax: .7 }, weights,
    rainScaling: { millimetresForHighRisk: 5 }, messaging: { disclaimer: '', staleWarning: '' } },
    forecast: { generatedAt: iso(-5), horizonHours: 24,
    summary: { highestRiskWindow: '', likelyUnpassableHours: 1, cautionHours: 1, likelyPassableHours: 1 },
    hours: [hour(-40, .99), hour(20, .3), hour(80, .55), hour(200, .85)] } };
}

describe('plain-language crossing reasons', () => {
  it.each([
    [{ river: .9, tide: .9, rain: 0 }, 'River and tide levels are high.'],
    [{ river: .9, tide: .5, rain: 0 }, 'River level is high.'],
    [{ river: .5, tide: .9, rain: 0 }, 'Tide level is high.'],
    [{ river: .9, tide: .1, rain: 0 }, 'River is high, but tide is low.'],
    [{ river: .1, tide: .9, rain: 0 }, 'Tide is high, but river level is low.'],
    [{ river: .1, tide: .1, rain: 0 }, 'River and tide levels are low.'],
    [{ river: .1, tide: .5, rain: 0 }, 'River level is low.'],
    [{ river: .5, tide: .1, rain: 0 }, 'Tide level is low.'],
    [{ river: .5, tide: .5, rain: 0 }, 'River and tide levels are moderate.'],
    [{ river: .5, tide: .5, rain: .9 }, 'Rain could raise river levels.'],
    [{ river: .8, tide: .5, rain: .95 }, 'River level is high.'],
  ] as const)('describes the existing model inputs %j', (components, expected) => {
    expect(crossingReason(components, weights)).toBe(expected);
  });

  it('keeps a neutral explanation when cause data is absent, invalid or disabled', () => {
    const fallback = 'Based on the latest water readings.';
    expect(crossingReason(undefined, weights)).toBe(fallback);
    expect(crossingReason({ river: .9, tide: .5, rain: 0 })).toBe(fallback);
    expect(crossingReason({ river: NaN, tide: .9, rain: 0 }, weights)).toBe(fallback);
    expect(crossingReason({ river: 1.1, tide: .9, rain: 0 }, weights)).toBe(fallback);
    expect(crossingReason({ river: .9, tide: .5, rain: 0 }, { ...weights, river: 0 })).toBe(fallback);
    const data = fixture();
    delete data.live!.current.riskComponents;
    expect(selectOutlook(data, 0, now)).toMatchObject({ available: true, state: 'Likely Passable' });
  });
});

describe('selected prediction and illustrated water', () => {
  it('uses the actual future hour for each preset and keeps gauge units separate', () => {
    const data = fixture();
    const next = selectOutlook(data, 60, now);
    const later = selectOutlook(data, 180, now);
    expect(next).toMatchObject({ available: true, state: 'Caution', at: Date.parse(iso(80)), river: 1.1, tide: 2.2 });
    expect(later).toMatchObject({ available: true, state: 'Likely Unpassable', at: Date.parse(iso(200)) });
    expect(selectOutlook(data, 0, now)).toMatchObject({ state: 'Likely Passable', river: .8, tide: -1.2 });
  });
  it('does not substitute a past prediction, a distant hour or an expired forecast', () => {
    const data = fixture();
    expect(selectOutlook(data, iso(-40), now).available).toBe(false);
    expect(selectOutlook(data, 600, now).available).toBe(false);
    data.forecast!.generatedAt = iso(-180);
    expect(selectOutlook(data, 60, now).available).toBe(false);
    expect(selectOutlook(data, 0, now).available).toBe(true);
    delete data.forecast;
    expect(selectOutlook(data, 0, now).available).toBe(true);
  });
  it('recomputes age in an open tab and rejects invalid or future-dated data', () => {
    const data = fixture();
    expect(selectOutlook(data, 0, now + 121 * 60_000)).toMatchObject({ available: false, stale: true });
    data.live!.freshness.oldestObservationAt = iso(-180);
    expect(selectOutlook(data, 0, now).available).toBe(false);
    delete data.live!.freshness.oldestObservationAt;
    data.live!.generatedAt = iso(11);
    expect(selectOutlook(data, 0, now).available).toBe(false);
    data.live!.generatedAt = iso(-5);
    data.live!.current.riskScore = NaN;
    expect(selectOutlook(data, 0, now).available).toBe(false);
  });
  it('increases bounded stone coverage and current with risk; missing data is neutral', () => {
    const views = [.2, .4, .6, .8, 1].map(score => waterAppearance(score));
    expect(views[0].coverage).toBe(0);
    expect(views.at(-1)!.coverage).toBe(1);
    for (let i = 1; i < views.length; i++) {
      expect(views[i].coverage).toBeGreaterThanOrEqual(views[i - 1].coverage);
      expect(views[i].currentSpeed).toBeGreaterThanOrEqual(views[i - 1].currentSpeed);
    }
    expect(waterAppearance().coverage).toBe(.5);
  });
});

describe('forecast overlay controls', () => {
  let controller: ReturnType<typeof installCrossingOutlook>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.body.innerHTML = `<div class="hero-art"><img id="river-high" data-src="/river-high.webp"></div>
      <h1 id="outlook-title"><span id="outlook-state"></span></h1><p id="outlook-description"></p><span id="outlook-horizon"></span><p id="outlook-model-result"></p>
      <div id="nrw-warning"><strong id="nrw-warning-title"></strong><p id="nrw-warning-detail"></p></div>
      <section class="water-level-card"><p id="water-level-age"></p>
        <div id="water-level-river"><span id="river-glance-value"></span><span id="river-glance-trend"></span><span id="river-glance-source"></span></div>
        <div id="water-level-tide"><span id="tide-glance-status"></span><span id="tide-glance-high"></span><span id="tide-glance-countdown"></span><span id="tide-glance-low"></span></div></section>
      <span id="tide-value"></span><span id="river-value"></span>
      <button data-outlook-minutes="0"></button><button data-outlook-minutes="60"></button><button data-outlook-minutes="180"></button>
      <dialog><button data-forecast-time="${iso(200)}"></button></dialog>`;
    document.querySelector<HTMLImageElement>('img')!.decode = vi.fn().mockResolvedValue(undefined);
    document.querySelector('dialog')!.close = vi.fn();
    controller = installCrossingOutlook();
    controller.setData(fixture());
  });
  afterEach(() => { controller.dispose(); vi.restoreAllMocks(); vi.useRealTimers(); document.body.innerHTML = ''; });
  const click = (n: number) => document.querySelector<HTMLButtonElement>(`[data-outlook-minutes="${n}"]`)!.click();
  const state = () => document.getElementById('outlook-state')!;
  it('keeps the measured river and current coastal tide timings independent of future crossing selection', () => {
    const data = fixture();
    data.live!.sourceStations = [
      { role: 'river', stationId: 4083, stationTitle: 'Ogmore at Bridgend', parameterId: 110, source: 'NRW' },
      { role: 'tide', stationId: 72839, stationTitle: 'Newport tide gauge', parameterId: 10254, source: 'NRW' },
    ];
    controller.setData(data);
    expect(document.getElementById('river-glance-value')!.textContent).toBe('0.27');
    expect(document.getElementById('tide-glance-status')!.textContent).toBe('Coming in');
    expect(document.getElementById('tide-glance-high')!.textContent).toBe('High tide ~21:00');
    expect(document.getElementById('tide-glance-countdown')!.textContent).toBe('About 3h 30m until high tide');
    expect(document.getElementById('river-glance-trend')!.textContent).toBe('↑ Recent rise');
    expect(document.getElementById('river-glance-source')!.textContent).toBe('Keepers Lodge · River Ewenny');
    expect(document.getElementById('tide-value')!.textContent).toBe('-1.200 mAOD');
    expect(document.getElementById('water-level-age')!.textContent).toBe('Ewenny · 10 min old');
    click(180);
    expect(state().textContent).toBe('Likely Unpassable');
    expect(document.getElementById('river-glance-value')!.textContent).toBe('0.27');
    expect(document.getElementById('tide-glance-high')!.textContent).toBe('High tide ~21:00');
    data.live!.sourceStations[1].stationTitle = 'Fallback coastal gauge';
    controller.setData(data);
    expect(document.getElementById('tide-glance-high')!.textContent).toBe('High tide ~21:00');
  });
  it('accepts zero and negative gauge values and validates each reading and trend independently', () => {
    const data = fixture();
    Object.assign(data.live!.current, { riverLevelM: 0, tideLevelMAOD: -4.2, riverTrendMPerHour: -.1, tideTrendMPerHour: .001 });
    Object.assign(data.monitoring!.gauges.ewenny, { value: 0, trendMPerHour: -.1 });
    controller.setData(data);
    expect(document.getElementById('river-glance-value')!.textContent).toBe('0.00');
    expect(document.getElementById('tide-value')!.textContent).toBe('-4.200 mAOD');
    expect(document.getElementById('river-glance-trend')!.textContent).toBe('↓ Recent fall');
    Object.assign(data.live!.current, { tideLevelMAOD: NaN, riverTrendMPerHour: NaN });
    data.monitoring!.gauges.ewenny.trendMPerHour = NaN;
    controller.setData(data);
    expect(document.getElementById('river-glance-value')!.textContent).toBe('0.00');
    expect(document.getElementById('river-glance-trend')!.textContent).toBe('Trend unavailable');
    expect(document.getElementById('water-level-river')!.dataset.available).toBe('true');
    expect(document.getElementById('tide-value')!.textContent).toBe('--');
    expect(document.getElementById('water-level-tide')!.dataset.available).toBe('true');
    delete data.live!.tideTiming;
    controller.setData(data);
    expect(document.getElementById('tide-glance-status')!.textContent).toBe('Times unavailable');
    expect(document.getElementById('tide-glance-countdown')!.textContent).toBe('');
    expect(document.getElementById('water-level-tide')!.dataset.available).toBe('false');
  });
  it('clears local values on invalid, stale or missing local readings without coupling them to model freshness', () => {
    const data = fixture();
    data.live!.generatedAt = iso(11);
    controller.setData(data);
    expect(document.getElementById('river-glance-value')!.textContent).toBe('0.27');
    data.monitoring!.gauges.ewenny.observedAt = iso(11);
    controller.setData(data);
    expect(document.getElementById('river-glance-value')!.textContent).toBe('—');
    expect(document.getElementById('water-level-age')!.textContent).toBe('Ewenny reading unavailable');
    data.live!.generatedAt = iso(-5);
    data.live!.freshness.stale = true;
    data.monitoring!.gauges.ewenny.observedAt = iso(-180);
    controller.setData(data);
    expect(document.getElementById('water-level-age')!.textContent).toBe('Ewenny reading out of date');
    expect(document.getElementById('tide-glance-status')!.textContent).toBe('Coming in');
    expect(document.querySelector<HTMLElement>('.water-level-card')!.dataset.freshness).toBe('stale');
    controller.setData({});
    expect(document.getElementById('tide-glance-status')!.textContent).toBe('Times unavailable');
    expect(document.getElementById('tide-glance-countdown')!.textContent).toBe('');
    expect(document.getElementById('water-level-age')!.textContent).toBe('Ewenny reading unavailable');
  });
  it('updates the countdown on the existing minute timer and expires timing data independently', async () => {
    await vi.advanceTimersByTimeAsync(25 * 60000);
    expect(document.getElementById('tide-glance-countdown')!.textContent).toBe('About 3h until high tide');
    const data = fixture();
    data.live!.tideTiming!.generatedAt = iso(-400);
    controller.setData(data);
    expect(document.getElementById('river-glance-value')!.textContent).toBe('0.27');
    expect(document.getElementById('tide-glance-status')!.textContent).toBe('Times unavailable');
    expect(document.getElementById('tide-glance-high')!.textContent).toBe('High tide time unavailable');
    expect(document.getElementById('tide-glance-low')!.textContent).toBe('');
  });
  it('changes the caption and water together, preserves selection on refresh and reuses artwork', async () => {
    expect(document.querySelector('img')!.hasAttribute('src')).toBe(false);
    click(180);
    await vi.advanceTimersByTimeAsync(0);
    expect(state().textContent).toBe('Likely Unpassable');
    expect(document.getElementById('outlook-title')!.textContent).toBe('Likely Unpassable');
    expect(document.getElementById('outlook-description')!.textContent).toBe('River and tide levels are high.');
    expect(document.querySelector<HTMLElement>('.hero-art')!.dataset.riverCoverage).toBe('1.0000');
    expect(document.querySelector('img')!.classList.contains('is-ready')).toBe(true);
    controller.setData(fixture());
    expect(state().textContent).toBe('Likely Unpassable');
    click(0);
    expect(state().textContent).toBe('Likely Passable');
    expect(document.querySelector('img')!.decode).toHaveBeenCalledTimes(1);
  });
  it('selects an explicit forecast row and closes its dialog', () => {
    document.querySelector<HTMLButtonElement>('[data-forecast-time]')!.click();
    expect(state().textContent).toBe('Likely Unpassable');
    expect(document.querySelector('dialog')!.close).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-outlook-minutes="0"]')!.getAttribute('aria-pressed')).toBe('false');
  });
  it('explains the selected future hour rather than repeating the current cause', () => {
    const data = fixture();
    Object.assign(data.live!.current, { riskComponents: { river: .9, tide: .5, rain: 0 }, riskScore: .54, state: 'Caution' });
    Object.assign(data.forecast!.hours[3], { riskComponents: { river: .5, tide: .95, rain: 0 }, riskScore: .603, state: 'Caution' });
    controller.setData(data);
    expect(document.getElementById('outlook-description')!.textContent).toBe('River level is high.');
    click(180);
    expect(document.getElementById('outlook-description')!.textContent).toBe('Tide level is high.');
    click(0);
    expect(document.getElementById('outlook-description')!.textContent).toBe('River level is high.');
  });
  it('removes a reassuring classification when data expires and cleans up its clock', async () => {
    await vi.advanceTimersByTimeAsync(122 * 60_000);
    expect(state().textContent).toBe('Data out of date');
    expect(document.getElementById('outlook-description')!.textContent).toContain('Readings are');
    expect(state().classList.contains('state-good')).toBe(false);
    expect(document.getElementById('river-glance-value')!.textContent).toBe('—');
    expect(document.getElementById('tide-glance-status')!.textContent).toBe('Coming in');
    expect(document.getElementById('water-level-age')!.textContent).toBe('Ewenny reading out of date');
    expect(document.querySelector<HTMLButtonElement>('[data-outlook-minutes="180"]')!.disabled).toBe(true);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([1, 2] as const)('prioritises NRW severity %i for Now and future views without changing model water coverage', severity => {
    const data = fixture();
    const warning = warningFixture(now, severity);
    data.monitoring!.floodWarnings = { status: 'available', attemptedAt: iso(-1), checkedAt: iso(-1), warnings: [warning] };
    controller.setData(data);
    expect(state().textContent).toBe('Do not cross');
    expect(state().classList.contains('state-bad')).toBe(true);
    expect(document.querySelector<HTMLElement>('.hero-art')!.dataset.riverCoverage).toBe('0.0000');
    expect(document.getElementById('outlook-model-result')!.textContent).toContain('Model estimate: Likely Passable');
    expect(data.live!.current.riskScore).toBe(.3);
    click(60);
    expect(state().textContent).toBe('Do not cross');
    expect(document.getElementById('outlook-model-result')!.textContent).toContain('Model estimate: Caution');
    const water = waterAppearance(.55, 'Caution');
    expect(document.querySelector<HTMLElement>('.hero-art')!.dataset.riverCoverage).toBe(water.coverage.toFixed(4));
  });
  it('can display a warning and fresh local readings even when the environmental model is absent', () => {
    const monitoring = monitoringFixture(now);
    monitoring.floodWarnings = { status: 'available', attemptedAt: iso(-1), checkedAt: iso(-1), warnings: [warningFixture(now)] };
    controller.setData({ monitoring });
    expect(state().textContent).toBe('Do not cross');
    expect(document.getElementById('river-glance-value')!.textContent).toBe('0.27');
    expect(document.querySelector<HTMLElement>('.hero-art')!.dataset.riverCoverage).toBe('0.5000');
  });
  it('holds the last known warning during a failed refresh and clears it only after a verified clean response', () => {
    const data = fixture();
    data.monitoring!.floodWarnings = { status: 'available', attemptedAt: iso(-1), checkedAt: iso(-1), warnings: [warningFixture(now)] };
    controller.setData(data);
    controller.setData({ ...data, monitoringUpdateFailed: true });
    expect(state().textContent).toBe('Do not cross');
    expect(document.getElementById('nrw-warning-title')!.textContent).toContain('Last known');
    expect(document.getElementById('outlook-description')!.textContent).toContain('unverified');
    data.monitoring = monitoringFixture(now);
    if (data.monitoring.floodWarnings.status === 'available') data.monitoring.floodWarnings.checkedAt = iso(0);
    controller.setData(data);
    expect(state().textContent).toBe('Likely Passable');
    expect(document.getElementById('nrw-warning-title')!.textContent).toBe('No active NRW warnings');
  });
});
