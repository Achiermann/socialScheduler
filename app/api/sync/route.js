import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { listVideos, listArchived, videoDuration, folderPath } from "@/lib/dropbox";
import { applySlots, saveOrder, getPlanSettings } from "@/lib/plan";
import { insertNew, pinLocked } from "@/lib/spread";

export const maxDuration = 300;

// Spiegelt den Dropbox-App-Ordner: legt neue Posts an, loescht Posts, deren
// Datei weg ist, aktualisiert verschobene Pfade und ergaenzt fehlende Videolaengen.
export async function POST() {
  try {
    const videos = await listVideos();
    const archived = await listArchived();
    const supabase = db();
    // In Planer-Reihenfolge, damit gesperrte Posts ihre Position behalten koennen
    const { data: existing, error: exErr } = await supabase
      .from("posts")
      .select("id, filename, dropbox_path")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("filename");
    if (exErr) throw new Error(exErr.message);
    const byName = new Map((existing || []).map((p) => [p.filename, p]));

    // Posts ohne Datei entfernen (geloescht oder umbenannt). Archivierte Videos
    // (/Uploaded) zaehlen ueber ihren Pfad, weil Dropbox sie beim Verschieben
    // umbenennen kann. Liefert Dropbox gar nichts, wird nichts geloescht -
    // lieber einmal zu wenig aufraeumen als bei einer Stoerung alles verlieren.
    const inRoot = new Set(videos.map((v) => v.filename));
    const archivedPaths = new Set(archived.map((v) => v.dropbox_path));
    const gone = (existing || []).filter((p) => !inRoot.has(p.filename) && !archivedPaths.has(p.dropbox_path));
    let removed = 0;
    if (gone.length && videos.length + archived.length > 0) {
      const { error } = await supabase.from("posts").delete().in("id", gone.map((p) => p.id));
      if (error) throw new Error(error.message);
      removed = gone.length;
      for (const p of gone) byName.delete(p.filename);
    }

    const { data: maxRow } = await supabase
      .from("posts").select("sort_order").order("sort_order", { ascending: false, nullsFirst: false }).limit(1);
    let nextOrder = (maxRow?.[0]?.sort_order || 0) + 1;
    const fresh = videos
      .filter((v) => !byName.has(v.filename))
      .map((v) => ({ ...v, sort_order: nextOrder++ }));
    if (fresh.length) {
      // ignoreDuplicates: zwei gleichzeitige Syncs (z.B. zwei Tabs) duerfen sich nicht in die Quere kommen
      const { error } = await supabase.from("posts").upsert(fresh, { onConflict: "filename", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    // Neue Videos nicht hinten anhaengen, sondern dort einfuegen, wo sie am
    // weitesten von Videos derselben Session entfernt sind. Gesperrte Posts
    // bleiben dabei (und nach Loeschungen) auf ihrer bisherigen Position.
    if (fresh.length || removed) {
      const { lockedIds } = await getPlanSettings(supabase);
      const locked = new Set(lockedIds);
      const { data: all, error: e } = await supabase
        .from("posts")
        .select("id, filename, scene, scheduled_at, ig_status, tt_status, yt_status")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("filename");
      if (e) throw new Error(e.message);
      const freshNames = new Set(fresh.map((v) => v.filename));
      const ordered = insertNew(
        all.filter((p) => !freshNames.has(p.filename)),
        all.filter((p) => freshNames.has(p.filename))
      );
      const final = pinLocked(ordered, existing, (p) => locked.has(p.id));
      await saveOrder(supabase, final.map((p) => p.id));
    }
    // Nach Neuzugaengen oder Loeschungen rutschen die Slot-Daten nach
    await applySlots(supabase);

    // Pfade nachziehen, wenn sich der Speicherort geaendert hat (z.B. Ordner-Umzug)
    let moved = 0;
    for (const v of videos) {
      const row = byName.get(v.filename);
      if (row && row.dropbox_path !== v.dropbox_path) {
        await supabase.from("posts").update({ dropbox_path: v.dropbox_path }).eq("id", row.id);
        moved++;
      }
    }

    // Fehlende Dauern nachziehen (max. 50 pro Sync-Lauf)
    const { data: missing } = await supabase
      .from("posts")
      .select("id, dropbox_path")
      .is("duration_sec", null)
      .not("dropbox_path", "is", null)
      .limit(50);
    let durations = 0;
    for (const p of missing || []) {
      try {
        const sec = await videoDuration(p.dropbox_path);
        if (sec) {
          await supabase.from("posts").update({ duration_sec: sec }).eq("id", p.id);
          durations++;
        }
      } catch { /* einzelne Fehler ignorieren, kommt beim naechsten Sync */ }
    }

    return NextResponse.json({ total: videos.length, added: fresh.length, removed, moved, durations });
  } catch (e) {
    // Diagnose: zeigt, womit diese Umgebung tatsaechlich arbeitet
    return NextResponse.json({
      error: e.message,
      debug: {
        folderPath: JSON.stringify(folderPath()),
        envRaw: JSON.stringify(process.env.DROPBOX_FOLDER_PATH ?? null),
        appKey: (process.env.DROPBOX_APP_KEY || "").slice(0, 8),
        tokenStart: (process.env.DROPBOX_REFRESH_TOKEN || "").slice(0, 8),
      },
    }, { status: 500 });
  }
}
