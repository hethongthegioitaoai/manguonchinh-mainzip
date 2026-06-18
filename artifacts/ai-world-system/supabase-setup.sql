-- AI World System — Supabase table setup
-- Run this in your Supabase dashboard → SQL Editor
-- Safe to re-run: drops existing tables and recreates cleanly

-- ============================================================
-- DROP existing tables (order matters due to FK constraints)
-- ============================================================
drop table if exists public.characters cascade;
drop table if exists public.worlds cascade;
drop table if exists public.users cascade;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();


-- ============================================================
-- 1. users: public profile linked to auth.users
-- ============================================================
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  username   text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Auto-insert profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 2. worlds: the available worlds
-- ============================================================
create table public.worlds (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

alter table public.worlds enable row level security;

create policy "Worlds are readable by authenticated users"
  on public.worlds for select
  using (auth.role() = 'authenticated');

-- Seed the three worlds
insert into public.worlds (slug, name, description) values
  ('cultivation', 'Cultivation World',  'Ancient martial arts meets AI enhancement. Harness digital Qi, meditate in neon-lit mist mountains, and break through to the next realm of consciousness.'),
  ('cyberpunk',   'Cyberpunk World',    'A neon-drenched megacity where chrome and circuitry reign. Navigate rain-soaked streets, hack corporate ICE, and survive the digital underground.'),
  ('zombie',      'Zombie World',       'Post-apocalyptic survival horror. Scavenge for synthetic resources in a world of bioluminescent decay and mutated techno-organic nightmares.');


-- ============================================================
-- 3. characters: user characters per world
-- ============================================================
create table public.characters (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  world_id   uuid not null references public.worlds(id) on delete cascade,
  name       text not null,
  stats      jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.characters enable row level security;

create policy "Users can read own characters"
  on public.characters for select
  using (auth.uid() = user_id);

create policy "Users can insert own characters"
  on public.characters for insert
  with check (auth.uid() = user_id);

create policy "Users can update own characters"
  on public.characters for update
  using (auth.uid() = user_id);

create policy "Users can delete own characters"
  on public.characters for delete
  using (auth.uid() = user_id);
