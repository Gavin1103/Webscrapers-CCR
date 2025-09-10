// Scraper for the website Mecum. Fetches: everything

import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import puppeteer, { ElementHandle, Frame, Page, Target, type Browser } from 'puppeteer';
import * as readline from "readline";


//
// ====== Instellingen ======
//

const BASE_URLS = [
  // 'https://www.mecum.com/auctions/kissimmee-2023/lots/?auction[0]=Kissimmee+2023|1672790400|1673740800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  // 'https://www.mecum.com/auctions/tulsa-2021/lots/?auction[0]=Tulsa+2021|1623369600|1623456000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  // 'https://www.mecum.com/auctions/glendale-2023/lots/?auction[0]=Glendale+2023|1679961600|1680307200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  // 'https://www.mecum.com/auctions/las-vegas-2022/lots/?auction[0]=Las+Vegas+2022|1668038400|1668211200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/kissimmee-2023/lots/?auction[0]=Kissimmee+2023|1672790400|1673740800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&year=1968:1968&make[0]=Volkswagen'
];

//
// ====== Types ======
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
  lot_medida?: string[]

  error?: string;
}

const CONCURRENCY = Number(process.env.CONCURRENCY || 3); // 🔧 pas aan naar wens (2-5 is safe)
const MAX_PAGES = 200;

// Waar de bestanden worden opgeslagen
const OUTPUT_DIR = path.join(__dirname, 'fetchedData', 'kissimee_2023');
const LOG_FILE = path.join(__dirname, 'fetchedData', 'kissimee_2023', 'scrape-log.txt');

// Selectors
const LINK_SELECTOR = 'a[class^="CardLot_title__"]'; // of: 'a[href*="/lots/"]'
const DETAIL_CONTAINER = 'div.LotHeader_odometerSerial__4U5fu';
const LOT_NUMBER_SELECTOR = 'span.LotHeader_num__xqgKs';

const LOT_TITLE = 'h1.LotHeader_title__UCXNK'
const LOT_DESCRIPTION = "ul.List_list__xS3rG.List_ul__hcY__ li";

const PRICE_CONTAINER = 'div.PriceBadge_priceBadge__1Xlj8, div[class*="PriceBadge_"][class*="priceBadge"]';
const PRICE_VALUE = 'div.PriceBadge_priceBadge__1Xlj8';
const PRICE_SELECTORS = [
  'div.PriceBadge_priceBadge__1Xlj8',
  'div.LotHeader_priceBadge__UkPub',
  'div[class*="PriceBadge_"][class*="priceBadge"]',
  'div[class*="LotHeader_"][class*="priceBadge"]',
  'div[class*="priceBadge"]'
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const SOLD_BADGE = 'img.soldBadge'

const VEHICLE_IMAGES = 'div.ImageGallery_gridGallery__nUm41.grid-gallery button span img';
const VIEW_ALL_IMAGES_BUTTON = 'button.ImageGallery_viewAllButton___7Lil'
const VIEW_ALL_IMAGES_OVERLAY = 'div.ImageGallery_gridOverlay__WKz6u div'
const VEHICLE_IMAGES_IN_OVERLAY = 'div.ImageGallery_gridOverlay__WKz6u div button span img'


// Timing / throttling
const LIST_PAGE_DELAY_MS = { min: 200, max: 500 };
const DETAIL_PAGE_DELAY_MS = { min: 250, max: 650 };


// ====== Helpers ======
/**
 * Haal de waarde op uit een kolom met een label/heading.
 * Voorbeeld HTML:
 * <div class="wp-block-column">
 *   <p>Make</p>
 *   <p><strong>Chevrolet</strong></p>
 * </div>
 */
async function getSpecValue(page: Page, label: string): Promise<string | null> {
  return page.$$eval("div.wp-block-column", (columns, labelText) => {
    for (const col of columns) {
      const ps = col.querySelectorAll("p");
      if (ps.length >= 2) {
        const key = ps[0].textContent?.trim().toLowerCase();
        if (key === labelText.toLowerCase()) {
          return ps[1].textContent?.trim() || null;
        }
      }
    }
    return null;
  }, label);
}


function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
// function sleep(ms: number) {
//   return new Promise((r) => setTimeout(r, ms));
// }

function getAuctionSlugFromUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const m = u.pathname.match(/\/auctions\/([^\/?#]+)(?:[\/?#]|$)/);
    return m ? m[1] : 'results';
  } catch {
    return 'results';
  }
}

function getTodayDateString(): string {
  // ISO YYYY-MM-DD
  return new Date().toISOString().split('T')[0];
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function logMessage(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  ensureDir(path.dirname(LOG_FILE));
  fs.appendFileSync(LOG_FILE, line, 'utf-8');
  console.log(msg);
}

function outputPathForBase(baseUrl: string): string {
  const slug = getAuctionSlugFromUrl(baseUrl);
  const date = getTodayDateString();
  const filename = `${slug}_date_${date}.json`;
  return path.join(OUTPUT_DIR, filename);
}

// ====== Scrape-functies ======
async function collectLotLinks(page: Page, baseUrl: string): Promise<string[]> {
  const all = new Set<string>();

  async function scrapeOne(pageUrl: string): Promise<string[]> {
    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 120_000 });
    const hasLinks = await page.$(LINK_SELECTOR);
    if (!hasLinks) return [];

    const urls = await page.$$eval(LINK_SELECTOR, (els: HTMLAnchorElement[]) =>
      (els as HTMLAnchorElement[])
        .map((el) => el.href || el.getAttribute('href'))
        .filter((x): x is string => Boolean(x))
    );

    return urls; // urls is string[]
  }

  for (let p = 1; p <= MAX_PAGES; p++) {
    const pageUrl = `${baseUrl}${p}`;
    const urls = await scrapeOne(pageUrl);
    if (urls.length === 0) break;
    urls.forEach((u) => all.add(u));
    await sleep(rand(LIST_PAGE_DELAY_MS.min, LIST_PAGE_DELAY_MS.max));
  }

  // ✅ return toegevoegd
  return Array.from(all);
}

// Extra helpers bovenaan toevoegen:
function mapCurrency(sym: string): string {
  const m: Record<string, string> = {
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "CHF": "CHF", "CAD": "CAD", "AUD": "AUD"
  };
  return m[sym] ?? sym;
}

// Lees zichtbare tekst + ::before/::after content (ook in children) en parse naar {value, currency, raw}
async function extractPrice(page: Page): Promise<{ value: number | null; currency: string | null; raw: string | null }> {
  // 1) Probeer op bekende containers
  for (const sel of PRICE_SELECTORS) {
    const raw = await page.evaluate((selector) => {
      const root = document.querySelector(selector);
      if (!root) return null;

      const unq = (s: string | null) => {
        if (!s || s === 'none' || s === 'normal') return '';
        return s.replace(/^['"]|['"]$/g, '');
      };

      const parts: string[] = [];
      const pushNode = (node: Element) => {
        const cs = getComputedStyle(node);
        const b = unq(cs.getPropertyValue('content'));              // zelden op hoofdnode
        if (b) parts.push(b);
        const t = (node.textContent || '').trim();
        if (t) parts.push(t);
        const ab = unq(getComputedStyle(node, '::before').getPropertyValue('content'));
        const aa = unq(getComputedStyle(node, '::after').getPropertyValue('content'));
        if (ab) parts.push(ab);
        if (aa) parts.push(aa);
      };

      // hoofdnode + alle children
      pushNode(root);
      root.querySelectorAll('*').forEach(pushNode);

      const s = parts.join(' ').replace(/\s+/g, ' ').trim();
      return s || null;
    }, sel).catch(() => null);

    if (raw && /[$€£¥]|\d/.test(raw)) {
      const { value, currency } = parsePrice(raw);
      if (value !== null || currency !== null) return { value, currency, raw };
    }
  }

  // 2) Fallback: scan hele pagina naar elementen waarvan ::before/::after op prijs lijkt
  const rawGlobal = await page.evaluate(() => {
    const unq = (s: string | null) => {
      if (!s || s === 'none' || s === 'normal') return '';
      return s.replace(/^['"]|['"]$/g, '');
    };

    const looksLikePrice = (s: string) => /(?:USD|EUR|GBP|JPY|CHF|CAD|AUD|[$€£¥])\s*[\d.,]/.test(s);

    const parts: string[] = [];
    document.querySelectorAll('body *').forEach((el) => {
      const b = unq(getComputedStyle(el, '::before').getPropertyValue('content'));
      const a = unq(getComputedStyle(el, '::after').getPropertyValue('content'));
      if (b && looksLikePrice(b)) parts.push(b);
      if (a && looksLikePrice(a)) parts.push(a);
    });
    const s = parts.join(' ').trim();
    return s || null;
  }).catch(() => null);

  if (rawGlobal) {
    const { value, currency } = parsePrice(rawGlobal);
    return { value, currency, raw: rawGlobal };
  }

  return { value: null, currency: null, raw: null };
}

function parsePrice(raw: string): { value: number | null; currency: string | null } {
  const cur = raw.match(/(USD|EUR|GBP|JPY|CHF|CAD|AUD|[$€£¥])/);
  const currency = cur ? mapCurrency(cur[1]) : null;

  // Voorbeelden: "$26,000", "€15.500", "USD 125,000"
  // 1) alleen cijfers, punt en komma behouden
  let num = raw.replace(/[^0-9.,]/g, '');

  // 2) verwijder duidelijk duizendtseparators:
  //    - "26,000" -> "26000" (als komma gevolgd door 3 cijfers en niet nog een cijfer)
  num = num.replace(/(\d)[, ](?=\d{3}(\D|$))/g, '$1');

  // 3) indien zowel '.' als ',' voorkomen, aannemen: '.' = duizend, ',' = decimaal (EU-stijl)
  if (num.includes('.') && num.includes(',')) {
    num = num.replace(/\./g, '').replace(',', '.');
  } else {
    // 4) als er enkel komma’s zijn, en patroon xx,xxx,xxx -> verwijder komma’s (duizend)
    if (/^\d{1,3}(,\d{3})+(,\d{2})?$/.test(num)) {
      num = num.replace(/,/g, '');
    }
    // 5) als er enkel punten zijn, en patroon xx.xxx.xxx -> verwijder punten (duizend)
    if (/^\d{1,3}(\.\d{3})+(\.\d{2})?$/.test(num)) {
      num = num.replace(/\./g, '');
    }
  }

  const value = num ? parseFloat(num) : null;
  return { value: Number.isFinite(value as number) ? (value as number) : null, currency };
}


function saveLotResult(outFile: string, lot: LotResult) {
  ensureDir(path.dirname(outFile));

  let current: LotResult[] = [];
  if (fs.existsSync(outFile)) {
    try {
      current = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    } catch {
      current = [];
    }
  }

  // check of lot_code al bestaat
  if (lot.lot_code && current.some((x) => x.lot_code === lot.lot_code)) {
    logMessage(`⚠️ Lot ${lot.lot_code} bestaat al, overslaan.`);
    return;
  }

  current.push(lot);
  fs.writeFileSync(outFile, JSON.stringify(current, null, 2), "utf-8");
  logMessage(`💾 Lot ${lot.lot_code ?? "?"} toegevoegd aan ${path.basename(outFile)}`);
}

function waitForEnter(prompt = "▶ Druk op Enter zodra je bent ingelogd en de pagina is teruggekeerd…") {
  return new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${prompt}\n`, () => {
      rl.close();
      resolve();
    });
  });
}


async function isLoggedInOnWwwStrict(page: Page): Promise<boolean> {
  // “My Mecum” zichtbaar?
  const mySel = ['a[href*="mymecum"]', 'a[href*="/account"]', '[aria-label*="My Mecum"]'];
  for (const sel of mySel) {
    const handle = await page.$(sel);
    if (handle) {
      const visible = await page.evaluate(el => {
        const cs = getComputedStyle(el as HTMLElement);
        const r = (el as HTMLElement).getBoundingClientRect();
        return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
      }, handle);
      if (visible) return true;
    }
  }
  // zichtbare “Sign in / Login” betekent níet ingelogd
  const loginSel = ['a[href*="/signin"]', 'a[href*="/login"]', 'a[href*="sign-up"]'];
  for (const sel of loginSel) {
    const h = await page.$(sel);
    if (h) {
      const visible = await page.evaluate(el => {
        const cs = getComputedStyle(el as HTMLElement);
        const r = (el as HTMLElement).getBoundingClientRect();
        return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
      }, h);
      if (visible) return false;
    }
  }
  return false;
}

/** Open de auctionpagina, laat jou handmatig inloggen, wacht tot login zichtbaar is of tot je Enter drukt. */
async function pauseForManualLogin(page: Page, landingUrl: string) {
  logMessage("⏸️ Handmatige login: ik open de auctionpagina. Log in via de header.");
  await page.goto(landingUrl, { waitUntil: "networkidle0", timeout: 120_000 });

  // Cookie/consent-knoppen eventueel wegklikken
  await page.$('#onetrust-accept-btn-handler').then(b => b?.click().catch(() => { }));
  await page.$('button[aria-label="Accept all"]').then(b => b?.click().catch(() => { }));

  console.log("👉 Klik zelf op de loginknop (class .NavButton_navButton__is4TD), log in, en laat de site je terugsturen.");
  console.log("   Als het lang duurt: je kunt altijd Enter drukken om door te gaan.");

  // Wacht óf op detectie van login óf op Enter
  await Promise.race([
    (async () => {
      // maximaal 10 minuten polling
      const deadline = Date.now() + 10 * 60_000;
      while (Date.now() < deadline) {
        if (await isLoggedInOnWwwStrict(page)) {
          logMessage("✅ Handmatige login gedetecteerd.");
          return;
        }
        await sleep(1000);
      }
    })(),
    waitForEnter()
  ]);

  // Eén laatste check
  const ok = await isLoggedInOnWwwStrict(page);
  if (!ok) {
    logMessage("ℹ️ Kon login niet automatisch detecteren, ga toch verder (op eigen risico).");
  }
}

// ====== Scrape-functie ======
async function scrapeAuction(baseUrl: string): Promise<void> {
  ensureDir(OUTPUT_DIR);

  const slug = getAuctionSlugFromUrl(baseUrl);
  const outFile = outputPathForBase(baseUrl);

  logMessage(`▶️ Start scraping: ${slug}`);

  try {
    const browser = await puppeteer.launch({
      headless: false, // 👉 toon de browser
      defaultViewport: null,
      args: [`--user-data-dir=${path.join(__dirname, '.puppeteer-profile')}`], // sessie blijft bestaan
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    );

    // eerst inloggen
    // await login(page);
    await pauseForManualLogin(page, baseUrl + "1"); // open eerst de auction-lijstpagina


    // 1) Verzamel alle lot-links
    const lotLinks = await collectLotLinks(page, baseUrl);
    logMessage(`🔗 [${slug}] Unieke lot-links: ${lotLinks.length}`);

    // 2) Per lot detailinformatie ophalen (bewust serieel binnen één auction)
    let i = 0;
    for (const lot_source_link of lotLinks) {
      i++;
      try {
        await page.goto(lot_source_link, { waitUntil: "networkidle0", timeout: 120_000 });

        const lot_code = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? el.textContent : null;
        }, LOT_NUMBER_SELECTOR);

        const lot_description = await page.$$eval(LOT_DESCRIPTION, (items) =>
          items.map(el => el.textContent?.trim() || "").filter(Boolean).join(", ")
        );

        const vehicle_chassis_no = await page.evaluate((containerSel) => {
          const container = document.querySelector(containerSel);
          if (!container) return null;
          const lastDiv = container.querySelector(":scope > div:last-child");
          if (!lastDiv) return null;
          const lastP = lastDiv.querySelector(":scope > p:last-child");
          return lastP ? lastP.textContent?.trim() ?? null : null;
        }, DETAIL_CONTAINER);

        const lot_title = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? el.textContent : null;
        }, LOT_TITLE);


        await page.waitForSelector('div[class*="priceBadge"]', { timeout: 10000 }).catch(() => { });
        await page.evaluate(() => {
          const el = document.querySelector('div[class*="priceBadge"]');
          if (el) el.scrollIntoView({ block: 'center' });
        });

        // haal prijs op
        const { value: price_value, currency: price_currency, raw: price_raw } = await extractPrice(page)

        const isSold = await page.$(SOLD_BADGE) !== null;
        const price_type = isSold ? "sold" : null;

        // optioneel debug
        if (!price_value && price_raw) logMessage(`ℹ️ raw price seen but not parsed: "${price_raw}"`);
        if (!price_value) logMessage('⚠️ Geen prijs gevonden (nog ingelogd?)');

        // 👉 direct de make/model/etc. ophalen via je helper
        const vehicle_make = await getSpecValue(page, "MAKE");
        const vehicle_model = await getSpecValue(page, "MODEL");
        const vehicle_engine = await getSpecValue(page, "ENGINE");
        const vehicle_transmission_type = await getSpecValue(page, "TRANSMISSION");
        const vehicle_body_color = await getSpecValue(page, "EXTERIOR COLOR");
        const vehicle_interior_color = await getSpecValue(page, "INTERIOR COLOR");
        const auction_label = await getSpecValue(page, "AUCTION");


        let lot_medida;
        try {
          const hasViewAllBtn = (await page.$(VIEW_ALL_IMAGES_BUTTON)) !== null;

          if (hasViewAllBtn) {
            // Klik en wacht tot overlay en images zichtbaar zijn
            await Promise.all([
              page.click(VIEW_ALL_IMAGES_BUTTON),
              page.waitForSelector(VIEW_ALL_IMAGES_OVERLAY, { visible: true, timeout: 10000 }),
            ]);
            await page.waitForSelector(VEHICLE_IMAGES_IN_OVERLAY, { visible: true, timeout: 10000 });

            // Pak alle img-urls uit de overlay (voorkeur: hoogste resolutie)
            lot_medida = await page.$$eval(VEHICLE_IMAGES_IN_OVERLAY, (imgs) => {
              const urls = imgs.map((img) => {
                const i = img as HTMLImageElement;

                // kies beste bron
                let url = i.src || (i as any).currentSrc || '';
                if (!url && i.srcset) {
                  // neem laatste (meestal hoogste resolutie)
                  const parts = i.srcset
                    .split(',')
                    .map((s) => s.trim().split(' ')[0])
                    .filter(Boolean);
                  url = parts[parts.length - 1] || '';
                }

                // absolute URL
                if (url) {
                  try {
                    url = new URL(url, window.location.href).href;
                  } catch { }
                }
                return url;
              });

              // dedup + filter
              return Array.from(new Set(urls.filter(Boolean)));
            });

            // overlay sluiten (optioneel)
            try {
              await page.keyboard.press('Escape');
              await page.waitForSelector(VIEW_ALL_IMAGES_OVERLAY, { hidden: true, timeout: 5000 });
            } catch {
              // als sluiten niet lukt is het niet fataal
            }
          } else {
            // fallback: pak thumbnails/visible grid
            lot_medida = await page.$$eval(VEHICLE_IMAGES, (imgs) => {
              const urls = imgs.map((img) => {
                const i = img as HTMLImageElement;
                let url = i.src || (i as any).currentSrc || '';
                if (!url && i.srcset) {
                  const parts = i.srcset
                    .split(',')
                    .map((s) => s.trim().split(' ')[0])
                    .filter(Boolean);
                  url = parts[parts.length - 1] || '';
                }
                if (url) {
                  try {
                    url = new URL(url, window.location.href).href;
                  } catch { }
                }
                return url;
              });
              return Array.from(new Set(urls.filter(Boolean)));
            });
          }
        } catch (e) {
          // Als alles faalt, laat lot_images leeg; je logt elders al errors per lot
        }

        const lotResult: LotResult = {
          lot_source_link,
          lot_code,
          auction_label,
          lot_title,
          lot_description,
          vehicle_chassis_no,
          vehicle_make,
          vehicle_model,
          vehicle_engine,
          vehicle_transmission_type,
          vehicle_body_color,
          vehicle_interior_color,
          price_currency,
          price_value,
          price_type,
          lot_medida,
        };

        // 👉 direct opslaan per lot
        saveLotResult(outFile, lotResult);

        if (i % 10 === 0 || i === lotLinks.length) {
          logMessage(`[${slug}] Progress: ${i}/${lotLinks.length}`);
        }

        await sleep(rand(DETAIL_PAGE_DELAY_MS.min, DETAIL_PAGE_DELAY_MS.max));
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        const errorLot: LotResult = {
          lot_source_link,
          lot_code: null,
          vehicle_chassis_no: null,
          error: msg,
        };
        saveLotResult(outFile, errorLot);
        logMessage(`[${slug}] ❌ Fout op lot ${i}/${lotLinks.length}: ${msg}`);
      }
    }

    await browser.close();
  } catch (err: any) {
    logMessage(`[${slug}] 🚨 Algemene fout: ${err.message ?? String(err)}`);
  }
}

//
// ====== Concurrency launcher ======
(async () => {
  const limit = pLimit(CONCURRENCY);

  await Promise.all(
    BASE_URLS.map((base) => limit(() => scrapeAuction(base)))
  );

  logMessage('🎉 Alle scrapes afgerond!');
})();