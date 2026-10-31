import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { todayInAppTimeZone } from "@/lib/dates";
import { validateWorkoutInput } from "@/lib/workout-validation";
import { updateWorkout } from "@/lib/workouts";

const NOT_FOUND_MESSAGE = "Nie znaleziono treningu.";

export const POST: APIRoute = async (context) => {
  const id = context.params.id ?? "";
  const editPath = `/dashboard/workouts/${encodeURIComponent(id)}/edit`;
  const redirectWithError = (message: string) => context.redirect(`${editPath}?error=${encodeURIComponent(message)}`);

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectWithError("Supabase nie jest skonfigurowany.");
  }

  // Same rules as the add endpoint; the form validates too, but only this check protects the data.
  const result = validateWorkoutInput(
    {
      workout_date: field("workout_date"),
      distance_km: field("distance_km"),
      avg_heart_rate: field("avg_heart_rate"),
    },
    todayInAppTimeZone(),
  );

  if (!result.ok) {
    const firstError = Object.values(result.errors).find(Boolean) ?? "Nieprawidłowe dane treningu.";
    return redirectWithError(firstError);
  }

  const { updated, error } = await updateWorkout(supabase, id, result.value);
  if (error) {
    return redirectWithError(error);
  }
  if (!updated) {
    return redirectWithError(NOT_FOUND_MESSAGE);
  }

  return context.redirect("/dashboard?updated=1");
};
