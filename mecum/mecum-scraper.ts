// Scraper for the website Mecum. Fetches: source_lot_url, lot_code and vehicle_chassis_no

import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import puppeteer, { type Page, type Browser } from 'puppeteer';

//
// ====== Instellingen ======
//

const BASE_URLS = [
  'https://www.mecum.com/auctions/indy-fall-special-2023/lots/?auction[0]=Indy+Fall+Special+2023%7C1696464000%7C1696636800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/dallas-2020/lots/?auction[0]=Dallas+2020%7C1602720000%7C1602892800&configure[filters]=&configure[ruleContexts][0]=pin_items&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/las-vegas-2020/lots/?auction[0]=Las+Vegas+2020%7C1605225600%7C1605312000&configure[filters]=&configure[ruleContexts][0]=pin_items&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/kissimmee-2020/lots/?auction[0]=Kissimmee+2020%7C1577923200%7C1578787200&configure[filters]=&configure[ruleContexts][0]=pin_items&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/indianapolis-2020/lots/?auction[0]=Indy+2020%7C1594339200%7C1595030400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/indy-fall-special-2020/lots/?auction[0]=Indy+Fall+Special+2020%7C1603929600%7C1604102400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/harrisburg-2019/lots/?auction[0]=Harrisburg+2019%7C1564531200%7C1564790400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/houston-2019/lots/?auction[0]=Houston+2019%7C1554336000%7C1554508800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/kansas-city-december-2019/lots/?auction[0]=Kansas+City+2019%7C1575504000%7C1575676800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/dallas-2019/lots/?auction[0]=Dallas+2019%7C1567555200%7C1567814400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/portland-2019/lots/?auction[0]=Portland+2019%7C1561075200%7C1561161600&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/phoenix-2019/lots/?auction[0]=Phoenix+2019%7C1552521600%7C1552780800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/louisville-2019/lots/?auction[0]=Louisville+2019%7C1568937600%7C1569024000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/denver-2019/lots/?auction[0]=Denver+2019%7C1562889600%7C1562976000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page',
  'https://www.mecum.com/auctions/kissimmee-2019/lots/?auction[0]=Kissimmee+2019%7C1546473600%7C1547337600&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/kissimmee-2018/lots/?auction[0]=Kissimmee+2018%7C1515110400%7C1515888000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page',
  'https://www.mecum.com/auctions/las-vegas-cars-2018/lots/?auction[0]=Las+Vegas+2018%7C1542240000%7C1542412800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/kansas-city-2018/lots/?auction[0]=Kansas+City+March+2018%7C1521158400%7C1521244800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/houston-2018/lots/?auction[0]=Houston+2018%7C1522886400%7C1523059200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/harrisburg-2018/lots/?auction[0]=Harrisburg+2018%7C1533168000%7C1533340800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/indianapolis-2018/lots/?auction[0]=Indy+2018%7C1526342400%7C1526774400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/schaumburg-2018/lots/?auction[0]=Chicago+2018%7C1540425600%7C1540598400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/denver-2017/lots/?auction[0]=Denver+2017%7C1500508800%7C1500681600&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/harrisburg-2017/lots/?auction[0]=Harrisburg+2017%7C1501718400%7C1501891200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/chicago-2017/lots/?auction[0]=Chicago+2017%7C1507161600%7C1507334400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/kissimmee-2017/lots/?auction[0]=Kissimmee+2017%7C1483660800%7C1484438400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/portland-2017/lots/?auction[0]=Portland+2017%7C1497571200%7C1497657600&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/las-vegas-2017/lots/?auction[0]=Las+Vegas+2017%7C1510790400%7C1510963200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/indianapolis-2017/lots/?auction[0]=Indy+2017%7C1494892800%7C1495238400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/kansas-city-spring-2017/lots/?auction[0]=Kansas+City+Spring+2017%7C1490313600%7C1490400000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/portland-2016/lots/?auction[0]=Portland+2016%7C1466121600%7C1466208000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/dallas-2016/lots/?auction[0]=Dallas+2016%7C1478044800%7C1478304000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/kansas-city-2016/lots/?auction[0]=Kansas+City+2016%7C1480550400%7C1480723200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/chicago-2016/lots/?auction[0]=Chicago+2016%7C1475712000%7C1475884800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
  'https://www.mecum.com/auctions/denver-2016/lots/?auction[0]=Denver+2016%7C1467936000%7C1468022400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
];

const CONCURRENCY = Number(process.env.CONCURRENCY || 3); // 🔧 pas aan naar wens (2-5 is safe)
const MAX_PAGES = 200;
const OUTPUT_DIR = path.join(__dirname, 'fetchedData');
const LOG_FILE = path.join(__dirname, 'fetchedData','logs', 'scrape-log.txt');

// Selectors
const LINK_SELECTOR = 'a[class^="CardLot_title__"]'; // of: 'a[href*="/lots/"]'
const DETAIL_CONTAINER = 'div.LotHeader_odometerSerial__4U5fu';
const LOT_NUMBER_SELECTOR = 'span.LotHeader_num__xqgKs';

// Timing / throttling
const LIST_PAGE_DELAY_MS = { min: 200, max: 500 };
const DETAIL_PAGE_DELAY_MS = { min: 250, max: 650 };

//
// ====== Types ======
interface LotResult {
  lot_source_link: string;
  lot_code: string | null;
  vehicle_chassis_no: string | null;
  error?: string;
}

//
// ====== Helpers ======
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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


async function scrapeAuction(baseUrl: string): Promise<void> {
  ensureDir(OUTPUT_DIR);

  const slug = getAuctionSlugFromUrl(baseUrl);
  const outFile = outputPathForBase(baseUrl);

  if (fs.existsSync(outFile)) {
    logMessage(`⏭️  Overslaan: ${slug} (bestand bestaat al: ${path.basename(outFile)})`);
    return;
  }

  logMessage(`▶️ Start scraping: ${slug}`);

  try {
    const browser = await puppeteer.launch({
      headless: true, // zet op false om te debuggen
      // args: ['--no-sandbox'], // indien nodig in CI
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
    );

    // 1) Verzamel alle lot-links
    const lotLinks = await collectLotLinks(page, baseUrl);
    logMessage(`🔗 [${slug}] Unieke lot-links: ${lotLinks.length}`);

    // 2) Per lot detailinformatie ophalen (bewust serieel binnen één auction)
    const results: LotResult[] = [];
    let i = 0;

    for (const lot_source_link of lotLinks) {
      i++;
      try {
        await page.goto(lot_source_link, { waitUntil: 'networkidle0', timeout: 120_000 });

        const lot_code = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? el.textContent : null;
        }, LOT_NUMBER_SELECTOR);

        const vehicle_chassis_no = await page.evaluate((containerSel) => {
          const container = document.querySelector(containerSel);
          if (!container) return null;
          const lastDiv = container.querySelector(':scope > div:last-child');
          if (!lastDiv) return null;
          const lastP = lastDiv.querySelector(':scope > p:last-child');
          return lastP ? lastP.textContent?.trim() ?? null : null;
        }, DETAIL_CONTAINER);

        results.push({ lot_source_link, lot_code, vehicle_chassis_no });
        if (i % 10 === 0 || i === lotLinks.length) {
          logMessage(`[${slug}] Progress: ${i}/${lotLinks.length}`);
        }

        await sleep(rand(DETAIL_PAGE_DELAY_MS.min, DETAIL_PAGE_DELAY_MS.max));
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        results.push({ lot_source_link, lot_code: null, vehicle_chassis_no: null, error: msg });
        logMessage(`[${slug}] ❌ Fout op lot ${i}/${lotLinks.length}: ${msg}`);
      }
    }

    // 3) Schrijf output
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf-8');
    logMessage(`✅ Klaar: ${outFile}`);

    await browser.close();
  } catch (err: any) {
    logMessage(`❌ Fout bij ${slug}: ${err?.message ?? String(err)}`);
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
