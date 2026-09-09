import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { exchangeCode } from "@/lib/tiktok";

// TikTok leitet nach der Freigabe hierher zurueck
export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) return NextResponse.redirect(new URL(`/?tiktok=${encodeURIComponent(err)}`, url.origin));
  if (!code) return NextResponse.redirect(new URL("/?tiktok=kein_code", url.origin));
  if (!state || state !== req.cookies.get("tt_state")?.value) {
    return NextResponse.redirect(new URL("/?tiktok=state_ungueltig", url.origin));
  }

  try {
    await exchangeCode(db(), code);
    const res = NextResponse.redirect(new URL("/?tiktok=verbunden", url.origin));
    res.cookies.delete("tt_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL(`/?tiktok=${encodeURIComponent(e.message)}`, url.origin));
  }
}
