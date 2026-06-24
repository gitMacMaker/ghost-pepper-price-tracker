const puppeteer = require("puppeteer");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1124M88x32AuUN9TzmE_dr4ot6Rnt1Gu62VYPnBHXgxE";
const SHEET_NAME = "Tracker";

const ITEMS = [
  { name: "Ghost Pepper Seed",   row: 2,  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Ghost%20Pepper%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "ghost pepper", exclude: ["super ghost", "robux", "roll", "fruit", "not a"] },
  { name: "Dragon Breath Seed",  row: 3,  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Dragon%20Breath%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "dragon breath", exclude: ["robux", "roll", "fruit", "breathe", "not a"] },
  { name: "Moon Bloom Seed",     row: 4,  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Moon%20Bloom%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "moon bloom", exclude: ["robux", "roll", "fruit", "not a"] },
  { name: "Venom Spitter Seed",  row: 5,  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Venom%20Spitter%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "venom spitter", exclude: ["robux", "roll", "fruit", "not a"] },
  { name: "Poison Apple Seed",   row: 6,  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Poison%20Apple%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "poison apple", exclude: ["robux", "roll", "fruit", "not a"] },
  { name: "Venus Fly Trap Seed", row: 7,  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Venus%20Fly%20Trap%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "venus fly trap", exclude: ["robux", "roll", "fruit", "not a"] },
  { name: "Bamboo Seed",         row: 8,  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Bamboo%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "bamboo", exclude: ["robux", "roll", "btc", "fruit", "not a"] },
  { name: "Mushroom Seed",       row: 9,  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Mushroom%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "mushroom", exclude: ["robux", "roll", "fruit", "not a"] },
  { name: "Pomegranate Seed",    row: 10, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Pomegranate%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "pomegranate", exclude: ["robux", "roll", "fruit", "not a"] },
];

const MIN_LEGIT_PRICE = 0.50;

async function getSheetClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function scrapeItem(page, item) {
  for (let pageIndex = 1; pageIndex <= 50; pageIndex++) {
    console.log(`  [${item.name}] Checking page ${pageIndex}...`);
    await page.goto(item.url + pageIndex, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));

    const results = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('a[href*="/oi/"]')];
      return cards.map(card => {
        const titleEl = card.querySelector('.offer-title');
        const priceEl = card.querySelector('.text-lg');
        const allText = card.textContent.replace(/\s+/g, ' ').trim();
        const minQtyMatch = allText.match(/min\.?\s*(?:qty\.?)?\s*:?\s*(\d+)/i) ||
                            allText.match(/minimum[:\s]+(\d+)/i) ||
                            allText.match(/x(\d+)\b/i);
        return {
          title: titleEl?.textContent.trim().toLowerCase() || '',
          price: priceEl ? parseFloat(priceEl.textContent.replace('$', '')) : null,
          minQty: minQtyMatch ? parseInt(minQtyMatch[1]) : 1,
        };
      }).filter(r => r.price && r.price > 0 && r.title);
    });

    if (results.length === 0) break;

    const filtered = results.filter(r => {
      const t = r.title;
      const keywords = item.keyword.toLowerCase().split(' ');
      const nameMatch = keywords.every(word => t.includes(word));
      const notExcluded = !item.exclude.some(ex => t.includes(ex));
      const totalCost = r.price * r.minQty;
      const withinBudget = r.minQty <= 10 || totalCost <= 20;
      const notScam = r.price >= MIN_LEGIT_PRICE;
      return nameMatch && notExcluded && withinBudget && notScam;
    });

    console.log(`  [${item.name}] Page ${pageIndex}: ${filtered.length} matching listings`);

    if (filtered.length > 0) {
      const cheapest = filtered.reduce((a, b) => a.price < b.price ? a : b);
      return { price: cheapest.price, minQty: cheapest.minQty };
    }
  }
  return null;
}

function getFormula(row, name) {
  if (name === "Bamboo Seed" || name === "Mushroom Seed") {
    return `=IF(B${row}="","",IF(B${row}<0.03,0.05,CEILING(IF(B${row}>10,B${row}*1.2,MAX(B${row},0.05)*1.5),0.1)))`;
  }
  return `=IF(B${row}="","",CEILING(IF(B${row}>10,B${row}*1.2,MAX(B${row},0.05)*1.5),0.1))`;
}

async function updateSheet(sheets, item, result) {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const priceData = [
    { range: `${SHEET_NAME}!B${item.row}`, values: [[result.price]] },
    { range: `${SHEET_NAME}!C${item.row}`, values: [[getFormula(item.row, item.name)]] },
    { range: `${SHEET_NAME}!D${item.row}`, values: [[`=IF(B${item.row}="","",C${item.row}-B${item.row})`]] },
  ];
  const rawData = [
    { range: `${SHEET_NAME}!E${item.row}`, values: [[`${result.minQty}`]] },
    { range: `${SHEET_NAME}!F${item.row}`, values: [[now]] },
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data: priceData },
  });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "RAW", data: rawData },
  });
}

async function run() {
  console.log(`[${new Date().toISOString()}] Starting seeds price check...`);
  const sheets = await getSheetClient();

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");

    for (const item of ITEMS) {
      console.log(`\nSearching for: ${item.name}`);
      const result = await scrapeItem(page, item);
      if (result) {
        console.log(`✅ ${item.name}: $${result.price.toFixed(2)}, min qty: ${result.minQty}`);
        await updateSheet(sheets, item, result);
      } else {
        console.log(`❌ ${item.name}: no listings found`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\n✅ Seeds done!");
}

run().catch(err => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
