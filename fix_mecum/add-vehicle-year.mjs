import { readFileSync, writeFileSync, copyFileSync } from "node:fs";

const INPUT = "../fetchedData/extraFields/tulsa_2025_date_2025-10-20.json";          // pas aan
const OUTPUT = "./tulsa_2025_date_2025-10-20"; // pas aan
const CURRENT_YEAR = new Date().getFullYear();

function extractYear(title) {
  if (!title || typeof title !== "string") return null;

  // 1) Meest voorkomend bij Mecum: begint met "2000 Chevrolet ..."
  let m = title.match(/^\s*(\d{4})\b/);
  // 2) Anders: pak het eerste jaartal ergens in de titel
  if (!m) m = title.match(/\b(19|20)\d{2}\b/);

  const raw = m?.[1] ?? m?.[0];
  const year = raw ? Number(raw) : null;
  // sanity check (auto > 1885, niet verder dan volgend jaar)
  if (year && year >= 1886 && year <= CURRENT_YEAR + 1) return year;
  return null;
}

function maybeFixTypoLotMedia(obj) {
  // Je voorbeeld had "lot_medida": [...]  → zet dit om naar lot_media
  if (obj.lot_medida && !obj.lot_media) {
    obj.lot_media = obj.lot_medida;
    delete obj.lot_medida;
  }
}

const data = JSON.parse(readFileSync(INPUT, "utf8"));
// copyFileSync(INPUT, INPUT + ".bak"); // backup

let updated = 0, missing = 0;

for (const item of data) {
  maybeFixTypoLotMedia(item);
  const year = extractYear(item.lot_title);
  if (year) {
    item.vehicle_year = year; // zet of overschrijf
    updated++;
  } else {
    // laat staan als null/undefined, of zet expliciet null:
    if (item.vehicle_year === undefined) item.vehicle_year = null;
    missing++;
  }
}

writeFileSync(OUTPUT, JSON.stringify(data, null, 2), "utf8");
console.log(`Klaar. ${updated} items kregen een vehicle_year, ${missing} zonder match.`);
console.log(`Output: ${OUTPUT} (backup gemaakt als ${INPUT}.bak)`);
