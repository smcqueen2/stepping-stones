// @vitest-environment jsdom
import { getSceneLighting, installSceneLighting } from '../../src/lib/scene-lighting';

describe('lighting at Ogmore', () => {
  it('preserves the daytime painting and darkens the scene at night', () => {
    const day = getSceneLighting(new Date('2026-06-21T12:00:00Z'));
    const night = getSceneLighting(new Date('2026-12-21T00:00:00Z'));
    expect(day.phase).toBe('day');
    expect(day.brightness).toBe(1);
    expect(day.night).toBe(0);
    expect(day.stars).toBe(0);
    expect(night.phase).toBe('night');
    expect(night.brightness).toBeLessThan(0.7);
    expect(night.stars).toBe(1);
  });

  it('follows the season rather than fixed sunrise and sunset hours', () => {
    const summer = getSceneLighting(new Date('2026-06-21T19:00:00Z'));
    const winter = getSceneLighting(new Date('2026-12-21T19:00:00Z'));
    expect(summer.phase).not.toBe('night');
    expect(winter.phase).toBe('night');
    expect(summer.brightness).toBeGreaterThan(winter.brightness);
  });

  it('uses UK local time through the repeated hour when daylight saving ends', () => {
    expect(getSceneLighting(new Date('2026-10-25T00:30:00Z')).clock).toBe('01:30 BST');
    expect(getSceneLighting(new Date('2026-10-25T01:30:00Z')).clock).toBe('01:30 GMT');
  });

  it('offers distinct dawn and dusk previews without changing the actual clock', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    const dawn = getSceneLighting(now, 'dawn');
    const dusk = getSceneLighting(now, 'dusk');
    expect(dawn.phase).toBe('dawn');
    expect(dusk.phase).toBe('dusk');
    expect(dawn.twilight).toBeGreaterThan(0.5);
    expect(dusk.twilight).toBeGreaterThan(0.5);
    expect(dawn.glowX).not.toBe(dusk.glowX);
    expect(dawn.clock).toBe(getSceneLighting(now).clock);
  });
});

describe('lighting clock and preview controls', () => {
  let dispose: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00Z'));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.body.innerHTML = `
      <div class="hero-art"></div>
      <select id="scene-lighting"><option value="live">Live</option><option value="night">Night</option></select>
      <time id="scene-local-time"></time><span id="scene-light-label"></span>`;
  });
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns from a clearly labelled preview to live lighting', () => {
    dispose = installSceneLighting();
    const control = document.querySelector<HTMLSelectElement>('#scene-lighting')!;
    const hero = document.querySelector<HTMLElement>('.hero-art')!;
    control.value = 'night';
    control.dispatchEvent(new Event('change'));
    expect(hero.dataset.lighting).toBe('night');
    expect(document.querySelector('#scene-light-label')?.textContent).toBe('Night preview');
    control.value = 'live';
    control.dispatchEvent(new Event('change'));
    expect(hero.dataset.lighting).toBe('day');
    expect(hero.dataset.lightingMode).toBe('live');
  });

  it('updates each minute, catches up after a hidden tab, and cleans up its timer', () => {
    dispose = installSceneLighting();
    vi.advanceTimersByTime(60_000);
    expect(document.querySelector('#scene-local-time')?.textContent).toBe('13:01 BST');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(new Date('2026-06-22T00:00:00Z'));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.querySelector<HTMLElement>('.hero-art')?.dataset.lighting).toBe('night');
    dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
