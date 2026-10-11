# Izolacja danych i dostęp (faza 1 planu testów) — Plan Brief

> Full plan: `context/changes/testing-data-isolation-and-access/plan.md`
> Research: `context/changes/testing-data-isolation-and-access/research.md`

## What & Why

Pierwsza faza wdrożenia `context/foundation/test-plan.md`: postawić runner testów i udowodnić ochronę przed trzema ryzykami o najwyższym wpływie — #1 użytkownik B czyta/zmienia treningi A, #2 nowa migracja cicho osłabia izolację, #4 anonim dociera do danych przez niechronioną trasę. Jedyną barierą „czy twoje” jest RLS, a ochrona tras jest opt-in w dwóch miejscach — dlatego testy muszą działać na prawdziwej bazie i serwerze oraz same odkrywać nowe tabele i trasy.

## Starting Point

Brak runnera; jedynym automatem jest `scripts/smoke.mjs`, który sprawdza izolację tylko na HTML i anonima tylko na 2 trasach wpisanych na sztywno. `public.workouts` ma RLS z politykami select/insert `to authenticated`; middleware chroni tylko prefiks `/dashboard`, a `/api/workouts` sprawdza sesję samo.

## Desired End State

`npm run test:integration` (przy `npx supabase start` i serwerze na `BASE_URL`) dowodzi: B przez PostgREST nie czyta, nie wstawia jako A, nie zmienia i nie usuwa wiersza A (sprawdzane stanem wiersza czytanym jako A); każda tabela/polityka/widok w `public` przechodzi strażnika katalogowego; każda odkryta niepubliczna trasa odmawia anonimowi. Cookbook §6.1–6.3 mówi, jak dodać kolejny taki test.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Warstwa #1/#2 | Vitest 5 + supabase-js + sterownik `postgres` | Jeden runner dla faz 1–3; #1 idzie tą samą drogą (PostgREST) co atakujący. | Plan |
| Wyrocznia #1 | Stan wiersza A czytany jako A, nie brak błędu | RLS przy update/delete zwraca 0 wierszy bez błędu. | Research |
| Serwer dla #4 | Zewnętrzny, `BASE_URL` jak smoke | Spójne ze smoke i jobem CI, bez zarządzania procesem. | Plan |
| Brak środowiska | Głośny błąd setupu, nigdy skip | Test bezpieczeństwa nie może przejść „na zielono” bez sprawdzenia. | Plan |
| Rygor strażnika #2 | RLS-off, polityki anon/public, polityki `true`, widoki bez `security_invoker`, widoki zmaterializowane + sonda w transakcji | Łapie najczęstszą „złą politykę” i dowodzi, że strażnik nie jest pusty. | Plan |
| Odmowa w #4 | 302→`/auth/signin` albo 401/403, każda wyeksportowana metoda | Akceptuje dzisiejszy redirect i przyszłe JSON-owe 401. | Plan |
| Odkrywanie tras | System plików `src/pages/` + allowlista publicznych z uzasadnieniem | Prefiks nie obejmuje `/api/*`; lista w teście przepuściłaby nową trasę. | Research |
| Skrypty | `test:integration` teraz, `npm test` = wszystkie projekty | Unit testy z fazy 2 nie będą wymagać Dockera. | Plan |
| Smoke | Bez zmian | CI nie traci sprawdzeń, zanim testy trafią do CI (faza 4). | Plan |
| `db advisors` | Tylko wpis w cookbooku §6.2 | Niezweryfikowany poziom lintu; bramki należą do fazy 4. | Plan |

## Scope

**In scope:**
- Vitest 5 + `postgres` jako devDependencies, `vitest.config.ts` z projektem `integration`, setup środowiska
- Testy: `rls-workouts`, `rls-catalog-guard`, `anonymous-access` w `tests/integration/`
- Cookbook §6.1–6.3 (+ §4, §6.6) i sekcja Testing/Commands w `AGENTS.md`

**Out of scope:**
- Zmiany kodu aplikacji, migracji, middleware i `scripts/smoke.mjs`
- Podpięcie w CI, bramki, hooki (faza 4); projekt `unit` (faza 2)
- pgTAP, mocki klienta Supabase, klucz service_role, sprzątanie kont testowych

## Architecture / Approach

`globalSetup` czyta `API_URL`/`ANON_KEY`/`DB_URL` z `npx supabase status -o env`, sprawdza Supabase i `BASE_URL`, przekazuje je przez `provide`/`inject`. #1: dwa konta z `signUp` (osobni klienci bez persystencji sesji) rozmawiają z PostgREST. #2: zapytania do `pg_class`/`pg_policies` przez `postgres`, funkcja przyjmuje wykonawcę, więc ta sama logika sprawdza sondę w transakcji z rollbackiem. #4: pliki `src/pages/` → (ścieżka, metody) → `fetch` bez ciasteczek z `Origin`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bootstrap + izolacja (#1) | Runner, setup fail-loud, helper kont, test RLS dla `workouts` | Kolizja sesji A/B w jednym procesie; asercja na braku błędu |
| 2. Strażnik katalogowy (#2) | Skan `public` z allowlistą i sondą | Sonda zostaje w bazie, jeśli nie działa w tej samej transakcji |
| 3. Anonim na trasach (#4) | Odkrywanie tras + sonda każdej metody | Brak `Origin` daje 403 z CSRF zamiast z braku sesji |
| 4. Cookbook i docs | §6.1–6.3, `AGENTS.md` | — |

**Prerequisites:** Docker + `npx supabase start`; serwer aplikacji na `BASE_URL` (`npm run dev` lub preview); Node ≥ 22.12.
**Estimated effort:** ~2 sesje w 4 fazach.

## Open Risks & Assumptions

- Zakładamy, że `supabase status -o env` zwraca `DB_URL` w używanej wersji CLI (^2.23 lokalnie, `latest` w CI).
- Heurystyka `policy-always-true` łapie tylko dosłowne `true`; subtelnie złe wyrażenia wykrywa dopiero test behawioralny jak #1.
- Do czasu fazy 4 testy nie działają w CI — chronią tylko lokalnie.

## Success Criteria (Summary)

- Trzy testy mutacyjne (polityka `using (true)`, tabela bez RLS, endpoint bez sprawdzenia sesji) dają czerwony wynik z nazwą obiektu.
- Bez Supabase/serwera `npm run test:integration` kończy się błędem, nigdy zielonym wynikiem.
- Nowa osoba dodaje test dla nowej tabeli lub trasy wyłącznie na podstawie §6.1–6.3.
