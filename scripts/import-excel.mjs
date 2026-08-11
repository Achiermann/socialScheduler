// Einmaliger Import des bestehenden Excel-Plans in die posts-Tabelle.
// Nutzung: node scripts/import-excel.mjs pfad/zur/planung.xlsx
// Erwartete Spalten (Gross-/Kleinschreibung egal): filename, date, caption
// -> Spaltennamen ggf. anpassen, sobald das echte Excel vorliegt.
import "dotenv/config";
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
if (!file) { console.error("Pfad zum Excel angeben."); process.exit(1); }

const wb = xlsx.readFile(file, { cellDates: true });
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const norm = (row, ...names) => {
  for (const key of Object.keys(row)) {
    if (names.includes(key.toLowerCase().trim())) return row[key];
  }
};

const posts = rows
  .map((r) => ({
    filename: norm(r, "filename", "file", "video", "dateiname"),
    scheduled_at: norm(r, "date", "datum", "upload", "upload_date") instanceof Date
      ? norm(r, "date", "datum", "upload", "upload_date").toISOString()
      : null,
    caption: String(norm(r, "caption", "text", "beschreibung") ?? ""),
  }))
  .filter((p) => p.filename);

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { db: { schema: "scheduler" } });
const { error } = await db.from("posts").upsert(posts, { onConflict: "filename" });
if (error) { console.error(error.message); process.exit(1); }
console.log(`${posts.length} Zeilen importiert.`);
