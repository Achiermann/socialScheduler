// TikTok Content Posting API - Upload in die Inbox/Drafts des Creators.
// Scope: video.upload (kein App-Audit noetig; der Post wird in der TikTok-App
// vom Creator final veroeffentlicht). Tokens liegen in scheduler.settings.

const OAUTH = "https://open.tiktokapis.com/v2/oauth/token/";
const INIT = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const SETTINGS_KEY = "tiktok_token";

export function authorizeUrl(state) {
  const p = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    scope: "video.upload",
    response_type: "code",
    redirect_uri: redirectUri(),
    state,
  });
  return "https://www.tiktok.com/v2/auth/authorize/?" + p.toString();
}

export function redirectUri() {
  return `${process.env.PUBLIC_APP_URL}/api/tiktok/callback`;
}

async function tokenRequest(params) {
  const res = await fetch(OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      ...params,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error("TikTok OAuth: " + (data.error_description || data.error || (await res.text())));
  }
  return data;
}

function store(supabase, d) {
  const value = JSON.stringify({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    // 60s Sicherheitsabstand
    expires_at: Date.now() + (d.expires_in || 86400) * 1000 - 60000,
  });
  return supabase.from("settings").upsert({
    key: SETTINGS_KEY, value, updated_at: new Date().toISOString(),
  });
}

// Tauscht den OAuth-Code gegen Tokens und speichert sie
export async function exchangeCode(supabase, code) {
  const d = await tokenRequest({
    code: decodeURIComponent(code),
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
  const { error } = await store(supabase, d);
  if (error) throw new Error(error.message);
  return d.open_id;
}

// Liefert einen gueltigen Access-Token; refresht automatisch (Token gilt 24h,
// Refresh-Token 365 Tage - bei jedem Refresh gibt es einen neuen).
export async function currentToken(supabase) {
  const { data } = await supabase
    .from("settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
  if (!data?.value) throw new Error("TikTok nicht verbunden - im Dashboard auf 'TikTok verbinden' klicken");

  const t = JSON.parse(data.value);
  if (Date.now() < t.expires_at) return t.access_token;

  const d = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  await store(supabase, d);
  return d.access_token;
}

function mimeFor(filename) {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  return "video/mp4";
}

const MB = 1024 * 1024;

// Laedt das Video in die TikTok-Inbox des Creators. Rueckgabe: publish_id.
// Der Creator bekommt eine Benachrichtigung und posted final in der App.
export async function uploadToInbox(token, videoUrl, filename) {
  // Groesse ermitteln (Dropbox-Templink unterstuetzt HEAD/Range)
  const head = await fetch(videoUrl, { method: "HEAD" });
  const size = Number(head.headers.get("content-length"));
  if (!size) throw new Error("Videogroesse nicht ermittelbar");

  // Chunk-Regeln: <=64MB am Stueck; sonst 50MB-Chunks, letzter nimmt den Rest
  const single = size <= 64 * MB;
  const chunkSize = single ? size : 50 * MB;
  const chunkCount = single ? 1 : Math.floor(size / chunkSize);

  const initRes = await fetch(INIT, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: chunkSize,
        total_chunk_count: chunkCount,
      },
    }),
  });
  const init = await initRes.json();
  if (init?.error?.code && init.error.code !== "ok") {
    throw new Error("TikTok init: " + init.error.code + " " + (init.error.message || ""));
  }
  const { publish_id, upload_url } = init.data || {};
  if (!upload_url) throw new Error("TikTok: keine upload_url erhalten");

  const mime = mimeFor(filename);
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = i === chunkCount - 1 ? size - 1 : start + chunkSize - 1;

    // Nur den benoetigten Bereich von Dropbox holen (haelt den Speicher flach)
    const part = await fetch(videoUrl, {
      headers: single ? {} : { Range: `bytes=${start}-${end}` },
    });
    if (!part.ok) throw new Error("Dropbox-Download fehlgeschlagen: " + part.status);
    const buf = Buffer.from(await part.arrayBuffer());

    const put = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
      body: buf,
    });
    // 206 = Chunk ok, 201 = fertig
    if (put.status !== 206 && put.status !== 201) {
      throw new Error(`TikTok-Upload fehlgeschlagen (HTTP ${put.status}): ${await put.text()}`);
    }
  }
  return publish_id;
}
