// risk: #3
// Today's workout suggestion rule: low wellbeing is never intense; a load above the threshold is always easy.
// Expected kinds are written as literals per row, never computed by the rule under test.
import { describe, expect, test } from "vitest";

import { roundLoad } from "@/lib/training-load";
import { parseWellbeing, resolveSuggestionView, suggestWorkout } from "@/lib/workout-suggestion";
import type { Wellbeing, WorkoutSuggestionKind } from "@/types";

describe("suggestWorkout", () => {
  test.each<[Wellbeing, number, WorkoutSuggestionKind]>([
    [1, 0, "easy"],
    [1, 15, "easy"],
    [1, 100, "easy"],
    [1, 100.4, "easy"],
    [1, 100.5, "easy"],
    [1, 101, "easy"],
    [1, 500, "easy"],
    [2, 0, "easy"],
    [2, 15, "easy"],
    [2, 100, "easy"],
    [2, 100.4, "easy"],
    [2, 100.5, "easy"],
    [2, 101, "easy"],
    [2, 500, "easy"],
    [3, 0, "steady"],
    [3, 15, "steady"],
    [3, 100, "steady"],
    [3, 100.4, "steady"],
    [3, 100.5, "easy"],
    [3, 101, "easy"],
    [3, 500, "easy"],
    [4, 0, "intervals"],
    [4, 15, "intervals"],
    [4, 100, "intervals"],
    [4, 100.4, "intervals"],
    [4, 100.5, "easy"],
    [4, 101, "easy"],
    [4, 500, "easy"],
    [5, 0, "intervals"],
    [5, 15, "intervals"],
    [5, 100, "intervals"],
    [5, 100.4, "intervals"],
    [5, 100.5, "easy"],
    [5, 101, "easy"],
    [5, 500, "easy"],
  ])("wellbeing %i, load %d → %s", (wellbeing, load, expected) => {
    expect(suggestWorkout(load, wellbeing).kind).toBe(expected);
  });

  test.each<[Wellbeing, number, WorkoutSuggestionKind]>([
    [1, 0, "easy"],
    [3, 0, "steady"],
    [5, 0, "intervals"],
  ])("kind %s has a non-empty title and description", (wellbeing, load, kind) => {
    const suggestion = suggestWorkout(load, wellbeing);
    expect(suggestion.kind).toBe(kind);
    expect(suggestion.title.trim()).not.toBe("");
    expect(suggestion.description.trim()).not.toBe("");
  });
});

describe("parseWellbeing", () => {
  test.each<[string | null, Wellbeing | null]>([
    ["1", 1],
    ["2", 2],
    ["3", 3],
    ["4", 4],
    ["5", 5],
    [null, null],
    ["", null],
    ["0", null],
    ["6", null],
    [" 3", null],
    ["3.0", null],
    ["abc", null],
  ])("parseWellbeing(%j) → %j", (raw, expected) => {
    expect(parseWellbeing(raw)).toBe(expected);
  });
});

describe("resolveSuggestionView", () => {
  const LOAD_15 = [{ distance_km: 10, avg_heart_rate: 150 }];
  const LOAD_100_5 = [{ distance_km: 67, avg_heart_rate: 150 }];
  const LIST_ERROR = "Nie udało się wczytać treningów.";

  // Fail closed: with a list error no wellbeing value may produce a suggestion.
  test.each<[string, Parameters<typeof resolveSuggestionView>[0], object]>([
    [
      "error + valid wellbeing",
      { workouts: [], listError: LIST_ERROR, rawWellbeing: "5" },
      { state: "error", errorMessage: LIST_ERROR },
    ],
    [
      "error + no wellbeing",
      { workouts: [], listError: LIST_ERROR, rawWellbeing: null },
      { state: "error", errorMessage: LIST_ERROR },
    ],
    [
      "error + invalid wellbeing",
      { workouts: [], listError: LIST_ERROR, rawWellbeing: "abc" },
      { state: "error", errorMessage: LIST_ERROR },
    ],
    [
      "error + workouts present",
      { workouts: LOAD_100_5, listError: LIST_ERROR, rawWellbeing: "5" },
      { state: "error", errorMessage: LIST_ERROR },
    ],
    ["no wellbeing", { workouts: LOAD_15, listError: null, rawWellbeing: null }, { state: "picker" }],
    [
      "empty wellbeing",
      { workouts: LOAD_15, listError: null, rawWellbeing: "" },
      { state: "picker", pickerError: "Wybierz samopoczucie od 1 do 5." },
    ],
    [
      "out-of-range wellbeing",
      { workouts: LOAD_15, listError: null, rawWellbeing: "9" },
      { state: "picker", pickerError: "Wybierz samopoczucie od 1 do 5." },
    ],
    [
      "low wellbeing",
      { workouts: LOAD_15, listError: null, rawWellbeing: "2" },
      { state: "result", suggestion: { kind: "easy" }, load: 15, wellbeing: 2 },
    ],
    [
      "high wellbeing, low load",
      { workouts: LOAD_15, listError: null, rawWellbeing: "5" },
      { state: "result", suggestion: { kind: "intervals" }, load: 15, wellbeing: 5 },
    ],
    [
      "high wellbeing, load 100.5",
      { workouts: LOAD_100_5, listError: null, rawWellbeing: "5" },
      { state: "result", suggestion: { kind: "easy" }, load: 101, wellbeing: 5 },
    ],
  ])("%s", (_label, input, expected) => {
    const view = resolveSuggestionView(input);
    expect(view).toMatchObject(expected);
    expect(Object.keys(view).sort()).toEqual(Object.keys(expected).sort());
  });
});

describe("roundLoad", () => {
  test.each([
    [100.4, 100],
    [100.5, 101],
    [0, 0],
  ])("roundLoad(%d) → %i", (load, expected) => {
    expect(roundLoad(load)).toBe(expected);
  });
});
