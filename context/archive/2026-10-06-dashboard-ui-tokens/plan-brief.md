# Dashboard UI tokens — Plan Brief

> Full plan: `context/changes/dashboard-ui-tokens/plan.md`
> Research: `context/changes/dashboard-ui-tokens/research.md`

## What & Why

`/dashboard` is the screen runners land on after sign-in, and S-03 (today's workout suggestion) will build on it. Today it is painted entirely with palette literals: 13 scan hits and 0 token classes. Changing a colour therefore means editing every view, keyboard focus is barely visible, and errors are signalled by colour only. This change puts the view on the shadcn token and component contract the repo already ships, so the next views inherit it instead of copying literals.

## Starting Point

`src/styles/global.css` has correct shadcn tokens (`:root`, `.dark`, `@theme inline`) that no view reads. `<html>` has no `.dark`, so the light set is active, while the view fakes a dark "cosmic glass" theme with `white/10`, `blue-100/80`, `purple-600` and a hex gradient. `ui/` has only `button.tsx`, used once and overridden.

## Desired End State

`/dashboard` looks as it does today but is built only from role tokens, `Card` and `buttonVariants`. The `h1` comes first, the error is announced as an alert, the empty state offers "add a workout", and focus rings are visible. A dev-only kitchen sink shows every state. `AGENTS.md` and `npm run lint:ui` (CI and pre-commit) keep the next agent off literals.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Contract variant | Extend existing shadcn system, no new `init` | Tokens and `ui/` already exist; they were just unused | Research |
| Theme layer | Cosmic palette into `.dark` + `class="dark"` on `<html>` | Keeps today's look, and the other `bg-cosmic` views stay consistent until their own changes | Plan |
| Panel | Add shadcn `card` | The glass panel is copied 3× here and in 4 other views; a shared component stops the copying | Plan |
| Buttons in `.astro` | `buttonVariants()` as a class string | No hydration; avoids the unverified `asChild` + Astro slot combination | Research |
| Guard | Dependency-free `scripts/check-ui-literals.mjs` in CI + lint-staged, plus `AGENTS.md` rule | A failing check beats a rule an agent forgets; no new dependency | Plan |
| Visual gate | Kitchen-sink page (dev only) + screenshots | No screenshot runner in the repo; `/10x-ui` forbids installing one for this | Research |
| Heading gradient | Dropped for `text-foreground` | Decorative literal with no role; tokenising it adds no value | Plan |

## Scope

**In scope:**
- `src/styles/global.css` `.dark` values, a new `--background-glow` token, token-backed `bg-cosmic`
- `Layout.astro`: `lang="pl"`, `class="dark"`
- `src/components/ui/card.tsx`, new `DashboardView.astro`, slimmed `dashboard.astro`
- Error and empty states, focus-visible, kitchen sink, screenshots
- `AGENTS.md` `## UI`, `lint:ui` script, CI step

**Out of scope:**
- Other views (`auth/*`, `workouts/new`, `Welcome`, `Topbar`), `SubmitButton` overrides, `Banner` hex (deferred)
- Light/dark toggle, Playwright, ESLint class rules, copy or data-flow changes

## Architecture / Approach

The values live in `global.css` `.dark` (recorded in `theme-values.md`), are published by `@theme inline` and consumed as role classes. `dashboard.astro` keeps data loading and passes props to `DashboardView.astro`, which owns the markup. The kitchen sink reuses `DashboardView` with fixtures, so every state renders without Supabase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Library and values | `card.tsx` + `theme-values.md` | none significant |
| 2. Token values | Cosmic palette active via `.dark`; `bg-cosmic` reads tokens | Global: other views shift if a token they rely on changes |
| 3. One view | `DashboardView` on tokens/components, `h1` first | Smoke regex on `weekly-load` breaks if markup wraps the number |
| 4. States + gate | Error/empty/focus, kitchen sink, screenshots | `Card` layout under Astro static slots |
| 5. Guard | `AGENTS.md` rule, `lint:ui` in CI and pre-commit | Regex false positives (e.g. `#123` in copy) |

**Prerequisites:** local Supabase for `npm run smoke`; a browser for screenshots.
**Estimated effort:** ~1–2 sessions across 5 small phases.

## Open Risks & Assumptions

- The `--ring` value (purple-400) is assumed to read well on the gradient; Phase 4 checks it by screenshot.
- `Card` from React rendered statically in `.astro` is assumed to keep its flex layout; Phase 3/4 screenshots verify it.

## Success Criteria (Summary)

- `/dashboard` looks the same, has 0 literal hits, and passes smoke.
- Every applicable state is visible in the kitchen sink; focus is visible and the error is announced.
- A literal added to the dashboard fails `npm run lint:ui` locally and in CI.
