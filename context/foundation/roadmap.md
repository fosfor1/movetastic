---
project: Movetastic
version: 1
status: draft
created: 2026-10-01
updated: 2026-10-03
prd_version: 1
main_goal: speed
top_blocker: decisions
milestone_id: first-daily-suggestion
milestone_seq: 1
milestone_status: open
---

# Roadmap: Movetastic

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: Pierwsza sugestia treningu na dziś** — Status: open

- **Intent:** Zalogowany biegacz wpisuje swoje treningi, widzi obciążenie z ostatnich 7 dni i po wskazaniu samopoczucia dostaje sugestię dzisiejszego treningu — cały rdzeń PRD działa na produkcji.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every S-NN below is `done`.
- **Scope anchors:** FR-001, FR-002, FR-003, FR-006 (wszystkie konieczne FR), US-01.

## Vision recap

Amator biegowy trenujący samodzielnie codziennie zastanawia się, jaki trening dziś wykonać — i bez jasnego kryterium trenuje przypadkowo albo odpuszcza. Sztywne plany treningowe nie reagują na bieżącą formę i samopoczucie. Movetastic odpowiada na pytanie „co trenować dziś” na podstawie obciążenia z ostatniego tygodnia i dzisiejszego samopoczucia.

## North star

**S-03: Użytkownik wskazuje dzisiejsze samopoczucie i widzi sugestię treningu na dziś** — gwiazda przewodnia, czyli najmniejszy kompletny przepływ, którego działanie dowodzi głównej hipotezy produktu; umieszczona tak wcześnie, jak pozwalają zależności, bo wszystko inne ma znaczenie tylko wtedy, gdy ona działa. To dokładnie Primary success criterion z PRD, a przy celu `speed` reszta MVP jest tylko drogą do tego ekranu.

## At a glance

| ID   | Change ID                 | Outcome (user can …)                                                               | Prerequisites | PRD refs              | Status   |
| ---- | ------------------------- | ---------------------------------------------------------------------------------- | ------------- | --------------------- | -------- |
| S-01 | log-completed-workout     | dodać ukończony trening (data, dystans, średnie tętno) i zobaczyć treningi z 7 dni | —             | FR-001, FR-002, US-01 | done     |
| S-02 | weekly-training-load      | zobaczyć na ekranie głównym obciążenie z ostatnich 7 dni jako liczbę               | S-01          | US-01, FR-003         | done     |
| S-03 | todays-workout-suggestion | wskazać samopoczucie 1-5 i zobaczyć tytuł i opis sugerowanego treningu na dziś     | S-02          | FR-003, FR-006, US-01 | proposed |

## Baseline

What's already in place in the codebase as of `2026-10-01` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro SSR + React islands + Tailwind + shadcn (`src/layouts/Layout.astro`, `src/components/ui/button.tsx`); `/dashboard` to tylko placeholder.
- **Backend / API:** partial — endpointy istnieją tylko dla auth (`src/pages/api/auth/*`); brak endpointów domenowych.
- **Data:** partial — klient Supabase (`src/lib/supabase.ts`) i `supabase/config.toml`, ale brak `supabase/migrations/`, tabel i polityk RLS.
- **Auth:** present — rejestracja, logowanie i wylogowanie email + hasło, middleware z `PROTECTED_ROUTES` (`src/middleware.ts`); smoke test na produkcji 8/8 PASS.
- **Deploy / infra:** present — Cloudflare Workers na produkcji (`context/deployment/deploy-plan.md`, wdrożone 2026-09-26), CI gate + smoke w `.github/workflows/ci.yml`; deploy ręczny.
- **Observability:** partial — Workers Logs włączone (`wrangler.jsonc`), brak śledzenia błędów i logowania aplikacyjnego.

## Foundations

Brak. Auth i deploy są już obecne (Baseline), a brakująca warstwa danych jest wprowadzana minimalnie wewnątrz S-01 — pierwszego wycinka, który jej potrzebuje — razem z izolacją danych per użytkownik.

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
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                    | Ready for `/10x-plan` | Notes                                                                                      |
| ---------- | ------------------------- | -------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| S-01       | log-completed-workout     | Dodawanie ukończonego treningu i lista z ostatnich 7 dni | yes                   | Run `/10x-plan log-completed-workout`                                                      |
| S-02       | weekly-training-load      | Obciążenie treningowe z 7 dni na ekranie głównym         | yes                   | Wzór rozstrzygnięty (OQ3); plan: `context/archive/2026-10-03-weekly-training-load/plan.md` |
| S-03       | todays-workout-suggestion | Sugestia treningu na dziś po wskazaniu samopoczucia      | no                    | Po S-02; gwiazda przewodnia; wzór obciążenia już rozstrzygnięty (OQ3)                      |

## Open Roadmap Questions

1. **Czy dystans + średnie tętno wystarczą jako dane wejściowe, czy sugestia wymaga bogatszych danych (tempo, teren, odczuwany wysiłek)?** — Owner: user. Block: — (świadomy kompromis MVP; wraca przy kolejnej iteracji).
2. **Czy próg obciążenia w regule sugestii powinien być zindywidualizowany per użytkownik zamiast jednej stałej wartości dla wszystkich?** — Owner: user. Block: — (MVP przyjmuje jeden wspólny próg).
3. **Jaki jest wzór obciążenia treningowego z dystansu i średniego tętna i w jakiej skali?** — Owner: user. Block: — (rozstrzygnięte w S-02: obciążenie = Σ (dystans_km × śr. tętno / 100) z okna today−6…today, np. 10 km przy tętnie 150 = 15; patrz `context/archive/2026-10-03-weekly-training-load/plan.md`).
4. **US-01 wymaga przycisku „edytuj trening” na ekranie głównym, a FR-005 (edycja) jest poza MVP — czy przycisk pokazujemy w MVP?** — Owner: user. Block: — (do czasu decyzji S-01 pokazuje tylko „dodaj trening” i „sugestia na dziś”; edycja w Parked).

## Parked

- **Edycja wcześniej wprowadzonych treningów (FR-005)** — Why parked: PRD §Non-Goals, obniżone do nice-to-have; patrz Open Roadmap Question 4.
- **Ustawienie celu treningowego 5K/10K/maraton (FR-004)** — Why parked: PRD §Non-Goals, nice-to-have.
- **Ocena wytrenowania i przewidywane wyniki na 5K/10K/półmaraton/maraton** — Why parked: Secondary success criterion bez FR; przy celu `speed` poza M-1.
- **Własny algorytm ML/AI do sugestii** — Why parked: PRD §Non-Goals; reguła to próg obciążenia + samopoczucie.
- **Import danych z zegarków/aplikacji (Strava, Garmin)** — Why parked: PRD §Non-Goals; dane wpisywane ręcznie.
- **Tryb trenera / współdzielone profile** — Why parked: PRD §Non-Goals; płaski model użytkowników.
- **Praca offline** — Why parked: PRD §Non-Goals.

## Milestone History

## Done

- **S-01: user can po zalogowaniu na ekranie głównym (na telefonie z Androidem) wybrać „dodaj trening”, wpisać datę (dzisiejszą lub z przeszłości), dystans i średnie tętno, i zobaczyć swoje treningi z ostatnich 7 dni — a żaden inny użytkownik ich nie widzi.** — Archived 2026-10-03 → `context/archive/2026-10-03-log-completed-workout/`. Lesson: —.
- **S-02: user can zobaczyć na ekranie głównym wyliczone obciążenie treningowe z ostatnich 7 dni jako konkretną liczbę, aktualizowaną po dodaniu treningu.** — Archived 2026-10-03 → `context/archive/2026-10-03-weekly-training-load/`. Lesson: —.
