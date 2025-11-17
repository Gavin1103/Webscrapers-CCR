import { promises as fs } from "fs";
import path from "path";

export const OUTPUT_DIR = path.join(process.cwd(), "scrape-output");

export function getAuctionSlugFromUrl(auctionUrl: string): string {
    const u = new URL(auctionUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const detailsIdx = parts.findIndex((p) => p === "details");
    const raw = detailsIdx >= 0 && parts[detailsIdx + 1] ? parts[detailsIdx + 1] : parts[parts.length - 1] || "auction";
    // decode + veilig maken als
    return decodeURIComponent(raw)
        .replace(/[/\\?%*:|"<>]/g, "-")
        .replace(/\s+/g, "-")
        .toLowerCase();
}

export function formatDateStamp(withTime = true): string {
    const now = new Date();
    const tz = "Europe/Amsterdam";

    const y = new Intl.DateTimeFormat("nl-NL", { timeZone: tz, year: "numeric" }).format(now);
    const m = new Intl.DateTimeFormat("nl-NL", { timeZone: tz, month: "2-digit" }).format(now);
    const d = new Intl.DateTimeFormat("nl-NL", { timeZone: tz, day: "2-digit" }).format(now);

    if (!withTime) return `${y}-${m}-${d}`;

    const hh = new Intl.DateTimeFormat("nl-NL", { timeZone: tz, hour: "2-digit", hour12: false }).format(now);
    const mm = new Intl.DateTimeFormat("nl-NL", { timeZone: tz, minute: "2-digit" }).format(now);
    return `${y}-${m}-${d}_${hh}-${mm}`;
}

export async function ensureDir(dir: string) {
    await fs.mkdir(dir, { recursive: true });
}

