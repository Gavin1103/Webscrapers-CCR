import type { Page } from "puppeteer";
import { DETAIL_CONTAINER, LOT_DESCRIPTION, LOT_NUMBER_SELECTOR, LOT_TITLE, SOLD_BADGE, VIEW_ALL_IMAGES_BUTTON, VIEW_ALL_IMAGES_OVERLAY, VEHICLE_IMAGES_GRID, VEHICLE_IMAGES_IN_OVERLAY } from "../constants/selectors.js";
import { getSpecValue } from "../utils/specs.js";
import { extractPrice } from "../utils/price.js";
import { DETAIL_PAGE_DELAY_MS, rand, sleep } from "../utils/time.js";
import type { LotResult } from "../types.js";

async function extractImages(page: Page): Promise<string[] | undefined> {
    try {
        const hasViewAllBtn = (await page.$(VIEW_ALL_IMAGES_BUTTON)) !== null;
        if (hasViewAllBtn) {
            await Promise.all([
                page.click(VIEW_ALL_IMAGES_BUTTON),
                page.waitForSelector(VIEW_ALL_IMAGES_OVERLAY, { visible: true, timeout: 10000 })
            ]);
            await page.waitForSelector(VEHICLE_IMAGES_IN_OVERLAY, { visible: true, timeout: 10000 });

            const urls = await page.$$eval(VEHICLE_IMAGES_IN_OVERLAY, (imgs) => {
                const urls = imgs.map((img) => {
                    const i = img as HTMLImageElement;
                    let url = i.src || (i as any).currentSrc || "";
                    if (!url && i.srcset) {
                        const parts = i.srcset.split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean);
                        url = parts[parts.length - 1] || "";
                    }
                    if (url) {
                        try { url = new URL(url, window.location.href).href; } catch {}
                    }
                    return url;
                });
                return Array.from(new Set(urls.filter(Boolean)));
            });

            try {
                await page.keyboard.press("Escape");
                await page.waitForSelector(VIEW_ALL_IMAGES_OVERLAY, { hidden: true, timeout: 5000 });
            } catch {}
            return urls;
        } else {
            const urls = await page.$$eval(VEHICLE_IMAGES_GRID, (imgs) => {
                const urls = imgs.map((img) => {
                    const i = img as HTMLImageElement;
                    let url = i.src || (i as any).currentSrc || "";
                    if (!url && i.srcset) {
                        const parts = i.srcset.split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean);
                        url = parts[parts.length - 1] || "";
                    }
                    if (url) {
                        try { url = new URL(url, window.location.href).href; } catch {}
                    }
                    return url;
                });
                return Array.from(new Set(urls.filter(Boolean)));
            });
            return urls;
        }
    } catch {
        return undefined;
    }
}

export async function scrapeLot(page: Page, lot_source_link: string): Promise<LotResult> {
    await page.goto(lot_source_link, { waitUntil: "networkidle0", timeout: 120_000 });

    const lot_code = await page.evaluate((sel) => document.querySelector(sel)?.textContent ?? null, LOT_NUMBER_SELECTOR);

    const lot_description = await page.$$eval(LOT_DESCRIPTION, (items) =>
        items.map((el) => el.textContent?.trim() || "").filter(Boolean).join(", ")
    );

    const vehicle_chassis_no = await page.evaluate((containerSel) => {
        const container = document.querySelector(containerSel);
        if (!container) return null;
        const lastDiv = container.querySelector(":scope > div:last-child");
        if (!lastDiv) return null;
        const lastP = lastDiv.querySelector(":scope > p:last-child");
        return lastP ? lastP.textContent?.trim() ?? null : null;
    }, DETAIL_CONTAINER);

    const lot_title = await page.evaluate((sel) => document.querySelector(sel)?.textContent ?? null, LOT_TITLE);

    await page.waitForSelector('div[class*="priceBadge"]', { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => document.querySelector('div[class*="priceBadge"]')?.scrollIntoView({ block: "center" }));

    const { value: price_value, currency: price_currency } = await extractPrice(page);
    const isSold = (await page.$(SOLD_BADGE)) !== null;
    const price_type = isSold ? "sold" : null;

    const vehicle_make = await getSpecValue(page, "MAKE");
    const vehicle_model = await getSpecValue(page, "MODEL");
    const vehicle_engine = await getSpecValue(page, "ENGINE");
    const vehicle_transmission_type = await getSpecValue(page, "TRANSMISSION");
    const vehicle_body_color = await getSpecValue(page, "EXTERIOR COLOR");
    const vehicle_interior_color = await getSpecValue(page, "INTERIOR COLOR");
    const auction_label = await getSpecValue(page, "AUCTION");

    const lot_medida = await extractImages(page);

    const lot: LotResult = {
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
        lot_medida
    };

    await sleep(rand(DETAIL_PAGE_DELAY_MS.min, DETAIL_PAGE_DELAY_MS.max));
    return lot;
}
