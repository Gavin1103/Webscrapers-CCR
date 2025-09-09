// import { GoogleGenAI } from "@google/genai";

// const ai = new GoogleGenAI({apiKey: API_KEY});

// async function main() {
//     console.log()

//   const response = await ai.models.generateContent({
//     model: "gemini-1.5-flash",
//     contents: "Als ik om een array vraag, hoe kan ik die dan gebruiken en loggen in de console?",
//     config: {
//       thinkingConfig: {
//         thinkingBudget: 0, // Disables thinking
//       },
//     }
//   });
//   console.log(response.text);
// }

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
  vehicle_convertible?: boolean;
  vehicle_registery_code?: string | null;
  vehicle_mileage_value?: number | null;
  vehicle_mileage_unit?: string | null;
  vehicle_mileage_unit_unknown?: boolean;
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

// const URL = "https://www.brightwells.com/timed-sale/5135?pageSize=All";
const URL = "https://www.brightwells.com/timed-sale/5135?pageSize=20";

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

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    );
    await page.goto(URL, { waitUntil: "networkidle0", timeout: 120_000 });

    await page.waitForSelector(LOT_SOURCE_LINK, { timeout: 60_000 });

    // Unieke lot links
    const lotLinks = await page.$$eval(LOT_SOURCE_LINK, (as) => {
      const set = new Set<string>();
      as.forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (href) set.add(href);
      });
      return Array.from(set);
    });

    // Basisvelden vanaf listing
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
            // "No Reserve" verwijderen (met/zonder haakjes, case-insensitive)
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
            price_value: price_raw ? null : null, // parsed zo
            price_currency: null,
          } as LotResult;
        });
      },
      { LOT_CODE, LOT_TITLE, PRICE_VALUE }
    );

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

    // ---- Detail-scrape per lot (serieel; zet evt. op concurrency) ----
    const detailPage = await browser.newPage();
    await detailPage.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    );

    for (let i = 0; i < listing.length; i++) {
      const row = listing[i];
      try {
        await detailPage.goto(row.lot_source_link, { waitUntil: "networkidle0", timeout: 120_000 });

        // Beschrijving oppakken: alle <p> onder LOT_DESCRIPTION-container, samengevoegd met lege regels
        let lot_description: string | null = null;
        try {
          await detailPage.waitForSelector(LOT_DESCRIPTION, { timeout: 10_000 });
          const paragraphs = await detailPage.$$eval(LOT_DESCRIPTION, (ps) =>
            ps
              .map((p) => (p.textContent || "").replace(/\s+/g, " ").trim())
              .filter(Boolean)
          );
          lot_description = paragraphs.length ? paragraphs.join("\n\n") : null;
        } catch {
          // geen beschrijving gevonden is oké
          lot_description = null;
        }

        // Foto’s: open de gallery (als knop bestaat), pak alle img src
        let lot_medida: string[] = [];
        try {
          const hasButton = await detailPage.$(SEE_ALL_IMAGES_BUTTON);
          if (hasButton) {
            await Promise.all([
              detailPage.click(SEE_ALL_IMAGES_BUTTON),
              // wacht even op modal images
              detailPage.waitForSelector(IMAGE, { timeout: 15_000 }),
            ]);
          } else {
            // soms staan er al thumbnails/afbeeldingen buiten modal; we proberen direct IMAGE ook
            await detailPage.waitForSelector(IMAGE, { timeout: 5_000 }).catch(() => {});
          }

          lot_medida = await detailPage.$$eval(IMAGE, (imgs) =>
            Array.from(new Set(
              imgs
                .map((img) => {
                  const el = img as HTMLImageElement;
                  // probeer srcset fallback
                  const direct = el.getAttribute("src") || "";
                  if (direct) return direct;
                  const srcset = el.getAttribute("srcset") || "";
                  // kies de hoogste resolutie uit srcset (laatste)
                  if (srcset) {
                    const parts = srcset.split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean);
                    return parts[parts.length - 1] || "";
                  }
                  return "";
                })
                .filter((s) => !!s)
            ))
          );
        } catch {
          lot_medida = [];
        }



        listing[i] = { ...row, lot_description, lot_medida };
      } catch (e: any) {
        listing[i] = { ...row, error: `detail_error: ${e?.message || String(e)}` };
      }
    }

    console.log(JSON.stringify(listing, null, 2));
  } catch (err: any) {
    console.error("Scrape error:", err?.message || err);
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

run();
