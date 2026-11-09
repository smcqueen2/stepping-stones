# Cloudflare Workers: 15-minute data refresh

Prepared 8 November 2026; proof-of-concept setup selected 9 November. This targets **Cloudflare Workers Free + classic Workers KV**, deployed through GitHub Actions with pinned Wrangler. The owner prioritised reducing billing risk and authorised this route. R2/SST deployment state is not used. GitHub secret-name metadata and the account-ID variable have been verified; the private secret value has not been accessed. Hosted results will be recorded after deployment. The website stays on GitHub Pages.

## What it will do

1. At minutes **00, 15, 30 and 45 UTC**, a Cron Trigger runs the existing data calculations.
2. The Worker saves one public JSON snapshot in Workers KV, including the last known warning information.
3. The website reads that saved snapshot. Visits never trigger extra NRW/Open-Meteo requests.

The configured expression is `*/15 * * * *`. This is 96 scheduled attempts per day, not a promise that data is always exactly fifteen minutes old. Source reporting, Cron execution and cache propagation add delay. All existing source timestamps and expiry rules remain in effect.

**Nothing switches automatically:** with no frontend endpoint configured, the site continues using its current Pages JSON and Actions schedule. This is a data refresher only; community-observation storage/submission remains on hold.

## GitHub Actions setup

This proof of concept uses the Wrangler pipeline rather than a framework needing remote deployment state. [The CDK-style research](cloudflare-iac-options.md) is retained for a future decision. The owner reports R2 is enabled, but this pipeline creates no bucket, makes no R2 requests and never changes billing/subscriptions or upgrades a plan. Ensure the account remains on **Workers Free**; enabled R2 is a separate product.

The **Check and Deploy Data Worker** workflow validates relevant PR/main/manual runs with tests, TypeScript and bundling. Configure repository secret `CLOUDFLARE_API_TOKEN` and variable `CLOUDFLARE_ACCOUNT_ID`. Start with a main-branch manual run and tick `deploy`; unticked is check-only. Automatic deployments on relevant main pushes additionally require `CLOUDFLARE_WORKER_DEPLOY_ENABLED=true`. PR checks never receive Cloudflare credentials; GitHub workflow permissions remain read-only.

The deployment lists all the account's KV namespaces, reuses the classic namespace named `stepping-stones-data-snapshots`, or creates it if absent. An optional `CLOUDFLARE_KV_NAMESPACE_ID` variable selects a specific existing namespace. A missing explicit ID, duplicate name, non-classic mode, failed listing or malformed response stops setup rather than creating replacement storage. Creation is never blindly retried after a timeout; a new run lists first. Nothing deletes storage.

The public namespace ID is passed to an ignored adjacent `wrangler.ci.json`; source configuration stays unchanged and credentials never enter that file. Deployments are serialised and skip superseded main revisions before provisioning. If a different infrastructure framework is adopted later, replace the production owner instead of allowing two tools to change the same Worker.

After first setup, record its namespace ID as `CLOUDFLARE_KV_NAMESPACE_ID` to pin subsequent deployments to that storage. This also stops a later run from silently creating empty replacement storage if the original namespace is deleted or becomes inaccessible.

**Code deployment and data refresh are separate:** a deployment tool publishes resource/code changes; the deployed Worker's Cron refreshes environmental data every fifteen minutes. The website stays on its existing Pages data route until a real hosted data/CPU/warning-state check and explicit cutover. Runtime `NRW_API_KEY` remains a separate Cloudflare secret and reporting collection stays on hold.

## Files and commands

- `workers/data-refresh/`: isolated Worker package, pinned Wrangler development tool and lockfile. These dependencies do not enter the website bundle or root production install.
- `workers/data-refresh/wrangler.json`: quarter-hour Cron, public origin allow-list and placeholder `SNAPSHOTS` KV binding.
- `workers/data-refresh/src/index.mjs`: scheduled/HTTP entry points; `service.mjs` holds storage and request handling.
- `scripts/lib/model-data.mjs` / `monitoring-data.mjs`: runtime-independent builders shared by the Worker and existing Node/Actions scripts. The Worker uses native APIs without Node filesystem compatibility.
- `src/lib/data-source.ts`: optional coherent Worker snapshot loading, with the existing four-file route as the default.
- `.github/workflows/deploy-worker.yml`: validation plus opt-in production deployment.
- `workers/data-refresh/scripts/prepare-ci-config.mjs`: validates public deployment IDs and writes an ignored CI config; tokens stay in the process environment.
- `workers/data-refresh/scripts/provision-kv.mjs`: creates/reuses only the classic snapshot KV namespace through the official API.

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

## Alternative: account setup and manual deployment from this PC

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

The manual `worker:deploy` command still requires a real namespace in `wrangler.json`. The existing Wrangler-only CI fallback takes the account/namespace IDs from GitHub variables; a selected CDK-style replacement would provision/link those resources from code. Both use the same source Worker and Cron; choose the appropriate command for the configuration you have set up.

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

Sources checked 8-9 November 2026: [GitHub Actions deployment/authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Wrangler environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/), [KV setup](https://developers.cloudflare.com/kv/get-started/), [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [KV limits](https://developers.cloudflare.com/kv/platform/limits/), [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## Validation checkpoint

### Hosted setup, 9 November 2026

- Setup commit `d540a77f1e22842f5b78762205a949a25ba22b75` was pushed and remote main independently verified. GitHub validation passed all 180 tests, TypeScript and the Worker bundle; the Pages deployment also succeeded.
- [First deployment run](https://github.com/smcqueen2/stepping-stones/actions/runs/42713894761), attempt 2, succeeded. The first attempt created KV and uploaded the Worker, then received transient Cloudflare code 10007 while resolving the newly uploaded Worker. Rerunning only the failed job reused the same namespace and completed without source/dependency changes.
- Classic KV namespace: `66c5c54e1ce244e9a61dfc213102630a`, now pinned by the repository variable. `CLOUDFLARE_WORKER_DEPLOY_ENABLED=true` enables future relevant main-push deployment. Neither setting contains a credential.
- Worker address: `https://stepping-stones-data.mcqueen-4.workers.dev/data/snapshot.json`; version `0c93558b-f37f-454a-b90d-2ae4ec47dbf2`. Quarter-hour Cron accepted. Public-route propagation, actual scheduled output and Free CPU suitability are still being checked; successful upload alone is not proof of a working data service.
- `DATA_ENDPOINT` and `DATA_REFRESH_PROVIDER` are unset. Pages stays on its existing generated data/schedule. No R2 request, subscription change or NRW key is included. Owner confirmation of the Workers Free account plan is pending.

Wrangler 4.158.0 bundles the Worker locally. Its actual local workerd runtime was exercised: empty storage returned 503, a simulated Cron event fetched real public provider data, and the endpoint then returned both local gauges, unchanged model stations, coastal timing and 24 forecast hours. CORS was verified for the Pages origin. Official warnings correctly remained unavailable without a key. Unit coverage includes independent pipeline failure, preserving timestamps/config/warnings, storage failure, secret exclusion, read-only routes/CORS, optional frontend source selection and avoiding stale static fallback. Cloudflare deployment, hosted CPU use and authenticated NRW access still await account setup.
