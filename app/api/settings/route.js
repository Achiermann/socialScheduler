import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getPlanSettings, savePlanSettings, applySlots } from "@/lib/plan";

export async function GET() {
  try {
    return NextResponse.json(await getPlanSettings(db()));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Speichert Uhrzeit/Abstand und rechnet alle Slot-Daten neu
export async function POST(req) {
  const { time, intervalDays } = await req.json();
  const supabase = db();
  try {
    await savePlanSettings(supabase, { time, intervalDays });
    const updated = await applySlots(supabase);
    return NextResponse.json({ ...(await getPlanSettings(supabase)), updated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
