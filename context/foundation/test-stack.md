# Test stack

## E2E

<!-- Written by /10x-e2e-setup. Re-run it to change this section; other skills only read it. -->

- runner: Playwright Test, @playwright/test 1.64.0
- config: playwright.config.ts
- single-spec command: npx playwright test tests/e2e/<name>.spec.ts
- full-suite command: npx playwright test
- base URL: http://localhost:4321
- port: 4321 (detected from the Astro default for `astro preview`; astro.config.mjs sets no port; override with E2E_PORT)
- web server command: npm run build && npm run preview -- --port $E2E_PORT; reuseExistingServer outside CI
- auth setup project: setup (tests/e2e/auth.setup.ts), credentials from E2E_USERNAME / E2E_PASSWORD in .env (local Supabase user; needs `npx supabase start`, recreate after `supabase db reset`)
- storageState: playwright/.auth/user.json (gitignored)
- seed: tests/e2e/seed.spec.ts — protects auth-gate-roundtrip: a signed-out visitor is redirected from /dashboard to /auth/signin and reaches the dashboard after signing in through the real form
- browser CLI: playwright-cli (0.1.22, default browser msedge via .playwright/cli.config.json), command skill at .claude/skills/playwright-cli/SKILL.md
- updated: 2026-10-13
