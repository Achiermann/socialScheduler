// Verteilt Posts so, dass gleiche Sessions und gleiche Szenen moeglichst weit
// auseinander liegen. Jede Szene gehoert zu einer Session, deshalb zweistufig:
//   1. Sessions auf die Slots verteilen: die groesste Session bekommt gleichmaessig
//      verteilte Slots, die naechste gleichmaessig verteilte von den uebrigen usw.
//   2. Innerhalb der Slots jeder Session die Szenen auf dieselbe Weise verteilen.
// Aus vielen Zufallsvarianten (Phase, Reihenfolge gleich grosser Gruppen) gewinnt
// die mit dem groessten kleinsten Session-Abstand, danach Szenen-Abstand.
// Vergangene oder schon gepostete Videos bleiben fest an ihrem Platz, zaehlen bei
// den Abstaenden aber mit (z.B. darf der erste kommende Slot nicht dieselbe
// Session haben wie der letzte vergangene).

// Fest = schon (teilweise) gepostet oder Slot liegt in der Vergangenheit
export function isFixed(p, now = Date.now()) {
  const started = [p.ig_status, p.tt_status, p.yt_status].some((st) => st && st !== "pending");
  return started || (p.scheduled_at != null && new Date(p.scheduled_at).getTime() < now);
}

const sceneKey = (p) => (p.scene || "").trim().toLowerCase();
// Session = erste vier Zeichen des Dateinamens (z.B. "0052", "Lieb", "Alte")
const sessionKey = (p) => (p.filename || "").slice(0, 4).toLowerCase();

function group(items, key) {
  const groups = new Map();
  for (const p of items) {
    const k = key(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  return [...groups.values()];
}

// Legt die Gruppen (groesste zuerst) auf gleichmaessig verteilte freie Plaetze 0..n-1.
// Die Reihenfolge innerhalb einer Gruppe bleibt erhalten.
function lattice(n, groups, rand) {
  let free = [...Array(n).keys()];
  const out = new Array(n);
  groups.sort((a, b) => b.length - a.length || rand() - 0.5);
  for (const g of groups) {
    const phase = rand();
    const F = free.length;
    const taken = new Set();
    g.forEach((p, k) => {
      const i = Math.min(F - 1, Math.floor(((k + phase) * F) / g.length));
      taken.add(i);
      out[free[i]] = p;
    });
    free = free.filter((_, i) => !taken.has(i));
  }
  return out;
}

function arrange(items, rand) {
  const bySessionSlot = lattice(items.length, group(items, sessionKey), rand);
  const result = new Array(items.length);
  for (const session of group(items, sessionKey)) {
    const key = sessionKey(session[0]);
    const slots = [];
    bySessionSlot.forEach((p, i) => { if (sessionKey(p) === key) slots.push(i); });
    lattice(slots.length, group(session, sceneKey), rand).forEach((p, j) => { result[slots[j]] = p; });
  }
  return result;
}

// Kleinster Abstand zwischen zwei Posts mit gleichem Schluessel und wie oft er vorkommt.
// Paare aus zwei festen Posts zaehlen nicht - an denen laesst sich nichts aendern.
function gaps(list, key, fixed) {
  const last = new Map();
  let min = Infinity, count = 0;
  list.forEach((p, i) => {
    const k = key(p);
    if (!k) return;
    if (last.has(k)) {
      const j = last.get(k);
      if (!(fixed[i] && fixed[j])) {
        const d = i - j;
        if (d < min) { min = d; count = 1; } else if (d === min) count++;
      }
    }
    last.set(k, i);
  });
  return { min, count };
}
const score = (list, fixed) => ({ session: gaps(list, sessionKey, fixed), scene: gaps(list, sceneKey, fixed) });
const better = (a, b) =>
  a.session.min - b.session.min || a.scene.min - b.scene.min
  || b.session.count - a.session.count || b.scene.count - a.scene.count;

// Shaker: verteilt alle nicht festen Posts neu. Gibt die komplette Liste zurueck,
// feste Posts stehen weiter an ihrer Position. Innerhalb einer Szene bleibt die
// bisherige Reihenfolge erhalten.
export function spreadScenes(list, fixedFn = isFixed, tries = 3000, rand = Math.random) {
  const fixed = list.map((p) => fixedFn(p));
  const freeIdx = [];
  fixed.forEach((f, i) => { if (!f) freeIdx.push(i); });
  const movable = freeIdx.map((i) => list[i]);
  let best = list, bestScore = score(list, fixed);
  for (let t = 0; t < tries; t++) {
    const arranged = arrange(movable, rand);
    const cand = [...list];
    freeIdx.forEach((i, k) => { cand[i] = arranged[k]; });
    const sc = score(cand, fixed);
    if (better(sc, bestScore) > 0) { best = cand; bestScore = sc; }
  }
  return best;
}

// Neuzugaenge einzeln an der Stelle einfuegen, an der sie am weitesten von
// Videos derselben Session (und Szene, falls schon gesetzt) entfernt sind.
// Eingefuegt wird nur hinter dem letzten festen Post; der Rest der Planung
// behaelt seine Reihenfolge. Bei Gleichstand gewinnt die spaetere Stelle,
// damit moeglichst wenig bestehende Termine nach hinten rutschen.
export function insertNew(list, newItems, fixedFn = isFixed) {
  const out = [...list];
  const byNumber = (a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true });
  for (const item of [...newItems].sort(byNumber)) {
    let lastFixed = -1;
    out.forEach((p, i) => { if (fixedFn(p)) lastFixed = i; });
    const keys = [[sessionKey, sessionKey(item)], [sceneKey, sceneKey(item)]].filter(([, k]) => k);
    let bestPos = out.length, bestDist = [-1, -1];
    for (let pos = lastFixed + 1; pos <= out.length; pos++) {
      // Abstand des neuen Posts (Index pos) zum naechsten gleichen davor und danach
      const dist = keys.map(([key, k]) => {
        let d = Infinity;
        for (let j = pos - 1; j >= 0; j--) if (key(out[j]) === k) { d = pos - j; break; }
        for (let j = pos; j < out.length; j++) if (key(out[j]) === k) { d = Math.min(d, j + 1 - pos); break; }
        return d;
      });
      while (dist.length < 2) dist.push(Infinity);
      if (dist[0] > bestDist[0] || (dist[0] === bestDist[0] && dist[1] >= bestDist[1])) { bestDist = dist; bestPos = pos; }
    }
    out.splice(bestPos, 0, item);
  }
  return out;
}

// Gesperrte Posts bleiben auf ihrer bisherigen Position (Index in prev); alle
// anderen fuellen in der Reihenfolge von list die uebrigen Plaetze. Gilt nach
// Drag & Drop, Shaker, Neuzugaengen und Loeschungen.
export function pinLocked(list, prev, isLocked) {
  const n = list.length;
  const out = new Array(n);
  const ids = new Set(list.map((p) => p.id));
  const pinned = new Set();
  prev.forEach((p, i) => {
    if (!isLocked(p) || !ids.has(p.id)) return;
    let at = Math.min(i, n - 1);
    while (out[at] && at < n - 1) at++; // falls durch Loeschungen schon belegt
    while (out[at] && at > 0) at--;
    out[at] = list.find((q) => q.id === p.id);
    pinned.add(p.id);
  });
  const rest = list.filter((p) => !pinned.has(p.id));
  let k = 0;
  for (let i = 0; i < n; i++) if (!out[i]) out[i] = rest[k++];
  return out;
}
