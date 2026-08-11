import { thumbnail } from "@/lib/dropbox";

export async function GET(req) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return new Response("missing path", { status: 400 });
  try {
    const buf = await thumbnail(path);
    return new Response(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400", // 1 Tag cachen
      },
    });
  } catch {
    return new Response("no thumbnail", { status: 404 });
  }
}
