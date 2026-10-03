// Single source of workout input rules, shared by the React form and the API. No `astro:*` imports.
import type { NewWorkoutInput } from "@/types";

export const DISTANCE_KM_MIN = 0.1;
export const DISTANCE_KM_MAX = 200;
export const DISTANCE_KM_MAX_DECIMALS = 2;
export const AVG_HEART_RATE_MIN = 30;
export const AVG_HEART_RATE_MAX = 230;

export interface RawWorkoutInput {
  workout_date: string;
  distance_km: string;
  avg_heart_rate: string;
}

export type WorkoutValidationErrors = Partial<Record<keyof NewWorkoutInput, string>>;

export type WorkoutValidationResult =
  { ok: true; value: NewWorkoutInput } | { ok: false; errors: WorkoutValidationErrors };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DISTANCE_PATTERN = /^\d+(\.\d{1,2})?$/;
const INTEGER_PATTERN = /^\d+$/;

function isRealCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateWorkoutInput(raw: RawWorkoutInput, today: string): WorkoutValidationResult {
  const errors: WorkoutValidationErrors = {};

  const workoutDate = raw.workout_date.trim();
  if (!workoutDate) {
    errors.workout_date = "Podaj datę treningu.";
  } else if (!isRealCalendarDate(workoutDate)) {
    errors.workout_date = "Podaj poprawną datę w formacie RRRR-MM-DD.";
  } else if (workoutDate > today) {
    errors.workout_date = "Data treningu nie może być z przyszłości.";
  }

  const distanceRaw = raw.distance_km.trim().replace(",", ".");
  let distanceKm = NaN;
  if (!distanceRaw) {
    errors.distance_km = "Podaj dystans.";
  } else if (!DISTANCE_PATTERN.test(distanceRaw)) {
    errors.distance_km = `Dystans musi być liczbą z maksymalnie ${DISTANCE_KM_MAX_DECIMALS} miejscami po przecinku.`;
  } else {
    distanceKm = Number(distanceRaw);
    if (distanceKm < DISTANCE_KM_MIN || distanceKm > DISTANCE_KM_MAX) {
      errors.distance_km = `Dystans musi mieścić się w zakresie 0,1–${DISTANCE_KM_MAX} km.`;
    }
  }

  const heartRateRaw = raw.avg_heart_rate.trim();
  let avgHeartRate = NaN;
  if (!heartRateRaw) {
    errors.avg_heart_rate = "Podaj średnie tętno.";
  } else if (!INTEGER_PATTERN.test(heartRateRaw)) {
    errors.avg_heart_rate = "Średnie tętno musi być liczbą całkowitą.";
  } else {
    avgHeartRate = Number(heartRateRaw);
    if (avgHeartRate < AVG_HEART_RATE_MIN || avgHeartRate > AVG_HEART_RATE_MAX) {
      errors.avg_heart_rate = `Średnie tętno musi mieścić się w zakresie ${AVG_HEART_RATE_MIN}–${AVG_HEART_RATE_MAX} uderzeń/min.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { workout_date: workoutDate, distance_km: distanceKm, avg_heart_rate: avgHeartRate },
  };
}
