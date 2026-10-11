---
change_id: testing-data-isolation-and-access
title: Testing data isolation and access
status: impl_reviewed
created: 2026-10-11
updated: 2026-10-11
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Izolacja danych i dostęp".
Risks covered: #1 (user B reads/writes user A's workouts, incl. IDOR with forged owner), #2 (new migration silently weakens isolation: table without RLS or wrong role/operation policy), #4 (anonymous user reaches training data or writes via an unprotected new route). Test types planned: integration (local Supabase + HTTP); bootstrap the test runner.
Risk response intent:
- #1: prove B gets empty/denied on read, insert-as-A, update and delete of A's workouts at the database level, not only in rendered HTML; no mocking of the Supabase client.
- #2: prove every public-schema table has RLS enabled and no anon policies, discovered from the catalog (not a hardcoded table list), so a new table without RLS fails the test.
- #4: prove an anonymous request to every dashboard route and data API gets a redirect/401, never data or a write, including routes added later.
