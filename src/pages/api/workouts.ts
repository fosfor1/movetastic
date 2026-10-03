import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { todayInAppTimeZone } from "@/lib/dates";
import { validateWorkoutInput } from "@/lib/workout-validation";
import { createWorkout } from "@/lib/workouts";

const FORM_PATH = "/dashboard/workouts/new";

export const POST: APIRoute = async (context) => {
  const redirectWithError = (message: string) => context.redirect(`${FORM_PATH}?error=${encodeURIComponent(message)}`);

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

  const { error } = await createWorkout(supabase, user.id, result.value);
  if (error) {
    return redirectWithError(error);
  }

  return context.redirect("/dashboard");
};
