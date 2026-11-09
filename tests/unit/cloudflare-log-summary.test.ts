import { scheduledSummary } from '../../workers/data-refresh/scripts/summarize-tail.mjs';

it('omits HTTP events including all visitor request details', () => {
  expect(scheduledSummary({ outcome: 'ok', event: { request: {
    url: 'https://example.workers.dev/data/snapshot.json', headers: { 'cf-connecting-ip': 'fixture-private-ip' },
  } } })).toBeUndefined();
});

it('extracts Cron timings and known pipeline states while dropping raw diagnostics and messages', () => {
  const result = scheduledSummary({ event: { cron: '*/15 * * * *', private: 'fixture-private' },
    outcome: 'ok', cpuTime: 12, wallTime: 1351, private: 'fixture-private', exceptions: [], logs: [
      { message: ['fixture-private'] }, { message: ['Data refresh: model fulfilled, monitoring fulfilled.'] },
    ] });
  expect(result).toEqual({ cron: '*/15 * * * *', cpuTimeMs: 12, wallTimeMs: 1351, outcome: 'ok',
    exceptionCount: 0, model: 'fulfilled', monitoring: 'fulfilled' });
  expect(JSON.stringify(result)).not.toContain('fixture-private');
});

it('retains a failed Cron outcome without publishing its raw exception or invalid metrics', () => {
  const result = scheduledSummary({ event: { cron: '*/15 * * * *' }, outcome: 'exceededCpu',
    cpuTime: NaN, wallTime: -1, exceptions: [{ message: 'fixture-private' }], logs: [] });
  expect(result).toEqual({ cron: '*/15 * * * *', cpuTimeMs: undefined, wallTimeMs: undefined,
    outcome: 'exceededCpu', exceptionCount: 1 });
  expect(JSON.stringify(result)).not.toContain('fixture-private');
});
