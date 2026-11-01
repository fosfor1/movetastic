# Edit Workout — Plan Brief

> Full plan: `context/changes/edit-workout/plan.md`

## What & Why

Roadmap slice S-05, the last slice of milestone M-2. A runner who typed a workout wrong can correct its date, distance or average HR. The list, the 7-day load and the next suggestion then use the corrected data. It covers PRD FR-005, plus two acceptance criteria groups: US-01 (an „edytuj trening” button on the dashboard, then pick a workout from the last week) and US-02 (same validation as adding, own workouts only).

## Starting Point

`public.workouts` has select, insert and delete policies but no update policy, so today nobody can update a row (0 rows, no error). S-04 built the pattern this slice reuses:

- `getWorkout` and `isUuid`
- an `[id]` form-POST endpoint and a protected `[id]` page
- the `?deleted=1` dashboard notice
- the smoke steps for B and A

The add form (`WorkoutForm.tsx`) and its shared validator `validateWorkoutInput` already exist.

## Desired End State

- **Dashboard:** three buttons, „Dodaj trening”, „Edytuj trening” and „Sugestia na dziś”. „Edytuj trening” jumps to the 7-day list, where each workout has „Edytuj” next to „Usuń”.
- **Edit page:** the add form, pre-filled. Saving validates again on the server, updates only the date, distance and HR, and returns to the dashboard with „Trening zaktualizowany.”
- **Errors:** another user's workout, a missing one or a bad id shows „Nie znaleziono treningu.” (404). Invalid data is refused and the workout stays unchanged.

## Key Decisions Made

| Decision         | Choice                                                                  | Why (1 sentence)                                                                         |
| ---------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Entry point      | „Edytuj trening” button (scrolls to `#treningi`) + „Edytuj” per item    | Meets the PRD's three-button AC literally without a new picker screen.                   |
| After save       | `/dashboard?updated=1` with „Trening zaktualizowany.”                   | Same mechanism and feel as the S-04 delete notice.                                       |
| Tests            | RLS integration + smoke incl. HR 500 refused by the edit endpoint       | Covers both slice risks: #1 (owner/isolation) and #6 (validation bound in the endpoint). |
| Owner change     | Policy `with check` = owner, tested by a reassignment attempt (`42501`) | Without it, an update could move a workout to another user.                              |
| Too-broad policy | `pg_policies` guard for UPDATE (`qual` and `with_check`)                | The SELECT policy hides a `using (true)` update from denial tests (F1).                  |
| Form             | Reuse `WorkoutForm` with `action` / `initialValues` / `submitLabel`     | One form keeps add and edit validation from drifting.                                    |
| Validation error | Back to the edit page with `?error=`, saved values reloaded             | Same behaviour as the add page today.                                                    |
| Deploy           | Separate phase, `db push` before `wrangler deploy`                      | Worker first would make every save fail until the migration lands.                       |

## Scope

**In scope:**

- Update policy migration and its tests (owner update, reassignment denial, policy-shape guard)
- `updateWorkout`
- Edit endpoint and edit page
- `WorkoutForm` props for editing
- Dashboard button, links and notice
- Kitchen-sink states and `lint:ui` entries
- Smoke steps
- Production deploy and deploy log

**Out of scope:**

- A separate picker screen
- Editing workouts older than the 7-day list from the UI
- Keeping typed values after a server-side error
- Validator unit tests (test-plan phase 3)
- Cleaning the literal classes in `WorkoutForm` and `new.astro`
- Concurrency control and edit history

## Architecture / Approach

1. „Edytuj” on the dashboard → protected page `dashboard/workouts/[id]/edit.astro`. It loads the workout with `getWorkout`, which RLS limits to the user's own rows, and renders `EditWorkoutView` with a pre-filled `WorkoutForm`.
2. The form POSTs to `api/workouts/[id]/edit.ts`, which runs `validateWorkoutInput` and then `updateWorkout` (`.update(3 fields).eq("id").select("id")`; 0 rows = not found).
3. The endpoint redirects to `/dashboard?updated=1`, or back to the edit page with `?error=`.

The new `workouts_update_own` policy (`using` and `with check` = owner) is the only barrier.

## Phases at a Glance

| Phase                                | What it delivers                                                                                          | Key risk                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. UPDATE policy and isolation proof | Owner-only update; tests prove owner can, reassignment and other users can't, policy can't widen silently | `with_check` text in `pg_policies` must be confirmed on first run |
| 2. Edit flow in the app              | Button + links → pre-filled form → validated save → notice; probes and smoke cover isolation and HR 500   | Reordering smoke so the delete steps check the edited distance    |
| 3. Production rollout                | Migration then Worker on production, smoke passing, deploy logged                                         | Wrong order breaks every save until the migration lands           |

**Prerequisites:**

- Docker and local Supabase running
- Dev server started by you, for the integration tests and smoke
- Supabase link and wrangler auth for phase 3

**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Assumes the reassignment attempt returns `42501` through PostgREST, like the existing insert-denial test. The implementer confirms it on the first run.
- Making `WorkoutForm` configurable touches the add page. The kitchen sink and the manual check cover regressions there.
- Production smoke creates `smoke-…` users that must be deleted by hand.

## Success Criteria (Summary)

- A runner corrects a mistyped workout from the dashboard and immediately sees the corrected list and load.
- No one can edit another user's workout or move a workout to another user, invalid data is refused by the server, and a policy regression fails the test suite.
- Production runs it with smoke passing, which completes milestone M-2 and full CRUD for workouts.
