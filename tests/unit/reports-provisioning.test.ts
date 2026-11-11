import { readFileSync } from 'node:fs';
import { databaseName, provisionReports, reportsConfig } from '../../workers/reports/scripts/provision.mjs';
const accountId = 'a'.repeat(32);
const id = '11111111-1111-4111-8111-111111111111';
const token = 'fixture-only';
const database = { uuid: id, name: databaseName };
const reply = (result: unknown, status = 200) => Response.json({ success: status === 200, result }, { status });
it('reuses named D1 storage without changing resources', async () => {
  const fetcher = vi.fn().mockResolvedValue(reply([database]));
  expect(await provisionReports({ accountId, token, fetcher })).toEqual({ id, created: false });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('creates only the dedicated database after a successful empty list', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply([])).mockResolvedValueOnce(reply(database));
  expect(await provisionReports({ accountId, token, fetcher })).toEqual({ id, created: true });
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ name: databaseName, primary_location_hint: 'weur' });
});
it('fails closed on denied access, malformed results, missing storage and unrelated databases', async () => {
  for (const response of [reply([], 403), reply({}), reply([]), reply([{ ...database, name: 'other-application' }])]) {
    const fetcher = vi.fn().mockResolvedValue(response);
    await expect(provisionReports({ accountId, token, databaseId: id, fetcher })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});
it('does not retry an uncertain create or disclose its private error', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply([])).mockRejectedValue(new Error(token));
  await expect(provisionReports({ accountId, token, fetcher })).rejects.toThrow('no automatic create retry');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('copies only public deployment settings and rejects test/local configurations', () => {
  const template = JSON.parse(readFileSync('workers/reports/wrangler.json', 'utf8'));
  const settings = { accountId, databaseId: id, siteKey: '0x4AAAAAAA-production-public-fixture', token };
  const config = reportsConfig(template, settings);
  expect(JSON.stringify(config)).not.toContain(token);
  expect(config.d1_databases[0].database_id).toBe(id);
  expect(() => reportsConfig(template, { ...settings, siteKey: '1x00000000000000000000AA' })).toThrow('test keys');
  expect(() => reportsConfig({ ...template, vars: { LOCAL_DEVELOPMENT: 'true' } }, settings)).toThrow('non-production');
});
