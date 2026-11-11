export const observationConditions = [
  ['Completely submerged', 'Unpassable. All the stones are under water.'],
  ['Mostly submerged', 'Unpassable. Most of the stones are under water.'],
  ['Partly submerged', 'Water is covering some of the stone tops.'],
  ['Mostly clear', 'Most stone tops are visible, with water over a few.'],
  ['Stones clear', 'The stone tops are clear of the water.'],
] as const;

export interface ReportSummary {
  schemaVersion: 1;
  generatedAt: string;
  windowStart: string;
  total: number;
  counts: number[];
  lastReportAt: string | null;
  siteKey: string;
}

/** getRandomValues remains available on LAN HTTP, where randomUUID may be absent. */
export function newReportId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Reject credentials and query strings before a setting can enter the public bundle. */
export function reportsEndpoint(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  if (value === '/api/reports') return value;
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password
    || url.search || url.hash || url.pathname !== '/api/reports') throw new Error('Invalid public reports endpoint.');
  return url.href;
}

export function parseReportSummary(value: unknown, now = Date.now()): ReportSummary {
  const data = value as Partial<ReportSummary> | null;
  const generated = Date.parse(data?.generatedAt || '');
  const start = Date.parse(data?.windowStart || '');
  if (!data || data.schemaVersion !== 1 || !Number.isFinite(generated) || generated > now + 30_000
    || now - generated > 120_000 || generated - start !== 3_600_000
    || !Number.isSafeInteger(data.total) || data.total! < 0 || !Array.isArray(data.counts) || data.counts.length !== 5
    || data.counts.some(count => !Number.isSafeInteger(count) || count < 0)
    || data.counts.reduce((a, b) => a + b, 0) !== data.total
    || typeof data.siteKey !== 'string' || !/^[a-z0-9_-]{20,100}$/i.test(data.siteKey)
    || (data.total === 0 ? data.lastReportAt !== null
      : !Number.isFinite(Date.parse(data.lastReportAt || '')) || Date.parse(data.lastReportAt!) <= start || Date.parse(data.lastReportAt!) > generated)) {
    throw new Error('Recent observation summary unavailable.');
  }
  return data as ReportSummary;
}
