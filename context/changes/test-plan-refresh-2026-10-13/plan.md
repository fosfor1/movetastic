# Odświeżenie test-plan.md (2026-10-13) — plan implementacji

## Overview

Doprowadzić `context/foundation/test-plan.md` (ostatni przegląd 2026-10-11) do zgodności z repozytorium na 2026-10-13
i zapisać sześć decyzji z wywiadu planistycznego. Zmiana dokumentacyjna: jeden plik, bez kodu i testów.

## Current State Analysis

Ugruntowanie: `context/changes/test-plan-refresh-2026-10-13/research.md`.

- §4 (`test-plan.md:76-91`): profil „none”, e2e „none — świadomie”, narzędzia `checked: 2026-10-11`. Faktycznie: Vitest z
  projektami `integration` (3 pliki) i `hooks` (1 plik) (`vitest.config.ts:8-28`), Playwright 1.64.0 z 3 plikami testowymi
  i 2 helperami w `tests/e2e/`, opis w `context/foundation/test-stack.md` `## E2E`; `playwright-cli` 0.1.22.
- §5 (`:93-101`): hook po edycji „recommended after Phase 4”, a jest podłączony (`.claude/settings.json`, `c3c172c`).
  Integracja i E2E nie są w CI (`ci.yml:18-23,28-56`) — to nadal prawda.
- §2 (`:37-57`): #6 ma Likelihood Low i Must challenge „Walidacja w formularzu = walidacja”; research: formularz i API
  dzielą jeden walidator (`src/lib/workout-validation.ts:1`), luką są testy (2 negatywne przypadki w smoke).
  Brak ryzyk dla fałszywie zielonego biegu (Q2) i dla przepływu workout-log-roundtrip.
- §3 (`:65-70`): Faza 2 `change opened` bez folderu; Faza 4 (bramki) częściowo dostarczona (hook), na końcu kolejki.
  `/10x-test-plan` wznawia od pierwszego niezakończonego wiersza.
- §6 (`:103-153`): brak wzorca E2E; odwołania „see §3 Phase 2/3/4” zależą od numeracji.
- §7 (`:155-158`): brak wpisu o hookach.

## Desired End State

`test-plan.md` opisuje stan z 2026-10-13: profil „sparse”, istniejący Playwright, podłączone hooki, CI bez testów;
§2 zawiera zmienione #6 i nowe #7, #8; §3 ma kolejność 1 Izolacja (complete) → 2 Bramka CI → 3 Reguły obciążenia
i walidacji → 4 Reguła sugestii, plus wiersz 5 dla pokrytego E2E przepływu (#8, complete); §6 ma wzorzec E2E;
§7 ma wpis o hookach. `/10x-test-plan --status` wskazuje Fazę 2 (Bramka CI) jako następną.

### Key Discoveries:

- Reguły wejścia: jedno źródło `src/lib/workout-validation.ts:1`, konsumenci `WorkoutForm.tsx:6`, `api/workouts.ts:4`.
- Reuse serwera: `playwright.config.ts:38` (`reuseExistingServer: !process.env.CI`), `global-setup.ts:61-62` (dowolna odpowiedź = OK), wspólny port 4321; lockfile’y daemonów `.astro/preview.json`, `.astro/dev.json`.
- E2E w CI wymaga kroku tworzącego użytkownika (`auth.setup.ts:6-10`), `npx playwright install`, osobnego portu/joba.
- `npm test` uruchamia też projekt `hooks` (`package.json:15`) — bramka CI użyje `test:integration`.
- `test-stack.md` `## E2E` jest własnością `/10x-e2e-setup` („other skills only read it”) — tylko link.

## What We're NOT Doing

- Nie zmieniamy §1 (zasady, linia hot-spot) — wynik skanu hot-spot z 2026-10-13 trafia do §8.
- Nie zmieniamy w §2 niczego poza zatwierdzonymi #6, #7, #8; #6 zostaje Likelihood Low (Q3 nie podnosi prawdopodobieństwa).
- Nie edytujemy `context/foundation/test-stack.md`, `ci.yml`, `playwright.config.ts`, testów ani kodu — to praca Fazy 2 planu testów.
- Nie tworzymy folderu `context/changes/testing-load-and-validation-rules/` — status wraca do `not started`.
- Nie usuwamy `tests/hooks/`, projektu `hooks` ani `test:hooks`.
- Nie piszemy do `context/archive/`.

## Implementation Approach

Trzy fazy po sekcjach: najpierw fakty bez decyzji (§4, §5, §8), potem zatwierdzone pozycje §2, na końcu §3/§6/§7,
bo przenumerowanie faz zmienia odwołania w §5 i §6. Tekst planu testów pozostaje po polsku, w stylu istniejących wierszy;
tabele Markdown formatuje `prettier` (lint-staged dla `*.md`).

## Critical Implementation Details

- **Kolejność odwołań** — przenumerowanie w Fazie 3 zmienia znaczenie każdego „§3 Phase N” w pliku; po edycji wszystkie
  wystąpienia muszą wskazywać nowe numery (Bramka CI = 2, Reguły obciążenia/walidacji = 3, Reguła sugestii = 4).

## Faza 1: Fakty — §4, §5, §8

### Overview

Poprawić sekcje, których zmiana wynika z kodu i nie wymaga decyzji.

### Changes Required:

#### 1. Nagłówek i §4 Stack

**File**: `context/foundation/test-plan.md`

**Intent**: Zastąpić profil „none” opisem „sparse” i zaktualizować wiersze tabeli zgodnie z research.

**Contract**:
- `Last updated: 2026-10-13` w nagłówku.
- Akapit profilu: **sparse** — Vitest (`integration` 3 pliki, `hooks` 1 plik), Playwright (setup + seed `auth-gate-roundtrip` + `workout-log-roundtrip`), brak testów logiki domenowej; nic z tego nie biegnie w CI (tylko smoke).
- Wiersz unit+integration: projekty `integration` i `hooks`; `unit` dojdzie w Fazie 3.
- Wiersz e2e: Playwright `@playwright/test` 1.64.0, checked: 2026-10-13; Notes: projekt `setup` + `storageState`, szczegóły w `context/foundation/test-stack.md` `## E2E` (źródło prawdy); w CI od Fazy 2.
- Wiersz AI-native i „Stack grounding tools”: `playwright-cli` 0.1.22 dostępne; Context7, Exa, Playwright MCP niedostępne; Cloudflare MCP i claude-in-chrome dostępne; checked: 2026-10-13.

#### 2. §5 Quality Gates

**File**: `context/foundation/test-plan.md`

**Intent**: Oznaczyć hook jako podłączony i przypisać bramkę testów do nowej Fazy 2.

**Contract**:
- Wiersz unit+integration: Where `local + CI`, Required `required after §3 Phase 2 (CI uruchamia `npm run test:integration`, nie `npm test`)`.
- Nowy wiersz: E2E Playwright (`npx playwright test`, zimny serwer) — local + CI, `required after §3 Phase 2`, łapie zepsute przepływy przeglądarki i biegi na nieświeżym buildzie (#7, #8).
- Wiersz post-edit hook: `required (wired)` — `PostToolUse` lint edytowanego pliku + `Stop` end-of-turn (`c3c172c`).

#### 3. §8 Freshness Ledger

**File**: `context/foundation/test-plan.md`

**Intent**: Zaktualizować daty i zapisać skan hot-spot bez dotykania §1.

**Contract**: trzy daty → 2026-10-13; nowa linia: skan hot-spot 2026-10-13 (zakres `src/`, `scripts/`, `supabase/migrations/`, `tests/`, 30 dni): 12 commitów; top katalogi `src/components/auth` (7), `src/pages/api` (5), `src/pages/auth` (3); top pliki `src/pages/dashboard.astro` (5), `scripts/smoke.mjs` (4); `tests/` 3 commity bez churnu; brak churnu kodu od 2026-10-11.

### Success Criteria:

#### Automated Verification:

- Formatowanie: `npx prettier --check context/foundation/test-plan.md`
- Brak nieaktualnych fraz: `grep -nE "none — świadomie|Profil bazy testów: \*\*none|recommended after §3 Phase 4" context/foundation/test-plan.md` nic nie zwraca
- Nowe daty: `grep -c "checked: 2026-10-13" context/foundation/test-plan.md` ≥ 2

#### Manual Verification:

- §4 i §5 zgadzają się z research.md (wersje, liczby plików, stan CI)

**Implementation Note**: Po weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne przed Fazą 2.

---

## Faza 2: §2 Risk Map — zatwierdzone pozycje

### Overview

Wprowadzić trzy zmiany §2 zatwierdzone przez użytkownika 2026-10-13; nic więcej w §2.

### Changes Required:

#### 1. Ryzyko #6

**File**: `context/foundation/test-plan.md`

**Intent**: Zachować Impact Medium / Likelihood Low, dodać do Source dowód z research i zmienić Must challenge na realną lukę.

**Contract**: Source + „interview 2026-10-13 Q3; research test-plan-refresh (jeden wspólny walidator)”. Response Guidance #6 Must challenge: „Wspólny moduł = API go wywołuje” (wiązanie w endpoincie, nie same reguły); „smoke z 2 przypadkami = granice pokryte”. Context to ground: dodać „`today` formularza zamrożone przy SSR vs na żądanie po stronie serwera; kopia logiki daty w smoke”. Pozostałe kolumny bez zmian.

#### 2. Nowe ryzyko #7 — fałszywie zielony bieg

**File**: `context/foundation/test-plan.md`

**Intent**: Dodać wiersz Risk Map i Response Guidance dla biegu przechodzącego na serwerze starszym niż drzewo robocze.

**Contract**:
- Risk Map: „Testy (E2E/integracja) przechodzą na zielono przeciw serwerowi zbudowanemu ze starszego kodu — pozostawiony `astro preview`/dev daemon albo inny proces na porcie jest reużyty, więc regresja nie zostaje wykryta”; Impact Medium, Likelihood Medium; Source: interview 2026-10-13 Q2 („test went green against an old preview build”); research test-plan-refresh (reuse poza CI, wspólny port 4321, brak kontroli świeżości).
- Response Guidance: prove — bieg nie może przejść na buildzie starszym niż drzewo robocze: CI zawsze buduje na zimno, lokalnie bieg nie reużywa cudzego serwera po cichu, celowe złamanie w `src/` czerwieni test w tym samym biegu; must challenge — „zielony bieg = świeży build”, „CI nie reużywa, więc lokalnie też bezpiecznie”; context — `reuseExistingServer`, port dzielony przez dev/preview/integrację, lockfile’y `.astro/*.json`, `checkAppServer`, użytkownik E2E w CI, limit rejestracji; cheapest layer — bramka/proces (konfiguracja runnera + CI); anti-pattern — ufanie zielonemu biegowi bez celowego złamania.

#### 3. Nowe ryzyko #8 — przepływ zapisu treningu w przeglądarce

**File**: `context/foundation/test-plan.md`

**Intent**: Powiązać istniejący spec `workout-log-roundtrip` z nazwanym scenariuszem.

**Contract**:
- Risk Map: „Trening zapisany przez formularz w przeglądarce nie pojawia się na liście ‚Ostatnie 7 dni’ albo znika po przeładowaniu, mimo przekierowania na dashboard”; Impact Medium, Likelihood Low; Source: wybór użytkownika w `/10x-e2e` 2026-10-13; PRD (logowanie treningu).
- Response Guidance: prove — przez prawdziwy formularz wpis z unikalnymi wartościami jest widoczny po przekierowaniu i po reloadzie, a sprzątanie usuwa dokładnie 1 wiersz; must challenge — „302 na `/dashboard` = zapisano”, „smoke na HTML = przepływ przeglądarki”; context — hydratacja formularza, sprzątanie bez trasy delete; cheapest layer — e2e (spec istnieje); anti-pattern — asercja tylko na URL; sprzątanie bez asercji liczby wierszy.

### Success Criteria:

#### Automated Verification:

- Formatowanie: `npx prettier --check context/foundation/test-plan.md`
- Response Guidance ma wiersze #1–#8 (`grep -cE "^\| #[1-8] " context/foundation/test-plan.md` = 8, dziś 6); Risk Map ma wiersze 7 i 8
- `git diff` §2 dotyka tylko wierszy #6, #7, #8

#### Manual Verification:

- Użytkownik potwierdza, że brzmienie #6, #7, #8 odpowiada decyzjom z 2026-10-13

**Implementation Note**: Po weryfikacji automatycznej zatrzymaj się na potwierdzenie ręczne przed Fazą 3.

---

## Faza 3: §3 kolejność, §6 cookbook, §7

### Overview

Przenumerować fazy wdrożenia, zaktualizować odwołania, dodać wzorzec E2E do §6 i wpis o hookach do §7.

### Changes Required:

#### 1. §3 Phased Rollout

**File**: `context/foundation/test-plan.md`

**Intent**: Postawić bramkę CI przed regułami domenowymi i urealnić statusy.

**Contract** (wiersze tabeli):
1. Izolacja danych i dostęp — bez zmian (`complete`).
2. Bramka CI i zimny serwer — cel: integracja i E2E jako wymagane joby CI na lokalnym Supabase (bez `npm test`), użytkownik E2E tworzony w jobie, bieg nie przechodzi na nieświeżym buildzie; ryzyka `#7`, cross-cutting; typy `gates (CI jobs) + deliberate-break`; `not started`; `—`.
3. Reguły domenowe obciążenia i walidacji — cel i ryzyka (#5, #6) bez zmian; `not started`; `—`.
4. Bezpieczeństwo reguły sugestii — bez zmian (#3, `not started`).
5. Przepływ zapisu treningu (E2E) — ryzyko #8; `e2e (Playwright)`; `complete`; folder: `— (tests/e2e/workout-log-roundtrip.spec.ts, 04dba68)`.

#### 2. Odwołania do numerów faz

**File**: `context/foundation/test-plan.md`

**Intent**: Każde „§3 Phase N” w §4, §5, §6 wskazuje nowy numer.

**Contract**: §6.4 TBD → „see §3 Phase 3”; §6.5 → „see §3 Phase 4”; notatka Fazy 1 w §6 („bramkę podłącza §3 Phase 4”) → „§3 Phase 2”; §4/§5 z Fazy 1 tego planu już używają nowych numerów.

#### 3. §6 — wzorzec E2E

**File**: `context/foundation/test-plan.md`

**Intent**: Dodać podsekcję „Adding an E2E test (browser flow)” przed notatkami per faza (notatki przesuwają numer o 1).

**Contract**: punkty — test referencyjny `tests/e2e/workout-log-roundtrip.spec.ts` (#8), seed `tests/e2e/seed.spec.ts` (auth-gate-roundtrip, bieg bez sesji); autoryzacja przez projekt `setup` i `storageState` (`playwright/.auth/user.json`), użytkownik z `E2E_USERNAME`/`E2E_PASSWORD`; uruchomienie `npx playwright test [tests/e2e/<name>.spec.ts]`, konfiguracja i port w `test-stack.md` `## E2E`; zimny serwer: przed biegiem upewnij się, że nic nie odpowiada na porcie (`npx astro preview stop`, sprawdź `.astro/preview.json`), bo poza CI Playwright reużywa każdego procesu na `baseURL` (#7); sprzątanie bez trasy delete przez `tests/e2e/helpers/local-db.ts` (tylko localhost) z asercją liczby usuniętych wierszy, unikalne wartości z `Date.now()`; lokatory i czekanie wg reguł z `CLAUDE.md` (getByRole/Label/Text, bez `waitForTimeout`); sprawdzenie celowym złamaniem.

#### 4. §7 — hooki

**File**: `context/foundation/test-plan.md`

**Intent**: Zapisać decyzję Q5.

**Contract**: wpis „**Hooki Claude Code (`.claude/hooks/`)** — narzędzia, nie produkt; bez nowego budżetu testów. Istniejący `tests/hooks/agent-hooks.test.ts` (`npm run test:hooks`) zostaje lokalnie; bramka CI uruchamia `test:integration`, nie `npm test`. Re-evaluate if hook zacznie blokować CI lub psuć się po cichu. (Source: interview 2026-10-13 Q5.)”

### Success Criteria:

#### Automated Verification:

- Formatowanie: `npx prettier --check context/foundation/test-plan.md`
- Brak martwego folderu: `grep -n "testing-load-and-validation-rules" context/foundation/test-plan.md` nic nie zwraca
- Brak starego odwołania: `grep -n "Phase 4" context/foundation/test-plan.md` zwraca wyłącznie odwołania do reguły sugestii
- Wzorzec E2E obecny: `grep -n "Adding an E2E test" context/foundation/test-plan.md` zwraca 1 linię

#### Manual Verification:

- `/10x-test-plan --status` wskazuje Fazę 2 „Bramka CI i zimny serwer” jako następną
- §6 E2E da się wykonać krok po kroku bez czytania specu

**Implementation Note**: Po weryfikacji zatrzymaj się na potwierdzenie ręczne.

---

## Testing Strategy

Zmiana dokumentacyjna — brak testów kodu. Weryfikacja: `prettier --check`, kontrole `grep` z kryteriów, przegląd diffu §2 przez użytkownika, `/10x-test-plan --status`.

## References

- Research: `context/changes/test-plan-refresh-2026-10-13/research.md`
- Zmiana: `context/changes/test-plan-refresh-2026-10-13/change.md`
- Plik docelowy: `context/foundation/test-plan.md`
- E2E (tylko odczyt): `context/foundation/test-stack.md` `## E2E`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fakty — §4, §5, §8

#### Automated

- [x] 1.1 Formatowanie: `npx prettier --check context/foundation/test-plan.md` — b748e6c
- [x] 1.2 Brak nieaktualnych fraz (grep nic nie zwraca) — b748e6c
- [x] 1.3 Nowe daty: `checked: 2026-10-13` ≥ 2 — b748e6c

#### Manual

- [x] 1.4 §4 i §5 zgadzają się z research.md — b748e6c

### Phase 2: §2 Risk Map — zatwierdzone pozycje

#### Automated

- [x] 2.1 Formatowanie: `npx prettier --check context/foundation/test-plan.md` — 187be6b
- [x] 2.2 Response Guidance ma wiersze #1–#8; Risk Map ma wiersze 7 i 8 — 187be6b
- [x] 2.3 `git diff` §2 dotyka tylko wierszy #6, #7, #8 — 187be6b

#### Manual

- [x] 2.4 Użytkownik potwierdza brzmienie #6, #7, #8 — 187be6b

### Phase 3: §3 kolejność, §6 cookbook, §7

#### Automated

- [x] 3.1 Formatowanie: `npx prettier --check context/foundation/test-plan.md`
- [x] 3.2 Brak martwego folderu `testing-load-and-validation-rules`
- [x] 3.3 Brak starego odwołania „Phase 4” poza regułą sugestii
- [x] 3.4 Wzorzec E2E obecny w §6

#### Manual

- [x] 3.5 `/10x-test-plan --status` wskazuje Fazę 2 jako następną
- [x] 3.6 §6 E2E wykonalny bez czytania specu
