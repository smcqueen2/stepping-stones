import { deploymentTokenIdentity } from '../../workers/reports/scripts/check-deploy-token.mjs';

const accountId = 'a'.repeat(32);
const token = 'private-test-value';
const id = 'b'.repeat(32);
it('identifies the actual account credential using only a read-only verification call', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, result: { id, status: 'active', value: token } }));
  const identity = await deploymentTokenIdentity({ accountId, token, fetcher });
  expect(identity).toEqual({ kind: 'account', id, status: 'active' });
  expect(JSON.stringify(identity)).not.toContain(token);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`);
});
it('recognises a user-owned credential without assuming it is the visible account token', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ success: false }, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ success: true, result: { id, status: 'active' } }));
  expect(await deploymentTokenIdentity({ accountId, token, fetcher })).toEqual({ kind: 'user', id, status: 'active' });
  expect(fetcher.mock.calls[1][0]).toMatch(/\/user\/tokens\/verify$/);
});
it('rejects inactive credentials and redacts provider/network failures', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ success: true, result: { id, status: 'disabled' } }))
    .mockRejectedValueOnce(new Error(token));
  await expect(deploymentTokenIdentity({ accountId, token, fetcher })).rejects.toThrow('inactive');
  await expect(deploymentTokenIdentity({ accountId, token, fetcher })).rejects.toThrow('unavailable');
});
