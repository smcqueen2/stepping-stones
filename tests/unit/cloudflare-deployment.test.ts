import { deploymentConfig } from '../../workers/data-refresh/scripts/prepare-ci-config.mjs';
import { deploymentDetails } from '../../workers/data-refresh/scripts/check-hosted-config.mjs';
import template from '../../workers/data-refresh/wrangler.json';

const accountId = 'a'.repeat(32);
const namespaceId = 'b'.repeat(32);

it('reads the official nested schedules API result and enabled public address', () => {
  expect(deploymentDetails({ subdomain: 'example' }, { subdomain: { enabled: true } },
    { schedules: [{ cron: '*/15 * * * *', created_on: '2026-11-09T22:42:00Z' }] })).toEqual({
      endpoint: 'https://stepping-stones-data.example.workers.dev/data/snapshot.json', cron: '*/15 * * * *',
    });
});

it('does not verify absent, conflicting, or malformed schedules', () => {
  for (const result of [undefined, [], { schedules: [] }, { schedules: [{ cron: '* * * * *' }] },
    { schedules: [{ cron: '*/15 * * * *' }, { cron: '* * * * *' }] }]) {
    expect(() => deploymentDetails({ subdomain: 'example' }, { subdomain: { enabled: true } }, result)).toThrow('schedule');
  }
});

it('does not verify a disabled route or malformed hostname', () => {
  const schedules = { schedules: [{ cron: '*/15 * * * *' }] };
  expect(() => deploymentDetails({ subdomain: 'example' }, { subdomain: { enabled: false } }, schedules)).toThrow('route');
  expect(() => deploymentDetails({ subdomain: 'bad/host' }, { subdomain: { enabled: true } }, schedules)).toThrow('route');
});

it('binds the selected account and namespace while preserving the reviewed runtime configuration and relative paths', () => {
  const original = structuredClone(template);
  const config = deploymentConfig(template, { accountId, namespaceId });
  expect(config.account_id).toBe(accountId);
  expect(config.kv_namespaces).toEqual([{ binding: 'SNAPSHOTS', id: namespaceId }]);
  expect(config.triggers).toEqual({ crons: ['*/15 * * * *'] });
  expect(config.main).toBe(template.main);
  expect(config.vars).toEqual(template.vars);
  expect(config.workers_dev).toBe(true);
  expect(config.compatibility_date).toBe(template.compatibility_date);
  expect(template).toEqual(original);
});

it.each([undefined, '', ' ', '0'.repeat(32), 'not-an-id', 'g'.repeat(32), 'a'.repeat(31), 'a'.repeat(33)])(
  'rejects a missing, placeholder or malformed account/namespace ID without echoing its input (%s)', bad => {
    expect(() => deploymentConfig(template, { accountId: bad, namespaceId })).toThrow('CLOUDFLARE_ACCOUNT_ID');
    expect(() => deploymentConfig(template, { accountId, namespaceId: bad })).toThrow('CLOUDFLARE_KV_NAMESPACE_ID');
    try { deploymentConfig(template, { accountId: 'fixture-private-input', namespaceId }); } catch (error) {
      expect(String(error)).not.toContain('fixture-private-input');
    }
  },
);

it('accepts copied whitespace/case without copying extra environment properties into public configuration', () => {
  const config = deploymentConfig(template, { accountId: ` ${accountId.toUpperCase()}\n`, namespaceId,
    CLOUDFLARE_API_TOKEN: 'fixture-secret-token', NRW_API_KEY: 'fixture-secret-nrw' });
  expect(config.account_id).toBe(accountId);
  expect(JSON.stringify(config)).not.toContain('fixture-secret');
});

it('refuses absent or ambiguous storage bindings rather than deploying against an unintended namespace', () => {
  for (const kv_namespaces of [undefined, [], [{ binding: 'OTHER', id: namespaceId }],
    [template.kv_namespaces[0], template.kv_namespaces[0]]]) {
    expect(() => deploymentConfig({ ...template, kv_namespaces }, { accountId, namespaceId })).toThrow('exactly one SNAPSHOTS');
  }
});
