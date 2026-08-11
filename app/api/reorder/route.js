import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Speichert die per Drag & Drop erarbeitete Reihenfolge
export async function POST(req) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ error: "ids fehlen" }, { status: 400 });
  }
  const supabase = db();
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from("posts")
      .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
      .eq("id", ids[i]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: ids.length });
}
