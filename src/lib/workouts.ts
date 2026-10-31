// Workouts data service. Isolation between users is enforced by RLS on `public.workouts`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { recentWindow } from "@/lib/dates";
import type { NewWorkoutInput, Workout } from "@/types";

const LIST_ERROR_MESSAGE = "Nie udało się wczytać treningów. Spróbuj ponownie później.";
const CREATE_ERROR_MESSAGE = "Nie udało się zapisać treningu. Spróbuj ponownie później.";
const GET_ERROR_MESSAGE = "Nie udało się wczytać treningu. Spróbuj ponownie później.";
const DELETE_ERROR_MESSAGE = "Nie udało się usunąć treningu.";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` is a canonical UUID; anything else would make Postgres raise 22P02. */
export function isUuid(id: string): boolean {
  return UUID_PATTERN.test(id);
}

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
  return { data: rows.map(toWorkout), error: null };
}

function toWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    workout_date: row.workout_date,
    distance_km: Number(row.distance_km),
    avg_heart_rate: row.avg_heart_rate,
    created_at: row.created_at,
  };
}

/** One of the session user's workouts by id; `null` when it does not exist or RLS hides it. */
export async function getWorkout(
  supabase: SupabaseClient,
  id: string,
): Promise<{ data: Workout | null; error: string | null }> {
  if (!isUuid(id)) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from("workouts")
    .select("id, workout_date, distance_km, avg_heart_rate, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("getWorkout failed", error);
    return { data: null, error: GET_ERROR_MESSAGE };
  }

  return { data: data ? toWorkout(data) : null, error: null };
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

/**
 * Deletes one of the session user's workouts by id. RLS turns a denied delete into "0 rows, no error",
 * so `deleted` is true only when a row actually came back from the delete.
 */
export async function deleteWorkout(
  supabase: SupabaseClient,
  id: string,
): Promise<{ deleted: boolean; error: string | null }> {
  if (!isUuid(id)) {
    return { deleted: false, error: null };
  }

  const { data, error } = await supabase.from("workouts").delete().eq("id", id).select("id");

  if (error) {
    // eslint-disable-next-line no-console
    console.error("deleteWorkout failed", error);
    return { deleted: false, error: DELETE_ERROR_MESSAGE };
  }

  return { deleted: data.length > 0, error: null };
}
