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

export function outputPathForBase(baseUrl: string): string {
    const slug = auctionSlugFromUrl(baseUrl);
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
