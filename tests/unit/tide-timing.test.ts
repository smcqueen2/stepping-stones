import { coastalTideTiming } from '../../scripts/lib/tide-timing.mjs';
import { tideSummary } from '../../src/lib/tide-timing';
import type { TideTiming } from '../../src/lib/types';

const now = Date.parse('2026-11-07T00:00:00Z');
const iso = (minutes: number) => new Date(now + minutes * 60000).toISOString();
function timing(): TideTiming {
  return { generatedAt: iso(-5), source: 'Open-Meteo Marine', location: 'Ogmore coast', latitude: 51.458, longitude: -3.708,
    validFrom: iso(-1440), validTo: iso(2880), events: [
      { type: 'low', time: iso(-120) }, { type: 'high', time: iso(240) },
      { type: 'low', time: iso(630) }, { type: 'high', time: iso(990) },
      { type: 'low', time: iso(1380) }, { type: 'high', time: iso(1740) },
    ] };
}

describe('coastal tide display', () => {
  it('shows a rounded high-tide countdown and the next low while coming in', () => {
    expect(tideSummary(timing(), now)).toEqual({ available: true, status: 'Coming in', high: 'High tide ~04:00',
      countdown: 'About 4h until high tide', low: 'Next low ~10:30' });
    expect(tideSummary(timing(), now + 37 * 60000).countdown).toBe('About 3h 30m until high tide');
  });
  it('shows the upcoming low and following high while going out', () => {
    expect(tideSummary({ ...timing(), generatedAt: iso(300) }, now + 300 * 60000)).toMatchObject({
      status: 'Going out', high: 'High tide ~16:30', countdown: 'About 11h 30m until high tide', low: 'Next low ~10:30' });
  });
  it('uses around-high/low wording near turns and rolls to the following high afterward', () => {
    expect(tideSummary(timing(), now + 215 * 60000)).toMatchObject({ status: 'Around high tide', countdown: 'High tide around now' });
    expect(tideSummary(timing(), now + 260 * 60000)).toMatchObject({ status: 'Around high tide', high: 'High tide ~04:00' });
    expect(tideSummary(timing(), now + 271 * 60000)).toMatchObject({ status: 'Going out', high: 'High tide ~16:30' });
    expect(tideSummary(timing(), now - 100 * 60000).available).toBe(false); // generation is still in the future
    expect(tideSummary({ ...timing(), generatedAt: iso(-130) }, now - 100 * 60000).status).toBe('Around low tide');
  });
  it('uses Welsh local time across the BST/GMT change and distinguishes different dates', () => {
    const autumn = Date.parse('2026-10-25T00:30:00Z');
    const data = timing();
    data.generatedAt = new Date(autumn - 60000).toISOString();
    data.validFrom = '2026-10-24T00:00:00Z'; data.validTo = '2026-10-26T23:00:00Z';
    data.events = [{ type: 'low', time: '2026-10-24T20:00:00Z' }, { type: 'high', time: '2026-10-25T02:00:00Z' },
      { type: 'low', time: '2026-10-25T08:30:00Z' }];
    expect(tideSummary(data, autumn)).toMatchObject({ high: 'High tide ~02:00', low: 'Next low ~08:30', countdown: 'About 1h 30m until high tide' });
  });
  it('rolls the next low forward at a turn and does not substitute a past low for missing future coverage', () => {
    expect(tideSummary({ ...timing(), generatedAt: iso(630) }, now + 630 * 60000)).toMatchObject({
      status: 'Around low tide', low: 'Next low ~23:00' });
    expect(tideSummary({ ...timing(), events: timing().events.slice(0, 2) }, now)).toMatchObject({
      available: true, high: 'High tide ~04:00', low: 'Next low time unavailable' });
  });
  it('clears times for expired, future, missing, malformed or incomplete forecasts', () => {
    const invalid = [undefined, { ...timing(), generatedAt: iso(-361) }, { ...timing(), generatedAt: iso(11) },
      { ...timing(), validTo: iso(-1) }, { ...timing(), generatedAt: 'bad' }, { ...timing(), events: [] },
      { ...timing(), events: timing().events.slice(1) },
      { ...timing(), events: [{ type: 'high', time: iso(-60) }, ...timing().events.slice(1)] },
      { ...timing(), events: [{ type: 'low', time: iso(-1000) }, ...timing().events.slice(1)] }];
    invalid.forEach(data => expect(tideSummary(data as TideTiming, now)).toMatchObject({ available: false, countdown: '', low: '' }));
  });
});

describe('hourly coastal forecast timing extraction', () => {
  const response = () => ({ latitude: 51.458, longitude: -3.708, hourly_units: { time: 'unixtime', sea_level_height_msl: 'm' },
    hourly: { time: Array.from({ length: 96 }, (_, i) => now / 1000 - 86400 + i * 3600),
      sea_level_height_msl: Array.from({ length: 96 }, (_, i) => 3 * Math.cos((i - 3.35) * Math.PI / 6)) } });
  it('interpolates turning points, rounds to half-hours and retains model provenance', () => {
    const data = coastalTideTiming(response(), iso(0));
    expect(data).toMatchObject({ source: 'Open-Meteo Marine', location: 'Ogmore coast', latitude: 51.458, longitude: -3.708 });
    expect(data.events[0]).toEqual({ type: 'high', time: iso(-1230) });
    expect(data.events[1]).toEqual({ type: 'low', time: iso(-870) });
    expect(tideSummary(data, now).available).toBe(true);
    expect(data.events.every((event: { time: string }) => Date.parse(event.time) % 1800000 === 0)).toBe(true);
  });
  it('does not turn null levels or irregular steps into tide events', () => {
    const missing = response();
    missing.hourly.sea_level_height_msl[3] = null as unknown as number;
    expect(coastalTideTiming(missing, iso(0)).events[0].type).toBe('low');
    const gap = response(); gap.hourly.time[3] += 1200;
    expect(coastalTideTiming(gap, iso(0)).events[0].type).toBe('low');
  });
  it('rejects wrong units, absent arrays and forecasts without future coverage', () => {
    expect(coastalTideTiming({}, iso(0))).toBeUndefined();
    const units = response(); units.hourly_units.time = 'iso8601';
    expect(coastalTideTiming(units, iso(0))).toBeUndefined();
    const short = response(); short.hourly.time = short.hourly.time.slice(0, 36); short.hourly.sea_level_height_msl = short.hourly.sea_level_height_msl.slice(0, 36);
    expect(coastalTideTiming(short, iso(0))).toBeUndefined();
    const noTides = response(); noTides.hourly.sea_level_height_msl.fill(0);
    expect(coastalTideTiming(noTides, iso(0))).toBeUndefined();
  });
});
