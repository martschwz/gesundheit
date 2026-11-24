-- Gesundheit, Etappe 2: Gesundheitswerte. Kann gefahrlos mehrfach ausgeführt werden.

-- Ein Eintrag pro Tag: Wasser, Schritte, Schlaf
create table if not exists public.daily (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  water_ml int not null default 0,
  steps int,
  sleep_hours double precision,
  sleep_quality int,
  updated_at timestamptz not null default now(),
  primary key (owner, day)
);

-- Einzelmessungen: Blutdruck (v1 = oben, v2 = unten, v3 = Puls), Blutzucker (v1 in mg/dl),
-- Körpermaße (v1 in cm bzw. % bei Körperfett)
create table if not exists public.measurements (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null,
  day date not null,
  time text not null default '',
  v1 double precision not null,
  v2 double precision,
  v3 double precision,
  tag text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists measurements_owner_kind on public.measurements (owner, kind, day);

-- Laborwerte vom Arzt
create table if not exists public.labs (
  id uuid primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  name text not null,
  value double precision not null,
  unit text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.daily enable row level security;
alter table public.measurements enable row level security;
alter table public.labs enable row level security;

drop policy if exists "nur eigene Daten" on public.daily;
create policy "nur eigene Daten" on public.daily for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "nur eigene Daten" on public.measurements;
create policy "nur eigene Daten" on public.measurements for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "nur eigene Daten" on public.labs;
create policy "nur eigene Daten" on public.labs for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
