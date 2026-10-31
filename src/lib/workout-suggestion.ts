// Today's workout suggestion. Pure functions with no `astro:*` imports, so they are usable anywhere.
//
// Rule: wellbeing ≤ LOW_WELLBEING_MAX or a rounded load above LOAD_THRESHOLD gives `easy`;
// otherwise wellbeing 3 gives `steady` and wellbeing 4–5 gives `intervals`.
// The low-wellbeing check comes first and does not depend on load.

import { roundLoad, weeklyTrainingLoad } from "@/lib/training-load";
import type { SuggestionViewState, Wellbeing, Workout, WorkoutSuggestion, WorkoutSuggestionKind } from "@/types";

/** Weekly load (as displayed, see `roundLoad`) above which only an easy workout is suggested. */
export const LOAD_THRESHOLD = 100;

/** Highest wellbeing that counts as low; low wellbeing always gives an easy workout. */
export const LOW_WELLBEING_MAX = 2;

const CATALOG: Record<WorkoutSuggestionKind, WorkoutSuggestion> = {
  easy: {
    kind: "easy",
    title: "Lekki wolny bieg",
    description:
      "30–40 minut spokojnego biegu w tempie pozwalającym na swobodną rozmowę; dziś priorytetem jest regeneracja.",
  },
  steady: {
    kind: "steady",
    title: "Spokojny bieg tlenowy",
    description:
      "45–60 minut w równym, komfortowym tempie; oddech przyspieszony, ale wciąż możesz mówić pełnymi zdaniami.",
  },
  intervals: {
    kind: "intervals",
    title: "Interwały",
    description:
      "15 minut rozgrzewki truchtem, 6 × 3 minuty mocnego biegu z 2 minutami truchtu w przerwach, 10 minut schłodzenia.",
  },
};

const WELLBEING_VALUES: Record<string, Wellbeing> = { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 };

/** Parses a raw query value; only the exact strings "1"–"5" are valid, anything else gives `null`. */
export function parseWellbeing(raw: string | null): Wellbeing | null {
  if (raw === null || !Object.hasOwn(WELLBEING_VALUES, raw)) return null;
  return WELLBEING_VALUES[raw];
}

/** Suggests today's workout from the unrounded weekly `load` and the reported `wellbeing`. */
export function suggestWorkout(load: number, wellbeing: Wellbeing): WorkoutSuggestion {
  if (wellbeing <= LOW_WELLBEING_MAX || roundLoad(load) > LOAD_THRESHOLD) return CATALOG.easy;
  if (wellbeing === 3) return CATALOG.steady;
  return CATALOG.intervals;
}

/** Shown on the picker when the `wellbeing` query value is present but invalid. */
export const INVALID_WELLBEING_MESSAGE = "Wybierz samopoczucie od 1 do 5.";

/**
 * Picks the suggestion screen state. Fails closed: a list error wins over every wellbeing value,
 * so an unknown load never yields a suggestion.
 */
export function resolveSuggestionView(input: {
  workouts: Pick<Workout, "distance_km" | "avg_heart_rate">[];
  listError: string | null;
  rawWellbeing: string | null;
}): SuggestionViewState {
  if (input.listError) return { state: "error", errorMessage: input.listError };

  const wellbeing = parseWellbeing(input.rawWellbeing);
  if (wellbeing === null) {
    return input.rawWellbeing === null
      ? { state: "picker" }
      : { state: "picker", pickerError: INVALID_WELLBEING_MESSAGE };
  }

  const load = weeklyTrainingLoad(input.workouts);
  return { state: "result", suggestion: suggestWorkout(load, wellbeing), load: roundLoad(load), wellbeing };
}
