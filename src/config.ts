import path from "path";

export const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
export const MAX_PAGES = Number(process.env.MAX_PAGES ?? 200);

export const OUTPUT_DIR = String(process.env.OUTPUT_DIR ?? path.join(process.cwd(), "fetchedData"));
export const USER_DATA_DIR = String(process.env.USER_DATA_DIR ?? path.join(process.cwd(), "src", ".puppeteer-profile"));
export const HEADLESS = String(process.env.HEADLESS ?? "false") === "true";

// ⚠️ Vul hier je auctions in (of laad via JSON/DB indien gewenst)
export const BASE_URLS: string[] = [
    // 'https://www.mecum.com/auctions/kissimmee-2023/lots/?auction[0]=Kissimmee+2023|1672790400|1673740800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&year=1968:1968&make[0]=Volkswagen&page='
    // 'https://www.mecum.com/auctions/glendale-2023/lots/?auction[0]=Glendale+2023|1679961600|1680307200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&make[0]=Mercedes-Benz&year=2007:2007&model[0]=ML63&page='

    // "https://www.mecum.com/auctions/kissimmee-2023/lots/?auction[0]=Kissimmee+2023|1672790400|1673740800&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=",
    // "https://www.mecum.com/auctions/louisville-2019/lots/?auction[0]=Louisville+2019|1568937600|1569024000&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=",
    // 'https://www.mecum.com/auctions/las-vegas-2022/lots/?auction[0]=Las+Vegas+2022|1668038400|1668211200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
    'https://www.mecum.com/auctions/glendale-2023/lots/?auction[0]=Glendale+2023|1679961600|1680307200&configure[filters]=&configure[ruleContexts][0]=pin_items&sortBy=wp_posts_lot_sort_order_asc&type[0]=Auto&page=',
];

export const USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";
