import feed from '../fixtures/nrw-warning-feed.json';
import { NRW_WARNING_ENDPOINT, fetchWarnings, parseWarningFeed } from '../../scripts/lib/nrw-warnings.mjs';

const now = new Date('2026-11-07T12:00:00Z');
const fixture = () => structuredClone(feed);

it('parses the documented v3 fields and keeps observation, severity and check times distinct', () => {
  const warnings = parseWarningFeed(fixture(), now);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatchObject({ areaId: '102FWB402A', severity: 2, severityName: 'Flood Warning', tidal: true,
    scope: 'local', raisedAt: '2026-11-06T09:00:00.000Z', updatedAt: '2026-11-07T10:00:00.000Z',
    sourceUrl: 'https://flood-warning.naturalresources.wales/Detail/102FWB402A' });
});

it.each([
  [1, 'Severe Flood Warning'], [2, 'Flood Warning'], [3, 'Flood Alert'], [4, 'Warning no Longer in Force'],
])('recognises severity %i including recently withdrawn warnings', (severity, name) => {
  const data = fixture(); Object.assign(data.features[0].properties, { SEVERITYVALUE: severity, SEVERITY: name });
  expect(parseWarningFeed(data, now)[0].severity).toBe(severity);
});

it('only monitors the explicit local, catchment and coastal areas, not unrelated warnings', () => {
  const data = fixture(); const other = structuredClone(data.features[0]);
  other.properties.FWACODE = 'OTHER-AREA'; other.properties.SEVERITYVALUE = 1; other.properties.SEVERITY = 'Severe Flood Warning';
  data.features.push(other);
  expect(parseWarningFeed(data, now)).toHaveLength(1);
  data.features[0].properties.FWACODE = '102FWB108A';
  expect(parseWarningFeed(data, now)[0]).toMatchObject({ areaName: 'River Ewenny at Ewenny Village', scope: 'local' });
  data.features[0].properties.FWACODE = '102WABF20';
  expect(parseWarningFeed(data, now)[0].scope).toBe('catchment');
  data.features[0].properties.FWACODE = '102WABT04';
  expect(parseWarningFeed(data, now)[0].scope).toBe('coast');
});

it('accepts a complete empty feed but rejects malformed, duplicate and partial feeds', () => {
  expect(parseWarningFeed({ type: 'FeatureCollection', features: [] }, now)).toEqual([]);
  for (const data of [{}, { features: [] }, { type: 'FeatureCollection' },
    { type: 'FeatureCollection', features: [], nextLink: '/page2' },
    { type: 'FeatureCollection', features: [], links: [{ rel: 'next', href: '/page2' }] },
    { type: 'FeatureCollection', features: [], numberMatched: 1 },
    { type: 'FeatureCollection', features: [null] }, { type: 'FeatureCollection', features: [...fixture().features, ...fixture().features] }]) {
    expect(() => parseWarningFeed(data, now)).toThrow();
  }
});

it.each(['unknown severity', 'mismatched severity', 'missing message', 'unqualified timestamp', 'future timestamp'])('rejects %s instead of claiming no warning', problem => {
  const data = fixture(); const p = data.features[0].properties;
  if (problem === 'unknown severity') p.SEVERITYVALUE = 9;
  if (problem === 'mismatched severity') p.SEVERITY = 'Flood Alert';
  if (problem === 'missing message') p.RIM_ENGLISH = '';
  if (problem === 'unqualified timestamp') p.RIM_CHANGED = '2026-11-07T10:00:00';
  if (problem === 'future timestamp') p.RIM_CHANGED = '2026-11-08T10:00:00Z';
  expect(() => parseWarningFeed(data, now)).toThrow();
});

it('uses a request header for the subscription key and never exports it', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture())));
  const result = await fetchWarnings({ key: 'fixture-only-not-a-key', fetcher, now });
  expect(fetcher.mock.calls[0][0]).toBe(NRW_WARNING_ENDPOINT);
  expect(fetcher.mock.calls[0][1].headers['Ocp-Apim-Subscription-Key']).toBe('fixture-only-not-a-key');
  expect(result).toMatchObject({ status: 'available', checkedAt: now.toISOString() });
  expect(JSON.stringify(result)).not.toContain('fixture-only-not-a-key');
});

it.each([401, 403, 429, 500])('treats HTTP %i as unavailable while retaining the last known warning', async status => {
  const previous = { status: 'available', checkedAt: '2026-11-07T11:00:00Z', warnings: parseWarningFeed(fixture(), now) };
  const fetcher = vi.fn().mockResolvedValue(new Response('failure', { status }));
  expect(await fetchWarnings({ key: 'fixture', previous, fetcher, now })).toMatchObject({ status: 'unavailable', lastKnown: { checkedAt: previous.checkedAt, warnings: previous.warnings } });
});

it('never makes a missing key, timeout, bad JSON or cached response look like a clean check', async () => {
  const fetcher = vi.fn();
  expect(await fetchWarnings({ fetcher, now })).toMatchObject({ status: 'unavailable', reason: 'not-configured' });
  expect(fetcher).not.toHaveBeenCalled();
  for (const response of [new Response('not json'), new Response(JSON.stringify({})), new Response(JSON.stringify(fixture()), { headers: { age: '1800' } }),
    new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 206 })]) {
    expect((await fetchWarnings({ key: 'fixture', fetcher: vi.fn().mockResolvedValue(response), now })).status).toBe('unavailable');
  }
  const timeout = vi.fn().mockRejectedValue(new Error('timeout with fixture-only-not-a-key'));
  const result = await fetchWarnings({ key: 'fixture-only-not-a-key', fetcher: timeout, now });
  expect(result.status).toBe('unavailable');
  expect(JSON.stringify(result)).not.toContain('fixture-only-not-a-key');
});
