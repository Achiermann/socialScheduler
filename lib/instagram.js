// Instagram Reels-Publishing ueber die Graph API (Container-Modell).
// Der Long-lived-Token (60 Tage) wird in scheduler.settings gehalten und
// automatisch verlaengert, sobald er aelter als 7 Tage ist.

const API = "https://graph.instagram.com/v23.0";

// Liefert den aktuellen Token; refresht ihn bei Bedarf selbststaendig.
// Erstbestueckung kommt aus der Env-Variable IG_ACCESS_TOKEN.
export async function currentToken(supabase) {
  const { data } = await supabase
    .from("settings")
    .select("value, updated_at")
    .eq("key", "ig_access_token")
    .maybeSingle();

  let token = data?.value;
  if (!token) {
    token = process.env.IG_ACCESS_TOKEN;
    if (!token) throw new Error("Instagram noch nicht konfiguriert (IG_ACCESS_TOKEN fehlt)");
    await supabase.from("settings").upsert({
      key: "ig_access_token", value: token, updated_at: new Date().toISOString(),
    });
    return token;
  }

  const ageDays = (Date.now() - new Date(data.updated_at).getTime()) / 86400000;
  if (ageDays > 7) {
    try {
      const res = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
      );
      const d = await res.json();
      if (d.access_token) {
        token = d.access_token;
        await supabase.from("settings").upsert({
          key: "ig_access_token", value: token, updated_at: new Date().toISOString(),
        });
      }
    } catch { /* Refresh fehlgeschlagen -> alten Token weiterverwenden, naechster Tick probiert erneut */ }
  }
  return token;
}

async function ig(token, path, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error("IG: " + JSON.stringify(data.error || data));
  return data;
}

export async function publishReel(token, videoUrl, caption) {
  const userId = process.env.IG_USER_ID;

  // 1. Container erstellen (Instagram laedt das Video selbst von der URL)
  const container = await ig(token, `/${userId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
  });

  // 2. Warten bis das Video verarbeitet ist
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const status = await fetch(
      `${API}/${container.id}?fields=status_code&access_token=${encodeURIComponent(token)}`
    ).then((r) => r.json());
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") throw new Error("IG container error");
  }

  // 3. Publishen
  const result = await ig(token, `/${userId}/media_publish`, { creation_id: container.id });
  return result.id;
}
