const puppeteer = require("puppeteer");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1124M88x32AuUN9TzmE_dr4ot6Rnt1Gu62VYPnBHXgxE";
const SHEET_NAME = "Tracker";

const ITEMS = [
  { name: "Unicorn",     row: 12, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&hotSearchQuery=Unicorn&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",    keyword: "unicorn",     exclude: ["robux", "roll", "not a", "mega"] },
  { name: "Raccoon",     row: 13, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&hotSearchQuery=Raccoon&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",    keyword: "raccoon",     exclude: ["robux", "roll", "not a", "mega"] },
  { name: "Dragonfly",   row: 14, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&hotSearchQuery=Dragonfly&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",  keyword: "dragonfly",   exclude: ["robux", "roll", "not a", "mega"] },
  { name: "Deer",        row: 15, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=deer&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",          keyword: "deer",        exclude: ["robux", "roll", "not a", "mega"] },
  { name: "Robin",       row: 16, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=robin&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",         keyword: "robin",       exclude: ["robux", "roll", "not a", "mega"] },
  { name: "Ice Serpent", row: 17, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=ice%20serpent&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "ice serpent", exclude: ["robux", "roll", "not a", "mega"] },
  { name: "Bee",         row: 18, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=bee&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",           keyword: "bee",         exclude: ["robux", "roll", "not a", "mega"] },
  { name: "Monkey",      row: 19, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=monkey&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",        keyword: "monkey",      exclude: ["robux", "roll", "not a", "mega"] },
  { name: "Turtle",      row: 20, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=turtle&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",        keyword: "turtle",      exclude: ["robux", "roll", "not a", "mega"], minPrice: 0.05 },
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
          href: card.href || '',
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
      const notScam = r.price >= (item.minPrice || MIN_LEGIT_PRICE);
      return nameMatch && notExcluded && withinBudget && notScam;
    });

    console.log(`  [${item.name}] Page ${pageIndex}: ${filtered.length} matching listings`);

    if (filtered.length > 0) {
      const cheapest = filtered.reduce((a, b) => a.price < b.price ? a : b);
      return { price: cheapest.price, minQty: cheapest.minQty, url: cheapest.href };
    }
  }
  return null;
}

async function updateSheet(sheets, item, result) {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const priceData = [
    { range: `${SHEET_NAME}!B${item.row}`, values: [[result.price]] },
    { range: `${SHEET_NAME}!C${item.row}`, values: [[`=IF(B${item.row}="","",CEILING(IF(B${item.row}>10,B${item.row}*1.2,MAX(B${item.row},0.05)*1.5),0.1))`]] },
    { range: `${SHEET_NAME}!D${item.row}`, values: [[`=IF(B${item.row}="","",C${item.row}-B${item.row})`]] },
    { range: `${SHEET_NAME}!G${item.row}`, values: [[result.url]] },
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
  console.log(`[${new Date().toISOString()}] Starting pets price check...`);
  const sheets = await getSheetClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!G1`,
    valueInputOption: "RAW",
    requestBody: { values: [["Eldorado Link"]] },
  });

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

  console.log("\n✅ Pets done!");
}

run().catch(err => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
