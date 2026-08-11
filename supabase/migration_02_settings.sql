-- Im Supabase SQL-Editor ausfuehren
-- Key-Value-Tabelle fuer vom System verwaltete Werte (z.B. den aktuellen IG-Token)
create table if not exists scheduler.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);
grant all on scheduler.settings to service_role;
