# Today's Workout Suggestion — Plan Brief

> Full plan: `context/changes/todays-workout-suggestion/plan.md`

## What & Why

Roadmap slice S-03, the product's north star. A runner on the dashboard taps „Sugestia na dziś”, rates today's wellbeing 1–5, and gets a concrete workout (title + description) chosen from the 7-day training load and that wellbeing. The safety guarantee from the PRD is that low wellbeing never yields an intense workout, whatever the load.

## Starting Point

The dashboard already computes the 7-day load server-side (`weeklyTrainingLoad`, Σ km × HR / 100) and shows it rounded to an integer. There is no suggestion rule, no wellbeing input, no suggestion route and no unit-test project.

## Desired End State

The dashboard has a „Sugestia na dziś” button leading to `/dashboard/suggestion`. That page shows five buttons 1–5, then the suggested workout with the load it was based on, plus „Wróć” to the dashboard. A unit boundary table proves the rule. If the load cannot be read, the page shows an error, never a suggestion.

| Wellbeing | Displayed load ≤ 100  | Displayed load > 100 |
| --------- | --------------------- | -------------------- |
| 1–2       | Lekki wolny bieg      | Lekki wolny bieg     |
| 3         | Spokojny bieg tlenowy | Lekki wolny bieg     |
| 4–5       | Interwały             | Lekki wolny bieg     |

## Key Decisions Made

| Decision            | Choice                                                    | Why (1 sentence)                                                                    |
| ------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| „Low” wellbeing     | 1–2                                                       | Symmetric scale that leaves 3 for a moderate workout.                               |
| Threshold boundary  | Displayed (rounded) load > 100; 100 is not exceeded       | The rule matches the number the runner sees (100.4 → „100” → not exceeded).         |
| Catalog             | 3 suggestions: easy / steady / intervals                  | Covers the whole input grid without gaps; no rest day (not in PRD).                 |
| Wellbeing storage   | Not stored                                                | PRD needs no history; avoids a table, migration, RLS and isolation tests.           |
| Flow                | One SSR page, GET form, no React                          | Load is computed on the server, route protected by the `/dashboard` prefix, works without JS. |
| Unknown load        | Error state, no suggestion                                | Assuming 0 would suggest intervals to a runner whose load is unknown.               |
| Test layer          | Unit boundary table (new `unit` Vitest project), no E2E   | The risk is the rule; route protection is already covered by `anonymous-access`.    |

## Scope

**In scope:**
- `roundLoad()` shared by the dashboard and the rule
- `parseWellbeing()` and `suggestWorkout()` with the agreed rule and catalog
- `tests/unit/workout-suggestion.test.ts`
- `/dashboard/suggestion` page and `SuggestionView`
- Dashboard CTA
- Kitchen-sink states
- `lint:ui` entries
- Test-plan §3 Phase 4 / §6.5 update

**Out of scope:**
- Storing wellbeing
- „Edytuj trening” button (FR-005)
- Per-user threshold
- Rest-day suggestion
- React island
- E2E spec
- CI wiring for unit tests (test-plan Phase 2)

## Architecture / Approach

`GET /dashboard/suggestion?wellbeing=N` runs in Astro SSR as follows:

1. Parse `N`.
2. `listRecentWorkouts` → `weeklyTrainingLoad` → `suggestWorkout(load, N)`, which compares `roundLoad(load) > 100` after the low-wellbeing check.
3. Render the static `SuggestionView` (picker / result / error).

The rule lives in a pure module (`src/lib/workout-suggestion.ts`) with no `astro:*` imports, so it is unit-testable.

## Phases at a Glance

| Phase                               | What it delivers                                                       | Key risk                                                         |
| ----------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1. Suggestion rule (test-first)     | `unit` project, `roundLoad`, rule + parser, 35-row literal boundary table | Oracle computed with the rule itself; rounding drift vs display |
| 2. Suggestion screen                | Protected SSR page, dashboard CTA, kitchen-sink states, test-plan update | Suggestion shown on unknown load; untokenized UI               |

**Prerequisites:** S-02 done (yes). Local Supabase plus a running server are needed for `npm run test:integration`.
**Estimated effort:** ~1–2 sessions across 2 phases.

## Open Risks & Assumptions

- With load 0 (a fully rested week) and wellbeing 4–5 the rule suggests intervals. This is accepted as the literal PRD rule, not a training-science judgment.
- The suggestion copy is a first draft and may be polished during review without changing the rule.
- Unit tests are not in CI until test-plan Phase 2 wires the gates.

## Success Criteria (Summary)

- A runner with wellbeing 1–2 always gets „Lekki wolny bieg”, at any load, proven by the unit table.
- Above a displayed load of 100, every wellbeing gets „Lekki wolny bieg”. At or below 100, wellbeing 3 gets „Spokojny bieg tlenowy” and 4–5 get „Interwały”.
- The suggestion screen is reachable from the dashboard, protected, and readable on a phone.
