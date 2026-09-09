// Dropbox via HTTP-API (kein SDK noetig).

async function accessToken() {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN,
      client_id: process.env.DROPBOX_APP_KEY,
      client_secret: process.env.DROPBOX_APP_SECRET,
    }),
  });
  if (!res.ok) throw new Error("Dropbox auth failed: " + (await res.text()));
  return (await res.json()).access_token;
}

async function rpc(token, endpoint, body) {
  const res = await fetch("https://api.dropboxapi.com/2/" + endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(endpoint + " failed: " + (await res.text()));
  return res.json();
}

// Nicht-ASCII-Zeichen fuer den Dropbox-API-Arg-Header escapen
const headerSafe = (o) =>
  JSON.stringify(o).replace(/[\u007f-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

export const ARCHIVE_FOLDER = "Uploaded";

const VIDEO_EXT = /\.(mp4|mov|m4v)$/i;

// Bei App-Folder-Scope sind alle Pfade relativ zum App-Ordner -> "" = Wurzel.
// Fehlende Variable, "/" oder ein Slash am Ende werden toleriert.
function folderPath() {
  const raw = (process.env.DROPBOX_FOLDER_PATH || "").trim().replace(/\/+$/, "");
  return raw === "/" ? "" : raw;
}

// Listet alle Videodateien im konfigurierten Ordner (inkl. Pagination)
export async function listVideos() {
  const token = await accessToken();
  const files = [];
  let data = await rpc(token, "files/list_folder", {
    path: folderPath(),
    recursive: false,
  });
  for (;;) {
    for (const e of data.entries) {
      if (e[".tag"] === "file" && VIDEO_EXT.test(e.name)) {
        files.push({ filename: e.name, dropbox_path: e.path_lower });
      }
    }
    if (!data.has_more) break;
    data = await rpc(token, "files/list_folder/continue", { cursor: data.cursor });
  }
  return files;
}

// Temporaerer Direktlink (4h gueltig)
export async function temporaryLink(path) {
  const token = await accessToken();
  const data = await rpc(token, "files/get_temporary_link", { path });
  return data.link;
}

// Dateigroesse in Bytes (zuverlaessiger als ein HEAD auf den Templink -
// Dropbox liefert dort kein content-length)
export async function fileSize(path) {
  const token = await accessToken();
  const data = await rpc(token, "files/get_metadata", { path });
  if (!data?.size) throw new Error("Dateigroesse nicht ermittelbar: " + path);
  return data.size;
}

// Videodauer in Sekunden aus den Dropbox-Medien-Metadaten (null wenn noch nicht verarbeitet)
export async function videoDuration(path) {
  const token = await accessToken();
  const data = await rpc(token, "files/get_metadata", { path, include_media_info: true });
  const meta = data?.media_info?.metadata;
  return meta?.duration ? Math.round(meta.duration / 1000) : null;
}

// JPEG-Thumbnail (funktioniert auch fuer Videos)
export async function thumbnail(path) {
  const token = await accessToken();
  const res = await fetch("https://content.dropboxapi.com/2/files/get_thumbnail_v2", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Dropbox-API-Arg": headerSafe({
        resource: { ".tag": "path", path },
        format: { ".tag": "jpeg" },
        size: { ".tag": "w256h256" },
      }),
    },
  });
  if (!res.ok) throw new Error("thumbnail failed: " + (await res.text()));
  return Buffer.from(await res.arrayBuffer());
}

// Verschiebt eine Datei in den Unterordner "Uploaded". Der Sync liest nur die
// Ordnerwurzel, archivierte Videos tauchen also nicht wieder auf.
// Benoetigt den Scope files.content.write.
export async function moveToUploaded(fromPath, filename) {
  const token = await accessToken();
  const target = `${folderPath()}/${ARCHIVE_FOLDER}/${filename}`;
  const data = await rpc(token, "files/move_v2", {
    from_path: fromPath,
    to_path: target,
    autorename: true,
  });
  return data?.metadata?.path_lower || target.toLowerCase();
}

