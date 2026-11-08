import { LOCAL_STATIONS, fetchLocalGauge } from './local-monitoring.mjs';
import { fetchWarnings } from './nrw-warnings.mjs';

/** Runtime-independent payload builder shared by Actions and the scheduled Worker. */
export async function buildMonitoringData({ key, previous, now = new Date(), fetcher = fetch } = {}) {
  const fetchJson = async url => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'User-Agent': 'stepping-stones-data-generator/1.2' } });
    if (!response.ok) throw new Error('NRW gauge request failed');
    return response.json();
  };
  const [ewenny, downstream, floodWarnings] = await Promise.all([
    fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now),
    fetchLocalGauge(LOCAL_STATIONS.downstream, fetchJson, now),
    fetchWarnings({ key, previous, fetcher, now }),
  ]);
  return { schemaVersion: 1, generatedAt: now.toISOString(), gauges: { ewenny, downstream }, floodWarnings };
}
