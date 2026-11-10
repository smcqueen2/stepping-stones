import { refreshMonitoringSnapshot } from './service.mjs';

export default {
  async scheduled(_controller, env) {
    await refreshMonitoringSnapshot(env);
  },
};
