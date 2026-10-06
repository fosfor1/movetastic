---
date: 2026-10-06T21:45:15+02:00
researcher: Claude (Opus 5.5) for Sebastian Kowalski
git_commit: 576141a541f6bb55a28814c950368b2978a4ffb0
branch: m2l5-ui
repository: movetastic
topic: "UI audit of /dashboard against the design-system contract (tokens + shared components)"
tags: [research, ui, design-tokens, shadcn, dashboard, 10x-ui]
status: complete
last_updated: 2026-10-06
last_updated_by: Claude (Opus 5.5)
---

# Research: UI audit of `/dashboard` against the design-system contract

**Date**: 2026-10-06T21:45:15+02:00
**Researcher**: Claude (Opus 5.5) for Sebastian Kowalski
**Git Commit**: 576141a541f6bb55a28814c950368b2978a4ffb0 (working tree has uncommitted `.claude/` skill changes only; the files cited below are unmodified)
**Branch**: m2l5-ui
**Repository**: movetastic

## Research Question

The `/10x-ui` audit brief for one view, `/dashboard` (`src/pages/dashboard.astro`):

1. **Source → views:** where do values and shared components live, and which views actually read them?
2. **View → source:** for each literal in the view, which token or component should have covered it?
3. **Agent rules:** do `CLAUDE.md` or `AGENTS.md` contain UI instructions that caused the drift or would undo a fix?
4. **Entry points:** what does the user see when arriving logged out, with no data, with a broken backend, or straight from a link?

Output: 3–5 charges with file:line and user impact (`## Charges`).

## Summary

- **Value source.** It exists and is wired correctly, but nothing reads it. `src/styles/global.css:6-77` defines the shadcn neutral tokens in `:root` and `.dark`, and `@theme inline` publishes them as `--color-*` (`global.css:79-111`). In the 15 non-`ui/` view and component files checked, the role-class regex (`bg|text|border|ring|outline|fill` + `primary|muted|destructive|…`) finds 0 token classes. That includes `dashboard.astro`.
- **Shared components.** `src/components/ui/` contains `button.tsx` and `LibBadge.astro`. `Button` has one consumer, `SubmitButton.tsx:3`, and that consumer overrides the variant colour with `bg-purple-600 … text-white` (`SubmitButton.tsx:18`). `dashboard.astro` imports nothing from `ui/`.
- **The view.** The hardcoded-value scan finds 13 matching lines in `dashboard.astro`. The real palette is a de-facto dark "cosmic glass" theme spread across views as literals: `bg-cosmic` hex gradient (`global.css:113-115`), `white/10` surfaces, `blue-100/80` muted text, `purple-600` primary, and `red-*` errors.
- **Dark-theme mismatch.** The look is dark, but `<html>` never gets `.dark` (`Layout.astro:14`), so the active tokens are the light `:root` set. Swapping literals for tokens without first deciding the theme at the token layer would render dark text on the dark gradient.
- **Agent rules.** No rule encourages one-off values. There is also no UI rule beyond `cn()` and the shadcn add path (`AGENTS.md:11`, `AGENTS.md:16`), and nothing tells the next agent to use tokens.
- **Prior decision.** Two archived plans propagated the literal style as "the existing visual style" (`context/archive/2026-10-03-log-completed-workout/plan.md:11`, `context/archive/2026-10-03-weekly-training-load/plan.md:68`).

## Charges

| # | Category | Evidence (file:line) | Covering token / component | User impact |
| --- | --- | --- | --- | --- |
| C1 | Missing tokens | `dashboard.astro:44` (`bg-white/10 border-white/10 text-white`), `:46`/`:61`/`:89` (`text-blue-100/80`), `:65`/`:83` (`text-blue-100/60`), `:71` (`bg-purple-600 hover:bg-purple-500`), `:76` (`from-blue-200 to-purple-200`); `global.css:113-115` (`bg-cosmic` hex `#0a0e1a`/`#0f1529`) | `bg-card`/`text-card-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`/`text-primary-foreground`, `bg-background` (cosmic gradient becomes a token-backed utility) | Changing the brand or contrast means editing every view by hand. "Primary" is spelled `bg-purple-600` on 3 lines in `src/` (`dashboard.astro:71`, `SubmitButton.tsx:18`, `Welcome.astro:31`), so one missed file means a mismatched button. |
| C2 | Missing tokens + accidental architecture (theme layer) | `Layout.astro:14` (`<html lang="en">`, no `.dark`); `global.css:6-41` light `:root` is active; the view hand-paints dark via literals | Decide the theme at the token layer: either `class="dark"` on `<html>` plus `.dark` values mapped from the cosmic palette, or rewrite `:root` to the cosmic values | Without this, the C1 fix renders near-black `--foreground` text (`oklch(0.145 0 0)`) on the dark gradient, so the token migration breaks readability unless the theme is fixed first. |
| C3 | Missing shared component | `dashboard.astro:50-55` sign-out `<button>` and `:69-74` "Dodaj trening" `<a>` built from classes; `:60` and `:87` repeat the same `rounded-lg border-white/10 bg-white/5` panel, and `:44` is the same glass panel with `bg-white/10` | `buttonVariants()` from `ui/button.tsx` (works as a class string in `.astro`, no hydration); a shadcn `card` (`npx shadcn@latest add card`) for the load panel and list items | Custom controls have no `focus-visible` ring (`button.tsx:8` has one, these don't) and no disabled styling. Keyboard users get only the global `outline-ring/50` (`global.css:119`), whose 50 % light-grey ring is computed against the light theme. |
| C4 | Missing tokens (error/empty states) | `dashboard.astro:81` error uses `border-red-500/30 bg-red-900/30 text-red-300` with no `role`; `:83` empty state is one muted line; `Banner.astro:30-44` (rendered by `Layout.astro:20` on missing config) uses hex | `destructive` token (`global.css:23`/`:56`) with `role="alert"`; an empty state with a next action (link to `/dashboard/workouts/new`) | The error is signalled by colour only, so screen readers don't announce it. An empty dashboard shows "0" load plus a grey line, with the CTA above the heading rather than inside the empty state. |
| C5 | Accidental architecture (document structure) | `dashboard.astro:46-74` header, load panel and CTA come before the only `<h1>` at `:76`; `Layout.astro:14` `lang="en"` for Polish content | Order: `h1` → load → CTA → list (or a header region); `lang="pl"` | Screen-reader and heading navigation lands on "Twoje treningi…" after the main metric and action, which reflects the order features were added (the S-02 plan inserted the load "between the signed-in header and the button", archive plan:68). `lang="en"` makes screen readers pronounce Polish with English rules. |

**Deferred (not this view):** `Topbar.astro` (7 literal hits, English "Sign out") is rendered only by `Welcome.astro:18`, not by `/dashboard`. The other `bg-cosmic` views (`auth/signin.astro:9-10`, `signup.astro:9-10`, `confirm-email.astro:22-23`, `dashboard/workouts/new.astro:11-12`) and `SubmitButton.tsx:18` share the C1 pattern but are out of scope (one view per change). They inherit the tokens once global values exist. `Banner.astro` hex values are recorded under C4 but stay deferred unless the plan touches `Layout`.

## Detailed Findings

### Source → views

- Tokens: `:root` (`global.css:6-41`), `.dark` (`global.css:43-77`), published by `@theme inline` (`global.css:79-111`). The split is correct: no raw colours inside `@theme inline`. `@custom-variant dark (&:is(.dark *))` (`global.css:4`) means `.dark` must be on an ancestor.
- The one value outside the token system is `@utility bg-cosmic` with 3 hex stops (`global.css:113-115`). It is used by 6 files (grep `bg-cosmic` in `src/`).
- `components.json` declares style `new-york`, `baseColor: neutral`, `cssVariables: true`, `ui` alias `@/components/ui`, and css `src/styles/global.css`. This confirms an existing shadcn system that should be extended, not re-initialised.
- Token-class usage: 0 in each of the 15 view/component files listed above (regex over `src/pages`, `src/components` excluding `ui/`). `Button` is imported only by `SubmitButton.tsx:3`.

### View → source (`src/pages/dashboard.astro`)

- Lines 43–91 make up the whole template. Scan hits: 13 lines (the `/10x-ui` regex). No token classes.
- Data flow: SSR only. Supabase `null` sets `listError` (`:14-16`), the query error goes to `listError` (`:17-20`), and the load is hidden when `listError` is set (`:23`, `:59`).
- `data-testid="weekly-load"` (`:62-63`) is asserted by `scripts/smoke.mjs:47` via regex on the `>…<` content. The plan must keep that attribute and keep the number as the element's direct text.
- Rendering `Button` (React) from `.astro` with `asChild` is unlikely to work for the `<a>`, because Astro passes children as a static slot, not a React element for Radix `Slot` (inference, not executed). `buttonVariants({ variant, size })` used as a `class` string avoids that question.

### Agent rules

- `CLAUDE.md` contains only `@AGENTS.md` plus the 10x-ui course block. `AGENTS.md` UI-relevant lines: `:11` (`cn()`), `:16` (`ui/` is shadcn new-york, add via `npx shadcn@latest add`). No rule mentions tokens, literals, or arbitrary values in either direction. `.cursor/rules`, `.windsurfrules`, and `copilot-instructions.md` are not present.

### Entry points (the "what if" pass)

- **Logged out:** `/dashboard` is in `PROTECTED_ROUTES` (`middleware.ts:4`), so the user is redirected to `/auth/signin` (`middleware.ts:18-21`). No issue.
- **No data:** load renders `0` (`weeklyTrainingLoad([])`) plus "Brak treningów z ostatnich 7 dni." (`:83`). See C4.
- **Backend missing or failing:** the error paragraph (`:81`) appears, the load is hidden, and the CTA still shows. `Banner` also renders when config is missing (`Layout.astro:20`). See C4.
- **Loading:** N/A for this view. Data is fetched during SSR (`:18`) and there is no client fetch, so there is no in-page loading state to show.

## Code References

- `src/pages/dashboard.astro:43-91` — full template under audit
- `src/styles/global.css:6-41` / `:43-77` / `:79-111` / `:113-115` / `:117-124` — light values, dark values, theme publish, `bg-cosmic`, base layer
- `src/layouts/Layout.astro:14`, `:20` — `<html lang="en">` without `.dark`; `Banner` render
- `src/components/ui/button.tsx:7-37` — `buttonVariants` incl. focus-visible ring and disabled styles
- `src/components/auth/SubmitButton.tsx:18` — only `Button` consumer, colour overridden by literals
- `src/middleware.ts:4`, `:18-21` — `/dashboard` guard
- `scripts/smoke.mjs:47` — `weekly-load` assertion the change must keep

## Architecture Insights

- Contract variant: **existing shadcn system with a dead token file**. Phase 1 is "make the view read the tokens", but because the de-facto look is dark and the active tokens are light, the token *values* must be set (cosmic palette into `.dark`, with `.dark` applied) in the same phase or before it. Otherwise the migration is a visible regression.
- De-facto palette to fold into tokens (from the literals): background `#0a0e1a → #0f1529` gradient, surface `white/10` / `white/5`, border `white/10` / `white/20`, foreground `white`, muted fg `blue-100/80` (`/60` for tertiary), primary `purple-600` (hover `purple-500`), destructive text `red-300` on `red-900/30`, heading accent gradient `blue-200 → purple-200`.
- `.dark` on `<html>` in `Layout.astro` affects all pages that use `Layout`. The other `bg-cosmic` views paint with literals, so their appearance would change only where `body`/base-layer tokens show through (inference: `bg-cosmic min-h-screen` covers `body`'s `bg-background`).

## Historical Context (from prior changes)

- `context/archive/2026-10-03-log-completed-workout/plan.md:11` — named "`bg-cosmic` + glass card" as the visual style to reuse. Still accurate as a description of the look. This is where the literal pattern was adopted as precedent.
- `context/archive/2026-10-03-weekly-training-load/plan.md:68` — placed the load panel "between the signed-in header and the 'Dodaj trening' button, in the existing glass-card style". This is the source of the heading order in C5.
- `context/foundation/roadmap.md:51` — calls `/dashboard` "tylko placeholder". That is outdated: the view now lists workouts and shows the load.

## Related Research

Not applicable. No earlier `research.md` covers UI or tokens.

## Open Questions

1. **Theme decision (product):** keep the cosmic/purple look by mapping it into `.dark` and applying `.dark`, or adopt the neutral shadcn dark values? Recommendation: map the existing look, so the other `bg-cosmic` views stay consistent until their own changes.
2. Whether a shadcn `card` is worth adding for two panel types, or whether `bg-card border rounded-lg` token classes are enough. This is a plan-level choice.
3. The focus-ring contrast of `--ring` on the dark gradient has to be verified by screenshot after the token values change; it was not measured here.
