<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Log Completed Workout

- **Plan**: context/changes/log-completed-workout/plan.md
- **Mode**: Deep
- **Date**: 2026-10-03
- **Verdict**: REVISE
- **Findings**: 1 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding
6/6 paths ✓ (3 new paths correctly absent), 3/3 symbols ✓ (line refs drifted — F5), brief↔plan ✓

## Findings

### F1 — Verification relies on Docker and a git remote that don't exist

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 (1.1), Phase 3 (3.2, 3.3), brief "Prerequisites"
- **Detail**: `docker` is not installed, there is no `.dev.vars`, and `git remote -v` is empty. `npx supabase db reset` (1.1) and local smoke against local Supabase (3.2) need Docker; "CI jobs pass on push" (3.3) needs a remote. `/10x-implement` would stop at 1.1.
- **Fix A ⭐ Recommended**: Local Supabase in Docker as an explicit Phase 0 prerequisite
  - Strength: Same setup as the CI smoke job; production untouched; smoke users stay local.
  - Tradeoff: One-time Docker Desktop (WSL2) install, a few GB.
  - Confidence: HIGH — CI already runs `supabase start` the same way.
  - Blind spot: Whether WSL2/virtualization is enabled on this machine.
- **Fix B**: Separate hosted Supabase dev project, no Docker
  - Strength: No local install; `.dev.vars` points at the dev project, `db push` replaces `db reset`.
  - Tradeoff: Second cloud project, migrations can't be reset, smoke users pile up in the cloud.
  - Confidence: MEDIUM — free-plan project quota not checked.
  - Blind spot: CI smoke still needs a remote; 3.3 stays conditional.
- **Decision**: FIXED — Fixed via Fix A (env setup folded into Phase 1 as step 1.5 instead of a separate Phase 0, to keep phase numbering; 3.3 conditional on a git remote)

### F2 — Sign-in redirect changes in Phase 2, smoke only in Phase 3

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §6, Phase 3 §1
- **Detail**: Phase 2 changes `src/pages/api/auth/signin.ts:19` to `/dashboard`, but `scripts/smoke.mjs:54` still expects `/`; the Phase 2 commit leaves smoke red and Phase 2 never runs smoke, contrary to AGENTS.md.
- **Fix**: Move the smoke expectation update into Phase 2 §6 and add "`npm run smoke` passes" to Phase 2's automated criteria.
- **Decision**: FIXED — Fixed in plan (smoke expectation moved to Phase 2 §6; step 2.7 added)

### F3 — The user B check can pass without proving anything

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1
- **Detail**: "B's body excludes A's distance" also passes when B's dashboard renders the error message (page returns 200 by design).
- **Fix**: Also assert B's body includes the empty state "Brak treningów z ostatnich 7 dni."
- **Decision**: FIXED — Fixed in plan

### F4 — Date strings: impossible dates and display time zone not specified

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 §4, Phase 2 §5
- **Detail**: `2026-02-30` would reach Postgres and produce the generic error; formatting `new Date("YYYY-MM-DD")` in a zone behind UTC shows the previous day.
- **Fix**: Validator round-trips the date; dashboard formats dates with `timeZone: "UTC"`.
- **Decision**: FIXED — Fixed in plan

### F5 — Outdated line references

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis, Phase 2 §6, References
- **Detail**: Success redirect is `signin.ts:19` (not `:21`); file has 21 lines (`:4-22` invalid); smoke step is `smoke.mjs:54` (not `:59`).
- **Fix**: Correct the line numbers.
- **Decision**: FIXED — Fixed in plan
