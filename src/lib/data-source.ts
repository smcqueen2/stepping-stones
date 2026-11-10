import type { ConfigPayload, ForecastPayload, LivePayload, MonitoringPayload } from './types';

type DataResults = {
  live: PromiseSettledResult<LivePayload>;
  forecast: PromiseSettledResult<ForecastPayload>;
  config: PromiseSettledResult<ConfigPayload>;
  monitoring: PromiseSettledResult<MonitoringPayload>;
};

/** This build setting is a public endpoint, never an API key. Blank retains GitHub Pages data. */
export function dataEndpoint(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error('The data endpoint is not a valid URL.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/data/snapshot.json') {
    throw new Error('The data endpoint must be an HTTPS snapshot URL without credentials, query or fragment.');
  }
  return url.href;
}

const valid = {
  live: (value: any) => Boolean(value?.freshness && value?.current && Array.isArray(value?.sourceStations)),
  forecast: (value: any) => Array.isArray(value?.hours),
  config: (value: any) => typeof value?.freshness?.staleAfterMinutes === 'number',
  monitoring: (value: any) => Boolean(value?.schemaVersion === 1 && value?.gauges && value?.floodWarnings),
};
function part<T>(value: unknown, check: (value: any) => boolean): PromiseSettledResult<T> {
  return check(value) ? { status: 'fulfilled', value: value as T }
    : { status: 'rejected', reason: new Error('Data section unavailable') };
}

export async function loadData({ base, endpoint, signal, fetcher = fetch }: {
  base: string; endpoint?: string; signal: AbortSignal; fetcher?: typeof fetch;
}): Promise<DataResults> {
  const json = async (url: string) => {
    const response = await fetcher(url, { cache: 'no-store', signal, credentials: 'omit' });
    if (!response.ok) throw new Error('Data request failed: ' + response.status);
    return response.json();
  };
  const remote = dataEndpoint(endpoint);
  if (remote) {
    const snapshot = await json(remote);
    const refreshed = Date.parse(snapshot?.refreshedAt);
    if (snapshot?.schemaVersion !== 1 || !Number.isFinite(refreshed) || refreshed > Date.now() + 10 * 60000) {
      throw new Error('Snapshot could not be verified');
    }
    // One request returns the latest saved sections; their data clocks expire independently.
    return { live: part(snapshot.live, valid.live), forecast: part(snapshot.forecast, valid.forecast),
      config: part(snapshot.config, valid.config), monitoring: part(snapshot.monitoring, valid.monitoring) };
  }
  const [live, forecast, config, monitoring] = await Promise.allSettled([
    json(base + 'live.json'), json(base + 'forecast.json'), json(base + 'config.json'), json(base + 'monitoring.json'),
  ]);
  return {
    live: live.status === 'fulfilled' ? part(live.value, valid.live) : live,
    forecast: forecast.status === 'fulfilled' ? part(forecast.value, valid.forecast) : forecast,
    config: config.status === 'fulfilled' ? part(config.value, valid.config) : config,
    monitoring: monitoring.status === 'fulfilled' ? part(monitoring.value, valid.monitoring) : monitoring,
  };
}
