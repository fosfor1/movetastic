# Odświeżenie test-plan.md (2026-10-13) — Plan Brief

> Full plan: `context/changes/test-plan-refresh-2026-10-13/plan.md`
> Research: `context/changes/test-plan-refresh-2026-10-13/research.md`

## What & Why

`context/foundation/test-plan.md` opisuje stan z 2026-10-11: „brak E2E”, hook „zalecany”, bramka CI na końcu kolejki.
Od tego czasu doszły Playwright, hooki i wywiad 2026-10-13, w którym największą luką okazało się to, że żaden test
nie biegnie w CI. Odświeżenie urealnia plan i ustawia bramkę CI jako następną fazę.

## Starting Point

Vitest (`integration` 3 pliki, `hooks` 1 plik), Playwright 1.64 (setup, seed, workout-log-roundtrip), hooki
podłączone w `c3c172c`; CI uruchamia tylko lint/check/build i smoke. Faza 2 w §3 ma status `change opened` bez folderu.

## Desired End State

Plan testów zgadza się z repo; §2 ma zmienione #6 i nowe #7 (fałszywie zielony bieg) oraz #8 (przepływ zapisu
treningu); §3 kolejność: Izolacja (complete) → Bramka CI → Reguły obciążenia/walidacji → Reguła sugestii, plus
wiersz complete dla E2E #8; §6 ma wzorzec E2E; §7 wpis o hookach. `/10x-test-plan` sam wybiera bramkę CI jako następną.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| #6 prawdopodobieństwo | Zostaje Low; Must challenge: „wspólny moduł = API go wywołuje”, „smoke z 2 przypadkami = granice pokryte” | Jeden walidator wyklucza dryf reguł; luką jest wiązanie w API i brak testów granic | Research + Plan |
| Q2 fałszywie zielony bieg | Nowe ryzyko #7 (Medium × Medium) pokryte fazą bramki CI | Bez wiersza §2 research fazy CI nie ugruntuje odpowiedzi | Plan |
| workout-log-roundtrip | Nowe ryzyko #8 (Medium × Low), w §3 jako complete | Spec chroni nazwany scenariusz, nie granice okna #5 | Plan |
| Kolejność faz | Przenumerowanie: 2 = Bramka CI, 3 = Reguły, 4 = Sugestia | Orkiestrator wznawia od pierwszego niezakończonego wiersza | Plan (Q4) |
| Faza reguł bez folderu | Status → `not started`, folder `—` | §3 ma odpowiadać repo; folder powstanie przez `/10x-new` | Research + Plan |
| Testy hooków | Zostają lokalnie; CI uruchamia `test:integration`, nie `npm test`; wpis w §7 | Q5: brak budżetu na narzędzia, bez wyrzucania działającego dowodu | Plan (Q5) |
| `test-stack.md` | Tylko link z §4 | Sekcja `## E2E` należy do `/10x-e2e-setup` | Research |

## Scope

**In scope:**
- §4, §5, §8 (fakty), §2 (#6, #7, #8), §3 (kolejność, statusy), §6 (wzorzec E2E, odwołania), §7 (hooki), nagłówek `Last updated`.

**Out of scope:**
- §1 (skan hot-spot idzie do §8), inne wiersze §2, `test-stack.md`, `ci.yml`, testy, kod, folder fazy reguł, usuwanie `tests/hooks/`.

## Architecture / Approach

Trzy fazy po sekcjach jednego pliku: fakty bez decyzji → zatwierdzone pozycje §2 → przenumerowanie §3 z
aktualizacją odwołań w §5/§6 oraz nowy wzorzec E2E i wpis §7 (ostatnia faza, jak wymagał brief zmiany).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fakty — §4, §5, §8 | Profil „sparse”, Playwright, hook podłączony, daty i skan hot-spot | Pominięta nieaktualna fraza |
| 2. §2 Risk Map | #6 zmienione, #7 i #8 dodane z Response Guidance | Dryf poza zatwierdzone wiersze |
| 3. §3, §6, §7 | Nowa kolejność faz, wzorzec E2E, wpis o hookach | Stare odwołanie „§3 Phase N” |

**Prerequisites:** research.md (gotowy); brak potrzeby serwera ani Supabase.
**Estimated effort:** ~1 sesja, 3 krótkie fazy w jednym pliku.

## Open Risks & Assumptions

- Zakładamy, że `/10x-test-plan --status` wybiera pierwszy niezakończony wiersz §3 (wiersz 5 `complete` za niezakończonymi go nie zmyli).
- Niezweryfikowane fakty dla przyszłej Fazy 2 (CI): `npx supabase` obok `setup-cli`, limit rejestracji 30/5 min.

## Success Criteria (Summary)

- Nikt czytający plan testów nie trafi na „brak E2E” ani „hook zalecany”.
- Następne wywołanie `/10x-test-plan` otwiera bramkę CI, z ryzykiem #7 i wskazówkami gotowymi dla research.
- Nowy test E2E da się dodać według §6 bez czytania istniejących speców.
