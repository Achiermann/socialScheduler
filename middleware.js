import { NextResponse } from "next/server";

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  // Login-Seite, Login-API und Cron-Worker sind ausgenommen (Worker prueft eigenes Secret)
  // Oeffentlich: Login, Cron-Worker (prueft eigenes Secret) und die von den
  // Plattform-Reviews geforderten Rechtstexte
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/tick") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy")
  ) {
    return NextResponse.next();
  }
  const cookie = req.cookies.get("auth")?.value;
  const expected = await sha256(process.env.ACCESS_CODE || "");
  if (cookie === expected) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
