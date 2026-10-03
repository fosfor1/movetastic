// Weekly training load. Pure function with no `astro:*` imports, so it is usable anywhere.
//
// Formula: load = Σ (distance_km × avg_heart_rate / 100) over the workouts passed in.
// Scale: 10 km at an average heart rate of 150 gives 15.
// The result is unrounded; rounding is a display concern of the caller.

import type { Workout } from "@/types";

/** Sums the training load of `workouts`. The caller passes only the workouts in the 7-day window. */
export function weeklyTrainingLoad(workouts: Pick<Workout, "distance_km" | "avg_heart_rate">[]): number {
  return workouts.reduce((sum, workout) => sum + (workout.distance_km * workout.avg_heart_rate) / 100, 0);
}
