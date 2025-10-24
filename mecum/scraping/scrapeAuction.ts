import pLimit from "p-limit";
import puppeteer from "puppeteer";
import path from "path";
import { CONCURRENCY, HEADLESS, MAX_PAGES, USER_AGENT, USER_DATA_DIR } from "../config.js";
import { collectLotLinks } from "./collectLotLinks.js";
import { scrapeLot } from "./scrapeLot.js";
import { auctionSlugFromUrl, outputPathForBase, saveLotResult } from "../utils/fsio.js";
import { logMessage } from "../utils/logs";
import { pauseForManualLogin } from "../utils/login.js";
import type { LotResult } from "../../types/types";

export async function scrapeAuction(baseUrl: string): Promise<void> {
    const slug = auctionSlugFromUrl(baseUrl);
    const outFile = outputPathForBase(baseUrl);
    logMessage(`▶️ Start scraping: ${slug}`);

    try {
        const browser = await puppeteer.launch({
            headless: HEADLESS,
            defaultViewport: null,
            args: [`--user-data-dir=${path.resolve(USER_DATA_DIR)}`]
        });
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);

        // Handmatige login (eenmalig per run)
        await pauseForManualLogin(page, baseUrl + "1");

        // 1) Lot-links verzamelen
        const lotLinks = await collectLotLinks(page, baseUrl, MAX_PAGES);
        logMessage(`🔗 [${slug}] Unieke lot-links: ${lotLinks.length}`);

        // 2) Serieel per lot (stabieler; parallel tast login/cookies soms aan)
        let i = 0;
        for (const lot_source_link of lotLinks) {
            i++;
            try {
                const lot = await scrapeLot(page, lot_source_link);
                saveLotResult(outFile, lot);

                if (i % 10 === 0 || i === lotLinks.length) {
                    logMessage(`[${slug}] Progress: ${i}/${lotLinks.length}`);
                }
            } catch (e: any) {
                const msg = e?.message ?? String(e);
                const errorLot: LotResult = {
                    lot_source_link,
                    lot_code: null,
                    vehicle_chassis_no: null,
                    error: msg
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

export async function runAllAuctions(baseUrls: string[], concurrency = CONCURRENCY) {
    const limit = pLimit(concurrency);
    await Promise.all(baseUrls.map((base) => limit(() => scrapeAuction(base))));
    logMessage("🎉 Alle scrapes afgerond!");
}
