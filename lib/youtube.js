// YouTube Data API v3 - Upload von Shorts.
// OAuth-Tokens liegen in scheduler.settings. Wichtig: Der OAuth-Consent-Screen
// muss in Google Cloud auf "In production" stehen, sonst laufen die
// Refresh-Tokens nach 7 Tagen ab (Testing-Modus).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const SETTINGS_KEY = "youtube_token";
const SCOPE = "https://www.googleapis.com/auth/youtube.upload";

export function redirectUri() {
  return `${process.env.PUBLIC_APP_URL}/api/youtube/callback`;
}

export function authorizeUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",   // liefert den Refresh-Token
    prompt: "consent",        // erzwingt ihn auch bei erneuter Freigabe
    include_granted_scopes: "true",
    state,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      ...params,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error("YouTube OAuth: " + (data.error_description || data.error || "unbekannt"));
  }
  return data;
}

async function store(supabase, d, keepRefresh) {
  const value = JSON.stringify({
    access_token: d.access_token,
    // Beim Refresh liefert Google keinen neuen Refresh-Token mit
    refresh_token: d.refresh_token || keepRefresh,
    expires_at: Date.now() + (d.expires_in || 3600) * 1000 - 60000,
  });
  const { error } = await supabase.from("settings").upsert({
    key: SETTINGS_KEY, value, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function exchangeCode(supabase, code) {
  const d = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
  if (!d.refresh_token) {
    throw new Error("Google hat keinen Refresh-Token geliefert - Zugriff unter myaccount.google.com/permissions entfernen und erneut verbinden");
  }
  await store(supabase, d);
}

export async function currentToken(supabase) {
  const { data } = await supabase
    .from("settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
  if (!data?.value) throw new Error("YouTube nicht verbunden - im Dashboard auf 'YouTube verbinden' klicken");

  const t = JSON.parse(data.value);
  if (Date.now() < t.expires_at) return t.access_token;

  const d = await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  await store(supabase, d, t.refresh_token);
  return d.access_token;
}

function mimeFor(filename) {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  return "video/mp4";
}

// YouTube-Titel: max. 100 Zeichen, keine Zeilenumbrueche
function titleFrom(caption, filename) {
  const firstLine = (caption || "").split("\n")[0].trim();
  const base = firstLine || filename.replace(/\.[^.]+$/, "");
  return (base.length > 80 ? base.slice(0, 77) + "…" : base) + " #Shorts";
}

// Laedt das Video als Short hoch. Rueckgabe: Video-ID.
export async function uploadShort(token, videoUrl, filename, caption, size) {
  const mime = mimeFor(filename);

  // 1. Resumable-Session eroeffnen
  const init = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size),
      "X-Upload-Content-Type": mime,
    },
    body: JSON.stringify({
      snippet: {
        title: titleFrom(caption, filename),
        description: caption || "",
        categoryId: "10", // Music
      },
      status: {
        privacyStatus: process.env.YT_PRIVACY || "public",
        selfDeclaredMadeForKids: false,
      },
    }),
  });
  if (!init.ok) throw new Error("YouTube init: " + (await init.text()));
  const session = init.headers.get("location");
  if (!session) throw new Error("YouTube: keine Upload-Session erhalten");

  // 2. Datei von Dropbox holen und in einem Rutsch hochladen
  const file = await fetch(videoUrl);
  if (!file.ok) throw new Error("Dropbox-Download fehlgeschlagen: " + file.status);
  const buf = Buffer.from(await file.arrayBuffer());

  const put = await fetch(session, {
    method: "PUT",
    headers: { "Content-Type": mime, "Content-Length": String(buf.length) },
    body: buf,
  });
  const result = await put.json().catch(() => ({}));
  if (!put.ok) throw new Error("YouTube-Upload fehlgeschlagen: " + JSON.stringify(result));
  return result.id;
}
