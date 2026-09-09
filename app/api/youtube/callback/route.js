import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { exchangeCode } from "@/lib/youtube";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) return NextResponse.redirect(new URL(`/?youtube=${encodeURIComponent(err)}`, url.origin));
  if (!code) return NextResponse.redirect(new URL("/?youtube=kein_code", url.origin));
  if (!state || state !== req.cookies.get("yt_state")?.value) {
    return NextResponse.redirect(new URL("/?youtube=state_ungueltig", url.origin));
  }

  try {
    await exchangeCode(db(), code);
    const res = NextResponse.redirect(new URL("/?youtube=verbunden", url.origin));
    res.cookies.delete("yt_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL(`/?youtube=${encodeURIComponent(e.message)}`, url.origin));
  }
}
