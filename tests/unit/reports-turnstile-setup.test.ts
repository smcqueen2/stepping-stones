import { checkTurnstileSecret } from '../../workers/reports/scripts/check-turnstile.mjs';

it('accepts only the expected invalid-token rejection for a recognised secret', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ success: false, 'error-codes': ['invalid-input-response'] }));
  expect(await checkTurnstileSecret({ secret: 'private-fixture', fetcher })).toBe(true);
  const request = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(request.response).toBe('deployment-check-deliberately-invalid-token');
});
it.each(['invalid-input-secret', 'missing-input-secret', 'internal-error', 'bad-request'])('fails before provisioning when the provider reports %s', async code => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ success: false, 'error-codes': [code] }));
  await expect(checkTurnstileSecret({ secret: 'private-fixture', fetcher })).rejects.toThrow('no resources provisioned');
});
it('rejects test keys and never prints an underlying network error or private key', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('private-fixture'));
  await expect(checkTurnstileSecret({ secret: '1x0000000000000000000000000000000AA', fetcher })).rejects.toThrow('real TURNSTILE_SECRET_KEY');
  expect(fetcher).not.toHaveBeenCalled();
  await expect(checkTurnstileSecret({ secret: 'private-fixture', fetcher })).rejects.toThrow('unavailable');
});
