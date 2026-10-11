# Izolacja danych i dostęp (faza 1 planu testów) — Implementation Plan

## Overview

Stawiamy runner testów (Vitest 5, projekt `integration`) i trzy zestawy testów integracyjnych, które dowodzą ochrony przed ryzykami #1, #2 i #4 z `context/foundation/test-plan.md` §2:
izolacja między użytkownikami na poziomie bazy, strażnik katalogowy RLS dla każdej (także przyszłej) tabeli oraz odmowa dla anonima na każdej (także przyszłej) chronionej trasie.
Kod aplikacji się nie zmienia. Faza kończy się uzupełnieniem cookbooka §6.1–6.3.

## Current State Analysis

- Brak runnera testów; jedynym automatem jest `scripts/smoke.mjs` (HTTP, bez zależności), uruchamiany w jobie CI `smoke` na lokalnym Supabase (`.github/workflows/ci.yml:24-56`).
- Model bezpieczeństwa ma dwie warstwy: „czy zalogowany” = middleware (tylko prefiks `/dashboard`, `src/middleware.ts:4,18-22`) albo ręczny check w endpoincie (`src/pages/api/workouts.ts:12-15`); „czy twoje” = wyłącznie RLS, bo odczyt nie filtruje po `user_id` (`src/lib/workouts.ts:23-29`).
- `public.workouts` ma RLS i dwie polityki `to authenticated` (select/insert, `supabase/migrations/20261003120000_create_workouts.sql:15-29`); brak polityk update/delete/anon — celowo (edycja FR-005 odłożona).
- Smoke sprawdza anonima tylko na 2 trasach wpisanych na sztywno (`scripts/smoke.mjs:88-89`) i izolację wyłącznie na HTML (`:145-149`).
- Lokalny Supabase: potwierdzenia e-mail wyłączone (`supabase/config.toml:209`), więc `auth.signUp` przez supabase-js od razu zwraca sesję; Postgres na porcie 54322 (`config.toml:29`).
- Vitest 5.0.3 wymaga Node `^22.12 || ^24` — lokalnie 24.19, CI `node-version: 22` (najnowsze 22.x) — zgodne.

## Desired End State

`npm run test:integration` (przy działającym `supabase start` i serwerze na `BASE_URL`) uruchamia trzy pliki testów, które:

1. Dowodzą, że sesja B przez PostgREST nie czyta wiersza A, insert z `user_id = A` jest odrzucony, a po próbie update/delete wiersz A jest nietknięty — każdorazowo z kontrolą pozytywną (A widzi swój wiersz, niezmieniony). Klient anonimowy nie czyta i nie zapisuje.
2. Skanują katalog Postgresa i wywracają się na: tabeli w `public` bez RLS, polityce dla `anon`/`public`, polityce z `using`/`with check` = `true`, widoku bez `security_invoker`, widoku zmaterializowanym — z jawną allowlistą z uzasadnieniem i kontrolą pozytywną (sonda w transakcji z rollbackiem jest wykryta).
3. Odkrywają trasy z `src/pages/`, odejmują allowlistę publicznych i dla każdej wyeksportowanej metody HTTP oczekują od anonima 302→`/auth/signin` albo 401/403.

Brak Supabase lub serwera = głośny błąd setupu, nigdy zielony/pominięty wynik. Cookbook §6.1–6.3 opisuje, jak dodać kolejny test każdego rodzaju.

### Key Discoveries:

- RLS przy UPDATE/DELETE odmawia przez 0 zmienionych wierszy bez błędu; przy SELECT — pusty wynik. Wyrocznią musi być stan wiersza A czytany jako A, nie brak błędu (`research.md` §#1).
- Insert z cudzym `user_id` łamie `with check` → to jest prawdziwy błąd (kod `42501`), więc tu asercja na błędzie jest poprawna — ale i tak sprawdzamy, że A nie ma nowego wiersza.
- PostgREST nie wystawia `pg_catalog`; strażnik #2 potrzebuje bezpośredniego połączenia (`DB_URL` z `supabase status -o env`).
- `/api/*` jest poza prefiksem middleware (`context/archive/2026-10-03-log-completed-workout/plan.md:12`); odkrywanie tras musi iść z systemu plików, nie z listy prefiksów.
- Astro wymaga nagłówka `Origin` przy POST z formularzem (smoke wysyła go, `scripts/smoke.mjs:67-72`) — bez niego odpowiedź byłaby 403 z powodu CSRF, a nie z powodu braku sesji.
- Testy nie importują kodu aplikacji, więc omijają `astro:env` — wystarczy zwykły `vitest/config`, bez `getViteConfig`.

## What We're NOT Doing

- Nie zmieniamy kodu aplikacji, migracji ani middleware (to faza testów; luka znaleziona przez test → osobna zmiana).
- Nie podpinamy testów do CI ani nie dodajemy bramki/hooka — to §3 Phase 4.
- Nie zmieniamy `scripts/smoke.mjs` (zostaje bez zmian, mimo częściowej redundancji).
- Nie dodajemy skryptu `db:advisors` — `supabase db advisors` trafia tylko do cookbooka §6.2 jako opcjonalny sygnał.
- Nie piszemy pgTAP; nie mockujemy klienta Supabase; nie używamy klucza service_role.
- Nie sprzątamy kont testowych (unikalne e-maile per uruchomienie, jak smoke; CI czyści `supabase stop --no-backup`).
- Nie dodajemy projektu `unit` — doda go faza 2.

## Implementation Approach

Jeden runner Vitest 5 w Node z projektem `integration`. `globalSetup` raz pobiera `API_URL`, `ANON_KEY`, `DB_URL` z `npx supabase status -o env`, sprawdza osiągalność Supabase i `BASE_URL`, i przekazuje wartości do testów przez `provide`/`inject`. Każdy z trzech plików testowych odpowiada jednemu ryzyku i ma kontrolę pozytywną, która chroni przed pustym (vacuous) przejściem. Allowlisty (publiczne trasy, publiczne obiekty bazy) są jawne, z uzasadnieniem przy każdym wpisie, a wpis wskazujący nieistniejący obiekt wywraca test.

## Critical Implementation Details

- **Timing & lifecycle** — sesje A i B muszą żyć w osobnych instancjach `createClient` z `auth.persistSession: false` (i bez auto-refresh), inaczej drugi `signUp` nadpisze sesję pierwszego w tym samym procesie. Pliki testowe korzystają z tej samej bazy, więc asercje nie mogą zakładać pustej tabeli — zawsze filtrują po id wierszy utworzonych w danym uruchomieniu.
- **Debug & observability** — sonda kontroli pozytywnej strażnika #2 musi działać w tej samej transakcji co zapytania strażnika (`sql.begin` + rzucony wyjątek/rollback), a funkcje strażnika muszą przyjmować wykonawcę zapytań jako parametr — inaczej sonda nie byłaby widoczna albo zostałaby w bazie.

## Phase 1: Bootstrap runnera + izolacja między użytkownikami (#1)

### Overview

Instalujemy i konfigurujemy Vitest z projektem `integration`, setup środowiska z głośnym błędem i helper kont, a następnie test behawioralny RLS dla `public.workouts`.

### Changes Required:

#### 1. Zależności i skrypty

**File**: `package.json`

**Intent**: Dodać runner i sterownik Postgresa jako devDependencies oraz polecenia uruchamiania.

**Contract**: devDependencies `vitest@^5`, `postgres@^3.4`; scripts `"test": "vitest run"`, `"test:integration": "vitest run --project integration"`.

#### 2. Konfiguracja Vitest

**File**: `vitest.config.ts`

**Intent**: Zdefiniować projekt `integration` (środowisko node, `include: tests/integration/**/*.test.ts`, globalSetup, wydłużony `testTimeout`, pliki sekwencyjnie), tak by faza 2 mogła dopisać projekt `unit` bez przebudowy.

**Contract**: `defineConfig` z `vitest/config`, `test.projects: [{ test: { name: "integration", ... } }]`. Bez `getViteConfig` (testy nie importują kodu aplikacji). Alias `@/` niepotrzebny.

#### 3. Setup środowiska (fail loud)

**File**: `tests/integration/setup/global-setup.ts`

**Intent**: Raz na uruchomienie odczytać `API_URL`, `ANON_KEY`, `DB_URL` z `npx supabase status -o env`, sprawdzić osiągalność API Supabase, Postgresa i `BASE_URL` (domyślnie `http://localhost:4321`), a przy dowolnej porażce przerwać z komunikatem mówiącym, co uruchomić (`npx supabase start`, `npm run dev`/preview). Wartości przekazać przez `project.provide`.

**Contract**: klucze `provide`: `supabaseUrl`, `supabaseAnonKey`, `dbUrl`, `baseUrl`; deklaracja typów w `tests/integration/setup/provided.d.ts` (augmentacja `ProvidedContext` z `vitest`). Żadnego `skip` — brak środowiska = rzucony błąd.

#### 4. Helpery

**File**: `tests/integration/helpers/supabase.ts`

**Intent**: Fabryki klientów supabase-js: anonimowy oraz `createTestUser(label)` tworzący konto przez `auth.signUp` z unikalnym e-mailem (`it-<runId>-<label>@example.com`) i zwracający `{ id, client }` z aktywną sesją.

**Contract**: klienci z `auth: { persistSession: false, autoRefreshToken: false }`; `createTestUser` rzuca, jeśli `signUp` nie zwrócił sesji (np. włączone potwierdzenia e-mail).

#### 5. Test izolacji

**File**: `tests/integration/rls-workouts.test.ts`

**Intent**: Udowodnić ryzyko #1 na poziomie PostgREST z dwoma prawdziwymi kontami. Każda odmowa jest sprawdzana stanem wiersza A czytanym jako A.

**Contract**: `beforeAll`: A i B przez `createTestUser`; A wstawia wiersz (zapamiętane `id` i wartości). Przypadki:
- kontrola pozytywna: A czyta swój wiersz po `id` → dokładnie 1 wiersz z oryginalnymi wartościami;
- B `select` po `id` A → 0 wierszy; B `select` bez filtra → brak `id` A w wyniku;
- B `insert` z `user_id = A.id` → błąd (kod `42501`), a A nie widzi żadnego nowego wiersza z wartościami B;
- B `update` wiersza A (zmiana `distance_km`, z `.select()`) → 0 zwróconych wierszy; A czyta wiersz → wartości niezmienione;
- B `delete` wiersza A (z `.select()`) → 0 wierszy; A czyta wiersz → nadal istnieje;
- anonim `select` po `id` A → 0 wierszy; anonim `insert` → błąd.

### Success Criteria:

#### Automated Verification:

- Zależności instalują się: `npm install` bez błędów, `vitest` i `postgres` w devDependencies
- Testy izolacji przechodzą przy działającym Supabase i serwerze: `npm run test:integration -- tests/integration/rls-workouts.test.ts`
- Bramka CI przechodzi: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- Przy zatrzymanym Supabase (`npx supabase stop`) `npm run test:integration` kończy się błędem setupu z instrukcją, a nie zielonym ani pominiętym wynikiem
- Test mutacyjny: lokalnie zmienić `workouts_select_own` na `using (true)` (np. w SQL Studio), uruchomić test → czerwony; przywrócić (`npx supabase db reset`) → zielony

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 2: Strażnik katalogowy RLS (#2)

### Overview

Test odpytuje katalog Postgresa (bez listy tabel w teście) i wywraca się na każdym obiekcie schematu `public`, który osłabia izolację.

### Changes Required:

#### 1. Helper połączenia z bazą

**File**: `tests/integration/helpers/db.ts`

**Intent**: Udostępnić połączenie `postgres` do `dbUrl` z `inject` i zamykanie go po testach.

**Contract**: `connectDb(): Sql` (jedno połączenie na plik, `max: 1`), zamykane w `afterAll`.

#### 2. Zapytania strażnika i allowlista

**File**: `tests/integration/helpers/rls-guard.ts`

**Intent**: Zebrać naruszenia z katalogu jako listę `{ object, rule }`, tak by komunikat błędu testu wprost nazywał obiekt i regułę. Funkcja przyjmuje wykonawcę zapytań (połączenie lub transakcję).

**Contract**: `findRlsViolations(sql): Promise<Violation[]>`, reguły:
- `rls-disabled` — `pg_class` w `public`, `relkind in ('r','p')`, `relrowsecurity = false`;
- `policy-for-anon-or-public` — `pg_policies` w `public`, `roles && '{anon,public}'`;
- `policy-always-true` — `pg_policies` w `public` z `qual = 'true'` lub `with_check = 'true'`;
- `view-without-security-invoker` — `relkind = 'v'` w `public` bez `security_invoker=true` w `reloptions`;
- `materialized-view` — każdy `relkind = 'm'` w `public` (nie podlega RLS).
Plus `RLS_GUARD_ALLOWLIST: { object, rule, reason }[]` (dziś pusta) — naruszenia z allowlisty są odfiltrowane.

#### 3. Test strażnika

**File**: `tests/integration/rls-catalog-guard.test.ts`

**Intent**: Udowodnić ryzyko #2 i to, że strażnik nie przechodzi pusto.

**Contract**: przypadki:
- kontrola zakresu: skan widzi co najmniej jedną tabelę w `public`, w tym `workouts` (czyli patrzy na bazę po migracjach);
- brak naruszeń poza allowlistą (asercja na pustej liście z czytelnym diffem);
- każdy wpis allowlisty wskazuje istniejący obiekt i ma niepusty `reason`;
- kontrola pozytywna: w transakcji z rollbackiem utworzyć `public.__rls_guard_probe` bez RLS + politykę `to anon` i `using (true)` na drugiej sondzie, uruchomić `findRlsViolations(tx)` → wykryte `rls-disabled`, `policy-for-anon-or-public`, `policy-always-true`; po rollbacku sondy nie istnieją.

### Success Criteria:

#### Automated Verification:

- Test strażnika przechodzi: `npm run test:integration -- tests/integration/rls-catalog-guard.test.ts`
- Po uruchomieniu w bazie nie ma tabel `__rls_guard_probe*` (sprawdzane przez sam test po rollbacku)
- Bramka CI przechodzi: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- Test mutacyjny: dodać lokalną migrację roboczą z tabelą w `public` bez RLS, `npx supabase db reset`, test → czerwony z nazwą tabeli i regułą `rls-disabled`; usunąć migrację, `db reset` → zielony

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 3: Anonimowy dostęp do tras (#4)

### Overview

Test HTTP do działającego serwera: każda trasa odkryta z `src/pages/`, która nie jest na allowliście publicznych, odmawia anonimowi dla każdej wyeksportowanej metody.

### Changes Required:

#### 1. Odkrywanie tras i allowlista publicznych

**File**: `tests/integration/helpers/routes.ts`

**Intent**: Zamienić pliki `src/pages/**/*.{astro,ts}` na ścieżki URL i metody HTTP, aby nowa trasa była objęta testem automatycznie.

**Contract**: `discoverRoutes(): { path, methods, file }[]`:
- `index` → katalog nadrzędny, rozszerzenie usunięte, segmenty `[param]`/`[...rest]` zastąpione stałą wartością (`00000000-0000-0000-0000-000000000000`);
- `.astro` → `["GET"]`; `.ts` → metody z eksportów `GET|POST|PUT|PATCH|DELETE|ALL` (`export const X` / `export function X` / `export async function X`), `ALL` → `GET` i `POST`.
`PUBLIC_ROUTES: { path, reason }[]` — `/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/api/auth/signin`, `/api/auth/signup`, `/api/auth/signout`, `/dev/kitchen-sink/dashboard` (dev-only, fixtures, 404 w produkcji).

#### 2. Test anonimowego dostępu

**File**: `tests/integration/anonymous-access.test.ts`

**Intent**: Udowodnić ryzyko #4 na prawdziwej odpowiedzi serwera (middleware + handlery).

**Contract**: dla każdej (ścieżka, metoda) spoza allowlisty — żądanie bez ciasteczek, `redirect: "manual"`, nagłówek `Origin: baseUrl`, dla metod z ciałem pusty formularz `application/x-www-form-urlencoded`. Odmowa = `302` z `Location` zaczynającym się od `/auth/signin` (także absolutny URL do `baseUrl/auth/signin`) albo `401`/`403`; wszystko inne (2xx, 404, 500, inny redirect) = fail z nazwą trasy i metody. Przypadki kontrolne:
- odkrycie zawiera `/dashboard` (GET) i `/api/workouts` (POST);
- każdy wpis `PUBLIC_ROUTES` odpowiada odkrytej trasie (nieaktualny wpis = fail);
- liczba sprawdzanych par > 0.

### Success Criteria:

#### Automated Verification:

- Test anonimowego dostępu przechodzi przy działającym serwerze: `npm run test:integration -- tests/integration/anonymous-access.test.ts`
- Cały projekt przechodzi: `npm run test:integration`
- Bramka CI przechodzi: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual Verification:

- Test mutacyjny: tymczasowo dodać `src/pages/api/probe.ts` z `GET` zwracającym 200 bez sprawdzenia sesji → test czerwony z nazwą `/api/probe GET`; usunąć plik → zielony
- `npm run smoke` nadal przechodzi (smoke bez zmian)

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed kolejną fazą.

---

## Phase 4: Cookbook i dokumentacja

### Overview

Utrwalamy wzorce jako kanoniczną odpowiedź „jak dodać test dla X” i aktualizujemy opis testów w repo.

### Changes Required:

#### 1. Cookbook §6.1–6.3 i stos §4

**File**: `context/foundation/test-plan.md`

**Intent**: Zastąpić placeholdery TBD w §6.1, §6.2, §6.3 wpisami: lokalizacja, nazewnictwo, test referencyjny, polecenie uruchomienia, wymagania środowiska, pułapki (0 wierszy bez błędu, kontrola pozytywna, allowlisty z uzasadnieniem). W §6.2 dopisać `npx supabase db advisors --local --type security` jako opcjonalny lokalny sygnał uzupełniający (nie sprawdza polityk `anon`). W §4 wiersz „unit + integration” uzupełnić o Vitest 5 (`checked: <data>`). W §6.6 krótka notatka fazy 1.

**Contract**: sekcje §4 (wiersz tabeli), §6.1, §6.2, §6.3, §6.6; §1–§3, §5, §7 bez zmian (status §3 aktualizuje orkiestrator).

#### 2. Sekcja Testing w AGENTS.md

**File**: `AGENTS.md`

**Intent**: Zastąpić „No unit test suite exists yet” informacją o `npm run test:integration` (wymaga `npx supabase start` i serwera na `BASE_URL`) i odesłaniem do `context/foundation/test-plan.md` §6; dopisać `npm run test:integration` do listy Commands.

**Contract**: sekcje `## Commands` i `## Testing`; reszta pliku bez zmian.

### Success Criteria:

#### Automated Verification:

- W `context/foundation/test-plan.md` §6.1–6.3 nie ma już tekstu „TBD — see §3 Phase 1”
- Formatowanie przechodzi: `npx prettier --check context/foundation/test-plan.md AGENTS.md`

#### Manual Verification:

- Wpisy §6.1–6.3 pozwalają dodać nowy test (np. dla przyszłej tabeli samopoczucia z S-03) bez czytania tego planu

---

## Testing Strategy

### Unit Tests:

- Brak w tej fazie (projekt `unit` doda faza 2 planu testów).

### Integration Tests:

- `rls-workouts.test.ts` — ryzyko #1 (PostgREST, dwa konta, anonim).
- `rls-catalog-guard.test.ts` — ryzyko #2 (katalog Postgresa, sonda w transakcji).
- `anonymous-access.test.ts` — ryzyko #4 (HTTP do serwera, trasy z systemu plików).

### Manual Testing Steps:

1. `npx supabase start`, `npm run dev` (lub build + preview), `npm run test:integration` → zielony.
2. Zatrzymać Supabase → `npm run test:integration` kończy się błędem setupu z instrukcją.
3. Trzy testy mutacyjne z faz 1–3 (polityka `using (true)`, tabela bez RLS, endpoint bez sprawdzenia sesji) → każdy daje czerwony wynik z nazwą obiektu.

## Performance Considerations

Każde uruchomienie tworzy 2 konta przez `signUp` i kilkanaście żądań HTTP — sekundy. Pliki uruchamiane sekwencyjnie, żeby uniknąć wyścigów na wspólnej bazie i limitów auth.

## Migration Notes

Brak zmian schematu. Konta `it-*@example.com` gromadzą się w lokalnej bazie; czyści je `npx supabase db reset`.

## References

- Related research: `context/changes/testing-data-isolation-and-access/research.md`
- Strategia i ryzyka: `context/foundation/test-plan.md` §2, §3 Phase 1, §6.1–6.3
- Wzorzec HTTP bez sesji i z `Origin`: `scripts/smoke.mjs:63-80`
- Polityki RLS: `supabase/migrations/20261003120000_create_workouts.sql:15-29`
- Ochrona tras: `src/middleware.ts:4,18-22`, `src/pages/api/workouts.ts:12-15`
- Decyzje z archiwum: `context/archive/2026-10-03-log-completed-workout/plan.md:12,37,43`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Bootstrap runnera + izolacja między użytkownikami (#1)

#### Automated

- [x] 1.1 Zależności instalują się: `npm install` bez błędów, `vitest` i `postgres` w devDependencies — 6296d5e
- [x] 1.2 Testy izolacji przechodzą przy działającym Supabase i serwerze: `npm run test:integration -- tests/integration/rls-workouts.test.ts` — 6296d5e
- [x] 1.3 Bramka CI przechodzi: `npx astro sync && npm run lint && npx astro check && npm run build` — 6296d5e

#### Manual

- [x] 1.4 Przy zatrzymanym Supabase `npm run test:integration` kończy się błędem setupu z instrukcją — 6296d5e
- [x] 1.5 Test mutacyjny: polityka select `using (true)` → test czerwony; po `db reset` → zielony — 6296d5e

### Phase 2: Strażnik katalogowy RLS (#2)

#### Automated

- [x] 2.1 Test strażnika przechodzi: `npm run test:integration -- tests/integration/rls-catalog-guard.test.ts`
- [x] 2.2 Po uruchomieniu w bazie nie ma tabel `__rls_guard_probe*`
- [x] 2.3 Bramka CI przechodzi: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual

- [x] 2.4 Test mutacyjny: migracja robocza z tabelą bez RLS → test czerwony z nazwą tabeli i regułą `rls-disabled`; po usunięciu → zielony

### Phase 3: Anonimowy dostęp do tras (#4)

#### Automated

- [ ] 3.1 Test anonimowego dostępu przechodzi: `npm run test:integration -- tests/integration/anonymous-access.test.ts`
- [ ] 3.2 Cały projekt przechodzi: `npm run test:integration`
- [ ] 3.3 Bramka CI przechodzi: `npx astro sync && npm run lint && npx astro check && npm run build`

#### Manual

- [ ] 3.4 Test mutacyjny: `src/pages/api/probe.ts` bez sprawdzenia sesji → test czerwony z `/api/probe GET`; po usunięciu → zielony
- [ ] 3.5 `npm run smoke` nadal przechodzi

### Phase 4: Cookbook i dokumentacja

#### Automated

- [ ] 4.1 W `test-plan.md` §6.1–6.3 nie ma już „TBD — see §3 Phase 1”
- [ ] 4.2 Formatowanie przechodzi: `npx prettier --check context/foundation/test-plan.md AGENTS.md`

#### Manual

- [ ] 4.3 Wpisy §6.1–6.3 pozwalają dodać nowy test bez czytania tego planu
