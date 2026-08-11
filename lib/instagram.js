// Instagram Reels-Publishing ueber die Graph API (Container-Modell).
// Funktioniert im Development-Modus der Meta-App fuer eigene Accounts (Phase 3).

const API = "https://graph.instagram.com/v23.0";

async function ig(path, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", process.env.IG_ACCESS_TOKEN);
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error("IG: " + JSON.stringify(data.error || data));
  return data;
}

export async function publishReel(videoUrl, caption) {
  const userId = process.env.IG_USER_ID;

  // 1. Container erstellen (Instagram laedt das Video selbst von der URL)
  const container = await ig(`/${userId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
  });

  // 2. Warten bis das Video verarbeitet ist
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await fetch(
      `${API}/${container.id}?fields=status_code&access_token=${process.env.IG_ACCESS_TOKEN}`
    ).then((r) => r.json());
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") throw new Error("IG container error");
  }

  // 3. Publishen
  const result = await ig(`/${userId}/media_publish`, { creation_id: container.id });
  return result.id; // Media-ID des veroeffentlichten Reels
}
