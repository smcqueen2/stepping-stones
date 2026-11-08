import { defineConfig, loadEnv } from 'vite';
import { dataEndpoint } from './src/lib/data-source';

export default defineConfig(({ mode }) => {
  // Reject credential-bearing or invalid endpoint settings before they enter a public bundle.
  dataEndpoint(loadEnv(mode, process.cwd(), 'VITE_').VITE_DATA_ENDPOINT);
  return { base: './' };
});
