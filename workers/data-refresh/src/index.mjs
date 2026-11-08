import { refreshSnapshot, serveSnapshot } from './service.mjs';

export default {
  async scheduled(_controller, env) {
    // Await completion so a failed update is recorded as a failed Cron invocation.
    // Use actual execution time, never backdate the data to a delayed scheduled time.
    await refreshSnapshot(env);
  },
  fetch: serveSnapshot,
};
