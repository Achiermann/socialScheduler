import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { setLocked } from "@/lib/plan";

// Post an seiner Position sperren/entsperren ({ id, locked })
export async function POST(req) {
  const { id, locked } = await req.json();
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  try {
    await setLocked(db(), id, !!locked);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
