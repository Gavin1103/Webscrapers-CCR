import { PRICE_SELECTORS } from "../constants/selectors.js";
import type { Page } from "puppeteer";

const CURRENCY_MAP: Record<string, string> = {
    "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "CHF": "CHF", "CAD": "CAD", "AUD": "AUD"
};

function mapCurrency(sym: string): string {
    return CURRENCY_MAP[sym] ?? sym;
}

export function parsePrice(raw: string): { value: number | null; currency: string | null } {
    const cur = raw.match(/(USD|EUR|GBP|JPY|CHF|CAD|AUD|[$€£¥])/);
    const currency = cur ? mapCurrency(cur[1]) : null;

    let num = raw.replace(/[^0-9.,]/g, "");
    num = num.replace(/(\d)[, ](?=\d{3}(\D|$))/g, "$1"); // 26,000 -> 26000

    if (num.includes(".") && num.includes(",")) {
        num = num.replace(/\./g, "").replace(",", ".");
    } else {
        if (/^\d{1,3}(,\d{3})+(,\d{2})?$/.test(num)) num = num.replace(/,/g, "");
        if (/^\d{1,3}(\.\d{3})+(\.\d{2})?$/.test(num)) num = num.replace(/\./g, "");
    }

    const value = num ? parseFloat(num) : null;
    return { value: Number.isFinite(value as number) ? (value as number) : null, currency };
}

// Leest zichtbare tekst + ::before/::after (ook in children) en parse't de prijs.
export async function extractPrice(page: Page): Promise<{ value: number | null; currency: string | null; raw: string | null }> {
    for (const sel of PRICE_SELECTORS) {
        const raw = await page.evaluate((selector) => {
            const root = document.querySelector(selector);
            if (!root) return null;

            const unq = (s: string | null) => (!s || s === "none" || s === "normal") ? "" : s.replace(/^['"]|['"]$/g, "");

            const parts: string[] = [];
            const pushNode = (node: Element) => {
                const cs = getComputedStyle(node);
                const b = unq(cs.getPropertyValue("content"));
                if (b) parts.push(b);
                const t = (node.textContent || "").trim();
                if (t) parts.push(t);
                const ab = unq(getComputedStyle(node, "::before").getPropertyValue("content"));
                const aa = unq(getComputedStyle(node, "::after").getPropertyValue("content"));
                if (ab) parts.push(ab);
                if (aa) parts.push(aa);
            };

            pushNode(root);
            root.querySelectorAll("*").forEach(pushNode);

            const s = parts.join(" ").replace(/\s+/g, " ").trim();
            return s || null;
        }, sel).catch(() => null);

        if (raw && /[$€£¥]|\d/.test(raw)) {
            const { value, currency } = parsePrice(raw);
            if (value !== null || currency !== null) return { value, currency, raw };
        }
    }

    // Fallback: globaal naar before/after prijzen zoeken
    const rawGlobal = await page.evaluate(() => {
        const unq = (s: string | null) => (!s || s === "none" || s === "normal") ? "" : s.replace(/^['"]|['"]$/g, "");
        const looksLikePrice = (s: string) => /(?:USD|EUR|GBP|JPY|CHF|CAD|AUD|[$€£¥])\s*[\d.,]/.test(s);
        const parts: string[] = [];
        document.querySelectorAll("body *").forEach((el) => {
            const b = unq(getComputedStyle(el, "::before").getPropertyValue("content"));
            const a = unq(getComputedStyle(el, "::after").getPropertyValue("content"));
            if (b && looksLikePrice(b)) parts.push(b);
            if (a && looksLikePrice(a)) parts.push(a);
        });
        const s = parts.join(" ").trim();
        return s || null;
    }).catch(() => null);

    if (rawGlobal) {
        const { value, currency } = parsePrice(rawGlobal);
        return { value, currency, raw: rawGlobal };
    }

    return { value: null, currency: null, raw: null };
}
