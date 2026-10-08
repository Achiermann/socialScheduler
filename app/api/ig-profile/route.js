import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { currentToken, profile } from "@/lib/instagram";

// Account-Daten fuer die Instagram-Vorschau im Smartphone
export async function GET() {
  try {
    const token = await currentToken(db());
    return NextResponse.json(await profile(token), {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
