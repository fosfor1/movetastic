@AGENTS.md

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — moduł 3, lekcja 5 (debugowanie)

Zamień awarię w poprawkę, której agent może bronić: najpierw dowody, potem nieprzechodzący test, a następnie poprawka.

```
signal (monitoring | log | flaky E2E | stack trace) -> gather evidence -> reproduce -> failing test -> fix -> verify
```

### Router zadań — od czego zacząć

| Umiejętność | Użyj jej, gdy |
| --- | --- |
| `/10x-frame` | Zgłoszenie przychodzi jako „bug + proponowana poprawka”. Sprawdź, czy zaobserwowany objaw i podana przyczyna rzeczywiście do siebie pasują, zanim ktokolwiek cokolwiek naprawi. |
| `/10x-new` -> `/10x-research` -> `/10x-plan` -> `/10x-implement` | Poprawka to coś więcej niż jednolinijkowa zmiana. Research zbiera dowody; plan zaczyna się od nieprzechodzącego testu regresji. |
| `/10x-tdd` | Pisanie testu regresji, który odtwarza błąd przed wprowadzeniem poprawki. |
| `/10x-e2e` | Błąd pojawia się tylko w uruchomionej aplikacji. Odtwórz go w przeglądarce i zachowaj ten test. |
| `/10x-observability-audit` | Błędy są nieobecne, zaszumione lub niemożliwe do zdiagnozowania na produkcji. Audytuje krytyczne przepływy pod kątem kodu ukrywającego awarie i zapisuje raport z datą w `context/audits/observability/`. Użyj `--verify <report>`, aby ponownie sprawdzić wcześniejszy raport po poprawkach. |

### Twarde zasady

- **Dowody przed hipotezą.** Korzystaj z tego, co pokazują tracker błędów, logi, odtworzenie problemu i kod. Nigdy nie zgaduj przyczyny wyłącznie na podstawie stack trace.
- **Błąd najpierw staje się nieprzechodzącym testem.** Poprawka jest gotowa, gdy ten test przechodzi z czerwonego na zielony i pozostaje w zestawie testów.
- **Nigdy nie ukrywaj dowodów.** Żadnych pustych `catch`, żadnych ignorowanych odrzuceń promise'ów, żadnego zamieniania awarii w przekierowania lub `200`, żadnego porzucania przyczyn błędów. Jeśli poprawka wymaga `catch`, loguje lub raportuje błąd wraz z jego przyczyną.
- **Napraw przyczynę, nie test.** Nie edytuj asercji, aby pasowała do nowego zachowania, chyba że zmieniło się samo wymaganie.

### Granice lekcji

- `/10x-observability-audit` czyta kod i zapisuje raport. Nigdy nie zmienia audytowanego kodu. Naprawianie tego, co znajdzie, przechodzi przez łańcuch zmian.
- Wybór dostawcy monitoringu należy do `/10x-infra-research`, a nie do tej lekcji.

<!-- END @przeprogramowani/10x-cli -->
