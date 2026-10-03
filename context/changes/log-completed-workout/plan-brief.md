# Log Completed Workout — Plan Brief

> Full plan: `context/changes/log-completed-workout/plan.md`

## What & Why

Roadmap slice S-01: a signed-in runner adds a completed workout (date, distance, average heart rate) and sees their workouts from the last 7 days on the main screen. It is the first input the training-load (S-02) and today's-suggestion (S-03) slices need, and it establishes the privacy guardrail: no user can see another user's training data.

## Starting Point

Auth (email + password), the protected `/dashboard` placeholder, Cloudflare Workers deploy and a smoke test already exist. There are no migrations, tables or RLS policies yet, and sign-in currently lands on the starter's welcome page `/`.

## Desired End State

After signing in the runner lands on a Polish `/dashboard` with a "Dodaj trening" button and a list of their workouts dated today−6…today (Warsaw calendar). The add form on `/dashboard/workouts/new` rejects unrealistic or future-dated entries. The smoke test proves in CI that user B never sees user A's workouts.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| "Last 7 days" | Today + 6 previous calendar days, "today" in Europe/Warsaw | Matches a Polish runner's intuition and gives S-02 one fixed window; Workers run in UTC. |
| Input validation | Date not in future; distance 0.1–200 km (comma or dot, ≤2 decimals); HR 30–230 integer | Typos would corrupt the S-02 load and can't be fixed without editing (FR-005 is out of scope). |
| Where rules live | One shared validator (form + API) plus DB `CHECK` for ranges | Rules can't drift; "not in future" can't be a reliable `CHECK`, so the API enforces it. |
| Form placement | Separate page `/dashboard/workouts/new`, native POST + redirect | Same pattern as auth; protected by the existing `/dashboard` prefix; keeps the main screen free for S-02/S-03. |
| UI language | Polish for new screens; auth pages unchanged | PRD names the buttons in Polish. |
| Isolation guarantee | RLS: select + insert own rows, `authenticated` only; no update/delete | Database-enforced privacy; editing is parked. |
| Isolation verification | Extend `scripts/smoke.mjs` with two users and HTML body checks | Checked automatically in CI on every push, no new dependencies. |
| Post-sign-in landing | Redirect to `/dashboard` | US-01 starts on the main screen. |
| Production migration | Manual `supabase link` + `db push` before Worker deploy | Matches the manual deploy; no DB secrets in CI. |

## Scope

**In scope:**
- `workouts` table, CHECK constraints, index, RLS policies (migration)
- `src/types.ts`, Warsaw date helper, shared validator, workouts service
- `POST /api/workouts`, add-workout page + React form, Polish dashboard list with empty state
- Sign-in redirect to `/dashboard`; `FormField` gains `inputMode`/`max`
- Smoke test: isolation, validation, anonymous POST, new redirect

**Out of scope:**
- Editing/deleting workouts, the "edytuj trening" button (FR-005 parked)
- Training load (S-02), suggestion flow and its button (S-03)
- Per-user time zones, a lower bound on past dates
- Translating auth pages, generated Supabase types, CI-automated `db push`, SQL-level RLS tests

## Architecture / Approach

SSR Astro pages + a React island for client-side validation only; the form natively POSTs to `src/pages/api/workouts.ts`, which validates with the shared module against Warsaw "today", inserts through `src/lib/workouts.ts` using the request-scoped Supabase client, and redirects. Isolation is enforced by RLS, not by application filters. The dashboard reads the 7-day window through the same service.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data layer | Local Supabase setup; migration with RLS, types, date helper, validator, service | Wrong RLS policy would leak data to every later slice |
| 2. Add-workout and 7-day list flow | Endpoint, add page/form, Polish dashboard, sign-in → `/dashboard` (+ smoke expectation) | UTC vs Warsaw "today" off-by-one around midnight |
| 3. Isolation check and production rollout | Two-user smoke in CI; manual `db push` + deploy | Deploying the Worker before the migration breaks `/dashboard` |

**Prerequisites:** Docker Desktop + local Supabase + `.dev.vars` (not present yet — set up as the first step of Phase 1); Supabase CLI access to the hosted project for `db push`; wrangler auth for deploy; a git remote for CI-on-push (until then step 3.3 is recorded as skipped).
**Estimated effort:** ~2–3 after-hours sessions across 3 phases.

## Open Risks & Assumptions

- Smoke checks rendered HTML for the pl-PL formatted distance (and user B's empty state); changing the display format or the empty-state text requires updating smoke together.
- Users outside Poland get a shifted "today" (accepted MVP simplification).
- Range limits (0.1–200 km, 30–230 bpm) are fixed in a migration; changing them needs a new migration.

## Success Criteria (Summary)

- A runner signs in on an Android phone, adds today's run and immediately sees it in their 7-day list.
- Unrealistic or future-dated entries are rejected with a clear Polish message.
- CI smoke proves that a second user never sees the first user's workouts.
