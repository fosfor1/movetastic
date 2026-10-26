# Today's Workout Suggestion Implementation Plan

## Overview

Roadmap slice S-03 (north star): a signed-in runner taps „Sugestia na dziś” on the dashboard, picks today's wellbeing on a 1–5 scale and sees the title and description of a suggested workout. The suggestion comes from the 7-day training load and the wellbeing. The hard guarantee (PRD §Business Logic, test-plan risk #3) is that **low wellbeing never yields an intense workout, whatever the load**.

## Current State Analysis

- The 7-day load already exists: `weeklyTrainingLoad()` (`src/lib/training-load.ts:10`) sums `distance_km × avg_heart_rate / 100` over the workouts returned by `listRecentWorkouts()` (`src/lib/workouts.ts:18`), which reads the inclusive window today−6…today in Europe/Warsaw (`src/lib/dates.ts:28`).
- The dashboard computes the load server-side and shows `null` (no number) when the list fails (`src/pages/dashboard.astro:15-24`). Rounding is display-only: `Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 })` in `src/components/dashboard/DashboardView.astro:16`, so 100.4 shows as „100”.
- The dashboard has one CTA, „Dodaj trening” (`DashboardView.astro:58-60`). There is no suggestion route, rule, or wellbeing input.
- Every path under `/dashboard` is protected by the `PROTECTED_ROUTES` prefix (`src/middleware.ts:4`), and `tests/integration/anonymous-access.test.ts` discovers new page files and checks them automatically (test-plan §6.3).
- Vitest has only the `integration` and `hooks` projects (`vitest.config.ts`), so no unit project exists yet and nothing resolves the `@/` alias for tests.
- UI rules: role tokens only, `cn()` for class merging, and views listed in `scripts/check-ui-literals.mjs` `FILES` are enforced by `npm run lint:ui`. States are checked in the dev-only kitchen sink `src/pages/dev/kitchen-sink/dashboard.astro`, which is already allow-listed as public in `tests/integration/helpers/routes.ts:75`.

## Desired End State

- The dashboard shows a second CTA, „Sugestia na dziś”, linking to `/dashboard/suggestion`.
- `/dashboard/suggestion` (protected, server-rendered, no React) shows five buttons 1–5 for wellbeing. Choosing one submits a GET form to `/dashboard/suggestion?wellbeing=N`. The same page then shows the suggestion's title and description, the 7-day load it was based on, and a „Wróć” link to `/dashboard`.
- Rule (agreed in planning; `L` = the load rounded exactly as the dashboard displays it):

  | Wellbeing | L ≤ 100            | L > 100          |
  | --------- | ------------------ | ---------------- |
  | 1–2 (low) | Lekki wolny bieg   | Lekki wolny bieg |
  | 3         | Spokojny bieg tlenowy | Lekki wolny bieg |
  | 4–5       | Interwały          | Lekki wolny bieg |

- An invalid `wellbeing` value (`0`, `6`, `abc`, `3.5`, empty) shows the picker with an error message and no suggestion. A missing parameter shows only the picker.
- If the workouts cannot be loaded (Supabase null or query error), the page shows the error and **no suggestion**. The load is never assumed to be 0.
- A unit boundary table proves the rule, with expected outcomes written literally in the test (independent oracle).

Verify by: `npm run test:unit` green with the boundary table, the CI gate green, `npm run test:integration` green (new route denied to anonymous users), and a manual check on a phone-width viewport.

### Key Discoveries:

- `Intl.NumberFormat` with `maximumFractionDigits: 0` rounds half away from zero (`halfExpand`), and for non-negative loads that equals `Math.round`. One shared `roundLoad()` used by both the view and the rule keeps „what the runner sees” and „what the rule compares” identical (`DashboardView.astro:16,52`).
- The dashboard treats a list error as „no load” (`dashboard.astro:24`). The suggestion page must follow the same pattern; silently using 0 would suggest intervals to a runner whose load is unknown.
- New `src/pages/dashboard/*` files are covered by `anonymous-access` without new tests. Adding states to the existing kitchen-sink page avoids a new `PUBLIC_ROUTES` entry.
- `scripts/smoke.mjs` mirrors the load formula and formatter (lines 39–43). It is unaffected because the displayed number does not change for any input.

## What We're NOT Doing

- Not storing wellbeing anywhere: no table, no migration, no RLS policy, and no history.
- No „edytuj trening” button (FR-005 parked; roadmap Open Question 4).
- No per-user threshold (PRD Open Question 2). The threshold stays a single constant, 100.
- No „rest day” suggestion; the catalog is exactly three workouts.
- No React island or client-side rule. The load is never sent by the client.
- No E2E spec: the risk is the rule (unit) and route protection (existing integration). There is no hydration or reload risk (test-plan §1 rule #1, §6.6).
- No CI wiring for unit tests (test-plan §3 Phase 2 owns CI gates).

## Implementation Approach

Test-first for the rule (CLAUDE.md: a bug or requirement becomes a failing test first). Phase 1 adds the `unit` Vitest project and the pure rule module with its boundary table, and switches the dashboard display to the shared `roundLoad()`. Phase 2 builds the server-rendered page on top of the green rule, adds the dashboard CTA and kitchen-sink states, and updates the test plan.

## Critical Implementation Details

- **Fail closed on unknown load**: the page computes a suggestion only when the workout list loaded without error. Any `listError` or null Supabase client renders the error state, never a suggestion.
- **Rounding before the comparison**: the rule receives the raw load and compares `roundLoad(load) > 100`. Callers do not round first, so the comparison cannot drift from the display.

## Phase 1: Suggestion rule (test-first)

### Overview

A pure, framework-free rule module plus a unit test project. The boundary table is written red first, then made green.

### Changes Required:

#### 1. Unit test project

**File**: `vitest.config.ts`, `package.json`

**Intent**: Add a `unit` Vitest project for pure modules that import app code, and a script to run it.

**Contract**: The project is named `unit`, uses `environment: "node"` and includes `tests/unit/**/*.test.ts`. It resolves the alias `@` → `./src` (same alias as `tsconfig`). Add a new script `"test:unit": "vitest run --project unit"`. `npm test` keeps running all projects. Update the header comment of `vitest.config.ts`, which currently says no project imports application code.

#### 2. Shared rounding

**File**: `src/lib/training-load.ts`

**Intent**: Single source for „the load as displayed”, used by the dashboard and by the rule.

**Contract**: `export function roundLoad(load: number): number`, rounded to an integer with the same result as the dashboard's `Intl` formatter for non-negative values (`Math.round`). The file comment notes that rounding is shared by the display and the suggestion rule.

#### 3. Suggestion types

**File**: `src/types.ts`

**Intent**: Shared types for the rule and the view.

**Contract**: `type Wellbeing = 1 | 2 | 3 | 4 | 5`, `type WorkoutSuggestionKind = "easy" | "steady" | "intervals"` and `interface WorkoutSuggestion { kind: WorkoutSuggestionKind; title: string; description: string }`.

#### 4. Rule module

**File**: `src/lib/workout-suggestion.ts` (new; no `astro:*` imports, same header style as `training-load.ts`)

**Intent**: Encodes the agreed rule and catalog, and parses the raw query value.

**Contract**:
- `export const LOAD_THRESHOLD = 100;` and `export const LOW_WELLBEING_MAX = 2;`.
- `export function parseWellbeing(raw: string | null): Wellbeing | null` accepts only the exact strings `"1"`–`"5"` and returns `null` for anything else, including whitespace, `"3.0"` and empty.
- `export function suggestWorkout(load: number, wellbeing: Wellbeing): WorkoutSuggestion`:
  - `wellbeing ≤ 2` or `roundLoad(load) > 100` gives `easy`,
  - otherwise `wellbeing === 3` gives `steady`,
  - otherwise (4–5) gives `intervals`.

  The low-wellbeing check comes first and does not depend on load.
- Catalog (Polish copy, final wording may be polished in review):
  - `easy`, „Lekki wolny bieg”: 30–40 minut spokojnego biegu w tempie pozwalającym na swobodną rozmowę; dziś priorytetem jest regeneracja.
  - `steady`, „Spokojny bieg tlenowy”: 45–60 minut w równym, komfortowym tempie; oddech przyspieszony, ale wciąż możesz mówić pełnymi zdaniami.
  - `intervals`, „Interwały”: 15 minut rozgrzewki truchtem, 6 × 3 minuty mocnego biegu z 2 minutami truchtu w przerwach, 10 minut schłodzenia.

#### 5. Boundary table test

**File**: `tests/unit/workout-suggestion.test.ts` (new)

**Intent**: Prove risk #3 („low wellbeing never intense; above threshold always easy”) and the agreed boundaries, with expectations written as literals rather than computed by the rule (test-plan risk #3 anti-pattern).

**Contract**:
- `test.each` over every wellbeing 1–5 × load `{0, 15, 100, 100.4, 100.5, 101, 500}` with the expected `kind` typed literally per row (35 rows). Notable rows: `(3, 100.4) → steady`, `(4, 100.5) → easy`, `(5, 0) → intervals`, `(2, 0) → easy`.
- A separate `test.each` for `parseWellbeing` covers `"1"`–`"5"` as valid and `null`, `""`, `"0"`, `"6"`, `" 3"`, `"3.0"`, `"abc"` as `null`.
- A test that every kind maps to a non-empty title and description.
- `roundLoad`: `100.4 → 100`, `100.5 → 101`, `0 → 0`.
- The file header carries a `// risk: #3` comment.

#### 6. Dashboard uses shared rounding

**File**: `src/components/dashboard/DashboardView.astro`

**Intent**: Display the load through `roundLoad()` so the number shown is exactly what the rule compares.

**Contract**: `loadFormatter.format(roundLoad(weeklyLoad))`. The formatter stays as is. The displayed output does not change for any input.

### Success Criteria:

#### Automated Verification:

- Boundary table written first fails before the rule exists (red), then passes: `npm run test:unit`
- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- `npm run lint:ui` passes

#### Manual Verification:

- Deliberate break check: changing `LOW_WELLBEING_MAX` to 1 (or `>` to `>=`) turns the table red in the same run, then restore it

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Suggestion screen

### Overview

The protected server-rendered page, the dashboard entry point, kitchen-sink states and test-plan bookkeeping.

### Changes Required:

#### 1. Suggestion page

**File**: `src/pages/dashboard/suggestion.astro` (new)

**Intent**: Read `wellbeing` from the query, load the 7-day workouts server-side and pick the view state. Same data-loading pattern as `src/pages/dashboard.astro`, including the `createClient()` null branch.

**Contract**: The route is `GET /dashboard/suggestion[?wellbeing=1..5]`, protected by the existing `/dashboard` prefix (no middleware change). State resolution:
- load error or null client → `error` (message, no suggestion);
- no `wellbeing` param → `picker`;
- param present but `parseWellbeing` returns null → `picker` with the error „Wybierz samopoczucie od 1 do 5.”;
- otherwise → `result` with `suggestWorkout(load, wellbeing)`, the rounded load and the wellbeing.

The load is only fetched when needed for `result`, or always (implementer's choice). Either way, an error state wins over `result`. Uses `Layout` with the title „Sugestia na dziś”.

#### 2. Suggestion view

**File**: `src/components/suggestion/SuggestionView.astro` (new)

**Intent**: Static markup for the states, styled like `DashboardView` (`Card`, role tokens, `buttonVariants`, `cn()`).

**Contract**: Props:
- `state: "picker" | "result" | "error"`
- `pickerError?: string`
- `suggestion?: WorkoutSuggestion`
- `load?: number` (already rounded)
- `wellbeing?: Wellbeing`
- `errorMessage?: string`

Content per state:
- **picker**: heading, the question „Jak się dziś czujesz?” with a 1 = bardzo źle / 5 = świetnie legend, and a `<form method="GET" action="/dashboard/suggestion">` with five `<button type="submit" name="wellbeing" value="N">` in one row (touch-sized for Android). `pickerError` is shown as `role="alert"` like the dashboard's list error.
- **result**: suggestion title (heading) and description, plus a line such as „Na podstawie obciążenia {load} z ostatnich 7 dni i samopoczucia {wellbeing}/5”. Add `data-testid="suggestion-title"` on the title.
- **error**: alert box in the dashboard's error style.

Every state shows a „Wróć” link to `/dashboard`, and the result state also has „Zmień samopoczucie” linking to `/dashboard/suggestion`.

#### 3. Dashboard CTA

**File**: `src/components/dashboard/DashboardView.astro`

**Intent**: Entry point from US-01.

**Contract**: Add an `<a href="/dashboard/suggestion">Sugestia na dziś</a>` styled with `buttonVariants` next to or below „Dodaj trening”, full width on mobile, merged via `cn()`. It is shown in every dashboard state; the suggestion page handles errors itself.

#### 4. Kitchen-sink states

**File**: `src/pages/dev/kitchen-sink/dashboard.astro`

**Intent**: Visual gate for every suggestion state without a new public route.

**Contract**: Add a „Sugestia na dziś” section rendering `SuggestionView` for: picker, picker with error, result `easy` / `steady` / `intervals` (built with `suggestWorkout` from fixture loads, for example 120/3, 40/3, 40/5), and error. The page stays dev-only.

#### 5. UI literal gate

**File**: `scripts/check-ui-literals.mjs`

**Intent**: Enforce tokens on the new views.

**Contract**: Append `src/pages/dashboard/suggestion.astro` and `src/components/suggestion/SuggestionView.astro` to `FILES`.

#### 6. Test plan bookkeeping

**File**: `context/foundation/test-plan.md`

**Intent**: Record that risk #3 now has its test and how to extend it.

**Contract**:
- §3 row 4 („Bezpieczeństwo reguły sugestii”): set Status to `complete` and Change folder to `context/changes/todays-workout-suggestion/`.
- §4 Stack note: the `unit` project now exists.
- §6.5: replace TBD with the pattern (test file location, `npm run test:unit`, a literal expected-kind table over wellbeing × load including the rounding boundary 100.4/100.5, never computing expectations with `suggestWorkout`, and the deliberate-break check).

### Success Criteria:

#### Automated Verification:

- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- `npm run lint:ui` passes with the two new files in `FILES`
- `npm run test:unit` passes
- `npm run test:integration` passes, and `anonymous-access` probes `/dashboard/suggestion` (anonymous → 302 `/auth/signin`)

#### Manual Verification:

- Signed in at phone width: dashboard → „Sugestia na dziś” → tap 2 → „Lekki wolny bieg” with the load shown; „Wróć” returns to the dashboard
- With load ≤ 100: wellbeing 3 → „Spokojny bieg tlenowy”; wellbeing 5 → „Interwały”
- `/dashboard/suggestion?wellbeing=9` shows the picker with the error, no suggestion
- The load number on the suggestion screen equals the number on the dashboard
- Kitchen sink `/dev/kitchen-sink/dashboard` shows all six suggestion states legibly in the dark theme

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `tests/unit/workout-suggestion.test.ts`: the full wellbeing × load boundary table (literal expectations), `parseWellbeing` accept/reject cases, `roundLoad` half-up at 100.5, and catalog completeness.

### Integration Tests:

- No new file: `anonymous-access` discovers `src/pages/dashboard/suggestion.astro` and asserts anonymous denial. The kitchen-sink page is already allow-listed.

### Manual Testing Steps:

1. Log workouts so the dashboard load is ≤ 100, open „Sugestia na dziś” and try wellbeing 1–5. Expect easy, easy, steady, intervals, intervals.
2. Log enough to push the displayed load above 100 (e.g. 70 km at HR 150 = 105). Every wellbeing now gives „Lekki wolny bieg”.
3. Open `/dashboard/suggestion?wellbeing=abc`: picker with error.
4. Stop local Supabase (or unset keys) and open `/dashboard/suggestion?wellbeing=5`: error, no suggestion.

## Performance Considerations

One extra indexed 7-day query per suggestion request, the same as the dashboard. Well within the 1–2 s NFR.

## Migration Notes

None. No schema changes.

## References

- PRD: `context/foundation/prd.md` (FR-003, FR-006, US-01, §Business Logic)
- Roadmap slice: `context/foundation/roadmap.md` S-03
- Test plan risk #3 and Phase 4: `context/foundation/test-plan.md`
- Load formula decision: `context/archive/2026-10-03-weekly-training-load/plan.md`
- Pattern to follow: `src/pages/dashboard.astro:15-24`, `src/components/dashboard/DashboardView.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Suggestion rule (test-first)

#### Automated

- [x] 1.1 Boundary table written first fails before the rule exists (red), then passes: `npm run test:unit`
- [x] 1.2 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- [x] 1.3 `npm run lint:ui` passes

#### Manual

- [x] 1.4 Deliberate break check: changing `LOW_WELLBEING_MAX` to 1 (or `>` to `>=`) turns the table red in the same run, then restore it

### Phase 2: Suggestion screen

#### Automated

- [ ] 2.1 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- [ ] 2.2 `npm run lint:ui` passes with the two new files in `FILES`
- [ ] 2.3 `npm run test:unit` passes
- [ ] 2.4 `npm run test:integration` passes, and `anonymous-access` probes `/dashboard/suggestion` (anonymous → 302 `/auth/signin`)

#### Manual

- [ ] 2.5 Signed in at phone width: dashboard → „Sugestia na dziś” → tap 2 → „Lekki wolny bieg” with the load shown; „Wróć” returns to the dashboard
- [ ] 2.6 With load ≤ 100: wellbeing 3 → „Spokojny bieg tlenowy”; wellbeing 5 → „Interwały”
- [ ] 2.7 `/dashboard/suggestion?wellbeing=9` shows the picker with the error, no suggestion
- [ ] 2.8 The load number on the suggestion screen equals the number on the dashboard
- [ ] 2.9 Kitchen sink `/dev/kitchen-sink/dashboard` shows all six suggestion states legibly in the dark theme
