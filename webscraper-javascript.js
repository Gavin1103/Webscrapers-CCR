const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    // const BASE = 'https://www.mecum.com/auctions/dallas-2020/lots/?auction[0]=Dallas+2020|1602720000|1602892800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=';
    // const BASE = 'https://www.mecum.com/auctions/las-vegas-2020/lots/?auction[0]=Las+Vegas+2020|1605225600|1605312000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=';
    // const BASE = 'https://www.mecum.com/auctions/kissimmee-2020/lots/?auction[0]=Kissimmee+2020|1577923200|1578787200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page';
    const LINK_SELECTOR = 'a[class^="CardLot_title__"]';      // of: 'a[href*="/lots/"]'
    const MAX_PAGES = 200;                                    // safety cap

    // Detail selectors (pas aan indien nodig)
    const DETAIL_CONTAINER = 'div.LotHeader_odometerSerial__4U5fu'; // jouw bestaande container
    const LOT_NUMBER_SELECTOR = 'span.LotHeader_num__xqgKs';    // stabieler dan exacte hash

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));


    // === Helpers ===
    function getAuctionSlugFromUrl(urlStr) {
        try {
            const u = new URL(urlStr);
            const m = u.pathname.match(/\/auctions\/([^\/?#]+)(?:[\/?#]|$)/);
            return m ? m[1] : 'results';
        } catch {
            return 'results';
        }
    }

    function getTodayDateString() {
        const d = new Date();
        return d.toISOString().split('T')[0]; // bv. "2025-09-08"
    }

    const OUTPUT_BASENAME = getAuctionSlugFromUrl(BASE); // bv. 'dallas-2020'
    const DATE_STRING = getTodayDateString();

    // pad = fetched/data/<slug>_date_<YYYY-MM-DD>.json
    const OUTPUT_DIR = path.join(__dirname, 'fetchedData');
    const OUTPUT_FILE = path.join(OUTPUT_DIR, `${OUTPUT_BASENAME}_date_${DATE_STRING}.json`);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36');

    // ===== FASE 1: alle product-URLs verzamelen =====
    const all = new Set();

    async function scrapeOne(pageUrl) {
        await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 120000 });
        const hasLinks = await page.$(LINK_SELECTOR);
        if (!hasLinks) return [];
        const urls = await page.$$eval(LINK_SELECTOR, els =>
            els.map(el => el.href || el.getAttribute('href')).filter(Boolean)
        );
        return Array.from(new Set(urls));
    }

    for (let p = 1; p <= MAX_PAGES; p++) {
        const pageUrl = `${BASE}${p}`;
        const urls = await scrapeOne(pageUrl);
        if (urls.length === 0) break;
        urls.forEach(u => all.add(u));
        await sleep(200 + Math.random() * 300);
    }

    console.log(`🔗 Totaal unieke links: ${all.size}`);

    // ===== FASE 2: per URL details ophalen =====
    const results = [];
    let i = 0;

    for (const url of all) {
        i++;
        try {
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });

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
                    return lastP ? lastP.textContent.trim() : null;
                }, DETAIL_CONTAINER);

            results.push({ url, lot_code, vehicle_chassis_no });

            console.groupCollapsed(`[${i}/${all.size}] ${url}`);
            console.log('lot_code:', lot_code);
            console.log('vehicle_chassis_no:', vehicle_chassis_no);
            console.groupEnd();

            await sleep(250 + Math.random() * 400);
        } catch (e) {
            results.push({ url, lot_code: null, vehicle_chassis_no: null, error: e.message });
            console.groupCollapsed(`[${i}/${all.size}] ${url}`);
            console.log('❌ Error:', e.message);
            console.groupEnd();
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`✅ Resultaten opgeslagen in ${OUTPUT_FILE}`);

    await browser.close();
})();



// const puppeteer = require('puppeteer');
// const fs = require('fs');

// (async () => {
//     const BASE = 'https://www.mecum.com/auctions/indy-fall-special-2023/lots/?auction[0]=Indy+Fall+Special+2023|1696464000|1696636800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=';
//     const LINK_SELECTOR = 'a[class^="CardLot_title__"]';      // of: 'a[href*="/lots/"]'
//     const MAX_PAGES = 200;                                    // safety cap

//     // Detail selectors (pas aan indien nodig)
//     const DETAIL_CONTAINER = 'div.LotHeader_odometerSerial__4U5fu'; // jouw bestaande container
//     const LOT_NUMBER_SELECTOR = 'span.LotHeader_num__xqgKs';    // stabieler dan exacte hash

//     const sleep = (ms) => new Promise(r => setTimeout(r, ms));

//     const browser = await puppeteer.launch({ headless: false });
//     const page = await browser.newPage();
//     await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36');

//     // ===== FASE 1: alle product-URLs verzamelen =====
//     const all = new Set();

//     async function scrapeOne(pageUrl) {
//         await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 120000 });
//         const hasLinks = await page.$(LINK_SELECTOR);
//         if (!hasLinks) return [];
//         const urls = await page.$$eval(LINK_SELECTOR, els =>
//             els.map(el => el.href || el.getAttribute('href')).filter(Boolean)
//         );
//         return Array.from(new Set(urls));
//     }

//     for (let p = 1; p <= MAX_PAGES; p++) {
//         const pageUrl = `${BASE}${p}`;
//         const urls = await scrapeOne(pageUrl);
//         if (urls.length === 0) break;
//         urls.forEach(u => all.add(u));
//         await sleep(200 + Math.random() * 300);
//     }

//     console.log(`🔗 Totaal unieke links: ${all.size}`);

//     // ===== FASE 2: per URL details ophalen (lotnummer + jouw "info") =====
//     const results = [];
//     let i = 0;

//     for (const url of all) {
//         i++;
//         try {
//             await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });

//             // 1) Lotnummer
//             const lotNumber = await page.evaluate((sel) => {
//                 const el = document.querySelector(sel);
//                 return el ? el.textContent : null; // geen trim, geen regex
//             }, LOT_NUMBER_SELECTOR);

//             // 2) “Laatste child-div → laatste p” binnen jouw container
//             const info = await page.evaluate((containerSel) => {
//                 const container = document.querySelector(containerSel);
//                 if (!container) return null;
//                 const lastDiv = container.querySelector(':scope > div:last-child');
//                 if (!lastDiv) return null;
//                 const lastP = lastDiv.querySelector(':scope > p:last-child');
//                 return lastP ? lastP.textContent.trim() : null;
//             }, DETAIL_CONTAINER);

//             results.push({ url, lotNumber, info });

//             console.groupCollapsed(`[${i}/${all.size}] ${url}`);
//             console.log('🔢 Lot:', lotNumber);
//             console.log('ℹ️ Info:', info);
//             console.groupEnd();

//             await sleep(250 + Math.random() * 400);
//         } catch (e) {
//             results.push({ url, lotNumber: null, info: null, error: e.message });
//             console.groupCollapsed(`[${i}/${all.size}] ${url}`);
//             console.log('❌ Error:', e.message);
//             console.groupEnd();
//         }
//     }

//     fs.writeFileSync('results.json', JSON.stringify(results, null, 2), 'utf-8');
//     console.log('✅ Resultaten opgeslagen in results.json');

//     await browser.close();
// })();
