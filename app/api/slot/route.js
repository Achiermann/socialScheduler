import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { setAnchor, applySlots, getPlanSettings } from "@/lib/plan";

// Eigenes Datum fuer einen Slot setzen ({ index, date: "YYYY-MM-DD" }) oder
// entfernen (date: null); die folgenden Slots rechnen ab dort weiter
export async function POST(req) {
  const { index, date } = await req.json();
  const supabase = db();
  try {
    await setAnchor(supabase, index, date || null);
    const updated = await applySlots(supabase);
    return NextResponse.json({ ok: true, updated, anchors: (await getPlanSettings(supabase)).anchors });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
