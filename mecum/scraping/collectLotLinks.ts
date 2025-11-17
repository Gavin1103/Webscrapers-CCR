import type { Page } from "puppeteer";
import { LINK_SELECTOR } from "../constants/selectors.js";
import { LIST_PAGE_DELAY_MS, rand, sleep } from "../utils/time.js";

export async function collectLotLinks(page: Page, baseUrl: string, maxPages: number): Promise<string[]> {
    const all = new Set<string>();

    async function scrapeOne(pageUrl: string): Promise<string[]> {
        await page.goto(pageUrl, { waitUntil: "networkidle0", timeout: 120_000 });
        const hasLinks = await page.$(LINK_SELECTOR);
        if (!hasLinks) return [];
        const urls = await page.$$eval(LINK_SELECTOR, (els: Element[]) =>
            (els as HTMLAnchorElement[]).map((el) => (el as HTMLAnchorElement).href || el.getAttribute("href")).filter(Boolean) as string[]
        );
        return urls;
    }

    for (let p = 1; p <= maxPages; p++) {
        const pageUrl = `${baseUrl}${p}`;
        const urls = await scrapeOne(pageUrl);
        if (urls.length === 0) break;
        urls.forEach((u) => all.add(u));
        await sleep(rand(LIST_PAGE_DELAY_MS.min, LIST_PAGE_DELAY_MS.max));
    }

    return Array.from(all);
}
