---
change_id: edit-workout
title: Edit workout
status: archived
created: 2026-10-31
updated: 2026-11-01
archived_at: 2026-11-01T08:05:58Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Deviations (approved during implementation)

- **Progress 1.4 (missing `with check`)**: removing `with check` while widening `using` is caught by the UPDATE policy-shape guard, not by the reassignment test. The reassignment update returns the row, so the SELECT policy refuses it too; behaviour tests cannot see a missing `with check`. Approved 2026-10-31 (p1 commit `75f1324`, comment in `tests/integration/rls-workouts.test.ts`).
- **`UpdatePolicyRow`** (Phase 1 §3): a separate type `UpdatePolicyRow extends PolicyRow { with_check }` instead of widening `PolicyRow`, so the DELETE guard's full-row comparison is unchanged.
- **`formatDistanceInput`** (`src/lib/format.ts`): an extra helper that pre-fills the distance in the validator's format (10.5 → „10,5”, 10 → „10”).
- **`hydrate` prop on `EditWorkoutView`**: defaults to `true`. The kitchen sink passes `false` to render the form without hydration.
- **Smoke HR-500 edit step**: expects the validator's message („Średnie tętno musi…”), not just any `?error=`. The DB CHECK constraint also refuses 500, so a bare `?error=` stayed green when the endpoint skipped `validateWorkoutInput` (break check, Phase 2).
