// @vitest-environment jsdom
import { installCrossingOutlook, selectOutlook, waterAppearance, type OutlookData } from '../../src/lib/crossing-outlook';
import type { ForecastHour, LivePayload } from '../../src/lib/types';

const now = Date.parse('2026-10-24T16:40:00Z');
const iso = (minutes: number) => new Date(now + minutes * 60_000).toISOString();
function fixture(): OutlookData {
  const live: LivePayload = {
    generatedAt: iso(-5), sourceStations: [],
    freshness: { generatedAt: iso(-5), latestObservationAt: iso(-10), ageMinutes: 5, stale: false },
    current: { riverLevelM: .8, tideLevelMAOD: -1.2, riverTrendMPerHour: .1, tideTrendMPerHour: .2,
      riskScore: .3, state: 'Likely Passable', reason: 'Lower predicted risk.' },
    shortHorizonPrediction: { horizonMinutes: 90, predictedRiverLevelM: 1, projectedTideLevelMAOD: 0, riskScore: .9, state: 'Likely Unpassable' },
  };
  const hour = (at: number, risk: number): ForecastHour => ({
    timestamp: iso(at), projectedRiverLevelM: 1.1, projectedTideLevelMAOD: 2.2, rainfallMm: .5, precipitationProbabilityPct: 60,
    riskComponents: { tide: risk, river: risk, rain: risk }, riskScore: risk,
    state: risk < .45 ? 'Likely Passable' : risk < .7 ? 'Caution' : 'Likely Unpassable',
  });
  return { live, forecast: { generatedAt: iso(-5), horizonHours: 24,
    summary: { highestRiskWindow: '', likelyUnpassableHours: 1, cautionHours: 1, likelyPassableHours: 1 },
    hours: [hour(-40, .99), hour(20, .3), hour(80, .55), hour(200, .85)] } };
}

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
      <span id="outlook-title"></span><span id="outlook-state"></span><span id="outlook-horizon"></span>
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
  it('changes the caption and water together, preserves selection on refresh and reuses artwork', async () => {
    expect(document.querySelector('img')!.hasAttribute('src')).toBe(false);
    click(180);
    await vi.advanceTimersByTimeAsync(0);
    expect(state().textContent).toBe('Likely Unpassable');
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
  it('removes a reassuring classification when data expires and cleans up its clock', async () => {
    await vi.advanceTimersByTimeAsync(122 * 60_000);
    expect(state().textContent).toBe('Data out of date');
    expect(state().classList.contains('state-good')).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('[data-outlook-minutes="180"]')!.disabled).toBe(true);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
