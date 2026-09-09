-- Im Supabase SQL-Editor ausfuehren
alter table scheduler.posts
  add column if not exists tt_publish_id text,
  add column if not exists yt_video_id text;

-- Dropbox-Pfad wird beim Sync gepflegt; Index fuer die Tick-Abfrage
create index if not exists posts_tt_due_idx on scheduler.posts (scheduled_at) where tt_status = 'pending';
