/** A completed workout as stored in `public.workouts` (owner column omitted). */
export interface Workout {
  id: string;
  /** Calendar date in `YYYY-MM-DD` format. */
  workout_date: string;
  distance_km: number;
  avg_heart_rate: number;
  created_at: string;
}

/** Validated input for logging a new workout. */
export interface NewWorkoutInput {
  /** Calendar date in `YYYY-MM-DD` format. */
  workout_date: string;
  distance_km: number;
  avg_heart_rate: number;
}
