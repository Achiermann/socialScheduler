-- Im Supabase SQL-Editor ausfuehren
create schema if not exists scheduler;

create table if not exists scheduler.posts (
  id uuid primary key default gen_random_uuid(),
  filename text unique not null,
  dropbox_path text,
  scheduled_at timestamptz,          -- null = noch nicht eingeplant
  caption text default '',
  duration_sec integer,
  synth_info text,
  drum_info text,
  post_ig boolean default true,
  post_tt boolean default true,
  post_yt boolean default true,
  ig_status text default 'pending',  -- pending | published | error | skipped
  tt_status text default 'pending',  -- pending | drafted | error | skipped
  yt_status text default 'pending',
  ig_media_id text,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists posts_due_idx on scheduler.posts (scheduled_at) where ig_status = 'pending';

-- Zugriff fuer die API (PostgREST) freigeben
grant usage on schema scheduler to service_role;
grant all on all tables in schema scheduler to service_role;
alter default privileges in schema scheduler grant all on tables to service_role;
