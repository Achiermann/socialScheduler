-- Im Supabase SQL-Editor ausfuehren
alter table scheduler.posts add column if not exists sort_order integer;

-- Initiale Reihenfolge = alphabetisch nach Filename
with ranked as (
  select id, row_number() over (order by filename) as rn
  from scheduler.posts
)
update scheduler.posts p set sort_order = r.rn
from ranked r where p.id = r.id and p.sort_order is null;
