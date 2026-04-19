create extension if not exists pgcrypto;

create table if not exists public.pet_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null,
  pet_name text not null,
  animal_type text not null,
  persona_style text not null,
  backstory text not null,
  twilio_number text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists pet_profiles_created_at_idx
  on public.pet_profiles (created_at desc);

create table if not exists public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_key text not null,
  role text not null check (role in ('user', 'assistant')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists thread_messages_thread_key_created_at_idx
  on public.thread_messages (thread_key, created_at desc);

create table if not exists public.pet_memory_items (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pet_profiles(id) on delete cascade,
  category text not null check (category in ('identity', 'relationship', 'preference', 'routine', 'biography')),
  subject text not null check (subject in ('self', 'owner', 'other')),
  key text not null,
  value text not null,
  source text not null check (source in ('told_by_owner', 'observed_in_conversation', 'inferred_from_pattern', 'expressed_by_pet')),
  confidence numeric not null default 0.8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pet_memory_items_pet_key_unique_idx
  on public.pet_memory_items (pet_id, subject, key);

create index if not exists pet_memory_items_pet_updated_at_idx
  on public.pet_memory_items (pet_id, updated_at desc);
