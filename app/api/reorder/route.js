import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { applySlots, saveOrder } from "@/lib/plan";

// Speichert die per Drag & Drop erarbeitete Reihenfolge und verteilt die Slot-Daten neu
export async function POST(req) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ error: "ids fehlen" }, { status: 400 });
  }
  const supabase = db();
  try {
    await saveOrder(supabase, ids);
    await applySlots(supabase);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: ids.length });
}
