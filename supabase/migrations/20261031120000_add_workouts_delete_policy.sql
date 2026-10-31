-- Allow deleting workouts: an authenticated user may delete only the workouts they own.
-- Same isolation pattern as the existing policies (per operation, per role, auth.uid() wrapped in a
-- select so the planner caches it). Still no anon policies and no update policy: RLS denies those.

-- authenticated users may delete only their own workouts
create policy workouts_delete_own on public.workouts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
