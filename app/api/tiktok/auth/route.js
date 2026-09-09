import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/tiktok";

// Startet den TikTok-OAuth-Flow (nur aus dem eingeloggten Dashboard erreichbar)
export async function GET() {
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.PUBLIC_APP_URL) {
    return NextResponse.json(
      { error: "TIKTOK_CLIENT_KEY / PUBLIC_APP_URL fehlen in den Env-Variablen" },
      { status: 500 }
    );
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("tt_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
  return res;
}
