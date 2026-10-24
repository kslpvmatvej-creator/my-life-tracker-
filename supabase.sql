-- Новая отдельная таблица. Остальные таблицы в проекте не затрагиваются.
create table if not exists public.tracker_state (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.tracker_state enable row level security;

drop policy if exists "tracker_main_select" on public.tracker_state;
drop policy if exists "tracker_main_insert" on public.tracker_state;
drop policy if exists "tracker_main_update" on public.tracker_state;

-- Доступ только к одной строке id = 'main'
create policy "tracker_main_select" on public.tracker_state
  for select to anon, authenticated using (id = 'main');
create policy "tracker_main_insert" on public.tracker_state
  for insert to anon, authenticated with check (id = 'main');
create policy "tracker_main_update" on public.tracker_state
  for update to anon, authenticated using (id = 'main') with check (id = 'main');
