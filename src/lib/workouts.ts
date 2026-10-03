// Workouts data service. Isolation between users is enforced by RLS on `public.workouts`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { recentWindow } from "@/lib/dates";
import type { NewWorkoutInput, Workout } from "@/types";

const LIST_ERROR_MESSAGE = "Nie udało się wczytać treningów. Spróbuj ponownie później.";
const CREATE_ERROR_MESSAGE = "Nie udało się zapisać treningu. Spróbuj ponownie później.";

interface WorkoutRow {
  id: string;
  workout_date: string;
  distance_km: number | string;
  avg_heart_rate: number;
  created_at: string;
}

/** Workouts from the inclusive 7-day window ending on `today`, newest first. */
export async function listRecentWorkouts(
  supabase: SupabaseClient,
  today: string,
): Promise<{ data: Workout[]; error: string | null }> {
  const { from, to } = recentWindow(today);
  const { data, error } = await supabase
    .from("workouts")
    .select("id, workout_date, distance_km, avg_heart_rate, created_at")
    .gte("workout_date", from)
    .lte("workout_date", to)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("listRecentWorkouts failed", error);
    return { data: [], error: LIST_ERROR_MESSAGE };
  }

  const rows = data as WorkoutRow[];
  return {
    data: rows.map((row) => ({
      id: row.id,
      workout_date: row.workout_date,
      distance_km: Number(row.distance_km),
      avg_heart_rate: row.avg_heart_rate,
      created_at: row.created_at,
    })),
    error: null,
  };
}

/** Inserts a workout owned by `userId`; RLS rejects any mismatch with the session user. */
export async function createWorkout(
  supabase: SupabaseClient,
  userId: string,
  input: NewWorkoutInput,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("workouts").insert({
    user_id: userId,
    workout_date: input.workout_date,
    distance_km: input.distance_km,
    avg_heart_rate: input.avg_heart_rate,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("createWorkout failed", error);
    return { error: CREATE_ERROR_MESSAGE };
  }

  return { error: null };
}
