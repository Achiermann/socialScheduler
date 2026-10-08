// Verteilt Posts so, dass gleiche Szenen moeglichst weit auseinander liegen.
// Idee: jede Szene mit c Videos bekommt Zielpositionen im Abstand 1/c
// ((k + Phase) / c), danach wird nach diesem Wert sortiert. Aus vielen
// Zufallsvarianten (Phase, Reihenfolge bei Gleichstand) gewinnt die mit dem
// groessten kleinsten Abstand zwischen zwei gleichen Szenen.

const sceneKey = (p) => (p.scene || "").trim().toLowerCase();

// Kleinster Abstand zwischen zwei gleichen Szenen und wie oft er vorkommt
function score(list) {
  const last = new Map();
  let min = Infinity, count = 0;
  list.forEach((p, i) => {
    const k = sceneKey(p);
    if (last.has(k)) {
      const d = i - last.get(k);
      if (d < min) { min = d; count = 1; } else if (d === min) count++;
    }
    last.set(k, i);
  });
  return { min, count };
}

function arrange(items, rand) {
  const groups = new Map();
  for (const p of items) {
    const k = sceneKey(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const keyed = [];
  for (const members of groups.values()) {
    const phase = 0.15 + rand() * 0.7;
    const tie = rand();
    members.forEach((p, k) => keyed.push({ p, pos: (k + phase) / members.length, tie }));
  }
  keyed.sort((a, b) => a.pos - b.pos || a.tie - b.tie);
  return keyed.map((x) => x.p);
}

// movable: Posts, die verschoben werden duerfen (in aktueller Reihenfolge).
// Innerhalb einer Szene bleibt die bisherige Reihenfolge erhalten.
export function spreadScenes(movable, tries = 5000, rand = Math.random) {
  let best = movable, bestScore = score(movable);
  for (let t = 0; t < tries; t++) {
    const cand = arrange(movable, rand);
    const s = score(cand);
    if (s.min > bestScore.min || (s.min === bestScore.min && s.count < bestScore.count)) {
      best = cand; bestScore = s;
    }
  }
  return best;
}
