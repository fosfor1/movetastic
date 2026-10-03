-- Create the workouts table: one row per completed run, owned by a single auth user.
-- Isolation pattern for user data: RLS enabled, per-operation, per-role policies.

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_date date not null,
  distance_km numeric(5, 2) not null check (distance_km between 0.1 and 200),
  avg_heart_rate smallint not null check (avg_heart_rate between 30 and 230),
  created_at timestamptz not null default now()
);

create index workouts_user_id_workout_date_idx on public.workouts (user_id, workout_date desc);

alter table public.workouts enable row level security;

-- authenticated users may read only their own workouts
create policy workouts_select_own on public.workouts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- authenticated users may insert only workouts they own
create policy workouts_insert_own on public.workouts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- No anon policies and no update/delete policies: RLS denies those operations.
