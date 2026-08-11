import { temporaryLink } from "@/lib/dropbox";

// Mini-Player-Seite: <video> spielt den Dropbox-Templink inline ab
// (direkter Redirect wuerde wegen Dropbox' Download-Headern zum File-Download fuehren)
export async function GET(req) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return new Response("missing path", { status: 400 });
  try {
    const link = await temporaryLink(path);
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Preview</title><style>
  body { margin:0; background:#000; display:grid; place-items:center; height:100vh; }
  video { max-width:100vw; max-height:100vh; }
</style></head>
<body><video src="${link.replace(/"/g, "&quot;")}" controls autoplay playsinline></video></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (e) {
    return new Response("Fehler: " + e.message, { status: 500 });
  }
}
