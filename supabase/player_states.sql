create table if not exists public.player_states (
  uid text primary key,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.player_accounts (
  uid text primary key,
  username text unique not null,
  password_hash text not null,
  is_admin boolean not null default false,
  banned_until timestamptz,
  ban_reason text,
  timeout_until timestamptz,
  timeout_reason text,
  ingame_name text,
  profile_picture text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_broadcasts (
  id integer primary key default 1,
  message text not null default '',
  active boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.player_states
  add column if not exists profile_id text,
  add column if not exists ingame_name text,
  add column if not exists profile_picture text;

alter table public.player_accounts
  add column if not exists is_admin boolean not null default false,
  add column if not exists banned_until timestamptz,
  add column if not exists ban_reason text,
  add column if not exists timeout_until timestamptz,
  add column if not exists timeout_reason text,
  add column if not exists ingame_name text,
  add column if not exists profile_picture text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists player_accounts_username_key on public.player_accounts (username);
create unique index if not exists admin_broadcasts_singleton_key on public.admin_broadcasts (id);

insert into public.admin_broadcasts (id, message, active)
values (1, '', false)
on conflict (id) do nothing;

update public.player_states
set
  profile_id = coalesce(nullif(profile_id, ''), nullif(state_json -> 'profile' ->> 'uid', ''), uid),
  ingame_name = coalesce(nullif(ingame_name, ''), nullif(state_json -> 'profile' ->> 'ign', ''), nullif(state_json -> 'profile' ->> 'name', '')),
  profile_picture = coalesce(nullif(profile_picture, ''), nullif(state_json -> 'profile' ->> 'avatar', ''))
where profile_id is null or ingame_name is null or profile_picture is null;

alter table public.player_states enable row level security;

drop policy if exists "Players can read own state" on public.player_states;
drop policy if exists "Players can write own state" on public.player_states;

create policy "Players can read own state"
on public.player_states
for select
using (uid = auth.uid()::text);

create policy "Players can write own state"
on public.player_states
for all
using (uid = auth.uid()::text)
with check (uid = auth.uid()::text);
