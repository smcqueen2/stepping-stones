import { waitForReportsEndpoint } from '../../workers/reports/scripts/endpoint-ready.mjs';
const endpoint = 'https://reports.example/api/reports';
it('waits through first-deployment unavailability without submitting reports', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('not ready', { status: 503 }))
    .mockResolvedValueOnce(Response.json({ schemaVersion: 1 }));
  const pause = vi.fn().mockResolvedValue(undefined);
  expect((await waitForReportsEndpoint({ endpoint, fetcher, pause })).status).toBe(200);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(pause).toHaveBeenCalledWith(5000);
  expect(fetcher.mock.calls.every(call => !call[1].method && !call[1].body)).toBe(true);
});
it('fails immediately for access errors rather than retrying or reporting success', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('private provider body', { status: 403 }));
  const pause = vi.fn();
  await expect(waitForReportsEndpoint({ endpoint, fetcher, pause })).rejects.toThrow('HTTP 403');
  expect(pause).not.toHaveBeenCalled();
});
it('bounds network retries and does not expose underlying provider errors', async () => {
  let time = 0;
  const fetcher = vi.fn().mockRejectedValue(new Error('private provider detail'));
  const pause = vi.fn().mockImplementation(async ms => { time += ms; });
  await expect(waitForReportsEndpoint({ endpoint, fetcher, now: () => time, pause, timeoutMs: 10_000 }))
    .rejects.toThrow('within the check window (network unavailable)');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
