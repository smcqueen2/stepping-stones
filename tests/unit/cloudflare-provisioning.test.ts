import { namespaceTitle, provisionNamespace } from '../../workers/data-refresh/scripts/provision-kv.mjs';

const accountId = 'a'.repeat(32);
const id = 'b'.repeat(32);
const token = 'fixture-only-token';
const namespace = { id, title: namespaceTitle };
const reply = (result: unknown, status = 200) => new Response(JSON.stringify({ success: status === 200, result }), { status });

it('reuses existing storage without issuing a create request', async () => {
  const fetcher = vi.fn().mockResolvedValue(reply([namespace]));
  expect(await provisionNamespace({ accountId, token, fetcher })).toEqual({ id, created: false });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toMatch(/api.cloudflare.com\/client\/v4\/accounts\/[a]+\/storage\/kv\/namespaces\?page=1/);
  expect(fetcher.mock.calls[0][1].method).toBe('GET');
});

it('creates classic KV once when none exists, without requesting any paid storage mode or billing change', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply([])).mockResolvedValueOnce(reply(namespace));
  expect(await provisionNamespace({ accountId, token, fetcher })).toEqual({ id, created: true });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][1].method).toBe('POST');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ title: namespaceTitle });
});

it('checks all pages before creating anything', async () => {
  const others = Array.from({ length: 100 }, (_, i) => ({ id: (i + 1).toString(16).padStart(32, '0'), title: `other-${i}` }));
  const fetcher = vi.fn().mockResolvedValueOnce(reply(others)).mockResolvedValueOnce(reply([namespace]));
  expect(await provisionNamespace({ accountId, token, fetcher })).toEqual({ id, created: false });
  expect(fetcher.mock.calls[1][0]).toContain('page=2');
  expect(fetcher.mock.calls.every(call => call[1].method === 'GET')).toBe(true);
});

it('honours an explicit existing namespace, and refuses a missing or ambiguous selection', async () => {
  const fetcher = vi.fn().mockImplementation(async () => reply([{ ...namespace, title: 'owner-selected' }]));
  expect(await provisionNamespace({ accountId, token, namespaceId: id, fetcher })).toEqual({ id, created: false });
  await expect(provisionNamespace({ accountId, token, namespaceId: 'c'.repeat(32), fetcher })).rejects.toThrow('no replacement created');
  fetcher.mockImplementation(async () => reply([namespace, { ...namespace, id: 'c'.repeat(32) }]));
  await expect(provisionNamespace({ accountId, token, fetcher })).rejects.toThrow('Ambiguous');
  expect(fetcher.mock.calls.every(call => call[1].method === 'GET')).toBe(true);
});

it('rejects invalid configuration before making network requests', async () => {
  const fetcher = vi.fn();
  await expect(provisionNamespace({ accountId: '0'.repeat(32), token, fetcher })).rejects.toThrow('CLOUDFLARE_ACCOUNT_ID');
  await expect(provisionNamespace({ accountId, token: '', fetcher })).rejects.toThrow('CLOUDFLARE_API_TOKEN');
  await expect(provisionNamespace({ accountId, token, namespaceId: 'wrong', fetcher })).rejects.toThrow('CLOUDFLARE_KV_NAMESPACE_ID');
  expect(fetcher).not.toHaveBeenCalled();
});

it('never treats an API failure or malformed list as empty storage', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ private: token }, 403)).mockResolvedValueOnce(reply({}));
  await expect(provisionNamespace({ accountId, token, fetcher })).rejects.toThrow('HTTP 403');
  await expect(provisionNamespace({ accountId, token, fetcher })).rejects.toThrow('invalid namespace list');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(call => call[1].method === 'GET')).toBe(true);
});

it('does not retry an uncertain create or print the underlying network error', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply([])).mockRejectedValueOnce(new Error(token));
  await expect(provisionNamespace({ accountId, token, fetcher })).rejects.toThrow('no automatic create retry');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('refuses storage modes outside this classic KV proof of concept', async () => {
  const fetcher = vi.fn().mockResolvedValue(reply([{ ...namespace, mode: 'instant' }]));
  await expect(provisionNamespace({ accountId, token, fetcher })).rejects.toThrow('classic KV');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
