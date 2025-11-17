import { chromium, Page } from "playwright";
import fs from "fs-extra";
import path from "path";

// === CONFIG ===
const DATA_DIR = path.resolve("../fetchedData/extraFields");
const CONCURRENCY = 1;
const NAV_TIMEOUT = 60_000;
const WAIT_AFTER_LOAD = 600; // ms

// === HELPERS ===
async function extractSoldDate(page: Page): Promise<string | null> {
  const selectors = [
    "p[class*='LotHeader'] time[datetime]",
    "header time[datetime]",
    "main time[datetime]",
    "time[datetime]"
  ];

  for (const sel of selectors) {
    const el = await page.$(sel);
    if (!el) continue;
    const attr = await el.getAttribute("datetime");
    if (attr && /^\d{4}-\d{2}-\d{2}/.test(attr)) {
      return attr.split("T")[0]; // enkel YYYY-MM-DD
    }
  }
  return null;
}

async function fetchSoldDate(page: Page, url: string): Promise<string | null> {
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    if (!resp || resp.status() >= 400) {
      console.warn(`⚠️  ${url} → HTTP ${resp?.status()}`);
      return null;
    }
    await page.waitForTimeout(WAIT_AFTER_LOAD);
    return await extractSoldDate(page);
  } catch (err) {
    console.warn(`⚠️  Fout bij ${url}:`, (err as Error).message);
    return null;
  }
}

// === MAIN PROCESS ===
async function processFile(jsonPath: string, context: any): Promise<[number, number]> {
  let data: any[] = [];
  try {
    data = await fs.readJSON(jsonPath);
    if (!Array.isArray(data)) throw new Error("Root is geen array");
  } catch (err) {
    console.error(`❌ Kan ${path.basename(jsonPath)} niet lezen:`, (err as Error).message);
    return [0, 0];
  }

  const lots = data.filter(l => !l.lot_sold_date && l.lot_source_link);
  if (!lots.length) {
    console.log(`= ${path.basename(jsonPath)}: niets te updaten.`);
    return [0, data.length];
  }

  let updated = 0;
  const sem = new Array(CONCURRENCY).fill(null).map(() => context.newPage());

  async function runLot(lot: any) {
    const page = await context.newPage();
    const soldDate = await fetchSoldDate(page, lot.lot_source_link);
    await page.close();
    if (soldDate) {
      lot.lot_sold_date = soldDate;
      updated++;
    }
  }

  // verwerk in batches
  const tasks: Promise<void>[] = [];
  for (const lot of lots) {
    tasks.push(runLot(lot));
    if (tasks.length >= CONCURRENCY) {
      await Promise.all(tasks);
      tasks.length = 0;
    }
  }
  if (tasks.length) await Promise.all(tasks);

  // backup + schrijven
  if (updated > 0) {
    const backup = jsonPath + ".bak";
    if (!fs.existsSync(backup)) await fs.copy(jsonPath, backup);
    await fs.writeJSON(jsonPath, data, { spaces: 2 });
    console.log(`💾 ${path.basename(jsonPath)}: ${updated} lots geüpdatet.`);
  }

  return [updated, data.length];
}

async function main() {
  const files = (await fs.readdir(DATA_DIR))
    .filter((f: string) => f.endsWith(".json"))
    .map((f: string) => path.join(DATA_DIR, f));

  if (!files.length) {
    console.log("Geen JSON-bestanden gevonden.");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  let totalUpdated = 0;
  let totalLots = 0;
  for (const file of files) {
    const [u, t] = await processFile(file, context);
    totalUpdated += u;
    totalLots += t;
  }

  await context.close();
  await browser.close();

  console.log("\n======================");
  console.log(`Totaal geüpdatet lots : ${totalUpdated}`);
  console.log(`Totaal bekeken lots   : ${totalLots}`);
  console.log("======================");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
