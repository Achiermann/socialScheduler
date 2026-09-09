import { NextResponse } from "next/server";
import { authorizeUrl } from "@/lib/youtube";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.PUBLIC_APP_URL) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID / PUBLIC_APP_URL fehlen in den Env-Variablen" },
      { status: 500 }
    );
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("yt_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
  });
  return res;
}
