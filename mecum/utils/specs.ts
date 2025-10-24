import type { Page } from "puppeteer";

/** Haal de waarde op uit een kolom met een label/heading. */
export async function getSpecValue(page: Page, label: string): Promise<string | null> {
    return page.$$eval("div.wp-block-column", (columns, labelText) => {
        for (const col of columns) {
            const ps = col.querySelectorAll("p");
            if (ps.length >= 2) {
                const key = ps[0].textContent?.trim().toLowerCase();
                if (key === labelText.toLowerCase()) {
                    return ps[1].textContent?.trim() || null;
                }
            }
        }
        return null;
    }, label);
}
