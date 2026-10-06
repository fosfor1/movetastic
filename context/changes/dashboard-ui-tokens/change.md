---
change_id: dashboard-ui-tokens
title: Dashboard UI tokens
status: implementing
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Notes

UI change opened via `/10x-ui`.

- **View (one):** `/dashboard` (`src/pages/dashboard.astro`)
- **Token source:** `src/styles/global.css` (`:root` / `.dark` values, published via `@theme inline`); components in `src/components/ui/` (shadcn new-york, add via `npx shadcn@latest add <name>`).
- **Contract variant:** fresh starter with a dead token file. The view reads 0 token classes and has 13 hardcoded palette literals (pre-audit scan, 2026-10-06). Phase 1 makes the view read the tokens that already exist; do not pick a new theme first, and do not run a second `shadcn init`.
- **Open decision for research/plan:** the view fakes a dark theme with literals (`bg-cosmic`, `white/10`), while `<html>` has no `.dark` and the `:root` tokens are light. The theme choice has to be made at the token layer.
