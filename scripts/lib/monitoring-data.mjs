import { LOCAL_STATIONS, fetchLocalGauge } from './local-monitoring.mjs';
import { fetchWarnings } from './nrw-warnings.mjs';
import { createTimestampParser } from './recent-levels.mjs';

/** Runtime-independent payload builder shared by Actions and the scheduled Worker. */
export async function buildMonitoringData({ key, previous, now = new Date(), fetcher = fetch } = {}) {
  const parseTime = createTimestampParser();
  const fetchJson = async url => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'User-Agent': 'stepping-stones-data-generator/1.2' } });
    if (!response.ok) throw new Error('NRW gauge request failed');
    return response.json();
  };
  const [ewenny, downstream, floodWarnings] = await Promise.all([
    fetchLocalGauge(LOCAL_STATIONS.ewenny, fetchJson, now, parseTime),
    fetchLocalGauge(LOCAL_STATIONS.downstream, fetchJson, now, parseTime),
    fetchWarnings({ key, previous, fetcher, now }),
  ]);
  return { schemaVersion: 1, generatedAt: now.toISOString(), gauges: { ewenny, downstream }, floodWarnings };
}
