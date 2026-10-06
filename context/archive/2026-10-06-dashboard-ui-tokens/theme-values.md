# Theme values — cosmic palette into `.dark`

**Source:** the de-facto palette painted as literals in `src/pages/dashboard.astro:43-91` and `@utility bg-cosmic` in `src/styles/global.css:113-115` at commit `576141a`. Tailwind palette classes are resolved to their oklch values from `node_modules/tailwindcss/theme.css` (tailwindcss ^4.2.4). These values target the `.dark` block of `src/styles/global.css`; `:root` (light) stays the shadcn neutral set.

| Token | `.dark` value | From literal |
| --- | --- | --- |
| `--background` | `#0a0e1a` | `bg-cosmic` stops 1 and 3 |
| `--background-glow` (new; `:root` = `var(--background)` value) | `#0f1529` | `bg-cosmic` stop 2 |
| `--foreground` | `oklch(1 0 0)` | `text-white` |
| `--card` | `oklch(1 0 0 / 10%)` | `bg-white/10` (glass container) |
| `--card-foreground` | `oklch(1 0 0)` | `text-white` |
| `--primary` | `oklch(0.558 0.288 302.321)` | `bg-purple-600` |
| `--primary-foreground` | `oklch(1 0 0)` | `text-white` on CTA |
| `--muted` | `oklch(1 0 0 / 5%)` | `bg-white/5` (load panel, list items) |
| `--muted-foreground` | `oklch(0.932 0.032 255.585 / 80%)` | `text-blue-100/80` |
| `--secondary` | `oklch(1 0 0 / 10%)` | `bg-white/10` (sign-out button) |
| `--accent` | `oklch(1 0 0 / 10%)` | `hover:bg-white/20` over glass (as hover layer) |
| `--ring` | `oklch(0.714 0.203 305.504)` | none (purple-400, chosen for focus contrast on the dark gradient) |
| `--border` | keep shadcn `.dark` `oklch(1 0 0 / 10%)` | `border-white/10` |
| `--input` | keep shadcn `.dark` `oklch(1 0 0 / 15%)` | `border-white/20` (nearest) |
| `--destructive` | keep shadcn `.dark` `oklch(0.704 0.191 22.216)` | replaces `text-red-300` (`oklch(0.808 0.114 19.571)`) on `bg-red-900/30` |

Not tokenised:
- Heading gradient `from-blue-200 to-purple-200`: dropped for `text-foreground` (plan, What We're NOT Doing).
- `hover:bg-purple-500` (`oklch(0.627 0.265 303.9)`): becomes `hover:bg-primary/90` from `buttonVariants`.
