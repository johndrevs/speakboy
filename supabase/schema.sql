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
