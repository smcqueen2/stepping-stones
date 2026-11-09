# TypeScript infrastructure options for the data Worker

Research checkpoint: 9 November 2026. The owner steered away from Terraform/HCP-style setup and asked for an AWS CDK/CloudFormation-like experience: define resources in code and deploy the complete stack through a pipeline. No replacement framework has been selected or implemented yet, and no cloud resources have been created. The earlier Wrangler-only workflow remains a local, uncommitted draft.

## Deferred CDK-style direction: SST

**Decision update, 9 November 2026:** following the billing-risk discussion, the owner authorised a **Workers Free + classic KV + Wrangler/GitHub Actions proof of concept**. This is now the active route, documented in [the Worker setup guide](cloudflare-worker.md). It provisions/reuses the KV namespace directly, keeps configuration in Git and needs no R2 deployment-state bucket. SST/Pulumi/Alchemy remain deferred research. The owner reports R2 is enabled, but this proof of concept does not use it. The research checkpoint below describes the earlier proposal, not current deployment requirements.

[SST's Cloudflare support](https://sst.dev/docs/cloudflare/) provides TypeScript components for [Workers](https://sst.dev/docs/component/cloudflare/worker/), [KV namespaces](https://sst.dev/docs/component/cloudflare/kv/) and [Cron jobs](https://sst.dev/docs/component/cloudflare/cron/). That is close to the requested CDK-style developer experience: declare the storage, Worker, bindings, schedule and configuration in `sst.config.ts`, then deploy the desired stack.

SST can use `home: "cloudflare"` to keep deployment state in the Cloudflare account. It still manages state and needs initial account permissions/bootstrap; this does not remove the need for durable state. Exact bootstrap resources, permissions, retention/locking behaviour and free-tier implications must be validated against the pinned release before enabling a pipeline. The SST Console account is optional for a GitHub Actions-driven setup.

Authentication follow-up: inspected SST 4.17.2's Cloudflare provider and confirmed R2-backed state bootstrap (`sst-state` bucket) using the Cloudflare API token. [The authentication guide](cloudflare-authentication.md) documents GitHub secret/variable names, SST's account-variable mapping, creation permissions, R2 activation and the distinction from runtime/NRW credentials. No framework has been installed or authenticated yet.

Proposed flow: **push → application tests/type checks → `sst diff --stage production` → `sst deploy --stage production`**. Initial bootstrap must be treated separately from an ordinary preview: a first-run infrastructure tool may provision its state resources before showing application changes. Do not describe an untested first diff as having no account side effects.

SST would become the production owner of the Worker/resources; the current Wrangler production-deploy path must then be replaced or disabled, rather than having both tools change the same Worker. Preserve the existing `scheduled` and read-only HTTP handlers, 15-minute Cron, source timestamps, failure/last-warning handling, current source calibration and explicit website cutover. The static site stays on GitHub Pages. Infra tooling is isolated from the frontend bundle, and community-report storage remains on hold.

This is a recommendation based on documented components, not a tested project integration. Existing code expects `env.SNAPSHOTS`; exact binding names, reuse of the same scheduled/HTTP Worker, secret handling and runtime/build compatibility need a focused adapter/config check before adoption.

## Other choices checked

- **Pulumi TypeScript**: explicit resources for [KV](https://www.pulumi.com/registry/packages/cloudflare/api-docs/workerskvnamespace/), Worker deployments and [Cron](https://www.pulumi.com/registry/packages/cloudflare/api-docs/workerscrontrigger/), plus preview/update operations. Its [managed Free plan](https://www.pulumi.com/pricing/) supports individuals with state management, or a [DIY backend](https://www.pulumi.com/docs/iac/operations/stack-management/using-a-diy-backend/) can use S3-compatible storage. It is a strong alternative if the owner prefers lower-level resource definitions; a backend choice remains necessary. The Cloudflare package is based on Cloudflare's Terraform provider, but users write TypeScript and run Pulumi rather than Terraform/HCL.
- **Alchemy**: TypeScript/Effect-oriented Cloudflare resources and a [Cloudflare-backed state store](https://alchemy.run/state-store/). The current 2.0 release line inspected is beta. Its state Worker uses a SQLite-backed Durable Object and Secrets Store entries; even an initial plan/dev may bootstrap those resources. Verify release stability, bootstrap/CI behaviour and required permissions before choosing it. The published CI example provisions credentials from an elevated admin profile; that is not a reason to grant broad token-creation rights to routine project deployments.

The owner has not selected SST/Pulumi/Alchemy yet. The earlier HCP-vs-R2 question is superseded by the CDK-style direction; do not create an HCP account/workspace based on the discarded Terraform draft.

## Draft handling

The Terraform-specific module, provider lock/cache, workflow and related documents were moved intact outside version control to the parent `worker-iac-review/terraform-draft/`. Only agent-created draft files were moved; no files were deleted and no tracked application/data files were rolled back. Terraform binaries remain isolated in that parent review folder, not installed globally. The draft passed schema validation and three mocked plans, but never ran an authenticated cloud plan/apply.
