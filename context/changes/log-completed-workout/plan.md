# Log Completed Workout Implementation Plan

## Overview

Roadmap slice S-01 (FR-001, FR-002, US-01): a signed-in runner opens the main screen (`/dashboard`) on an Android phone, taps "Dodaj trening", enters the date (today or past), distance and average heart rate, and then sees their own workouts from the last 7 days. No other user can see those workouts. This slice introduces the project's first data table and sets the per-user isolation pattern (RLS) that S-02 and S-03 will reuse.

## Current State Analysis

- **No data layer yet:** `supabase/migrations/` does not exist, there are no tables or RLS policies, and there is no `src/types.ts`. `supabase/config.toml` is in place, and `[db.migrations] enabled = true`, so local `supabase start` / `db reset` (and the CI smoke job) apply migrations automatically.
- **Auth pattern to copy:** pages render a React island that only does client-side validation; the form natively POSTs to `src/pages/api/auth/*.ts`, which redirects with `?error=<message>` on failure (`src/pages/api/auth/signin.ts:4-20`, `src/components/auth/SignInForm.tsx:36-40`). Every endpoint handles the `null` branch of `createClient()` (`src/pages/api/auth/signin.ts:9-12`).
- **Reusable UI:** `FormField` (`src/components/auth/FormField.tsx`), `SubmitButton` with `useFormStatus` pending state (`src/components/auth/SubmitButton.tsx`), `ServerError` (`src/components/auth/ServerError.tsx`). Visual style: `bg-cosmic` + glass card (`src/pages/auth/signin.astro:9-10`).
- **Routing:** `/dashboard` is a placeholder (`src/pages/dashboard.astro`) and the only entry in `PROTECTED_ROUTES` (`src/middleware.ts:4`); the prefix match (`src/middleware.ts:19`) also protects `/dashboard/workouts/new`. The middleware does **not** protect `/api/*`, so the endpoint must check `Astro.locals.user` itself.
- **Post-sign-in redirect** goes to `/` (the starter `Welcome` page) at `src/pages/api/auth/signin.ts:19`; the smoke test asserts that (`scripts/smoke.mjs:54`).
- **Local environment gap:** this machine has no Docker, no `.dev.vars` and no git remote, so local Supabase, local smoke and CI-on-push are not yet possible; Phase 1 starts by setting up local Supabase.
- **Testing:** the only automated check is `scripts/smoke.mjs` (asserts status + `Location` only, zero deps) plus the CI gate; CI runs smoke against a local Supabase (`.github/workflows/ci.yml:23-50`).
- **Production:** hosted Supabase (EU) + Cloudflare Workers, deployed manually (`context/deployment/deploy-plan.md`). Workers run in UTC.

## Desired End State

- `public.workouts` exists locally and in production with CHECK constraints and RLS (select + insert own rows only, `authenticated` role only).
- Signing in lands on `/dashboard`, which (in Polish) shows a "Dodaj trening" button and the user's workouts dated from today−6 to today (Europe/Warsaw calendar), newest first, or an empty state.
- `/dashboard/workouts/new` accepts date (not in the future), distance 0.1–200 km (comma or dot, up to 2 decimals) and average HR 30–230 bpm (integer); invalid input is rejected in the browser and on the server, with Polish error messages; success redirects to `/dashboard` where the new workout is listed.
- `npm run smoke` proves: user A's workout appears on A's dashboard and **not** on user B's; invalid and future-dated submissions are rejected; an anonymous POST is redirected to sign-in; sign-in redirects to `/dashboard`.

Verify via the CI gate, `npm run smoke` against a local server, and the manual production steps in Phase 3.

### Key Discoveries:

- `createClient()` returns `null` without secrets — every new caller must branch (`src/lib/supabase.ts:6-8`, AGENTS.md hard rule).
- The prefix check `startsWith(route)` in `src/middleware.ts:19` means no middleware change is needed for `/dashboard/workouts/new`.
- A Postgres `CHECK` cannot reliably express "not in the future" (it would depend on `now()`), so that rule lives in the shared validator + API; numeric ranges live in both the validator and the DB `CHECK`.
- Workers run in UTC; "today" must be derived with `Intl.DateTimeFormat(..., { timeZone: "Europe/Warsaw" })` (full ICU is available in workerd), never from `new Date().toISOString()`.
- `FormField` forwards only a fixed set of props (`src/components/auth/FormField.tsx:7-19`); `inputMode`/`max` need adding for a good Android keyboard and date picker.

## What We're NOT Doing

- Editing or deleting workouts (FR-005 parked; roadmap Open Question 4) — no "edytuj trening" button, no update/delete RLS policies.
- Training-load calculation or display (S-02) and the today's-suggestion flow / "sugestia na dziś" button (S-03).
- Per-user / browser time zones — the app's "today" is fixed to Europe/Warsaw.
- A lower bound on how far back a date may be (PRD allows past workouts without limit).
- Translating the existing auth pages to Polish; moving `FormField`/`SubmitButton`/`ServerError` out of `components/auth/`.
- Generated Supabase types (`supabase gen types`) — types are hand-written in `src/types.ts`.
- Automating `supabase db push` in CI; pgTAP/SQL-level RLS tests.
- Preserving form values after a server-side validation error (client validation mirrors the server, so this path is rare).

## Implementation Approach

Follow the existing auth pattern end to end: SSR Astro pages, a React island only for client-side validation, a native form POST to an API route that redirects. One pure validation module is imported by both the React form and the endpoint so the rules cannot drift; the DB `CHECK` constraints are the last line of defence. Data access goes through a small service in `src/lib/` that takes the request-scoped Supabase client, so RLS (not application filtering) is what guarantees isolation. Order: data layer → user flow → verification and rollout.

## Critical Implementation Details

- **Debug & observability** — Smoke's isolation check works on rendered HTML: the dashboard must render distance with `Intl.NumberFormat("pl-PL")` and 2 fraction digits (e.g. `150,37`), and smoke must generate a distance whose formatted string is unique (e.g. `1XX.YZ` with a non-zero last digit). Changing that display format requires updating smoke in the same commit.
- **Timing & lifecycle** — In production, `supabase db push` must run **before** the Worker with the new code is deployed; otherwise `/dashboard` queries a missing table.

## Phase 1: Data layer

### Overview

Set up local Supabase (prerequisite for every later verification step), then create the `workouts` table with constraints and RLS, plus the types, date helper, shared validator and data service that Phase 2 consumes. No UI changes. Step 1.5 must be done before 1.1 can run.

### Changes Required:

#### 0. Local Supabase environment (prerequisite, human)

**File**: `.dev.vars` (local, git-ignored — not committed)

**Intent**: Give local verification the same backend the CI smoke job uses (`.github/workflows/ci.yml:31-38`), without touching production.

**Contract**: Docker Desktop (WSL2) installed and running; `npx supabase start` succeeds; `.dev.vars` contains `SUPABASE_URL` / `SUPABASE_KEY` taken from `npx supabase status -o env` (`API_URL` / `ANON_KEY`). No repo files change.

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_workouts.sql`

**Intent**: Create the first user-data table and the isolation pattern later slices copy: every row belongs to one auth user, readable and insertable only by that user.

**Contract**:
- `public.workouts`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `workout_date date not null`, `distance_km numeric(5,2) not null check (distance_km between 0.1 and 200)`, `avg_heart_rate smallint not null check (avg_heart_rate between 30 and 230)`, `created_at timestamptz not null default now()`.
- Index on `(user_id, workout_date desc)`.
- `enable row level security`; exactly two policies, both `to authenticated`: `workouts_select_own` (`for select using ((select auth.uid()) = user_id)`) and `workouts_insert_own` (`for insert with check ((select auth.uid()) = user_id)`). No `anon` policies, no update/delete policies.

#### 2. Shared types

**File**: `src/types.ts` (new)

**Intent**: Single definition of the workout shapes used by the service, endpoint and UI.

**Contract**: `Workout { id: string; workout_date: string /* YYYY-MM-DD */; distance_km: number; avg_heart_rate: number; created_at: string }` and `NewWorkoutInput { workout_date: string; distance_km: number; avg_heart_rate: number }`.

#### 3. App-calendar date helper

**File**: `src/lib/dates.ts` (new)

**Intent**: One place that defines "today" and the 7-day window in the app's time zone, so S-02's load uses the same window.

**Contract**: `APP_TIME_ZONE = "Europe/Warsaw"`; `todayInAppTimeZone(now?: Date): string` → `YYYY-MM-DD` in Europe/Warsaw; `addDays(isoDate: string, days: number): string` (pure calendar arithmetic on the date string, UTC-based, DST-safe); `recentWindow(today: string): { from: string; to: string }` → `{ from: addDays(today, -6), to: today }` (inclusive, 7 calendar days). No `astro:*` imports (must be importable from React).

#### 4. Shared validator

**File**: `src/lib/workout-validation.ts` (new)

**Intent**: The single source of input rules for both the React form and the API, with Polish messages.

**Contract**: `validateWorkoutInput(raw: { workout_date: string; distance_km: string; avg_heart_rate: string }, today: string): { ok: true; value: NewWorkoutInput } | { ok: false; errors: Partial<Record<keyof NewWorkoutInput, string>> }`. Rules: date required, valid `YYYY-MM-DD` that round-trips as a real calendar date (`2026-02-30` is rejected), `<= today`; distance accepts `,` or `.` as decimal separator, at most 2 decimals, 0.1–200; HR integer 30–230. Exports the range constants. No `astro:*` imports.

#### 5. Workouts service

**File**: `src/lib/workouts.ts` (new)

**Intent**: Encapsulate Supabase queries; relies on RLS for isolation and passes `user_id` explicitly on insert.

**Contract**: `listRecentWorkouts(supabase: SupabaseClient, today: string): Promise<{ data: Workout[]; error: string | null }>` — rows with `workout_date` in `recentWindow(today)`, ordered `workout_date desc, created_at desc`. `createWorkout(supabase: SupabaseClient, userId: string, input: NewWorkoutInput): Promise<{ error: string | null }>`. Raw Supabase errors are logged with `console.error` and returned as a generic Polish message.

### Success Criteria:

#### Automated Verification:

- Migration applies on a clean local database: `npx supabase db reset`
- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- In local Supabase Studio, `workouts` shows RLS enabled with exactly the two policies `workouts_select_own` and `workouts_insert_own`
- Inserting a row with `distance_km = 500` in the SQL editor fails on the CHECK constraint
- Local environment ready (do first): Docker Desktop running, `npx supabase start` succeeds, `.dev.vars` holds the local `SUPABASE_URL` / `SUPABASE_KEY`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Add-workout and 7-day list flow

### Overview

Wire the user flow: endpoint, add-workout page with a React form, Polish dashboard with the list, and the sign-in redirect to `/dashboard`.

### Changes Required:

#### 1. FormField props

**File**: `src/components/auth/FormField.tsx`

**Intent**: Allow a numeric keyboard on Android and a capped date picker without forking the component.

**Contract**: Add optional `inputMode?: HTMLAttributes["inputMode"]` and `max?: string` props, forwarded to `<input>`. Existing callers are unaffected.

#### 2. Create-workout endpoint

**File**: `src/pages/api/workouts.ts` (new)

**Intent**: Accept the form POST, validate with the shared validator against Warsaw "today", insert via the service.

**Contract**: `POST` form fields `workout_date`, `distance_km`, `avg_heart_rate`. Responses (all 302): no `Astro.locals.user` → `/auth/signin`; `createClient()` returns `null` → `/dashboard/workouts/new?error=<encoded msg>`; validation failure → `/dashboard/workouts/new?error=<first error, encoded>`; insert error → same with the generic message; success → `/dashboard`.

#### 3. Add-workout form island

**File**: `src/components/workouts/WorkoutForm.tsx` (new)

**Intent**: Client-side validation mirroring the server, following `SignInForm`'s submit-prevention pattern.

**Contract**: Props `{ today: string; serverError?: string | null }`. Native `<form method="POST" action="/api/workouts" noValidate>`; fields: date (`type="date"`, default and `max` = `today`), distance (`inputMode="decimal"`), HR (`inputMode="numeric"`); uses `validateWorkoutInput` on submit and `FormField`/`ServerError`/`SubmitButton` (Polish labels: "Data", "Dystans (km)", "Średnie tętno (ud/min)", button "Zapisz trening", pending "Zapisywanie..."). A "Anuluj" link back to `/dashboard`.

#### 4. Add-workout page

**File**: `src/pages/dashboard/workouts/new.astro` (new)

**Intent**: Protected (by the `/dashboard` prefix) page hosting the form.

**Contract**: Reads `?error=`, computes `todayInAppTimeZone()`, renders `WorkoutForm` with `client:load` inside the same card layout as `signin.astro`, heading "Dodaj trening".

#### 5. Dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the placeholder with the main screen for this slice.

**Contract**: Polish UI. Shows user email + sign-out (existing), a "Dodaj trening" link-button to `/dashboard/workouts/new`, heading "Twoje treningi z ostatnich 7 dni", and the list from `listRecentWorkouts(supabase, todayInAppTimeZone())`. Each item: date formatted `pl-PL` (weekday + day + month) with `timeZone: "UTC"` so the `YYYY-MM-DD` value never shifts a day, distance via `Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` + " km", "śr. tętno N ud/min". Empty state: "Brak treningów z ostatnich 7 dni." If `createClient()` is `null` or the query errors, render a Polish error message instead of the list (page still returns 200).

#### 6. Sign-in redirect

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Land the runner on the main screen after sign-in (US-01 starts there).

**Contract**: The success redirect at line 19 changes from `/` to `/dashboard`. Error redirects are unchanged. In the same commit, the smoke step "signin accepts correct password" (`scripts/smoke.mjs:54`) expects location `/dashboard`, so smoke stays green (AGENTS.md: run smoke after changes under `src/pages/api/auth/`).

### Success Criteria:

#### Automated Verification:

- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- Smoke passes against a local preview with local Supabase: `npm run smoke`

#### Manual Verification:

- On a phone-width viewport, sign-in lands on `/dashboard` with the "Dodaj trening" button and the empty state
- Adding a workout with distance `10,5`, HR `145` and today's date redirects to `/dashboard` and lists it as `10,50 km`
- A workout dated 6 days ago is listed; one dated 7 days ago is not
- Future date, distance `0` and HR `300` are each rejected with a Polish message (client-side, and server-side when posted directly)
- The distance field opens a numeric keyboard on Android (or in mobile emulation)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Isolation check and production rollout

### Overview

Extend the smoke test so the privacy guarantee and the new flow are verified in CI on every push, then roll the migration and code out to production.

### Changes Required:

#### 1. Smoke test

**File**: `scripts/smoke.mjs`

**Intent**: Automatically prove per-user isolation and the main paths of the new flow, staying zero-dependency.

**Contract**:
- `request()` also returns the response body text; steps may assert `bodyIncludes` / `bodyExcludes`.
- Cookie jar is reset between users (or one jar per user).
- Existing step "signin accepts correct password" already expects `/dashboard` (changed in Phase 2).
- New steps, in order: anonymous `POST /api/workouts` → 302 `/auth/signin`; user A signs up + signs in; A posts a valid workout (today in Europe/Warsaw, unique distance `1XX.YZ` with non-zero last digit, HR 150) → 302 `/dashboard`; A's `/dashboard` body includes the pl-PL formatted distance (`1XX,YZ`); A posts HR `500` → 302 `/dashboard/workouts/new?error=`; A posts a date 2 days in the future → 302 `/dashboard/workouts/new?error=`; A signs out; user B signs up + signs in; B's `/dashboard` → 200, body includes the empty state "Brak treningów z ostatnich 7 dni." and excludes A's formatted distance (so an error page cannot pass as isolation); B signs out.

### Success Criteria:

#### Automated Verification:

- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- Smoke passes against a local preview with local Supabase: `npm run smoke`
- CI workflow jobs `ci` and `smoke` pass on push (requires a git remote; until one is configured, record this step as skipped rather than passed)

#### Manual Verification:

- Production migration applied by a human: `npx supabase link` + `npx supabase db push`, and `workouts` with RLS is visible in the hosted Supabase dashboard
- Worker deployed after the migration; on production a workout added by account A is visible to A and not to account B
- Smoke users `smoke-…@example.com` created against production (if smoke is run there) are deleted in Supabase → Authentication → Users

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None — the repo has no unit test runner (AGENTS.md › Testing). Validator and date-helper edge cases are covered by manual checks and the smoke validation steps.

### Integration Tests:

- `scripts/smoke.mjs` (Phase 3): anonymous POST redirect, valid insert visible to owner, invalid HR and future date rejected, second user cannot see first user's workout, sign-in redirects to `/dashboard`.

### Manual Testing Steps:

1. Sign in on a phone-width viewport → lands on `/dashboard` with empty state.
2. Add a workout `10,5` km / HR 145 / today → listed as `10,50 km`, `śr. tętno 145 ud/min`.
3. Add workouts dated today−6 and today−7 → only the first is listed.
4. Try a future date, distance `0`, HR `300` → each rejected with a Polish message.
5. Sign in as a second account → none of the first account's workouts are listed.

## Performance Considerations

One indexed query (`user_id, workout_date`) per dashboard render and one insert per submission — well within the 1–2 s NFR (existing auth round trips are ≤ 322 ms wall time per `context/deployment/deploy-plan.md`).

## Migration Notes

New table only; no existing data. Locally and in CI the migration is applied by `supabase start` / `db reset`. In production a human runs `npx supabase link` (once) and `npx supabase db push` before deploying the Worker. Rollback: `drop table public.workouts;` (no other objects depend on it in this slice).

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01)
- PRD: `context/foundation/prd.md` (FR-001, FR-002, US-01, NFRs)
- Similar implementation: `src/pages/api/auth/signin.ts:4-20`, `src/components/auth/SignInForm.tsx:36-40`
- Route protection: `src/middleware.ts:4-23`
- Smoke test: `scripts/smoke.mjs`; CI: `.github/workflows/ci.yml`
- Deployment: `context/deployment/deploy-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data layer

#### Automated

- [x] 1.1 Migration applies on a clean local database: `npx supabase db reset` — 646e56f
- [x] 1.2 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build` — 646e56f

#### Manual

- [x] 1.3 In local Supabase Studio, `workouts` shows RLS enabled with exactly the two policies `workouts_select_own` and `workouts_insert_own` — 646e56f
- [x] 1.4 Inserting a row with `distance_km = 500` in the SQL editor fails on the CHECK constraint — 646e56f
- [x] 1.5 Local environment ready (do first): Docker Desktop running, `npx supabase start` succeeds, `.dev.vars` holds the local `SUPABASE_URL` / `SUPABASE_KEY` — 646e56f

### Phase 2: Add-workout and 7-day list flow

#### Automated

- [x] 2.1 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build` — 566587c

#### Manual

- [x] 2.2 On a phone-width viewport, sign-in lands on `/dashboard` with the "Dodaj trening" button and the empty state — 566587c
- [x] 2.3 Adding a workout with distance `10,5`, HR `145` and today's date redirects to `/dashboard` and lists it as `10,50 km` — 566587c
- [x] 2.4 A workout dated 6 days ago is listed; one dated 7 days ago is not — 566587c
- [x] 2.5 Future date, distance `0` and HR `300` are each rejected with a Polish message (client-side, and server-side when posted directly) — 566587c
- [x] 2.6 The distance field opens a numeric keyboard on Android (or in mobile emulation) — 566587c
- [x] 2.7 Smoke passes against a local preview with local Supabase: `npm run smoke` — 566587c

### Phase 3: Isolation check and production rollout

#### Automated

- [x] 3.1 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- [x] 3.2 Smoke passes against a local preview with local Supabase: `npm run smoke`
- [ ] 3.3 CI workflow jobs `ci` and `smoke` pass on push (requires a git remote; until one is configured, record this step as skipped rather than passed)

#### Manual

- [x] 3.4 Production migration applied by a human: `npx supabase link` + `npx supabase db push`, and `workouts` with RLS is visible in the hosted Supabase dashboard
- [x] 3.5 Worker deployed after the migration; on production a workout added by account A is visible to A and not to account B
- [x] 3.6 Smoke users `smoke-…@example.com` created against production (if smoke is run there) are deleted in Supabase → Authentication → Users
