import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { deleteWorkout } from "@/lib/workouts";

const NOT_FOUND_MESSAGE = "Nie znaleziono treningu.";

export const POST: APIRoute = async (context) => {
  const id = context.params.id ?? "";
  const confirmPath = `/dashboard/workouts/${encodeURIComponent(id)}/delete`;
  const redirectWithError = (message: string) =>
    context.redirect(`${confirmPath}?error=${encodeURIComponent(message)}`);

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return redirectWithError("Supabase nie jest skonfigurowany.");
  }

  const { deleted, error } = await deleteWorkout(supabase, id);
  if (error) {
    return redirectWithError(error);
  }
  if (!deleted) {
    return redirectWithError(NOT_FOUND_MESSAGE);
  }

  return context.redirect("/dashboard?deleted=1");
};
