-- Im Supabase SQL-Editor ausfuehren
alter table scheduler.posts
  add column if not exists duration_sec integer,
  add column if not exists synth_info text,
  add column if not exists drum_info text;
