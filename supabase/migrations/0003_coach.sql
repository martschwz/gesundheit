-- Gesundheit, Etappe 3: Erinnerungen per Benachrichtigung. Kann gefahrlos mehrfach ausgeführt werden.

-- Welche Erinnerungen wann kommen sollen (eine Zeile pro Login)
create table if not exists public.reminder_settings (
  owner uuid primary key default auth.uid() references auth.users on delete cascade,
  items jsonb not null default '[]'::jsonb,
  tz text not null default 'Europe/Berlin',
  updated_at timestamptz not null default now()
);
alter table public.reminder_settings enable row level security;
drop policy if exists "nur eigene Daten" on public.reminder_settings;
create policy "nur eigene Daten" on public.reminder_settings for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Geräte, die Benachrichtigungen bekommen
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "nur eigene Daten" on public.push_subscriptions;
create policy "nur eigene Daten" on public.push_subscriptions for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

-- Nur für den Server (keine Regeln = für die App nicht lesbar):
-- Schlüssel für Benachrichtigungen und welche Erinnerung schon verschickt wurde
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  public_key text,
  private_key text,
  cron_token text not null
);
alter table public.push_config enable row level security;
insert into public.push_config (id, cron_token) values (1, gen_random_uuid()::text) on conflict (id) do nothing;

create table if not exists public.reminder_log (
  owner uuid not null references auth.users on delete cascade,
  key text not null,
  day date not null,
  primary key (owner, key, day)
);
alter table public.reminder_log enable row level security;

-- Alle 15 Minuten prüfen, ob eine Erinnerung fällig ist
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'gesundheit-erinnerungen',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://uqefvtxnhtatlvfpclci.supabase.co/functions/v1/reminders',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := jsonb_build_object('action', 'tick', 'token', (select cron_token from public.push_config where id = 1))
     ) $$
);
