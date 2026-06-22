const puppeteer = require("puppeteer");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1124M88x32AuUN9TzmE_dr4ot6Rnt1Gu62VYPnBHXgxE";
const SHEET_NAME = "Tracker";
const BASE_URL = "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Ghost%20Pepper%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=";

async function getSheetClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function scrapePrice() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");

    let allGhostPepperPrices = [];

    // Scan pages 1-6 to find all Ghost Pepper Seed listings
    for (let pageIndex = 1; pageIndex <= 6; pageIndex++) {
      console.log(`Checking page ${pageIndex}...`);
      await page.goto(BASE_URL + pageIndex, { waitUntil: "networkidle2", timeout: 60000 });
      await new Promise(r => setTimeout(r, 4000));

      const results = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('a[href*="/oi/"]')];
        return cards.map(card => {
          const text = card.textContent.replace(/\s+/g, ' ').trim();
          const priceMatch = text.match(/\$([\d]+(?:\.\d{1,2})?)/);
          return {
            title: text.slice(0, 150),
            price: priceMatch ? parseFloat(priceMatch[1]) : null,
          };
        }).filter(r => r.price && r.price > 0);
      });

      // Filter: must include "ghost pepper" but exclude:
      // - "super ghost" (different item)
      // - "robux" listings (packs, not seeds)
      // - "pack" (multi-item bundles — price isn't per-unit)
      const ghostPepperListings = results.filter(r => {
        const t = r.title.toLowerCase();
        return t.includes('ghost pepper') 
          && !t.includes('super ghost')
          && !t.includes('robux')
          && !t.includes('roll');
      });

      console.log(`Page ${pageIndex}: found ${ghostPepperListings.length} Ghost Pepper Seed listings`);
      allGhostPepperPrices.push(...ghostPepperListings.map(r => r.price));

      // If page had prices well above $1.50, we've gone far enough
      const maxPrice = Math.max(...results.map(r => r.price));
      if (maxPrice > 1.50 && ghostPepperListings.length > 0) break;
    }

    if (allGhostPepperPrices.length === 0) return null;
    return Math.min(...allGhostPepperPrices);

  } finally {
    await browser.close();
  }
}

async function updateSheet(price) {
  const sheets = await getSheetClient();
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: `${SHEET_NAME}!B2`, values: [[price]] },
        { range: `${SHEET_NAME}!E2`, values: [[now]] },
      ],
    },
  });

  console.log(`✅ Sheet updated — lowest: $${price.toFixed(2)}, your price: $${(price * 1.5).toFixed(2)}`);
}

async function run() {
  console.log(`[${new Date().toISOString()}] Running price check...`);
  try {
    const price = await scrapePrice();
    if (price) {
      console.log(`Found lowest Ghost Pepper Seed price: $${price}`);
      await updateSheet(price);
    } else {
      console.log("❌ Could not find any Ghost Pepper Seed listings.");
      process.exit(1);
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
