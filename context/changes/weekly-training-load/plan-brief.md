# Weekly Training Load — Plan Brief

> Full plan: `context/changes/weekly-training-load/plan.md`

## What & Why

Roadmap slice S-02: the main screen shows the runner's training load from the last 7 days as a concrete number (US-01 AC). That number is the input to S-03's suggestion rule ("if load exceeds e.g. 100 … suggest an easy run"), so its formula and scale had to be fixed first. This was Roadmap Open Question 3, which was blocking.

## Starting Point

S-01 is done: `/dashboard` already fetches the signed-in user's workouts dated today−6…today (Europe/Warsaw), and RLS isolates them per user. Smoke saves one workout for user A (distance `1XX.YZ` km, HR 150) and checks that user B sees an empty list.

## Desired End State

`/dashboard` shows a card "Obciążenie z ostatnich 7 dni" with an integer such as `58`, with `0` when there are no workouts. It updates after each added workout. A pure function returns the exact value for S-03, and CI smoke proves both the number for A and `0` for B.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Load formula | Σ (distance_km × avg_HR / 100) over the 7-day window | Linear and easy to explain; 10 km at HR 150 = 15, so the "100" threshold ≈ a heavy ~70 km amateur week. |
| Window | Same as S-01: today−6…today, Warsaw calendar | Reuses the list the dashboard already fetches; one definition of "last 7 days". |
| Display | Integer (pl-PL, half-up); rounding only at display | Readable on a phone; S-03 compares the exact value. |
| No workouts | Show `0` | AC requires a concrete number, and zero load is a meaningful input to S-03. |
| List load error | Hide the card, keep the existing error message | Avoids presenting a false `0`. |
| Where the formula lives | Pure `src/lib/training-load.ts`, no DB storage | Single source for S-02 and S-03; no migration, nothing to keep in sync. |
| Verification | Extend smoke: `bodyMatches` on `data-testid="weekly-load"`; A = expected, B = `0` | Runs in CI with no new dependencies and also proves the derived value is isolated. |

## Scope

**In scope:**
- `src/lib/training-load.ts` (formula)
- Load card on `src/pages/dashboard.astro`
- `roadmap.md`: mark Open Question 3 resolved and update the S-02 Unknowns/Backlog note
- `scripts/smoke.mjs`: regex expectation + A/B load steps
- Manual production deploy

**Out of scope:**
- Suggestion flow, "sugestia na dziś" button and threshold logic (S-03)
- Per-user thresholds/formulas, richer inputs (pace, duration, terrain)
- Storing/caching the load, unit test framework, workout editing (FR-005)

## Architecture / Approach

SSR only: `dashboard.astro` → `listRecentWorkouts` (existing, RLS-scoped) → `weeklyTrainingLoad(workouts)` (new pure fold) → rounded with `Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 })` into a marked element. Smoke mirrors the formula and formatter to compute the expected string.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Load calculation and dashboard display | Formula module + load card | Formula or window boundary off by one day (covered by manual checks) |
| 2. Smoke verification and production rollout | CI-checked A/B load; deploy | Smoke mirror of the formula drifting from the app |

**Prerequisites:** Local Supabase + `.dev.vars` (already set up in S-01); wrangler auth for the deploy.
**Estimated effort:** ~1 after-hours session across 2 phases.

## Open Risks & Assumptions

- The formula is an MVP approximation: HR has weak weight (150 vs 170 bpm is only +13%), and there is no duration or pace. It can be revisited with Roadmap Open Question 1.
- The global threshold "≈100" assumes a typical amateur. Per-user calibration is Open Question 2.
- Display rounds but S-03 compares the exact value, so 99.6 shows "100" while still being below a threshold of 100. S-03 must either compare against the rounded value or accept this mismatch explicitly.
- Smoke reimplements the formula and format, so changing either requires updating smoke in the same commit.

## Success Criteria (Summary)

- A runner opens the main screen and sees a single load number for the last 7 days, which grows after adding a workout.
- 10 km at HR 150 adds exactly 15; workouts older than today−6 do not count.
- CI smoke proves user B's load never includes user A's workouts.
