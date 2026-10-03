---
project: "Movetastic"
version: 1
status: draft
created: 2026-09-18
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Amator biegowy trenujący samodzielnie do celu (np. 5K, 10K, maraton) każdego dnia staje przed pytaniem, jaki trening dziś wykonać. Bez jasnego kryterium wyboru ulega paraliżowi decyzyjnemu — w efekcie robi przypadkowy trening albo w ogóle odpuszcza, przez co nie robi takich postępów, jakie mógłby robić.

Gotowe plany treningowe (PDF-y, popularne aplikacje biegowe) są sztywne — zakładają z góry ustalony harmonogram i nie reagują na bieżącą formę czy samopoczucie biegacza tego konkretnego dnia. Dlatego nie rozwiązują realnego problemu: codziennej decyzji "co trenować dziś", tylko narzucają plan sprzed tygodni.

## User & Persona

**Amator biegowy trenujący samodzielnie do celu** (np. 5K, 10K, maraton), bez trenera personalnego. Sięga po produkt każdego dnia przed treningiem, w momencie, gdy musi zdecydować, co dziś zrobić — i bez pomocy albo trenuje przypadkowo, albo odpuszcza.

## Success Criteria

### Primary
- Użytkownik otwiera aplikację i widzi sugestię dzisiejszego treningu, dopasowaną do obciążenia treningowego z poprzedniego tygodnia (np. po tygodniu wolnego biegania aplikacja sugeruje interwały o wysokiej intensywności).

### Secondary
- Ocena aktualnego poziomu wytrenowania i przewidywane wyniki na dystansach 5K, 10K, półmaraton i maraton.

### Guardrails
- Prywatność danych treningowych użytkownika musi być zachowana.

## User Stories

### US-01: Użytkownik przegląda sugestię treningu na dziś

- **Given** zalogowany użytkownik na ekranie głównym (widoczne obliczone obciążenie z ostatnich 7 dni)
- **When** użytkownik wybiera przycisk "sugestia na dziś" i wskazuje dzisiejsze samopoczucie w skali 1-5
- **Then** widzi tytuł i opis sugerowanego treningu, dopasowanego do obciążenia z ostatniego tygodnia i wskazanego samopoczucia, oraz przycisk powrotu do poprzedniego ekranu

#### Acceptance Criteria
- Ekran główny pokazuje wyliczone obciążenie treningowe z ostatnich 7 dni jako konkretną liczbę
- Ekran główny zawiera trzy przyciski: "dodaj trening", "edytuj trening", "sugestia na dziś"
- Po wybraniu "sugestia na dziś" użytkownik najpierw wskazuje dzisiejsze samopoczucie w skali 1-5, zanim zobaczy sugestię
- Po wybraniu "dodaj trening" użytkownik wprowadza datę, dystans i średnie tętno
- Po wybraniu "edytuj trening" użytkownik wybiera jeden z treningów z ostatniego tygodnia i edytuje wcześniej wprowadzone dane (datę, dystans, średnie tętno)

## Functional Requirements

- FR-001: Użytkownik może zalogować się do aplikacji (email + hasło). Priority: must-have
  > Socrates: Kontrargument rozważony: "logowanie to zbędne tarcie dla pojedynczego użytkownika, lokalny profil wystarczyłby". Rozstrzygnięcie: pozostaje must-have — dane treningowe są prywatne (guardrail) i aplikacja ma działać wieloplatformowo; decyzja spójna z Access Control.
- FR-002: Użytkownik może dodać ukończony trening (z przeszłości i z dzisiaj). Priority: must-have
  > Socrates: Kontrargument rozważony: "dystans + średnie tętno to za mało danych, żeby dobrze oszacować obciążenie (brak tempa, terenu, interwałów)". Rozstrzygnięcie: pozostaje must-have z zakresem dystans + średnie tętno na MVP; bogatsze dane wejściowe to przyszłe rozszerzenie (patrz Open Questions).
- FR-003: Użytkownik może zobaczyć sugestię treningu na dzisiaj, dopasowaną do obciążenia z ostatniego tygodnia. Priority: must-have
  > Socrates: Kontrargument rozważony: "sugestia oparta wyłącznie na historii, bez sygnału o dzisiejszym samopoczuciu, może polecić trening wysokiej intensywności mimo zmęczenia/kontuzji — powielając problem sztywnych planów". Rozstrzygnięcie: sugestia uwzględnia teraz też dzisiejsze samopoczucie — patrz FR-006.
- FR-004: Użytkownik może ustawić swój cel treningowy (5K/10K/maraton). Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "cel niepotrzebny w MVP — sugestia na dziś (FR-003) działa bez znajomości celu". Rozstrzygnięcie: obniżone do nice-to-have; poza MVP (patrz Non-Goals).
- FR-005: Użytkownik może edytować wcześniej wprowadzone dane treningowe. Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "edycja to zbędny zakres na MVP — główny przepływ (dodaj + zobacz sugestię) działa bez niej". Rozstrzygnięcie: obniżone do nice-to-have; poza MVP (patrz Non-Goals).
- FR-006: Użytkownik może wskazać dzisiejsze samopoczucie w skali 1-5 przed zobaczeniem sugestii treningu na dziś. Priority: must-have

## Non-Functional Requirements

- Użytkownik widzi wynik dowolnej akcji (np. zapisanie treningu, wyświetlenie sugestii) w ciągu 1-2s.
- Zalogowany użytkownik ma dostęp wyłącznie do własnych danych treningowych; żaden inny użytkownik nie może ich podejrzeć.
- Produkt działa na telefonach z systemem Android (MVP).

## Business Logic

Aplikacja sugeruje dzisiejszy trening na podstawie obciążenia treningowego z ostatniego tygodnia i wskazanego dzisiejszego samopoczucia: jeśli obciążenie przekroczy wartość progową (np. 100) lub samopoczucie jest niskie, sugeruje lekki wolny trening — a przy niskim samopoczuciu nigdy nie sugeruje treningu intensywnego, niezależnie od wyliczonego obciążenia.

Reguła korzysta z dwóch danych wejściowych widocznych dla użytkownika: wyliczonego obciążenia treningowego z ostatnich 7 dni (na podstawie wprowadzonych treningów — dystansu i średniego tętna) oraz wskazanego dzisiejszego samopoczucia (skala 1-5). Jej wynikiem jest tytuł i opis sugerowanego treningu na dziś (np. lekki wolny bieg vs. intensywne interwały). Użytkownik spotyka tę regułę po wybraniu przycisku "sugestia na dziś" na ekranie głównym i wskazaniu samopoczucia — wtedy widzi dopasowaną sugestię.

## Access Control

Logowanie email + hasło. Płaski model użytkowników — każdy zalogowany użytkownik widzi i zarządza wyłącznie swoimi własnymi treningami; brak ról (admin/member) w MVP.

## Non-Goals

- Bez budowy własnego zaawansowanego algorytmu ML/AI — reguła sugestii to prosty próg obciążenia + samopoczucie, nie model uczenia maszynowego.
- Bez importu danych z zegarków/aplikacji (Strava, Garmin itp.) — dane wpisywane są wyłącznie ręcznie w MVP.
- Bez trybu trenera / współdzielonych profili — tylko płaski model pojedynczego użytkownika (zgodnie z Access Control).
- Bez gwarancji pracy offline — aplikacja wymaga połączenia z internetem w MVP.
- Ustawienie celu treningowego (5K/10K/maraton) nie jest wymagane w MVP — obniżone do nice-to-have w rundzie Sokratesa (FR-004).
- Edycja wcześniej wprowadzonych danych treningowych nie jest wymagana w MVP — obniżona do nice-to-have w rundzie Sokratesa (FR-005).

## Open Questions

1. **Czy dystans + średnie tętno wystarczą jako dane wejściowe, czy sugestia wymaga bogatszych danych (tempo, teren, odczuwany wysiłek)?** — Wskazane w rundzie Sokratesa dla FR-002; pozostawione jako świadomy kompromis MVP. Owner: user. By: przed kolejną iteracją.
2. **Czy próg obciążenia w regule sugestii powinien być zindywidualizowany per użytkownik zamiast jednej stałej wartości dla wszystkich?** — Wskazane przez użytkownika podczas ramowania produktu (pytanie o skalę 100x); na MVP przyjęto jeden wspólny próg jako świadome uproszczenie. Owner: user. By: przy planowaniu kolejnej iteracji.
