import { getPosition } from 'suncalc';

export const SCENE_TIME_ZONE = 'Europe/London';
// The same Ogmore location used by the rainfall data generator.
const LOCATION = { latitude: 51.4759, longitude: -3.6206 };
const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCENE_TIME_ZONE, hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});

export type ScenePhase = 'dawn' | 'day' | 'dusk' | 'night';
export type LightingMode = 'live' | ScenePhase;
const labels: Record<ScenePhase, string> = {
  dawn: 'Dawn', day: 'Daylight', dusk: 'Dusk', night: 'Night',
};
const previewAltitude: Record<ScenePhase, number> = { dawn: -1, day: 35, dusk: 1, night: -18 };

function smoothstep(low: number, high: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}

export function getSceneLighting(date: Date, mode: LightingMode = 'live') {
  const sun = getPosition(date, LOCATION.latitude, LOCATION.longitude);
  const altitude = mode === 'live' ? sun.altitude : previewAltitude[mode];
  const morning = mode === 'dawn' || (mode === 'live' && sun.azimuth < 180);
  const daylight = smoothstep(-8, 12, altitude);
  const phase: ScenePhase = altitude <= -8 ? 'night' : altitude < 8 ? morning ? 'dawn' : 'dusk' : 'day';

  return {
    phase,
    clock: clock.format(date),
    label: mode === 'live' ? labels[phase] : `${labels[phase]} preview`,
    brightness: 0.64 + daylight * 0.36,
    saturation: 0.72 + daylight * 0.28,
    night: (1 - smoothstep(-10, -1, altitude)) * 0.64,
    twilight: smoothstep(-9, -1, altitude) * (1 - smoothstep(3, 12, altitude)) * 0.9,
    stars: 1 - smoothstep(-12, -4, altitude),
    glowX: morning ? '18%' : '82%',
  };
}

/** Colour the complete painting, including the WebGL water and trees. */
export function installSceneLighting(): () => void {
  const hero = document.querySelector<HTMLElement>('.hero-art');
  const control = document.querySelector<HTMLSelectElement>('#scene-lighting');
  const time = document.querySelector<HTMLTimeElement>('#scene-local-time');
  const phase = document.querySelector<HTMLElement>('#scene-light-label');
  if (!hero || !control || !time || !phase) return () => {};

  let mode: LightingMode = 'live';
  let timer: number | undefined;

  function update(): void {
    const now = new Date();
    const light = getSceneLighting(now, mode);
    hero!.dataset.lighting = light.phase;
    hero!.dataset.lightingMode = mode;
    hero!.style.setProperty('--scene-brightness', light.brightness.toFixed(4));
    hero!.style.setProperty('--scene-saturation', light.saturation.toFixed(4));
    hero!.style.setProperty('--scene-night', light.night.toFixed(4));
    hero!.style.setProperty('--scene-twilight', light.twilight.toFixed(4));
    hero!.style.setProperty('--scene-stars', light.stars.toFixed(4));
    hero!.style.setProperty('--scene-glow-x', light.glowX);
    time!.dateTime = now.toISOString();
    time!.textContent = light.clock;
    phase!.textContent = light.label;
  }

  function sync(): void {
    window.clearTimeout(timer);
    timer = undefined;
    if (document.hidden) return;
    update();
    // Align to the clock minute, and recalculate immediately when returning.
    timer = window.setTimeout(sync, 60_000 - Date.now() % 60_000);
  }

  function changeMode(): void {
    const value = control!.value;
    mode = value === 'dawn' || value === 'day' || value === 'dusk' || value === 'night' ? value : 'live';
    update();
  }

  control.value = 'live';
  control.disabled = false;
  control.addEventListener('change', changeMode);
  document.addEventListener('visibilitychange', sync);
  update();
  sync();

  return () => {
    window.clearTimeout(timer);
    control.disabled = true;
    control.removeEventListener('change', changeMode);
    document.removeEventListener('visibilitychange', sync);
  };
}
