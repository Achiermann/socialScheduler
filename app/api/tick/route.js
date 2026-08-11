import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { temporaryLink } from "@/lib/dropbox";
import { publishReel } from "@/lib/instagram";

export const maxDuration = 300; // Vercel: bis 5 Min Laufzeit erlauben

// Wird alle 15 Min von GitHub Actions aufgerufen.
// Verarbeitet pro Lauf max. 1 faelligen Post (bei 1 Post alle 2 Tage voellig ausreichend).
export async function POST(req) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = db();
  const { data: due, error } = await supabase
    .from("posts")
    .select("*")
    .lte("scheduled_at", new Date().toISOString())
    .eq("ig_status", "pending")
    .eq("post_ig", true)
    .order("scheduled_at")
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ done: 0 });

  const post = due[0];
  try {
    if (!process.env.IG_ACCESS_TOKEN) {
      throw new Error("Instagram noch nicht konfiguriert (Phase 3)");
    }
    const videoUrl = await temporaryLink(post.dropbox_path);
    const mediaId = await publishReel(videoUrl, post.caption || "");
    await supabase
      .from("posts")
      .update({ ig_status: "published", ig_media_id: mediaId, last_error: null, updated_at: new Date().toISOString() })
      .eq("id", post.id);
    return NextResponse.json({ done: 1, filename: post.filename });
  } catch (e) {
    await supabase
      .from("posts")
      .update({ ig_status: "error", last_error: e.message, updated_at: new Date().toISOString() })
      .eq("id", post.id);
    return NextResponse.json({ error: e.message, filename: post.filename }, { status: 500 });
  }
}
