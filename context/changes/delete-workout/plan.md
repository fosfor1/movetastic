# Delete Workout Implementation Plan

## Overview

Roadmap slice S-04, the north star of milestone M-2 (`context/foundation/roadmap.md`). A signed-in runner picks a workout from the 7-day list on the dashboard, sees a confirmation screen with that workout's data, confirms, and lands back on the dashboard with the notice „Trening usunięty.”. The list and the 7-day load no longer include that workout, so the next suggestion is computed without it. It covers PRD FR-007 and the US-02 acceptance criteria „Usunięcie wymaga potwierdzenia przed wykonaniem” and „Użytkownik może … usuwać wyłącznie własne treningi”.

The hard guarantee is isolation (test-plan risks #1/#2). A user can delete only their own workouts, and Postgres RLS is the only barrier that enforces this.

## Current State Analysis

- **Table and policies.** `public.workouts` is created in `supabase/migrations/20261003120000_create_workouts.sql`. It has RLS enabled and only two policies: `workouts_select_own` and `workouts_insert_own`. The closing comment (line 29) states that with no update/delete policy, RLS denies those operations. So today **even the owner cannot delete**: a delete changes 0 rows and returns no error.
- **Service layer.** `src/lib/workouts.ts` has `listRecentWorkouts` and `createWorkout`. On failure, `createWorkout` logs the cause with `console.error` and returns a user-facing message (`CREATE_ERROR_MESSAGE`). Delete follows the same pattern.
- **API pattern.** `src/pages/api/workouts.ts` is a form-POST endpoint:
  1. It checks `context.locals.user` itself and redirects to `/auth/signin`, because `/api` is not in `PROTECTED_ROUTES`.
  2. It handles the `createClient()` `null` branch.
  3. Every outcome is a redirect, with `?error=` on failure.
- **Protection and probing.**
  - `/dashboard` is a protected prefix (`src/middleware.ts:4`).
  - `tests/integration/helpers/routes.ts` discovers every file under `src/pages/` and replaces `[id]` segments with an all-zero UUID (`DYNAMIC_SEGMENT_VALUE`, line 19).
  - `tests/integration/anonymous-access.test.ts` then probes each route and method as an anonymous user and expects a redirect to signin (or a denial).
  - So new `[id]` routes are covered automatically.
- **Dashboard.**
  - `src/pages/dashboard.astro` fetches workouts and renders `src/components/dashboard/DashboardView.astro`.
  - Each list item (`DashboardView.astro` ≈ lines 84–91) shows the date, distance and HR. It has no actions.
  - Errors use `<Alert variant="destructive">` (`src/components/ui/alert.tsx`).
- **Visual gate.** `src/pages/dev/kitchen-sink/dashboard.astro` renders the `default`, `empty` and `error` states of `DashboardView` plus the suggestion states. `scripts/check-ui-literals.mjs` (lines 13–17) lists the cleaned files that `npm run lint:ui` enforces.
- **Isolation tests.** `tests/integration/rls-workouts.test.ts` already asserts that B deleting A's row removes 0 rows (line 94).
  - Test-plan §history F1: denial tests cannot detect a too-broad delete policy. A `DELETE … WHERE id = …` also applies the SELECT policy, so B gets 0 rows even under `using (true)`.
  - A positive control (A deletes its own row) does not exist, because it could not pass today.
  - `tests/integration/helpers/db.ts` exports `connectDb()` for direct catalog queries, as used by `rls-catalog-guard.test.ts`.
- **Smoke.** `scripts/smoke.mjs` runs a sequential list of HTTP steps. It covers the auth flow, A adding a workout and seeing it, B not seeing A's workout, and B signing out. Steps run in order, so a step's `run` closure can capture a value (e.g. a workout id) for later steps.
- **Production order.** Production last ran `600fa482` on 2026-10-31 (`context/deployment/deploy-plan.md`). Its checklist requires `npx supabase migration list --linked` → `db push` **before** `wrangler deploy`.

## Desired End State

- **Dashboard list.** Every item on the dashboard list has a „Usuń” link to `/dashboard/workouts/<id>/delete`.
- **Confirmation screen.** It shows the workout's date, distance and HR with two actions: „Usuń trening”, a form POST to `/api/workouts/<id>/delete`, and „Anuluj”, a link back to `/dashboard`.
  - A workout that does not exist, belongs to another user, or has a malformed id renders a „Nie znaleziono treningu” state with HTTP 404.
- **After a delete.** The user lands on `/dashboard?deleted=1`. The dashboard shows „Trening usunięty.” above the list, the workout is gone, and the load is recomputed.
- **Database.** A delete policy `workouts_delete_own` lets the authenticated owner delete their own rows and no one else's. Integration tests prove that:
  - the owner can delete;
  - B cannot;
  - the policy's shape is exactly the owner check, which catches a `using (true)` regression that the denial test cannot see.
- **Smoke and production.** Smoke covers B being refused and A deleting the workout end to end. Production runs the migration and the new code, smoke passes there, and the deploy is logged.

Verify with the CI gate, `npm run test:integration`, `npm run smoke` (locally and against production), and the kitchen sink.

### Key Discoveries:

- RLS turns a denied delete into "0 rows, no error" (`rls-workouts.test.ts:3`). The service must therefore treat 0 deleted rows as "not found", not as success. Use `.delete().eq("id", id).select("id")` to get the deleted rows back.
- A SELECT policy masks a too-broad DELETE policy for filtered deletes (test-plan F1). Only a catalog check on `pg_policies` catches it.
- A malformed id (not a UUID) makes Postgres raise `22P02`. To keep that out of the error logs, validate the UUID format before querying and treat a malformed id as not found.
- Route probing picks up new endpoints by their `export const POST` (`routes.ts:23`). The new endpoint must answer an anonymous POST to the all-zero UUID with a signin redirect.

## What We're NOT Doing

- Editing workouts (S-05 `edit-workout`) and the update policy.
- A client-side dialog or React island. Confirmation is a separate server-rendered page that works without JS.
- Undo, soft delete or a trash bin. The delete is permanent.
- Bulk delete, and deleting workouts older than the 7-day list. Only workouts shown on the dashboard get a „Usuń” link. The confirmation page itself works for any of the user's own workouts by id.
- A new Playwright E2E spec. The stale header in `tests/e2e/workout-log-roundtrip.spec.ts` also stays as it is.
- Editing the existing migration file. The policy goes in a new migration.

## Implementation Approach

1. **Database guarantee first, then UI.** Phase 1 adds the policy and proves isolation at the database level. That is where the only real barrier lives, and it can be tested without any UI.
2. **Server-rendered flow.** Phase 2 follows the existing server-rendered pattern of the add-workout and suggestion screens:
   - a protected Astro page for the confirmation;
   - a form-POST endpoint that redirects on every outcome;
   - a query-param notice on the dashboard.
3. **Production last.** Phase 3 ships to production in the order migration → Worker. If the Worker shipped first, its delete button would hit a database without the policy: every delete would "succeed" with 0 rows and show an error.

## Critical Implementation Details

**State sequencing (production).** `npx supabase db push` must complete before `npx wrangler deploy`. The reverse order is not dangerous for isolation, because RLS still denies. It does break the feature for every user until the migration lands.

**Testing the delete policy.** Mutation checks must use a fresh migration state (`npx supabase db reset`). After each mutation, restore the policy and reset again.

## Phase 1: Delete policy and isolation proof

### Overview

Add the owner-only delete policy and make the integration suite prove three things: the owner can delete, another user cannot, and the policy shape cannot silently become too broad.

### Changes Required:

#### 1. Delete policy migration

**File**: `supabase/migrations/20261031120000_add_workouts_delete_policy.sql`

**Intent**: Allow an authenticated user to delete only rows they own, in the same style as the existing policies (per operation, per role, `(select auth.uid())` wrapped for plan caching). No anon policy and no update policy.

**Contract**: `create policy workouts_delete_own on public.workouts for delete to authenticated using ((select auth.uid()) = user_id);` with a header comment that states the rule.

#### 2. Owner positive control

**File**: `tests/integration/rls-workouts.test.ts`

**Intent**:

- Add a test in which A inserts a second, dedicated row and deletes it by id. The test asserts that exactly that row id comes back from `.delete().eq("id", …).select("id")`, and that a follow-up select as A returns `[]`.
- Keep `rowA` untouched, so the existing "B deleting A's row" test still runs against a live row.
- Update the file header comment (line 3) that says delete is denied for everyone.

**Contract**: New test `A deleting its own row removes exactly that row`. The `rowA` fixture is unchanged.

#### 3. Policy-shape guard

**File**: `tests/integration/rls-workouts.test.ts`, using `connectDb()` from `tests/integration/helpers/db.ts`

**Intent**: Close test-plan F1 for delete. Query `pg_policies` for `public.workouts` with `cmd = 'DELETE'` and assert:

- there is exactly one such policy, `workouts_delete_own`;
- its `roles` are `{authenticated}`;
- its `qual` is the owner check (`( SELECT auth.uid() AS uid) = user_id`, as Postgres normalises it).

A policy with `using (true)`, a second permissive delete policy, or a grant to `anon`/`public` turns the test red.

**Contract**: New test `the only DELETE policy on workouts is the owner check for authenticated`. Close the connection in `afterAll`.

#### 4. Test-plan note

**File**: `context/foundation/test-plan.md` (Phase 1 history entry, line 176)

**Intent**: Record that F1 is resolved for DELETE by the policy-shape guard and still open for UPDATE (S-05).

**Contract**: One sentence appended to the existing history bullet.

### Success Criteria:

#### Automated Verification:

- Migration applies on a clean database: `npx supabase db reset`
- Integration suite passes, including the new positive control and policy-shape guard: `npm run test:integration`
- Mutation check: with the policy body changed to `using (true)` (then reset), the policy-shape guard fails; restored afterwards
- Mutation check: with the new migration removed (then reset), the owner positive control fails; restored afterwards
- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- In Supabase Studio (local), `workouts` shows three policies: select, insert and delete, all for `authenticated`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Delete flow in the app

### Overview

The user-facing flow: a „Usuń” link on the dashboard, a confirmation page, a delete endpoint, and a post-delete notice. All of it is covered by the anonymous probes and by new smoke steps.

### Changes Required:

#### 1. Service functions

**File**: `src/lib/workouts.ts`

**Intent**:

- `getWorkout` fetches one of the user's workouts by id for the confirmation page. It returns `null` when RLS hides the row or no row exists.
- `deleteWorkout` deletes by id and reports whether a row was actually removed. 0 rows means not found, not success.
- Both functions log Supabase errors with their cause (`console.error`, like `createWorkout`) and return a Polish user-facing message.
- Both functions validate the id as a UUID first. A malformed id means not found, with no query.

**Contract**:

- `getWorkout(supabase, id): Promise<{ data: Workout | null; error: string | null }>`
- `deleteWorkout(supabase, id): Promise<{ deleted: boolean; error: string | null }>`
- A shared `isUuid(id)` helper lives in the same file (or in `src/lib/utils.ts` if it is reused).

#### 2. Unit tests for the id guard

**File**: `tests/unit/workouts.test.ts` (new)

**Intent**: Table-test `isUuid`: a valid lowercase UUID, a valid uppercase UUID, the all-zero UUID, `""`, `"abc"`, a UUID with a trailing character, and a UUID with surrounding spaces. Expected values are written as literals.

**Contract**: The test uses the `unit` Vitest project (`npm test` / `npx vitest --project unit`).

#### 3. Delete endpoint

**File**: `src/pages/api/workouts/[id]/delete.ts` (new)

**Intent**: Form-POST handler that mirrors `src/pages/api/workouts.ts`:

1. No user → redirect to `/auth/signin`.
2. `createClient()` returns `null` → redirect back with an error.
3. Call `deleteWorkout`:
   - success → redirect to `/dashboard?deleted=1`;
   - not deleted → redirect to `/dashboard/workouts/<id>/delete?error=Nie znaleziono treningu.`;
   - Supabase error → redirect to the same page with `?error=Nie udało się usunąć treningu.`.

The handler never returns 200 on failure.

**Contract**: `export const POST: APIRoute`; route `POST /api/workouts/:id/delete`. The id is read from `context.params.id` and URL-encoded in redirects.

#### 4. Confirmation page and view

**Files**: `src/pages/dashboard/workouts/[id]/delete.astro` (new), `src/components/workouts/DeleteWorkoutView.astro` (new)

**Intent**: The page loads the workout with `getWorkout` and renders the view in one of three states:

- `confirm`: date, distance and HR (same formatting as the dashboard list), the `?error=` message if present (destructive `Alert`), a POST form with the „Usuń trening” button (`buttonVariants({ variant: "destructive" })`), and „Anuluj” linking to `/dashboard`;
- `not-found`: „Nie znaleziono treningu.” with a link back to the dashboard. The page sets `Astro.response.status = 404`.
- `error`: the load error or Supabase-not-configured message, as a destructive `Alert`.

The page is protected by the existing `/dashboard` prefix. It uses role tokens only, no literals.

**Contract**:

- The view's props are a discriminated union `DeleteWorkoutViewState` added to `src/types.ts`:
  - `{ state: "confirm"; workout: Workout; error?: string }`
  - `{ state: "not-found" }`
  - `{ state: "error"; errorMessage: string }`
- Date and distance formatting is extracted from `DashboardView.astro` into a shared helper (e.g. `src/lib/format.ts`: `formatWorkoutDate`, `formatDistance`). The two screens then show the same text.

#### 5. Dashboard: delete link and notice

**Files**: `src/components/dashboard/DashboardView.astro`, `src/pages/dashboard.astro`

**Intent**:

- Each list item gets a „Usuń” link (`buttonVariants({ variant: "link", size: "sm" })`, laid out with `cn()`) to `/dashboard/workouts/<id>/delete`. Its accessible label names the workout (e.g. `aria-label="Usuń trening z <date>"`).
- The dashboard page reads `deleted=1` from the URL and passes a `notice` prop. The view renders it as a non-destructive `<Alert>` with „Trening usunięty.” above the list.

**Contract**: The `DashboardView` props gain `notice?: string`. The query value is matched exactly (`"1"`); anything else shows no notice.

#### 6. Kitchen sink and UI lint

**Files**: `src/pages/dev/kitchen-sink/dashboard.astro`, `scripts/check-ui-literals.mjs`

**Intent**: Add a `deleted` state for `DashboardView` (default fixtures plus `notice`), and the `confirm`, `confirm + error`, `not-found` and `error` states of `DeleteWorkoutView`. Add the two new files to the `lint:ui` file list.

**Contract**: The kitchen sink stays dev-only. The new paths are listed next to the existing entries (lines 13–17).

#### 7. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Extend the step list. After A saves the workout, a step reads the dashboard and captures the workout id from the `/dashboard/workouts/<uuid>/delete` link. The step fails if no link is found. Then:

- A: the confirmation page returns 200 and includes the distance;
- (after B signs in) B: GET of A's confirmation page returns 404;
- B: POST to `/api/workouts/<A's id>/delete` redirects to `/dashboard/workouts/<id>/delete?error=`;
- B signs out, and A signs in again;
- A: POST delete redirects to `/dashboard?deleted=1`;
- A: the dashboard includes „Trening usunięty.”, no longer includes the distance, and shows weekly load 0;
- A signs out.

**Contract**: The existing step shape `[name, run, expected]` is unchanged. The captured id lives in a module-level `let`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new `isUuid` table: `npx vitest run --project unit`
- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- UI literal lint passes with the new files listed: `npm run lint:ui`
- Integration suite passes; anonymous probes include `POST /api/workouts/00000000-0000-0000-0000-000000000000/delete` and `GET /dashboard/workouts/00000000-0000-0000-0000-000000000000/delete` and both redirect to signin: `npm run test:integration`
- Smoke passes locally against a running dev server, including the new delete and isolation steps: `npm run smoke`

#### Manual Verification:

- On a phone-width browser: dashboard → „Usuń” → confirmation shows the right workout → „Usuń trening” → dashboard shows „Trening usunięty.”, the workout is gone, and the load has dropped
- „Anuluj” returns to the dashboard and the workout is still listed
- Kitchen sink `/dev/kitchen-sink/dashboard` shows the new states with no visual regressions in the existing ones
- Opening `/dashboard/workouts/not-a-uuid/delete` shows „Nie znaleziono treningu.” and the dev-server log shows no Postgres error

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Production rollout

### Overview

Ship the policy and the code to production in the safe order, prove it with smoke, and record the deploy. Every outward-facing command needs the user's explicit go-ahead at the time it runs.

### Changes Required:

#### 1. Migration to production

**Intent**: Confirm that the only pending remote migration is `20261031120000_add_workouts_delete_policy`, then apply it.

**Contract**: `npx supabase migration list --linked` → `npx supabase db push`.

#### 2. Worker deploy and smoke

**Intent**: Build and dry-run, deploy, then run smoke against production. Afterwards, the user deletes the `smoke-…@example.com` accounts by hand.

**Contract**:

1. `npm run build && npx wrangler deploy --dry-run`
2. `npx wrangler deploy`
3. `BASE_URL=https://movetastic.sebastian-kowalski85.workers.dev npm run smoke`
4. Rollback if needed: `npx wrangler rollback <previous-version-id>`. The migration is additive and needs no rollback.

#### 3. Deploy log

**File**: `context/deployment/deploy-plan.md` („## Later deploys” table)

**Intent**: Add a row with the date, Worker version id, slice (S-04 plus the migration) and smoke result.

**Contract**: One table row, in the existing format.

### Success Criteria:

#### Automated Verification:

- Remote migration list shows `20261031120000` applied: `npx supabase migration list --linked`
- Smoke passes against production: `BASE_URL=https://movetastic.sebastian-kowalski85.workers.dev npm run smoke`

#### Manual Verification:

- On the production URL in a phone browser: add a workout, delete it via the confirmation screen, and see the notice and the updated load
- Smoke users deleted in the Supabase dashboard
- Deploy row recorded in `context/deployment/deploy-plan.md`

**Implementation Note**: Each outward-facing command in this phase (`db push`, `wrangler deploy`, production smoke) runs only after the user confirms it.

---

## Testing Strategy

### Unit Tests:

- `isUuid` table: valid, uppercase, all-zero, empty, garbage, trailing character, surrounding whitespace.

### Integration Tests:

- Owner positive control: A deletes its own dedicated row, and exactly that row is removed.
- Existing denial: B deleting A's row removes 0 rows, and A's row stays intact.
- Policy-shape guard: the only DELETE policy is the owner check for `authenticated`. It catches `using (true)`, which the denial test cannot.
- Anonymous probes: discovered automatically for the new page and endpoint.
- Smoke (HTTP, user's perspective): B cannot open or delete A's workout; A deletes it and the dashboard reflects it.

### Manual Testing Steps:

1. Sign in, add a workout, note the load.
2. Tap „Usuń” on it, check that the confirmation shows the right date, distance and HR, and tap „Anuluj”. The workout is still listed.
3. Tap „Usuń” again, then „Usuń trening”. The notice appears, the workout is gone, and the load dropped by that workout's share.
4. Open „Sugestia na dziś”: the load shown matches the dashboard.
5. Open `/dashboard/workouts/not-a-uuid/delete` and `/dashboard/workouts/00000000-0000-0000-0000-000000000000/delete`. Both show „Nie znaleziono treningu.”

## Performance Considerations

None. One indexed delete by primary key, plus the existing list query on redirect.

## Migration Notes

The new migration only adds a policy and changes no data. Rollback, if ever needed: `drop policy workouts_delete_own on public.workouts;` in a new migration. Production order: `db push` before `wrangler deploy`.

## References

- Roadmap slice: `context/foundation/roadmap.md` — S-04 `delete-workout`
- PRD: `context/foundation/prd.md` — FR-007, US-02
- Test plan: `context/foundation/test-plan.md` — risks #1, #2; history F1
- Existing policies: `supabase/migrations/20261003120000_create_workouts.sql:17-29`
- Endpoint pattern: `src/pages/api/workouts.ts`
- Service pattern: `src/lib/workouts.ts` (`createWorkout`)
- Isolation tests: `tests/integration/rls-workouts.test.ts:94`
- Route probing: `tests/integration/helpers/routes.ts:19-23`
- Deploy checklist: `context/deployment/deploy-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Delete policy and isolation proof

#### Automated

- [x] 1.1 Migration applies on a clean database: `npx supabase db reset` — af98ffa
- [x] 1.2 Integration suite passes, including the new positive control and policy-shape guard: `npm run test:integration` — af98ffa
- [x] 1.3 Mutation check: with the policy body changed to `using (true)` (then reset), the policy-shape guard fails; restored afterwards — af98ffa
- [x] 1.4 Mutation check: with the new migration removed (then reset), the owner positive control fails; restored afterwards — af98ffa
- [x] 1.5 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build` — af98ffa

#### Manual

- [x] 1.6 In Supabase Studio (local), `workouts` shows three policies: select, insert and delete, all for `authenticated` — af98ffa

### Phase 2: Delete flow in the app

#### Automated

- [x] 2.1 Unit tests pass, including the new `isUuid` table: `npx vitest run --project unit` — 832d5e9
- [x] 2.2 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build` — 832d5e9
- [x] 2.3 UI literal lint passes with the new files listed: `npm run lint:ui` — 832d5e9
- [x] 2.4 Integration suite passes; anonymous probes include the new delete page and endpoint and both redirect to signin: `npm run test:integration` — 832d5e9
- [x] 2.5 Smoke passes locally against a running dev server, including the new delete and isolation steps: `npm run smoke` — 832d5e9

#### Manual

- [x] 2.6 On a phone-width browser: dashboard → „Usuń” → confirmation → „Usuń trening” → notice shown, workout gone, load dropped — 832d5e9
- [x] 2.7 „Anuluj” returns to the dashboard and the workout is still listed — 832d5e9
- [x] 2.8 Kitchen sink shows the new states with no visual regressions in the existing ones — 832d5e9
- [x] 2.9 `/dashboard/workouts/not-a-uuid/delete` shows „Nie znaleziono treningu.” with no Postgres error in the log — 832d5e9

### Phase 3: Production rollout

#### Automated

- [x] 3.1 Remote migration list shows `20261031120000` applied: `npx supabase migration list --linked`
- [x] 3.2 Smoke passes against production: `BASE_URL=https://movetastic.sebastian-kowalski85.workers.dev npm run smoke`

#### Manual

- [x] 3.3 On the production URL in a phone browser: add a workout, delete it via the confirmation screen, see the notice and the updated load
- [x] 3.4 Smoke users deleted in the Supabase dashboard
- [x] 3.5 Deploy row recorded in `context/deployment/deploy-plan.md`
