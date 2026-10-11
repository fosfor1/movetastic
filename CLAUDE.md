@AGENTS.md

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — Moduł 3, Lekcja 1

Rozpocznij Moduł 3 od stworzenia **trwałego, ukierunkowanego na ryzyko kontraktu jakości** przed napisaniem jakiegokolwiek testu — następnie prowadź każdą fazę wdrożenia przez standardowy łańcuch zmian.

```
PRD + roadmap + archive
        │
        ▼
   /10x-test-plan  ──►  context/foundation/test-plan.md  (strategia §1–§5 zamrożona + cookbook §6 się rozwija)
        │
        ▼  (jedna faza wdrożenia naraz, /clear między przekazaniami)
   /10x-new ──► /10x-research ──► /10x-plan ──► /10x-implement
```

`/10x-test-plan` to **stanowy orkiestrator**, a nie generator jednorazowy. Przy pierwszym uruchomieniu zapisuje etapowe wdrożenie do `context/foundation/test-plan.md`. Przy każdym kolejnym uruchomieniu ponownie wyprowadza stan z artefaktów na dysku i prezentuje następne przekazanie. Lekcja skupia się na **strategii i sekwencjonowaniu wdrożenia, a nie konfiguracji**. Hooki, serwery MCP i CI YAML są konfigurowane w późniejszych lekcjach tego modułu.

### Router zadań — od czego zacząć

| Umiejętność | Użyj, gdy |
| --- | --- |
| **Strategia jakości jako plik reguł (temat lekcji)** | |
| `/10x-test-plan` | Masz PRD (a najlepiej także roadmapę i kilka zarchiwizowanych fragmentów) i zaraz napiszesz pierwsze testy projektu albo zauważyłeś, że testy generowane przez AI trafiają w helpery, podczas gdy krytyczne przepływy pozostają niepokryte. Pierwsze wywołanie uruchamia discovery (PRD + roadmap + archive + skan hot spotów), 5-pytaniowy wywiad z użytkownikiem oraz etap syntezy z obowiązkową kontrolą challengera, a następnie zapisuje `test-plan.md` w `context/foundation/` z mapą ryzyk (5–7 scenariuszy awarii), tabelą etapowego wdrożenia, tabelą stosu, tabelą bramek jakości, sekcją cookbook (`§6`, uzupełnianą w miarę dostarczania faz) oraz sekcją negatywnej przestrzeni (czego celowo nie testujemy). Kolejne wywołania przesuwają wdrożenie o jedno przekazanie naraz. |
| `/10x-test-plan --status` | `test-plan.md` już istnieje i chcesz uzyskać zwięzły obraz stanu wdrożenia — które fazy mają status `not started`, `change opened`, `researched`, `planned`, `implementing` lub `complete`, oraz jaka jest następna akcja. Nie wykonuje pracy; można bezpiecznie uruchomić w dowolnym momencie. |
| `/10x-test-plan --refresh` | `test-plan.md` już istnieje i wystąpiło jedno z następujących: nowe ryzyko z top 3 pojawiło się w roadmapie lub archive, data `checked:` narzędzia jest starsza niż trzy miesiące, stos technologiczny projektu się zmienił albo negatywna przestrzeń §7 nie odpowiada już temu, co uważa zespół. Otwiera nowy folder zmiany `test-plan-refresh-<YYYY-MM-DD>` zamiast edytować przewodnik w miejscu. |

### Łańcuch wdrożenia — co dzieje się po zapisaniu przewodnika

Tabela §3 *Phased Rollout* przewodnika jest stanem orkiestratora. Dla każdego wiersza, który nie ma statusu `complete`, orkiestrator wybiera następne przekazanie na podstawie istniejących artefaktów w `context/changes/<change-id>/`:

| Stan na dysku | Następne przekazanie | Status przechodzi na |
| --- | --- | --- |
| brak folderu zmiany | `/10x-new <change-id>` | `change opened` |
| tylko `change.md` | `/10x-research` (z opisem ryzyk do zweryfikowania) | `researched` |
| `+ research.md` | `/10x-plan` (z ograniczeniami cost × signal + aktualizacji cookbooka) | `planned` |
| `+ plan.md` z oczekującymi elementami `## Progress` | `/10x-implement <change-id> phase <N>` | `implementing` / `complete` |
| `+ plan.md` w pełni `[x]` | Oznacz wiersz §3 jako `complete`; przejdź w pętli do następnego oczekującego wiersza | — |

Każde przekazanie jest punktem **STOP**. Orkiestrator kopiuje następne polecenie do schowka, prosi użytkownika o wykonanie `/clear` i uruchomienie go, a następnie kończy działanie. Ponownie wywołaj `/10x-test-plan` (bez argumentów), aby przejść dalej.

### Reguły priorytetyzacji zorientowanej na ryzyko

- Ryzyka to **scenariusze awarii w kategoriach użytkownika / biznesu**, a nie nazwy testów. „Wylogowany użytkownik uzyskuje dostęp do płatnej treści przez nieaktualny token” to ryzyko; „przetestuj formularz logowania” nim nie jest.
- Od 5 do 7 ryzyk. Mniej jest zbyt ogólne; więcej czyni priorytetyzację bezużyteczną.
- Wpływ i prawdopodobieństwo są ocenami użytkownika/biznesu, a nie złożoności technicznej.
- Każde ryzyko ma źródło: sekcję PRD, zarchiwizowany fragment, wpis roadmapy, pytanie z wywiadu Fazie 2, katalog hot spotu z liczbą zmian lub ograniczenie stosu technologicznego. Żadnych wymyślonych ryzyk.
- **Sygnał, nie wiedza.** §2 cytuje *dowody, które podniosły ryzyko*, nigdy plik jako „miejsce, gdzie występuje awaria”. Kotwice file:line, nazwy funkcji, nazwy schematów i nazwy modułów są zabronione w §2 — należą do wyniku `/10x-research`, tworzonego dla każdej fazy wdrożenia względem aktualnego kodu. Plan jest specyfikacją QA; nie jest audytem kodu.
- Pokrycie nie jest metryką. Metryką jest **pokrycie ryzyka**.

### Reguły mapowania dwuwarstwowego

- Najpierw warstwa klasyczna: wygrywa najtańszy test dający rzeczywisty sygnał. Awansuj do e2e tylko wtedy, gdy żadna tańsza warstwa nie pokrywa ryzyka.
- Następnie warstwa AI-native i tylko tam, gdzie dodaje sygnał, którego klasyczne testy nie dostarczają tanio.
- Każdy wiersz AI-native ma linię **„When NOT to use”**. Jeśli nie potrafisz jej napisać, usuń wiersz.
- Każda nazwa narzędzia zawiera datę `checked: <YYYY-MM-DD>`. Nazwy narzędzi są przykładami kategorii, a nie rekomendacjami.
- Obie warstwy muszą być niepuste w końcowym przewodniku, jeśli projekt ich wymaga. Tylko klasyczna warstwa to plan z 2020 roku; tylko AI-native to hype. Fazy AI-native nie są obowiązkowe — uwzględniaj je tylko wtedy, gdy brief uzasadnił je w ramach cost × signal.

### Reguły bramek jakości

- Wymagane bramki (lint, typecheck, unit+integration, e2e dla krytycznych przepływów) muszą mapować się na rzeczywiste kroki CI. Jeśli wymagana bramka nie jest jeszcze podłączona, oznacz ją jako `required after §3 Phase <N>` i pozwól wskazanej fazie wdrożenia ją podłączyć.
- Hook po edycji jest **zalecany lokalnie**, a nie substytutem CI.
- Multimodalny przegląd wizualny jest **selektywny**, stosowany do 1–3 krytycznych ekranów, a nie do każdej strony.
- Zapasowe rozwiązanie oparte na wizji (Anthropic Computer Use lub OpenAI CUA) jest zarezerwowane dla powierzchni niedostępnych przez DOM; kosztowne na akcję.

### Wzorce cookbooka (§6) — uzupełniane z czasem

`test-plan.md` jest zarówno etapową strategią, jak i **rosnącym cookbookiem**. §6 zaczyna się od placeholderów (`TBD — see §3 Phase <N>`) i jest uzupełniany stopniowo — plan każdej fazy wdrożenia kończy się podfazą aktualizującą odpowiedni wpis §6 (lokalizacja, nazewnictwo, test referencyjny, polecenie uruchomienia). Po ukończeniu Modułu 3 §6 staje się kanoniczną odpowiedzią na pytanie „jak dodać test dla X w tym projekcie?” — i jest tym, co `/10x-tdd` odczytuje w Lekcji 2.

### Granice lekcji

- Nie pisz kodu testów. To temat Lekcji 2 (`/10x-tdd` i tworzenie testów jednostkowych).
- Nie konfiguruj hooków, cyklu życia hooków ani hooków debugowania. To temat Lekcji 3.
- Nie konfiguruj serwerów MCP, Playwright API, kodu e2e ani kodu scenariuszy multimodalnych. To temat Lekcji 4.
- Nie uruchamiaj przepływu bug-to-fix-to-regression-test. To temat Lekcji 5.
- Nie twórz od podstaw potoków CI/CD ani nie pisz GitHub Actions YAML. Przewodnik wskazuje bramki; konfiguracja należy do Modułu 1 Lekcji 5 i Modułu 2 Lekcji 5.
- Nie porównuj modeli multimodalnych. Cytuj kryteria (cost, latency, agent-friendliness), nigdy ranking.
- Nie czytaj codebase w celu zdobywania wiedzy (grafy wywołań, schematy, „który plik odpowiada za tę awarię”). To zadanie `/10x-research`, wykonywane dla każdej fazy wdrożenia.

### Ścieżki używane przez tę lekcję

- `context/foundation/test-plan.md` — kontrakt jakości tworzony i utrzymywany przez `/10x-test-plan`
- `context/foundation/prd.md` — główne źródło ryzyk
- `context/foundation/roadmap.md` — ważenie prawdopodobieństwa
- `context/foundation/tech-stack.md` — dane wejściowe stosu (gdy obecne)
- `context/archive/<change-id>/plan.md` — zaimplementowana powierzchnia ryzyka
- `context/changes/<change-id>/` — folder zmiany dla każdej fazy wdrożenia (po jednym na wiersz w §3)

<!-- END @przeprogramowani/10x-cli -->
