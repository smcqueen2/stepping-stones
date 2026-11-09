import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Publish only scheduled-execution metrics, never HTTP request/visitor metadata or raw logs. */
export function scheduledSummary(trace) {
  if (trace?.event?.cron !== '*/15 * * * *') return undefined;
  const metric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
  const outcomes = ['ok', 'exception', 'exceededCpu', 'exceededMemory', 'canceled'];
  const result = { cron: '*/15 * * * *', cpuTimeMs: metric(trace.cpuTime), wallTimeMs: metric(trace.wallTime),
    outcome: outcomes.includes(trace.outcome) ? trace.outcome : 'unknown',
    exceptionCount: Array.isArray(trace.exceptions) ? trace.exceptions.length : undefined };
  for (const log of trace.logs ?? []) {
    for (const message of log.message ?? []) {
      if (typeof message !== 'string') continue;
      const match = /^Data refresh: model (fulfilled|rejected), monitoring (fulfilled|rejected)\.$/.exec(message);
      if (match) return { ...result, model: match[1], monitoring: match[2] };
    }
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let buffer = '', count = 0;
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    if (!buffer && !line.trimStart().startsWith('{')) continue;
    buffer += line + '\n';
    if (buffer.length > 1024 * 1024) { buffer = ''; console.error('Skipped oversized runtime event.'); continue; }
    let trace;
    try { trace = JSON.parse(buffer); } catch { continue; }
    buffer = '';
    const summary = scheduledSummary(trace);
    if (summary) {
      console.log(JSON.stringify(summary)); count++;
      if (summary.outcome !== 'ok') process.exitCode = 1;
    }
  }
  console.log(count ? `Observed ${count} scheduled execution(s).` : 'No scheduled execution observed in this window.');
}
