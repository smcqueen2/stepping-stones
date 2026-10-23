export type WeatherMode = 'live' | 'clear' | 'cloudy' | 'rain' | 'snow';
export type WindMode = 'live' | 'calm' | 'breezy' | 'windy';
export type WeatherVisual = {
  rain: number; snow: number; clouds: number; fog: number;
  wind: number; gust: number; drift: number;
};
export type SceneWeather = {
  observedAt: number; description: string; windMph: number; gustMph: number; visual: WeatherVisual;
};

const REFRESH_MS = 15 * 60_000;
const MAX_AGE_MS = 60 * 60_000;
const CACHE_KEY = 'ogmore-scene-weather-v1';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=51.4759&longitude=-3.6206'
  + '&current=weather_code,precipitation,snowfall,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m'
  + '&wind_speed_unit=mph&timeformat=unixtime&timezone=UTC';
const fallback: WeatherVisual = { rain: 0, snow: 0, clouds: 0, fog: 0, wind: 1, gust: 0, drift: 0.2 };
const previews: Record<Exclude<WeatherMode, 'live'>, WeatherVisual> = {
  clear: { ...fallback, wind: 0.5, gust: 0.1 },
  cloudy: { ...fallback, clouds: 0.9, wind: 0.85, gust: 0.25 },
  rain: { ...fallback, rain: 0.75, clouds: 0.95, wind: 1.35, gust: 0.65, drift: 0.55 },
  snow: { ...fallback, snow: 0.75, clouds: 0.85, wind: 0.85, gust: 0.3, drift: 0.3 },
};
const windPreviews = {
  calm: { wind: 0.35, gust: 0, drift: 0 },
  breezy: { wind: 0.9, gust: 0.25, drift: 0.3 },
  windy: { wind: 2.15, gust: 1, drift: 0.9 },
};
const previewLabels = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow' };
const windLabels = { calm: 'Calm wind', breezy: 'Breezy wind', windy: 'Strong wind' };
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});
let activeVisual = fallback;
export function getSceneWeatherVisual(): WeatherVisual { return activeVisual; }
const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));

/** Precipitation and wind are independent, including when one remains live. */
export function resolveSceneWeather(mode: WeatherMode, windMode: WindMode, live?: WeatherVisual): WeatherVisual {
  const base = mode === 'live' ? live ?? fallback : previews[mode];
  const wind = windMode === 'live' ? live ?? fallback : windPreviews[windMode];
  return { ...base, wind: wind.wind, gust: wind.gust, drift: wind.drift };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid weather data');
  return value as Record<string, unknown>;
}

/** Validate the feed, including its units and timestamp, before animating it. */
export function parseSceneWeather(payload: unknown, now = Date.now()): SceneWeather {
  const body = record(payload);
  const current = record(body.current);
  const units = record(body.current_units);
  if (units.time !== 'unixtime' || units.wind_speed_10m !== 'mp/h' || units.wind_gusts_10m !== 'mp/h'
      || units.precipitation !== 'mm' || units.snowfall !== 'cm') {
    throw new Error('Unexpected weather units');
  }
  function number(key: string): number {
    const value = current[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid weather ${key}`);
    return value;
  }
  const observedAt = number('time') * 1000;
  if (now - observedAt > MAX_AGE_MS || observedAt - now > 10 * 60_000) throw new Error('Weather is out of date');
  const code = number('weather_code');
  const precipitation = Math.max(0, number('precipitation'));
  const snowfall = Math.max(0, number('snowfall'));
  const windMph = clamp(number('wind_speed_10m'), 0, 150);
  const gustMph = Math.max(windMph, clamp(number('wind_gusts_10m'), 0, 180));
  const direction = number('wind_direction_10m');
  const isSnow = [71, 73, 75, 77, 85, 86].includes(code) || snowfall > 0;
  const isRain = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 97, 99].includes(code)
    || (!isSnow && precipitation > 0);
  const rainBase = [65, 67, 82, 95, 96, 97, 99].includes(code) ? 0.75 : [53, 55, 57, 63, 81].includes(code) ? 0.5 : 0.22;
  const snowBase = [75, 86].includes(code) ? 0.85 : code === 73 ? 0.6 : 0.3;
  const fog = code === 45 || code === 48;
  const description = isSnow ? 'Snow' : isRain ? (code >= 95 ? 'Thundery rain' : 'Rain')
    : fog ? 'Mist / fog' : code === 0 ? 'Clear' : code === 1 ? 'Mainly clear'
      : code === 2 ? 'Partly cloudy' : code === 3 ? 'Overcast' : 'Cloudy';
  return {
    observedAt, description, windMph, gustMph,
    visual: {
      rain: isRain ? clamp(rainBase + precipitation * 1.2, rainBase, 1) : 0,
      snow: isSnow ? clamp(snowBase + snowfall * 1.8, snowBase, 1) : 0,
      clouds: clamp(number('cloud_cover') / 100), fog: fog ? 0.65 : 0,
      wind: clamp(0.45 + windMph / 22 + (gustMph - windMph) / 60, 0.45, 2.2),
      gust: clamp((gustMph - windMph) / 25),
      drift: Math.sin((direction + 180) * Math.PI / 180) * clamp(windMph / 25, 0.15, 1),
    },
  };
}

export function installSceneWeather(): () => void {
  const hero = document.querySelector<HTMLElement>('.hero-art');
  const controls = document.querySelector<HTMLElement>('#scene-weather');
  const status = document.querySelector<HTMLElement>('#scene-weather-label');
  if (!hero || !controls || !status) return () => {};
  const buttons = Array.from(controls.querySelectorAll<HTMLButtonElement>('button[data-weather-mode]'));
  const windControls = document.querySelector<HTMLElement>('#scene-wind');
  const windButtons = Array.from(windControls?.querySelectorAll<HTMLButtonElement>('button[data-wind-mode]') ?? []);
  const snowArt = Array.from(hero.querySelectorAll<HTMLImageElement>('img[data-snow-art]'));
  let mode: WeatherMode = 'live';
  let windMode: WindMode = 'live';
  let weather: SceneWeather | undefined;
  let lastAttempt = 0;
  let failed = false;
  let disposed = false;
  let timer: number | undefined;
  let requestTimeout: number | undefined;
  let request: AbortController | undefined;

  try {
    const cached = record(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'));
    if (typeof cached.fetchedAt === 'number' && cached.fetchedAt <= Date.now()
        && Date.now() - cached.fetchedAt < REFRESH_MS) {
      weather = parseSceneWeather(cached.payload);
      lastAttempt = cached.fetchedAt;
    }
  } catch { /* A missing or expired cache simply triggers a fresh request. */ }

  function render(): void {
    const fresh = weather && Date.now() - weather.observedAt <= MAX_AGE_MS;
    activeVisual = resolveSceneWeather(mode, windMode, fresh ? weather!.visual : undefined);
    hero!.dataset.weatherMode = mode;
    hero!.dataset.windMode = windMode;
    hero!.dataset.windStrength = activeVisual.wind.toFixed(2);
    hero!.dataset.snowCover = String(activeVisual.snow > 0.01);
    hero!.style.setProperty('--weather-clouds', activeVisual.clouds.toFixed(3));
    hero!.style.setProperty('--weather-fog', activeVisual.fog.toFixed(3));
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.weatherMode === mode)));
    windButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.windMode === windMode)));
    const parts = [mode === 'live'
      ? fresh ? weather!.description : failed || weather ? 'Live weather unavailable' : 'Loading Ogmore weather…'
      : `${previewLabels[mode]} preview`];
    parts.push(windMode === 'live'
      ? fresh ? `wind ${Math.round(weather!.windMph)} mph, gusts ${Math.round(weather!.gustMph)} mph` : 'Live wind unavailable'
      : `${windLabels[windMode]} preview`);
    if (fresh && (mode === 'live' || windMode === 'live')) {
      parts.push(clock.format(weather!.observedAt), `modelled weather${failed ? ' · update delayed' : ''}`);
    }
    status!.textContent = parts.join(' · ');

    // Fetch the extra artwork only when snow is first requested. It remains
    // available for later previews and for the static/reduced-motion scene.
    if (activeVisual.snow > 0.01) {
      for (const image of snowArt) {
        if (!image.dataset.src || image.hasAttribute('src')) continue;
        image.src = image.dataset.src;
        void image.decode().then(() => {
          if (!disposed) image.classList.add('is-ready');
        }).catch(() => {
          if (!disposed) image.removeAttribute('src');
        });
      }
    }
  }

  function schedule(): void {
    window.clearTimeout(timer);
    if (!disposed && !document.hidden) timer = window.setTimeout(sync, Math.max(1000, lastAttempt + REFRESH_MS - Date.now()));
  }

  async function refresh(): Promise<void> {
    lastAttempt = Date.now();
    request = new AbortController();
    requestTimeout = window.setTimeout(() => request?.abort(), 10_000);
    try {
      const response = await fetch(WEATHER_URL, { signal: request.signal });
      if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
      const payload: unknown = await response.json();
      const next = parseSceneWeather(payload);
      if (disposed) return;
      weather = next;
      failed = false;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), payload })); } catch { /* Optional cache. */ }
    } catch {
      if (!disposed) failed = true;
    } finally {
      window.clearTimeout(requestTimeout);
      requestTimeout = undefined;
      request = undefined;
      if (!disposed) { render(); schedule(); }
    }
  }

  function sync(): void {
    window.clearTimeout(timer);
    if (disposed || document.hidden) return;
    render();
    if (!request && Date.now() - lastAttempt >= REFRESH_MS) void refresh();
    else if (!request) schedule();
  }

  function changeMode(event: Event): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-weather-mode]');
    if (!button || !controls!.contains(button)) return;
    const value = button.dataset.weatherMode;
    mode = value === 'clear' || value === 'cloudy' || value === 'rain' || value === 'snow' ? value : 'live';
    render();
    sync();
  }

  function changeWind(event: Event): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-wind-mode]');
    if (!button || !windControls!.contains(button)) return;
    const value = button.dataset.windMode;
    windMode = value === 'calm' || value === 'breezy' || value === 'windy' ? value : 'live';
    render();
    sync();
  }

  buttons.forEach(button => { button.disabled = false; });
  windButtons.forEach(button => { button.disabled = false; });
  controls.addEventListener('click', changeMode);
  windControls?.addEventListener('click', changeWind);
  document.addEventListener('visibilitychange', sync);
  render();
  sync();
  return () => {
    disposed = true;
    request?.abort();
    window.clearTimeout(requestTimeout);
    window.clearTimeout(timer);
    controls.removeEventListener('click', changeMode);
    windControls?.removeEventListener('click', changeWind);
    document.removeEventListener('visibilitychange', sync);
    buttons.forEach(button => { button.disabled = true; });
    windButtons.forEach(button => { button.disabled = true; });
    activeVisual = fallback;
  };
}
