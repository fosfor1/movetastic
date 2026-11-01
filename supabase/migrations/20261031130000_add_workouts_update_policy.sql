-- Allow updating workouts: an authenticated user may update only the workouts they own, and only into rows
-- they still own. `with check` is written explicitly (Postgres would otherwise reuse `using`) so the rule
-- "a row never moves to another owner" is visible and the policy-shape guard can pin both clauses.
-- Same isolation pattern as the existing policies (per operation, per role, auth.uid() wrapped in a
-- select so the planner caches it). Still no anon policies: RLS denies those.

-- authenticated users may update only their own workouts, and never reassign them to another user
create policy workouts_update_own on public.workouts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
