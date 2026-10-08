"use client";
import { useEffect, useRef, useState } from "react";

function Badge({ status }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

// datetime-local arbeitet in Lokalzeit, DB speichert UTC
function toLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
// Natuerliche Sortierung: jede Zahl im Namen zaehlt numerisch (0052_01 < 0052_02 < 0053_01)
function byNumber(a, b) {
  return a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: "base" });
}
function toIso(local) {
  return local ? new Date(local).toISOString() : null;
}

export default function Dashboard() {
  const [posts, setPosts] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState({});
  const [apStart, setApStart] = useState("");
  const [apDays, setApDays] = useState(2);
  const dragId = useRef(null);
  const [overId, setOverId] = useState(null);
  const [armed, setArmed] = useState(null); // Zeile, die gerade "ziehbar scharf" ist
  const [view, setView] = useState("planer"); // planer | uebersicht
  const [playingId, setPlayingId] = useState(null); // Video, das gerade in der Zeile laeuft
  // Dropbox-Templinks gelten 4h; beim Hover vorgeladen, damit der Klick sofort abspielt
  const videoLinks = useRef({});

  function prefetchLink(path) {
    const c = videoLinks.current[path];
    if (c && (c.pending || Date.now() < c.until)) return;
    videoLinks.current[path] = { pending: true };
    fetch(`/api/video?json=1&path=${encodeURIComponent(path)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ link }) => { videoLinks.current[path] = { link, until: Date.now() + 3 * 3600 * 1000 }; })
      .catch(() => { delete videoLinks.current[path]; });
  }
  function videoSrc(path) {
    const c = videoLinks.current[path];
    return c?.link && Date.now() < c.until ? c.link : `/api/video?raw=1&path=${encodeURIComponent(path)}`;
  }
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  // Einstellungen schliessen bei Klick daneben oder Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e) => { if (!settingsRef.current?.contains(e.target)) setSettingsOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setSettingsOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  async function dropOn(targetId) {
    const from = dragId.current;
    dragId.current = null;
    setOverId(null);
    if (!from || from === targetId) return;
    const list = [...posts];
    const fromIdx = list.findIndex((p) => p.id === from);
    const toIdx = list.findIndex((p) => p.id === targetId);
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setPosts(list);
    const res = await fetch("/api/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: list.map((p) => p.id) }),
    });
    setMsg(res.ok ? "Reihenfolge gespeichert." : "Fehler beim Speichern der Reihenfolge.");
  }

  async function load() {
    const res = await fetch("/api/posts");
    if (res.ok) setPosts(await res.json());
  }
  useEffect(() => { load(); }, []);

  // Rueckmeldung vom TikTok-OAuth-Callback (?tiktok=...) anzeigen
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    for (const k of ["tiktok", "youtube"]) {
      const p = q.get(k);
      if (!p) continue;
      const name = k === "tiktok" ? "TikTok" : "YouTube";
      setMsg(p === "verbunden" ? `${name} verbunden.` : `${name}-Fehler: ${p}`);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  function edit(id, fields) {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    setDirty((d) => ({ ...d, [id]: { ...d[id], ...fields } }));
  }

  async function save(id) {
    setBusy(true);
    const res = await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...dirty[id] }),
    });
    setBusy(false);
    if (res.ok) {
      setDirty((d) => { const n = { ...d }; delete n[id]; return n; });
      setMsg("Gespeichert.");
    } else setMsg("Fehler beim Speichern.");
  }

  // Setzt das Datum sofort zurueck - nicht ueber den Speichern-Flow
  async function resetDate(id) {
    setBusy(true);
    const res = await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, scheduled_at: null }),
    });
    setBusy(false);
    if (!res.ok) { setMsg("Fehler beim Zurücksetzen."); return; }
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, scheduled_at: null } : p)));
    // Ein offener Datums-Edit wuerde beim Speichern sonst das alte Datum zurueckschreiben
    setDirty((d) => {
      if (!d[id]) return d;
      const { scheduled_at, ...rest } = d[id];
      const n = { ...d };
      if (Object.keys(rest).length) n[id] = rest; else delete n[id];
      return n;
    });
    setMsg("Datum zurückgesetzt.");
  }

  async function sync() {
    setBusy(true);
    setMsg("Synchronisiere mit Dropbox …");
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok
      ? `${data.total} Videos, ${data.added} neu, ${data.durations} Längen ergänzt.`
      : `Fehler: ${data.error}${data.debug ? " | " + JSON.stringify(data.debug) : ""}`);
    load();
  }

  async function autoplan() {
    if (!apStart) { setMsg("Startdatum für Auto-Plan wählen."); return; }
    setBusy(true);
    const res = await fetch("/api/autoplan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: toIso(apStart), intervalDays: apDays }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? `${data.planned} Posts eingeplant.` : `Fehler: ${data.error}`);
    load();
  }

  // Zellen, die Planer und Übersicht gemeinsam nutzen
  const videoCells = (p) => (
    <>
      <td className="thumbcell">
        {playingId === p.id ? (
          <video
            className="thumb"
            src={videoSrc(p.dropbox_path)}
            poster={`/api/thumb?path=${encodeURIComponent(p.dropbox_path)}`}
            autoPlay
            playsInline
            onClick={() => setPlayingId(null)}
            onEnded={() => setPlayingId(null)}
            title="Stopp"
          />
        ) : (
          <img
            className="thumb"
            draggable={false}
            src={`/api/thumb?path=${encodeURIComponent(p.dropbox_path)}`}
            alt=""
            loading="lazy"
            onMouseEnter={() => prefetchLink(p.dropbox_path)}
            onClick={() => setPlayingId(p.id)}
            title="Abspielen"
          />
        )}
      </td>
      <td>
        {p.filename}
        {p.last_error && <div className="msg" style={{ color: "#b91c1c" }}>{p.last_error}</div>}
      </td>
      <td>
        <textarea className="small" value={p.scene || ""} onChange={(e) => edit(p.id, { scene: e.target.value })} />
      </td>
    </>
  );
  const textCells = (p) => (
    <>
      <td>
        <textarea value={p.caption || ""} onChange={(e) => edit(p.id, { caption: e.target.value })} />
      </td>
      <td className="nowrap">{p.duration_sec != null ? `${p.duration_sec}s` : "–"}</td>
      <td>
        <textarea className="small" value={p.comment || ""} onChange={(e) => edit(p.id, { comment: e.target.value })} />
      </td>
    </>
  );
  const statusCell = (p) => (
    <td>
      <div>
        IG <Badge status={p.ig_status} />
        {p.ig_status === "error" && (
          <button className="play" title="Erneut versuchen"
            onClick={() => { edit(p.id, { ig_status: "pending" }); }}>↻</button>
        )}
      </div>
      <div>
        TT <Badge status={p.tt_status} />
        {p.tt_status === "error" && (
          <button className="play" title="Erneut versuchen"
            onClick={() => { edit(p.id, { tt_status: "pending" }); }}>&#8635;</button>
        )}
      </div>
      <div>
        YT <Badge status={p.yt_status} />
        {p.yt_status === "error" && (
          <button className="play" title="Erneut versuchen"
            onClick={() => { edit(p.id, { yt_status: "pending" }); }}>&#8635;</button>
        )}
      </div>
    </td>
  );
  const saveCell = (p) => (
    <td>
      <button className="secondary" disabled={!dirty[p.id] || busy} onClick={() => save(p.id)}>
        Speichern
      </button>
    </td>
  );

  const unscheduled = posts.filter((p) => !p.scheduled_at).length;

  return (
    <main>
      <header className="topbar">
        <h1>Social Scheduler</h1>
        <div className="settings" ref={settingsRef}>
          <button
            className="gear"
            title="Einstellungen"
            aria-label="Einstellungen"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {settingsOpen && (
            <div className="settings-panel" role="dialog" aria-label="Einstellungen">
              <h2>Einstellungen</h2>
              <section>
                <h3>Dropbox</h3>
                <button onClick={sync} disabled={busy}>Dropbox-Sync</button>
              </section>
              <section>
                <h3>Auto-Plan</h3>
                <div className="row">
                  <input type="datetime-local" value={apStart} onChange={(e) => setApStart(e.target.value)} />
                </div>
                <div className="row">
                  <span className="msg">alle</span>
                  <input type="number" min="1" value={apDays} onChange={(e) => setApDays(e.target.value)} style={{ width: 64 }} />
                  <span className="msg">Tage</span>
                  <button className="secondary" onClick={autoplan} disabled={busy || !unscheduled}>
                    Auto-Plan ({unscheduled} offen)
                  </button>
                </div>
              </section>
              <section>
                <h3>Verbindungen</h3>
                <div className="row">
                  <a className="link" href="/api/tiktok/auth">TikTok verbinden</a>
                  <a className="link" href="/api/youtube/auth">YouTube verbinden</a>
                </div>
              </section>
            </div>
          )}
        </div>
      </header>
      <p className="msg">{posts.length} Posts, davon {unscheduled} ohne Datum. {msg}</p>
      <div className="switch" role="tablist">
        {[["planer", "Planer"], ["uebersicht", "Übersicht"]].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k}
            className={view === k ? "active" : ""} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </div>
      {view === "planer" ? (
      <table>
        <thead>
          <tr>
            <th></th>
            <th></th>
            <th>Video</th>
            <th>Szene</th>
            <th style={{ width: 175 }}>Geplant (Lokalzeit)</th>
            <th>Caption</th>
            <th>Länge</th>
            <th>Kommentar (intern)</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr
              key={p.id}
              className={overId === p.id ? "dragover" : ""}
              draggable={armed === p.id}
              onMouseDown={(e) => {
                // Ganze Zeile ziehbar - ausser auf interaktiven Elementen
                if (!e.target.closest("input, textarea, button, select, a, video, img.thumb")) setArmed(p.id);
              }}
              onMouseUp={() => setArmed(null)}
              onDragStart={() => { dragId.current = p.id; }}
              onDragEnd={() => { dragId.current = null; setOverId(null); setArmed(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }}
              onDragLeave={() => setOverId(null)}
              onDrop={(e) => { e.preventDefault(); dropOn(p.id); }}
            >
              <td className="drag" title="Ziehen zum Umsortieren">⠿</td>
              {videoCells(p)}
              <td>
                <div className="datecell">
                  <input
                    type="datetime-local"
                    value={toLocal(p.scheduled_at)}
                    onChange={(e) => edit(p.id, { scheduled_at: toIso(e.target.value) })}
                  />
                  <button
                    className="play"
                    title="Datum zurücksetzen"
                    disabled={!p.scheduled_at || busy}
                    onClick={() => resetDate(p.id)}
                  >
                    &#8634;
                  </button>
                </div>
              </td>
              {textCells(p)}
              {statusCell(p)}
              {saveCell(p)}
            </tr>
          ))}
        </tbody>
      </table>
      ) : (
      <table className="overview">
        <thead>
          <tr>
            <th></th>
            <th>Video</th>
            <th>Szene</th>
            <th>Caption</th>
            <th>Länge</th>
            <th>Kommentar (intern)</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {[...posts].sort(byNumber).map((p) => (
            <tr key={p.id}>
              {videoCells(p)}
              {textCells(p)}
              {statusCell(p)}
              {saveCell(p)}
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </main>
  );
}
