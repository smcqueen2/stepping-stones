// @vitest-environment jsdom
import { getSceneLighting, installSceneLighting } from '../../src/lib/scene-lighting';

describe('lighting at Ogmore', () => {
  it('preserves the daytime painting and darkens the night sky more than the landscape', () => {
    const day = getSceneLighting(new Date('2026-06-21T12:00:00Z'));
    const night = getSceneLighting(new Date('2026-12-21T00:00:00Z'));
    expect(day.phase).toBe('day');
    expect(day.brightness).toBe(1);
    expect(day.skyBrightness).toBe(1);
    expect(day.night).toBe(0);
    expect(day.stars).toBe(0);
    expect(night.phase).toBe('night');
    expect(night.brightness).toBeGreaterThan(0.8);
    expect(night.brightness).toBeLessThan(1);
    expect(night.skyBrightness).toBeLessThan(0.05);
    expect(night.skyBrightness).toBeLessThan(night.brightness);
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
      <div class="hero-art"><img class="hero-moon" data-src="/moon-watercolour.webp" /></div>
      <div id="scene-lighting"><button data-lighting-mode="live">Live</button><button data-lighting-mode="night">Night</button></div>
      <time id="scene-local-time"></time><span id="scene-light-label"></span>`;
    document.querySelector<HTMLImageElement>('.hero-moon')!.decode = vi.fn().mockResolvedValue(undefined);
  });
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns from a clearly labelled preview to live lighting', () => {
    dispose = installSceneLighting();
    const hero = document.querySelector<HTMLElement>('.hero-art')!;
    document.querySelector<HTMLButtonElement>('button[data-lighting-mode="night"]')!.click();
    expect(hero.dataset.lighting).toBe('night');
    expect(Number(hero.style.getPropertyValue('--scene-sky-brightness'))).toBeLessThan(0.05);
    expect(document.querySelector('#scene-light-label')?.textContent).toBe('Night preview');
    document.querySelector<HTMLButtonElement>('button[data-lighting-mode="live"]')!.click();
    expect(hero.dataset.lighting).toBe('day');
    expect(hero.dataset.lightingMode).toBe('live');
    expect(document.querySelector('button[data-lighting-mode="live"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('loads the painted moon only when stars become visible and reuses it on later previews', async () => {
    dispose = installSceneLighting();
    const moon = document.querySelector<HTMLImageElement>('.hero-moon')!;
    expect(moon.hasAttribute('src')).toBe(false);
    document.querySelector<HTMLButtonElement>('button[data-lighting-mode="night"]')!.click();
    expect(moon.getAttribute('src')).toBe('/moon-watercolour.webp');
    await Promise.resolve();
    expect(moon.classList.contains('is-ready')).toBe(true);
    document.querySelector<HTMLButtonElement>('button[data-lighting-mode="live"]')!.click();
    document.querySelector<HTMLButtonElement>('button[data-lighting-mode="night"]')!.click();
    expect(moon.decode).toHaveBeenCalledOnce();
  });

  it('pauses sky motion outside the viewport or in hidden tabs and disconnects on disposal', () => {
    let notify!: IntersectionObserverCallback;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    dispose = installSceneLighting();
    const hero = document.querySelector<HTMLElement>('.hero-art')!;
    expect(observe).toHaveBeenCalledWith(hero);
    expect(hero.dataset.skyMotion).toBe('running');
    notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(hero.dataset.skyMotion).toBe('paused');
    notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(hero.dataset.skyMotion).toBe('running');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(hero.dataset.skyMotion).toBe('paused');
    expect(vi.getTimerCount()).toBe(0);
    dispose(); dispose = undefined;
    expect(disconnect).toHaveBeenCalledOnce();
    notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(hero.dataset.skyMotion).toBe('paused');
  });

  it('does not reveal a moon that finishes decoding after disposal', async () => {
    const moon = document.querySelector<HTMLImageElement>('.hero-moon')!;
    let decoded!: () => void;
    moon.decode = vi.fn(() => new Promise<void>(resolve => { decoded = resolve; }));
    dispose = installSceneLighting();
    document.querySelector<HTMLButtonElement>('button[data-lighting-mode="night"]')!.click();
    dispose(); dispose = undefined;
    decoded();
    await Promise.resolve();
    expect(moon.classList.contains('is-ready')).toBe(false);
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
