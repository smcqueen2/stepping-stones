import { newReportId, parseReportSummary, reportsEndpoint } from '../../src/lib/report-contract';
const now = Date.parse('2026-11-11T20:00:00Z');
const value = () => ({ schemaVersion: 1, generatedAt: new Date(now).toISOString(), windowStart: new Date(now - 3_600_000).toISOString(),
  counts: [0, 0, 1, 0, 0], total: 1, lastReportAt: new Date(now - 1000).toISOString(), siteKey: '0x4AAAAAAA-public-fixture' });
it('creates secure version-four UUIDs on LAN HTTP when randomUUID is unavailable', () => {
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal('crypto', { getRandomValues });
  try {
    const first = newReportId();
    expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(newReportId()).not.toBe(first);
  } finally { vi.unstubAllGlobals(); }
});
it('accepts recent coherent summaries, including a confirmed empty hour', () => {
  expect(parseReportSummary(value(), now).total).toBe(1);
  expect(parseReportSummary({ ...value(), counts: [0, 0, 0, 0, 0], total: 0, lastReportAt: null }, now).total).toBe(0);
});
it.each([{ total: 3 }, { counts: [-1, 0, 2, 0, 0] }, { generatedAt: new Date(now - 180_000).toISOString() },
  { generatedAt: new Date(now + 60_000).toISOString() }, { windowStart: 'bad' }, { lastReportAt: null }, { siteKey: '' }])('rejects invalid summary %j', changes => {
  expect(() => parseReportSummary({ ...value(), ...changes }, now)).toThrow();
});
it('rejects credential-bearing endpoints and allows public HTTPS or local previews', () => {
  expect(reportsEndpoint('')).toBeUndefined();
  expect(reportsEndpoint('/api/reports')).toBe('/api/reports');
  expect(reportsEndpoint('https://reports.example/api/reports')).toBe('https://reports.example/api/reports');
  expect(reportsEndpoint('http://127.0.0.1:8788/api/reports')).toContain('127.0.0.1');
  for (const endpoint of ['https://name:secret@reports.example/api/reports', 'https://reports.example/api/reports?key=secret',
    'http://reports.example/api/reports', '/other', 'https://reports.example/other']) expect(() => reportsEndpoint(endpoint)).toThrow();
});
