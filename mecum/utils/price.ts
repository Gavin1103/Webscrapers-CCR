// price.ts
import type { Page } from "puppeteer";
import { PRICE_SELECTORS } from "../constants/selectors.js";

const CURRENCY_MAP: Record<string, string> = {
  "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "CHF": "CHF", "CAD": "CAD", "AUD": "AUD"
};
const PRICE_RE = /(?:USD|EUR|GBP|JPY|CHF|CAD|AUD|[$€£¥])\s?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?/;

function mapCurrency(sym: string): string {
  return CURRENCY_MAP[sym] ?? sym;
}

export function parsePrice(raw: string): { value: number | null; currency: string | null } {
  const cur = raw.match(/(USD|EUR|GBP|JPY|CHF|CAD|AUD|[$€£¥])/);
  const currency = cur ? mapCurrency(cur[1]) : null;

  let num = raw.replace(/[^0-9.,\s]/g, "");
  // verwijder spaties/komma’s die alleen duizendtallen scheiden (meerdere groepen toegestaan)
  num = num.replace(/(\d)[, ](?=\d{3}(\D|$))/g, "$1");

  if (num.includes(".") && num.includes(",")) {
    // EU-stijl: punt = duizend, komma = decimaal
    num = num.replace(/\./g, "").replace(",", ".");
  } else {
    // uniformeer duizendscheiding
    if (/^\d{1,3}(,\d{3})+(,\d{2})?$/.test(num)) num = num.replace(/,/g, "");
    if (/^\d{1,3}(\.\d{3})+(\.\d{2})?$/.test(num)) num = num.replace(/\./g, "");
  }

  const value = num ? parseFloat(num) : null;
  return { value: Number.isFinite(value as number) ? (value as number) : null, currency };
}

function unq(s: string | null) {
  return !s || s === "none" || s === "normal" ? "" : s.replace(/^['"]|['"]$/g, "");
}

async function ensurePriceLikelyVisible(page: Page) {
  // kleine scroll om lazy components te triggeren
  await page.evaluate(() => {
    const el = document.querySelector('[class*="PriceBadge"], [class*="priceBadge"], [data-testid*="price"]');
    if (el) el.scrollIntoView({ block: "center" });
    window.scrollBy(0, 200);
  }).catch(() => {});
}

export async function extractPrice(page: Page): Promise<{ value: number | null; currency: string | null; raw: string | null }> {
  await page.waitForSelector("body", { timeout: 15000 }).catch(() => {});
  await ensurePriceLikelyVisible(page);

  // 0) wacht tot er ergens prijs-achtige tekst verschijnt (niet alleen op 1 selector)
  try {
    await page.waitForFunction(
      (reSrc) => new RegExp(reSrc).test(document.body?.innerText || ""),
      { timeout: 8000 },
      PRICE_RE.source
    );
  } catch {}

  // 1) gerichte zoekactie op (brede) selectors
  for (const sel of PRICE_SELECTORS) {
    const raw = await page.$eval(sel, (el, reSrc) => {
      const re = new RegExp(reSrc);
      const texts: string[] = [];

      // eigen tekst
      const own = (el as HTMLElement).innerText || el.textContent || "";
      if (own) texts.push(own);

      // aria / data
      const aria = el.getAttribute("aria-label") || "";
      if (aria) texts.push(aria);
      texts.push(Array.from(el.attributes).map(a => a.value).join(" "));

      // pseudo content
      const before = getComputedStyle(el, "::before").getPropertyValue("content");
      const after  = getComputedStyle(el, "::after").getPropertyValue("content");
      if (before) texts.push(before);
      if (after)  texts.push(after);

      const joined = texts.map(s => s || "").join(" | ").replace(/\s+/g, " ").trim();
      const m = joined.match(re);
      return m ? m[0] : null;
    }, PRICE_RE.source).catch(() => null);

    if (raw) {
      const { value, currency } = parsePrice(unq(raw));
      if (value !== null || currency !== null) return { value, currency, raw: unq(raw) };
    }
  }

  // 2) body-scan (gewone innerText) — dit miste je nu
  const bodyHit = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc);
    const txt = document.body?.innerText || "";
    const m = txt.match(re);
    return m ? m[0] : null;
  }, PRICE_RE.source).catch(() => null);

  if (bodyHit) {
    const clean = unq(bodyHit);
    const { value, currency } = parsePrice(clean);
    return { value, currency, raw: clean };
  }

  // 3) pseudo global fallback (jouw bestaande idee behouden)
  const rawGlobal = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc);
    const parts: string[] = [];
    document.querySelectorAll("body *").forEach((el) => {
      const b = getComputedStyle(el, "::before").getPropertyValue("content");
      const a = getComputedStyle(el, "::after").getPropertyValue("content");
      const bu = b && b !== "none" ? b.replace(/^['"]|['"]$/g, "") : "";
      const au = a && a !== "none" ? a.replace(/^['"]|['"]$/g, "") : "";
      if (bu && re.test(bu)) parts.push(bu);
      if (au && re.test(au)) parts.push(au);
    });
    return parts[0] || null;
  }, PRICE_RE.source).catch(() => null);

  if (rawGlobal) {
    const clean = unq(rawGlobal);
    const { value, currency } = parsePrice(clean);
    return { value, currency, raw: clean };
  }

  // 4) JSON-LD fallback (offers.price)
  const jsonLd = await page.$$eval('script[type="application/ld+json"]', nodes => nodes.map(n => n.textContent || '').filter(Boolean)).catch(() => []);
  for (const raw of jsonLd) {
    try {
      const data = JSON.parse(raw);
      const arr = Array.isArray(data) ? data : [data];
      for (const item of arr) {
        const offers = item.offers || item.offer || item.aggregateOffer;
        const price = offers?.price ?? item.price;
        const currency = offers?.priceCurrency ?? item.priceCurrency ?? null;
        if (price != null) {
          const v = Number(String(price).replace(/[^\d.]/g, ""));
          if (Number.isFinite(v)) return { value: v, currency, raw: String(price) };
        }
      }
    } catch {}
  }

  return { value: null, currency: null, raw: null };
}
