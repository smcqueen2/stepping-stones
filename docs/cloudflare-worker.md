# Cloudflare Workers: 15-minute data refresh

Prepared 8 November 2026. This targets **Cloudflare Workers**, following the earlier hosting discussion. It prepares the river/tide/warning data service while the website remains on GitHub Pages. Account resources and deployment are still owner setup steps.

## What it will do

1. At minutes **00, 15, 30 and 45 UTC**, a Cron Trigger runs the existing data calculations.
2. The Worker saves one public JSON snapshot in Workers KV, including the last known warning information.
3. The website reads that saved snapshot. Visits never trigger extra NRW/Open-Meteo requests.

The configured expression is `*/15 * * * *`. This is 96 scheduled attempts per day, not a promise that data is always exactly fifteen minutes old. Source reporting, Cron execution and cache propagation add delay. All existing source timestamps and expiry rules remain in effect.

**Nothing switches automatically:** with no frontend endpoint configured, the site continues using its current Pages JSON and Actions schedule. This is a data refresher only; community-observation storage/submission remains on hold.

## Files and commands

- `workers/data-refresh/`: isolated Worker package, pinned Wrangler development tool and lockfile. These dependencies do not enter the website bundle or root production install.
- `workers/data-refresh/wrangler.json`: quarter-hour Cron, public origin allow-list and placeholder `SNAPSHOTS` KV binding.
- `workers/data-refresh/src/index.mjs`: scheduled/HTTP entry points; `service.mjs` holds storage and request handling.
- `scripts/lib/model-data.mjs` / `monitoring-data.mjs`: runtime-independent builders shared by the Worker and existing Node/Actions scripts. The Worker uses native APIs without Node filesystem compatibility.
- `src/lib/data-source.ts`: optional coherent Worker snapshot loading, with the existing four-file route as the default.

From the repository root:

```powershell
npm run worker:install
npm run worker:check
npm run worker:dev
```

`worker:check` bundles with `wrangler deploy --dry-run`; it does not publish. `worker:dev` runs on **127.0.0.1:8787**, with local KV and scheduled-handler testing, without requiring an account. Stop it with Ctrl+C.

In a second terminal, invoke the LOCAL scheduled test:

```powershell
Invoke-WebRequest 'http://127.0.0.1:8787/__scheduled?cron=%2A%2F15%20%2A%20%2A%20%2A%20%2A'
Invoke-RestMethod 'http://127.0.0.1:8787/data/snapshot.json'
```

The snapshot returns **503 before the first successful refresh**, then JSON. The scheduled-test route belongs to Wrangler's local development server; the deployed Worker's public handler returns 404 for it. There is no public refresh/write/admin endpoint.

For a local frontend preview, copy the examples to ignored local files:

- `workers/data-refresh/.dev.vars.example` → `.dev.vars` in that folder, to allow the localhost frontend origin and optionally set a private NRW key.
- Root `.env.example` → `.env.local`, enabling `VITE_DATA_ENDPOINT=http://127.0.0.1:8787/data/snapshot.json`.

Restart the local Vite/Worker processes after changing their environment files. Leave the endpoint unset for the existing static data route. Never use a `VITE_` variable for a subscription key or Cloudflare token.

## Account setup and deployment, when ready

These commands create account resources or deploy software; they have **not** been run during preparation.

1. Create/sign into a Cloudflare account and select Workers Free initially. No custom domain is required for a `workers.dev` endpoint.
2. Install the isolated dependencies, then run:

   ```powershell
   Set-Location workers/data-refresh
   npx wrangler login
   npx wrangler kv namespace create STEPPING_STONES_SNAPSHOTS
   ```

   Complete sign-in privately in the browser. Copy the returned namespace ID into the `SNAPSHOTS` entry in `wrangler.json`, replacing the all-zero placeholder. Keep the binding name `SNAPSHOTS`. The namespace ID is configuration, not the NRW secret.

3. From the repository root, run `npm run worker:deploy`. Its preflight refuses the placeholder namespace. This activates the configured Cron schedule. The local bundling check deliberately works with the placeholder.
4. Record the reported HTTPS Worker URL. Wait for a scheduled refresh and check **`https://YOUR-WORKER.workers.dev/data/snapshot.json`**. A new or changed Cron can take up to fifteen minutes to propagate before normal scheduling begins. Inspect Cron logs if the snapshot remains unavailable.
5. When an NRW subscription key is available, enter it privately in the Worker folder:

   ```powershell
   npx wrangler secret put NRW_API_KEY
   ```

   The existing GitHub Actions secret is separate; it is not automatically copied to Cloudflare. No NRW key was available during preparation. Gauges/model/tide timings work without it; official warning status stays explicitly unavailable until a valid key is configured and the authenticated response is smoke-tested.
6. Verify recent `refreshedAt`, source observation times, all expected stations, 24 forecast hours and warning availability/state. A successful HTTP response alone does not mean every source is fresh.

The default allowed browser origin is `https://smcqueen2.github.io`. Origins contain no `/stepping-stones` path. If hosting changes, update `ALLOWED_ORIGINS` to the exact approved origins. CORS limits browser access; this is public environmental data, not a private authenticated API.

## Connect the website after verifying the Worker

In GitHub repository **Settings → Secrets and variables → Actions → Variables**, set:

| Repository variable | Value |
| --- | --- |
| `DATA_ENDPOINT` | Full HTTPS Worker `/data/snapshot.json` URL; this is public. |
| `DATA_REFRESH_PROVIDER` | Set to `cloudflare` **only after the frontend has been checked against the working endpoint**. |

First set `DATA_ENDPOINT` and run **Build and Deploy Pages** manually. The build passes it to Vite as `VITE_DATA_ENDPOINT`. Build-time validation rejects malformed, credential-bearing, query/fragment-bearing or non-HTTPS remote endpoints before bundling. Confirm the published site's readings and warning states use the new service, including a future forecast selection and failed/stale status.

Then set `DATA_REFRESH_PROVIDER=cloudflare`. Scheduled Pages builds will be skipped while both variables are set; push/manual Pages deployment still works. Until those variables are configured, today's behaviour is retained. Occasional push/manual builds still generate static files for the deployment; these are not a silent browser fallback when a Worker endpoint is selected.

If the Worker fails, the browser retains its last data, marks the update unverified and ages it using the existing rules. It does **not** quietly replace a newer warning with older Pages data.

To roll back: clear both repository variables and run the Pages workflow to rebuild with fresh static data. To stop the Cloudflare schedule too, change `triggers.crons` to `[]` and deploy that change deliberately; merely removing the property does not remove an already configured Cron.

## Data integrity and operation

- The model calculation and calibration are unchanged. An isolated comparison against captured pre-refactor provider responses matched the complete live and 24-hour forecast payloads exactly.
- Model and monitoring generation run independently. A good warning update can publish while the model is unavailable. If a pipeline fails, its previous payload/config and original timestamps are retained, without being made artificially recent. If both fail, no new snapshot is written.
- The Worker reads prior storage before refreshing. An unreadable/unrecognised stored snapshot aborts the update instead of overwriting last-known warnings blindly.
- A single JSON record is saved per update, so a single frontend request receives a coherent set of payloads. This does not make KV a strongly consistent transactional database: different locations may temporarily see different versions.
- HTTP responses are read-only, use `Cache-Control: no-store`, expose explicit public fields, and never serialise environment secrets or internal provider errors. The secret is only sent in the documented NRW request header.
- The existing independent warning verification expiry, per-gauge freshness, unknown/withdrawn handling and last-known-warning advice continue unchanged. Root `refreshedAt` does not replace any section's observation/check time.
- Provider calls retain their existing timeouts. Scheduled work uses actual execution time rather than backdating to a delayed scheduled event.
- The Worker's global-cache propagation and scheduled polling make this a periodically refreshed information service. The official NRW links remain the authoritative place to check warnings.

## Free-tier target and checks before leaving it running

The normal schedule uses approximately **96 KV writes and 96 scheduler KV reads per day**, plus one KV read per visitor snapshot request. No images, reports, per-visitor provider fetches or R2 bucket are involved.

Cloudflare's published free allowances currently include 100,000 Worker requests/day and 100,000 KV reads/day, with 1,000 KV writes/day. The free Cron CPU allowance is **10 ms** per invocation; time waiting for network I/O is excluded. Actual CPU under representative provider responses must be checked on Cloudflare after deployment. A successful local run does not prove it fits the hosted CPU limit. If it does not, retain the existing GitHub route while optimising; do not assume a paid upgrade is necessary or approved.

KV changes can take around sixty seconds or more to become visible in other locations. This adapter requests a 30-second KV read cache TTL; global propagation can still add delay. Cron delivery and free quotas are not guarantees of a timely safety alert.

Sources checked 8 November 2026: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [KV limits](https://developers.cloudflare.com/kv/platform/limits/), [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## Validation checkpoint

Wrangler 4.158.0 bundles the Worker locally. Its actual local workerd runtime was exercised: empty storage returned 503, a simulated Cron event fetched real public provider data, and the endpoint then returned both local gauges, unchanged model stations, coastal timing and 24 forecast hours. CORS was verified for the Pages origin. Official warnings correctly remained unavailable without a key. Unit coverage includes independent pipeline failure, preserving timestamps/config/warnings, storage failure, secret exclusion, read-only routes/CORS, optional frontend source selection and avoiding stale static fallback. Cloudflare deployment, hosted CPU use and authenticated NRW access still await account setup.
