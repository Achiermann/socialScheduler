// Fixe Datums-Slots: Position n in der Planer-Reihenfolge = Datum von Slot n-1 + Abstand,
// immer zur eingestellten Uhrzeit (Lokalzeit PLAN_TZ, Sommerzeit wird beruecksichtigt).
// Einzelne Slots koennen ein eigenes Datum bekommen ("Anker"); die folgenden Slots
// rechnen dann von dort aus mit dem normalen Abstand weiter.

const DEFAULTS = {
  plan_start: "2026-10-12",
  plan_time: "10:00",
  plan_interval_days: "2",
  plan_anchors: "{}", // { "<Slot-Index>": "YYYY-MM-DD" }
  locked_ids: "[]", // Post-IDs, die beim Umsortieren an ihrer Position bleiben
};
const TZ = process.env.PLAN_TZ || "Europe/Zurich";

export async function getPlanSettings(supabase) {
  const { data, error } = await supabase
    .from("settings").select("key, value").in("key", Object.keys(DEFAULTS));
  if (error) throw new Error(error.message);
  const s = { ...DEFAULTS };
  for (const r of data || []) s[r.key] = r.value;
  const json = (v, fallback) => { try { return JSON.parse(v); } catch { return fallback; } };
  return {
    start: s.plan_start,
    time: s.plan_time,
    intervalDays: Math.max(1, parseInt(s.plan_interval_days) || 2),
    anchors: json(s.plan_anchors, {}),
    lockedIds: json(s.locked_ids, []),
  };
}

async function setSetting(supabase, key, value) {
  const { error } = await supabase.from("settings")
    .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// Eigenes Datum fuer Slot index setzen (date = "YYYY-MM-DD") oder entfernen (date = null)
export async function setAnchor(supabase, index, date) {
  if (!Number.isInteger(index) || index < 0) throw new Error("Slot ungültig");
  const settings = await getPlanSettings(supabase);
  const anchors = { ...settings.anchors };
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Datum ungültig");
    // Ein Slot in der Vergangenheit wuerde beim naechsten Cron-Lauf sofort gepostet
    if (new Date(slotTime(date, settings.time)).getTime() < Date.now()) {
      throw new Error("Datum liegt in der Vergangenheit");
    }
    anchors[index] = date;
  } else {
    delete anchors[index];
  }
  await setSetting(supabase, "plan_anchors", anchors);
}

export async function setLocked(supabase, id, locked) {
  const { lockedIds } = await getPlanSettings(supabase);
  const ids = new Set(lockedIds);
  if (locked) ids.add(id); else ids.delete(id);
  // Geloeschte Posts nicht ewig mitschleppen
  const { data } = await supabase.from("posts").select("id").in("id", [...ids]);
  await setSetting(supabase, "locked_ids", (data || []).map((p) => p.id));
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

// Wanduhrzeit (date "YYYY-MM-DD" + time "HH:MM" in PLAN_TZ) als UTC-ISO-String
function slotTime(date, time) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let utc = wall - tzOffset(wall);
  utc = wall - tzOffset(utc); // zweiter Durchgang fuer Tage mit Zeitumstellung
  return new Date(utc).toISOString();
}

const addDays = (date, n) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// Daten aller n Slots: Slot 0 = Start (oder Anker), danach jeweils + Abstand,
// ausser ein Slot hat einen eigenen Anker - dann zaehlt ab dort dieser.
export function slotDates(n, { start, time, intervalDays, anchors = {} }) {
  const out = [];
  let day = start;
  for (let i = 0; i < n; i++) {
    day = anchors[i] || (i === 0 ? start : addDays(day, intervalDays));
    out.push(slotTime(day, time));
  }
  return out;
}

export function slotIso(index, settings) {
  return slotDates(index + 1, settings)[index];
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

  const dates = slotDates(posts.length, settings);
  const updates = [];
  posts.forEach((p, i) => {
    const started = [p.ig_status, p.tt_status, p.yt_status].some((s) => s && s !== "pending");
    if (started) return;
    const when = dates[i];
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
