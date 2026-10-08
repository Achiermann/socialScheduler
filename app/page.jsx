"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

// Picker erst beim ersten Oeffnen laden (grosses Paket)
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

function Badge({ status }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

// Slot-Datum in Lokalzeit: "12.10.26" + "10:00"
function fmtSlot(iso) {
  if (!iso) return { date: "–", time: "" };
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "2-digit" }),
    time: d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }),
  };
}
// Gleicher Szenen-Name -> gleiche Pastellfarbe (Farbton aus dem Namen gehasht)
function sceneColor(name) {
  const key = (name || "").trim().toLowerCase();
  if (!key) return null;
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `hsl(${Math.round((h * 137.508) % 360)}, 70%, 86%)`;
}
const isPast = (p) => p.scheduled_at && new Date(p.scheduled_at).getTime() < Date.now();
const started = (p) => [p.ig_status, p.tt_status, p.yt_status].some((s) => s && s !== "pending");
// Natuerliche Sortierung: jede Zahl im Namen zaehlt numerisch (0052_01 < 0052_02 < 0053_01)
function byNumber(a, b) {
  return a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: "base" });
}

export default function Dashboard() {
  const [posts, setPosts] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // Autosave: Aenderungen je Post sammeln und kurz nach der letzten Eingabe speichern
  const pendingEdits = useRef({});
  const saveTimers = useRef({});
  const [plan, setPlan] = useState({ time: "10:00", intervalDays: 2 }); // Slot-Einstellungen
  const dragId = useRef(null);
  const [overId, setOverId] = useState(null);
  const [armed, setArmed] = useState(null); // Zeile, die gerade "ziehbar scharf" ist
  const [view, setView] = useState("planer"); // planer | uebersicht
  const [shakeKey, setShakeKey] = useState(0); // neu mounten = Shake-Animation neu starten
  const [showPast, setShowPast] = useState(false); // Planer: vergangene Slots einblenden
  const [editingScene, setEditingScene] = useState(null); // Post-ID, deren Szene gerade bearbeitet wird
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
  // Emoji-Picker fuer eine Caption: { id, top, left } (fixe Position am Button)
  const [emojiFor, setEmojiFor] = useState(null);
  const emojiRef = useRef(null);

  useEffect(() => {
    if (!emojiFor) return;
    const onDown = (e) => {
      if (!emojiRef.current?.contains(e.target) && !e.target.closest(".emoji-btn")) setEmojiFor(null);
    };
    const onKey = (e) => { if (e.key === "Escape") setEmojiFor(null); };
    // Nur beim Scrollen der Seite schliessen, nicht beim Scrollen im Picker selbst
    const onScroll = (e) => { if (!emojiRef.current?.contains(e.target)) setEmojiFor(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [emojiFor]);

  function toggleEmoji(id, btn) {
    if (emojiFor?.id === id) { setEmojiFor(null); return; }
    const r = btn.getBoundingClientRect();
    const W = 320, H = 400;
    const below = r.bottom + 6 + H <= window.innerHeight;
    setEmojiFor({
      id,
      top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - H),
      left: Math.min(r.left, window.innerWidth - W - 8),
    });
  }

  // Fuegt das Emoji an der Cursor-Position der Caption ein
  function insertEmoji(id, emoji) {
    const ta = document.getElementById(`caption-${id}`);
    const value = posts.find((p) => p.id === id)?.caption || "";
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    edit(id, { caption: value.slice(0, start) + emoji + value.slice(end) });
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }
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
    // Daten bleiben am Slot (Position), nur die Videos wandern - sofort anzeigen,
    // der Server rechnet anschliessend verbindlich nach
    setPosts(list.map((p, i) => (
      !started(p) && !started(posts[i]) ? { ...p, scheduled_at: posts[i].scheduled_at } : p
    )));
    const res = await fetch("/api/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: list.map((p) => p.id) }),
    });
    setMsg(res.ok ? "Reihenfolge gespeichert." : "Fehler beim Speichern der Reihenfolge.");
    refreshDates();
  }

  // Holt nur die Slot-Daten neu, ohne ungespeicherte Eingaben zu ueberschreiben
  async function refreshDates() {
    const res = await fetch("/api/posts");
    if (!res.ok) return;
    const byId = new Map((await res.json()).map((p) => [p.id, p.scheduled_at]));
    setPosts((ps) => ps.map((p) => (byId.has(p.id) ? { ...p, scheduled_at: byId.get(p.id) } : p)));
  }

  async function savePlan() {
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(`Fehler: ${data.error}`); return; }
    setPlan({ time: data.time, intervalDays: data.intervalDays });
    setMsg(`Slots aktualisiert (${data.updated} Daten geändert).`);
    refreshDates();
  }

  async function load() {
    const res = await fetch("/api/posts");
    if (!res.ok) return;
    // Noch nicht gespeicherte Eingaben nicht mit dem Serverstand ueberschreiben
    const data = await res.json();
    setPosts(data.map((p) => ({ ...p, ...pendingEdits.current[p.id] })));
  }
  useEffect(() => {
    load();
    if (!synced.current) { synced.current = true; sync(); } // StrictMode ruft Effekte doppelt auf
    fetch("/api/settings").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d) setPlan({ time: d.time, intervalDays: d.intervalDays });
    });
  }, []);

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

  function edit(id, fields, immediate = false) {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    pendingEdits.current[id] = { ...pendingEdits.current[id], ...fields };
    clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => flush(id), immediate ? 0 : 800);
  }

  async function flush(id) {
    clearTimeout(saveTimers.current[id]);
    const fields = pendingEdits.current[id];
    if (!fields) return;
    delete pendingEdits.current[id];
    const res = await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    }).catch(() => null);
    if (res?.ok) { setMsg("Gespeichert."); return; }
    // Nicht verlieren: zurueck in die Warteschlange, neuere Eingaben haben Vorrang
    pendingEdits.current[id] = { ...fields, ...pendingEdits.current[id] };
    setMsg("Fehler beim Speichern – wird bei der nächsten Änderung erneut versucht.");
  }

  // Offene Aenderungen beim Verlassen der Seite noch absenden
  useEffect(() => {
    const onHide = () => {
      for (const [id, fields] of Object.entries(pendingEdits.current)) {
        fetch("/api/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...fields }),
          keepalive: true,
        });
      }
      pendingEdits.current = {};
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // Dropbox-Sync bei jedem Seitenaufruf: erst gespeicherten Stand zeigen,
  // dann im Hintergrund synchronisieren und neu laden
  const synced = useRef(false);
  async function sync() {
    setMsg("Synchronisiere mit Dropbox …");
    const res = await fetch("/api/sync", { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "keine Verbindung" };
    if (!res?.ok) {
      setMsg(`Sync-Fehler: ${data.error}${data.debug ? " | " + JSON.stringify(data.debug) : ""}`);
      return;
    }
    setMsg(data.added ? `${data.added} neue Videos aus Dropbox.` : "");
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
      <td className="scene">
        {editingScene === p.id ? (
          // Unsichtbare Kopie des Texts (::after) gibt Breite und Hoehe vor -> Feld so gross wie der Text
          <div className="scene-edit" data-value={p.scene || ""}>
          <textarea
            rows={1}
            cols={1} // keine Eigenbreite, die Breite kommt vom Text
            autoFocus
            style={{ background: sceneColor(p.scene) || undefined }}
            value={p.scene || ""}
            onChange={(e) => edit(p.id, { scene: e.target.value })}
            onBlur={() => { flush(p.id); setEditingScene(null); }}
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); e.currentTarget.blur(); }
            }}
          />
          </div>
        ) : (
          <div
            className={"scene-tag" + (p.scene?.trim() ? "" : " empty")}
            role="button"
            tabIndex={0}
            title="Klicken zum Bearbeiten"
            onClick={() => setEditingScene(p.id)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditingScene(p.id); } }}
          >
            {p.scene?.trim() && (
              <span className="scene-label" style={{ background: sceneColor(p.scene) }}>{p.scene.trim()}</span>
            )}
          </div>
        )}
      </td>
    </>
  );
  const textCells = (p) => (
    <>
      <td>
        <div className="captionbox">
          <textarea id={`caption-${p.id}`} value={p.caption || ""}
            onChange={(e) => edit(p.id, { caption: e.target.value })} onBlur={() => flush(p.id)} />
          <button
            className="emoji-btn"
            title="Emoji einfügen"
            aria-label="Emoji einfügen"
            onMouseDown={(e) => e.preventDefault()} // Cursor-Position im Textfeld behalten
            onClick={(e) => toggleEmoji(p.id, e.currentTarget)}
          >
            ☺
          </button>
        </div>
      </td>
      <td className="nowrap">{p.duration_sec != null ? `${p.duration_sec}s` : "–"}</td>
      <td>
        <textarea className="small" value={p.comment || ""} onChange={(e) => edit(p.id, { comment: e.target.value })} onBlur={() => flush(p.id)} />
      </td>
    </>
  );
  const statusCell = (p) => (
    <td>
      <div>
        IG <Badge status={p.ig_status} />
        {p.ig_status === "error" && (
          <button className="play" title="Erneut versuchen"
            onClick={() => edit(p.id, { ig_status: "pending" }, true)}>↻</button>
        )}
      </div>
      <div>
        TT <Badge status={p.tt_status} />
        {p.tt_status === "error" && (
          <button className="play" title="Erneut versuchen"
            onClick={() => edit(p.id, { tt_status: "pending" }, true)}>&#8635;</button>
        )}
      </div>
      <div>
        YT <Badge status={p.yt_status} />
        {p.yt_status === "error" && (
          <button className="play" title="Erneut versuchen"
            onClick={() => edit(p.id, { yt_status: "pending" }, true)}>&#8635;</button>
        )}
      </div>
    </td>
  );


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
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {settingsOpen && (
            <div className="settings-panel" role="dialog" aria-label="Einstellungen">
              <h2>Einstellungen</h2>
              <section>
                <h3>Datums-Slots</h3>
                <div className="row">
                  <span className="msg">Uhrzeit</span>
                  <input type="time" value={plan.time} onChange={(e) => setPlan({ ...plan, time: e.target.value })} style={{ width: 110 }} />
                </div>
                <div className="row">
                  <span className="msg">alle</span>
                  <input type="number" min="1" value={plan.intervalDays}
                    onChange={(e) => setPlan({ ...plan, intervalDays: e.target.value })} style={{ width: 64 }} />
                  <span className="msg">Tage</span>
                  <button className="secondary" onClick={savePlan} disabled={busy}>Übernehmen</button>
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
      <p className="msg">{posts.length} Posts. {msg}</p>
      <div className="switchbar">
        <div className="switch" role="tablist">
          {[["planer", "Planer"], ["uebersicht", "Übersicht"]].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={view === k}
              className={view === k ? "active" : ""} onClick={() => setView(k)}>
              {label}
            </button>
          ))}
        </div>
        <button className="shaker" title="Shake!" aria-label="Shaker schütteln" onClick={() => setShakeKey((k) => k + 1)}>
          <svg key={shakeKey} className={shakeKey ? "shake" : ""} width="50" height="67" viewBox="0 0 48 64"
            fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Klappdeckel mit Ausguss */}
            <path d="M19 10V7.5Q19 6 20.5 6h5Q27 6 27 7.5V10" />
            <path d="M29 10q4-5 0-6.5" />
            <path d="M14 15l2-5h16l2 5" />
            {/* Schraubring */}
            <rect x="11" y="15" width="26" height="7" rx="1.5" />
            <path d="M16 15v7M21 15v7M27 15v7M32 15v7" strokeWidth="1" />
            {/* Becher, leicht konisch */}
            <path d="M12.5 22l2 35.5Q15 61 18.5 61h11Q33 61 33.5 57.5l2-35.5" />
            {/* Skala */}
            <path d="M16 30h5M16.4 37h3.5M16.8 44h5M17.2 51h3.5" strokeWidth="1.2" />
            {/* Mixball */}
            <circle cx="27" cy="53" r="4" strokeWidth="1.3" />
            <path d="M23 53q4-2.5 8 0M27 49q-2.5 4 0 8" strokeWidth="1" />
          </svg>
        </button>
      </div>
      {view === "planer" && (
        <div className="subbar">
          <button
            className={"toggle" + (showPast ? " active" : "")}
            aria-pressed={showPast}
            onClick={() => setShowPast((v) => !v)}
          >
            Vergangen ({posts.filter(isPast).length})
          </button>
        </div>
      )}
      {view === "planer" ? (
      <table>
        <thead>
          <tr>
            <th className="slot"></th>
            <th></th>
            <th></th>
            <th>Video</th>
            <th>Szene</th>
            <th>Caption</th>
            <th>Länge</th>
            <th>Kommentar (intern)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {posts.filter((p) => showPast || !isPast(p)).map((p) => (
            <tr
              key={p.id}
              className={[overId === p.id && "dragover", isPast(p) && "past"].filter(Boolean).join(" ")}
              draggable={armed === p.id}
              onMouseDown={(e) => {
                // Ganze Zeile ziehbar - ausser auf interaktiven Elementen
                if (!e.target.closest("input, textarea, button, select, a, video, img.thumb, .scene-tag")) setArmed(p.id);
              }}
              onMouseUp={() => setArmed(null)}
              onDragStart={() => { dragId.current = p.id; }}
              onDragEnd={() => { dragId.current = null; setOverId(null); setArmed(null); }}
              onDragOver={(e) => { e.preventDefault(); setOverId(p.id); }}
              onDragLeave={() => setOverId(null)}
              onDrop={(e) => { e.preventDefault(); dropOn(p.id); }}
            >
              <td className="slot">
                <div className="slot-date">{fmtSlot(p.scheduled_at).date}</div>
                <div className="slot-time">{fmtSlot(p.scheduled_at).time}</div>
              </td>
              <td className="drag" title="Ziehen zum Umsortieren">⠿</td>
              {videoCells(p)}
              {textCells(p)}
              {statusCell(p)}
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
          </tr>
        </thead>
        <tbody>
          {[...posts].sort(byNumber).map((p) => (
            <tr key={p.id}>
              {videoCells(p)}
              {textCells(p)}
              {statusCell(p)}
            </tr>
          ))}
        </tbody>
      </table>
      )}
      {emojiFor && (
        <div className="emoji-pop" ref={emojiRef} style={{ top: emojiFor.top, left: emojiFor.left }}>
          <EmojiPicker
            width={320}
            height={400}
            lazyLoadEmojis
            previewConfig={{ showPreview: false }}
            searchPlaceholder="Suchen (englisch)"
            onEmojiClick={(d) => insertEmoji(emojiFor.id, d.emoji)}
          />
        </div>
      )}
    </main>
  );
}
