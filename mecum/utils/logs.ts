import fs from "fs";
import path from "path";
import { OUTPUT_DIR } from "../config.js";

const LOG_FILE = path.join(OUTPUT_DIR, "scrape-log.txt");

function ensureDir(p: string) {
    fs.mkdirSync(p, { recursive: true });
}

export function logMessage(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    ensureDir(path.dirname(LOG_FILE));
    fs.appendFileSync(LOG_FILE, line, "utf-8");
    console.log(msg);
}
