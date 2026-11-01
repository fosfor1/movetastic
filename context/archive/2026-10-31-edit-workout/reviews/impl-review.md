<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Edit Workout (S-05)

- **Plan**: context/changes/edit-workout/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-11-01
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING |

Automated criteria re-run 2026-11-01: unit 70/70, lint, astro check 0 errors, build, lint:ui (9 files), integration 30/30, local smoke green, remote migration `20261031130000` applied. Every Progress row is ticked (21/21). On the first combined run the integration and smoke commands printed no result; run on their own, both passed.

## Findings

### F1 — Dashboard button order differs from the plan and the PRD

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/dashboard/DashboardView.astro:55-57
- **Detail**: The plan's Desired End State and PRD US-01 order the buttons „Dodaj trening”, „Edytuj trening”, „Sugestia na dziś”. The code puts „Edytuj trening” last (Dodaj, Sugestia, Edytuj). The link target `#treningi` and the heading id are correct.
- **Fix**: Move the „Edytuj trening” button between „Dodaj trening” and „Sugestia na dziś”, then re-check the kitchen sink.
- **Decision**: FIXED (differently) — buttons reordered to Dodaj → Edytuj → Sugestia as in PRD US-01; reaches production with the next deploy

### F2 — Approved deviations are not recorded in the change docs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/edit-workout/plan.md (Progress 1.4, Phase 1 §3); context/changes/edit-workout/change.md (Notes)
- **Detail**: Progress row 1.4 still says the reassignment test catches the missing `with check`; in practice the policy-shape guard catches it, because the SELECT policy also refuses the returned row. Several other approved changes appear nowhere in plan.md or change.md: `UpdatePolicyRow`, `formatDistanceInput`, the `hydrate` prop, and smoke checking the validator's message. Only the test comment and the p1 commit message record the 1.4 point.
- **Fix**: Add a short "Deviations (approved during implementation)" list to change.md `## Notes` before archiving.
- **Decision**: FIXED — deviations list added to change.md Notes

### F3 — Edit view is listed as token-clean, but the form inside it is not

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/workouts/EditWorkoutView.astro; scripts/check-ui-literals.mjs:20-21
- **Detail**: EditWorkoutView is on the lint:ui list, but it renders WorkoutForm, FormField, SubmitButton and ServerError, which still use palette classes (`text-purple-300`, `bg-white/10`, `bg-purple-600`, `red-*`). The plan lists cleaning them as a non-goal, so this is known debt, not drift.
- **Fix**: Track a follow-up UI change (for example via /10x-ui on the workout form).
- **Decision**: FIXED — queued in follow-ups/review-fixes.md

### F4 — Shared weaknesses in the add, delete and edit pages

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/workouts/[id]/edit.astro:9; src/pages/api/workouts/[id]/edit.ts:20; tests/integration/rls-workouts.test.ts:149-201
- **Detail**: The edit code copies three weaknesses from the add and delete code.
  - The `?error=` text is shown as is (escaped, so no XSS), so a crafted link could display a fake message.
  - `formData()` is not wrapped, so a request that isn't a form returns a bare 500.
  - Test rows are never cleaned up; each run uses fresh users, so runs stay isolated.
- **Fix**: Leave as is in this change. If wanted, open one follow-up change that switches all three pages to fixed error codes.
- **Decision**: FIXED — queued in follow-ups/review-fixes.md
