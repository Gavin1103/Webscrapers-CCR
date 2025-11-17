import {Page} from "puppeteer";

type PriceInfo = {
    status: "sold" | "estimate" | "offered_without_reserve" | "unknown";
    price_currency: "GBP" | "EUR" | "USD" | null;
    price_value: number | null;       // bij sold
    estimate_low: number | null;      // bij estimate
    estimate_high: number | null;     // bij estimate
    raw: string | null;
};

export async function collectPriceInfo(page: Page): Promise<PriceInfo> {
    await page.waitForSelector("h1.lot-title", {timeout: 15_000});

    // 1) Alleen teksten uit DOM ophalen (geen parsing in evaluate)
    const {subTitle, strongsNearH1, allStrongs} = await page.evaluate(() => {
        const h1 = document.querySelector("h1.lot-title");
        const subTitle = h1?.querySelector(".sub-title")?.textContent?.trim() || null;

        const strongsNearH1: string[] = [];
        const container = h1?.parentElement;
        if (container) {
            container.querySelectorAll("strong").forEach(s => {
                const t = s.textContent?.trim();
                if (t) strongsNearH1.push(t);
            });
        }

        const allStrongs: string[] = [];
        document.querySelectorAll("strong").forEach(s => {
            const t = s.textContent?.trim();
            if (t) allStrongs.push(t);
        });

        return {subTitle, strongsNearH1, allStrongs};
    });

// helpers
    const mapSymbolToCurrency = (sym: string): "GBP" | "EUR" | "USD" | null =>
        sym === "£" ? "GBP" : sym === "€" ? "EUR" : sym === "$" ? "USD" : null;

    const toNumber = (s: string): number => parseFloat(s.replace(/[, ]/g, ""));

// 1) Sold met bedrag, bv. "Sold £2,745.60"
    const parseSoldWithAmount = (text: string) => {
        const m = text.match(/sold\s*([£€$])\s*([\d,]+(?:\.\d{1,2})?)/i);
        if (!m) return null;
        const [, sym, amt] = m;
        return {
            status: "sold" as const,
            price_currency: mapSymbolToCurrency(sym),
            price_value: toNumber(amt),
            estimate_low: null,
            estimate_high: null,
            raw: text.trim(),
        };
    };

// 2) Sold zonder bedrag, bv. alleen "Sold" (zoals in h1 .sub-title)
    const parseSoldFlagOnly = (text: string) => {
        if (!/\bsold\b/i.test(text)) return null;
        // Alleen status, geen prijs bekend
        return {
            status: "sold" as const,
            price_currency: null,
            price_value: null,
            estimate_low: null,
            estimate_high: null,
            raw: text.trim(),
        };
    };

// 3) Estimate, bv. "Estimate £15,000 - £20,000"
    const parseEstimate = (text: string) => {
        const m = text.match(/estimate\s*([£€$])\s*([\d,]+(?:\.\d{1,2})?)\s*-\s*([£€$])?\s*([\d,]+(?:\.\d{1,2})?)/i);
        if (!m) return null;
        const [, sym1, low, sym2, high] = m;
        const currency = mapSymbolToCurrency(sym1 || sym2 || "");
        return {
            status: "estimate" as const,
            price_currency: currency,
            price_value: null,
            estimate_low: toNumber(low),
            estimate_high: toNumber(high),
            raw: text.trim(),
        };
    };


    const defaultInfo: PriceInfo = {
        status: "unknown",
        price_currency: null,
        price_value: null,
        estimate_low: null,
        estimate_high: null,
        raw: null,
    };

    // 3) Kandidaten maken met prioriteit: (A) strongs bij H1, (B) alle strongs, (C) subTitle (LAAGSTE prio)
    const candidates = [
        ...(strongsNearH1 ?? []),
        ...(allStrongs ?? []),
    ];

// A) Sold (met bedrag) uit candidates
    for (const t of candidates) {
        const sold = parseSoldWithAmount(t);
        if (sold) return {...defaultInfo, ...sold};
    }
// A2) Sold (met bedrag) uit subTitle
    if (subTitle) {
        const soldSub = parseSoldWithAmount(subTitle);
        if (soldSub) return {...defaultInfo, ...soldSub};
    }

// B) Sold zonder bedrag
    for (const t of candidates) {
        const soldFlag = parseSoldFlagOnly(t);
        if (soldFlag) return {...defaultInfo, ...soldFlag};
    }
    if (subTitle) {
        const soldFlagSub = parseSoldFlagOnly(subTitle);
        if (soldFlagSub) return {...defaultInfo, ...soldFlagSub};
    }

// C) Estimate
    for (const t of candidates) {
        const est = parseEstimate(t);
        if (est) return {...defaultInfo, ...est};
    }
    if (subTitle) {
        const estSub = parseEstimate(subTitle);
        if (estSub) return {...defaultInfo, ...estSub};
    }

// D) Pas als niets gevonden: offered without reserve (subTitle)
    if (subTitle && /offered without reserve/i.test(subTitle)) {
        return {...defaultInfo, status: "offered_without_reserve", raw: subTitle};
    }

    return defaultInfo;
}
