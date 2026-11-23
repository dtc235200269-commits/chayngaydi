create table if not exists public.aquasmart_user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  data_key text not null check (
    data_key in (
      'aquasmart-ponds',
      'aquasmart-pond-inspections',
      'aquasmart-report-months',
      'aquasmart-journal',
      'aquasmart-market-items',
      'aquasmart-pond-power-states'
    )
  ),
  data_value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, data_key)
);

alter table public.aquasmart_user_data enable row level security;

grant select, insert, update, delete
  on table public.aquasmart_user_data
  to authenticated;

drop policy if exists "Users can read their own AquaSmart data" on public.aquasmart_user_data;
create policy "Users can read their own AquaSmart data"
  on public.aquasmart_user_data
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own AquaSmart data" on public.aquasmart_user_data;
create policy "Users can insert their own AquaSmart data"
  on public.aquasmart_user_data
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own AquaSmart data" on public.aquasmart_user_data;
create policy "Users can update their own AquaSmart data"
  on public.aquasmart_user_data
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own AquaSmart data" on public.aquasmart_user_data;
create policy "Users can delete their own AquaSmart data"
  on public.aquasmart_user_data
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
