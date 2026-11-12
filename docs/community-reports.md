# Community stone observations

Implementation: 11 November 2026. The owner authorised this Cloudflare implementation, lifting the earlier hold on backend preparation, and subsequently configured the Turnstile keys and D1 API-token permission. Both new Actions setting names were verified before release. Production activation still requires a successful reports deployment and Pages cutover; local tests do not establish production availability.

## Design

GitHub Pages hosts the existing Vite frontend. A separate `stepping-stones-reports` Worker receives anonymous condition reports and reads their summary from the dedicated `stepping-stones-observations` D1 database. Model and monitoring Workers, environmental snapshots, calibrated thresholds and official flood-warning priority are unchanged. R2, accounts, photographs, free-text comments and additional frontend packages are not needed.

The existing main-page modal retains the five-position slider. Its clearest endpoint says **Stones clear**, which describes visible conditions rather than promising a safe crossing. A deliberate choice and a valid Turnstile check are required before submitting. The homepage shows reports in the past hour; the modal has a five-condition breakdown. A strict majority is described as “Most reported”; ties or pluralities are described as mixed. Counts are reports, not verified unique people. An empty hour is displayed only after a successful, recent response. Errors, exhausted quotas, invalid data or responses over two minutes old show unavailable and disable submission until recovery.

## Data and abuse controls

Each database row stores a random submission UUID, condition (integer 0–4), **server receipt** time in milliseconds and a SHA-256 hash of a random browser UUID. It does not store names, emails, comments, raw device UUIDs, IP addresses or Turnstile tokens. This is pseudonymous reporting, not a claim of guaranteed anonymity or identity verification. Browser storage saves the random identifier and an outstanding submission for retry; storage-blocked visitors can report for the current page session. Cookies and sign-in are unnecessary.

The server validates a maximum 4 KB JSON body, allowed origin, exact fields and Turnstile hostname/action (`stone_observation`). CORS is a browser restriction, not proof that a report is genuine. Turnstile must pass server-side Siteverify validation. Production rejects the documented dummy keys. The separate local config uses Cloudflare's public dummy keys and relaxes hostname/action checks only there, because dummy validation returns `example.com` without an action.

A single conditional SQL insert enforces one accepted report per browser identifier per rolling 15 minutes, including concurrent submissions. Retrying the same UUID and condition returns the existing receipt, without counting twice or requiring an expired token to be validated again. A reused UUID with different content is rejected. A supplementary 20-attempt/minute per-network Worker rate limiter is deliberately generous for shared Wi-Fi; Cloudflare's location-based limiter is approximate, not a strict global identity limit. Clearing storage, another browser or a determined attacker can evade the browser cooldown. Turnstile does not verify the truth or location of an observation.

Indexes support hourly summaries and cooldown queries. Public aggregates are cached at the edge for up to 60 seconds; browsers do not persist them. A successful insert invalidates that location's cached summary; other locations can take the remaining minute to update. The UI polls once a minute while visible and refreshes on returning after a minute. The data service's 15-minute environmental schedule is unrelated.

An hourly `17 * * * *` maintenance trigger removes up to 1,000 reports older than 90 days per run. This keeps maintenance bounded; a large backlog takes additional runs. The retention statement describes application rows, not deletion from Cloudflare backups. There is no public raw-report or delete endpoint. Review retention before using these reports for long-term calibration.

## One-time hosted setup

1. In Cloudflare, open **Turnstile → Add widget**. Name it `Ogmore observations`, allow hostname `smcqueen2.github.io`, choose **Managed**, and leave pre-clearance off. This does not require moving GitHub Pages hosting or buying a domain.
2. In [repository Actions variables](https://github.com/smcqueen2/stepping-stones/settings/variables/actions), save its **public site key** as `TURNSTILE_SITE_KEY`.
3. In [repository Actions secrets](https://github.com/smcqueen2/stepping-stones/settings/secrets/actions), save its **secret key** as `TURNSTILE_SECRET_KEY`. Never put it in a `VITE_` setting or chat.
4. The existing `CLOUDFLARE_API_TOKEN` needs **Account → D1 → Edit**, in addition to its current Worker deployment/account-access permissions. Restrict it to the existing Cloudflare account. If permission is missing, the provisioning step fails before creating anything. Update the token privately and replace the existing Actions secret if required.
5. Run **Check and Deploy Community Reports**, on `main`, with **deploy** checked. The job validates/tests/bundles first, verifies the revision, privately checks that Turnstile recognises the secret using a deliberately invalid token, creates or reuses the one named D1 database, applies migrations, deploys the Worker, installs the secret through stdin and checks its public summary. A recognised secret must return only `invalid-input-response` for the probe; invalid-secret, network and unexpected responses stop before provisioning. This verifies the secret, not the pairing of a real browser token with the site key. An uncertain create is not automatically retried; rerun to discover/reuse the database. No resource is deleted or silently replaced.
6. The deployment summary prints the new public endpoint and database UUID. Save the UUID as optional variable `CLOUDFLARE_REPORTS_DATABASE_ID`. Save the endpoint as `REPORTS_ENDPOINT` (expected `https://stepping-stones-reports.mcqueen-4.workers.dev/api/reports`, but use the verified job output).
7. Set `CLOUDFLARE_REPORTS_DEPLOY_ENABLED=true` to enable future relevant `main`-push deployments. Run **Build and Deploy Pages** to connect the frontend. The existing `DATA_ENDPOINT` remains unchanged. No key is included in generated JSON or frontend bundles; only the public site key appears in the summary.

Initial secret installation briefly leaves a new Worker unavailable; it fails closed until configured. Subsequent deployments preserve its existing secret, then update it from the Actions secret. Migrations are append-only and schema-only: add a new SQL migration for future schema changes rather than editing an applied file. The serial deployment guard avoids concurrent reports migrations, independently of the existing data deployments. This uses the already pinned Wrangler 4.158.0 from `workers/data-refresh`; no second dependency tree is added.

If D1 denies access, check the **Identify deployment token** step. It uses Cloudflare's read-only account/user token-verification API and prints only the token's metadata ID, ownership kind and active status. Match that ID to the dashboard before editing permissions; a similarly named user or account token may not be the one stored in GitHub. The encrypted bearer value is never printed or retrieved back from GitHub.

## Local development and validation

After `npm ci` and `npm run worker:install`:

```sh
npm run reports:migrate:local
npm run reports:dev
```

In a separate terminal, set `VITE_REPORTS_ENDPOINT=/api/reports` in an ignored `.env.development.local` and run `npm run dev`. Vite proxies this route to the local Worker on `127.0.0.1:8788`; test data lives only in ignored local `.wrangler` state. `wrangler.local.json` permits the two localhost origins at port 5173. For physical-phone testing, explicitly add the laptop's development origin there. Secure random UUID creation supports LAN HTTP even when the browser lacks `crypto.randomUUID`. Never deploy that local configuration. Cloudflare's documented dummy widget passes without a real CAPTCHA. Do not submit invented reports to the production database for testing.

```sh
npm test -- --maxWorkers=2
npx --no-install tsc --noEmit
npm run reports:check
npm run reports:integration
npm run build
```

Unit tests execute the real migration and SQL using Node 22's experimental SQLite module. The integration script also runs the actual Worker in local `workerd` with D1 and rate-limit bindings, using a fixture for Siteverify; it exercises persistence, concurrent cooldown checks, idempotency, aggregate reads and origin rejection. No real Cloudflare database or report is used. Browser review uses the local dummy-key configuration. Hosted verification is read-only; a real Turnstile hostname/action check and public CPU measurements remain activation checks.

## Cost, monitoring and rollback

This design targets Workers Free and D1 Free. It does not upgrade subscriptions or use R2. As checked on 11 November, D1 Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB total; the account's other databases share the allowance. Index maintenance and retention deletions also count as writes. Query scans, not just returned rows, count as reads. Free D1 quota exhaustion returns errors rather than automatically charging overage. Workers Free has a shared 100,000-request/day allowance and a 10 ms CPU limit per invocation. A separate Worker does not create a separate account allowance. Modest traffic is expected to fit, but measure actual usage, including public requests and spam.

Use **Workers & Pages → stepping-stones-reports → Metrics** for requests, errors and CPU; **Storage & databases → D1 → stepping-stones-observations → Metrics** for row reads/writes and storage. Request logs are disabled for this Worker; application code does not log submissions or network identifiers. Turnstile validation/network wait and D1 latency are not CPU computation, but actual hosted CPU must still be measured. The old model's CPU headroom is a separate outstanding task.

To disconnect the UI, clear `REPORTS_ENDPOINT` and rebuild Pages. To stop automatic backend deployment, set `CLOUDFLARE_REPORTS_DEPLOY_ENABLED=false`. Removing `TURNSTILE_SECRET_KEY` from this Worker makes its API unavailable and stops new reports; restoring it recovers service. Keep the database for rollback rather than deleting it. None of these actions changes the environmental feed or warning calculations.

Official references: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 migrations](https://developers.cloudflare.com/d1/wrangler-commands/#d1-migrations-apply), [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Turnstile test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/), [Worker rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
