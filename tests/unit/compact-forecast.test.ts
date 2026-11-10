import { buildModelData } from '../../scripts/lib/model-data.mjs';
import config from '../../public/data/config.json';

const now = new Date('2026-11-10T12:00:00Z');
afterEach(() => vi.restoreAllMocks());

function provider(urlValue: string) {
  const url = new URL(urlValue);
  if (url.pathname.startsWith('/Station/GetData/')) {
    const river = url.pathname.endsWith('/4083');
    return { id: river ? 4083 : 72839, title: { english: river ? 'Bridgend' : 'Newport' },
      parameters: [{ id: river ? 110 : 10254, typeText: { english: river ? 'River Level' : 'Tide Level' },
        latestTime: '2026-11-10T11:45:00Z', latestValue: .4, unit: river ? 'm' : 'mAOD' }] };
  }
  if (url.pathname === '/graph/getdata') return { data: Array.from({ length: 192 }, (_, i) => ({
    x: new Date(now.getTime() - (192 - i) * 900000).toISOString(),
    y: url.searchParams.get('parameterId') === '110' ? .2 + i / 1000 : Math.cos(i * Math.PI / 25),
  })) };
  if (url.hostname === 'api.open-meteo.com') return { hourly: {
    time: Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 10, 10, i)).toISOString().slice(0, 16)),
    rain: Array.from({ length: 48 }, (_, i) => i % 4 / 10), precipitation_probability: Array(48).fill(30),
  } };
  if (url.hostname === 'marine-api.open-meteo.com') return { latitude: 51.461, longitude: -3.631,
    hourly_units: { time: 'unixtime', sea_level_height_msl: 'm' }, hourly: {
      time: Array.from({ length: 96 }, (_, i) => now.getTime() / 1000 - 86400 + i * 3600),
      sea_level_height_msl: Array.from({ length: 96 }, (_, i) => Math.cos(i * Math.PI / 6)),
    } };
  throw new Error('Unexpected fixture request');
}

it('omits only unused summary metadata while retaining every prediction and avoiding locale formatting', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
  const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(provider(url))));
  const full = await buildModelData({ config, now, fetcher });
  expect(full.forecast.summary.highestRiskWindow).toBeTruthy();
  const { summary, ...forecast } = full.forecast;
  const descriptor = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, 'format')!;
  const formatting = vi.fn(() => { throw new Error('Compact forecasts must not format legacy summaries'); });
  Object.defineProperty(Intl.DateTimeFormat.prototype, 'format', { configurable: true, get: formatting });
  try {
    const compact = await buildModelData({ config, now, fetcher, includeSummary: false });
    expect(compact).toEqual({ ...full, forecast });
    expect(compact.forecast.hours).toHaveLength(24);
    expect(compact.forecast).not.toHaveProperty('summary');
    expect(formatting).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(Intl.DateTimeFormat.prototype, 'format', descriptor);
  }
});
