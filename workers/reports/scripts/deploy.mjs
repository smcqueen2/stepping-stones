import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const secret = process.env.TURNSTILE_SECRET_KEY;
if (!secret || /^[123]x0/.test(secret)) throw new Error('Set a real TURNSTILE_SECRET_KEY Actions secret before deploying reports.');
const cwd = fileURLToPath(new URL('..', import.meta.url));
const cli = fileURLToPath(new URL('../../data-refresh/node_modules/wrangler/bin/wrangler.js', import.meta.url));
async function run(args, input) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args, '--config', 'wrangler.ci.json'], {
      cwd, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' }, stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.on('error', () => reject(new Error('Could not start reports deployment.')));
    child.on('exit', code => code === 0 ? resolve() : reject(new Error('Reports deployment step failed.')));
    child.stdin.on('error', () => {});
    child.stdin.end(input || '');
  });
}
// Migrations are schema-only. Existing reports are retained across every deployment.
await run(['d1', 'migrations', 'apply', 'REPORTS', '--remote']);
await run(['deploy']);
// The key travels through stdin, never a command argument, file, frontend variable or log.
await run(['secret', 'bulk'], JSON.stringify({ TURNSTILE_SECRET_KEY: secret }));
