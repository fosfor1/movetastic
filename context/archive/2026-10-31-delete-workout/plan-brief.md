# Delete Workout — Plan Brief

> Full plan: `context/changes/delete-workout/plan.md`

## What & Why

Roadmap slice S-04, the north star of milestone M-2. A runner who typed a workout wrong can remove it. They pick it from the 7-day list, confirm, and the list, the load and the next suggestion no longer include it. It covers PRD FR-007 and US-02: deleting needs confirmation, and a user can delete only their own workouts.

## Starting Point

`public.workouts` has RLS with select and insert policies only, so today nobody can delete, not even the owner (0 rows, no error). The dashboard list has no actions. The add-workout flow sets the pattern to follow: a server-rendered page, a form POST, and redirects with `?error=`.

## Desired End State

Each workout on the dashboard has a „Usuń” link. It opens a confirmation screen with that workout's data and the buttons „Usuń trening” / „Anuluj”. Confirming deletes the workout and returns the user to the dashboard with „Trening usunięty.” and a recomputed load. Another user's workout or an invalid id shows „Nie znaleziono treningu.” (404). Production runs it with the migration applied first.

## Key Decisions Made

| Decision                   | Choice                                                               | Why (1 sentence)                                                                                                      |
| -------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Confirmation               | Separate page `/dashboard/workouts/<id>/delete`                      | Works without JS, testable over plain HTTP, and S-05 edit reuses the same "pick a workout from the list" step.        |
| After delete               | Redirect to `/dashboard?deleted=1` with a „Trening usunięty.” notice | Clear confirmation that the action worked; the list and load are already updated.                                     |
| Tests                      | Integration (RLS) + smoke steps, no new E2E                          | Covers risks #1/#2 where RLS is the only barrier, plus the full user flow over HTTP; works without Docker-backed E2E. |
| Too-broad policy detection | Catalog guard on `pg_policies` for DELETE                            | The SELECT policy masks `using (true)` in a filtered delete (test-plan F1), so denial tests alone cannot catch it.    |
| 0 deleted rows             | Treated as "not found", never as success                             | RLS reports a denied delete as 0 rows without an error.                                                               |
| Malformed id               | UUID check before querying, treated as not found                     | Avoids Postgres `22P02` noise in logs and gives a clean 404.                                                          |
| Deploy                     | Separate phase: `db push` before `wrangler deploy`                   | Shipping the Worker first would break delete for everyone until the migration lands.                                  |

## Scope

**In scope:**

- Delete policy migration
- Owner positive control and policy-shape guard
- `getWorkout` / `deleteWorkout` with `isUuid`
- Delete endpoint and confirmation page
- „Usuń” link and post-delete notice on the dashboard
- Kitchen-sink states and `lint:ui` entries
- Smoke steps
- Production deploy and deploy log

**Out of scope:**

- Editing workouts (S-05) and the update policy
- A React dialog
- Undo or soft delete
- Bulk delete
- Deleting workouts older than the 7-day list
- A new Playwright spec, and the stale E2E header fix

## Architecture / Approach

1. Dashboard „Usuń” link → protected page `dashboard/workouts/[id]/delete.astro`, which loads the workout via `getWorkout` (RLS hides other users' rows) and renders `DeleteWorkoutView`.
2. Form POST to `api/workouts/[id]/delete.ts` → `deleteWorkout` (`.delete().eq("id").select("id")`).
3. Redirect to `/dashboard?deleted=1`, or back to the confirmation page with `?error=`.

Isolation is enforced only by the new `workouts_delete_own` RLS policy. Shared date and distance formatters keep the dashboard and the confirmation page consistent.

## Phases at a Glance

| Phase                                | What it delivers                                                                           | Key risk                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1. Delete policy and isolation proof | Owner-only delete policy; tests prove owner can, B can't, policy can't be widened silently | Policy-shape assertion depends on Postgres's normalised `qual` text |
| 2. Delete flow in the app            | Link → confirmation → delete → notice; probes, unit and smoke coverage                     | Smoke must capture the workout id from the dashboard HTML           |
| 3. Production rollout                | Migration then Worker on production, smoke green, deploy logged                            | Wrong order breaks delete for all users until the migration lands   |

**Prerequisites:**

- Local Supabase running (Docker Desktop on) for phases 1–2
- Dev server running for the integration tests and smoke
- Supabase link and wrangler auth for phase 3

**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes `pg_policies.qual` for the new policy reads `( SELECT auth.uid() AS uid) = user_id`. The implementer confirms the exact text on the first run and asserts on it.
- Docker was off earlier in this session. Phases 1–2 cannot be verified until local Supabase is up.
- Production smoke creates `smoke-…` users that must still be deleted by hand.

## Success Criteria (Summary)

- A runner can delete a mistyped workout from the dashboard after confirming, and immediately sees the list and load without it.
- No user can open or delete another user's workout, and a policy regression that would allow it fails the test suite.
- Production runs the feature with smoke passing.
