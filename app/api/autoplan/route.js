import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Terminiert alle Posts ohne Datum: ab Startzeitpunkt, alle N Tage, sortiert nach Filename
export async function POST(req) {
  const { start, intervalDays } = await req.json();
  if (!start) return NextResponse.json({ error: "Startdatum fehlt" }, { status: 400 });
  const interval = Math.max(1, parseInt(intervalDays) || 2);

  const supabase = db();
  const { data: open, error } = await supabase
    .from("posts")
    .select("id")
    .is("scheduled_at", null)
    .order("filename");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const startMs = new Date(start).getTime();
  for (let i = 0; i < open.length; i++) {
    const when = new Date(startMs + i * interval * 24 * 60 * 60 * 1000).toISOString();
    const { error: e } = await supabase
      .from("posts")
      .update({ scheduled_at: when, updated_at: new Date().toISOString() })
      .eq("id", open[i].id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }
  return NextResponse.json({ planned: open.length });
}
