import type { Page } from "puppeteer";
import { DETAIL_CONTAINER, LOT_DESCRIPTION, LOT_NUMBER_SELECTOR, LOT_TITLE, SOLD_BADGE, VIEW_ALL_IMAGES_BUTTON, VIEW_ALL_IMAGES_OVERLAY, VEHICLE_IMAGES_IN_OVERLAY, VEHICLE_IMAGES_SECTION, VEHICLE_IMAGE_AFTER_CLICKING_BUTTON, VEHICLE_IMAGES_BUTTON_IN_SECTION, VEHICLE_OVERLAY_AFTER_CLICKING_BUTTON, VEHICLE_OVERLAY_ROOT } from "../constants/selectors.js";
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
                        try { url = new URL(url, window.location.href).href; } catch { }
                    }
                    return url;
                });
                return Array.from(new Set(urls.filter(Boolean)));
            });

            try {
                await page.keyboard.press("Escape");
                await page.waitForSelector(VIEW_ALL_IMAGES_OVERLAY, { hidden: true, timeout: 5000 });
            } catch { }

            return urls;
        }
        else {
            //check of de sectie bestaat. Zo niet → lege array.
            const sectionExists = await page.$(VEHICLE_IMAGES_SECTION);
            if (!sectionExists) {
                return []; // lot_medida wordt dan [] gezet
            }

            // === Geen "view all" ===
            await page.waitForSelector(VEHICLE_IMAGES_SECTION, { visible: true, timeout: 10_000 });

            const buttons = await page.$$(VEHICLE_IMAGES_BUTTON_IN_SECTION);
            const urls: string[] = [];

            for (let i = 0; i < buttons.length; i++) {
                try {
                    // breng thumbnail in beeld en klik
                    await buttons[i].evaluate((btn) => (btn as HTMLElement).scrollIntoView({ block: "center" }));
                    await buttons[i].click({ delay: 10 });

                    // wacht tot overlay open is
                    await page.waitForSelector(VEHICLE_OVERLAY_ROOT, { visible: true, timeout: 10_000 });

                    // WACHT specifiek tot de actieve slide een geldige src/currentSrc heeft
                    await page.waitForFunction(
                        (sel) => {
                            const img = document.querySelector(sel) as HTMLImageElement | null;
                            if (!img) return false;
                            const u = (img.currentSrc || img.src || "").trim();
                            return /^https?:\/\//i.test(u);
                        },
                        { timeout: 10_000 },
                        VEHICLE_IMAGE_AFTER_CLICKING_BUTTON
                    );

                    // pak nu de (gevulde) URL
                    const url = await page.$eval(VEHICLE_IMAGE_AFTER_CLICKING_BUTTON, (img) => {
                        const i = img as HTMLImageElement;
                        // liever currentSrc (respecteert srcset) en anders src
                        let u = (i.currentSrc || i.src || "").trim();
                        try { if (u) u = new URL(u, window.location.href).href; } catch { }
                        return /^https?:\/\//i.test(u) ? u : "";
                    });

                    if (url) urls.push(url);

                    // sluit overlay en wacht tot hij weg is
                    try {
                        await page.keyboard.press("Escape");
                        await page.waitForSelector(VEHICLE_OVERLAY_ROOT, { hidden: true, timeout: 5_000 });
                    } catch {
                        const close = await page.$(".pswp__button--close");
                        if (close) {
                            await close.click();
                            await page.waitForSelector(VEHICLE_OVERLAY_ROOT, { hidden: true, timeout: 5_000 });
                        }
                    }
                } catch {
                    // maak overlay dicht als hij bleef hangen en ga verder
                    try {
                        if (await page.$(VEHICLE_OVERLAY_ROOT)) {
                            await page.keyboard.press("Escape");
                            await page.waitForSelector(VEHICLE_OVERLAY_ROOT, { hidden: true, timeout: 3_000 }).catch(() => { });
                        }
                    } catch { }
                }
            }

            // dedup + filter
            return Array.from(new Set(urls.filter(Boolean)));
        }
    } catch (error) {
        console.log(error)
        return undefined;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeLot(page: Page, lot_source_link: string): Promise<LotResult> {
    await page.goto(lot_source_link, { waitUntil: "networkidle0", timeout: 120_000 });

    const lot_code = await page.evaluate((sel) => document.querySelector(sel)?.textContent ?? null, LOT_NUMBER_SELECTOR);

    // const lot_description = await page.$$eval(LOT_DESCRIPTION, (items) =>
    //     items.map((el) => el.textContent?.trim() || "").filter(Boolean).join(", ")
    // );

    const vehicle_chassis_no = await page.evaluate((containerSel) => {
        const container = document.querySelector(containerSel);
        if (!container) return null;
        const lastDiv = container.querySelector(":scope > div:last-child");
        if (!lastDiv) return null;
        const lastP = lastDiv.querySelector(":scope > p:last-child");
        return lastP ? lastP.textContent?.trim() ?? null : null;
    }, DETAIL_CONTAINER);

    // const lot_title = await page.evaluate((sel) => document.querySelector(sel)?.textContent ?? null, LOT_TITLE);

    await page.goto(lot_source_link, { waitUntil: "domcontentloaded", timeout: 120_000 });
    // geef SPA even ademruimte
    await sleep(500);
    const { value: price_value, currency: price_currency } = await extractPrice(page);

    const isSold = (await page.$(SOLD_BADGE)) !== null;
    const price_type = isSold ? "sold" : null;

    // const vehicle_make = await getSpecValue(page, "MAKE");
    // const vehicle_model = await getSpecValue(page, "MODEL");
    // const vehicle_engine = await getSpecValue(page, "ENGINE");
    // const vehicle_transmission_type = await getSpecValue(page, "TRANSMISSION");
    // const vehicle_body_color = await getSpecValue(page, "EXTERIOR COLOR");
    // const vehicle_interior_color = await getSpecValue(page, "INTERIOR COLOR");
    // const auction_label = await getSpecValue(page, "AUCTION");

    // const lot_medida = await extractImages(page);

    const lot: LotResult = {
        lot_source_link,
        lot_code,
        // auction_label,
        // lot_title,
        // lot_description,
        vehicle_chassis_no,
        // vehicle_make,
        // vehicle_model,
        // vehicle_engine,
        // vehicle_transmission_type,
        // vehicle_body_color,
        // vehicle_interior_color,
        price_currency,
        price_value,
        price_type,
        // lot_medida
    };

    await sleep(rand(DETAIL_PAGE_DELAY_MS.min, DETAIL_PAGE_DELAY_MS.max));
    return lot;
}
