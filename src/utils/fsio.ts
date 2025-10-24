import fs from "fs";
import path from "path";
import { todayISO } from "./time.js";
import { LotResult } from "../types.js";
import { OUTPUT_DIR } from "../config.js";

export function ensureDir(p: string) {
    fs.mkdirSync(p, { recursive: true });
}

export function auctionSlugFromUrl(urlStr: string): string {
    try {
        const u = new URL(urlStr);
        const m = u.pathname.match(/\/auctions\/([^\/?#]+)(?:[\/?#]|$)/);
        return m ? m[1] : "results";
    } catch {
        return "results";
    }
}

export function auctionSlugFromResultsUrl(urlStr: string): string {
    try {
        const u = new URL(urlStr);

        // Haal queryparam "auction[0]" op (bv. "Houston+2025|1743638400|1743811200")
        const auctionParam = u.searchParams.get("auction[0]");
        if (!auctionParam) return "results";

        // Neem alleen het deel voor de eerste '|'
        const slug = auctionParam.split("|")[0];

        // + en spaties -> _, lowercase
        return slug.replace(/\+/g, "_").replace(/\s+/g, "_").toLowerCase();
    } catch {
        return "results";
    }
}


export function outputPathForBase(baseUrl: string): string {
    const slug = auctionSlugFromResultsUrl(baseUrl);
    const date = todayISO();
    const filename = `${slug}_date_${date}.json`;
    ensureDir(OUTPUT_DIR);
    return path.join(OUTPUT_DIR, filename);
}

export function saveLotResult(outFile: string, lot: LotResult) {
    ensureDir(path.dirname(outFile));

    let current: LotResult[] = [];
    if (fs.existsSync(outFile)) {
        try {
            current = JSON.parse(fs.readFileSync(outFile, "utf-8"));
            if (!Array.isArray(current)) current = [];
        } catch {
            current = [];
        }
    }

    if (lot.lot_code && current.some((x) => x.lot_code === lot.lot_code)) {
        return; // duplicate lot_code -> skip
    }

    current.push(lot);
    fs.writeFileSync(outFile, JSON.stringify(current, null, 2), "utf-8");
}
