import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { temporaryLink, fileSize, moveToUploaded, ARCHIVE_FOLDER } from "@/lib/dropbox";
import { currentToken as igToken, publishReel } from "@/lib/instagram";
import { currentToken as ttToken, uploadToInbox } from "@/lib/tiktok";
import { currentToken as ytToken, uploadShort } from "@/lib/youtube";

export const maxDuration = 300; // Vercel: bis 5 Min Laufzeit erlauben

const now = () => new Date().toISOString();

// Wird per Cron (Supabase pg_cron) aufgerufen und erledigt EINE faellige
// Aufgabe pro Lauf - Instagram hat Vorrang, danach TikTok.
export async function POST(req) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = db();

  async function nextDue(platformCol, statusCol) {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .lte("scheduled_at", now())
      .eq(statusCol, "pending")
      .eq(platformCol, true)
      .order("scheduled_at")
      .limit(1);
    if (error) throw new Error(error.message);
    return data?.[0] || null;
  }

  // Schiebt das Video nach /Uploaded, sobald ALLE aktivierten Plattformen fertig
  // sind. Fehler hier duerfen den erfolgreichen Post nie kippen.
  async function maybeArchive(postId) {
    try {
      const { data: p } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
      if (!p?.dropbox_path) return;
      if (p.dropbox_path.toLowerCase().includes(`/${ARCHIVE_FOLDER.toLowerCase()}/`)) return;

      const done = (enabled, status, terminal) => !enabled || terminal.includes(status);
      if (!done(p.post_ig, p.ig_status, ["published", "skipped"])) return;
      if (!done(p.post_tt, p.tt_status, ["drafted", "skipped"])) return;
      if (!done(p.post_yt, p.yt_status, ["published", "skipped"])) return;

      const newPath = await moveToUploaded(p.dropbox_path, p.filename);
      await supabase.from("posts").update({ dropbox_path: newPath, updated_at: now() }).eq("id", p.id);
    } catch (e) {
      console.error("Archivieren fehlgeschlagen:", e.message);
    }
  }

  async function fail(post, col, e) {
    await supabase
      .from("posts")
      .update({ [col]: "error", last_error: e.message, updated_at: now() })
      .eq("id", post.id);
    return NextResponse.json({ error: e.message, filename: post.filename }, { status: 500 });
  }

  try {
    // --- 1. Instagram (vollautomatisch) ---
    const igPost = await nextDue("post_ig", "ig_status");
    if (igPost) {
      try {
        const token = await igToken(supabase);
        const videoUrl = await temporaryLink(igPost.dropbox_path);
        const mediaId = await publishReel(token, videoUrl, igPost.caption || "");
        await supabase
          .from("posts")
          .update({ ig_status: "published", ig_media_id: mediaId, last_error: null, updated_at: now() })
          .eq("id", igPost.id);
        await maybeArchive(igPost.id);
        return NextResponse.json({ done: "instagram", filename: igPost.filename });
      } catch (e) {
        return await fail(igPost, "ig_status", e);
      }
    }

    // --- 2. TikTok (Upload in die Drafts, Posten erfolgt in der App) ---
    const ttPost = await nextDue("post_tt", "tt_status");
    if (ttPost) {
      try {
        const token = await ttToken(supabase);
        const videoUrl = await temporaryLink(ttPost.dropbox_path);
        const size = await fileSize(ttPost.dropbox_path);
        const publishId = await uploadToInbox(token, videoUrl, ttPost.filename, size);
        await supabase
          .from("posts")
          .update({ tt_status: "drafted", tt_publish_id: publishId, last_error: null, updated_at: now() })
          .eq("id", ttPost.id);
        await maybeArchive(ttPost.id);
        return NextResponse.json({ done: "tiktok", filename: ttPost.filename });
      } catch (e) {
        return await fail(ttPost, "tt_status", e);
      }
    }

    // --- 3. YouTube Shorts ---
    const ytPost = await nextDue("post_yt", "yt_status");
    if (ytPost) {
      try {
        const token = await ytToken(supabase);
        const videoUrl = await temporaryLink(ytPost.dropbox_path);
        const size = await fileSize(ytPost.dropbox_path);
        const videoId = await uploadShort(token, videoUrl, ytPost.filename, ytPost.caption || "", size);
        await supabase
          .from("posts")
          .update({ yt_status: "published", yt_video_id: videoId, last_error: null, updated_at: now() })
          .eq("id", ytPost.id);
        await maybeArchive(ytPost.id);
        return NextResponse.json({ done: "youtube", filename: ytPost.filename });
      } catch (e) {
        return await fail(ytPost, "yt_status", e);
      }
    }

    // --- Nichts faellig: Tokens frisch halten ---
    try { await igToken(supabase); } catch { /* noch nicht konfiguriert */ }
    try { await ttToken(supabase); } catch { /* noch nicht verbunden */ }
    try { await ytToken(supabase); } catch { /* noch nicht verbunden */ }
    return NextResponse.json({ done: 0 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
