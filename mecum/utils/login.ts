import type { Page } from "puppeteer";
import readline from "readline";

export async function isLoggedInOnWwwStrict(page: Page): Promise<boolean> {
    const mySel = ['a[href*="mymecum"]', 'a[href*="/account"]', '[aria-label*="My Mecum"]'];
    for (const sel of mySel) {
        const handle = await page.$(sel);
        if (handle) {
            const visible = await page.evaluate((el) => {
                const cs = getComputedStyle(el as HTMLElement);
                const r = (el as HTMLElement).getBoundingClientRect();
                return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
            }, handle);
            if (visible) return true;
        }
    }
    const loginSel = ['a[href*="/signin"]', 'a[href*="/login"]', 'a[href*="sign-up"]'];
    for (const sel of loginSel) {
        const h = await page.$(sel);
        if (h) {
            const visible = await page.evaluate((el) => {
                const cs = getComputedStyle(el as HTMLElement);
                const r = (el as HTMLElement).getBoundingClientRect();
                return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0;
            }, h);
            if (visible) return false;
        }
    }
    return false;
}

function waitForEnter(prompt = "▶ Druk op Enter zodra je bent ingelogd en de pagina is teruggekeerd…") {
    return new Promise<void>((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`${prompt}\n`, () => {
            rl.close();
            resolve();
        });
    });
}

/** Handmatige login-flow (opent landingUrl, wacht op login detectie of Enter). */
export async function pauseForManualLogin(page: Page, landingUrl: string) {
    await page.goto(landingUrl, { waitUntil: "networkidle0", timeout: 120_000 });

    await page.$("#onetrust-accept-btn-handler").then((b) => b?.click().catch(() => {}));
    await page.$('button[aria-label="Accept all"]').then((b) => b?.click().catch(() => {}));

    console.log("👉 Log handmatig in via de header (b.v. .NavButton_navButton__is4TD).");

    await Promise.race([
        (async () => {
            const deadline = Date.now() + 10 * 60_000;
            while (Date.now() < deadline) {
                if (await isLoggedInOnWwwStrict(page)) return;
                await new Promise((r) => setTimeout(r, 1000));
            }
        })(),
        waitForEnter()
    ]);
}
