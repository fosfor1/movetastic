# Repository Guidelines

Movetastic is a web app that suggests a runner's workout for today based on recent training load (see `@context/foundation/prd.md`). Stack: Astro 7 SSR on Cloudflare Workers, React 19 islands, Tailwind 4, shadcn/ui, Supabase auth (`@context/foundation/tech-stack.md`).

## Hard Rules

- `createClient()` in `src/lib/supabase.ts` returns `null` when `SUPABASE_URL`/`SUPABASE_KEY` are unset; every caller must handle the `null` branch (pattern: `@src/pages/api/auth/signin.ts`).
- Read secrets only via `astro:env/server`; declare new ones in the `env.schema` of `@astro.config.mjs`. Never read secrets from `import.meta.env` or `process.env` (built-in flags like `import.meta.env.DEV` are fine).
- Protect a page by adding its path prefix to `PROTECTED_ROUTES` in `@src/middleware.ts`; the current user is `Astro.locals.user` (typed in `src/env.d.ts`).
- Never write to `context/archive/` — archived changes are immutable.
- Merge Tailwind classes with `cn()` from `@/lib/utils`; do not concatenate class strings.

## Project Structure

- `src/pages/` routes; `src/pages/api/` endpoints.
- `src/components/` Astro for static markup, React only for interactivity; `ui/` is shadcn (new-york), add via `npx shadcn@latest add <name>`.
- `src/lib/` services and helpers; shared types go in `src/types.ts`.
- `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`; enable RLS with per-operation, per-role policies on every new table.
- `context/foundation/` PRD, tech stack, and `lessons.md`.

## Commands

- `npm run dev` — dev server on the workerd runtime (secrets from `.dev.vars`).
- `npx astro sync && npm run lint && npx astro check && npm run build` — the CI gate; run before pushing.
- `npm run smoke` — auth-flow HTTP check against a running server (`BASE_URL`); needs Supabase with email confirmation off.

## Style

Formatting and lint (`@.prettierrc.json`, `@eslint.config.js`) run via husky/lint-staged on commit. No `"use client"` directives; put React hooks in `src/components/hooks/`.

## UI

- Tokens live in `src/styles/global.css`: values in `:root`/`.dark`, published as utilities via `@theme inline`. The app runs `.dark` (set on `<html>` in `src/layouts/Layout.astro`); where its values came from: `context/changes/dashboard-ui-tokens/theme-values.md`.
- Components: check `src/components/ui/` before creating one; add missing shadcn ones via `npx shadcn@latest add <name>`.
- No palette classes (`text-blue-500`, `bg-white`), hex/rgb/hsl/oklch literals or arbitrary values (`p-[13px]`) in views; use role tokens (`bg-card`, `text-muted-foreground`, `border-border`). A missing role goes into `global.css`, not the view.
- Gate: check states in the kitchen sink at `/dev/kitchen-sink/dashboard` (dev only); `npm run lint:ui` (`scripts/check-ui-literals.mjs`) enforces the cleaned files — add a view to its file list once it is cleaned.

## Testing

No unit test suite exists yet; `scripts/smoke.mjs` is the only automated check. Verify every change with the CI gate from Commands, and additionally run `npm run smoke` after changes to `src/middleware.ts`, `src/lib/supabase.ts`, or anything under `src/pages/api/auth/` or `src/pages/auth/`.

## CI & Commits

`.github/workflows/ci.yml` runs on push/PR to `master` (jobs `ci` and `smoke`). No commit history yet — commit convention is to be defined.
