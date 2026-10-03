---
project: movetastic
researched_at: 2026-09-26
recommended_platform: Cloudflare Workers (Workers + static assets)
runner_up: Render
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7 SSR (React 19 islands, Tailwind 4) + Supabase (external Postgres + auth)
  runtime: Cloudflare workerd (@astrojs/cloudflare 14.x, wrangler 4.x)
---

## Recommendation

**Deploy on Cloudflare Workers (Workers + static assets — not Cloudflare Pages).**

Cloudflare is the only platform that passed all five agent-friendly criteria (17/17 weighted), and it is the cheapest fit for the interview answers: request/response only, cost minimisation first, single region (Poland), no prior platform familiarity, data layer undecided but already Supabase in the stack. At the PRD's scale (small users, low QPS) traffic fits the free plan's 100k requests/day, with the $5/mo Workers Paid plan as the safety valve for the 10 ms CPU cap. Crucially, the scaffolded project already targets it — `wrangler.jsonc` uses `@astrojs/cloudflare/entrypoints/server` + an `assets` binding, and `astro dev` already runs on workerd — so every other platform would require swapping the adapter to `@astrojs/node`/`@astrojs/vercel` before the first deploy.

## Platform Comparison

Scoring: Pass = 2, Partial = 1, Fail = 0. CLI-first, Managed and Stable deploy API weighted ×2; Agent-readable docs ×1.5; MCP ×1 (max 17). Adjustments from the interview: cost floor above ~$5/mo or a free tier that breaks the PRD's 1–2 s response NFR → penalty; leaving the already-scaffolded Cloudflare adapter → −1. No platform was hard-filtered (no persistent connections required; all run TypeScript/Astro).

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Criteria | Adjustments | Total |
|---|---|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 17 | 0 | **17** |
| Render | Pass | Pass | Pass | Pass | Pass | 17 | −1 cost, −1 adapter | **15** |
| Vercel | Pass | Pass | Pass | Pass | Partial | 16 | −2 cost, −1 adapter | **13** |
| Fly.io | Pass | Partial | Pass | Pass | Partial | 14 | −0.5 cost, −1 adapter | **12.5** |
| Railway | Pass | Pass | Pass | Partial | Partial | 14 | −0.5 cost, −1 adapter | **12.5** |
| Netlify | Pass | Pass | Pass | Partial | Pass | 15 | −2 cost/region, −1 adapter | **12** |

All statuses below checked 2026-09-26.

**Cloudflare Workers.** `wrangler deploy`, `wrangler rollback [VERSION_ID]`, `wrangler versions list|deploy`, `wrangler tail`, `wrangler secret put` — all GA, non-interactive. Docs published as `llms.txt` / `llms-full.txt` (GA); `Accept: text/markdown` content negotiation is newer with no explicit GA label. Managed remote MCP servers (docs, bindings, observability) are GA. Free: 100k req/day, 10 ms CPU/request; Paid $5/mo: 10M req + 30M CPU-ms. Pages is not deprecated but de-emphasised — Cloudflare steers new projects to Workers + static assets, which is what this repo already uses. Workers Builds (Git integration, preview URLs per branch) is GA.

**Render.** CLI v2 (`deploys create`, `logs --tail`) with `-o json`; rollback via REST API `POST /rollback-deploy` (no CLI verb). `llms.txt` + `.md` pages. Hosted MCP server GA since Aug 2025 (no scaling ops; secrets may reach agent context). Free web services spin down after 15 min idle with 30–60 s cold starts — incompatible with the 1–2 s NFR — so the real floor is Starter $7/mo. Frankfurt region GA. Requires `@astrojs/node` standalone and binding to `0.0.0.0`.

**Vercel.** `vercel --prod`, `vercel rollback`, `vercel promote`, `vercel logs` (rebuilt Feb 2026). `llms.txt` + `.md` pages. MCP server is official but beta-maturity (read-only until its first write tool on 2026-07-23). Hobby is free but **non-commercial only**; Pro is $20/seat/mo. Single region `fra1` works on Hobby. `@astrojs/vercel` 11.x gotcha: without `middlewareMode: 'edge'` middleware is skipped on ISR cache hits — dangerous for auth middleware; `edge` + ISR was silently broken before 11.0.10. Native WebSockets are public beta (2026-06-22).

**Fly.io.** `fly deploy`, `fly logs`, `fly secrets set`; rollback = `fly releases --image` + `fly deploy --image <ref>` (no rollback verb). `llms.txt` with markdown pages. `fly mcp server` is marked **experimental**. Free allowances removed for orgs created after 2024-10-07; shared-cpu-1x ≈ $2/mo, realistic $5–20/mo. Needs a hand-verified Dockerfile (open report that `fly launch` fails to detect Astro 5 projects). **Warsaw (`waw`) region was consolidated away on 2026-09-09** — use `fra`/`ams`.

**Railway.** `railway up`, `railway logs`, `railway variables set`, `railway redeploy` — but rolling back to an arbitrary older deploy is **dashboard-only** (docs.railway.com/guides/roll-back-bad-deploy). `llms.txt` + `.md` pages. Official MCP server exists (`railwayapp/railway-mcp-server`), tier/status not clearly labelled. Hobby $5/mo incl. $5 usage. Single EU region (Amsterdam). Needs `@astrojs/node` bound to `0.0.0.0`.

**Netlify.** `netlify deploy` (draft by default, `--prod` to publish), `netlify logs --follow`; no rollback subcommand, rollback API reported flaky. `llms.txt` + `.md` twins. Official MCP server GA. Credit-based free plan (300 credits/mo) is likely enough, but **function region selection is Pro/Enterprise only** — free functions run in Ohio, far from an EU Supabase project; region cannot be set from code with the Astro adapter.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Perfect score on all five criteria, $0–5/mo at MVP scale, zero migration (adapter, `wrangler.jsonc`, `astro:env` secrets and the workerd dev server are already in place), deterministic `wrangler rollback`, and GA first-party MCP servers for when CLI output becomes the bottleneck. Global edge placement is irrelevant for a single-region audience but costs nothing.

#### 2. Render

Also passes all five criteria, with a GA hosted MCP server and a Frankfurt region. It falls behind on cost (flat $7/mo — the free tier's cold starts violate the response-time NFR) and on migration effort (swap to `@astrojs/node`, bind `0.0.0.0`, publish `dist/client`). The natural fallback if workerd-runtime incompatibilities become blocking.

#### 3. Vercel

Excellent CLI and instant rollback, free Hobby tier with an EU region. Loses on MCP maturity, on the non-commercial Hobby clause (Pro $20/mo the moment the app monetises), on the adapter swap, and on an auth-relevant middleware/ISR gotcha in `@astrojs/vercel`.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **10 ms CPU cap per request on the free plan.** Protected requests run Astro SSR + React island SSR + Supabase session parsing in `src/middleware.ts`; heavier routes can exceed 10 ms and return intermittent `1102 Worker exceeded CPU` errors that never reproduce locally.
2. **Missing runtime secrets fail silently.** CI passes `SUPABASE_*` only to the build; the Worker reads them at runtime from Workers Secrets. If `wrangler secret put` is skipped, `createClient()` returns `null`, and the mandated `null` branch turns the misconfiguration into a working page with a dead login — no crash, no alert.
3. **Edge compute, single-region database.** The Worker executes near the user, and each request makes one or more HTTP round trips to Supabase. A Supabase project created in a US region adds transatlantic latency per call and endangers the 1–2 s NFR.
4. **Contract drift.** `tech-stack.md` says `deployment_target: cloudflare-pages` and auto-deploy on merge to `main`; the repo is a Workers + assets config and CI triggers on `master`. An agent following `tech-stack.md` literally would run `wrangler pages deploy` — the wrong command for this project.
5. **Starter Worker name.** `wrangler.jsonc` still has `"name": "10x-astro-starter"`; the first deploy creates a Worker under that name, and renaming later creates a new Worker while secrets and routes stay on the old one.

### Pre-Mortem — How This Could Fail

The team shipped Movetastic to Cloudflare Workers in week three by running `wrangler deploy` straight from the laptop. The site loaded, so they called it done. Nobody had run `wrangler secret put` — the build succeeded with CI's secrets, but the deployed Worker had none; `createClient()` returned `null` and sign-in quietly did nothing. Two testers gave up before anyone checked `wrangler tail`. Once secrets were fixed, the Supabase project — created with default settings in a US region — added ~300 ms per round trip; the dashboard page chaining session refresh and the training-load query blew past the 2 s budget on mobile. Then, on the free plan, the home route occasionally hit the 10 ms CPU ceiling and returned Cloudflare error pages that never reproduced in `astro dev`. Meanwhile, a later agent session read `tech-stack.md`, saw "Cloudflare Pages", and created a separate Pages project with Git integration, so pushes deployed twice to two different URLs. Rollback via `wrangler rollback` restored the code but not a Supabase migration applied alongside it. The platform wasn't wrong — the unwritten operating assumptions were.

### Unknown Unknowns

- **`astro dev` already runs on workerd** (Astro 6+ via Cloudflare's Vite plugin): `wrangler dev` is redundant, local secrets come from `.dev.vars`, and `Astro.locals.runtime` no longer exists. Keep static `astro:env/server` imports (stable); Astro marks `getSecret()` as experimental.
- **`wrangler secret put` publishes a new version immediately**; use `wrangler versions secret put` to stage without deploying. `wrangler rollback` reverts Worker code only — never Supabase migrations — and how it interacts with secrets changed afterwards should be verified once before relying on it.
- **Two deploy paths can both be live.** Workers Builds (Git integration) and a `wrangler deploy` step in GitHub Actions can coexist, deploying every push twice. Pick exactly one.
- **`nodejs_compat` is default only for compatibility dates ≥ 2026-08-04.** The repo pins `2026-05-08` and sets the flag explicitly (correct). npm packages needing `net`, `fs` or native binaries still build fine and fail at runtime.
- **Free-plan limits are hard-enforced, not billed as overage** (CPU cap; D1 refuses requests past quota since 2026-09-01). The $5 plan is the practical safety valve.

## Operational Story

- **Preview deploys**: `wrangler versions upload` creates a non-production version with its own preview URL (`<version-prefix>-movetastic.<subdomain>.workers.dev`) without shifting traffic; if Workers Builds is chosen instead of GitHub Actions, each non-production branch gets an aliased preview URL and a PR comment. Preview URLs are public by default and use the same Worker secrets as production (i.e. the production Supabase project) — protect them with Cloudflare Access, or disable preview URLs, before real user data exists.
- **Secrets**: runtime secrets `SUPABASE_URL` / `SUPABASE_KEY` live in Workers Secrets (`wrangler secret put <KEY>`), declared in `env.schema` of `astro.config.mjs` and read via `astro:env/server`; local dev uses `.dev.vars` (gitignored); CI build values and the deploy token `CLOUDFLARE_API_TOKEN` (scoped to Workers Scripts:Edit for this account, no DNS/billing) plus `CLOUDFLARE_ACCOUNT_ID` live in GitHub Actions Secrets. Rotation: create the new Supabase key → `wrangler secret put` (deploys immediately) → update GitHub Secret → revoke the old key in Supabase.
- **Rollback**: `wrangler versions list` → `wrangler rollback <VERSION_ID> --message "<reason>"`; takes effect in seconds globally. Supabase migrations do not roll back — write forward-fix migrations.
- **Approval**: human-only — first production deploy, creating/rotating the Cloudflare API token, deleting the Worker, dropping/resetting the Supabase database, rotating the Supabase service/anon key, upgrading the billing plan. Agent may do unattended: `npm run build`, `wrangler versions upload` (preview), `wrangler tail`, `wrangler versions list`, `wrangler deployments list`; `wrangler deploy` and `wrangler rollback` to production only after the human approves the specific action.
- **Logs**: runtime — `npx wrangler tail movetastic --format json` (live, read-only) and Workers Logs in the dashboard (`observability.enabled: true` is already set); deploy history — `npx wrangler deployments list`; pipeline — `gh run list` / `gh run view <id> --log` for GitHub Actions. Optional later: Cloudflare observability MCP server for structured log queries.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| SSR requests exceed the free plan's 10 ms CPU cap → error 1102 | Devil's advocate | M | M | Watch CPU time in Workers Logs after first deploy; upgrade to Workers Paid ($5/mo) at the first 1102 or before sharing with testers |
| Runtime secrets missing → `createClient()` returns `null`, login silently dead | Devil's advocate | H | H | `wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` before first deploy; run `npm run smoke` with `BASE_URL` set to the production URL after every deploy |
| Supabase project in a region far from Poland breaks 1–2 s NFR | Devil's advocate | M | H | Create/verify the Supabase project in `eu-central-1` (Frankfurt); consider Workers Smart Placement only if latency is measured to be a problem |
| `tech-stack.md` says Pages / `main`; repo is Workers / `master` → agent runs wrong commands | Devil's advocate | H | M | Done 2026-09-26: `tech-stack.md` now says `deployment_target: cloudflare-workers` and auto-deploy on merge to `master` |
| Starter Worker name `10x-astro-starter` becomes the permanent prod identity | Devil's advocate | H | L | Done 2026-09-26: `wrangler.jsonc` name set to `movetastic` before any deploy |
| Double deploys from Workers Builds + GitHub Actions | Unknown unknowns | M | M | Choose one path (recommended: GitHub Actions `wrangler deploy` after the existing `ci` + `smoke` jobs); do not connect the Git integration |
| Rollback restores code but not DB schema | Pre-mortem | M | H | Additive, backward-compatible migrations only; forward-fix; apply migrations separately from code deploys |
| npm dependency needs Node APIs unavailable in workerd | Unknown unknowns | L | M | `npm run preview` (workerd) in CI already exercises the runtime; check new deps for Workers compatibility before adding |
| `wrangler secret put` deploys immediately, shipping untested code alongside a secret change | Unknown unknowns | L | M | Use `wrangler versions secret put` + `wrangler versions deploy` when code and secrets change together |
| Free-plan hard limits (CPU, D1/KV quotas) cause errors instead of overage bills | Research finding | L | M | Stay on Supabase for data (no D1 dependency); budget $5/mo Paid plan as needed |
| `Accept: text/markdown` docs negotiation has no explicit GA label (checked 2026-09-26) | Research finding | L | L | Use `developers.cloudflare.com/.../llms.txt` (GA) as the agent docs entry point |

## Getting Started

Versions verified against the project: Astro 7.3.2, `@astrojs/cloudflare` 14.3.1, wrangler 4.131.1 (local devDependency — use `npx wrangler`, no global install).

1. The Worker is already named `movetastic` in `wrangler.jsonc`; run `npx wrangler login` (human, one-time) and `npx wrangler whoami` to confirm the account.
2. Confirm the Supabase project region is `eu-central-1`, then set runtime secrets: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY` (this creates the Worker if it doesn't exist yet).
3. Build and deploy with Workers commands (not `wrangler pages ...`): `npm run build && npx wrangler deploy`.
4. Verify: `BASE_URL=https://movetastic.<subdomain>.workers.dev npm run smoke`, and watch `npx wrangler tail movetastic` during the run for CPU-limit or null-client errors.
5. Later (deploy plan): add a GitHub Actions deploy job gated on `ci` + `smoke`, using a scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from GitHub Secrets.

Local development stays `npm run dev` (already on workerd, secrets from `.dev.vars`) — no `wrangler dev` needed.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
