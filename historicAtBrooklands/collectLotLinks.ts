import { Page } from "puppeteer";
import {lotLinkClassName, nextPageButtonClassName} from "./classNames";

export async function collectLotLinks(url: string, page: Page, opts?: {
    maxPages?: number;
    waitForLotsTimeoutMs?: number;
}): Promise<string[]> {
    const { maxPages = 100, waitForLotsTimeoutMs = 30_000 } = opts ?? {};

    const seenLinks = new Set<string>();
    const visitedPageUrls = new Set<string>();

    const waitForLots = async () => {
        await page.waitForSelector(lotLinkClassName, { timeout: waitForLotsTimeoutMs });
    };

    const getNextHref = async (): Promise<string | null> => {
        const href = await page.$eval(
            nextPageButtonClassName,
            (el) => (el as HTMLAnchorElement).href || null
        ).catch(() => null);
        return href;
    };

    let pagesCrawled = 0;

    await page.goto(url, { waitUntil: "networkidle0", timeout: 120_000 });

    while (pagesCrawled < maxPages) {
        pagesCrawled++;

        await waitForLots();

        const links = await page.$$eval(lotLinkClassName, (els: Element[]) =>
            (els as HTMLAnchorElement[])
                .map((el) => (el as HTMLAnchorElement).href || el.getAttribute("href"))
                .filter(Boolean) as string[]
        );

        links.forEach((l) => seenLinks.add(l));

        // Markeer huidige pagina als bezocht
        const currentUrl = page.url();
        if (visitedPageUrls.has(currentUrl)) {
            // fail-safe tegen loops
            break;
        }
        visitedPageUrls.add(currentUrl);

        const nextHref = await getNextHref();
        if (!nextHref || sameUrl(nextHref, currentUrl) || visitedPageUrls.has(nextHref)) {
            break;
        }

        await page.goto(nextHref, { waitUntil: "networkidle0", timeout: 120_000 });
    }

    return Array.from(seenLinks);
}

function sameUrl(a: string, b: string): boolean {
    try {
        const ua = new URL(a);
        const ub = new URL(b);
        // normaliseer
        const norm = (u: URL) =>
            `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
        return norm(ua) === norm(ub);
    } catch {
        return a === b;
    }
}
