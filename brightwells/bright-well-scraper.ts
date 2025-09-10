import { GoogleGenAI } from "@google/genai";
import { writeFile } from "fs/promises";

const ai = new GoogleGenAI({ apiKey: "AIzaSyASaKydIb38HmmUXp6yoX03ojSDKclioBE" });

const date = new Date().toISOString().split("T")[0]; // bv. 2025-09-10
const fileName = `bright-wells-${date}.json`;

async function AI(description: string) {

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents:

      `
   The text: ${description}

    Act like you are the best car inspecter in the world. Fetch the following information in the text and return it in json using the following keys. If it not found in the text set it to null:
  vehicle_chassis_no: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_transmission_type?: string | null;
  vehicle_steering_position?: string | null;
  vehicle_body_color?: string | null;
  vehicle_interior_color?: string | null;
  vehicle_convertible?: boolean;
  vehicle_registery_code?: string | null;
  vehicle_mileage_value?: number | null;
  vehicle_mileage_unit?: string | null;
  vehicle_mileage_unit_unknown?: boolean;
    `,
    config: {
      thinkingConfig: {
        thinkingBudget: 0, // Disables thinking
      },
    }
  });
  return response
}

function extractJson(raw: string) {
  const s = raw.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
  return JSON.parse(s);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


// main();

// brightwells-scraper.ts
import puppeteer from "puppeteer";

interface LotResult {
  lot_source_link: string;
  lot_code: string | null;
  vehicle_chassis_no: string | null;
  lot_title?: string | null;
  lot_description?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_transmission_type?: string | null;
  vehicle_steering_position?: string | null;
  vehicle_body_color?: string | null;
  vehicle_interior_color?: string | null;
  vehicle_convertible?: boolean | null;
  vehicle_registery_code?: string | null;
  vehicle_mileage_value?: number | null;
  vehicle_mileage_unit?: string | null;
  vehicle_mileage_unit_unknown?: boolean | null;
  vehicle_engine?: string | null;
  price_type?: string | null;
  price_value?: number | null;
  price_currency?: string | null;
  price_guide_low?: number | null;
  price_guide_high?: number | null;
  auction_label?: string | null;
  lot_medida?: string[]; // gebruiken voor image src URLs
  error?: string;
}

const URL = "https://www.brightwells.com/timed-sale/5135?pageSize=All";

// listing selectors
const LOT_SOURCE_LINK = "li.js-lot a";
const LOT_CODE = "div.ui-listings__intro h2";
const LOT_TITLE = "p.ui-listings__lot-description strong";
const PRICE_VALUE = "p.cl-lot-hammer";

// detail selectors
const LOT_DESCRIPTION = "div.column--twelve p";
const SEE_ALL_IMAGES_BUTTON = "button.btn--lot-gallery";
const IMAGE = "div.gallery__fullscreen-modal-inner div.gallery__modal-gallery img";

// helpers
function cleanText(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

function parseCurrencyAndValue(raw: string | null): { currency: string | null; value: number | null } {
  if (!raw) return { currency: null, value: null };
  const text = raw.replace(/\s+/g, " ").trim();

  let currency: string | null = null;
  if (/[£]/.test(text)) currency = "GBP";
  else if (/[€]/.test(text)) currency = "EUR";
  else if (/\bUSD\b|\$/.test(text)) currency = "USD";

  const numMatch = text.replace(/[, ]/g, "").match(/(\d+(\.\d+)?)/);
  const value = numMatch ? Number(numMatch[1]) : null;

  return { currency, value: isFinite(value as number) ? value : null };
}
function log(message: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${message}`);
}

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    log("🌐 Opening Brightwells...");
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    );
    await page.goto(URL, { waitUntil: "networkidle0", timeout: 120_000 });

    await page.waitForSelector(LOT_SOURCE_LINK, { timeout: 60_000 });
    log("✅ Lot listing page loaded");

    // Unieke lot links
    const lotLinks = await page.$$eval(LOT_SOURCE_LINK, (as) => {
      const set = new Set<string>();
      as.forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (href) set.add(href);
      });
      return Array.from(set);
    });
    log(`📋 Found ${lotLinks.length} lot links`);

    // Basisvelden ophalen
    const results: LotResult[] = await page.evaluate(
      (selectors) => {
        const { LOT_CODE, LOT_TITLE, PRICE_VALUE } = selectors;
        const items = Array.from(document.querySelectorAll("li.js-lot"));
        return items.map((li) => {
          const a = li.querySelector<HTMLAnchorElement>("a");
          const lot_source_link = a?.href ?? "";

          const lot_code = (() => {
            const el = li.querySelector(LOT_CODE);
            return el ? el.textContent?.trim() ?? null : null;
          })();

          const lot_title = (() => {
            const el = li.querySelector(LOT_TITLE);
            if (!el) return null;
            let text = el.textContent?.trim() ?? null;
            if (!text) return null;
            text = text.replace(/\(?(no\s*reserve)\)?/gi, "").trim();
            return text.replace(/\s{2,}/g, " ") || null;
          })();

          const price_raw = (() => {
            const el = li.querySelector(PRICE_VALUE);
            return el ? el.textContent?.trim() ?? null : null;
          })();

          return {
            lot_source_link,
            lot_code,
            vehicle_chassis_no: null,
            lot_title,
            price_value: price_raw ? null : null,
            price_currency: null,
          } as LotResult;
        });
      },
      { LOT_CODE, LOT_TITLE, PRICE_VALUE }
    );
    log(`✅ Parsed ${results.length} results from listing page`);

    // prijs/currency normaliseren
    const rawPrices = await page.$$eval("li.js-lot", (lis, sel) => {
      return lis.map((li) => {
        const el = li.querySelector(sel as string);
        return el ? el.textContent || null : null;
      });
    }, PRICE_VALUE);

    const listing = results.map((r, i) => {
      const { currency, value } = parseCurrencyAndValue(rawPrices[i]);
      return { ...r, price_value: value, price_currency: currency } as LotResult;
    });

    // ---- Detail-scrape per lot ----
    const detailPage = await browser.newPage();
    await detailPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    );

    for (let i = 0; i < listing.length; i++) {
      const row = listing[i];
      const startTime = Date.now();
      log(`➡️  [${i + 1}/${listing.length}] Scraping lot ${row.lot_code || "?"}`);

      try {
        await detailPage.goto(row.lot_source_link, { waitUntil: "networkidle0", timeout: 120_000 });

        // Beschrijving
        let lot_description: string | null = null;
        try {
          await detailPage.waitForSelector(LOT_DESCRIPTION, { timeout: 10_000 });
          const paragraphs = await detailPage.$$eval(LOT_DESCRIPTION, (ps) =>
            ps.map((p) => (p.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean)
          );
          lot_description = paragraphs.length ? paragraphs.join("\n\n") : null;
        } catch {}
        if (lot_description) log(`📝 Lot ${row.lot_code} description length: ${lot_description.length}`);

        // Default vehicle waarden
        let vehicle_chassis_no: string | null = null;
        let vehicle_make: string | null = null;
        let vehicle_model: string | null = null;
        let vehicle_transmission_type: string | null = null;
        let vehicle_steering_position: string | null = null;
        let vehicle_body_color: string | null = null;
        let vehicle_interior_color: string | null = null;
        let vehicle_convertible: boolean | null = null;
        let vehicle_registery_code: string | null = null;
        let vehicle_mileage_value: number | null = null;
        let vehicle_mileage_unit: string | null = null;
        let vehicle_mileage_unit_unknown: boolean | null = null;

        if (lot_description) {
          try {
            const response: any = await AI(lot_description);
            const json = extractJson(response.text);

            vehicle_chassis_no = json.vehicle_chassis_no;
            vehicle_make = json.vehicle_make;
            vehicle_model = json.vehicle_model;
            vehicle_transmission_type = json.vehicle_transmission_type;
            vehicle_steering_position = json.vehicle_steering_position;
            vehicle_body_color = json.vehicle_body_color;
            vehicle_interior_color = json.vehicle_interior_color;
            vehicle_convertible = json.vehicle_convertible;
            vehicle_registery_code = json.vehicle_registery_code;
            vehicle_mileage_value = json.vehicle_mileage_value;
            vehicle_mileage_unit = json.vehicle_mileage_unit;
            vehicle_mileage_unit_unknown = json.vehicle_mileage_unit_unknown;

            log(`🤖 AI parsed vehicle info for lot ${row.lot_code}`);
          } catch (err) {
            log(`❌ AI parsing failed for lot ${row.lot_code}: ${err}`);
          }
        }

        // Foto’s
        let lot_medida: string[] = [];
        try {
          const hasButton = await detailPage.$(SEE_ALL_IMAGES_BUTTON);
          if (hasButton) {
            await Promise.all([
              detailPage.click(SEE_ALL_IMAGES_BUTTON),
              detailPage.waitForSelector(IMAGE, { timeout: 15_000 }),
            ]);
          } else {
            await detailPage.waitForSelector(IMAGE, { timeout: 5_000 }).catch(() => {});
          }

          lot_medida = await detailPage.$$eval(IMAGE, (imgs) =>
            Array.from(new Set(
              imgs.map((img) => {
                const el = img as HTMLImageElement;
                const direct = el.getAttribute("src") || "";
                if (direct) return direct;
                const srcset = el.getAttribute("srcset") || "";
                if (srcset) {
                  const parts = srcset.split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean);
                  return parts[parts.length - 1] || "";
                }
                return "";
              }).filter((s) => !!s)
            ))
          );
          log(`🖼️  Lot ${row.lot_code} found ${lot_medida.length} images`);
        } catch {
          lot_medida = [];
        }

        listing[i] = {
          ...row,
          lot_description,
          vehicle_chassis_no,
          vehicle_make,
          vehicle_model,
          vehicle_transmission_type,
          vehicle_steering_position,
          vehicle_body_color,
          vehicle_interior_color,
          vehicle_convertible,
          vehicle_registery_code,
          vehicle_mileage_value,
          vehicle_mileage_unit,
          vehicle_mileage_unit_unknown,
          lot_medida,
        };

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        log(`✅ Finished lot ${row.lot_code} in ${duration}s`);

        await sleep(30_000); // throttle
      } catch (e: any) {
        listing[i] = { ...row, error: `detail_error: ${e?.message || String(e)}` };
        log(`❌ Failed lot ${row.lot_code}: ${e?.message || e}`);
      }
    }

    const outputPath = `../fetchedData/brightwells/${fileName}`;
    await writeFile(outputPath, JSON.stringify(listing, null, 2), "utf-8");
    log(`💾 Data opgeslagen in ${outputPath}`);

  } catch (err: any) {
    log(`Scrape error: ${err?.message || err}`);
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    log("🔒 Browser closed");
  }
}

run();
