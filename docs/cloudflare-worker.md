# Cloudflare Workers: 15-minute data refresh

Prepared 8 November 2026; proof-of-concept setup selected 9 November; two-job deployment verified 10 November. This targets **Cloudflare Workers Free + classic Workers KV**, deployed through GitHub Actions with pinned Wrangler. The owner prioritised reducing billing risk and authorised this route. R2/SST deployment state is not used. GitHub secret-name metadata and the account-ID variable have been verified; the private secret value has not been accessed. Hosted results are recorded below. The website stays on GitHub Pages.

## What runs

1. At minutes **00, 15, 30 and 45 UTC**, two independent Cron handlers run: `stepping-stones-data` calculates the model/forecast, and private `stepping-stones-monitoring` reads local gauges and official warnings.
2. Each job saves one record in the same classic KV namespace: `latest:v1` for the model and `monitoring:v1` for monitoring and the warning cache.
3. The unchanged public `/data/snapshot.json` endpoint combines the records into the existing response format, retaining independent section/source clocks. Visits never trigger NRW/Open-Meteo requests.

The configured expression is `*/15 * * * *`. This is 96 scheduled attempts per job per day (192 total), not a promise that data is always exactly fifteen minutes old. Source reporting, Cron execution and cache propagation add delay. All existing source timestamps and expiry rules remain in effect.

**Nothing switches automatically:** with no frontend endpoint configured, the site continues using its current Pages JSON and Actions schedule. This is a data refresher only; community-observation storage/submission remains on hold.

## GitHub Actions setup

This proof of concept uses the Wrangler pipeline rather than a framework needing remote deployment state. [The CDK-style research](cloudflare-iac-options.md) is retained for a future decision. The owner reports R2 is enabled, but this pipeline creates no bucket, makes no R2 requests and never changes billing/subscriptions or upgrades a plan. Ensure the account remains on **Workers Free**; enabled R2 is a separate product.

The **Check and Deploy Data Worker** workflow validates relevant PR/main/manual runs with tests, TypeScript and bundling. Configure repository secret `CLOUDFLARE_API_TOKEN` and variable `CLOUDFLARE_ACCOUNT_ID`. Start with a main-branch manual run and tick `deploy`; unticked is check-only. Automatic deployments on relevant main pushes additionally require `CLOUDFLARE_WORKER_DEPLOY_ENABLED=true`. PR checks never receive Cloudflare credentials; GitHub workflow permissions remain read-only.

The deployment lists all the account's KV namespaces, reuses the classic namespace named `stepping-stones-data-snapshots`, or creates it if absent. An optional `CLOUDFLARE_KV_NAMESPACE_ID` variable selects a specific existing namespace. A missing explicit ID, duplicate name, non-classic mode, failed listing or malformed response stops setup rather than creating replacement storage. Creation is never blindly retried after a timeout; a new run lists first. Nothing deletes storage.

The public namespace ID is passed to ignored adjacent `wrangler.ci.json` and `wrangler.monitoring.ci.json` files; source configurations stay unchanged and credentials never enter those files. Deployment publishes monitoring first, checks warning-secret placement using binding names only, then publishes the model/public endpoint. Deployments are serialised and skip superseded main revisions before provisioning. If a different infrastructure framework is adopted later, replace the production owner instead of allowing two tools to change the same Worker.

After first setup, record its namespace ID as `CLOUDFLARE_KV_NAMESPACE_ID` to pin subsequent deployments to that storage. This also stops a later run from silently creating empty replacement storage if the original namespace is deleted or becomes inaccessible.

**Code deployment and data refresh are separate:** a deployment tool publishes resource/code changes; the deployed Worker's Cron refreshes environmental data every fifteen minutes. The website stays on its existing Pages data route until a real hosted data/CPU/warning-state check and explicit cutover. Runtime `NRW_API_KEY` remains a separate Cloudflare secret and reporting collection stays on hold.

### Inspect without redeploying

Run **Inspect Data Worker** manually on main to check the public route/schedule configuration and saved snapshot timestamps. Optional `watch` observes both jobs in parallel for three minutes, then checks both saved records again. Start shortly before a quarter-hour boundary to capture a refresh; it will not invoke a refresh or redeploy anything. Only scheduled-execution metrics, exception counts and recognised pipeline states reach GitHub logs; raw HTTP request/visitor metadata and arbitrary console messages are discarded by `summarize-tail.mjs`. A failed observed Cron makes the diagnostic fail, while no observed Cron is labelled explicitly. The workflow uses the existing token only within its main-only diagnostic job. A successful diagnostic job with no snapshot is not a successful data refresh. Worker usage-model metadata alone does not verify the account subscription is Free.

## Two-job layout and migration

The combined job still used 13 ms CPU at 14:30 UTC, so the model and monitoring builders now run in separate Workers with the same quarter-hour schedule. The monitoring Worker has no workers.dev or preview HTTP route. Both use the existing classic KV namespace; no R2 or extra paid product is introduced. Two Cron Triggers fit the published Free allowance of five per account, subject to other account usage. Shared KV free quotas still apply.

The public endpoint keeps its schema and URL. A model failure leaves that record's clocks unchanged while new monitoring/warnings can publish; monitoring failure keeps its prior warning cache while the model updates. Missing/corrupt/unreadable storage is never interpreted as no warning. The monolithic legacy record remains a conservative migration fallback until a valid separate monitoring record exists. After that, the model job reads the smaller monitoring record to verify migration and omits the duplicate legacy monitoring payload from its next model write.

`NRW_API_KEY` now belongs on **stepping-stones-monitoring**. CI refuses to replace a model Worker that already has this secret unless the destination Worker also has it. It checks names only; secret values cannot be copied through the API. The owner still has no key. A later authenticated warning-feed and CPU smoke test remains required.

## Files and commands

- `workers/data-refresh/`: isolated Worker package, pinned Wrangler development tool and lockfile. These dependencies do not enter the website bundle or root production install.
- `workers/data-refresh/wrangler.json`: quarter-hour Cron, public origin allow-list and placeholder `SNAPSHOTS` KV binding.
- `workers/data-refresh/src/index.mjs`: scheduled/HTTP entry points; `service.mjs` holds storage and request handling.
- `scripts/lib/model-data.mjs` / `monitoring-data.mjs`: runtime-independent builders shared by the Worker and existing Node/Actions scripts. The Worker uses native APIs without Node filesystem compatibility.
- `src/lib/data-source.ts`: optional combined Worker response loading, with the existing four-file route as the default.
- `.github/workflows/deploy-worker.yml`: validation plus opt-in production deployment.
- `workers/data-refresh/scripts/prepare-ci-config.mjs`: validates public deployment IDs and writes an ignored CI config; tokens stay in the process environment.
- `workers/data-refresh/scripts/provision-kv.mjs`: creates/reuses only the classic snapshot KV namespace through the official API.
- `workers/data-refresh/scripts/check-hosted-config.mjs`: verifies the public route and nested schedule API result, reports only public settings and checks whether Cron has saved a snapshot.

From the repository root:

```powershell
npm run worker:install
npm run worker:check
npm run worker:dev
```

`worker:check` bundles with `wrangler deploy --dry-run`; it does not publish. `worker:dev` runs the model/public endpoint on **127.0.0.1:8787**, with local KV and scheduled-handler testing, without requiring an account. Stop it with Ctrl+C.

Start `npm run worker:dev:monitoring` in another terminal on **127.0.0.1:8789**; both use local KV persistence in the same Worker package. Invoke each LOCAL scheduled test (8787 for model, 8789 for monitoring):

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

   Complete sign-in privately in the browser. Copy the returned namespace ID into the `SNAPSHOTS` entries in both `wrangler.json` and `wrangler.monitoring.json`, replacing the all-zero placeholder. Keep the binding name `SNAPSHOTS`. The namespace ID is configuration, not the NRW secret.

3. From the repository root, run `npm run worker:deploy`. Its preflight refuses the placeholder namespace. This activates the configured Cron schedule. The local bundling check deliberately works with the placeholder.
4. Record the reported HTTPS Worker URL. Wait for a scheduled refresh and check **`https://YOUR-WORKER.workers.dev/data/snapshot.json`**. A new or changed Cron can take up to fifteen minutes to propagate before normal scheduling begins. Inspect Cron logs if the snapshot remains unavailable.
5. When an NRW subscription key is available, enter it privately in the Worker folder:

   ```powershell
   npx wrangler secret put NRW_API_KEY --config wrangler.monitoring.json
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
- The endpoint reads two independent records in one request; it is not an atomic cross-job snapshot. Each job owns its key. Source/section clocks identify old data, and KV propagation can temporarily expose different versions. The existing combined record remains readable during migration, and its warning cache is copied forward until the monitoring job can use its separate record.
- HTTP responses are read-only, use `Cache-Control: no-store`, expose explicit public fields, and never serialise environment secrets or internal provider errors. The secret is only sent in the documented NRW request header.
- The existing independent warning verification expiry, per-gauge freshness, unknown/withdrawn handling and last-known-warning advice continue unchanged. Root `refreshedAt` does not replace any section's observation/check time.
- Provider calls retain their existing timeouts. Scheduled work uses actual execution time rather than backdating to a delayed scheduled event.
- The Worker's global-cache propagation and scheduled polling make this a periodically refreshed information service. The official NRW links remain the authoritative place to check warnings.

## Free-tier target and checks before leaving it running

The normal schedule uses approximately **192 KV writes and approximately 192 scheduler KV reads per day**, plus two KV reads per visitor snapshot request. Before migration finishes, either job can need an additional legacy-record read. No images, reports, per-visitor provider fetches or R2 bucket are involved.

Cloudflare's published free allowances currently include 100,000 Worker requests/day and 100,000 KV reads/day, with 1,000 KV writes/day. The free Cron CPU allowance is **10 ms** per invocation; time waiting for network I/O is excluded. Actual CPU under representative provider responses must be checked on Cloudflare after deployment. A successful local run does not prove it fits the hosted CPU limit. If it does not, retain the existing GitHub route while optimising; do not assume a paid upgrade is necessary or approved.

KV changes can take around sixty seconds or more to become visible in other locations. This adapter requests a 30-second KV read cache TTL; global propagation can still add delay. Cron delivery and free quotas are not guarantees of a timely safety alert.

Sources checked 8-9 November 2026: [GitHub Actions deployment/authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Wrangler environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/), [KV setup](https://developers.cloudflare.com/kv/get-started/), [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [KV limits](https://developers.cloudflare.com/kv/platform/limits/), [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

### View CPU usage and costs

In the Cloudflare dashboard, open **Workers & Pages**, select `stepping-stones-data` or `stepping-stones-monitoring`, and inspect **CPU Time per execution** in the Worker's metrics. **Observability** exposes individual execution logs; inspect scheduled runs rather than relying on a public-HTTP average. The repository's **Inspect Data Worker** workflow also records privacy-filtered per-job CPU and outcome metrics when `watch` spans a scheduled run.

For charges, open **Manage Account > Billing > Billable Usage** for metered costs, **Subscriptions** for plan fees/current subscriptions, and **Invoices and documents** for issued bills. The usage view excludes fixed subscription fees, so a zero usage cost alone does not prove a zero total bill. This project's deployment does not upgrade subscriptions or use R2. The owner has reported a Workers upgrade offer, but account-wide costs and the current plan have not been independently verified from billing.

On **Workers Free**, exceeding CPU limits risks failed executions rather than purchasing a paid upgrade. Free KV operations fail after their allowance is exhausted; other separately enabled products can have their own billing rules. Sources checked 10 November: [metrics guide](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), [billable usage guide](https://developers.cloudflare.com/billing/manage/billable-usage/) and [billing tabs](https://developers.cloudflare.com/billing/understand/how-billing-works/).

## Validation checkpoint

### CPU tuning, 10 November 2026

The service was still producing recent quarter-hour data when work resumed. To reduce the first observed 12 ms CPU cost, server helpers now parse sorting timestamps once, prepare tidal parameters once for all forecast hours and reuse the UK summary formatter. Calculations, source selection, station-specific units, thresholds, observation timestamps, warnings and response structure are preserved.

A fixed-clock replay of 12 captured public responses (39,623 bytes) matches the original complete model/monitoring objects and JSON exactly. The earlier legacy-model capture comparison also passes. On this PC, 200 local Node replays improved median processing from 4.4596 to 2.9212 ms (~34.5%) and p95 from 5.4623 to 3.9135 ms. This identifies useful CPU savings but is not proof of Cloudflare Free-tier headroom; hosted Cron timings must be recorded separately after deployment. Review scripts, captured inputs and the original library are outside Git in `../worker-cpu-review/`. Tests cover independent model equivalence, fallback maths, DST text and observed-series timestamp ordering/bucket retention.

The first hosted comparison (14:15 UTC, Inspect run `42831857171`) completed successfully but used 16 ms CPU / 1,294 ms wall time. Further tuning moved the fixed formatter to isolate setup and stopped fetching unused fallback tide-station metadata once the existing priority/freshness rules select a fresh source. The usual primary-fresh path now needs two fewer provider requests; unavailable/stale fallback behaviour and all-stale freshest selection are covered by tests. The 14:30 combined run still used 13 ms CPU (3,617 ms wall, zero exceptions; Inspect `42834487974`), so the model and monitoring jobs were separated as described above.

Both Workers deployed successfully in [run 42838681830](https://github.com/smcqueen2/stepping-stones/actions/runs/42838681830), with all 202 tests, TypeScript and both bundles passing. The monitoring bundle omits the model's unused UK formatter setup. Local shared-KV migration checks verified that either job can advance without changing the other section's clock, and the existing frontend loader accepted all four sections.

The first model-only hosted run at 15:00 UTC succeeded with 10 ms CPU / 6,021 ms wall time and zero exceptions ([Inspect 42839488555](https://github.com/smcqueen2/stepping-stones/actions/runs/42839488555)). This is at the documented Free CPU allowance, with little margin; it does not establish comfortable sustained headroom. Its saved model timestamp is `2026-11-10T15:00:06.410Z`. The newly added monitoring schedule had not fired in that window, and the endpoint correctly retained the legacy monitoring timestamp `2026-11-10T14:45:06.261Z`.

Commit `4f2dbdb` then deployed successfully ([Worker 42841075729](https://github.com/smcqueen2/stepping-stones/actions/runs/42841075729), [Pages 42841075624](https://github.com/smcqueen2/stepping-stones/actions/runs/42841075624)), with all 204 tests, TypeScript and both bundles passing. At 15:15 both jobs ran successfully with zero exceptions ([Inspect 42842012270](https://github.com/smcqueen2/stepping-stones/actions/runs/42842012270)): model 11 ms CPU / 4,728 ms wall; monitoring 10 ms CPU / 463 ms wall. This was the initial monitoring migration: the model began first and still used its legacy fallback.

The composed public endpoint returned HTTP 200 with model time `2026-11-10T15:15:06.649Z` and monitoring time `2026-11-10T15:15:16.741Z`. Both local gauges reported 15:00 observations, while the regional model preserved its 14:30 coastal observation and 45-minute source age. All 24 forecast hours and the original source identifiers remained intact. The existing frontend loader accepted all four sections. Warning status was explicitly `unavailable/not-configured`. No website data-source cutover has been made.

At 15:30, the first cycle after migration used **7 ms model CPU / 7,560 ms wall** and **8 ms monitoring CPU / 1,606 ms wall**, both successful with zero exceptions ([Inspect 42844646946](https://github.com/smcqueen2/stepping-stones/actions/runs/42844646946)). Both are below the published 10 ms Free allowance. Independent saved clocks advanced to `2026-11-10T15:30:06.597Z` and `2026-11-10T15:30:16.697Z`; HTTP 200, all four frontend sections, both local gauges and 24 forecast hours were verified again. This is an encouraging measured result, not a guarantee for larger provider responses or an authenticated NRW warning feed. Keep observing representative runs, test the separate warning credential when available, and make an explicit Pages cutover decision. Normal scheduled jobs continue; no background diagnostic watcher remains running after the bounded inspection.

### Hosted setup, 9 November 2026

- Setup commit `d540a77f1e22842f5b78762205a949a25ba22b75` was pushed and remote main independently verified. GitHub validation passed all 180 tests, TypeScript and the Worker bundle; the Pages deployment also succeeded.
- [First deployment run](https://github.com/smcqueen2/stepping-stones/actions/runs/42713894761), attempt 2, succeeded. The first attempt created KV and uploaded the Worker, then received transient Cloudflare code 10007 while resolving the newly uploaded Worker. Rerunning only the failed job reused the same namespace and completed without source/dependency changes.
- Classic KV namespace: `66c5c54e1ce244e9a61dfc213102630a`, now pinned by the repository variable. `CLOUDFLARE_WORKER_DEPLOY_ENABLED=true` enables future relevant main-push deployment. Neither setting contains a credential.
- Worker address: `https://stepping-stones-data.mcqueen-4.workers.dev/data/snapshot.json`. Automatic deployment of `50b9787557a283f99e724915bcf7e0eb43c42f2e` passed [run 42715321318](https://github.com/smcqueen2/stepping-stones/actions/runs/42715321318), with 183 tests and independent API checks of enabled public routing and the quarter-hour schedule. Worker version: `55cb320c-c511-424d-8c0f-0f69a9185763`. The schedule API returns `result.schedules`; regression coverage rejects missing/malformed/conflicting schedules.
- Hosted HTTP smoke checks passed: expected pre-first-refresh 503 JSON, correct Pages-origin CORS, POST 405, public scheduled-test path 404, OPTIONS 204 and unrelated-origin 403. The real 23:00 Cron saved a snapshot at `2026-11-09T23:00:06.076Z`; the public endpoint then returned HTTP 200.
- The existing frontend `loadData` adapter loaded all four sections directly from the hosted endpoint. Both local gauges were available: Keepers Lodge `4099/64` at 22:30 UTC and Penybont `4115/112` at 22:45 UTC. Original model sources `4083/110` and coastal `72839/10254` were retained. The model preserved its older 21:45 UTC coastal observation and calculated 75-minute source age, rather than treating refresh time as observation time. All 24 future forecast hours were present. Official warnings were explicitly `unavailable/not-configured`, not an all-clear. Raw public-data proof is outside Git in the parent `worker-cicd-review/hosted-snapshot.json`.
- `DATA_ENDPOINT` and `DATA_REFRESH_PROVIDER` are unset. Pages stays on its existing generated data/schedule. No R2 request, subscription change or NRW key is included.
- Runtime observation run `42716583062` captured the 23:00 Cron: `outcome=ok`, zero exceptions, both pipelines fulfilled, 12 ms CPU and 1,351 ms wall time. This one cold execution is slightly above the documented 10 ms Free CPU allowance; it is **not** evidence of comfortable sustained Free-tier headroom. Keep the service as a proof of concept and monitor/optimise before website cutover. No paid upgrade was made. Owner reports an upgrade offer to $5/month, consistent with a current Free plan; this is owner-observed, not an independent billing-API check.
- Temporary verbose observation logs were removed after extracting the non-identifying metrics above. Future diagnostic output is filtered before reaching GitHub logs. The raw public-data snapshot and metrics-only summary remain outside Git in `../worker-cicd-review/`.

The earlier local preparation used Wrangler 4.158.0 and its actual workerd runtime: empty storage returned 503, a simulated Cron event fetched real public provider data, and the endpoint then returned both local gauges, unchanged model stations, coastal timing and 24 forecast hours. CORS was verified for the Pages origin. Official warnings correctly remained unavailable without a key. Unit coverage includes independent pipeline failure, preserving timestamps/config/warnings, storage failure, secret exclusion, read-only routes/CORS, optional frontend source selection and avoiding stale static fallback. See the hosted checkpoint above for subsequent deployment evidence; authenticated NRW access is still pending a separate key.
