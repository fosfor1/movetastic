---
date: 2026-10-13T21:47:05+02:00
researcher: Claude (Opus 5.5) dla Sebastian Kowalski
git_commit: 301b83ba8f02abe87b1df1dc55e0b7ff190ba68f
branch: m3l4-e2e
repository: movetastic
topic: "Odświeżenie context/foundation/test-plan.md (2026-10-13): weryfikacja nieaktualnych wpisów §3–§6 i ugruntowanie wywiadu Q2–Q5"
tags: [research, testing, test-plan, playwright, e2e, ci, validation, hooks]
status: complete
last_updated: 2026-10-13
last_updated_by: Claude (Opus 5.5)
---

# Research: odświeżenie planu testów (2026-10-13)

**Date**: 2026-10-13T21:47:05+02:00
**Researcher**: Claude (Opus 5.5) dla Sebastian Kowalski
**Git Commit**: 301b83ba8f02abe87b1df1dc55e0b7ff190ba68f
**Branch**: m3l4-e2e
**Repository**: movetastic

## Research Question

Z `change.md`: zweryfikować w repozytorium twierdzenia o nieaktualnych sekcjach `test-plan.md`
(§3, §4, §5, §6) oraz ugruntować kandydatów z wywiadu 2026-10-13: Q2 (fałszywie zielony bieg na
starym serwerze), Q3 (walidacja formularz vs API — czy jedno źródło reguł, gdzie może dryfować),
Q4 (co jest potrzebne, by testy szły w CI), Q5 (konflikt „nie testujemy hooków” z istniejącym
projektem `hooks`). Decyzje produktowe (§1/§2, Q5, workout-log-roundtrip) należą do użytkownika —
research podaje tylko fakty.

## Summary

- **Twierdzenia briefu o §3–§6: potwierdzone, z dwiema korektami.**
  (a) `tests/e2e/` zawiera 3 pliki testowe (`auth.setup.ts`, `seed.spec.ts`,
  `workout-log-roundtrip.spec.ts`) **plus 2 helpery** (`helpers/hydration.ts`, `helpers/local-db.ts`) — 5 plików razem.
  (b) Faza 2 ma w §3 status `change opened` i folder `context/changes/testing-load-and-validation-rules/`
  (`test-plan.md:68`), ale **ten folder nie istnieje** — commit `301b83b` zmienił tylko `test-plan.md` (1 plik, 6+/6−).
- **Q3 — przesłanka „walidacja żyje w dwóch miejscach” jest w części sprzeczna z kodem.** Formularz i API
  importują **jeden** moduł `src/lib/workout-validation.ts` (`WorkoutForm.tsx:6`, `api/workouts.ts:4`); te dwa
  importy to jedyni konsumenci w `src/` (grep `workout-validation` w `src/`). Zakresy liczbowe są powtórzone w DB `CHECK`
  i są zgodne. Realne miejsca dryfu są trzy i węższe niż w briefie: (1) `today` w formularzu jest zamrożony przy SSR,
  a serwer liczy go na każde żądanie; (2) `scripts/smoke.mjs` ma własną kopię logiki „dziś wg Warszawy”;
  (3) API mogłoby przestać wywoływać walidator — chroni przed tym tylko smoke z 2 przypadkami negatywnymi.
  Podniesienie prawdopodobieństwa #6 (Low → Medium) **nie ma oparcia w dryfie reguł**; ma oparcie najwyżej
  w braku testów (brak unit testów walidatora, 2 negatywne przypadki serwerowe). To decyzja użytkownika.
- **Q2 — fałszywie zielony bieg: potwierdzony mechanizm, brak jakiejkolwiek kontroli świeżości buildu.**
  Poza CI Playwright używa każdego procesu odpowiadającego na `baseURL` (`playwright.config.ts:38`), a integracja
  akceptuje dowolną odpowiedź HTTP (`global-setup.ts:61-62`). Oba runnery domyślnie celują w ten sam port 4321,
  na którym bywa też `npm run dev`. W `.astro/` leżą lockfile’y daemonów w tle: `preview.json` (pid 2764,
  4321, `background: true`, 2026-10-13T13:36Z) i `dev.json` (pid 1364, 4321, `background: true`, 2026-10-12T13:29Z);
  w chwili badania na 4321 nic nie odpowiadało.
- **Q4 — CI: wykonalne bez nowych sekretów dla integracji; E2E potrzebuje kroku tworzącego użytkownika.**
  Job `smoke` już stawia lokalny Supabase i build+preview na 4321 (`ci.yml:40-54`). Integracja tworzy konta
  sama (`helpers/supabase.ts`). E2E czyta `E2E_USERNAME`/`E2E_PASSWORD` i **nic go nie tworzy**
  (`auth.setup.ts:6-10`); brak też `npx playwright install` i skryptu `test:e2e` w `package.json`.
- **Q5 — konflikt potwierdzony.** Projekt Vitest `hooks` (`vitest.config.ts:20-28`) i `test:hooks`
  (`package.json:17`) istnieją; `npm test` = `vitest run` (`package.json:15`) uruchamia **oba** projekty,
  więc bramka CI oparta o `npm test` objęłaby też testy hooków.

## Detailed Findings

### §4 Stack — stan faktyczny (2026-10-13)

- Vitest 5 z dwoma projektami: `integration` (`vitest.config.ts:8-19`, 3 pliki `*.test.ts` w `tests/integration/`)
  i `hooks` (`vitest.config.ts:20-28`, 1 plik `tests/hooks/agent-hooks.test.ts`). Brak projektu `unit`;
  w repo nie ma testów logiki domenowej (grep `tests/` — tylko pliki wymienione wyżej).
- Playwright: `@playwright/test` `^1.64.0` (`package.json:44`), `npx playwright --version` → 1.64.0;
  `playwright-cli` 0.1.22 (`npx playwright-cli --version`). Konfiguracja: projekt `setup` + `chromium`
  z `storageState: playwright/.auth/user.json` (`playwright.config.ts:26-33`).
- `context/foundation/test-stack.md` `## E2E` rejestruje runner, port, komendę serwera
  („reuseExistingServer outside CI”), projekt setup, storageState i seed `auth-gate-roundtrip`; `updated: 2026-10-13`.
  Nie ostrzega przed ryzykiem stale-server.
- Wpis §4 „profil none” i wiersz e2e „none — świadomie” (`test-plan.md:76`, `:83`): **nieaktualne**.
  Wiersz unit+integration (`:80`) „dziś `integration`”: nieaktualny w części (doszedł `hooks`); reszta (wersje vitest/postgres, testy nie importują kodu aplikacji) — nie podważona w tym badaniu.

### §5 Quality Gates — stan faktyczny

- Hook po edycji jest podłączony: `.claude/settings.json` `PostToolUse` (matcher `Write|Edit`) →
  `.claude/hooks/lint-edited-file.mjs` oraz `Stop` → `.claude/hooks/end-of-turn.mjs`; wprowadzone w `c3c172c`
  (2026-10-12). Wiersz §5 „post-edit hook … recommended after §3 Phase 4” (`test-plan.md:100`): **nieaktualny**.
- `ci.yml` ma 2 joby: `ci` (`npm ci`, `astro sync`, `lint`, `lint:ui`, `astro check`, `build`; `ci.yml:18-23`)
  i `smoke` (`ci.yml:28-56`). Żaden krok nie uruchamia `vitest` ani `playwright` — wiersz §5 „unit + integration …
  required after Phase 4” (`test-plan.md:99`) pozostaje **prawdziwy co do stanu** (niepodłączone).

### §3 Phased Rollout

- Faza 4 (`test-plan.md:70`) opisuje dwa elementy: „testy jako wymagana bramka CI” i „lokalny hook po edycji”.
  Drugi jest dostarczony (`c3c172c`), pierwszy nie (`ci.yml` jak wyżej). Status `not started` jest nieaktualny w części.
- Faza 2 (`test-plan.md:68`): status `change opened` wskazuje folder, którego brak (`ls context/changes/` →
  `README.md`, `bootstrap-verification`, `test-plan-refresh-2026-10-13`, `testing-data-isolation-and-access`).

### Q3 — walidacja formularza i `POST /api/workouts`

- Jedno źródło reguł: nagłówek `src/lib/workout-validation.ts:1` („Single source of workout input rules, shared by
  the React form and the API”); stałe `DISTANCE_KM_MIN = 0.1`, `MAX = 200`, `AVG_HEART_RATE_MIN = 30`, `MAX = 230`
  (`:4-8`); reguła daty „nie z przyszłości” to porównanie stringów `workoutDate > today` (`:40-41`), `today` podaje wywołujący.
- Wywołania: formularz `WorkoutForm.tsx:20-23` (`today` z propsa), API `api/workouts.ts:28-35`
  (`todayInAppTimeZone()` z `src/lib/dates.ts`, strefa `Europe/Warsaw`, `dates.ts:3`).
- Tabela dryfu (pola: data, dystans, tętno — innych pól w formularzu/API/typach/DB brak, `src/types.ts:12-17`):

  | Pole | Formularz | API | DB `CHECK` (`20261003120000_create_workouts.sql`) | Zgodne? |
  | --- | --- | --- | --- | --- |
  | data: format/kalendarz | wspólny walidator | wspólny walidator | `date not null` (:7) | tak |
  | data: nie z przyszłości | `<= today`, Warszawa, **zamrożone przy SSR** (`new.astro:7`) | `<= today`, Warszawa, na żądanie | brak (celowo) | reguła ta sama; formularz otwarty przez północ jest **surowszy** od serwera (odrzuca nowy dzień) |
  | dystans | 0.1–200, ≤2 miejsca, `,`/`.` | to samo | `numeric(5,2) check between 0.1 and 200` (:8) | tak |
  | tętno | całkowite 30–230 | to samo | `smallint check between 30 and 230` (:9) | tak |

  Ocena: na tej sprawdzonej ścieżce dryf reguł klient/serwer jest wykluczony strukturalnie. Wariant groźny dla #6
  (serwer luźniejszy od klienta) wymagałby usunięcia wywołania walidatora z API albo zmiany kolejności
  (dziś: walidacja `:28-35` przed insertem `:42`, nic nie jest zapisywane przed walidacją).
- Odpowiedź serwera na błąd: 302 → `/dashboard/workouts/new?error=<pierwszy komunikat>` (`api/workouts.ts:10`, `:37-40`);
  błąd insertu (CHECK/RLS) → 302 z ogólnym komunikatem (`src/lib/workouts.ts:63-67`).
- Istniejące testy: `scripts/smoke.mjs:119-121` (HR 500 → 302 `?error=`), `:124-126` (data +2 dni → 302 `?error=`);
  smoke liczy datę własną kopią logiki Warszawy (`smoke.mjs:13` i helpery obok), nie importuje `dates.ts`.
  `workout-log-roundtrip.spec.ts` — tylko happy path. `rls-workouts.test.ts` — RLS, bez CHECK. Unit testów walidatora brak
  (decyzja archiwalna: `archive/2026-10-03-log-completed-workout/plan.md:248`).
- Niepokryte automatem: granice dystansu (0.09/0.1/200/200.01, 3 miejsca po przecinku), granice tętna (29/30/230/231,
  wartość niecałkowita), nieistniejąca data kalendarzowa, „dziś” dozwolone, Warszawa vs UTC około północy, DB `CHECK` samodzielnie.
- Wniosek dla §2 #6 (Must challenge): sugerowane w briefie „client validation passing = server enforces the same rule”
  jest dziś prawdą z konstrukcji; trafniejsze zagrożenie do zakwestionowania to „wspólny moduł = serwer go wywołuje”
  (wiązanie w API, nie same reguły) oraz „smoke z 2 przypadkami = granice pokryte”. Najtańsza warstwa bez zmian:
  unit walidatora (tabela granic, wstrzyknięte `today`) + jeden test integracyjny endpointu (bezpośredni POST → 302 `?error=`
  i brak wiersza w bazie).

### Q2 — bieg przeciw staremu serwerowi

- E2E: `webServer.command = npm run build && npm run preview -- --port ${PORT}` (`playwright.config.ts:36`),
  `url: baseURL` (`:37`, port `E2E_PORT ?? 4321`, `:11-12`), `reuseExistingServer: !process.env.CI` (`:38`).
  Warunek fałszywej zieleni: poza CI, gdy cokolwiek odpowiada na `baseURL`, Playwright **nie wykonuje** `build` i testuje
  ten proces — np. `astro preview` starego `dist/`, `npm run dev` z innego brancha, daemon w tle.
- `ASTRO_PREVIEW_BACKGROUND: "1"` (`playwright.config.ts:42`) działa zgodnie z komentarzem: w Astro 7
  `agentDetected = !process.env.ASTRO_PREVIEW_BACKGROUND && isRunByAgent()` (`node_modules/astro/dist/cli/preview/index.js:45`),
  więc ustawiona zmienna wyłącza automatyczne przejście w tło. Bez niej `astro preview` uruchomione przez agenta
  (np. ręcznie, poza Playwrightem) staje się daemonem — to pasuje do lockfile’i `background: true` w `.astro/`.
- Dodatkowo `astro preview` na pierwszym planie odmawia startu, gdy lockfile wskazuje żywy serwer
  („Another astro preview server is already running”, `preview/index.js:~117-124`) — więc nawet w CI-podobnym trybie
  pozostawiony daemon nie zostanie „zastąpiony” po cichu, tylko wywoła błąd lub (lokalnie) zostanie użyty przez reuse.
- Integracja: nie startuje serwera; `checkAppServer` uznaje każdą odpowiedź za sukces (`global-setup.ts:59-70`),
  domyślny `BASE_URL` to `http://localhost:4321` (`:78`). Kontrole Supabase (API, Postgres) nie sprawdzają stanu migracji.
- Kontrola świeżości buildu: brak — grep po `tests/` i `playwright.config.ts` (`dist`, `mtime`, `BUILD_ID`, rev gita) bez trafień.
- CI: przy `CI` ustawionym serwer nigdy nie jest reużywany (`:38`), ale E2E w CI nie biegnie.
- Najtańsza warstwa zgodna z intencją briefu: proces/bramka (CI zawsze zimny serwer; lokalnie reguła zimnego biegu,
  np. `reuseExistingServer: false` lub sprawdzenie braku procesu na porcie / lockfile’a przed biegiem) + celowe złamanie
  (deliberate-break) jako dowód. To kierunek, nie decyzja — wybór należy do planu.

### Q4 — co jest potrzebne do bramki CI

- Integracja (`npm run test:integration`): ten sam setup co job `smoke` (Supabase start `ci.yml:40-43`, `.env`/`.dev.vars`
  `:44-48`, build `:49`, preview na 4321 + pętla oczekiwania `:52-53`), potem `BASE_URL=http://localhost:4321 npm run test:integration`.
  `global-setup.ts:13` wywołuje `npx supabase status -o env` po `API_URL`, `ANON_KEY`, `DB_URL` — sekrety niepotrzebne.
  Niezweryfikowane: czy `npx supabase` rozwiązuje się w CI obok binarki z `supabase/setup-cli` (`ci.yml:36-38`).
- E2E: potrzebne (1) `npx playwright install --with-deps chromium` — dziś brak w repo; (2) użytkownik E2E: `auth.setup.ts:6-10`
  rzuca błąd bez `E2E_USERNAME`/`E2E_PASSWORD`, nic go nie tworzy (`test-stack.md:14`: ręcznie tworzony lokalny user) —
  w CI wystarczy krok rejestracji (np. `POST /api/auth/signup`, potwierdzenia wyłączone `supabase/config.toml:209`) i zwykłe
  zmienne joba (efemeryczny lokalny Supabase, nie sekrety); (3) port: webServer w CI zawsze buduje sam, więc wspólny job ze
  smoke na 4321 koliduje — osobny job albo inny `E2E_PORT`; (4) sprzątanie przez `helpers/local-db.ts` (localhost `DB_URL`) działa
  na lokalnym Supabase w CI.
- Ryzyko niezweryfikowane: limit `sign_in_sign_ups = 30` / 5 min / IP (`supabase/config.toml:191`) przy smoke + integracja + E2E w jednym biegu.
- Skrypty: `test` (wszystkie projekty Vitest), `test:integration`, `test:hooks` (`package.json:15-17`); **brak** `test:e2e`.

### Q5 — testy hooków

- `tests/hooks/agent-hooks.test.ts` (421 linii, `c3c172c`) w projekcie `hooks` (`vitest.config.ts:20-28`, komentarz: „Proof for the
  Claude Code hooks in .claude/hooks/”). Nie dotyka produktu (brak odwołań do workouts). `npm test` uruchamia go razem z integracją.
- Konsekwencja dla planu: jeśli bramka CI używa `npm test`, testy hooków wejdą do CI; jeśli `npm run test:integration` — nie.
  Wybór „zostaw / usuń” pozostaje decyzją użytkownika.

### workout-log-roundtrip (do decyzji §2/§3)

- `tests/e2e/workout-log-roundtrip.spec.ts:22`: „a workout logged through the form appears in the 7-day list and persists after reload”.
  Asercje: przekierowanie na `/dashboard`, widoczny nagłówek „Ostatnie 7 dni” i element listy „X,XX km · śr. tętno N ud/min”,
  także po reloadzie (`:29-45`). Sprzątanie: `afterEach` oczekuje dokładnie 1 usuniętego wiersza (`:16-20`) przez bezpośredni
  `delete` w lokalnym Postgresie (`helpers/local-db.ts:22-36`, odmawia hosta innego niż localhost/127.0.0.1, `:11-16`) — brak
  trasy/polityki delete. Unikalne dane z `Date.now()` (`:10-13`). Użytkownik E2E nie jest usuwany.
- Żadne z istniejących ryzyk §2 (#1–#6) nie opisuje tego scenariusza wprost; najbliżej #5 (lista/obciążenie 7 dni), ale spec
  nie sprawdza liczby obciążenia ani granic okna.

## Code References

- `src/lib/workout-validation.ts:1-8,36-41` — wspólny walidator, stałe zakresów, reguła „nie z przyszłości”
- `src/components/workouts/WorkoutForm.tsx:6,20-23` — import i wywołanie w formularzu
- `src/pages/api/workouts.ts:4,10,28-42` — import, wywołanie, 302 `?error=`, insert po walidacji
- `src/pages/dashboard/workouts/new.astro:7` — `today` liczony przy SSR
- `src/lib/dates.ts:3` — `APP_TIME_ZONE = "Europe/Warsaw"`
- `supabase/migrations/20261003120000_create_workouts.sql:7-9` — `CHECK` zakresów
- `scripts/smoke.mjs:13,119-126` — kopia logiki daty, 2 przypadki negatywne
- `playwright.config.ts:11-12,26-42` — port, projekty, webServer z `reuseExistingServer: !process.env.CI`
- `tests/integration/setup/global-setup.ts:59-70,78` — `checkAppServer` akceptuje dowolną odpowiedź; domyślny `BASE_URL`
- `node_modules/astro/dist/cli/preview/index.js:45,~117-124` — auto-tło dla agentów; odmowa startu przy żywym lockfile’u
- `.astro/preview.json`, `.astro/dev.json` — lockfile’y daemonów w tle na 4321
- `.github/workflows/ci.yml:18-23,28-56` — joby `ci` i `smoke`; brak kroków vitest/playwright
- `tests/e2e/auth.setup.ts:6-10` — wymagane `E2E_USERNAME`/`E2E_PASSWORD`
- `tests/e2e/helpers/local-db.ts:11-36` — sprzątanie przez lokalny Postgres
- `vitest.config.ts:8-28`, `package.json:15-17,44` — projekty Vitest, skrypty, wersja Playwright
- `.claude/settings.json` (`hooks.PostToolUse`, `hooks.Stop`) — hooki podłączone

## Architecture Insights

- Projekt świadomie trzyma reguły wejścia w jednym czystym module (bez `astro:*`), co czyni go tanim celem unit testów —
  brakuje tylko projektu `unit` w `vitest.config.ts`.
- Oba runnery (integracja, E2E) zakładają „coś na 4321” bez tożsamości serwera; dev i preview dzielą ten port.
- Sprzątanie E2E bez trasy delete idzie przez lokalny Postgres z twardym strażnikiem localhost — wzorzec do §6.

## Historical Context (from prior changes)

- `context/archive/2026-10-03-log-completed-workout/plan-brief.md:23` — „One shared validator (form + API) plus DB `CHECK` for ranges | Rules can't drift” (potwierdzone kodem).
- `context/archive/2026-10-03-log-completed-workout/plan.md:31` — „nie z przyszłości” nie jako `CHECK`, tylko walidator + API (potwierdzone).
- `context/archive/2026-10-03-log-completed-workout/plan.md:248` — brak runnera unit; przypadki brzegowe tylko ręcznie (stan nadal aktualny co do braku unit testów; runner Vitest już istnieje).
- `context/changes/testing-data-isolation-and-access/` — Faza 1 (complete), wzorce §6.1–6.3.
- Twierdzenia briefu, punkt po punkcie: §4 profil „sparse” — potwierdzone; „3 files in tests/e2e” — częściowe (3 testowe + 2 helpery);
  §5 hook — potwierdzone; §5 testy nie w CI — potwierdzone; §3 Faza 4 częściowo dostarczona — potwierdzone; §3 Faza 2 „change opened” —
  częściowe (status w pliku, brak folderu); §6 brak wzorca E2E — potwierdzone (`test-plan.md:103-153`); Q3 „validation lives in two places” —
  sprzeczne co do źródła reguł (jedno), potwierdzone co do dwóch miejsc wywołania; hot-spot „No code churn since 2026-10-11” — nie weryfikowane w tym badaniu.

## Related Research

- `context/changes/testing-data-isolation-and-access/research.md` — ugruntowanie Fazy 1 (#1, #2, #4).

## Open Questions

Decyzje użytkownika (nie rozstrzyga ich research):
1. #6: zostawić Likelihood Low (reguły nie mogą dryfować) czy podnieść do Medium z uzasadnieniem „brak testów serwerowych granic”?
   Którą „Must challenge” przyjąć (brief vs „wspólny moduł = serwer go wywołuje”)?
2. Q5: testy hooków — zostawić bez nowego budżetu czy usunąć; i czy bramka CI używa `npm test` (obejmuje hooki) czy `test:integration`.
3. workout-log-roundtrip: dopisać do §2/§3 jako pokrycie E2E (nowe ryzyko lub rozszerzenie #5) czy zostawić poza planem.
4. Kolejność faz: bramka CI (reszta Fazy 4) przed Fazami 2–3?
5. Faza 2: utworzyć brakujący folder `testing-load-and-validation-rules` czy cofnąć status do `not started`.

Niezweryfikowane fakty techniczne: rozwiązywanie `npx supabase` w CI obok `setup-cli`; limit rejestracji przy wszystkich zestawach w jednym biegu;
zachowanie `todayInAppTimeZone` przy 22:00–24:00 UTC (logika `Intl` wygląda poprawnie, brak testu).
