// @vitest-environment jsdom
import { getSceneWeatherVisual, installSceneWeather, parseSceneWeather } from '../../src/lib/scene-weather';

const now = Date.parse('2026-10-23T12:00:00Z');
function payload(overrides: Record<string, unknown> = {}) {
  return {
    current_units: { time: 'unixtime', wind_speed_10m: 'mp/h', wind_gusts_10m: 'mp/h', precipitation: 'mm', snowfall: 'cm' },
    current: { time: now / 1000, weather_code: 2, precipitation: 0, snowfall: 0, cloud_cover: 60,
      wind_speed_10m: 12, wind_gusts_10m: 22, wind_direction_10m: 270, ...overrides },
  };
}

describe('weather data driving the scene', () => {
  it('maps rain and snow codes to the appropriate effect', () => {
    const rain = parseSceneWeather(payload({ weather_code: 61, precipitation: 0.2 }), now);
    const snow = parseSceneWeather(payload({ weather_code: 73, snowfall: 0.3, precipitation: 0.1 }), now);
    expect(rain.visual.rain).toBeGreaterThan(0);
    expect(rain.visual.snow).toBe(0);
    expect(snow.visual.snow).toBeGreaterThan(0);
    expect(snow.visual.rain).toBe(0);
    const storm = parseSceneWeather(payload({ weather_code: 97 }), now);
    expect(storm.description).toBe('Thundery rain');
    expect(storm.visual.rain).toBeGreaterThan(rain.visual.rain);
    expect(parseSceneWeather(payload({ precipitation: 0.1 }), now).description).toBe('Rain');
  });

  it('uses cloud cover and fog without inventing precipitation', () => {
    const fog = parseSceneWeather(payload({ weather_code: 45, cloud_cover: 100 }), now);
    expect(fog.visual.fog).toBeGreaterThan(0);
    expect(fog.visual.clouds).toBe(1);
    expect(fog.visual.rain + fog.visual.snow).toBe(0);
  });

  it('increases tree strength for wind and gusts while bounding extreme input', () => {
    const calm = parseSceneWeather(payload({ wind_speed_10m: 0, wind_gusts_10m: 0 }), now);
    const windy = parseSceneWeather(payload({ wind_speed_10m: 35, wind_gusts_10m: 60 }), now);
    const extreme = parseSceneWeather(payload({ wind_speed_10m: 999, wind_gusts_10m: 999 }), now);
    expect(windy.visual.wind).toBeGreaterThan(calm.visual.wind * 2);
    expect(windy.visual.gust).toBeGreaterThan(calm.visual.gust);
    expect(extreme.visual.wind).toBeLessThanOrEqual(2.2);
    expect(windy.visual.drift).toBeGreaterThan(0);
  });

  it('rejects incomplete, stale, future-dated or incorrectly scaled feeds', () => {
    expect(() => parseSceneWeather(payload({ snowfall: null }), now)).toThrow();
    expect(() => parseSceneWeather(payload({ time: now / 1000 - 7200 }), now)).toThrow();
    expect(() => parseSceneWeather(payload({ time: now / 1000 + 7200 }), now)).toThrow();
    const wrongUnits = payload();
    wrongUnits.current_units.wind_speed_10m = 'km/h';
    expect(() => parseSceneWeather(wrongUnits, now)).toThrow();
  });
});

describe('live weather and manual scene buttons', () => {
  let dispose: (() => void) | undefined;
  let fetchMock: ReturnType<typeof vi.fn>;
  const click = (mode: string) => document.querySelector<HTMLButtonElement>(`button[data-weather-mode="${mode}"]`)!.click();
  const status = () => document.querySelector('#scene-weather-label')!.textContent;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    localStorage.clear();
    document.body.innerHTML = `<div class="hero-art"></div><div id="scene-weather">
      <button data-weather-mode="live">Live</button><button data-weather-mode="rain">Rain</button>
      <button data-weather-mode="snow">Snow</button><button data-weather-mode="clear">Clear</button>
      </div><span id="scene-weather-label"></span>`;
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload() });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('shows timestamped modelled weather and reuses a fresh cache', async () => {
    dispose = installSceneWeather();
    await vi.advanceTimersByTimeAsync(0);
    expect(status()).toContain('wind 12 mph, gusts 22 mph');
    expect(status()).toContain('modelled weather');
    dispose();
    dispose = installSceneWeather();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a manual choice when the live request finishes and restores Live on demand', async () => {
    dispose = installSceneWeather();
    click('snow');
    await vi.advanceTimersByTimeAsync(0);
    expect(status()).toContain('Snow preview');
    expect(getSceneWeatherVisual().snow).toBeGreaterThan(0);
    click('live');
    expect(status()).toContain('modelled weather');
    expect(getSceneWeatherVisual().snow).toBe(0);
    expect(document.querySelector('button[data-weather-mode="live"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('leaves manual weather usable after a failed request', async () => {
    fetchMock.mockRejectedValue(new Error('Offline'));
    dispose = installSceneWeather();
    await vi.advanceTimersByTimeAsync(0);
    expect(status()).toContain('unavailable');
    click('rain');
    expect(status()).toContain('Rain preview');
    expect(getSceneWeatherVisual().rain).toBeGreaterThan(0);
    click('live');
    expect(getSceneWeatherVisual().rain).toBe(0);
    expect(status()).toContain('unavailable');
  });

  it('refreshes on return from a hidden tab and clears pending timers on disposal', async () => {
    dispose = installSceneWeather();
    await vi.advanceTimersByTimeAsync(0);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    vi.setSystemTime(now + 20 * 60_000);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts an in-flight request when the scene is disposed', () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    dispose = installSceneWeather();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    dispose();
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
