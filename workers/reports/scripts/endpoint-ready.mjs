const transientStatuses = new Set([404, 502, 503, 504, 520, 522, 523, 524, 530]);

/** A new route/secret can take a few seconds to propagate after Wrangler returns. Read-only. */
export async function waitForReportsEndpoint({ endpoint, fetcher = fetch, now = Date.now,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 60_000 } = {}) {
  const deadline = now() + timeoutMs;
  let lastStatus = 'network unavailable';
  for (let attempt = 0; attempt < 12 && now() < deadline; attempt++) {
    let response;
    try {
      response = await fetcher(endpoint, { headers: { Origin: 'https://smcqueen2.github.io' }, redirect: 'error',
        signal: AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - now()))) });
    } catch { /* Bounded retry for route propagation/network failure; never print the provider error. */ }
    if (response) {
      if (response.ok) return response;
      lastStatus = `HTTP ${response.status}`;
      if (!transientStatuses.has(response.status)) throw new Error(`Reports endpoint check failed (${lastStatus}).`);
      await response.body?.cancel();
    }
    if (now() < deadline) await pause(Math.min(5000, deadline - now()));
  }
  throw new Error(`Reports endpoint did not become ready within the check window (${lastStatus}).`);
}
