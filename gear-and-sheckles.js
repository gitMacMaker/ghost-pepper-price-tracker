const puppeteer = require("puppeteer");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1124M88x32AuUN9TzmE_dr4ot6Rnt1Gu62VYPnBHXgxE";
const SHEET_NAME = "Tracker";

const GEAR = [
  { name: "Super Watering Can",  row: 24, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=other&searchQuery=super%20watering&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",     keyword: "super watering",    exclude: ["robux", "roll", "sprinkler", "not a", "mega"] },
  { name: "Super Sprinkler",     row: 25, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=other&searchQuery=super%20sprinkler&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",    keyword: "super sprinkler",   exclude: ["robux", "roll", "watering", "legendary", "not a", "mega"] },
  { name: "Legendary Sprinkler", row: 26, url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=other&searchQuery=legendary%20sprinkler&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "legendary sprinkler", exclude: ["robux", "roll", "watering", "rare", "not a", "mega"] },
];

const SHECKLES_ROW = 27;
const SHECKLES_URL = "https://www.eldorado.gg/grow-a-garden-2-sheckles/g/430?offerSortingCriterion=LowestMinQty";
const MIN_LEGIT_PRICE = 0.05;

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
      const notScam = r.price >= MIN_LEGIT_PRICE;
      const meetsMinRevenue = r.price >= 0.20 || totalCost >= 1;
      return nameMatch && notExcluded && withinBudget && notScam && meetsMinRevenue;
    });

    console.log(`  [${item.name}] Page ${pageIndex}: ${filtered.length} matching listings`);

    if (filtered.length > 0) {
      const cheapest = filtered.reduce((a, b) => a.price < b.price ? a : b);
      return { price: cheapest.price, minQty: cheapest.minQty, url: cheapest.href };
    }
  }
  return null;
}

async function scrapeSheckles(page) {
  console.log("\nSearching for: Sheckles");
  await page.goto(SHECKLES_URL, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));

  return await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const sellers = [];

    for (let i = 0; i < lines.length; i++) {
      const priceMatch = lines[i].match(/^\$([\d.]+)\s*\/\s*M$/);
      if (priceMatch) {
        let minQty = null, stock = null;
        for (let j = i; j < Math.min(i + 12, lines.length); j++) {
          if (lines[j] === 'Min. qty.') {
            const qtyMatch = lines[j+1]?.match(/^([\d,]+)\s*M$/);
            if (qtyMatch) minQty = parseInt(qtyMatch[1].replace(',', ''));
          }
          if (lines[j] === 'Stock') {
            const stockMatch = lines[j+1]?.match(/^([\d,]+)\s*M$/);
            if (stockMatch) stock = parseInt(stockMatch[1].replace(',', ''));
          }
        }
        if (minQty !== null && stock !== null) {
          sellers.push({ price: parseFloat(priceMatch[1]), minQty, stock });
        }
      }
    }

    const eligible = sellers
      .filter(s => s.minQty <= 100 && s.stock >= s.minQty)
      .sort((a, b) => a.price - b.price);

    return eligible[0] || null;
  });
}

async function updateSheet(sheets, row, result, isSheckles = false, sourceUrl = '') {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  let formula;
  if (isSheckles) {
    formula = `=IF(B${row}="","",CEILING(IF(B${row}>10,B${row}*1.2,MAX(B${row},0.005)*1.5),0.01))`;
  } else {
    formula = `=IF(B${row}="","",CEILING(IF(B${row}>10,B${row}*1.2,MAX(B${row},0.05)*1.5),0.1))`;
  }

  const priceData = [
    { range: `${SHEET_NAME}!B${row}`, values: [[result.price]] },
    { range: `${SHEET_NAME}!C${row}`, values: [[formula]] },
    { range: `${SHEET_NAME}!D${row}`, values: [[`=IF(B${row}="","",C${row}-B${row})`]] },
    { range: `${SHEET_NAME}!G${row}`, values: [[sourceUrl]] },
  ];

  const minQtyDisplay = isSheckles ? `${result.minQty}M` : `${result.minQty}`;
  const rawData = [
    { range: `${SHEET_NAME}!E${row}`, values: [[minQtyDisplay]] },
    { range: `${SHEET_NAME}!F${row}`, values: [[now]] },
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
  console.log(`[${new Date().toISOString()}] Starting gear & sheckles price check...`);
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

    for (const item of GEAR) {
      console.log(`\nSearching for: ${item.name}`);
      const result = await scrapeItem(page, item);
      if (result) {
        console.log(`✅ ${item.name}: $${result.price.toFixed(2)}, min qty: ${result.minQty}`);
        await updateSheet(sheets, item.row, result, false, result.url);
      } else {
        console.log(`❌ ${item.name}: no listings found`);
      }
    }

    const sheckles = await scrapeSheckles(page);
    if (sheckles) {
      console.log(`✅ Sheckles: $${sheckles.price}/M, min qty: ${sheckles.minQty}M`);
      await updateSheet(sheets, SHECKLES_ROW, sheckles, true, SHECKLES_URL);
    } else {
      console.log("❌ Sheckles: no eligible sellers found");
    }

  } finally {
    await browser.close();
  }

  console.log("\n✅ Gear & Sheckles done!");
}

run().catch(err => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
