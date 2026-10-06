# Dashboard UI tokens Implementation Plan

## Overview

Move `/dashboard` from hardcoded palette literals onto the shadcn design-system contract that already ships in the repo. Fold the current "cosmic glass" look into the `.dark` token values and switch `.dark` on. Rebuild the view from `buttonVariants` and a shadcn `card`, cover the 7-state matrix, gate it with a dev-only kitchen-sink page, and leave a rule plus a CI check so the next view (S-03 lands on this screen) inherits tokens instead of literals.

Input: `context/changes/dashboard-ui-tokens/research.md` (charges C1–C5).

## Current State Analysis

- Tokens exist and are wired: `:root` (`src/styles/global.css:6-41`), `.dark` (`:43-77`), published by `@theme inline` (`:79-111`). Nothing outside `src/components/ui/` reads them: 0 role-token classes across the 15 view/component files checked (research, Source → views).
- The de-facto theme is dark, painted with literals: `bg-cosmic` hex gradient (`global.css:113-115`), `white/10` surfaces, `blue-100/80` muted text, `purple-600` primary, `red-*` errors (`src/pages/dashboard.astro:43-91`, 13 scan-hit lines).
- `<html lang="en">` without `.dark` (`src/layouts/Layout.astro:14`), so the light `:root` tokens are active. Migrating literals to tokens before fixing the values would render near-black text on the dark gradient (C2).
- `ui/` holds `button.tsx` (with focus-visible ring and disabled styles, `button.tsx:8`) and `LibBadge.astro`. The dashboard imports neither. The sign-out button (`dashboard.astro:50-55`) and "Dodaj trening" link (`:69-74`) are hand-built, and the glass panel is copied 3× (`:44`, `:60`, `:87`) (C3).
- Error state `:81` is red palette classes with no `role`. The empty state `:83` is one muted line (C4). The only `<h1>` sits after the metric and CTA (`:76`) (C5).
- Loading: SSR-only data fetch (`dashboard.astro:18`), so there is no in-page loading state.
- Tooling: no Playwright or screenshot runner (`package.json`). ESLint runs in CI (`.github/workflows/ci.yml`) and husky runs `lint-staged` on commit (`package.json` `lint-staged`).

## Desired End State

- `/dashboard` renders with the same cosmic look as today, built only from role tokens (`bg-background`, `bg-card`, `text-muted-foreground`, `bg-primary`, `border-border`, `text-destructive`, `ring-ring`) and repo components (`Card`, `buttonVariants`).
- The hardcoded-value scan on `src/pages/dashboard.astro` and `src/components/dashboard/DashboardView.astro` returns 0 hits, enforced by `npm run lint:ui` in CI and lint-staged.
- `/dev/kitchen-sink/dashboard` (dev server only) shows the view in every applicable state side by side. Screenshots at desktop and 375 px are saved in the change folder.
- `AGENTS.md` has a UI block that names the token source, the components directory, the "no literals in views" rule, and the kitchen-sink location.
- Smoke test still passes. `data-testid="weekly-load"`, the empty-state string and the distance format are unchanged.

### Key Discoveries:

- `scripts/smoke.mjs:47` matches `data-testid="weekly-load"[^>]*>\s*<number>\s*<`, so the load number must stay the element's direct text.
- `scripts/smoke.mjs:48` asserts the literal `"Brak treningów z ostatnich 7 dni."`, and `:116` asserts the formatted distance. Both strings stay byte-identical.
- `global.css:4` `@custom-variant dark (&:is(.dark *))`: `.dark` must sit on an ancestor (`<html>`).
- `buttonVariants()` is a plain function (`button.tsx:7`), so it can be used as a `class` string in `.astro` without hydrating React. Prefer it over `<Button asChild>` for the `<a>` (research: Radix `Slot` and Astro static slots are an unverified combination).
- `CLAUDE.md:3-14` is the `@przeprogramowani/10x-cli` managed block. The rule goes into `AGENTS.md`, which has no managed block.

## What We're NOT Doing

- Restyling other views (`auth/*`, `dashboard/workouts/new`, `Welcome`, `Topbar`) or `SubmitButton.tsx:18`. They keep their literals and only pick up global token changes (deferred charges in research).
- `Banner.astro` hex colours (deferred C4 sub-item; `Layout` renders it only on missing config).
- A light/dark toggle. `:root` stays the shadcn light set; the app is fixed to `.dark`.
- The decorative `from-blue-200 to-purple-200` heading gradient. It is dropped in favour of `text-foreground`, not tokenised.
- Installing Playwright or any screenshot runner. ESLint rules for class literals.
- Changing data flow, formatters, routes or copy asserted by smoke.

## Implementation Approach

Follow `/10x-ui` phase order: library → token values → one view → states. Each later phase depends on the earlier one. Token values come before the view, so the view migration is a no-op visually rather than a regression. The view is extracted into a props-driven component so the kitchen sink can render every state without Supabase. The guard comes last, scoped to the two files this change cleans.

## Critical Implementation Details

- **Ordering:** Phase 2 must land before any literal in the view is swapped. Swapping first gives dark text on dark background (C2).
- **Card under Astro:** `Card` is a React component rendered from `.astro` without a `client:` directive, which makes it static HTML. Astro wraps children in `astro-slot`/`astro-static-slot` (`display: contents`), so flex/gap from `Card` still apply. Verify by screenshot rather than assumption.

## Phase 1: Library and recorded values

### Overview

Add the one missing shared component and record the value source in the repo before editing any token.

### Changes Required:

#### 1. shadcn card

**File**: `src/components/ui/card.tsx` (generated)

**Intent**: Provide the shared panel component that replaces the glass panel copied 3× (C3).

**Contract**: Added via `npx shadcn@latest add card` (uses existing `components.json`, new-york). No manual edits to the generated file. No second `shadcn init`.

#### 2. Theme values record

**File**: `context/changes/dashboard-ui-tokens/theme-values.md`

**Intent**: Record the de-facto cosmic palette and its token mapping so the values don't live only in chat.

**Contract**: A table mapping each role token to its value and its source literal. Source: the literals in `dashboard.astro` / `global.css:113-115` at commit `576141a`, with Tailwind v4 default palette oklch values. Mapping (`.dark`):

| Token | Value | From literal |
| --- | --- | --- |
| `--background` | `#0a0e1a` | `bg-cosmic` stop 1/3 |
| `--background-glow` (new) | `#0f1529` | `bg-cosmic` stop 2 |
| `--foreground`, `--card-foreground`, `--primary-foreground` | `oklch(1 0 0)` | `text-white` |
| `--card` | `oklch(1 0 0 / 10%)` | `bg-white/10` |
| `--muted`, `--secondary`, `--accent` | `oklch(1 0 0 / 5%)` / `10%` / `10%` | `bg-white/5`, `hover:bg-white/10` |
| `--muted-foreground` | `oklch(0.932 0.032 255.585 / 80%)` | `text-blue-100/80` |
| `--primary` | `oklch(0.558 0.288 302.321)` | `bg-purple-600` |
| `--ring` | `oklch(0.714 0.203 305.504)` | (purple-400, chosen for contrast on dark) |
| `--border` / `--input` | keep shadcn `.dark` (`10%` / `15%` white) | `border-white/10`, `/20` |
| `--destructive` | keep shadcn `.dark` `oklch(0.704 0.191 22.216)` | replaces `red-300`/`red-900` |

### Success Criteria:

#### Automated Verification:

- `src/components/ui/card.tsx` exists and exports `Card`, `CardHeader`, `CardTitle`, `CardContent`
- `context/changes/dashboard-ui-tokens/theme-values.md` exists with the mapping table and a source line
- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- `/dashboard` renders unchanged (no consumer of `card.tsx` yet)

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Token values and theme layer

### Overview

Make the active tokens be the cosmic palette: write the values into `.dark`, switch `.dark` on, and make `bg-cosmic` read tokens (C2, C1 source, C5 `lang`).

### Changes Required:

#### 1. `.dark` values and `bg-cosmic`

**File**: `src/styles/global.css`

**Intent**: Replace the `.dark` values listed in `theme-values.md`. Add `--background-glow` to both `:root` (equal to `--background`, so the light gradient is flat) and `.dark`, and publish it in `@theme inline`. Rewrite `@utility bg-cosmic` to use `var(--background)` / `var(--background-glow)` instead of hex. Add a one-line comment above `.dark` naming `context/changes/dashboard-ui-tokens/theme-values.md` as the value source.

**Contract**: No raw colours inside `@theme inline`. `bg-cosmic` keeps its name and gradient direction, so the 5 other views that use it change no markup. `:root` values other than the new token are untouched.

#### 2. Theme and language on `<html>`

**File**: `src/layouts/Layout.astro`

**Intent**: Apply `.dark` at the root so tokens resolve to the dark set, and declare Polish content for assistive tech (C5).

**Contract**: `<html lang="pl" class="dark">`. No other Layout changes.

### Success Criteria:

#### Automated Verification:

- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- `grep -nE '#[0-9a-fA-F]{3,8}' src/styles/global.css` shows hex only inside `:root`/`.dark` value lines (not in `@utility bg-cosmic` or `@theme inline`)

#### Manual Verification:

- Screenshots of `/dashboard`, `/auth/signin` and `/dashboard/workouts/new` at desktop and 375 px look the same as before the change (gradient and glass cards unchanged)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Dashboard view on tokens and components

### Overview

Rebuild the one view from tokens and repo components, behind a props-driven component the kitchen sink can reuse (C1, C3, C5).

### Changes Required:

#### 1. View component

**File**: `src/components/dashboard/DashboardView.astro` (new)

**Intent**: Own all dashboard markup, built only from role-token classes, `Card` and `buttonVariants`. Fix the document order so the page heading comes first.

**Contract**: Props `{ email: string | undefined; weeklyLoad: number | null; workouts: Workout[]; listError: string | null }`. The formatters (`loadFormatter`, `distanceFormatter`, `formatDate`) move here unchanged. DOM order: `h1` "Twoje treningi" → account line + sign-out form → load panel → "Dodaj trening" CTA → `h2` "Ostatnie 7 dni" → list / empty / error. Container is `Card` on `bg-cosmic`. The load panel and list items use token classes (`bg-muted border rounded-lg`). The sign-out button uses `buttonVariants({ variant: "outline", size: "sm" })`, and the CTA `<a>` uses `buttonVariants()` plus `w-full`, merged with `cn()`. Keep `data-testid="weekly-load"` with the formatted number as direct text, the exact empty-state string and the distance format.

#### 2. Page

**File**: `src/pages/dashboard.astro`

**Intent**: Keep data loading in the page and render `DashboardView`.

**Contract**: Frontmatter data logic (`:9-23`) is unchanged. The template is `<Layout title="Twoje treningi"><DashboardView … /></Layout>`. The page has no classes left.

### Success Criteria:

#### Automated Verification:

- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- The hardcoded-value scan from `/10x-ui` on `src/pages/dashboard.astro src/components/dashboard/DashboardView.astro` returns 0 lines (was 13)
- `npm run smoke` passes against `npm run dev` with local Supabase (covers the weekly-load pattern, the empty-state string and the distance)

#### Manual Verification:

- `/dashboard` at desktop and 375 px: same visual hierarchy as before, CTA in primary, the `h1` is the first heading (check the headings list in devtools Accessibility)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: States and visual gate

### Overview

Cover the 7-state matrix and build the kitchen sink that shows it (C4).

### Changes Required:

#### 1. Error and empty states

**File**: `src/components/dashboard/DashboardView.astro`

**Intent**: The error is announced and token-driven, and the empty state offers the next action.

**Contract**: Error: `role="alert"`, `border-destructive/30 bg-destructive/10 text-destructive`, message unchanged. Empty: the exact string `Brak treningów z ostatnich 7 dni.` plus a link to `/dashboard/workouts/new` styled with `buttonVariants({ variant: "link" })`. Every interactive element shows the `ring-ring` focus-visible ring (from `buttonVariants`). Nothing relies on the global `outline-ring/50` alone.

#### 2. Kitchen sink

**File**: `src/pages/dev/kitchen-sink/dashboard.astro` (new)

**Intent**: Render `DashboardView` in every applicable state side by side as the visual gate.

**Contract**: Returns 404 unless `import.meta.env.DEV`. The path is not under `PROTECTED_ROUTES`, and no data is fetched. It renders fixtures for: default (3 workouts), empty (0 workouts, load 0), error (`listError` set, load `null`), plus a labelled strip of the sign-out button and CTA in forced hover / disabled appearance (disabled via the `disabled` attribute on a `buttonVariants` button). Matrix:

| State | Shown as |
| --- | --- |
| default | fixture with 3 workouts |
| hover | strip, plus a live hover in the screenshot pass |
| focus-visible | live Tab pass, screenshot of the focused CTA and sign-out |
| disabled | strip only. N/A in the live view: no control in the view has a disabled condition (SSR form, no pending state) |
| error | fixture with `listError` |
| empty | fixture with 0 workouts |
| loading | N/A: data arrives during SSR (`dashboard.astro:18`); there is no client fetch to wait on |

#### 3. Screenshots

**File**: `context/changes/dashboard-ui-tokens/screenshots/` (new)

**Intent**: Evidence for review: kitchen sink at desktop (1280 px) and 375 px, and the focused CTA.

**Contract**: PNG files named `kitchen-sink-desktop.png`, `kitchen-sink-375.png`, `focus-cta.png`.

### Success Criteria:

#### Automated Verification:

- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- Hardcoded-value scan on the two view files plus `src/pages/dev/kitchen-sink/dashboard.astro` returns 0 lines
- `npm run smoke` passes (empty-state string still asserted)
- `curl` of `/dev/kitchen-sink/dashboard` on `npm run preview` returns 404

#### Manual Verification:

- Kitchen sink shows every matrix row (or its N/A note) at desktop and 375 px. Screenshots saved
- Tab through `/dashboard`: focus ring visible on sign-out, CTA and the empty-state link, with contrast that is readable on the gradient
- The error block is announced as an alert (devtools Accessibility shows role `alert`)

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Guard

### Overview

Leave a rule and a failing check so the next agent stays on the contract.

### Changes Required:

#### 1. Agent rule

**File**: `AGENTS.md`

**Intent**: Tell the next agent where tokens and components live and forbid literals in views.

**Contract**: A new `## UI` section (after `## Style`). Tokens: `src/styles/global.css` (values in `:root`/`.dark`, published via `@theme inline`; the app runs `.dark`). Components: check `src/components/ui/` before creating one, and add missing ones via `npx shadcn@latest add <name>`. Rule: no palette classes, hex/rgb/oklch or arbitrary values in views; use role tokens. Gate: kitchen sink at `/dev/kitchen-sink/dashboard`, and `npm run lint:ui` enforces the cleaned files. No rule inviting one-off values exists today, so there is nothing to remove.

#### 2. Check script

**File**: `scripts/check-ui-literals.mjs` (new), `package.json`

**Intent**: Fail fast when a literal reappears in a cleaned view.

**Contract**: Node script with no dependencies. It holds an explicit file list (`src/pages/dashboard.astro`, `src/components/dashboard/DashboardView.astro`, `src/pages/dev/kitchen-sink/dashboard.astro`) and the `/10x-ui` regex, prints `file:line: match` per hit and exits 1 on any hit. `package.json`: script `"lint:ui": "node scripts/check-ui-literals.mjs"`. The `lint-staged` `*.{ts,tsx,astro}` entry gains `npm run lint:ui` (whole list, not staged paths).

#### 3. CI

**File**: `.github/workflows/ci.yml`

**Intent**: Enforce the check on push/PR.

**Contract**: Job `ci` gains `- run: npm run lint:ui` after `npm run lint`.

### Success Criteria:

#### Automated Verification:

- `npm run lint:ui` exits 0
- Temporarily adding `text-blue-500` to `DashboardView.astro` makes `npm run lint:ui` exit 1 with a `file:line` report (revert afterwards)
- CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- `AGENTS.md` `## UI` reads correctly and sits outside any `@przeprogramowani/10x-cli` block
- A commit touching an `.astro` file runs `lint:ui` through the pre-commit hook

---

## Testing Strategy

### Unit Tests:

- None. The repo has no unit suite (`AGENTS.md` Testing), and this change adds no logic.

### Integration Tests:

- `npm run smoke` after Phases 3 and 4: the anonymous redirect, the populated dashboard (distance plus `weekly-load` pattern) and the empty dashboard (string plus load `0`).

### Manual Testing Steps:

1. `npm run dev`, sign in, open `/dashboard`, and compare with the pre-change screenshots at 1280 px and 375 px.
2. Tab from the top of the page: sign-out → CTA → (empty) link. The ring is visible on each.
3. Open `/dev/kitchen-sink/dashboard` and check each matrix row.
4. Unset `SUPABASE_URL` in `.dev.vars`: the error block appears as `alert` with token colours, and the Banner still shows (deferred styling).

## Performance Considerations

None. Static SSR markup, no added client JS (`Card` and `buttonVariants` render server-side).

## Migration Notes

Switching `.dark` on is global. The other `bg-cosmic` views keep their literal classes, so only token-driven parts change (body background behind `bg-cosmic min-h-screen`, `ui/button` inside `SubmitButton`, which overrides colour). Phase 2 manual screenshots cover `signin` and `workouts/new` for this reason. Rollback: revert the Phase 2 commit.

## References

- Research: `context/changes/dashboard-ui-tokens/research.md` (charges C1–C5, deferred list)
- Skill contract: `.claude/skills/10x-ui/SKILL.md`, checklist `.claude/skills/10x-ui/references/ui-quality-checklist.md`
- Token source: `src/styles/global.css:6-124`
- Component pattern: `src/components/ui/button.tsx:7-37`
- Smoke assertions: `scripts/smoke.mjs:47-48`, `:116`, `:148`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Library and recorded values

#### Automated

- [x] 1.1 `src/components/ui/card.tsx` exists and exports `Card`, `CardHeader`, `CardTitle`, `CardContent` — 054fa9f
- [x] 1.2 `context/changes/dashboard-ui-tokens/theme-values.md` exists with the mapping table and a source line — 054fa9f
- [x] 1.3 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build` — 054fa9f

#### Manual

- [x] 1.4 `/dashboard` renders unchanged (no consumer of `card.tsx` yet) — 054fa9f

### Phase 2: Token values and theme layer

#### Automated

- [x] 2.1 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- [x] 2.2 Hex in `global.css` only inside `:root`/`.dark` value lines

#### Manual

- [x] 2.3 Screenshots of `/dashboard`, `/auth/signin`, `/dashboard/workouts/new` at desktop and 375 px look the same as before

### Phase 3: Dashboard view on tokens and components

#### Automated

- [ ] 3.1 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- [ ] 3.2 Hardcoded-value scan on `dashboard.astro` + `DashboardView.astro` returns 0 lines (was 13)
- [ ] 3.3 `npm run smoke` passes against `npm run dev` with local Supabase

#### Manual

- [ ] 3.4 `/dashboard` at desktop and 375 px: same hierarchy, CTA in primary, `h1` is the first heading

### Phase 4: States and visual gate

#### Automated

- [ ] 4.1 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`
- [ ] 4.2 Hardcoded-value scan on the view files plus kitchen sink returns 0 lines
- [ ] 4.3 `npm run smoke` passes (empty-state string still asserted)
- [ ] 4.4 `/dev/kitchen-sink/dashboard` returns 404 on `npm run preview`

#### Manual

- [ ] 4.5 Kitchen sink shows every matrix row (or N/A note) at desktop and 375 px; screenshots saved
- [ ] 4.6 Focus ring visible on sign-out, CTA and empty-state link, readable on the gradient
- [ ] 4.7 Error block exposed with role `alert`

### Phase 5: Guard

#### Automated

- [ ] 5.1 `npm run lint:ui` exits 0
- [ ] 5.2 Injected `text-blue-500` makes `npm run lint:ui` exit 1 with a `file:line` report (reverted)
- [ ] 5.3 CI gate passes: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual

- [ ] 5.4 `AGENTS.md` `## UI` reads correctly and sits outside any 10x-cli managed block
- [ ] 5.5 Pre-commit hook runs `lint:ui` on an `.astro` commit
