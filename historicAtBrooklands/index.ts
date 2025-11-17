import {collectLotLinks} from "./collectLotLinks";
import path from "path";
import {formatDateStamp, getAuctionSlugFromUrl} from "./helper/createFile";
import {promises as fs} from "fs";
import {collectLotDetails} from "./lotDetail";
import {createWriteStream, WriteStream} from "fs";

const auctions = [
    'https://www.historics.co.uk/auction/details/a064-flight-of-elegance-farnborough-international/?au=5',
    'https://www.historics.co.uk/auction/details/a065-the-summer-serenade-windsorview-lakes/?au=6',
    'https://www.historics.co.uk/auction/details/a066-pace-of-autumn-ascot-racecourse/?au=7',
    'https://www.historics.co.uk/auction/details/a067-the-brooklands-velocity-mercedes-benz-world/?au=84',
    'https://www.historics.co.uk/auction/details/w001-november-online-collectables-auction/?au=93',

    'https://www.historics.co.uk/auction/details/w002-festive-online-collectables-auction?au=94',
    'https://www.historics.co.uk/auction/details/w003-february-online-collectables-auction/?au=97',
    'https://www.historics.co.uk/auction/details/a068-symphony-of-spring-ascot-racecourse/?au=86',
    'https://www.historics.co.uk/auction/details/w004-march-online-collectibles-auction/?au=100',
    'https://www.historics.co.uk/auction/details/a069-flight-of-elegance-farnborough-international/?au=90',
    'https://www.historics.co.uk/auction/details/w006-online-collectibles--cherished-plates/?au=101',
    'https://www.historics.co.uk/auction/details/a070-the-summer-serenade-windsorview-lakes/?au=92',
    'https://www.historics.co.uk/auction/details/w008-online-collectibles/?au=103',
    'https://www.historics.co.uk/auction/details/a071-pace-of-autumn-ascot-racecourse/?au=91',
    'https://www.historics.co.uk/auction/details/w010-online-collectibles/?au=110'
]
const OUTPUT_DIR = path.join(process.cwd(), "scrape-output");

async function ensureDir(dir: string) {
    await fs.mkdir(dir, {recursive: true});
}

async function startScraping() {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await ensureDir(OUTPUT_DIR);

    for (const auctionUrl of auctions) {
        let jsonStream: WriteStream | null = null;
        let firstLot = true;

        try {
            const slug = getAuctionSlugFromUrl(auctionUrl);
            const stamp = formatDateStamp(false); // YYYY-MM-DD
            const fileName = `${slug}_${stamp}.json`;
            const filePath = path.join(OUTPUT_DIR, fileName);

            console.log(`Visiting auction page: ${auctionUrl}`);

            const lotLinks: string[] = await collectLotLinks(auctionUrl, page);
            console.log(`Collected ${lotLinks.length} lot links for ${slug}`);

            // open stream & header
            jsonStream = createWriteStream(filePath, {flags: "w"});
            const meta = {
                auction: auctionUrl,
                slug,
                scrapedAt: new Date().toISOString(),
                timezone: "Europe/Amsterdam",
                lot_links_count: lotLinks.length,
            };
            jsonStream.write('{"meta":');
            jsonStream.write(JSON.stringify(meta));
            jsonStream.write(',"lotDetails":[');

            console.log(`Start scraping details for each lot link - ${slug}`);

            for (const lotLink of lotLinks) {
                try {
                    const lotDetail = await collectLotDetails(lotLink, page);
                    const lotData =
                        lotDetail && typeof lotDetail === "object" ? lotDetail : {
                            error: true,
                            message: "No details returned"
                        };

                    if (!firstLot) jsonStream.write(",");
                    jsonStream.write("\n");
                    jsonStream.write(JSON.stringify({...lotData}));
                    firstLot = false;
                } catch (e: any) {
                    if (!firstLot) jsonStream.write(",");
                    jsonStream.write("\n");
                    jsonStream.write(
                        JSON.stringify({
                            url: lotLink,
                            error: true,
                            message: e?.message ?? String(e),
                        })
                    );
                    firstLot = false;
                }
            }

            // sluit array + object
            jsonStream.write("\n]}");
            jsonStream.end();

            console.log(`Saved: ${filePath}`);
        } catch (err) {
            console.error(`Error processing auction ${auctionUrl}:`, err);
            // probeer JSON netjes te sluiten als stream al open is
            if (jsonStream) {
                try {
                    // als er nog niets geschreven is, staat stream na '[' → sluit gewoon af
                    jsonStream.write("\n]}");
                    jsonStream.end();
                } catch {
                }
            }
        }
    }

    await browser.close();
}

startScraping().catch((err) => {
    console.error("Error during scraping:", err);
});