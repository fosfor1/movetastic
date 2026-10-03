---
project: movetastic
planned_at: 2026-09-26
platform: Cloudflare Workers (Workers + static assets)
status: deployed
---

# First production deploy — Movetastic on Cloudflare Workers

## Context

`context/foundation/infrastructure.md` (2026-09-26) chose **Cloudflare Workers + static assets** (not Pages). `tech-stack.md` now says `deployment_target: cloudflare-workers`, and `wrangler.jsonc` already names the Worker `movetastic` and uses `@astrojs/cloudflare/entrypoints/server` + an `ASSETS` binding. Versions: Astro 7.3.2, `@astrojs/cloudflare` 14.3.1, wrangler 4.131.1 (local — always `npx wrangler`).

What's in place now: no git remote or commits, `gh` not installed, wrangler not authenticated, no local `.dev.vars`, no Supabase migrations. There is a hosted Supabase project in an EU region.

Decisions already made:
- **Manual deploy only.** No GitHub Actions deploy job in this pass.
- **Full smoke test against production**, then delete the test account by hand.

Goal: the app is live at `https://movetastic.<subdomain>.workers.dev` with runtime secrets set, the full smoke test passing, and this plan saved as the audit trail.

Deploy commands are Workers commands: `wrangler deploy`, `wrangler secret put`, `wrangler rollback`. **Never use `wrangler pages ...`.**

## Steps

Legend: 🤖 agent does it · 🧑 human does it (manual gate) · ⛔ agent waits for explicit human "go"

### 0. 🤖 Save the plan
Copy this plan to `context/deployment/deploy-plan.md` (create `context/deployment/`). This is the "what was supposed to happen" record for later milestone planning.

### 1. 🤖 Pre-flight: CI gate + dry run
- `npx astro sync && npm run lint && npx astro check && npm run build` must pass. No Supabase values are needed at build time: the secrets are `access: "secret"`, so they're read at runtime and not inlined.
- `npx wrangler deploy --dry-run`. This deploys nothing. It checks bundle size, the `ASSETS` binding and the compatibility date/flags (`2026-05-08`, `nodejs_compat`).

### 2. 🧑 Log in to Cloudflare
- Run `! npx wrangler login` in the Claude Code prompt. It opens a browser OAuth flow.
- If the account has no `workers.dev` subdomain yet, register one in the dashboard: Workers & Pages → your subdomain. First-time registration can prompt interactively.
- 🤖 then runs `npx wrangler whoami` to confirm the account and account ID.

### 3. 🧑 Supabase dashboard (production project)
- Settings → General: confirm the region is EU. Frankfurt `eu-central-1` is ideal.
- Authentication → Sign In / Providers → Email: turn **"Confirm email" OFF**. The smoke test's signup → signin flow needs this.
- Settings → API: have the **Project URL** and the **anon / publishable key** ready. **Never the service_role key.**
- Don't paste the values into the chat.

### 4. ⛔🤖 First deploy
After the human approves:
- `npm run build && npx wrangler deploy`
- Record the output: the `workers.dev` URL, the Version ID and the Deployment ID.

The Worker has no secrets at this point, so `createClient()` returns `null`. Pages render but auth is inactive. That's harmless for a few minutes on an unannounced URL.

### 5. 🧑 Runtime secrets
Run these in your **own terminal**, because they are interactive and keep the values out of the chat:
```
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```
Each command publishes a new version immediately. 🤖 then runs `npx wrangler secret list` to confirm both names are there; it shows names only.

### 6. 🧑 Supabase auth URLs
Authentication → URL Configuration:
- **Site URL** = `https://movetastic.<subdomain>.workers.dev`
- Add the same URL to **Redirect URLs**.

This keeps later auth emails and redirects from pointing at localhost.

### 7. 🤖 Verify production
- In the background: `npx wrangler tail movetastic --format pretty`. Watch for exceptions, `1102` CPU-limit errors and anything that looks like a null client.
- Smoke test from Git Bash: `BASE_URL=https://movetastic.<subdomain>.workers.dev npm run smoke`. All 8 steps must PASS. The test creates the user `smoke-<timestamp>@example.com`.
- `npx wrangler deployments list` should show the deploy plus two secret versions.
- Check CPU time per request in the Workers Logs dashboard (`observability.enabled` is already on). If any request is close to 10 ms, recommend upgrading to Workers Paid ($5/month). That's a human billing decision.

### 8. 🧑 Clean up
- Supabase → Authentication → Users: delete the `smoke-…@example.com` account.
- Decide on "Confirm email". Recommendation: leave it OFF during MVP testing and turn it back ON before a public launch. Note that re-enabling it breaks the production smoke test.

### 9. 🤖 Record the outcome
Append a **Deployed** section to `context/deployment/deploy-plan.md` with:
- the date, URL, Version ID
- the secret names that are configured (never the values)
- the smoke result and the CPU observation
- open follow-ups

## Rollback / approval posture
- **Rollback:** `npx wrangler versions list` → `npx wrangler rollback <VERSION_ID> --message "<reason>"`. For this first deploy there's no earlier code version, so a bad deploy gets a forward fix plus redeploy.
- **Human only:**
  - `wrangler login` and any API-token creation
  - deleting the Worker (`wrangler delete`)
  - billing plan changes
  - any Supabase key rotation or database reset
  - Supabase auth settings
- **Agent may, after approval of step 4:** build, dry run, deploy, `tail`, `secret list`, `deployments list`, running the smoke test.

## Out of scope (follow-ups)
- The GitHub Actions deploy job. It needs a git remote, a first commit, a scoped `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets.
- Custom domain.
- Preview-URL protection (Cloudflare Access).
- Supabase migrations and RLS for training data.
- Setting `site` in `astro.config.mjs` so the sitemap stops being skipped. Do it once the final domain is known.

## Critical files
- `wrangler.jsonc`: read only, already correct.
- `astro.config.mjs`: `env.schema`, read only.
- `src/lib/supabase.ts`: the `null` branch. Reason for the secrets check.
- `scripts/smoke.mjs`: the verification.
- `context/deployment/deploy-plan.md`: new, the audit trail.

## Verification summary
Deployment is done when:
- `npm run smoke` against the `workers.dev` URL prints "All smoke steps passed"
- `wrangler tail` shows no exceptions during the run
- `wrangler secret list` shows `SUPABASE_URL` and `SUPABASE_KEY`
- `deploy-plan.md` has the Deployed section filled in

## Pre-flight findings (2026-09-26)

- CI gate: `astro sync` ✓, `astro check` 0 errors ✓, `npm run build` ✓. `npm run lint` ✗ locally — all 1086 errors are `prettier/prettier` CRLF line endings from the Windows checkout (`core.autocrlf=true`); commits/CI get LF. Decision: proceed, fix separately (e.g. `"endOfLine": "auto"` or `.gitattributes`).
- `wrangler deploy --dry-run` ✓: 2060.72 KiB upload (455.47 KiB gzip), 11 static assets. Bindings: `ASSETS`, plus two injected by `@astrojs/cloudflare` 14.3.1 defaults that the app does not use yet: `SESSION` (KV, no id) and `IMAGES` (Cloudflare Images).
- Decision: allow wrangler to auto-provision the `SESSION` KV namespace on first deploy (free tier; reserved for future Astro sessions). Record its id below after deploy.

## Deployed (2026-09-26)

- **URL**: https://movetastic.sebastian-kowalski85.workers.dev
- **First deploy**: `npm run build && npx wrangler deploy` (wrangler 4.131.1) — Version ID `e7132f29-b457-4e1a-8bfe-9e7fd4ae391d`, startup time 20 ms, 8 assets uploaded.
- **Provisioned by wrangler**: KV namespace `movetastic-session` (id `24d6123deaff4146b46e25ad110e5916`) bound as `SESSION`.
- **Anonymous check (no secrets yet)**: `/` → 200, `/dashboard` → 302 `/auth/signin`, `/auth/signin` → 200.
- **Runtime secrets** (set by human via `wrangler secret put`, names only): `SUPABASE_URL`, `SUPABASE_KEY` — versions `6fd171a3-90cd-45c0-9042-e14d7281ed6f`, `bd273342-6a34-412c-8722-4c1c5424e24f` (current, 100%).
- **Supabase auth**: "Confirm email" OFF; Site URL + Redirect URL set to the workers.dev URL (human, step 3 / 6).

### Verification (2026-09-26)

- `BASE_URL=https://movetastic.sebastian-kowalski85.workers.dev npm run smoke` → **8/8 PASS** ("All smoke steps passed").
- `wrangler tail` during the run: 8 events, all `ok`, 0 exceptions, 0 error logs.
- CPU time per request: `GET /` 18 ms, `POST /api/auth/signup` 11 ms, `POST /api/auth/signin` 8–12 ms, `GET /dashboard` 1–9 ms, signout 9 ms. Wall time ≤ 322 ms (Supabase round trips) — well inside the 1–2 s NFR.
- **Risk materialised**: 3 of 8 requests exceeded the free plan's 10 ms CPU target. They succeeded (free plan tolerates short bursts), but sustained overage risks `1102` errors. Recommendation: upgrade to Workers Paid ($5/mo) before inviting testers — human billing decision.

### Open follow-ups

- Human: delete the smoke user `smoke-<timestamp>@example.com` in Supabase → Authentication → Users.
- Human: decide on "Confirm email" (recommended: OFF during MVP testing, ON before public launch — re-enabling breaks the production smoke test).
- Human: Workers Paid plan decision (see CPU finding).
- ~~Fix local CRLF lint failures~~ — done 2026-09-26: `.gitattributes` (`* text=auto eol=lf`) + 45 files converted to LF; CI gate passes locally.
- Set `site` in `astro.config.mjs` to the production URL so the sitemap is generated.
- Git remote + first commit, then GitHub Actions deploy job with a scoped `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit, this account only) + `CLOUDFLARE_ACCOUNT_ID`.
- Protect or disable preview URLs before real user data exists.
