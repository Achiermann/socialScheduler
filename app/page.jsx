"use client";
import { useEffect, useState } from "react";

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

  async function load() {
    const res = await fetch("/api/posts");
    if (res.ok) setPosts(await res.json());
  }
  useEffect(() => { load(); }, []);

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

  async function sync() {
    setBusy(true);
    setMsg("Synchronisiere mit Dropbox …");
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok
      ? `${data.total} Videos, ${data.added} neu, ${data.durations} Längen ergänzt.`
      : `Fehler: ${data.error}`);
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

  function openVideo(p) {
    window.open(
      `/api/video?path=${encodeURIComponent(p.dropbox_path)}`,
      "video_" + p.id,
      "width=420,height=760"
    );
  }

  const unscheduled = posts.filter((p) => !p.scheduled_at).length;

  return (
    <main>
      <h1>Social Scheduler</h1>
      <div className="toolbar">
        <button onClick={sync} disabled={busy}>Dropbox-Sync</button>
        <span className="sep" />
        <input type="datetime-local" value={apStart} onChange={(e) => setApStart(e.target.value)} style={{ width: 190 }} />
        <span className="msg">alle</span>
        <input type="number" min="1" value={apDays} onChange={(e) => setApDays(e.target.value)} style={{ width: 52 }} />
        <span className="msg">Tage</span>
        <button className="secondary" onClick={autoplan} disabled={busy || !unscheduled}>
          Auto-Plan ({unscheduled} offen)
        </button>
      </div>
      <p className="msg">{posts.length} Posts, davon {unscheduled} ohne Datum. {msg}</p>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Video</th>
            <th style={{ width: 175 }}>Geplant (Lokalzeit)</th>
            <th>Caption</th>
            <th>Länge</th>
            <th>synthComment</th>
            <th>drumComment</th>
            <th>Plattformen</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id}>
              <td>
                <img
                  className="thumb"
                  src={`/api/thumb?path=${encodeURIComponent(p.dropbox_path)}`}
                  alt=""
                  loading="lazy"
                  onClick={() => openVideo(p)}
                  title="Video abspielen"
                />
              </td>
              <td>
                {p.filename}
                <button className="play" onClick={() => openVideo(p)} title="Video in Fenster öffnen">▶</button>
                {p.last_error && <div className="msg" style={{ color: "#b91c1c" }}>{p.last_error}</div>}
              </td>
              <td>
                <input
                  type="datetime-local"
                  value={toLocal(p.scheduled_at)}
                  onChange={(e) => edit(p.id, { scheduled_at: toIso(e.target.value) })}
                />
              </td>
              <td>
                <textarea value={p.caption || ""} onChange={(e) => edit(p.id, { caption: e.target.value })} />
              </td>
              <td className="nowrap">{p.duration_sec != null ? `${p.duration_sec}s` : "–"}</td>
              <td>
                <textarea className="small" value={p.synth_info || ""} onChange={(e) => edit(p.id, { synth_info: e.target.value })} />
              </td>
              <td>
                <textarea className="small" value={p.drum_info || ""} onChange={(e) => edit(p.id, { drum_info: e.target.value })} />
              </td>
              <td>
                {["ig", "tt", "yt"].map((k) => (
                  <label key={k} style={{ display: "block", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={p[`post_${k}`]}
                      onChange={(e) => edit(p.id, { [`post_${k}`]: e.target.checked })}
                    />{" "}
                    {k.toUpperCase()}
                  </label>
                ))}
              </td>
              <td>
                <div>
                  IG <Badge status={p.ig_status} />
                  {p.ig_status === "error" && (
                    <button className="play" title="Erneut versuchen"
                      onClick={() => { edit(p.id, { ig_status: "pending" }); }}>↻</button>
                  )}
                </div>
                <div>TT <Badge status={p.tt_status} /></div>
                <div>YT <Badge status={p.yt_status} /></div>
              </td>
              <td>
                <button className="secondary" disabled={!dirty[p.id] || busy} onClick={() => save(p.id)}>
                  Speichern
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
