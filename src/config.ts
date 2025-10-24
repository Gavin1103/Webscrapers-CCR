import path from "path";

export const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
export const MAX_PAGES = Number(process.env.MAX_PAGES ?? 200);

export const OUTPUT_DIR = String(process.env.OUTPUT_DIR ?? path.join(process.cwd(), "extraFields"));
export const USER_DATA_DIR = String(process.env.USER_DATA_DIR ?? path.join(process.cwd(), "src", ".puppeteer-profile"));
export const HEADLESS = String(process.env.HEADLESS ?? "false") === "true";
// ⚠️ Vul hier je auctions in (of laad via JSON/DB indien gewenst)
export const BASE_URLS: string[] = [
    // 'https://www.mecum.com/auctions/houston-2025/lots/?auction[0]=Houston+2025|1743638400|1743811200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
    // 'https://www.mecum.com/auctions/indy-2025/lots/?auction[0]=Indy+2025|1746748800|1747440000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
    // 'https://www.mecum.com/auctions/tulsa-2025/lots/?auction[0]=Tulsa+2025|1749168000|1749254400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
    // 'https://www.mecum.com/auctions/florida-summer-special-2025/lots/?auction[0]=Florida+Summer+Special+2025|1752019200|1752278400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
    // 'https://www.mecum.com/auctions/harrisburg-2025/lots/?auction[0]=Harrisburg+2025|1753228800|1753488000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
    // 'https://www.mecum.com/auctions/monterey-2025/lots/?auction[0]=Monterey+2025|1755129600|1755302400&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
    // 'https://www.mecum.com/auctions/larrys-legacy-2025/lots/?auction[0]=Larry%E2%80%99s+Legacy+2025|1758240000|1758412800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
    'https://www.mecum.com/auctions/indy-fall-special-2025/lots/?auction[0]=Indy+Fall+Special+2025|1759363200|1759536000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page='
];

export const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";