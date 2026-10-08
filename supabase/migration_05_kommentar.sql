-- Im Supabase SQL-Editor ausfuehren
-- synth_info + drum_info werden zu einer Spalte "Kommentar (intern)" zusammengefuehrt
alter table scheduler.posts add column if not exists comment text;

update scheduler.posts
set comment = concat_ws(E'\n', nullif(trim(synth_info), ''), nullif(trim(drum_info), ''))
where comment is null
  and (nullif(trim(synth_info), '') is not null or nullif(trim(drum_info), '') is not null);

-- Es wird immer auf alle Plattformen gepostet
update scheduler.posts set post_ig = true, post_tt = true, post_yt = true;

-- Alte Spalten erst entfernen, wenn der Kommentar geprueft ist:
-- alter table scheduler.posts drop column synth_info, drop column drum_info;
