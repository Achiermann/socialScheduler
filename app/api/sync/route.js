import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { listVideos, videoDuration } from "@/lib/dropbox";

export const maxDuration = 300;

// Holt alle Videodateien aus dem Dropbox-Ordner, legt neue Posts an,
// aktualisiert verschobene Pfade und ergaenzt fehlende Videolaengen.
export async function POST() {
  try {
    const videos = await listVideos();
    const supabase = db();
    const { data: existing } = await supabase.from("posts").select("id, filename, dropbox_path");
    const byName = new Map((existing || []).map((p) => [p.filename, p]));

    const fresh = videos.filter((v) => !byName.has(v.filename));
    if (fresh.length) {
      const { error } = await supabase.from("posts").insert(fresh);
      if (error) throw new Error(error.message);
    }

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

    return NextResponse.json({ total: videos.length, added: fresh.length, moved, durations });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
