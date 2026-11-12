-- Gesundheit: Grundtabellen. Kann gefahrlos mehrfach ausgeführt werden.
-- Jede Zeile gehört genau einem Login (owner). Row-Level-Security sorgt dafür,
-- dass man nur die eigenen Daten sehen und ändern kann.

create table if not exists public.settings (
  owner uuid primary key default auth.uid() references auth.users on delete cascade,
  sex text not null default 'w' check (sex in ('m', 'w')),
  birth_year int not null,
  height_cm double precision not null,
  start_weight double precision not null,
  start_day date not null default current_date,
  target_weight double precision not null,
  activity double precision not null default 1.375,
  pace double precision not null default 0.5,
  kcal_override int,
  protein_override int,
  updated_at timestamptz not null default now()
);

create table if not exists public.weights (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  kg double precision not null,
  updated_at timestamptz not null default now(),
  primary key (owner, day)
);

create table if not exists public.meals (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  slot text not null default 'snack',
  title text not null default '',
  items jsonb not null default '[]'::jsonb,
  kcal double precision not null default 0,
  protein double precision not null default 0,
  carbs double precision not null default 0,
  fat double precision not null default 0,
  source text not null default 'hand',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meals_owner_day on public.meals (owner, day);

create table if not exists public.favorites (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default '',
  slot text,
  items jsonb not null default '[]'::jsonb,
  kcal double precision not null default 0,
  protein double precision not null default 0,
  carbs double precision not null default 0,
  fat double precision not null default 0,
  uses int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['settings', 'weights', 'meals', 'favorites'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "nur eigene Daten" on public.%I', t);
    execute format('create policy "nur eigene Daten" on public.%I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;
