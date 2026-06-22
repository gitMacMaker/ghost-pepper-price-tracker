const puppeteer = require("puppeteer");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1124M88x32AuUN9TzmE_dr4ot6Rnt1Gu62VYPnBHXgxE";
const SHEET_NAME = "Tracker";

const SEEDS = [
  { name: "Ghost Pepper Seed",    search: "Ghost Pepper Seed",    exclude: ["super ghost", "robux", "roll", "fruit"] },
  { name: "Dragon Breath Seed",   search: "Dragon Breath Seed",   exclude: ["robux", "roll", "fruit", "breathe"] },
  { name: "Moon Bloom Seed",      search: "Moon Bloom Seed",      exclude: ["robux", "roll", "fruit"] },
  { name: "Venom Spitter Seed",   search: "Venom Spitter Seed",   exclude: ["robux", "roll", "fruit"] },
  { name: "Poison Apple Seed",    search: "Poison Apple Seed",    exclude: ["robux", "roll", "fruit"] },
  { name: "Venus Fly Trap Seed",  search: "Venus Fly Trap Seed",  exclude: ["robux", "roll", "fruit"] },
  { name: "Bamboo Seed",          search: "Bamboo Seed",          exclude: ["robux", "roll", "btc", "fruit"] },
  { name: "Mushroom Seed",        search: "Mushroom Seed",        exclude: ["robux", "roll", "fruit"] },
  { name: "Pomegranate Seed",     search: "Pomegranate Seed",     exclude: ["robux", "roll", "fruit"] },
];

async function getSheetClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function scrapeCheapestPrice(page, seedName, searchQuery, excludeTerms) {
  const BASE_URL = `https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=${encodeURIComponent(searchQuery)}&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=`;

  for (let pageIndex = 1; pageIndex <= 8; pageIndex++) {
    console.log(`  [${seedName}] Checking page ${pageIndex}...`);
    await page.goto(BASE_URL + pageIndex, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));

    const results = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('a[href*="/oi/"]')];
      return cards.map(card => {
        const titleEl = card.querySelector('.offer-title');
        const priceEl = card.querySelector('.text-lg');
        return {
          title: titleEl?.textContent.trim().toLowerCase() || '',
          price: priceEl ? parseFloat(priceEl.textContent.replace('$', '')) : null,
        };
      }).filter(r => r.price && r.price > 0 && r.title);
    });

    if (results.length === 0) break;

    const filtered = results.filter(r => {
      const t = r.title;
      const keywords = seedName.toLowerCase().replace(' seed', '').split(' ');
      const nameMatch = keywords.every(word => t.includes(word)) && t.includes('seed');
      const notExcluded = !excludeTerms.some(ex => t.includes(ex));
      return nameMatch && notExcluded;
    });

    console.log(`  [${seedName}] Page ${pageIndex}: ${filtered.length} matching listings`);

    if (filtered.length > 0) {
      return Math.min(...filtered.map(r => r.price));
    }
  }

  return null;
}

async function setupSheet(sheets) {
  const headers = [["Item", "Lowest Price (USD)", "Your Price +50%", "Margin", "Last Updated"]];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:E1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: headers },
  });

  const seedNames = SEEDS.map(s => [s.name]);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:A${SEEDS.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: seedNames },
  });

  const formulas = SEEDS.map((_, i) => {
    const row = i + 2;
    const seedName = SEEDS[i].name;

    if (seedName === "Bamboo Seed" || seedName === "Mushroom Seed") {
      return [
        `=IF(B${row}="","",IF(B${row}<0.03,0.05,CEILING(MAX(B${row},0.05)*1.5,0.1)))`,
        `=IF(B${row}="","",C${row}-B${row})`
      ];
    }

    return [
      `=IF(B${row}="","",CEILING(MAX(B${row},0.05)*1.5,0.1))`,
      `=IF(B${row}="","",C${row}-B${row})`
    ];
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!C2:D${SEEDS.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: formulas },
  });
}

async function updateSheet(sheets, results) {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const data = [];

  results.forEach((price, i) => {
    const row = i + 2;
    if (price !== null) {
      data.push({ range: `${SHEET_NAME}!B${row}`, values: [[price]] });
      data.push({ range: `${SHEET_NAME}!E${row}`, values: [[now]] });
    }
  });

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });
  }
}

async function run() {
  console.log(`[${new Date().toISOString()}] Starting price check for ${SEEDS.length} seeds...`);

  const sheets = await getSheetClient();
  await setupSheet(sheets);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const results = [];

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");

    for (const seed of SEEDS) {
      console.log(`\nSearching for: ${seed.name}`);
      const price = await scrapeCheapestPrice(page, seed.name, seed.search, seed.exclude);
      if (price) {
        console.log(`✅ ${seed.name}: $${price.toFixed(2)}`);
      } else {
        console.log(`❌ ${seed.name}: no listings found`);
      }
      results.push(price);
    }

  } finally {
    await browser.close();
  }

  await updateSheet(sheets, results);
  console.log("\n✅ All done! Sheet updated.");
}

run().catch(err => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
