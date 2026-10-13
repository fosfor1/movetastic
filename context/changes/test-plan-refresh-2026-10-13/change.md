---
change_id: test-plan-refresh-2026-10-13
title: Refresh the test plan after E2E setup, hooks and the sparse-profile interview
status: implementing
created: 2026-10-13
updated: 2026-10-13
archived_at: null
---

## Notes

Refresh context/foundation/test-plan.md (last reviewed 2026-10-11). Do not rewrite §1/§2 without the user's explicit approval per item; the final sub-phase updates §3 status and §6 cookbook.

Stale in the guide:
- §4: test baseline profile says "none" -> now "sparse" (Vitest projects integration (3 files) + hooks (1); Playwright 1.64 with 3 files in tests/e2e; nothing for domain logic). e2e row says "none — świadomie" -> Playwright exists (setup project + storageState, seed auth-gate-roundtrip, workout-log-roundtrip spec), recorded in context/foundation/test-stack.md ## E2E. Stack grounding: playwright-cli 0.1.22 available; Context7/Exa/Playwright MCP not available; Cloudflare MCP + claude-in-chrome available; checked: 2026-10-13.
- §5: post-edit hook is wired (per-edit lint + end-of-turn hook, commit c3c172c), not "recommended after Phase 4". Integration and E2E tests are still NOT in CI (ci.yml runs lint/lint:ui/check/build + smoke only).
- §3: Phase 4 "Bramki jakości" is partly delivered (hook half); its remaining scope is the CI gate. Phase 2 is "change opened" (testing-load-and-validation-rules).
- §6: no E2E cookbook pattern (seed pattern, auth via storageState, cold-server run, asserted cleanup via local DB when no delete route exists).

Interview 2026-10-13 (sparse profile):
- Q1 worries most: skipped.
- Q2 burned before: "The E2E test went green against an old preview build because the server kept running in the background." -> new risk candidate: false-green run from a reused stale server (local reuseExistingServer / leftover preview daemon); response intent: prove a run cannot pass against a build older than the working tree; cheapest layer: gate/process (cold-server rule, CI never reuses); anti-pattern: trusting a green run without a deliberate-break check.
- Q3 changed without confidence: "The workout form and POST /api/workouts: validation lives in two places (React and the API)." -> raise likelihood of #6 (Low -> Medium); add must-challenge "client validation passing = server enforces the same rule"; research must verify whether form and API share one rule source and where they can drift.
- Q4 scariest gap: "None of these tests run in CI. Locally green, but nobody ever runs them." -> consider re-ordering: move the CI-gate part of Phase 4 ahead of Phases 2-3 (needs local Supabase in CI, already used by the smoke job); E2E needs a CI test user via secrets/seed.
- Q5 do NOT spend on: "Testing the hooks in .claude/hooks/. They're tooling, not the product." -> add to §7; conflicts with existing tests/hooks/agent-hooks.test.ts + npm run test:hooks — ask the user: keep as-is (no new budget) or remove.

Also decide: add the browser-level flow "logged workout reaches the 7-day list and survives reload" (workout-log-roundtrip, chosen by the user in /10x-e2e on 2026-10-13) to §2/§3 as e2e-covered, or keep it as a standalone spec outside the plan.

Hot-spot scan (30d, scope src/, scripts/, supabase/migrations/, tests/): 12 commits in code scope; top dirs src/components/auth (7), src/pages/api (5), src/pages/auth (3); top files src/pages/dashboard.astro (5), scripts/smoke.mjs (4); tests/ 3 commits, each file touched once (no rewrite churn). No code churn since 2026-10-11.
After creating the folder, follow the downstream continuation rule.
