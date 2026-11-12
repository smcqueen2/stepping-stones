import type { TideTiming } from './types';

const minute = 60_000;
const halfHour = 30 * minute;
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const day = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/London' });
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });

export function tideSummary(timing: TideTiming | undefined, now: number) {
  const unavailable = { available: false, status: 'Times unavailable', high: 'High tide time unavailable', countdown: '', low: '' };
  if (!timing || timing.source !== 'Open-Meteo Marine') return unavailable;
  const generated = Date.parse(timing.generatedAt);
  const from = Date.parse(timing.validFrom);
  const to = Date.parse(timing.validTo);
  // Forecast timings have their own freshness; they do not inherit river telemetry age.
  if (![now, generated, from, to].every(Number.isFinite) || now - generated > 6 * 60 * minute
      || generated > now + 10 * minute || now < from || now >= to || !Array.isArray(timing.events)) return unavailable;
  const events = timing.events.map(event => ({ type: event?.type, at: Date.parse(event?.time) }));
  if (events.some((event, i) => !['high', 'low'].includes(event.type) || !Number.isFinite(event.at)
      || event.at < from || event.at > to || i > 0 && (event.at <= events[i - 1].at
        || event.type === events[i - 1].type || event.at - events[i - 1].at > 9 * 60 * minute
        || event.at - events[i - 1].at < 3 * 60 * minute))) return unavailable;
  const previous = [...events].reverse().find(event => event.at <= now);
  const next = events.find(event => event.at > now);
  const high = events.find(event => event.type === 'high' && event.at >= now - halfHour);
  if (!previous || !next || !high) return unavailable;
  const near = events.find(event => Math.abs(event.at - now) <= halfHour);
  const low = events.find(event => event.type === 'low' && event.at > now);
  const at = (time: number) => `${day.format(time) === day.format(now) ? '' : `${date.format(time)} · `}${clock.format(time)}`;
  const minutes = Math.max(30, Math.round((high.at - now) / halfHour) * 30);
  const duration = `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h` : ''}${minutes % 60 ? `${minutes >= 60 ? ' ' : ''}${minutes % 60}m` : ''}`;
  return {
    available: true,
    status: near ? `Around ${near.type} tide` : next.type === 'high' ? 'Coming in' : 'Going out',
    high: `High tide ~${at(high.at)}`,
    countdown: Math.abs(high.at - now) <= halfHour ? 'High tide around now' : `About ${duration} until high tide`,
    low: low ? `Next low ~${at(low.at)}` : 'Next low time unavailable',
  };
}
