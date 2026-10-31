# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-13

## 1. Strategy

Testy w tym projekcie stosują trzy nienegocjowalne zasady:

1. **Cost × signal.** Wygrywa najtańszy test, który daje rzeczywisty sygnał
   dla ryzyka. Nie promuj do e2e, bo e2e „wydaje się bezpieczniejsze”. Nie
   nakładaj modelu wizji na deterministyczny diff, który już wykrywa
   regresję.
2. **User concerns are first-class evidence.** Ryzyka zakotwiczone w „zespół
   obawia się X, a awaria ujawniłaby się gdzieś w <obszar>” mają tę samą
   wagę co linie PRD czy dane hot-spotów.
3. **Risks are scenarios, not code locations.** Ten plan dokumentuje _co
   może zawieść_ i _dlaczego uważamy to za prawdopodobne_ — na podstawie
   dokumentów, wywiadu i _sygnału_ z bazy kodu (churn, struktura, baza
   testów). NIE twierdzi, że wie, która linia odpowiada za awarię. Tę wiedzę
   wytwarza `/10x-research` w każdej fazie wdrożenia. Jeśli plan i research
   nie zgadzają się co do miejsca awarii, research jest źródłem prawdy.

Hot-spot scope used for likelihood weighting: `src/`, `scripts/`, `supabase/migrations/` (wykluczone: `context/`, `.claude/`, `dist/`, `node_modules/`). Historia krótka (13 commitów w zakresie / 30 dni) — sygnał słaby.

## 2. Risk Map

Główne scenariusze awarii, uporządkowane wg wpływ × prawdopodobieństwo.
Kolumna Source cytuje _dowód, który podniósł ryzyko_ — nigdy konkretny plik
jako „miejsce awarii” (patrz §1 zasada #3).

| #   | Risk (failure scenario)                                                                                                                                                                                                                                                   | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Zalogowany użytkownik B czyta lub zapisuje treningi użytkownika A — także przez bezpośrednie wywołanie API bazy (PostgREST) z własną sesją i podstawionym identyfikatorem właściciela (IDOR); formularz aplikacji nie przyjmuje właściciela, więc jedyną barierą jest RLS | High   | High       | interview Q1; PRD §Non-Functional Requirements („wyłącznie własne dane”), §Success Criteria/Guardrails; archive/2026-10-03-log-completed-workout/plan.md (izolacja jako wzorzec dla kolejnych wycinków; „isolation is enforced by RLS, not by application filters”); research fazy 1 |
| 2   | Nowa migracja (tabela, polityka — np. przyszła edycja FR-005) cicho osłabia izolację: tabela bez RLS albo polityka dla złej roli/operacji                                                                                                                                 | High   | Medium     | interview Q3; roadmap §Parked (FR-005 doda polityki update); hot-spot dir `supabase/migrations/` (1 commit/30d)                                                                                                                                                                      |
| 3   | Biegacz z niskim samopoczuciem dostaje sugestię treningu intensywnego albo reguła progu obciążenia działa odwrotnie                                                                                                                                                       | High   | Medium     | PRD §Business Logic, FR-003, FR-006; roadmap S-03 („twarda gwarancja bezpieczeństwa”, następny wycinek)                                                                                                                                                                              |
| 4   | Niezalogowany użytkownik dociera do danych treningowych lub zapisuje trening, bo nowa trasa (np. ekran sugestii) nie trafiła pod ochronę                                                                                                                                  | High   | Medium     | AGENTS.md §Hard Rules (ochrona tras przez listę prefiksów); roadmap S-03 (nowy ekran); hot-spot dir `src/pages/` (5 commits/30d)                                                                                                                                                     |
| 5   | Dashboard pokazuje złe obciążenie z 7 dni — trening z granicy okna (północ Warszawa vs UTC, dzień today−6) wypada lub wpada niesłusznie; zła liczba prowadzi do złej sugestii                                                                                             | Medium | Medium     | archive/2026-10-03-weekly-training-load/plan-brief.md (granice okna tylko ręcznie); archive/2026-10-03-log-completed-workout/plan.md (Workers w UTC); hot-spot dir `src/lib/` (3 commits/30d)                                                                                        |
| 6   | Serwer przyjmuje nierealne dane (data z przyszłości, 900 km, HR 400) wysłane z pominięciem formularza i psuje obciążenie bez możliwości edycji                                                                                                                            | Medium | Low        | archive/2026-10-03-log-completed-workout/plan-brief.md (walidacja form + API + DB CHECK; edycja poza MVP); interview 2026-10-13 Q3; research test-plan-refresh (jeden wspólny walidator)                                                                                             |
| 7   | Testy (E2E/integracja) przechodzą na zielono przeciw serwerowi zbudowanemu ze starszego kodu — pozostawiony `astro preview`/dev daemon albo inny proces na porcie jest reużyty, więc regresja nie zostaje wykryta                                                         | Medium | Medium     | interview 2026-10-13 Q2 („test went green against an old preview build”); research test-plan-refresh (reuse poza CI, wspólny port 4321, brak kontroli świeżości)                                                                                                                     |
| 8   | Trening zapisany przez formularz w przeglądarce nie pojawia się na liście „Ostatnie 7 dni” albo znika po przeładowaniu, mimo przekierowania na dashboard                                                                                                                  | Medium | Low        | wybór użytkownika w `/10x-e2e` 2026-10-13; PRD FR-002 (logowanie ukończonego treningu)                                                                                                                                                                                               |

Odrzucone przy syntezie: „Worker wdrożony przed migracją psuje `/dashboard`” (High × Low, ryzyko procesu deployu — należy do checklisty wdrożenia/obserwowalności, nie testu); „smoke zielony mimo złej liczby” (problem wyroczni — przeniesiony jako antywzorzec do #5).

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                                       | Must challenge                                                                                                                    | Context `/10x-research` must ground                                                                                                                                     | Likely cheapest layer                                                                                                                                        | Anti-pattern to avoid                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1   | B (sesja B, bezpośrednio przez API bazy) nie widzi wiersza A, insert z właścicielem A jest odrzucony, a po próbie update/delete wiersz A jest nadal nietknięty — przy kontroli pozytywnej, że A swój wiersz widzi | „Smoke z dwoma userami na HTML dashboardu = izolacja”; „brak błędu = odmowa” (RLS przy update/delete zwraca 0 wierszy bez błędu)  | polityki per operacja i rola; klient request-scoped vs uprzywilejowany; jak ustalany jest właściciel przy insercie                                                      | integracja na lokalnym Supabase (dwa prawdziwe konta)                                                                                                        | mockowanie klienta Supabase (testuje mock, nie RLS); asercja tylko na liście w UI; asercja na braku błędu / pustym wyniku bez kontroli pozytywnej |
| #2   | Każda tabela schematu publicznego ma włączone RLS, brak polityk dla `anon` i `public`, brak widoków omijających RLS (bez `security_invoker`); nowa tabela bez RLS wywraca test                                    | „Migracja przeszła `db reset`, więc jest bezpieczna”; „advisor Supabase wystarczy” (nie sprawdza polityk dla `anon`)              | jak odpytać katalog Postgresa o RLS/polityki/widoki; czy CI ma bazę po migracjach                                                                                       | integracja (strażnik oparty o katalog); `supabase db advisors` jako tańszy sygnał uzupełniający                                                              | lista tabel przepisana na sztywno w teście (nowa tabela się prześlizgnie)                                                                         |
| #3   | Dla każdego niskiego samopoczucia, przy dowolnym obciążeniu, sugestia nie jest intensywna; powyżej progu zawsze lekka                                                                                             | „Dwa przykłady z PRD wystarczą”                                                                                                   | definicja „niskiego” samopoczucia (roadmap S-03 Unknowns), katalog sugestii, wartość progu i zachowanie na granicy                                                      | unit, tabela przypadków granicznych                                                                                                                          | oczekiwana wartość liczona tą samą funkcją (problem wyroczni); tylko happy path                                                                   |
| #4   | Anonimowe żądanie do każdej trasy dashboardu i każdego API danych dostaje przekierowanie/401, nigdy dane ani zapis                                                                                                | „Prefiks `/dashboard` chroni wszystko, więc nowe API też” (potwierdzone przez research: API jest poza prefiksem i broni się samo) | lista tras i endpointów danych vs mechanizm ochrony; zachowanie API bez sesji                                                                                           | integracja HTTP do działającego serwera, trasy odkrywane z systemu plików z jawną allowlistą publicznych (render komponentu bez middleware nie daje sygnału) | test tylko dla dziś istniejących tras (nowa trasa się prześlizgnie); test samej listy prefiksów zamiast odpowiedzi serwera                        |
| #5   | Trening z 23:30 czasu warszawskiego liczy się do „dziś”; today−6 wchodzi, today−7 nie; wynik równy ręcznie policzonemu przykładowi, także przy zmianie czasu                                                      | „Smoke liczy to samo, więc liczba jest dobra” (smoke odtwarza wzór aplikacji)                                                     | gdzie wyznaczane jest „dziś” i okno; DST; zaokrąglanie tylko przy wyświetlaniu                                                                                          | unit z wstrzykniętym „teraz”                                                                                                                                 | oczekiwana wartość policzona kopią wzoru produkcyjnego                                                                                            |
| #6   | Bezpośredni POST z nierealnymi lub przyszłymi danymi jest odrzucony i nic nie trafia do bazy                                                                                                                      | „Wspólny moduł = API go wywołuje” (wiązanie w endpoincie, nie same reguły); „smoke z 2 przypadkami = granice pokryte”             | zgodność walidacji klient/serwer; DB CHECK; „przyszłość” wg Warszawy; `today` formularza zamrożone przy SSR vs na żądanie po stronie serwera; kopia logiki daty w smoke | unit walidatora + jeden test integracyjny endpointu                                                                                                          | testowanie tylko komponentu React                                                                                                                 |
| #7   | Bieg nie może przejść na buildzie starszym niż drzewo robocze: CI zawsze buduje na zimno, lokalnie bieg nie reużywa cudzego serwera po cichu, a celowe złamanie w `src/` czerwieni test w tym samym biegu         | „Zielony bieg = świeży build”; „CI nie reużywa, więc lokalnie też bezpiecznie”                                                    | `reuseExistingServer`; port dzielony przez dev/preview/integrację; lockfile’y `.astro/*.json`; `checkAppServer`; użytkownik E2E w CI; limit rejestracji                 | bramka/proces (konfiguracja runnera + CI)                                                                                                                    | ufanie zielonemu biegowi bez celowego złamania                                                                                                    |
| #8   | Przez prawdziwy formularz wpis z unikalnymi wartościami jest widoczny po przekierowaniu i po reloadzie, a sprzątanie usuwa dokładnie 1 wiersz                                                                     | „302 na `/dashboard` = zapisano”; „smoke na HTML = przepływ przeglądarki”                                                         | hydratacja formularza; sprzątanie bez trasy delete                                                                                                                      | e2e (spec istnieje)                                                                                                                                          | asercja tylko na URL; sprzątanie bez asercji liczby wierszy                                                                                       |

## 3. Phased Rollout

Każdy wiersz to odrębna faza wdrożenia, która otwiera własny folder zmiany
przez `/10x-new`. Status przesuwa się w prawo wg poniższego słownika;
orkiestrator aktualizuje go w miarę pojawiania się artefaktów.

| #   | Phase name                             | Goal (one line)                                                                                                                                                               | Risks covered     | Test types                            | Status      | Change folder                                                 |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------- | ----------- | ------------------------------------------------------------- |
| 1   | Izolacja danych i dostęp               | Udowodnić, że B nie czyta ani nie modyfikuje danych A, że nowa tabela bez RLS wywraca test i że anonim nie dostaje danych; postawić runner                                    | #1, #2, #4        | integration (lokalny Supabase + HTTP) | complete    | context/archive/2026-10-25-testing-data-isolation-and-access/ |
| 2   | Bramka CI i zimny serwer               | Integracja i E2E jako wymagane joby CI na lokalnym Supabase (`test:integration`, nie `npm test`), użytkownik E2E tworzony w jobie; bieg nie przechodzi na nieświeżym buildzie | #7, cross-cutting | gates (CI jobs) + deliberate-break    | not started | —                                                             |
| 3   | Reguły domenowe obciążenia i walidacji | Udowodnić poprawne okno 7 dni wg Warszawy, wzór na niezależnych przykładach i serwerowe odrzucanie nierealnych danych                                                         | #5, #6            | unit + 1 integration                  | not started | —                                                             |
| 4   | Bezpieczeństwo reguły sugestii         | Udowodnić, że niskie samopoczucie nigdy nie daje treningu intensywnego (wymaga wydanego S-03)                                                                                 | #3                | unit (tabela przypadków granicznych)  | complete    | context/changes/todays-workout-suggestion/                    |
| 5   | Przepływ zapisu treningu (E2E)         | Udowodnić, że trening zapisany przez formularz w przeglądarce trafia na listę „Ostatnie 7 dni” i przeżywa reload                                                              | #8                | e2e (Playwright)                      | complete    | — (`tests/e2e/workout-log-roundtrip.spec.ts`, 04dba68)        |

Status vocabulary: `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

Klasyczna baza testów projektu. Profil bazy testów: **sparse** — Vitest (projekt `integration`: 3 pliki, projekt `hooks`: 1 plik) i Playwright (projekt `setup` + seed `auth-gate-roundtrip` + `workout-log-roundtrip`); brak testów logiki domenowej. Nic z tego nie biegnie w CI — jedynym automatem w CI jest smoke HTTP (`npm run smoke`) na lokalnym Supabase.

| Layer                | Tool                                                                                                                              | Version                      | Notes                                                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration   | Vitest (projekty w `vitest.config.ts`: `integration`, `hooks`, `unit`) + `postgres` (sterownik do katalogu) — checked: 2026-10-13 | vitest 5.0.3, postgres 3.4.9 | testy integracyjne nie importują kodu aplikacji (bez `astro:env`/workerd); projekt `unit` (`tests/unit/`, `npm run test:unit`) importuje czyste moduły z `src/lib/` przez alias `@` — bez importów `astro:*`                                                                 |
| DB / RLS integration | lokalny Supabase (CLI, już w CI smoke)                                                                                            | supabase CLI ^2.23           | prawdziwa baza z migracjami; bez mockowania klienta                                                                                                                                                                                                                          |
| HTTP / smoke         | `scripts/smoke.mjs` (istniejący)                                                                                                  | —                            | sprawdza auth, izolację na HTML, walidację; rozszerzalny o nowe trasy                                                                                                                                                                                                        |
| e2e                  | Playwright (`@playwright/test`) — checked: 2026-10-13                                                                             | 1.64.0                       | projekt `setup` (logowanie) + `storageState` dla `chromium`; szczegóły (port, komenda serwera, użytkownik E2E, seed) w `context/foundation/test-stack.md` `## E2E` — tam źródło prawdy; ryzyka #7, #8; w CI od Fazy 2                                                        |
| (optional) AI-native | `playwright-cli` (eksploracja działającej aplikacji przy pisaniu E2E) + claude-in-chrome — checked: 2026-10-13                    | playwright-cli 0.1.22        | `playwright-cli` do eksploracji przed generowaniem testu E2E; claude-in-chrome — wizualny przegląd dashboardu/ekranu sugestii po zmianach UI. When NOT to use: do weryfikacji liczb, izolacji czy reguł — tam deterministyczny test daje pełny sygnał; nie zamiast `lint:ui` |

**Stack grounding tools (current session):**

- Docs: Context7 — not available in current session; Cloudflare MCP docs dostępny (workerd/Workers) — not used at plan time; checked: 2026-10-13
- Search: Exa.ai — not available in current session; WebSearch/WebFetch dostępne — not used at plan time; checked: 2026-10-13
- Runtime/browser: `playwright-cli` 0.1.22 dostępne (eksploracja przy E2E); claude-in-chrome dostępny — opcjonalny przegląd wizualny, not used; Playwright MCP not available; checked: 2026-10-13
- Provider/platform: Cloudflare MCP dostępny (logi Workers dla pre-prod smoke); Supabase i GitHub MCP not available (jest `gh` CLI); checked: 2026-10-13

## 5. Quality Gates

| Gate                                                 | Where                 | Required?                                                                                | Catches                                                                |
| ---------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| lint + lint:ui + typecheck (`astro check`) + build   | local + CI (`ci` job) | required (wired)                                                                         | dryf składni/typów, literały UI                                        |
| smoke HTTP (auth, izolacja HTML, walidacja)          | CI (`smoke` job)      | required (wired)                                                                         | zepsute ścieżki auth i podstawowa izolacja                             |
| unit + integration (w tym RLS na lokalnym Supabase)  | local + CI            | required after §3 Phase 2 (CI uruchamia `npm run test:integration`, nie `npm test`)      | wycieki między użytkownikami, regresje reguł domenowych                |
| E2E Playwright (`npx playwright test`, zimny serwer) | local + CI            | required after §3 Phase 2                                                                | zepsute przepływy w przeglądarce, bieg na nieświeżym buildzie (#7, #8) |
| post-edit hook                                       | local (agent loop)    | required (wired) — `PostToolUse` lint edytowanego pliku + `Stop` end-of-turn (`c3c172c`) | regresje w momencie edycji                                             |
| pre-prod smoke na produkcji                          | po ręcznym deployu    | optional (manual)                                                                        | błędy środowiskowe (migracja vs Worker)                                |

## 6. Cookbook Patterns

Jak dodawać nowe testy w tym projekcie. Każda podsekcja wypełnia się po
wydaniu odpowiedniej fazy; wcześniej brzmi „TBD — see §3 Phase <N>.”

**Wspólne dla §6.1–6.3 (projekt `integration`):**

- Lokalizacja: `tests/integration/<obszar>.test.ts`; helpery w `tests/integration/helpers/`, setup w `tests/integration/setup/`.
- Uruchomienie: `npm run test:integration` (wszystkie), `npm run test:integration -- tests/integration/<plik>.test.ts` (jeden plik); `npm test` uruchamia wszystkie projekty.
- Środowisko: `npx supabase start` (Docker, potwierdzenia e-mail wyłączone) oraz serwer aplikacji na `BASE_URL` (domyślnie `http://localhost:4321` — `npm run dev`; albo `npm run build && npx astro preview --port 4322` z `BASE_URL=http://localhost:4322`). Brak środowiska = głośny błąd setupu, nigdy pominięcie.
- Wartości środowiska bierz przez `inject("supabaseUrl" | "supabaseAnonKey" | "dbUrl" | "baseUrl")`; nowy klucz dodaj w `global-setup.ts` i `provided.d.ts`.
- Pułapki: po `npm install` działający dev server potrafi odpowiadać 500 na każdą trasę (nieaktualny cache Vite `node_modules/.vite/deps_ssr`) — zrestartuj `npx astro dev --force`. Na Windows `npm run build` kończy się EPERM na `dist/`, gdy działa `astro preview` — najpierw `npx astro preview stop`. Konta `it-*@example.com` gromadzą się w lokalnej bazie; czyści je `npx supabase db reset`.

### 6.1 Adding a test for data isolation (RLS / ownership)

- Test referencyjny: `tests/integration/rls-workouts.test.ts` (ryzyko #1). Dwa prawdziwe konta przez `createTestUser(label)` z `helpers/supabase.ts` (każde z własnym klientem i sesją), zapytania bezpośrednio przez PostgREST — bez mocków i bez `service_role`.
- Nowa tabela użytkownika (np. samopoczucie z roadmapy S-03): migracja z RLS i politykami per operacja `to authenticated` (`auth.uid() = user_id`) → skopiuj wzorzec `rls-workouts` dla tej tabeli: A wstawia wiersz w `beforeAll`; B `select` po id i bez filtra, `insert` z `user_id = A`, `update`/`delete` z `.select()`; anonim `select`/`insert`.
- Wyrocznia: RLS przy `select`/`update`/`delete` odmawia przez **0 wierszy bez błędu** — nigdy nie asertuj samego braku błędu; po każdej próbie czytaj wiersz A jako A i porównuj z oryginałem (`expectRowAUnchanged`). Tylko `insert` z cudzym `user_id` daje błąd (`42501`).
- Kontrola pozytywna obowiązkowa: A widzi swój wiersz z oryginalnymi wartościami (inaczej puste wyniki B przechodzą „za darmo”). Wartości B różne od wartości A.
- Baza jest współdzielona między plikami i uruchomieniami — filtruj po id wierszy z tego uruchomienia, nie zakładaj pustej tabeli.

### 6.2 Adding a migration / new table guard

- Test referencyjny: `tests/integration/rls-catalog-guard.test.ts` (ryzyko #2), zapytania w `helpers/rls-guard.ts` (`findRlsViolations`), połączenie `connectDb()` z `helpers/db.ts` (PostgREST nie wystawia `pg_catalog`).
- Nowa tabela/widok w `public` jest objęta **automatycznie** — strażnik czyta katalog, nie listę tabel. Wywraca się na regułach: `rls-disabled`, `policy-for-anon-or-public`, `policy-always-true`, `view-without-security-invoker`, `materialized-view`; komunikat nazywa obiekt i regułę.
- Celowy wyjątek: wpis w `RLS_GUARD_ALLOWLIST` z `object`, `rule` i niepustym `reason`; wpis wskazujący nieistniejący obiekt wywraca test (allowlista nie może się zestarzeć).
- Nowa reguła strażnika: dopisz gałąź do zapytania w `findRlsViolations` i sondę do kontroli pozytywnej (tworzona w `sql.begin`, zawsze wycofywana rzuceniem `Rollback`; funkcje strażnika przyjmują wykonawcę zapytań, by widziały sondę).
- Sprawdzenie przy migracji: usunięcie `enable row level security` z migracji → test czerwony z regułą `rls-disabled`.
- Opcjonalny lokalny sygnał uzupełniający: `npx supabase db advisors --local --type security` (m.in. lint 0013 „RLS disabled in public”). Nie sprawdza polityk dla `anon` i nie jest bramką — nie zastępuje strażnika.

### 6.3 Adding a test for a new protected route or data endpoint

- Test referencyjny: `tests/integration/anonymous-access.test.ts` (ryzyko #4), odkrywanie tras w `helpers/routes.ts` (`discoverRoutes`) — z plików `src/pages/` i wyeksportowanych metod HTTP, nie z listy prefiksów middleware.
- Nowa trasa lub endpoint jest objęta **automatycznie**: anonim dla każdej metody musi dostać 302→`/auth/signin` albo 401/403. Nie dopisuj testu per trasa; ochronę zapewnij w kodzie (prefiks w `PROTECTED_ROUTES` albo sprawdzenie sesji w handlerze `/api/*`, które jest poza prefiksem).
- Trasa celowo publiczna: wpis w `PUBLIC_ROUTES` z `path` i `reason`; wpis dla nieistniejącej trasy wywraca test. Segmenty dynamiczne (`[id]`) są podstawiane wartością `DYNAMIC_SEGMENT_VALUE`.
- Żądania wysyłają nagłówek `Origin` — bez niego Astro odrzuca POST z formularza 403 (CSRF), co dałoby fałszywie zieloną odmowę.
- Sprawdzenie: usunięcie kontroli sesji z `POST /api/workouts` → test czerwony (przekierowanie do formularza zamiast `/auth/signin`). Wynik „got 500” na wszystkich trasach oznacza zwykle zepsuty dev server (pułapka wyżej), nie lukę.

### 6.4 Adding a unit test for a domain rule (load window, validation)

- TBD — see §3 Phase 3 for time-zone boundary / independent-oracle pattern.

### 6.5 Adding a test for the suggestion rule

- Test referencyjny: `tests/unit/workout-suggestion.test.ts` (ryzyko #3), projekt Vitest `unit`; reguła w `src/lib/workout-suggestion.ts` (czysty moduł, bez `astro:*`). Nagłówek pliku: komentarz `risk:`.
- Uruchomienie: `npm run test:unit` (bez Supabase i bez serwera aplikacji).
- Wzorzec: `test.each` z jawną tabelą `[samopoczucie, obciążenie, oczekiwany rodzaj]` — każde samopoczucie 1–5 × obciążenia `0`, typowe, `100`, `100.4`, `100.5`, `101`, wysokie. Para `100.4`/`100.5` pilnuje granicy zaokrąglenia: reguła porównuje liczbę widoczną na dashboardzie (`roundLoad`), więc `100.4` jest jeszcze na progu, a `100.5` już ponad nim.
- Wyrocznia: oczekiwany rodzaj wpisany literałem w każdym wierszu — nigdy liczony przez `suggestWorkout` ani kopię reguły. Zmiana progu, katalogu lub definicji „niskiego” samopoczucia = świadoma zmiana wierszy tabeli.
- Nowe wejście reguły (np. kolejny parametr): dopisz kolumnę i przypadki graniczne nowego wejścia, zachowując wiersze „niskie samopoczucie → `easy`” dla każdej wartości obciążenia; nowe parsowanie wejścia z zapytania testuj tabelą jak `parseWellbeing` (poprawne literały i odrzucane warianty: pusty, spacje, `3.0`, poza zakresem).
- Sprawdzenie: celowe złamanie reguły w `src/lib/workout-suggestion.ts` (np. usunięcie warunku niskiego samopoczucia albo `>=` zamiast `>` przy progu) → tabela czerwona, potem przywrócenie.

### 6.6 Adding an E2E test (browser flow)

- Kiedy: tylko ryzyko, które wymaga przeglądarki (hydratacja wyspy React, przekierowania, stan po reloadzie). Reguły domenowe i izolacja zostają w unit/integracji (§1 zasada #1).
- Test referencyjny: `tests/e2e/workout-log-roundtrip.spec.ts` (ryzyko #8); seed `tests/e2e/seed.spec.ts` (auth-gate-roundtrip) — wzorzec, który kopiuje każdy nowy spec. Nagłówek specu: komentarz `risk:` i `seed:`.
- Uruchomienie: `npx playwright test` (wszystko), `npx playwright test tests/e2e/<name>.spec.ts` (jeden plik). Konfiguracja, port i komenda serwera: `context/foundation/test-stack.md` `## E2E` (źródło prawdy). Wymaga `npx supabase start` i lokalnego użytkownika z `E2E_USERNAME`/`E2E_PASSWORD` w `.env` (po `supabase db reset` utwórz go ponownie).
- Autoryzacja: projekt `setup` (`tests/e2e/auth.setup.ts`) loguje się raz przez formularz i zapisuje `playwright/.auth/user.json`; specy dostają sesję przez `storageState`. Ścieżka niezalogowana: `test.use({ storageState: { cookies: [], origins: [] } })` jak w seedzie.
- Zimny serwer (#7): poza CI Playwright reużywa każdego procesu, który odpowiada na `baseURL`, i wtedy nie buduje aplikacji. Przed biegiem upewnij się, że nic nie słucha na porcie (`npx astro preview stop`, `.astro/preview.json` / `.astro/dev.json` wskazują daemony w tle); dev server z `npm run dev` na 4321 też zostanie użyty.
- Formularz tworzący dane: przed wpisywaniem `waitForIslandsHydrated(page)` z `tests/e2e/helpers/hydration.ts` — ponowienie fill + submit nie jest bezpieczne, bo tworzy wiersz.
- Dane i sprzątanie: unikalne wartości z `Date.now()`; brak trasy i polityki delete, więc `afterEach` usuwa wiersz przez `deleteWorkouts` z `tests/e2e/helpers/local-db.ts` (bezpośrednio lokalny Postgres, odmawia hosta innego niż localhost) i asertuje liczbę usuniętych wierszy (`toBe(1)`).
- Lokatory i czekanie wg `CLAUDE.md`: `getByRole` / `getByLabel` / `getByText`, nigdy CSS/XPath ani `waitForTimeout()`; czekaj na stan (`toBeVisible()`, `waitForURL()`).
- Sprawdzenie: celowe złamanie chronionego zachowania w `src/` → spec czerwony w tym samym biegu (na zimnym serwerze), potem przywrócenie.

### 6.7 Per-rollout-phase notes

(Uzupełniane przez `/10x-implement` po każdej fazie.)

- **Faza 1 — Izolacja danych i dostęp** (`context/archive/2026-10-25-testing-data-isolation-and-access/`): runner Vitest 5 z projektem `integration` i trzy pliki testów (#1, #2, #4). Każdy przeszedł test mutacyjny: polityka select `using (true)` → `rls-workouts` czerwony; brak `enable row level security` → strażnik czerwony (`rls-disabled`); brak kontroli sesji w `POST /api/workouts` → `anonymous-access` czerwony. Testy nie są jeszcze w CI — bramkę podłącza §3 Phase 2. `scripts/smoke.mjs` pozostaje bez zmian. Otwarte z przeglądu implementacji: F1 (testy odmowy update/delete nie wykryją zbyt szerokiej polityki, bo zasłania ją polityka select) — wrócić przy FR-005 (edycja treningu); F4–F8 odroczone jako obserwacje.

## 7. What We Deliberately Don't Test

- **Strona `Welcome` i resztki startera** — przeznaczone do usunięcia, bez wartości produktowej. Re-evaluate if któraś z nich stanie się częścią przepływu użytkownika. (Source: Phase 2 interview Q5.)
- **Deploy Workera przed migracją** — ryzyko procesu, nie kodu; pokrywa checklista deployu i opcjonalny pre-prod smoke. Re-evaluate if deploy zostanie zautomatyzowany. (Source: synteza briefu.)
- **Hooki Claude Code (`.claude/hooks/`)** — narzędzia, nie produkt; bez nowego budżetu testów. Istniejący `tests/hooks/agent-hooks.test.ts` (`npm run test:hooks`) zostaje lokalnie; bramka CI uruchamia `test:integration`, nie `npm test`. Re-evaluate if hook zacznie blokować CI lub psuć się po cichu. (Source: interview 2026-10-13 Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-13
- Stack versions last verified: 2026-10-13
- AI-native tool references last verified: 2026-10-13
- Hot-spot scan 2026-10-13 (zakres `src/`, `scripts/`, `supabase/migrations/`, `tests/`; 30 dni): 12 commitów w `src/`, `scripts/`, `supabase/migrations/`; top katalogi (zmiany plików) `src/components/auth` (7), `src/pages/api` (5), `src/pages/auth` (3); top pliki `src/pages/dashboard.astro` (5), `scripts/smoke.mjs` (4); `tests/` — 4 commity, same nowe pliki, bez churnu; brak churnu kodu od 2026-10-11.

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
