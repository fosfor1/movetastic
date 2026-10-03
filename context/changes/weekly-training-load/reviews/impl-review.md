<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Weekly Training Load Implementation Plan

- **Plan**: context/changes/weekly-training-load/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2
- **Date**: 2026-10-03
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Plan drift: every Changes Required item is MATCH. The only EXTRA is the `escapeRegExp`/`weeklyLoadPattern` helper in smoke, which keeps both expectations identical and is benign.
- Safety: no XSS (Astro auto-escapes the number) and the regex is escaped and anchored. Authz goes through middleware + RLS, and smoke B expects `0`. There is no N+1. The 7-day query has no limit, but that predates this change and the window bounds it.
- Success criteria: the CI gate passes on HEAD 36ffc0a (lint, astro check 0/0/0, build). `npm run smoke` passed on the rebuilt final code (A = 169, B = 0). The break-check went red when the formula was changed to `/ 50`. All manual rows (1.2–1.5, 2.3) were confirmed by the user in session, and production was deployed as version 9f338e43.

## Findings

### F1 — Display and S-03 rule don't share one canonical load value

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/lib/training-load.ts:11, src/pages/dashboard.astro:24
- **Detail**: `weeklyTrainingLoad` returns an unrounded float sum, and only the dashboard rounds it. If S-03 compares the raw value against a threshold of 100, a user can see "100" (raw 99.6, or float noise like 99.9999) and still get the below-threshold suggestion. This was a deliberate plan decision and is recorded as a hand-off in plan.md Desired End State and in the brief's Open Risks, so it is not a defect yet. It becomes a defect if S-03 forgets about it.
- **Fix A ⭐ Recommended**: Leave the code as is and decide in S-03 planning, where the hand-off note already lives.
  - Strength: No churn in shipped code. The decision sits with the slice that owns the threshold rule.
  - Tradeoff: Relies on S-03 planning reading the note.
  - Confidence: HIGH — the note is in plan.md and plan-brief.md.
  - Blind spot: The note lives in a change folder that will be archived; S-03 planning must read the archived plan.
- **Fix B**: Make the canonical value integer now, by having the lib or a new `roundedWeeklyLoad()` return `Math.round(sum)` for both display and rule.
  - Strength: Removes the mismatch class entirely: what the user sees is what the rule checks.
  - Tradeoff: Reverses an agreed plan decision and changes the S-03 contract before S-03 is planned. Smoke and the plan need updating too.
  - Confidence: MED — small edit, but it pre-empts an S-03 design choice.
  - Blind spot: S-03 may want hysteresis or a non-integer threshold.
- **Decision**: FIXED via Fix A (no code change; S-03 planning decides, hand-off note in plan.md + plan-brief.md)

### F2 — Roadmap edits slightly beyond contract, and a table misaligned

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/roadmap.md:43, 108-109
- **Detail**: The plan asked only for the S-02 Backlog Notes to be updated. The implementation also set S-02 "Ready for /10x-plan" to `yes` and added an "OQ3 resolved" note to S-03. Both fit the intent and are harmless. The `in-progress` cell (L43) and the widened S-02 Backlog row break the column padding. The table still renders, because Prettier does not format .md in lint-staged.
- **Fix**: Re-pad the At-a-glance and Backlog Handoff tables and keep the extra edits as they are.
- **Decision**: FIXED (Prettier re-padded the At-a-glance and Backlog Handoff tables; extra edits kept)
