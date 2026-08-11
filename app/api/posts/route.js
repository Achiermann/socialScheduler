import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await db()
    .from("posts")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("filename");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

const EDITABLE = ["scheduled_at", "caption", "synth_info", "drum_info", "post_ig", "post_tt", "post_yt", "ig_status", "tt_status", "yt_status"];

export async function PATCH(req) {
  const { id, ...fields } = await req.json();
  const update = {};
  for (const k of EDITABLE) if (k in fields) update[k] = fields[k];
  update.updated_at = new Date().toISOString();
  const { error } = await db().from("posts").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
