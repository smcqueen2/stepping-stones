# Authentication for the Cloudflare proof of concept

Updated 11 November 2026. The selected route is **Workers Free + classic KV + Wrangler/GitHub Actions**. GitHub metadata confirms the secret name and account-ID variable. The token value has not been requested or accessed. The owner reports enabling R2, but this route does not use it.

## GitHub configuration

| Setting | Type | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Repository secret | Authenticate the deployment/provisioning job with Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | Repository variable | Select the intended Cloudflare account |
| `CLOUDFLARE_KV_NAMESPACE_ID` | Optional repository variable | Select existing classic KV storage; omitted means create/reuse the named project namespace |
| `CLOUDFLARE_WORKER_DEPLOY_ENABLED` | Optional repository variable | `true` enables relevant main-push deployments; checked manual deployments work independently |
| `GITHUB_TOKEN` | Issued automatically by GitHub | Read this repository; no extra GitHub PAT is required |

Create an **account API token** under Cloudflare **Manage account > Account API tokens**. Start with **Edit Cloudflare Workers**, limit it to the intended account and ensure permissions cover creating/deploying Workers and listing/creating classic Workers KV namespaces. Cloudflare's current Worker roles distinguish product-level Admin (new Worker creation) from Editor (existing Workers). That does not require whole-account administrator access. Custom domains, DNS, D1, R2 and billing-management permissions are not required by this proof of concept.

Save the token directly in [repository Actions secrets](https://github.com/smcqueen2/stepping-stones/settings/secrets/actions) as `CLOUDFLARE_API_TOKEN`. Keep it out of chat, code and frontend `VITE_` settings. Copy the Cloudflare account ID into [Actions variables](https://github.com/smcqueen2/stepping-stones/settings/variables/actions) as `CLOUDFLARE_ACCOUNT_ID`. Expiry/rotation means replacing the secret; no source edit is needed.

The pipeline passes these to the provisioning helper and Wrangler. It never retrieves the secret from GitHub or serialises credentials into generated configuration. GitHub injects the secret only into the deployment job; PR validation is credential-free.

## Runtime and optional NRW credentials

The running Workers use their shared `SNAPSHOTS` KV binding, not the deployment token. `NRW_API_KEY` is a separate runtime secret on **stepping-stones-monitoring** for official warnings. CI checks existing secret names before moving the model deployment; it never reads secret values. On 11 November, the owner configured an encrypted production secret there and a separate repository Actions secret; authenticated generation succeeded through both routes. A Cloudflare deployment token does not provide NRW access. Failed, missing or stale warning responses still produce explicitly unverified status. Reporting collection remains on hold.

See [the deployment, verification and rollback guide](cloudflare-worker.md). Keep **Workers Free** selected. This pipeline never upgrades subscriptions; it does not automatically confirm the account's billing plan.

## Deferred SST investigation

SST was explored before the owner selected the simpler proof of concept. It has not been installed/integrated. SST 4.17.2's Cloudflare home uses an `sst-state` R2 bucket and the same API token for state operations. That alternative needs R2 activation/permissions and maps the account variable to `CLOUDFLARE_DEFAULT_ACCOUNT_ID`. None of that setup is required for the current Wrangler route. Preserve this distinction if adopting SST later.

Primary sources: [Cloudflare account tokens](https://developers.cloudflare.com/fundamentals/api/get-started/account-owned-tokens/), [Worker roles](https://developers.cloudflare.com/workers/authorization/workers/), [GitHub Actions deployment](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [KV creation API](https://developers.cloudflare.com/api/resources/kv/subresources/namespaces/methods/create/), [SST credentials](https://sst.dev/docs/cloudflare/), [SST 4.17.2 state implementation](https://github.com/sst/sst/blob/v4.17.2/pkg/project/provider/cloudflare.go).
