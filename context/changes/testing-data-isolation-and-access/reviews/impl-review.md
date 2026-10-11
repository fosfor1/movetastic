<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Izolacja danych i dostęp (faza 1 planu testów)

- **Plan**: context/changes/testing-data-isolation-and-access/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-11
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Notes:
- **Scope Discipline:** the only EXTRA items are harmless. They are the extra `AGENTS.md` line on when to run `test:integration`, the prettier realignment of `test-plan.md`, and the extra controls in tests (all reported during implementation).
- **Success Criteria:** these were re-run during the review against the dev server on :4321. `npm test` passed 19/19; the CI gate passed with 0 errors and 0 warnings; prettier passed; no TBD remains in §6.1–6.3.

## Findings

### F1 — Update/delete denial tests can't detect an overly broad policy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/integration/rls-workouts.test.ts:83-99; tests/integration/helpers/rls-guard.ts:38
- **Detail**: When an UPDATE/DELETE has a `WHERE` or `RETURNING`, Postgres also applies the SELECT policies' USING clauses. As a result, `workouts_select_own` hides A's row from B no matter what the update/delete policy says.
  - Reproduced in a rolled-back transaction: the policy `for update to authenticated using (auth.uid() is not null)` was added. B's update filtered by `id` (what the test does) affected 0 rows, so the test stays green. The same update without a filter changed all 15 rows. The local DB has no safeupdate extension, so PostgREST would allow such a request.
  - The guard only catches the literal `qual = 'true'`.
  - This is a gap in the plan, which chose this oracle; it is not an implementation error. It becomes real with FR-005 (workout editing), which risk #2 cites.
- **Fix A ⭐ Recommended**: A new guard rule, `policy-not-owner-scoped`, flags any policy in `public` whose `qual`/`with_check` does not reference `auth.uid()`. It can be allowlisted, and the positive control gets a probe for it.
  - Strength: catalog-based, so it covers every table and future policies, including FR-005. It also closes the literal-only `true` gap (observation 6 from the review).
  - Tradeoff: it is a text heuristic. `auth.uid() = user_id OR true` would still pass, and a deliberate policy without `auth.uid()` needs an allowlist entry.
  - Confidence: HIGH — the current policies reference `auth.uid()`, so the rule passes today.
  - Blind spot: future policies based on helper functions (e.g. `is_owner(id)`) would need allowlist entries or a change to the rule.
- **Fix B**: In `rls-workouts.test.ts`, B also runs an update and a delete without a filter and without `.select()`, then checks that A's row is unchanged.
  - Strength: a behavioral test of the real attack through PostgREST, with no heuristic.
  - Tradeoff: if a policy is broken, the test modifies or deletes every row in the shared local DB, including other runs' data and smoke data. It also covers only `workouts`; each new table needs a copy.
  - Confidence: MED — it depends on PostgREST passing an unfiltered update through, which it does locally since safeupdate is absent.
  - Blind spot: not checked against the Supabase cloud configuration.
- **Decision**: PENDING

### F2 — CSRF 403 can pass as "denied" when Origin is malformed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/integration/anonymous-access.test.ts:14-33
- **Detail**: The `Origin` header and the Location comparison use `BASE_URL` as given. Reproduced against the server: `Origin: http://localhost:4321/` (trailing slash) gets 403 from Astro's CSRF check, while the exact origin gets 302→/auth/signin.
  - `isDenied` accepts 403, so a `BASE_URL` with a trailing slash, a path, or a different host name makes every POST probe "pass" even if the endpoint is unprotected. The absolute-Location check (`${baseUrl}/auth/signin`) breaks the other way, failing falsely.
  - Today no route returns 401/403 for a missing session.
- **Fix**: Normalize to `new URL(baseUrl).origin` in `global-setup.ts`, so all tests get a clean origin. Also add a control in `anonymous-access.test.ts`: a POST to a public `/api/auth/signin` with the same headers must not return 403, which proves the origin check is passed.
  - Strength: it closes the false green without changing the 401/403 contract chosen in the plan, and the control fails loudly whenever the CSRF check rejects the probe.
  - Tradeoff: one extra request; the control depends on `/api/auth/signin` staying public.
  - Confidence: HIGH — verified with curl against :4321.
  - Blind spot: proxies or URL rewriting in workerd were not tested.
- **Decision**: PENDING

### F3 — Anonymous insert accepts any error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/rls-workouts.test.ts:109-115
- **Detail**: `expect(error).not.toBeNull()` also passes on a network error, a schema error (PGRST204) or a 400. B's insert correctly pins `42501`.
- **Fix**: `expect(error?.code).toBe("42501")`, after confirming the code locally; an anon role without INSERT privilege also returns 42501.
- **Decision**: PENDING

### F4 — Positive control exercises only 3 of 5 guard rules

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/rls-catalog-guard.test.ts:40-64
- **Detail**: Nothing shows that `view-without-security-invoker` and `materialized-view` fire. A typo in the `reloptions` literal would go unnoticed.
- **Fix**: In the same rolled-back transaction, add `create view public.__rls_guard_probe_v as select 1` and `create materialized view public.__rls_guard_probe_mv as select 1`, and expect both violations.
- **Decision**: PENDING

### F5 — Guard skips foreign tables and SECURITY DEFINER functions

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: tests/integration/helpers/rls-guard.ts:26-49
- **Detail**: `relkind in ('r','p')` skips foreign tables (`'f'`). SECURITY DEFINER functions in `public`, which PostgREST exposes as RPC and which bypass RLS, are not scanned. Neither exists today, but both are classic ways around isolation in "a new migration" (risk #2).
- **Fix**: Add rules `foreign-table` (`relkind = 'f'`) and `security-definer-function` (`pg_proc.prosecdef` in `public`), both allowlistable, with probes in the positive control.
  - Strength: closes the two remaining ways to bypass RLS through PostgREST.
  - Tradeoff: goes beyond the plan's scope (the plan lists 5 rules); a future legitimate SECURITY DEFINER RPC will need an allowlist entry.
  - Confidence: MED — the catalog query is simple, but extensions installed into `public` could add noise (not checked).
  - Blind spot: not checked whether Supabase extensions create SECURITY DEFINER functions in `public`.
- **Decision**: PENDING

### F6 — Route discovery misses `export { … }`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/helpers/routes.ts:23
- **Detail**: The regex detects only `export const|function|async function NAME`. A file with `export const GET` plus `export { handler as POST }` would get GET probed but not POST, and the "≥1 method" control would not catch it.
- **Fix**: Also match `export\s*\{[^}]*\b(GET|POST|PUT|PATCH|DELETE|ALL)\b[^}]*\}`.
- **Decision**: PENDING

### F7 — Discovery control compares a joined method string

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/integration/anonymous-access.test.ts:36-40
- **Detail**: `toContain("POST /api/workouts")` is built from `methods.join(",")`. Adding GET to `/api/workouts` produces `"GET,POST /api/workouts"`, a false alarm (it fails red, not green).
- **Fix**: Compare (path, method) pairs from `probes` instead of joined strings.
- **Decision**: PENDING

### F8 — Global setup: no timeouts and the password in an error

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/integration/setup/global-setup.ts:13, :54, :60-70
- **Detail**:
  - `execSync("npx supabase status")` and the `fetch` calls have no timeout, and `hookTimeout` does not cover globalSetup, so a hung Docker hangs `vitest run`.
  - The Postgres error message includes the full `DB_URL` with the password; locally that is the default `postgres:postgres`.
  - Related: during the review the dev server returned 500 on every route, and the setup treated that as "server is up".
- **Fix**: Add `timeout: 30_000` to `execSync` and `AbortSignal.timeout(5000)` to the fetches. Log `new URL(dbUrl).host` instead of the URL. Optionally, fail when `GET /` returns 5xx, with a hint to run `npx astro dev --force`.
- **Decision**: PENDING
