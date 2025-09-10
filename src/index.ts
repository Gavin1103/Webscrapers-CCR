import { BASE_URLS } from "./config.js";
import { logMessage } from "./utils/logs";
import { runAllAuctions } from "./scraping/scrapeAuction.js";

async function main() {
    if (BASE_URLS.length === 0) {
        logMessage("⚠️ Geen BASE_URLS geconfigureerd in src/config.ts");
        return;
    }
    await runAllAuctions(BASE_URLS);
}

main().catch((e) => {
    logMessage(`🚨 Onverwerkte fout: ${e?.message ?? String(e)}`);
});
