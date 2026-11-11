import { defineConfig, loadEnv } from 'vite';
import { dataEndpoint } from './src/lib/data-source';
import { reportsEndpoint } from './src/lib/report-contract';

export default defineConfig(({ mode }) => {
  // Reject credential-bearing or invalid endpoint settings before they enter a public bundle.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  dataEndpoint(env.VITE_DATA_ENDPOINT);
  reportsEndpoint(env.VITE_REPORTS_ENDPOINT);
  return { base: './', server: { proxy: { '/api/reports': { target: 'http://127.0.0.1:8788' } } } };
});
