import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { recallPost, getPlanSettings } from "@/lib/plan";

// Vergangenen Post zurueck in die kommende Planung holen ({ id })
export async function POST(req) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  const supabase = db();
  try {
    await recallPost(supabase, id);
    return NextResponse.json({ ok: true, ...(await getPlanSettings(supabase)) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
