# Social Scheduler

Selbstgehostetes, kostenloses System zum Planen und automatischen Posten von
Kurzvideos auf Instagram (vollautomatisch), TikTok (Drafts) und YouTube Shorts
(nach Google-Audit). Videos liegen in Dropbox, Planung laeuft ueber ein
Web-Dashboard, Daten in Supabase, Hosting auf Vercel, Cron via GitHub Actions.

## Architektur

    GitHub Actions (alle 15 Min)
        -> POST /api/tick (Vercel)
            -> Supabase: faellige Posts holen
            -> Dropbox: temporaeren Videolink holen
            -> Instagram Graph API: Reel publishen
            -> Status zurueckschreiben

    Dashboard (/) : Posts planen, Captions pflegen, Status sehen, Dropbox-Sync

## Phase 1 - Grundsetup

1. **Supabase**: Neues Projekt anlegen -> SQL-Editor -> Inhalt von
   `supabase/schema.sql` ausfuehren. `SUPABASE_URL` und
   `SUPABASE_SERVICE_ROLE_KEY` aus Project Settings -> API kopieren.
2. **Lokal**: `.env.example` nach `.env.local` kopieren und ausfuellen
   (mindestens Supabase + `ACCESS_CODE` + `CRON_SECRET`).
   Dann `npm install` und `npm run dev`.
3. **Vercel**: Repo auf GitHub pushen, in Vercel importieren, alle
   Env-Variablen aus `.env.local` in den Vercel Project Settings hinterlegen.
4. **Excel-Import** (einmalig): `npm run import-excel -- pfad/zur/planung.xlsx`
   (Spaltennamen im Script ggf. ans echte Excel anpassen).

## Phase 2 - Dropbox

1. Auf https://www.dropbox.com/developers eine App erstellen
   (Scoped Access, "App folder" oder "Full Dropbox" je nach Ordnerlage).
2. Unter Permissions aktivieren: `files.metadata.read`, `files.content.read`.
3. Refresh-Token holen (einmalig):
   - Im Browser oeffnen (APP_KEY ersetzen):
     `https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline`
   - Den angezeigten Code in diesen Aufruf einsetzen:
     ```
     curl https://api.dropboxapi.com/oauth2/token \
       -d code=DER_CODE -d grant_type=authorization_code \
       -u APP_KEY:APP_SECRET
     ```
   - `refresh_token` aus der Antwort in die Env-Variablen uebernehmen.
4. `DROPBOX_FOLDER_PATH` auf den Videoordner setzen.
5. Im Dashboard "Dropbox-Sync" klicken: alle Videodateien werden als
   (noch unterminierte) Posts angelegt. Der Sync kann jederzeit wiederholt
   werden - neue Dateien werden ergaenzt, bestehende bleiben unberuehrt.

## Phase 3 - Instagram

1. Instagram-Account (Testaccount ok) auf Business/Creator umstellen.
2. Auf https://developers.facebook.com eine App erstellen
   (Use Case: Instagram / Content Publishing), den eigenen Account als
   Tester hinzufuegen. Development-Modus reicht - kein App-Review noetig,
   solange nur eigene Accounts bespielt werden.
3. Long-lived Access Token generieren -> `IG_ACCESS_TOKEN`,
   Instagram-User-ID -> `IG_USER_ID`.
4. Hinweis: Der Token laeuft nach 60 Tagen ab. Refresh-Automatik bauen wir
   in Phase 3 ein (ein API-Call, der den Token verlaengert).

## Phase 4 - Cron aktivieren

1. Im GitHub-Repo unter Settings -> Secrets zwei Secrets anlegen:
   - `TICK_URL` = `https://DEINE-APP.vercel.app/api/tick`
   - `CRON_SECRET` = gleicher Wert wie in Vercel
2. Der Workflow `.github/workflows/cron.yml` ruft den Worker alle 15 Min auf.
   Manueller Test: Actions-Tab -> "scheduler-tick" -> "Run workflow".

## Spaeter

- **TikTok**: Upload-to-Inbox (Video landet in den Drafts der App).
- **YouTube**: Data-API-Audit beantragen, danach vollautomatischer Upload.

## Limits (alle unkritisch bei 1 Post / 2 Tage)

- Instagram: max. 25 API-Posts pro 24h und Account, Reels max. 15 Min, MP4.
- Dropbox-Templinks: 4h gueltig (werden pro Post frisch geholt).
- GitHub Actions free: 2000 Min/Monat (ein Tick braucht Sekunden).
# socialScheduler
