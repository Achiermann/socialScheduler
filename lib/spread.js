// Verteilt Posts so, dass gleiche Sessions und gleiche Szenen moeglichst weit
// auseinander liegen. Jede Szene gehoert zu einer Session, deshalb zweistufig:
//   1. Sessions auf die Slots verteilen: die groesste Session bekommt gleichmaessig
//      verteilte Slots, die naechste gleichmaessig verteilte von den uebrigen usw.
//   2. Innerhalb der Slots jeder Session die Szenen auf dieselbe Weise verteilen.
// Aus vielen Zufallsvarianten (Phase, Reihenfolge gleich grosser Gruppen) gewinnt
// die mit dem groessten kleinsten Session-Abstand, danach Szenen-Abstand.

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

// Kleinster Abstand zwischen zwei Posts mit gleichem Schluessel und wie oft er vorkommt
function gaps(list, key) {
  const last = new Map();
  let min = Infinity, count = 0;
  list.forEach((p, i) => {
    const k = key(p);
    if (last.has(k)) {
      const d = i - last.get(k);
      if (d < min) { min = d; count = 1; } else if (d === min) count++;
    }
    last.set(k, i);
  });
  return { min, count };
}
const score = (list) => ({ session: gaps(list, sessionKey), scene: gaps(list, sceneKey) });
const better = (a, b) =>
  a.session.min - b.session.min || a.scene.min - b.scene.min
  || b.session.count - a.session.count || b.scene.count - a.scene.count;

// movable: Posts, die verschoben werden duerfen (in aktueller Reihenfolge).
// Innerhalb einer Szene bleibt die bisherige Reihenfolge erhalten.
export function spreadScenes(movable, tries = 3000, rand = Math.random) {
  let best = movable, bestScore = score(movable);
  for (let t = 0; t < tries; t++) {
    const cand = arrange(movable, rand);
    const s = score(cand);
    if (better(s, bestScore) > 0) { best = cand; bestScore = s; }
  }
  return best;
}
