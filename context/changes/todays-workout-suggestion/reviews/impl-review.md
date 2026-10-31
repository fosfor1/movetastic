<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Today's Workout Suggestion

- **Plan**: context/changes/todays-workout-suggestion/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-26
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Fail-closed path has no automated or manual gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: src/pages/dashboard/suggestion.astro:29
- **Detail**: The plan's first Critical Implementation Detail, "fail closed on unknown load", is implemented correctly: `listError` wins over every other state. But nothing verifies it. The unit table covers only `suggestWorkout`. The state resolution lives in Astro frontmatter, where no test reaches it. Manual Testing Step 4 (stop Supabase, then `?wellbeing=5` → error) is not among the Phase 2 manual criteria, so it was never ticked. If a later refactor reorders the branches, the page would suggest intervals from a load of 0.
- **Fix A ⭐ Recommended**: Move state resolution into a pure `resolveSuggestionView({ listError, rawWellbeing, workouts })` in `src/lib/workout-suggestion.ts` and add a literal table to `tests/unit/workout-suggestion.test.ts` (error + any wellbeing → error; missing → picker; invalid → picker + error; valid → result)
  - Strength: The guarantee gets the same literal-oracle protection as risk #3. The page shrinks to fetch → resolve → render.
  - Tradeoff: Unplanned refactor of a page that has already been committed and manually verified, plus about 8 test rows.
  - Confidence: HIGH — the module is already pure and the `unit` project resolves `@/`.
  - Blind spot: The view props type comes from `ComponentProps<typeof SuggestionView>`. A lib function would need its own union type in `src/types.ts`.
- **Fix B**: Run Manual Testing Step 4 now and record it as a follow-up row for test-plan Phase 3
  - Strength: No code change. It verifies today's behavior.
  - Tradeoff: Leaves the guarantee unguarded against regressions.
  - Confidence: MED — depends on someone picking up the follow-up.
  - Blind spot: None significant.
- **Decision**: FIXED (Fix A): `resolveSuggestionView()` in `src/lib/workout-suggestion.ts`, `SuggestionViewState` in `src/types.ts`, 10-row literal table in `tests/unit/workout-suggestion.test.ts` (63/63); break-check with the list-error guard disabled turned 4 rows red

### F2 — Error alert classes duplicated

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/suggestion/SuggestionView.astro:22
- **Detail**: `alertClass` copies the dashboard's error-box class string (`DashboardView.astro:73`) verbatim. The two will drift if the error style changes. Today it is two call sites, both token-only and `lint:ui`-clean.
- **Fix**: Leave as is until a third alert appears. At that point, add the shadcn `alert` component (`npx shadcn@latest add alert`) and use it in both views.
- **Decision**: FIXED: added shadcn `alert` (`src/components/ui/alert.tsx`), destructive variant carries the app error tokens; `DashboardView` and `SuggestionView` use `Alert` + `AlertDescription`. The shadcn CLI also installed an unrelated npm package `cn` (it resolved the utils alias as a package); removed, import pointed at `@/lib/utils`

### F3 — "Red first" is not visible in history

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (Progress 1.1)
- **Detail**: Row 1.1 says the boundary table failed before the rule existed. The rule and the table landed together in f2b2dd3, so the red step leaves no trace in git. The deliberate break-check (1.4: `LOW_WELLBEING_MAX = 1` → 4 rows red; `>=` → 6 rows red) was run in-session and does prove the table can fail, so the risk is low.
- **Fix**: None needed. For future test-first phases, consider committing the red table separately, or noting the red-run output in the phase commit body.
- **Decision**: SKIPPED
