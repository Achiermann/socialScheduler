// Fixe Datums-Slots: Position n in der Planer-Reihenfolge = Datum von Slot n-1 + Abstand,
// immer zur eingestellten Uhrzeit (Lokalzeit PLAN_TZ, Sommerzeit wird beruecksichtigt).
// Einzelne Slots koennen ein eigenes Datum bekommen ("Anker"); die folgenden Slots
// rechnen dann von dort aus mit dem normalen Abstand weiter.
import { insertNew, pinLocked, isFixed } from "./spread.js";

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
function slotDays(n, { start, intervalDays, anchors = {} }) {
  const out = [];
  let day = start;
  for (let i = 0; i < n; i++) {
    day = anchors[i] || (i === 0 ? start : addDays(day, intervalDays));
    out.push(day);
  }
  return out;
}

export function slotDates(n, settings) {
  return slotDays(n, settings).map((day) => slotTime(day, settings.time));
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
    .select("id, filename, scheduled_at, ig_status, tt_status, yt_status")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("filename");
  if (error) throw new Error(error.message);

  const dates = slotDates(posts.length, settings);
  const now = new Date().toISOString();
  const rows = [];
  posts.forEach((p, i) => {
    const started = [p.ig_status, p.tt_status, p.yt_status].some((s) => s && s !== "pending");
    if (started) return;
    const when = dates[i];
    if (!p.scheduled_at || new Date(p.scheduled_at).getTime() !== new Date(when).getTime()) {
      rows.push({ id: p.id, filename: p.filename, scheduled_at: when, updated_at: now });
    }
  });
  await bulkUpdate(supabase, rows);
  return rows.length;
}

// Viele Zeilen in einem Request aendern: Upsert auf die ID (Zeilen existieren
// alle, es wird nur aktualisiert). filename muss mit, weil die Spalte NOT NULL ist.
async function bulkUpdate(supabase, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from("posts").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

// Schreibt sort_order = Position (1..n), nur fuer Zeilen, die sich geaendert haben
export async function saveOrder(supabase, ids) {
  const { data, error } = await supabase.from("posts").select("id, filename, sort_order");
  if (error) throw new Error(error.message);
  const current = new Map(data.map((p) => [p.id, p]));
  const now = new Date().toISOString();
  const rows = ids
    .map((id, i) => ({ id, sort_order: i + 1 }))
    .filter(({ id, sort_order }) => current.has(id) && current.get(id).sort_order !== sort_order)
    .map((r) => ({ ...r, filename: current.get(r.id).filename, updated_at: now }));
  await bulkUpdate(supabase, rows);
  return rows.length;
}

// Holt einen vergangenen (oder schon geposteten) Post in die kommende Planung
// zurueck: Status wieder auf pending, sein alter Slot faellt weg, er wird wie ein
// Neuzugang verteilt eingefuegt. Alle anderen Posts behalten ihr Datum - dafuer
// wird der Slot-Rhythmus ab der Luecke ueber Start/Anker neu verankert.
export async function recallPost(supabase, id) {
  const settings = await getPlanSettings(supabase);
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, filename, scene, scheduled_at, ig_status, tt_status, yt_status")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("filename");
  if (error) throw new Error(error.message);
  const r = posts.findIndex((p) => p.id === id);
  if (r < 0) throw new Error("Post nicht gefunden");
  if (!isFixed(posts[r])) throw new Error("Post liegt nicht in der Vergangenheit");

  // Zuerst ohne Datum und auf pending: so greift ihn der Cron nicht mitten im Umbau
  const { error: upErr } = await supabase.from("posts").update({
    scheduled_at: null, ig_status: "pending", tt_status: "pending", yt_status: "pending",
    ig_media_id: null, tt_publish_id: null, yt_video_id: null, last_error: null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (upErr) throw new Error(upErr.message);

  // Slot r entfernen: Anker dahinter ruecken eine Position vor, der neue Slot r
  // bekommt das Datum des bisherigen Slots r+1
  const days = slotDays(posts.length, settings);
  let start = settings.start;
  const anchors = {};
  for (const [k, v] of Object.entries(settings.anchors)) {
    const i = Number(k);
    if (i < r) anchors[i] = v; else if (i > r) anchors[i - 1] = v;
  }
  if (r + 1 < days.length && !anchors[r]) {
    if (r === 0) start = days[1]; else anchors[r] = days[r + 1];
  }

  const lockedIds = settings.lockedIds.filter((x) => x !== id);
  const locked = new Set(lockedIds);
  const rest = posts.filter((p) => p.id !== id);
  const item = { ...posts[r], scheduled_at: null, ig_status: "pending", tt_status: "pending", yt_status: "pending" };
  const final = pinLocked(insertNew(rest, [item]), rest, (p) => locked.has(p.id));

  // Landet er auf einem Slot, der schon vorbei ist (z.B. alles davor vergangen),
  // bekommt sein Slot das naechste kommende Datum im Rhythmus
  const at = final.findIndex((p) => p.id === id);
  let day = slotDays(at + 1, { ...settings, start, anchors })[at];
  if (Date.parse(slotTime(day, settings.time)) < Date.now()) {
    while (Date.parse(slotTime(day, settings.time)) < Date.now()) day = addDays(day, settings.intervalDays);
    if (at === 0) { start = day; delete anchors[0]; } else anchors[at] = day;
  }

  const now = new Date().toISOString();
  const { error: setErr } = await supabase.from("settings").upsert([
    { key: "plan_start", value: start, updated_at: now },
    { key: "plan_anchors", value: JSON.stringify(anchors), updated_at: now },
    { key: "locked_ids", value: JSON.stringify(lockedIds), updated_at: now },
  ]);
  if (setErr) throw new Error(setErr.message);
  await saveOrder(supabase, final.map((p) => p.id));
  await applySlots(supabase);
}
