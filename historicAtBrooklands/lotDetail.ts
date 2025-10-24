import {Page} from "puppeteer";
import {LotResult} from "../types/types";
import {
    auctionDateRangeClassName,
    auctionLabelClassName,
    lotMediaImageSelector,
    lotNumber,
    lotTitleClassName
} from "./classNames";
import {collectPriceInfo} from "./helper/priceExtracter";

export async function collectLotDetails(url: string, page: Page): Promise<LotResult | undefined | null> {
    await page.goto(url, {waitUntil: "networkidle0", timeout: 120_000});

    // lot info
    let lot_code = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() || null : null;
    }, lotNumber);

    let lot_title = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;

        // Neem alleen de eerste tekstnode (dus niet de spans of br's)
        const textNode = Array.from(el.childNodes).find(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
        );

        return textNode?.textContent?.trim() ?? null;
    }, lotTitleClassName);

    let auction_label = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() || null : null;
    }, auctionLabelClassName);

    let auction_date_range = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.textContent?.trim() || null : null;
    }, auctionDateRangeClassName);

    // specs info
    await page.waitForSelector("div.lot-desc", { timeout: 15_000 });

    // pak de eerste .lot-desc (niet met :nth-of-type!)
    const containers = await page.$$("div.lot-desc");
    const container = containers[0];
    if (!container) {
        console.warn("⚠️ Geen .lot-desc gevonden op deze pagina");
        return null;
    }

    // pak de eerste <p> binnen die .lot-desc
    const specP = await container.$("p");
    if (!specP) {
        console.warn("⚠️ Geen <p> gevonden binnen .lot-desc");
        return null;
    }

    const specs = await specP.evaluate((el) => {
        let year: string | null = null;
        let make: string | null = null;
        let model: string | null = null;
        let registration: string | null = null;
        let chassisNo: string | null = null;
        let engineNo: string | null = null;
        let odometer: string | null = null;

        let currentKey: string | null = null;

        el.childNodes.forEach((node) => {
            if (node.nodeName === "STRONG") {
                currentKey = node.textContent?.replace(/[:\s]+$/, "").trim() || null;
            } else if (node.nodeType === Node.TEXT_NODE && currentKey) {
                const value = node.textContent?.trim();
                if (value) {
                    switch (currentKey.toLowerCase()) {
                        case "year":
                            year = value;
                            break;
                        case "make":
                            make = value;
                            break;
                        case "model":
                            model = value;
                            break;
                        case "registration":
                            registration = value;
                            break;
                        case "chassis no":
                            chassisNo = value;
                            break;
                        case "engine no":
                            engineNo = value;
                            break;
                        case "odometer":
                            odometer = value;
                            break;
                    }
                }
                currentKey = null;
            }
        });

        return { year, make, model, registration, chassisNo, engineNo, odometer };
    });

    // Lot description
    await page.waitForSelector("div.lot-desc", { timeout: 15_000 });

    const lot_desc = await page.evaluate(() => {
        // zoek de eerste .lot-desc
        const container = document.querySelector("div.lot-desc");
        if (!container) return null;

        // alle <p> behalve de eerste
        const paragraphs = Array.from(container.querySelectorAll("p:not(:first-of-type)"));
        if (paragraphs.length === 0) return null;

        // combineer tekstinhoud, behoud regelbreuken
        const text = paragraphs
            .map((p) => p.textContent?.trim() ?? "")
            .filter(Boolean)
            .join("\n\n"); // dubbele newline tussen paragrafen

        return text;
    });

    // price info
    const price = await collectPriceInfo(page);

    // Images
    await page.waitForSelector(lotMediaImageSelector, { timeout: 10_000 }).catch(() => null);

    const imageUrls = await page.$$eval(lotMediaImageSelector, (imgs) =>
        imgs
            .map((img) => (img as HTMLImageElement).src?.trim() ?? "")
            .filter((src) => !!src)
    );

    return {
        auction_label: auction_label,
        auction_date_range: auction_date_range,

        lot_source_link: url,
        lot_code: lot_code,
        lot_title: lot_title,
        lot_description: lot_desc,
        lot_media: imageUrls,

        vehicle_chassis_no: specs.chassisNo,
        vehicle_year: specs.year,
        vehicle_make: specs.make,
        vehicle_model: specs.model,
        vehicle_registry_code: specs.registration,
        vehicle_mileage_value: specs.odometer,
        vehicle_engine: specs.engineNo,

        price_currency: price.price_currency,
        price_value: price.price_value,
        price_guide_low: price.estimate_low,
        price_guide_high: price.estimate_high,
        price_type: price.status,
    };
}