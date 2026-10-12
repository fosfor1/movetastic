---
date: 2026-10-11T16:12:20+02:00
researcher: Claude (Opus 5.5) dla Sebastian Kowalski
git_commit: f3fdabc14bd526f345dec9bfa7e1f12c759a982d
branch: m3-quality
repository: movetastic
topic: "Ugruntowanie fazy 1 test-plan.md: izolacja danych i dostęp (ryzyka #1, #2, #4) + bootstrap runnera"
tags: [research, testing, rls, supabase, middleware, vitest, pgtap]
status: complete
last_updated: 2026-10-11
last_updated_by: Claude (Opus 5.5)
---

# Research: izolacja danych i dostęp (faza 1 planu testów)

**Date**: 2026-10-11T16:12:20+02:00
**Researcher**: Claude (Opus 5.5) dla Sebastian Kowalski
**Git Commit**: f3fdabc14bd526f345dec9bfa7e1f12c759a982d
**Branch**: m3-quality
**Repository**: movetastic

## Research Question

Ugruntować w kodzie ryzyka #1, #2 i #4 z `context/foundation/test-plan.md` §2 (wpis w `change.md`):
gdzie naprawdę przebiega ścieżka awarii, czy wskazówki odpowiedzi z §2 są trafne, jakie testy
już istnieją, jaka jest najtańsza użyteczna warstwa i jak postawić runner testów.

## Summary

- **#1 (B czyta/zapisuje dane A).** Jedyną barierą jest RLS na `public.workouts`. Odczyt na dashboardzie
  nie filtruje po `user_id` (`src/lib/workouts.ts:23-29`), więc po zepsuciu polityki dashboard
  pokaże cudze dane. Aplikacja nie przyjmuje `user_id` z formularza (`src/pages/api/workouts.ts:28-33`,
  `:42`), więc „IDOR z podstawionym właścicielem” przez API aplikacji nie istnieje. Realna powierzchnia
  to bezpośrednie wywołanie PostgREST z JWT użytkownika B. Test musi uderzać w bazę przez supabase-js
  z sesją B, a nie w formularz.
- **Pułapka wyroczni dla #1.** Według komentarza w migracji (`supabase/migrations/20261003120000_create_workouts.sql:29`)
  brak polityk update/delete oznacza odmowę. W Postgres RLS taka odmowa przy UPDATE/DELETE to
  **0 zmienionych wierszy bez błędu**, a przy SELECT pusty wynik. Test, który sprawdza tylko „nie było
  błędu” albo „B widzi pustą listę”, przejdzie też wtedy, gdy nic nie zostało zapisane. Potrzebna jest
  kontrola pozytywna: A widzi swój wiersz, a po próbie B wiersz A jest nadal niezmieniony.
- **#2 (migracja osłabia izolację).** Dziś jest dokładnie jedna tabela i dwie polityki, obie `to authenticated`
  (`migration:15-27`). Strażnika katalogowego jeszcze nie ma. Najtańsze opcje: (a) `supabase db advisors`
  (lint `0013_rls_disabled_in_public`, może wywrócić CI), (b) zapytanie do `pg_class`/`pg_policies`
  w teście. Advisor nie sprawdza „brak polityk dla anon”, więc sam nie pokrywa całej wskazówki §2.
- **#4 (anonim dociera do danych).** Middleware chroni tylko prefiks `/dashboard` (`src/middleware.ts:4`, `:18-22`).
  `/api/*` nie jest objęte, a `/api/workouts` broni się własnym sprawdzeniem `locals.user` (`src/pages/api/workouts.ts:12-15`).
  Założenie z §2 „prefiks chroni wszystko” jest więc fałszywe dla API. Nowy endpoint danych bez
  ręcznego sprawdzenia byłby otwarty dla anonima; ochroni go wtedy tylko RLS (brak polityk `anon`).
- **Runner.** Rekomendowany kierunek: Vitest 5 w Node. Testy RLS rozmawiają z lokalnym Supabase przez
  `@supabase/supabase-js`, bez importu kodu aplikacji (omija `astro:env`). Test tras anonimowych
  idzie po HTTP do działającego serwera (jak smoke). Alternatywa dla #1/#2: pgTAP przez `supabase test db`.

## Detailed Findings

### Ryzyko #1 — izolacja między użytkownikami

- Polityki: `workouts_select_own` (select, `to authenticated`, `using auth.uid() = user_id`) i
  `workouts_insert_own` (insert, `to authenticated`, `with check auth.uid() = user_id`)
  (`supabase/migrations/20261003120000_create_workouts.sql:18-27`). Nie ma polityk update ani delete
  (`:29`). Archiwum potwierdza, że to celowa decyzja: edycja (FR-005) jest odłożona
  (`context/archive/2026-10-03-log-completed-workout/plan.md:37`, `:80`).
- `user_id` ma `default auth.uid()` (`migration:6`), ale aplikacja i tak wysyła `user_id` jawnie,
  z `locals.user.id` (`src/lib/workouts.ts:56-61`, `src/pages/api/workouts.ts:42`). Pola formularza to
  tylko `workout_date`, `distance_km`, `avg_heart_rate` (`src/pages/api/workouts.ts:28-33`).
- Odczyt: `listRecentWorkouts` filtruje tylko po dacie (`src/lib/workouts.ts:23-29`). Izolację
  zapewnia wyłącznie RLS. Komentarz w `src/lib/workouts.ts:1` mówi to wprost, podobnie archiwum
  (`log-completed-workout/plan-brief.md:48`: „Isolation is enforced by RLS, not by application filters”).
- Klient: request-scoped `createServerClient` z kluczem `SUPABASE_KEY` i ciasteczkami sesji
  (`src/lib/supabase.ts:5-20`). W kodzie nie ma klienta uprzywilejowanego, a `deploy-plan.md:43`
  zakazuje klucza service_role.
- Istniejące pokrycie: smoke sprawdza tylko HTML. B widzi pusty stan i nie widzi dystansu A
  (`scripts/smoke.mjs:145-149`). Zapisu, update ani delete B na wierszach A smoke nie sprawdza.
- Ślad ręcznego testu: `supabase/snippets/Untitled query 118.sql:1-2` (lokalny snippet ze Studio,
  gitignored przez `supabase/.gitignore`) wstawia wiersz z losowym `user_id` i `distance_km = 500`.
  Studio działa jako rola uprzywilejowana, więc taki snippet sprawdza CHECK, a nie RLS.

**Weryfikacja wskazówki §2 #1:**
- „insert z cudzym właścicielem”: zachować, ale tylko na poziomie PostgREST (sesja B, `user_id = A`).
  Przez API aplikacji nie da się tego wyrazić.
- „update i delete”: zachować. Oczekiwanie to brak zmiany stanu wiersza A, a nie błąd.
- Antywzorzec do dopisania: asercja na braku błędu / pustym wyniku bez kontroli pozytywnej.

### Ryzyko #2 — migracja osłabia izolację

- Dziś w `supabase/migrations/` jest dokładnie jeden plik (`20261003120000_create_workouts.sql`), więc w schemacie
  `public` jest jedna tabela z RLS (`migration:15`). Widoków i funkcji w tym pliku nie ma.
- AGENTS.md wymaga RLS i polityk per operacja/rola dla każdej nowej tabeli (reguła procesowa, bez
  automatu).
- Narzędzia (sprawdzone 2026-10-11, raport agenta, źródła poniżej):
  - `supabase db advisors --local --type security --fail-on error` uruchamia lintery splinter,
    w tym `0013_rls_disabled_in_public` i `0010_security_definer_view`. Flagi potwierdzono w lokalnym
    `--help` CLI v2.117.0. Strona dokumentacji CLI nie zwróciła treści, a poziom ERROR dla 0013 jest
    niezweryfikowany (https://github.com/supabase/splinter).
  - `supabase db lint` to tylko `plpgsql_check`. Nie wykrywa braku RLS.
  - Zapytania katalogowe: `pg_class.relrowsecurity` dla `relkind in ('r','p')` w `public`;
    `pg_policies` (kolumny `roles`, `cmd`) dla polityk `anon`/`public`; widoki z `reloptions` bez
    `security_invoker`.
- Dostęp do katalogu z testu wymaga bezpośredniego połączenia z Postgresem (lokalnie port 54322,
  `supabase/config.toml:29`). PostgREST nie wystawia `pg_catalog`. Opcje: sterownik `pg`/`postgres`
  jako devDependency albo pgTAP (`supabase test db`, gdzie `tests.rls_enabled('public')` z helperów basejump).

**Weryfikacja wskazówki §2 #2:** trafna. Uzupełnienie: „brak polityk dla `anon`” powinno objąć też rolę
`public` (polityka bez `to` dotyczy wszystkich ról). Warto też dodać widoki bez `security_invoker`,
bo omijają RLS. Advisor nie sprawdza polityk `anon`, więc nie zastępuje testu katalogowego.

### Ryzyko #4 — dostęp anonimowy

- `PROTECTED_ROUTES = ["/dashboard"]`, dopasowanie przez `startsWith` (`src/middleware.ts:4`, `:18`).
  Bez użytkownika jest 302 na `/auth/signin` (`:19-21`).
- Trasy w `src/pages/` (pełna lista plików):
  - chronione prefiksem: `dashboard.astro`, `dashboard/workouts/new.astro`;
  - publiczne z założenia: `index.astro`, `auth/{signin,signup,confirm-email}.astro`, `api/auth/{signin,signup,signout}.ts`;
  - `dev/kitchen-sink/dashboard.astro`: w produkcji 404, w dev renderuje tylko fixtures (`:11-14`);
  - `api/workouts.ts`: poza prefiksem, sprawdza `locals.user` samo (`:12-15`), eksportuje tylko `POST` (`:9`).
- Archiwum potwierdza decyzję: „The middleware does not protect `/api/*`, so the endpoint must check
  `Astro.locals.user` itself” (`context/archive/2026-10-03-log-completed-workout/plan.md:12`).
- Istniejące pokrycie: smoke sprawdza anonimowy `/dashboard` → 302 i anonimowy POST `/api/workouts` → 302
  (`scripts/smoke.mjs:88-89`). Lista tras jest wpisana na sztywno, więc nowa trasa się prześlizgnie
  (dokładnie antywzorzec z §2).
- Container API Astro (`experimental_AstroContainer`) nie uruchamia middleware (wniosek z dokumentacji,
  https://docs.astro.build/en/reference/container-reference/). Nie nadaje się do tego ryzyka.

**Weryfikacja wskazówki §2 #4:** trafna, z korektą. „Must challenge” jest prawdziwym błędnym
założeniem: prefiks nie obejmuje `/api/*`. Odkrywanie tras powinno iść z systemu plików `src/pages/`
z jawną allowlistą tras publicznych, a nie z listy w teście. Test jednostkowy middleware sprawdziłby
tylko listę prefiksów, nie ręczne sprawdzenia w handlerach. Najtańsza warstwa z realnym sygnałem
to HTTP do działającego serwera.

### Bootstrap runnera i infrastruktura

- Profil: brak runnera, jedyny automat to `scripts/smoke.mjs` (`package.json` scripts; AGENTS.md §Testing).
- Vitest: najnowsze stabilne to 5.0.3, a Astro nadal dokumentuje `getViteConfig` z `astro/config`
  (https://docs.astro.build/en/guides/testing/). Zachowanie `astro:env/server` pod Vitestem w Node nie
  jest udokumentowane. Testy fazy 1 nie muszą importować kodu aplikacji, więc problem omijają.
- `@cloudflare/vitest-pool-workers` zmienił nazwę na `@cloudflare/vitest-plugin` (changelog 2026-08-19).
  Celuje w bindingi Workers, których projekt nie używa. Dla fazy 1 jest zbędny (ocena, nie dokumentacja).
- Użytkownicy testowi: `enable_confirmations = false` (`supabase/config.toml:209`), więc `auth.signUp`
  przez supabase-js z kluczem anon daje od razu sesję. Service role nie jest potrzebny: stan wiersza A
  sprawdza się, czytając jako A.
- CI: job `smoke` już startuje lokalny Supabase i wyciąga `API_URL`/`ANON_KEY`
  (`.github/workflows/ci.yml:40-43`) oraz serwuje preview na :4321 (`:52-54`). Testy integracyjne
  mogą tam dołączyć bez nowego joba. Konfiguracja CI należy do fazy 4 planu.
- Uwaga: smoke kopiuje logikę aplikacji (`scripts/smoke.mjs:13`, `:43`). Dla fazy 1 to nieistotne,
  bo izolacja nie wymaga liczenia wartości oczekiwanych.

## Code References

- `supabase/migrations/20261003120000_create_workouts.sql:6` — `user_id default auth.uid()`
- `supabase/migrations/20261003120000_create_workouts.sql:15-29` — RLS i dwie polityki; brak update/delete/anon
- `src/lib/workouts.ts:23-29` — odczyt bez filtra `user_id` (sam RLS)
- `src/lib/workouts.ts:56-61` — insert z jawnym `user_id`
- `src/pages/api/workouts.ts:12-15` — ręczne sprawdzenie sesji w API
- `src/pages/api/workouts.ts:28-33,42` — pola formularza; właściciel z sesji
- `src/middleware.ts:4,18-22` — lista prefiksów i przekierowanie
- `src/lib/supabase.ts:5-20` — klient request-scoped, `null` bez sekretów
- `scripts/smoke.mjs:88-89,145-149` — obecne pokrycie anonima i izolacji HTML
- `supabase/config.toml:29,209` — port DB, wyłączone potwierdzenia e-mail
- `.github/workflows/ci.yml:36-56` — job smoke z lokalnym Supabase

## Architecture Insights

- Model bezpieczeństwa ma dwie warstwy: middleware/handler odpowiada za „czy zalogowany”, a RLS za
  „czy twoje”. Kod aplikacji świadomie nie filtruje po właścicielu, więc RLS jest jedyną obroną
  warstwy „czy twoje”. To uzasadnia testy na poziomie bazy (#1, #2), a nie HTML.
- Ochrona tras jest opt-in w dwóch miejscach: lista prefiksów albo ręczny check w endpoincie. Test
  musi odkrywać trasy automatycznie, inaczej nie wykryje zapomnianej trasy.

## Historical Context (from prior changes)

- `context/archive/2026-10-03-log-completed-workout/plan.md:37,80` — tylko select/insert, edycja odłożona (FR-005).
- `context/archive/2026-10-03-log-completed-workout/plan.md:12` — `/api/*` poza middleware, endpoint sprawdza sesję sam.
- `context/archive/2026-10-03-log-completed-workout/plan.md:43` i `plan-brief.md:44` — testy RLS w pgTAP świadomie odłożone.
- `context/archive/2026-10-03-weekly-training-load/plan.md:36` — Vitest odłożony do Modułu 3.
- `context/foundation/roadmap.md:53` — nieaktualne: twierdzi, że brak tabel i polityk RLS (obecnie jest jedna tabela z dwiema politykami).
- `context/foundation/roadmap.md:44,89-100` — S-03 doda ekran sugestii; nie wiadomo, czy samopoczucie będzie zapisywane (możliwa nowa tabela, więc #2 jest realne).

## Related Research

Nie dotyczy (to pierwszy research testowy w projekcie).

## Open Questions

1. **Warstwa dla #1/#2:** Vitest + supabase-js (+ `pg` dla katalogu) czy pgTAP (`supabase test db`)?
   pgTAP jest najtańszy dla RLS (transakcja z rollbackiem, przełączanie ról w SQL), ale wprowadza drugi
   język testów. Vitest daje jeden runner, którego użyją też fazy 2–3. Decyzja dla `/10x-plan`.
2. **`supabase db advisors` jako bramka:** uzupełnia test katalogowy, ale poziom lintu 0013 i
   stabilność flag wymagają potwierdzenia przy implementacji. Podpięcie w CI należy do fazy 4.
3. **Wersja Node dla Vitest 5** względem `node-version: 22` w CI: nie sprawdzono.
4. **Sprzątanie danych testowych:** konta tworzone przez `signUp` zostają w lokalnej bazie (smoke robi to
   samo, a `supabase stop --no-backup` czyści CI). Lokalnie trzeba unikalnych e-maili per uruchomienie.

### Korekty do test-plan.md §2 (kandydaci do backportu)

- #1 Source/wording: „IDOR z podstawionym identyfikatorem właściciela” dotyczy bezpośredniego PostgREST
  z sesją B, nie API aplikacji (ono nie przyjmuje właściciela).
- #1 Anti-pattern: dodać „asercja na braku błędu / pustym wyniku bez kontroli pozytywnej (RLS przy
  update/delete zwraca 0 wierszy bez błędu)”.
- #2 Guidance: „brak polityk dla `anon`” powinno objąć też rolę `public`; dopisać widoki bez `security_invoker`;
  `supabase db advisors` jako tańszy uzupełniający sygnał (nie zastępuje testu polityk).
- #4 Must challenge potwierdzone: `/api/*` jest poza prefiksem; najtańsza warstwa to HTTP do serwera
  (Container API nie uruchamia middleware).
