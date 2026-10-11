# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-11

## 1. Strategy

Testy w tym projekcie stosują trzy nienegocjowalne zasady:

1. **Cost × signal.** Wygrywa najtańszy test, który daje rzeczywisty sygnał
   dla ryzyka. Nie promuj do e2e, bo e2e „wydaje się bezpieczniejsze”. Nie
   nakładaj modelu wizji na deterministyczny diff, który już wykrywa
   regresję.
2. **User concerns are first-class evidence.** Ryzyka zakotwiczone w „zespół
   obawia się X, a awaria ujawniłaby się gdzieś w <obszar>” mają tę samą
   wagę co linie PRD czy dane hot-spotów.
3. **Risks are scenarios, not code locations.** Ten plan dokumentuje *co
   może zawieść* i *dlaczego uważamy to za prawdopodobne* — na podstawie
   dokumentów, wywiadu i *sygnału* z bazy kodu (churn, struktura, baza
   testów). NIE twierdzi, że wie, która linia odpowiada za awarię. Tę wiedzę
   wytwarza `/10x-research` w każdej fazie wdrożenia. Jeśli plan i research
   nie zgadzają się co do miejsca awarii, research jest źródłem prawdy.

Hot-spot scope used for likelihood weighting: `src/`, `scripts/`, `supabase/migrations/` (wykluczone: `context/`, `.claude/`, `dist/`, `node_modules/`). Historia krótka (13 commitów w zakresie / 30 dni) — sygnał słaby.

## 2. Risk Map

Główne scenariusze awarii, uporządkowane wg wpływ × prawdopodobieństwo.
Kolumna Source cytuje *dowód, który podniósł ryzyko* — nigdy konkretny plik
jako „miejsce awarii” (patrz §1 zasada #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Zalogowany użytkownik B czyta lub zapisuje treningi użytkownika A — także przez bezpośrednie wywołanie API z podstawionym identyfikatorem właściciela (IDOR) | High | High | interview Q1; PRD §Non-Functional Requirements („wyłącznie własne dane”), §Success Criteria/Guardrails; archive/2026-10-03-log-completed-workout/plan.md (izolacja jako wzorzec dla kolejnych wycinków) |
| 2 | Nowa migracja (tabela, polityka — np. przyszła edycja FR-005) cicho osłabia izolację: tabela bez RLS albo polityka dla złej roli/operacji | High | Medium | interview Q3; roadmap §Parked (FR-005 doda polityki update); hot-spot dir `supabase/migrations/` (1 commit/30d) |
| 3 | Biegacz z niskim samopoczuciem dostaje sugestię treningu intensywnego albo reguła progu obciążenia działa odwrotnie | High | Medium | PRD §Business Logic, FR-003, FR-006; roadmap S-03 („twarda gwarancja bezpieczeństwa”, następny wycinek) |
| 4 | Niezalogowany użytkownik dociera do danych treningowych lub zapisuje trening, bo nowa trasa (np. ekran sugestii) nie trafiła pod ochronę | High | Medium | AGENTS.md §Hard Rules (ochrona tras przez listę prefiksów); roadmap S-03 (nowy ekran); hot-spot dir `src/pages/` (5 commits/30d) |
| 5 | Dashboard pokazuje złe obciążenie z 7 dni — trening z granicy okna (północ Warszawa vs UTC, dzień today−6) wypada lub wpada niesłusznie; zła liczba prowadzi do złej sugestii | Medium | Medium | archive/2026-10-03-weekly-training-load/plan-brief.md (granice okna tylko ręcznie); archive/2026-10-03-log-completed-workout/plan.md (Workers w UTC); hot-spot dir `src/lib/` (3 commits/30d) |
| 6 | Serwer przyjmuje nierealne dane (data z przyszłości, 900 km, HR 400) wysłane z pominięciem formularza i psuje obciążenie bez możliwości edycji | Medium | Low | archive/2026-10-03-log-completed-workout/plan-brief.md (walidacja form + API + DB CHECK; edycja poza MVP) |

Odrzucone przy syntezie: „Worker wdrożony przed migracją psuje `/dashboard`” (High × Low, ryzyko procesu deployu — należy do checklisty wdrożenia/obserwowalności, nie testu); „smoke zielony mimo złej liczby” (problem wyroczni — przeniesiony jako antywzorzec do #5).

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | B dostaje pusty wynik/odmowę przy odczycie, insercie z cudzym właścicielem, update i delete treningów A — na poziomie bazy, nie tylko HTML | „Smoke z dwoma userami na HTML dashboardu = izolacja” | polityki per operacja i rola; klient request-scoped vs uprzywilejowany; jak ustalany jest właściciel przy insercie | integracja na lokalnym Supabase (dwa prawdziwe konta) | mockowanie klienta Supabase (testuje mock, nie RLS); asercja tylko na liście w UI |
| #2 | Każda tabela schematu publicznego ma włączone RLS i brak polityk dla `anon`; nowa tabela bez RLS wywraca test | „Migracja przeszła `db reset`, więc jest bezpieczna” | jak odpytać katalog Postgresa o RLS/polityki; czy CI ma bazę po migracjach | integracja (strażnik oparty o katalog) | lista tabel przepisana na sztywno w teście (nowa tabela się prześlizgnie) |
| #3 | Dla każdego niskiego samopoczucia, przy dowolnym obciążeniu, sugestia nie jest intensywna; powyżej progu zawsze lekka | „Dwa przykłady z PRD wystarczą” | definicja „niskiego” samopoczucia (roadmap S-03 Unknowns), katalog sugestii, wartość progu i zachowanie na granicy | unit, tabela przypadków granicznych | oczekiwana wartość liczona tą samą funkcją (problem wyroczni); tylko happy path |
| #4 | Anonimowe żądanie do każdej trasy dashboardu i każdego API danych dostaje przekierowanie/401, nigdy dane ani zapis | „Prefiks `/dashboard` chroni wszystko, więc nowe API też” | lista tras i endpointów danych vs mechanizm ochrony; zachowanie API bez sesji | integracja HTTP / rozszerzenie smoke | test tylko dla dziś istniejących tras (nowa trasa się prześlizgnie) |
| #5 | Trening z 23:30 czasu warszawskiego liczy się do „dziś”; today−6 wchodzi, today−7 nie; wynik równy ręcznie policzonemu przykładowi, także przy zmianie czasu | „Smoke liczy to samo, więc liczba jest dobra” (smoke odtwarza wzór aplikacji) | gdzie wyznaczane jest „dziś” i okno; DST; zaokrąglanie tylko przy wyświetlaniu | unit z wstrzykniętym „teraz” | oczekiwana wartość policzona kopią wzoru produkcyjnego |
| #6 | Bezpośredni POST z nierealnymi lub przyszłymi danymi jest odrzucony i nic nie trafia do bazy | „Walidacja w formularzu = walidacja” | zgodność walidacji klient/serwer; DB CHECK; „przyszłość” wg Warszawy | unit walidatora + jeden test integracyjny endpointu | testowanie tylko komponentu React |

## 3. Phased Rollout

Każdy wiersz to odrębna faza wdrożenia, która otwiera własny folder zmiany
przez `/10x-new`. Status przesuwa się w prawo wg poniższego słownika;
orkiestrator aktualizuje go w miarę pojawiania się artefaktów.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Izolacja danych i dostęp | Udowodnić, że B nie czyta ani nie modyfikuje danych A, że nowa tabela bez RLS wywraca test i że anonim nie dostaje danych; postawić runner | #1, #2, #4 | integration (lokalny Supabase + HTTP) | change opened | context/changes/testing-data-isolation-and-access/ |
| 2 | Reguły domenowe obciążenia i walidacji | Udowodnić poprawne okno 7 dni wg Warszawy, wzór na niezależnych przykładach i serwerowe odrzucanie nierealnych danych | #5, #6 | unit + 1 integration | not started | — |
| 3 | Bezpieczeństwo reguły sugestii | Udowodnić, że niskie samopoczucie nigdy nie daje treningu intensywnego (wymaga wydanego S-03) | #3 | unit (tabela przypadków granicznych) | not started | — |
| 4 | Bramki jakości | Testy jako wymagana bramka CI; lokalny hook po edycji dla pętli agenta | cross-cutting | gates + post-edit hook | not started | — |

Status vocabulary: `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

Klasyczna baza testów projektu. Profil bazy testów: **none** — brak konfiguracji runnera i testów aplikacji; jedynym automatem jest smoke HTTP (`npm run smoke`) w CI na lokalnym Supabase.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | none yet — see Phase 1 (kandydat: Vitest, natywny dla Vite/Astro) | — | wersję i integrację z Astro/workerd weryfikuje research Fazy 1 |
| DB / RLS integration | lokalny Supabase (CLI, już w CI smoke) | supabase CLI ^2.23 | prawdziwa baza z migracjami; bez mockowania klienta |
| HTTP / smoke | `scripts/smoke.mjs` (istniejący) | — | sprawdza auth, izolację na HTML, walidację; rozszerzalny o nowe trasy |
| e2e | none — świadomie | — | ryzyka pokrywa tańsza warstwa; ponownie rozważ, gdy pojawi się interakcja wielokrokowa po stronie klienta |
| (optional) AI-native | claude-in-chrome — checked: 2026-10-11 | n/a | wizualny przegląd dashboardu/ekranu sugestii po zmianach UI. When NOT to use: do weryfikacji liczb, izolacji czy reguł — tam deterministyczny test daje pełny sygnał; nie zamiast `lint:ui` |

**Stack grounding tools (current session):**
- Docs: Context7 — not available in current session; Cloudflare MCP docs dostępny (workerd/Workers) — not used at plan time, do użycia w research Fazy 1; checked: 2026-10-11
- Search: Exa.ai — not available in current session; WebSearch/WebFetch dostępne — not used at plan time; checked: 2026-10-11
- Runtime/browser: claude-in-chrome — możliwy opcjonalny przegląd wizualny, not used; Playwright MCP not available; checked: 2026-10-11
- Provider/platform: Cloudflare MCP dostępny (logi Workers dla pre-prod smoke); Supabase i GitHub MCP not available (jest `gh` CLI); checked: 2026-10-11

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + lint:ui + typecheck (`astro check`) + build | local + CI (`ci` job) | required (wired) | dryf składni/typów, literały UI |
| smoke HTTP (auth, izolacja HTML, walidacja) | CI (`smoke` job) | required (wired) | zepsute ścieżki auth i podstawowa izolacja |
| unit + integration (w tym RLS na lokalnym Supabase) | local + CI | required after §3 Phase 4 (testy lądują w Fazach 1–3) | wycieki między użytkownikami, regresje reguł domenowych |
| post-edit hook | local (agent loop) | recommended after §3 Phase 4 | regresje w momencie edycji |
| pre-prod smoke na produkcji | po ręcznym deployu | optional (manual) | błędy środowiskowe (migracja vs Worker) |

## 6. Cookbook Patterns

Jak dodawać nowe testy w tym projekcie. Każda podsekcja wypełnia się po
wydaniu odpowiedniej fazy; wcześniej brzmi „TBD — see §3 Phase <N>.”

### 6.1 Adding a test for data isolation (RLS / ownership)

- TBD — see §3 Phase 1 for cross-user read/write denial pattern (dwa konta na lokalnym Supabase).

### 6.2 Adding a migration / new table guard

- TBD — see §3 Phase 1 for „every public table has RLS” catalog-guard pattern.

### 6.3 Adding a test for a new protected route or data endpoint

- TBD — see §3 Phase 1 for anonymous-access denial pattern.

### 6.4 Adding a unit test for a domain rule (load window, validation)

- TBD — see §3 Phase 2 for time-zone boundary / independent-oracle pattern.

### 6.5 Adding a test for the suggestion rule

- TBD — see §3 Phase 3 for low-wellbeing-never-intense boundary table pattern.

### 6.6 Per-rollout-phase notes

(Uzupełniane przez `/10x-implement` po każdej fazie.)

## 7. What We Deliberately Don't Test

- **Strona `Welcome` i resztki startera** — przeznaczone do usunięcia, bez wartości produktowej. Re-evaluate if któraś z nich stanie się częścią przepływu użytkownika. (Source: Phase 2 interview Q5.)
- **Deploy Workera przed migracją** — ryzyko procesu, nie kodu; pokrywa checklista deployu i opcjonalny pre-prod smoke. Re-evaluate if deploy zostanie zautomatyzowany. (Source: synteza briefu.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-11
- Stack versions last verified: 2026-10-11
- AI-native tool references last verified: 2026-10-11

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
