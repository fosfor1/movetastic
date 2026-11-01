/** A completed workout as stored in `public.workouts` (owner column omitted). */
export interface Workout {
  id: string;
  /** Calendar date in `YYYY-MM-DD` format. */
  workout_date: string;
  distance_km: number;
  avg_heart_rate: number;
  created_at: string;
}

/** Self-reported wellbeing on a 1 (bad) to 5 (great) scale. */
export type Wellbeing = 1 | 2 | 3 | 4 | 5;

/** Kind of workout suggested for today. */
export type WorkoutSuggestionKind = "easy" | "steady" | "intervals";

/** A workout suggestion with its user-facing copy. */
export interface WorkoutSuggestion {
  kind: WorkoutSuggestionKind;
  title: string;
  description: string;
}

/** State of the suggestion screen; `load` is already rounded with `roundLoad`. */
export type SuggestionViewState =
  | { state: "picker"; pickerError?: string }
  | { state: "result"; suggestion: WorkoutSuggestion; load: number; wellbeing: Wellbeing }
  | { state: "error"; errorMessage: string };

/** Validated input for logging a new workout. */
export interface NewWorkoutInput {
  /** Calendar date in `YYYY-MM-DD` format. */
  workout_date: string;
  distance_km: number;
  avg_heart_rate: number;
}

/** State of the delete-workout confirmation screen. */
export type DeleteWorkoutViewState =
  | { state: "confirm"; workout: Workout; error?: string }
  | { state: "not-found" }
  | { state: "error"; errorMessage: string };

/** State of the edit-workout screen; `today` caps the date field. */
export type EditWorkoutViewState =
  | { state: "form"; workout: Workout; today: string; error?: string }
  | { state: "not-found" }
  | { state: "error"; errorMessage: string };
