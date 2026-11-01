---
project: Movetastic
version: 2
status: draft
created: 2026-10-01
updated: 2026-11-01
prd_version: 2
main_goal: speed
top_blocker: none
milestone_id: edit-and-delete-workouts
milestone_seq: 2
milestone_status: done
---

# Roadmap: Movetastic

> Derived from `context/foundation/prd.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-2: Poprawianie i usuwanie treningów** — Status: done

- **Intent:** Biegacz może naprawić błędnie wpisany trening — usunąć go albo poprawić jego dane — więc obciążenie z 7 dni i sugestia na dziś liczą się z prawdziwych danych. Z M-1 daje to pełne zarządzanie treningami: dodaj, wylistuj, edytuj, usuń.
- **Source materials:** `context/foundation/prd.md` (v2)
- **Done when:** S-04 and S-05 are `done` (S-01–S-03 were delivered in M-1).
- **Scope anchors:** FR-005, FR-007, US-02, US-01 (kryterium „edytuj trening”).

## Vision recap

Amator biegowy trenujący samodzielnie codziennie zastanawia się, jaki trening dziś wykonać — i bez jasnego kryterium trenuje przypadkowo albo odpuszcza. Sztywne plany treningowe nie reagują na bieżącą formę i samopoczucie. Movetastic odpowiada na pytanie „co trenować dziś” na podstawie obciążenia z ostatniego tygodnia i dzisiejszego samopoczucia.

## North star

**S-04: Użytkownik usuwa błędnie wpisany trening** — gwiazda przewodnia kamienia M-2, czyli najmniejszy kompletny przepływ, którego działanie dowodzi celu kamienia; umieszczona jako pierwsza, bo wszystko inne w M-2 ma znaczenie tylko wtedy, gdy ona działa. Usunięcie to najkrótsza droga do naprawy błędnego wpisu, a jego wzorzec (wybór treningu z listy, polityka dostępu tylko dla właściciela, odświeżone obciążenie) przejmie edycja w S-05. Gwiazdą przewodnią całego produktu pozostaje S-03 (sugestia na dziś, dostarczona w M-1).

## At a glance

| ID   | Change ID                 | Outcome (user can …)                                                               | Prerequisites | PRD refs              | Status |
| ---- | ------------------------- | ---------------------------------------------------------------------------------- | ------------- | --------------------- | ------ |
| S-01 | log-completed-workout     | dodać ukończony trening (data, dystans, średnie tętno) i zobaczyć treningi z 7 dni | —             | FR-001, FR-002, US-01 | done   |
| S-02 | weekly-training-load      | zobaczyć na ekranie głównym obciążenie z ostatnich 7 dni jako liczbę               | S-01          | US-01, FR-003         | done   |
| S-03 | todays-workout-suggestion | wskazać samopoczucie 1-5 i zobaczyć tytuł i opis sugerowanego treningu na dziś     | S-02          | FR-003, FR-006, US-01 | done   |
| S-04 | delete-workout            | usunąć wybrany trening z listy 7 dni (po potwierdzeniu)                            | S-01          | FR-007, US-02         | done   |
| S-05 | edit-workout              | poprawić datę, dystans i średnie tętno wybranego treningu z listy 7 dni            | S-01          | FR-005, US-01, US-02  | done   |

## Baseline

What's already in place in the codebase as of `2026-10-31` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro SSR + shadcn (Button, Card, Alert); dashboard z listą 7 dni, formularz dodawania, ekran sugestii (`src/components/dashboard/DashboardView.astro`, `src/pages/dashboard/`).
- **Backend / API:** partial — `POST /api/workouts` (tworzenie) i endpointy auth (`src/pages/api/`); brak endpointów edycji i usuwania.
- **Data:** partial — tabela `workouts` z RLS tylko dla odczytu i zapisu nowych wierszy właściciela (`supabase/migrations/20261003120000_create_workouts.sql`); brak polityk update/delete.
- **Auth:** present — Supabase email + hasło, middleware `PROTECTED_ROUTES` (`src/middleware.ts`); działa na produkcji.
- **Deploy / infra:** present — Cloudflare Workers na produkcji (wersja `600fa482`, `context/deployment/deploy-plan.md`), CI z jobami `ci` i `smoke`; deploy ręczny.
- **Observability:** partial — Workers Logs i `console.error` przy błędach odczytu (`src/lib/workouts.ts`); brak trackera błędów.

## Foundations

Brak. Auth, deploy i tabela treningów już istnieją (Baseline). Brakujące polityki dostępu dla edycji i usuwania wchodzą minimalnie do wycinka, który ich potrzebuje: polityka usuwania do S-04, polityka edycji do S-05 — każda razem z testem izolacji (ryzyko #2 w `context/foundation/test-plan.md`).

## Slices

### S-01: Dodanie ukończonego treningu i lista treningów z ostatnich 7 dni

- **Outcome:** user can po zalogowaniu na ekranie głównym (na telefonie z Androidem) wybrać „dodaj trening”, wpisać datę (dzisiejszą lub z przeszłości), dystans i średnie tętno, i zobaczyć swoje treningi z ostatnich 7 dni — a żaden inny użytkownik ich nie widzi.
- **Change ID:** log-completed-workout
- **PRD refs:** FR-001, FR-002, US-01 (AC: przycisk „dodaj trening”, data/dystans/średnie tętno), NFR: dostęp wyłącznie do własnych danych, NFR: Android, NFR: wynik akcji w 1-2 s
- **Prerequisites:** — (auth present per Baseline)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pierwsza tabela z danymi użytkownika — tutaj ustala się wzorzec izolacji danych (guardrail prywatności); błąd przeniesie się na wszystkie kolejne wycinki, więc weryfikacja „użytkownik B nie widzi treningów A” jest częścią tego wycinka.
- **Status:** done

### S-02: Obciążenie treningowe z ostatnich 7 dni na ekranie głównym

- **Outcome:** user can zobaczyć na ekranie głównym wyliczone obciążenie treningowe z ostatnich 7 dni jako konkretną liczbę, aktualizowaną po dodaniu treningu.
- **Change ID:** weekly-training-load
- **PRD refs:** US-01 (AC: obciążenie z 7 dni jako liczba), FR-003 (wejście reguły sugestii)
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - ~~Jak dokładnie liczyć obciążenie z dystansu i średniego tętna (wzór i skala), tak żeby próg „np. 100” z Business Logic miał sens?~~ — Rozstrzygnięte: obciążenie = Σ (dystans_km × śr. tętno / 100) z okna today−6…today (10 km przy tętnie 150 = 15); patrz `context/archive/2026-10-03-weekly-training-load/plan.md`. — Owner: user. Block: no.
- **Risk:** Wzór obciążenia to rdzeń domeny i najbardziej ryzykowne założenie MVP (Open Question 1); zła skala unieważni próg w S-03, dlatego obciążenie jest osobnym, wcześniejszym wycinkiem.
- **Status:** done

### S-03: Sugestia treningu na dziś po wskazaniu samopoczucia

- **Outcome:** user can wybrać „sugestia na dziś”, wskazać dzisiejsze samopoczucie w skali 1-5 i zobaczyć tytuł i opis sugerowanego treningu dopasowanego do obciążenia z 7 dni i samopoczucia, z przyciskiem powrotu do poprzedniego ekranu.
- **Change ID:** todays-workout-suggestion
- **PRD refs:** FR-003, FR-006, US-01
- **Prerequisites:** S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Które wartości samopoczucia (1-5) liczą się jako „niskie”? — Owner: user. Block: no.
  - Jaki minimalny katalog sugestii (tytuł + opis) obejmuje przypadki z Business Logic poza dwoma przykładami (lekki wolny bieg vs intensywne interwały)? — Owner: user. Block: no.
- **Risk:** To gwiazda przewodnia — reguła „niskie samopoczucie nigdy nie daje treningu intensywnego” jest twardą gwarancją bezpieczeństwa i musi być zweryfikowana niezależnie od obciążenia.
- **Status:** done

### S-04: Usunięcie treningu

- **Outcome:** user can wybrać trening z listy ostatnich 7 dni na ekranie głównym, potwierdzić usunięcie i zobaczyć listę oraz obciążenie z 7 dni już bez tego treningu.
- **Change ID:** delete-workout
- **PRD refs:** FR-007, US-02 (AC: potwierdzenie usunięcia, wyłącznie własne treningi), NFR: dostęp wyłącznie do własnych danych, NFR: wynik akcji w 1-2 s
- **Prerequisites:** S-01
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pierwsza polityka dostępu poza odczytem i dodawaniem — błąd pozwoliłby usunąć cudzy trening (ryzyko #2 test-planu); dlatego izolacja „B nie usunie treningu A, A usunie swój” jest częścią wycinka. Idzie pierwsza, bo jest najmniejsza i ustala wzorzec dla S-05.
- **Status:** done

### S-05: Edycja treningu

- **Outcome:** user can wybrać „edytuj trening” przy treningu z listy ostatnich 7 dni, poprawić datę, dystans i średnie tętno z tymi samymi zasadami poprawności co przy dodawaniu, i zobaczyć poprawioną listę oraz obciążenie.
- **Change ID:** edit-workout
- **PRD refs:** FR-005, US-01 (AC: przycisk „edytuj trening”, edycja daty/dystansu/tętna), US-02 (AC: te same zasady poprawności, wyłącznie własne treningi), NFR: dostęp wyłącznie do własnych danych
- **Prerequisites:** S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Edycja nie może ominąć walidacji (ryzyko #6: nierealne dane psują obciążenie) ani przenieść treningu do innego właściciela (ryzyko #1); technicznie niezależna od S-04, ale prościej po niej, bo przejmie wybór treningu z listy.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                    | Ready for `/10x-plan` | Notes                                                        |
| ---------- | ------------------------- | -------------------------------------------------------- | --------------------- | ------------------------------------------------------------ |
| S-01       | log-completed-workout     | Dodawanie ukończonego treningu i lista z ostatnich 7 dni | done                  | M-1: `context/archive/2026-10-03-log-completed-workout/`     |
| S-02       | weekly-training-load      | Obciążenie treningowe z 7 dni na ekranie głównym         | done                  | M-1: `context/archive/2026-10-03-weekly-training-load/`      |
| S-03       | todays-workout-suggestion | Sugestia treningu na dziś po wskazaniu samopoczucia      | done                  | M-1: `context/archive/2026-10-26-todays-workout-suggestion/` |
| S-04       | delete-workout            | Usuwanie treningu z listy 7 dni                          | yes                   | Run `/10x-plan delete-workout`                               |
| S-05       | edit-workout              | Edycja treningu z listy 7 dni                            | yes                   | Run `/10x-plan edit-workout`                                 |

## Open Roadmap Questions

1. **Czy dystans + średnie tętno wystarczą jako dane wejściowe, czy sugestia wymaga bogatszych danych (tempo, teren, odczuwany wysiłek)?** — Owner: user. Block: — (świadomy kompromis MVP; wraca przy kolejnej iteracji).
2. **Czy próg obciążenia w regule sugestii powinien być zindywidualizowany per użytkownik zamiast jednej stałej wartości dla wszystkich?** — Owner: user. Block: — (MVP przyjmuje jeden wspólny próg).
3. **Jaki jest wzór obciążenia treningowego z dystansu i średniego tętna i w jakiej skali?** — Owner: user. Block: — (rozstrzygnięte w S-02: obciążenie = Σ (dystans_km × śr. tętno / 100) z okna today−6…today, np. 10 km przy tętnie 150 = 15; patrz `context/archive/2026-10-03-weekly-training-load/plan.md`).
4. **US-01 wymaga przycisku „edytuj trening” na ekranie głównym, a FR-005 (edycja) jest poza MVP — czy przycisk pokazujemy w MVP?** — Owner: user. Block: — (rozstrzygnięte 2026-10-31 w PRD v2: edycja to FR-005 must-have, przycisk wchodzi w S-05).

## Parked

- **Ustawienie celu treningowego 5K/10K/maraton (FR-004)** — Why parked: PRD §Non-Goals, nice-to-have.
- **Ocena wytrenowania i przewidywane wyniki na 5K/10K/półmaraton/maraton** — Why parked: Secondary success criterion bez FR; przy celu `speed` poza M-1.
- **Własny algorytm ML/AI do sugestii** — Why parked: PRD §Non-Goals; reguła to próg obciążenia + samopoczucie.
- **Import danych z zegarków/aplikacji (Strava, Garmin)** — Why parked: PRD §Non-Goals; dane wpisywane ręcznie.
- **Tryb trenera / współdzielone profile** — Why parked: PRD §Non-Goals; płaski model użytkowników.
- **Praca offline** — Why parked: PRD §Non-Goals.

## Milestone History

- **M-1: Pierwsza sugestia treningu na dziś** (`first-daily-suggestion`) — closed 2026-10-31. Zalogowany biegacz wpisuje treningi, widzi obciążenie z 7 dni i dostaje sugestię treningu na dziś (S-01–S-03; wszystkie konieczne FR z PRD v1).
- **M-2: Poprawianie i usuwanie treningów** (`edit-and-delete-workouts`) — closed 2026-11-01. Biegacz poprawia albo usuwa błędnie wpisany trening, a lista, obciążenie z 7 dni i sugestia liczą się z poprawionych danych (S-04, S-05; FR-005, FR-007) — pełne CRUD treningów na produkcji.

## Done

- **S-01: user can po zalogowaniu na ekranie głównym (na telefonie z Androidem) wybrać „dodaj trening”, wpisać datę (dzisiejszą lub z przeszłości), dystans i średnie tętno, i zobaczyć swoje treningi z ostatnich 7 dni — a żaden inny użytkownik ich nie widzi.** — Archived 2026-10-03 → `context/archive/2026-10-03-log-completed-workout/`. Lesson: —.
- **S-02: user can zobaczyć na ekranie głównym wyliczone obciążenie treningowe z ostatnich 7 dni jako konkretną liczbę, aktualizowaną po dodaniu treningu.** — Archived 2026-10-03 → `context/archive/2026-10-03-weekly-training-load/`. Lesson: —.
- **S-03: user can wybrać „sugestia na dziś”, wskazać dzisiejsze samopoczucie w skali 1-5 i zobaczyć tytuł i opis sugerowanego treningu dopasowanego do obciążenia z 7 dni i samopoczucia, z przyciskiem powrotu do poprzedniego ekranu.** — Archived 2026-10-31 → `context/archive/2026-10-26-todays-workout-suggestion/`. Lesson: —.
- **S-04: user can wybrać trening z listy ostatnich 7 dni na ekranie głównym, potwierdzić usunięcie i zobaczyć listę oraz obciążenie z 7 dni już bez tego treningu.** — Archived 2026-10-31 → `context/archive/2026-10-31-delete-workout/`. Lesson: —.
- **S-05: user can wybrać „edytuj trening” przy treningu z listy ostatnich 7 dni, poprawić datę, dystans i średnie tętno z tymi samymi zasadami poprawności co przy dodawaniu, i zobaczyć poprawioną listę oraz obciążenie.** — Archived 2026-11-01 → `context/archive/2026-10-31-edit-workout/`. Lesson: —.
