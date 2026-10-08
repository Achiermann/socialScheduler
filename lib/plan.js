// Fixe Datums-Slots: Position n in der Planer-Reihenfolge = Startdatum + n * Abstand,
// immer zur eingestellten Uhrzeit (Lokalzeit PLAN_TZ, Sommerzeit wird beruecksichtigt).

const DEFAULTS = { plan_start: "2026-10-12", plan_time: "10:00", plan_interval_days: "2" };
const TZ = process.env.PLAN_TZ || "Europe/Zurich";

export async function getPlanSettings(supabase) {
  const { data, error } = await supabase
    .from("settings").select("key, value").in("key", Object.keys(DEFAULTS));
  if (error) throw new Error(error.message);
  const s = { ...DEFAULTS };
  for (const r of data || []) s[r.key] = r.value;
  return {
    start: s.plan_start,
    time: s.plan_time,
    intervalDays: Math.max(1, parseInt(s.plan_interval_days) || 2),
  };
}

export async function savePlanSettings(supabase, { time, intervalDays }) {
  const now = new Date().toISOString();
  const rows = [];
  if (time != null) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Uhrzeit ungültig");
    rows.push({ key: "plan_time", value: time, updated_at: now });
  }
  if (intervalDays != null) {
    const n = parseInt(intervalDays);
    if (!(n >= 1)) throw new Error("Abstand muss mindestens 1 Tag sein");
    rows.push({ key: "plan_interval_days", value: String(n), updated_at: now });
  }
  if (!rows.length) return;
  const { error } = await supabase.from("settings").upsert(rows);
  if (error) throw new Error(error.message);
}

// Abstand der Zeitzone zu UTC (ms) zum Zeitpunkt ms
function tzOffset(ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(ms)).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

export function slotIso(index, { start, time, intervalDays }) {
  const [y, m, d] = start.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d + index * intervalDays, hh, mm);
  let utc = wall - tzOffset(wall);
  utc = wall - tzOffset(utc); // zweiter Durchgang fuer Tage mit Zeitumstellung
  return new Date(utc).toISOString();
}

// Schreibt jedem Post das Datum seines Slots. Posts, bei denen schon eine
// Plattform gepostet hat (Status != pending), behalten ihr echtes Datum.
export async function applySlots(supabase) {
  const settings = await getPlanSettings(supabase);
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, scheduled_at, ig_status, tt_status, yt_status")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("filename");
  if (error) throw new Error(error.message);

  const updates = [];
  posts.forEach((p, i) => {
    const started = [p.ig_status, p.tt_status, p.yt_status].some((s) => s && s !== "pending");
    if (started) return;
    const when = slotIso(i, settings);
    if (!p.scheduled_at || new Date(p.scheduled_at).getTime() !== new Date(when).getTime()) {
      updates.push(supabase.from("posts").update({ scheduled_at: when, updated_at: new Date().toISOString() }).eq("id", p.id));
    }
  });
  for (const { error: e } of await Promise.all(updates)) if (e) throw new Error(e.message);
  return updates.length;
}

// Schreibt sort_order = Position (1..n), nur fuer Zeilen, die sich geaendert haben
export async function saveOrder(supabase, ids) {
  const { data, error } = await supabase.from("posts").select("id, sort_order");
  if (error) throw new Error(error.message);
  const current = new Map(data.map((p) => [p.id, p.sort_order]));
  const now = new Date().toISOString();
  const changes = ids.map((id, i) => [id, i + 1]).filter(([id, n]) => current.get(id) !== n);
  for (let i = 0; i < changes.length; i += 25) {
    const results = await Promise.all(changes.slice(i, i + 25).map(([id, n]) =>
      supabase.from("posts").update({ sort_order: n, updated_at: now }).eq("id", id)));
    for (const { error: e } of results) if (e) throw new Error(e.message);
  }
  return changes.length;
}
