# Edit Workout Implementation Plan

## Overview

Roadmap slice S-05 `edit-workout`, the last slice of milestone M-2 (`context/foundation/roadmap.md`). A signed-in runner corrects a mistyped workout: they pick it from the 7-day list on the dashboard, change its date, distance or average HR in a pre-filled form, and land back on the dashboard with „Trening zaktualizowany.”. The list, the 7-day load and the next suggestion then reflect the corrected data.

It covers:

- **PRD FR-005**
- **US-01 acceptance criteria:** the dashboard has the buttons „dodaj trening”, „edytuj trening” and „sugestia na dziś”; „edytuj trening” lets the user pick a workout from the last week and edit its date, distance and HR.
- **US-02 acceptance criteria:** the same validation rules as adding, and only the user's own workouts.

The slice must not let an edit bypass validation (test-plan risk #6) or move a workout to another owner (risk #1).

## Current State Analysis

- **Table and policies.** `public.workouts` has RLS with three policies:
  - `workouts_select_own` and `workouts_insert_own` (`supabase/migrations/20261003120000_create_workouts.sql`);
  - `workouts_delete_own` (`supabase/migrations/20261031120000_add_workouts_delete_policy.sql`, from S-04).

  There is no UPDATE policy, so today every update changes 0 rows without an error, even for the owner.

- **Isolation tests.** `tests/integration/rls-workouts.test.ts` already covers:
  - B updating A's row (≈ line 101), which changes 0 rows;
  - the owner-delete positive control (≈ line 119);
  - a policy-shape guard for DELETE/ALL (≈ line 139), which reads `pg_policies` via `connectDb()` and compares `policyname`, `permissive`, `roles` and `qual`.

  Test-plan F1 is still open for UPDATE. The UPDATE denial test cannot catch a too-broad policy, because the SELECT policy hides A's row from B.

- **Service layer.** `src/lib/workouts.ts` already provides `isUuid`, `getWorkout` (returns `null` when RLS hides the row or the id is malformed), `createWorkout` and `deleteWorkout`. `deleteWorkout` treats 0 returned rows as "not found", and every Supabase error is logged with its cause and turned into a Polish message.
- **Validation.** `src/lib/workout-validation.ts` is the single source of the input rules (`validateWorkoutInput(raw, today)`). The React form and `POST /api/workouts` both use it. The endpoint gets `today` from `todayInAppTimeZone()` (`src/lib/dates.ts`).
- **Add form.** `src/components/workouts/WorkoutForm.tsx`:
  - it is a React island with client-side validation and posts to the hard-coded `/api/workouts`;
  - its initial values are today's date and empty fields;
  - its „Anuluj” link and `src/pages/dashboard/workouts/new.astro` still use literal colour classes, so they are not on the `lint:ui` list.
- **Delete flow (S-04), reused as the pattern for edit:**
  - the protected page `src/pages/dashboard/workouts/[id]/delete.astro` with `src/components/workouts/DeleteWorkoutView.astro` (states `confirm` / `not-found` / `error`, 404 status);
  - the form-POST endpoint `src/pages/api/workouts/[id]/delete.ts` (redirects on every outcome, `?error=` on failure);
  - the dashboard notice: `src/pages/dashboard.astro:25-26` maps `?deleted=1` to „Trening usunięty.”, and `DashboardView.astro` renders `notice`.
- **Dashboard.**
  - `DashboardView.astro` has two primary buttons, „Dodaj trening” and „Sugestia na dziś” (≈ lines 49–55), and the „Ostatnie 7 dni” heading.
  - Each list item has a „Usuń” link (≈ lines 86–92).
  - The PRD's three-button acceptance criterion is not met yet.
- **Smoke.** `scripts/smoke.mjs`:
  - captures A's workout id from the dashboard „Usuń” link into `workoutId`;
  - runs the B-refused and A-deletes steps;
  - allows a step's `expected` to be a function evaluated at run time (≈ line 212).
- **Production.** It runs `9abb669a` (S-04). The deploy checklist in `context/deployment/deploy-plan.md` requires `db push` before `wrangler deploy`.

## Desired End State

- **Dashboard.**
  - It shows three primary buttons: „Dodaj trening”, „Edytuj trening” and „Sugestia na dziś”.
  - „Edytuj trening” jumps to the „Ostatnie 7 dni” list (anchor `#treningi`).
  - Every list item has „Edytuj” next to „Usuń”, linking to `/dashboard/workouts/<id>/edit`.
- **Edit page.**
  - It shows the workout form pre-filled with the workout's date, distance and HR, with the same client-side validation as adding and „Zapisz zmiany” / „Anuluj”.
  - A workout of another user, a missing workout or a malformed id shows „Nie znaleziono treningu.” with HTTP 404.
- **Saving.**
  - Saving posts to `/api/workouts/<id>/edit`. The endpoint validates with `validateWorkoutInput` and updates only `workout_date`, `distance_km` and `avg_heart_rate`.
  - Invalid data redirects back to the edit page with `?error=` and leaves the row unchanged.
  - Success redirects to `/dashboard?updated=1`, which shows „Trening zaktualizowany.” with the corrected list and load.
- **Database.**
  - A policy `workouts_update_own` (authenticated, `using` and `with check` = owner) lets the owner update their own rows only, and never to another owner.
  - Integration tests prove the owner can update, nobody can reassign a row to another user, and the policy shape is exactly the owner check in both clauses (closes F1 for UPDATE).
- **Smoke and production.** Smoke proves B is refused, HR 500 is refused, and A's correction shows on the dashboard. Production runs it all, migration first.

### Key Discoveries:

- **RLS reports a denied update as "0 rows, no error".** `updateWorkout` must request the updated rows back (`.update(...).eq("id", id).select("id")`) and treat 0 rows as not found, exactly like `deleteWorkout` (`src/lib/workouts.ts`).
- **`with check` is what stops a row moving to another owner.** Without it, Postgres reuses `using` for the new row, which already checks the owner. Writing it explicitly makes the policy-shape guard able to assert both clauses, and makes the intent visible.
- **The existing guard only looks at DELETE/ALL.** UPDATE needs its own assertion, or a widened query, that also compares `with_check`. A `for all` policy must still be caught by both.
- **Validation must run in the edit endpoint.** The React form validates too, but risk #6's failure mode is "a shared module ≠ the endpoint calls it", so smoke posts HR 500 straight to the endpoint.

## What We're NOT Doing

- A separate "pick a workout" screen. „Edytuj trening” scrolls to the existing list instead.
- Editing workouts older than the 7-day list from the UI. The edit page itself works by id for any of the user's own workouts, as the delete page does.
- Keeping typed values after a server-side validation error. The edit page reloads the saved values and shows the error, the same as the add page today.
- Unit tests for `validateWorkoutInput`. These belong to test-plan phase 3 (risk #6 for adding), a separate change.
- Cleaning the literal colour classes in `WorkoutForm.tsx` and `new.astro` (a separate UI change).
- Optimistic concurrency, edit history or audit. The last save wins.
- Changing the owner (`user_id`) or `created_at`.

## Implementation Approach

Same shape as S-04:

1. **Phase 1:** the database guarantee and its proof (policy plus integration tests).
2. **Phase 2:** the server-rendered flow (service, endpoint, protected page, dashboard entry points and notice), reusing `WorkoutForm` with props instead of copying it.
3. **Phase 3:** production, migration before Worker.

## Critical Implementation Details

**State sequencing (production).** `npx supabase db push` must finish before `npx wrangler deploy`. Without the policy, every save changes 0 rows and shows „Nie znaleziono treningu.” to everyone.

**Smoke ordering.** The existing delete steps assert that the dashboard no longer contains the original distance. After an edit, A's workout shows the edited distance, so the delete assertions must check the edited distance and the load after the edit. Run the edit steps before the existing delete steps, so the workout is edited first and then deleted.

## Phase 1: UPDATE policy and isolation proof

### Overview

Add the owner-only update policy and make the integration suite prove four things: the owner can update, a row cannot be moved to another owner, another user cannot update it, and the policy shape cannot silently widen.

### Changes Required:

#### 1. Update policy migration

**File**: `supabase/migrations/20261031130000_add_workouts_update_policy.sql`

**Intent**: Let an authenticated user update only rows they own, and only into rows they still own. Same style as the existing policies; still no anon policy.

**Contract**: `create policy workouts_update_own on public.workouts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);` with a header comment stating the rule.

#### 2. Owner positive control and reassignment denial

**File**: `tests/integration/rls-workouts.test.ts`

**Intent**: Add two tests and update the file header comment, which still says update is denied for everyone.

1. **Owner positive control.** A inserts a dedicated row, updates its distance and HR by id, and gets exactly that row id back from `.update(...).eq("id", …).select("id")`. A re-read returns the new values.
2. **Reassignment denial.** B inserts its own row and tries to update `user_id` to A's id. The update is rejected with the RLS error code `42501`, and the row stays B's (re-read as B).

Keep `rowA` untouched for the existing denial tests.

**Contract**: New tests `A updating its own row changes exactly that row` and `B moving its own row to A is rejected`.

#### 3. Policy-shape guard for UPDATE

**File**: `tests/integration/rls-workouts.test.ts`

**Intent**: Close test-plan F1 for UPDATE. Query `pg_policies` for `public.workouts` with `cmd in ('UPDATE', 'ALL')` and assert exactly one row:

- `policyname`: `workouts_update_own`
- `permissive`: `PERMISSIVE`
- `roles`: `["authenticated"]`
- `qual` and `with_check`: both `(( SELECT auth.uid() AS uid) = user_id)`

Reuse the existing connection and `PolicyRow` type, extended with `with_check`. The DELETE guard keeps its own test.

**Contract**: New test `the only UPDATE policy on workouts is the owner check for authenticated (using and with check)`.

#### 4. Test-plan note

**File**: `context/foundation/test-plan.md` (Phase 1 history entry, the sentence added by S-04)

**Intent**: Record that F1 is now resolved for UPDATE as well.

**Contract**: The existing sentence is updated, in Polish, to say F1 is closed for DELETE and UPDATE.

### Success Criteria:

#### Automated Verification:

- Migration applies on a clean database: `npx supabase db reset`
- Integration suite passes, including the new update tests and the UPDATE policy-shape guard: `npm run test:integration`
- Mutation check: with `using (true) with check (true)` (then reset), the UPDATE policy-shape guard fails; restored afterwards
- Mutation check: with the `with check` clause removed and `using` widened to `true` (then reset), the reassignment test fails; restored afterwards
- Mutation check: with the new migration removed (then reset), the owner update positive control fails; restored afterwards
- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- In Supabase Studio (local), `workouts` shows four policies (select, insert, update, delete), all for `authenticated`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Edit flow in the app

### Overview

The user-facing flow: the „Edytuj trening” button and per-item „Edytuj” links, the pre-filled edit page, the update endpoint with server-side validation, and the „Trening zaktualizowany.” notice. All of it is covered by the anonymous probes and by new smoke steps.

### Changes Required:

#### 1. Service function

**File**: `src/lib/workouts.ts`

**Intent**: `updateWorkout` updates only the three editable fields of one of the session user's workouts and reports whether a row was actually changed.

- A malformed id means not found, with no query.
- 0 returned rows means not found.
- A Supabase error is logged with its cause and returns a Polish message („Nie udało się zapisać zmian.”).

**Contract**: `updateWorkout(supabase, id, input: NewWorkoutInput): Promise<{ updated: boolean; error: string | null }>`. The update payload contains only `workout_date`, `distance_km` and `avg_heart_rate`.

#### 2. Reusable workout form

**File**: `src/components/workouts/WorkoutForm.tsx`

**Intent**: Let the same form serve adding and editing, so validation and fields cannot drift between the two. Defaults keep the add page unchanged.

**Contract**: Optional props:

- `action` (default `/api/workouts`)
- `initialValues?: { workout_date: string; distance_km: string; avg_heart_rate: string }`, where the distance is formatted with a comma for display (e.g. `10,5`) and parsed by the existing validator
- `submitLabel` (default „Zapisz trening”)

#### 3. Update endpoint

**File**: `src/pages/api/workouts/[id]/edit.ts` (new)

**Intent**: Form-POST handler mirroring `src/pages/api/workouts.ts` and `[id]/delete.ts`:

1. No user → redirect to `/auth/signin`.
2. `createClient()` returns `null` → redirect back with an error.
3. Validate with `validateWorkoutInput(…, todayInAppTimeZone())`. The first error → redirect to `/dashboard/workouts/<id>/edit?error=…`.
4. Call `updateWorkout`:
   - not updated → `?error=Nie znaleziono treningu.`;
   - Supabase error → `?error=<message>`;
   - success → `/dashboard?updated=1`.

The handler never returns 200 on failure.

**Contract**: `export const POST: APIRoute`; route `POST /api/workouts/:id/edit`. The id is read from `context.params.id` and URL-encoded in redirects.

#### 4. Edit page and view

**Files**: `src/pages/dashboard/workouts/[id]/edit.astro` (new), `src/components/workouts/EditWorkoutView.astro` (new)

**Intent**: The page loads the workout with `getWorkout` and renders one of three states:

- `form`: a card with the heading „Edytuj trening”, the `?error=` message if present (destructive `Alert`), and `WorkoutForm` (`client:load`) pre-filled, posting to `/api/workouts/<id>/edit` with „Zapisz zmiany”;
- `not-found`: „Nie znaleziono treningu.” with a link back to the dashboard, and status 404;
- `error`: the load error or Supabase-not-configured message.

The page is protected by the `/dashboard` prefix. It follows the token-clean card style of `DeleteWorkoutView`, and both new files are listed in `lint:ui`.

**Contract**: The view's props are a discriminated union `EditWorkoutViewState` in `src/types.ts`:

- `{ state: "form"; workout: Workout; today: string; error?: string }`
- `{ state: "not-found" }`
- `{ state: "error"; errorMessage: string }`

#### 5. Dashboard entry points and notice

**Files**: `src/components/dashboard/DashboardView.astro`, `src/pages/dashboard.astro`

**Intent**:

- Add a third primary button, „Edytuj trening” (outline), linking to `#treningi`, and give the „Ostatnie 7 dni” heading `id="treningi"`.
- Add an „Edytuj” link next to „Usuń” on each item, with `aria-label="Edytuj trening z <date>"`.
- The page maps `?updated=1` to „Trening zaktualizowany.”, alongside the existing `?deleted=1`; only these exact values show a notice.

**Contract**: The `DashboardView` props are unchanged (it reuses `notice`). The three buttons share the existing responsive layout via `cn()`.

#### 6. Kitchen sink and UI lint

**Files**: `src/pages/dev/kitchen-sink/dashboard.astro`, `scripts/check-ui-literals.mjs`

**Intent**:

- Add an `updated` dashboard state.
- Add `EditWorkoutView` states: `form`, `form + error`, `not-found` and `error`. In the dev page, `form` renders `WorkoutForm` statically, without hydration.
- List `edit.astro` and `EditWorkoutView.astro` in `lint:ui`.

**Contract**: Same structure as the S-04 additions.

#### 7. Smoke steps

**File**: `scripts/smoke.mjs`

**Intent**: Insert edit steps after the „A: delete confirmation shows the workout” step and before the delete steps:

1. A: the edit page returns 200 and includes the original distance in the form.
2. After B signs in:
   - B: GET of A's edit page returns 404;
   - B: POST of valid data to `/api/workouts/<A's id>/edit` redirects to `…/edit?error=`.
3. After A signs in again:
   - A: POST with `avg_heart_rate=500` redirects to `…/edit?error=`, and the dashboard still shows the original distance;
   - A: POST of a corrected distance redirects to `/dashboard?updated=1`;
   - A: the dashboard shows „Trening zaktualizowany.” and the corrected distance, and no longer shows the original one.
4. Then the existing delete steps run against the edited workout. Update their distance and load expectations to the edited values.

**Contract**: The step shape and the function-`expected` convention are unchanged. The corrected distance is derived like the existing `distanceInput`, so it is always valid and different from the original.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npx vitest run --project unit`
- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- UI literal lint passes with the new files listed: `npm run lint:ui`
- Integration suite passes; anonymous probes include `GET /dashboard/workouts/00000000-0000-0000-0000-000000000000/edit` and `POST /api/workouts/00000000-0000-0000-0000-000000000000/edit`, both redirecting to signin: `npm run test:integration`
- Smoke passes locally against a running dev server, including the new edit, isolation and validation steps: `npm run smoke`

#### Manual Verification:

- On a phone-width browser: „Edytuj trening” jumps to the list → „Edytuj” on a workout → the form shows its date, distance and HR → change the distance → „Zapisz zmiany” → the dashboard shows „Trening zaktualizowany.”, the new distance and the recomputed load
- A future date or HR 500 typed into the edit form is blocked client-side with the same messages as on the add page
- „Anuluj” on the edit page returns to the dashboard with the workout unchanged
- Kitchen sink `/dev/kitchen-sink/dashboard` shows the new states, with no visual regressions in the existing ones (including the add page form, which shares `WorkoutForm`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Production rollout

### Overview

Ship the policy and the code to production in the safe order, prove it with smoke, and record the deploy. Every outward-facing command needs the user's explicit go-ahead at the time it runs.

### Changes Required:

#### 1. Migration to production

**Intent**: Confirm that the only pending remote migration is `20261031130000_add_workouts_update_policy`, then apply it.

**Contract**: `npx supabase migration list --linked` → `npx supabase db push`.

#### 2. Worker deploy and smoke

**Intent**: Build and dry-run, deploy, then run smoke against production. Afterwards, the user deletes the smoke accounts by hand.

**Contract**:

1. `npm run build && npx wrangler deploy --dry-run`
2. `npx wrangler deploy`
3. `BASE_URL=https://movetastic.sebastian-kowalski85.workers.dev npm run smoke`
4. Rollback if needed: `npx wrangler rollback <previous-version-id>`.

#### 3. Deploy log

**File**: `context/deployment/deploy-plan.md` („## Later deploys” table)

**Intent**: Add a row with the date, Worker version id, slice (S-05 plus the migration) and smoke result.

**Contract**: One table row, in the existing format.

### Success Criteria:

#### Automated Verification:

- Remote migration list shows `20261031130000` applied: `npx supabase migration list --linked`
- Smoke passes against production: `BASE_URL=https://movetastic.sebastian-kowalski85.workers.dev npm run smoke`

#### Manual Verification:

- On the production URL in a phone browser: add a workout, edit its distance, and see the notice and the updated load
- Smoke users deleted in the Supabase dashboard
- Deploy row recorded in `context/deployment/deploy-plan.md`

**Implementation Note**: Each outward-facing command in this phase (`db push`, `wrangler deploy`, production smoke) runs only after the user confirms it.

---

## Testing Strategy

### Unit Tests:

- No new unit tests. `isUuid` is already covered, and validator unit tests are out of scope (test-plan phase 3).

### Integration Tests:

- Owner positive control: A updates its own dedicated row; exactly that row changes, and the new values read back.
- Reassignment denial: B setting `user_id` to A on its own row is rejected with `42501`, and the row stays B's.
- Existing denial: B updating A's row changes 0 rows, and A's values stay intact.
- Policy-shape guard: the only UPDATE/ALL policy is the owner check for `authenticated` in both `using` and `with check`.
- Anonymous probes: discovered automatically for the new page and endpoint.
- Smoke (HTTP, user's perspective):
  - B can't open or edit A's workout;
  - HR 500 is refused by the edit endpoint, and the row is unchanged;
  - A's correction is visible on the dashboard with the recomputed load.

### Manual Testing Steps:

1. Sign in, add a workout (10 km, HR 150), and note the load (15).
2. Tap „Edytuj trening”: the page jumps to the list. Tap „Edytuj” on the workout. The form shows the date, „10” km and 150.
3. Change the distance to 20 and save. The notice appears, the list shows 20,00 km and the load is 30.
4. Edit again and enter HR 500. The form blocks it with the HR range message.
5. Open `/dashboard/workouts/not-a-uuid/edit`. It shows „Nie znaleziono treningu.”
6. Open „Sugestia na dziś”. The load matches the dashboard.

## Performance Considerations

None. One indexed update by primary key, plus the existing list query on redirect.

## Migration Notes

The new migration only adds a policy. Rollback, if ever needed: `drop policy workouts_update_own on public.workouts;` in a new migration. Production order: `db push` before `wrangler deploy`.

## References

- Roadmap slice: `context/foundation/roadmap.md`, S-05 `edit-workout`
- PRD: `context/foundation/prd.md`, FR-005, US-01, US-02
- Test plan: `context/foundation/test-plan.md`, risks #1 and #6, history F1
- Prior slice (pattern): `context/archive/2026-10-31-delete-workout/plan.md`
- Delete endpoint and page: `src/pages/api/workouts/[id]/delete.ts`, `src/pages/dashboard/workouts/[id]/delete.astro`
- Service: `src/lib/workouts.ts` (`getWorkout`, `deleteWorkout`)
- Validation: `src/lib/workout-validation.ts`
- Form: `src/components/workouts/WorkoutForm.tsx`
- Isolation tests and DELETE guard: `tests/integration/rls-workouts.test.ts`
- Deploy checklist: `context/deployment/deploy-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: UPDATE policy and isolation proof

#### Automated

- [x] 1.1 Migration applies on a clean database: `npx supabase db reset` — 75f1324
- [x] 1.2 Integration suite passes, including the new update tests and the UPDATE policy-shape guard: `npm run test:integration` — 75f1324
- [x] 1.3 Mutation check: with `using (true) with check (true)` (then reset), the UPDATE policy-shape guard fails; restored afterwards — 75f1324
- [x] 1.4 Mutation check: with the `with check` clause removed and `using` widened to `true` (then reset), the reassignment test fails; restored afterwards — 75f1324
- [x] 1.5 Mutation check: with the new migration removed (then reset), the owner update positive control fails; restored afterwards — 75f1324
- [x] 1.6 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build` — 75f1324

#### Manual

- [x] 1.7 In Supabase Studio (local), `workouts` shows four policies (select, insert, update, delete), all for `authenticated` — 75f1324

### Phase 2: Edit flow in the app

#### Automated

- [x] 2.1 Unit tests pass: `npx vitest run --project unit` — 4b64fed
- [x] 2.2 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build` — 4b64fed
- [x] 2.3 UI literal lint passes with the new files listed: `npm run lint:ui` — 4b64fed
- [x] 2.4 Integration suite passes; anonymous probes include the new edit page and endpoint and both redirect to signin: `npm run test:integration` — 4b64fed
- [x] 2.5 Smoke passes locally against a running dev server, including the new edit, isolation and validation steps: `npm run smoke` — 4b64fed

#### Manual

- [x] 2.6 On a phone-width browser: „Edytuj trening” → „Edytuj” → pre-filled form → change distance → „Zapisz zmiany” → notice, new distance, recomputed load — 4b64fed
- [x] 2.7 A future date or HR 500 in the edit form is blocked client-side with the same messages as on the add page — 4b64fed
- [x] 2.8 „Anuluj” on the edit page returns to the dashboard with the workout unchanged — 4b64fed
- [x] 2.9 Kitchen sink shows the new states with no visual regressions (including the add form) — 4b64fed

### Phase 3: Production rollout

#### Automated

- [x] 3.1 Remote migration list shows `20261031130000` applied: `npx supabase migration list --linked` — 58668f4
- [x] 3.2 Smoke passes against production: `BASE_URL=https://movetastic.sebastian-kowalski85.workers.dev npm run smoke` — 58668f4

#### Manual

- [x] 3.3 On the production URL in a phone browser: add a workout, edit its distance, see the notice and the updated load — 58668f4
- [x] 3.4 Smoke users deleted in the Supabase dashboard — 58668f4
- [x] 3.5 Deploy row recorded in `context/deployment/deploy-plan.md` — 58668f4
