const puppeteer = require("puppeteer");
const { google } = require("googleapis");

const SPREADSHEET_ID = "1124M88x32AuUN9TzmE_dr4ot6Rnt1Gu62VYPnBHXgxE";
const SHEET_NAME = "Tracker";

const ITEMS = [
  // Seeds
  { name: "Ghost Pepper Seed",   url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Ghost%20Pepper%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "ghost pepper", exclude: ["super ghost", "robux", "roll", "fruit"] },
  { name: "Dragon Breath Seed",  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Dragon%20Breath%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "dragon breath", exclude: ["robux", "roll", "fruit", "breathe"] },
  { name: "Moon Bloom Seed",     url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Moon%20Bloom%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "moon bloom", exclude: ["robux", "roll", "fruit"] },
  { name: "Venom Spitter Seed",  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Venom%20Spitter%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "venom spitter", exclude: ["robux", "roll", "fruit"] },
  { name: "Poison Apple Seed",   url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Poison%20Apple%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "poison apple", exclude: ["robux", "roll", "fruit"] },
  { name: "Venus Fly Trap Seed", url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Venus%20Fly%20Trap%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "venus fly trap", exclude: ["robux", "roll", "fruit"] },
  { name: "Bamboo Seed",         url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Bamboo%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "bamboo", exclude: ["robux", "roll", "btc", "fruit"] },
  { name: "Mushroom Seed",       url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Mushroom%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "mushroom", exclude: ["robux", "roll", "fruit"] },
  { name: "Pomegranate Seed",    url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Pomegranate%20Seed&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "pomegranate", exclude: ["robux", "roll", "fruit"] },
  // Pets
  { name: "Unicorn",     url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&hotSearchQuery=Unicorn&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",    keyword: "unicorn",     exclude: ["robux", "roll"] },
  { name: "Raccoon",     url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&hotSearchQuery=Raccoon&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",    keyword: "raccoon",     exclude: ["robux", "roll"] },
  { name: "Dragonfly",   url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&hotSearchQuery=Dragonfly&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",  keyword: "dragonfly",   exclude: ["robux", "roll"] },
  { name: "Deer",        url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=deer&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",          keyword: "deer",        exclude: ["robux", "roll"] },
  { name: "Robin",       url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=robin&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",         keyword: "robin",       exclude: ["robux", "roll"] },
  { name: "Ice Serpent", url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=ice%20serpent&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "ice serpent", exclude: ["robux", "roll"] },
  { name: "Bee",         url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=bee&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",           keyword: "bee",         exclude: ["robux", "roll"] },
  { name: "Monkey",      url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=pets&searchQuery=monkey&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",        keyword: "monkey",      exclude: ["robux", "roll"] },
  // Gear
  { name: "Super Watering Can",  url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=other&searchQuery=super%20watering&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",     keyword: "super watering",    exclude: ["robux", "roll", "sprinkler"] },
  { name: "Super Sprinkler",     url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=other&searchQuery=super%20sprinkler&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=",    keyword: "super sprinkler",   exclude: ["robux", "roll", "watering", "legendary"] },
  { name: "Legendary Sprinkler", url: "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=other&searchQuery=legendary%20sprinkler&offerSortingCriterion=Price&isAscending=true&gamePageOfferSize=24&gamePageOfferIndex=", keyword: "legendary sprinkler", exclude: ["robux", "roll", "watering", "rare"] },
];

async function getSheetClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function scrapeItem(page, item) {
  for (let pageIndex = 1; pageIndex <= 8; pageIndex++) {
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
      return nameMatch && notExcluded;
    });

    console.log(`  [${item.name}] Page ${pageIndex}: ${filtered.length} matching listings`);

    if (filtered.length > 0) {
      const cheapest = filtered.reduce((a, b) => a.price < b.price ? a : b);
      return { price: cheapest.price, minQty: cheapest.minQty };
    }
  }

  return null;
}

async function scrapeShecklesPrice(page) {
  console.log("\nSearching for: Sheckles");
  await page.goto(
    "https://www.eldorado.gg/grow-a-garden-2-sheckles/g/430?offerSortingCriterion=LowestMinQty",
    { waitUntil: "networkidle2", timeout: 60000 }
  );
  await new Promise(r => setTimeout(r, 4000));

  const cheapest = await page.evaluate(() => {
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

    // Find cheapest seller where they have enough stock to fulfill their own minimum
   const eligible = sellers
  .filter(s => s.minQty <= 100 && s.stock >= s.minQty)
  .sort((a, b) => a.price - b.price);

    return eligible[0] || null;
  });

  if (cheapest) {
    console.log(`✅ Sheckles: $${cheapest.price}/M, min qty: ${cheapest.minQty}M`);
    return { price: cheapest.price, minQty: cheapest.minQty, isSheckles: true };
  }

  console.log("❌ Sheckles: no eligible sellers found");
  return null;
}

async function setupSheet(sheets) {
  const headers = [["Item", "Lowest Price (USD)", "Your Price +50%", "Margin", "Min Qty", "Last Updated"]];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:F1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: headers },
  });

  const allRows = [...ITEMS.map(s => [s.name]), ["Sheckles (per M)"]];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:A${allRows.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: allRows },
  });

  const formulas = allRows.map((s, i) => {
    const row = i + 2;
    const name = s[0];

    if (name === "Sheckles (per M)") {
      return [
        `=IF(B${row}="","",CEILING(MAX(B${row},0.005)*1.5,0.01))`,
        `=IF(B${row}="","",C${row}-B${row})`
      ];
    }
    if (name === "Bamboo Seed" || name === "Mushroom Seed") {
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
    range: `${SHEET_NAME}!C2:D${allRows.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: formulas },
  });
}

async function updateSheet(sheets, results) {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  const priceData = [];
  const rawData = [];

  results.forEach((result, i) => {
    const row = i + 2;
    if (result !== null) {
      priceData.push({ range: `${SHEET_NAME}!B${row}`, values: [[result.price]] });
      const minQtyDisplay = result.isSheckles ? `${result.minQty}M` : `${result.minQty}`;
      rawData.push({ range: `${SHEET_NAME}!E${row}`, values: [[minQtyDisplay]] });
      rawData.push({ range: `${SHEET_NAME}!F${row}`, values: [[now]] });
    }
  });

  if (priceData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data: priceData },
    });
  }

  if (rawData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: "RAW", data: rawData },
    });
  }
}

async function run() {
  console.log(`[${new Date().toISOString()}] Starting price check...`);

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

    for (const item of ITEMS) {
      console.log(`\nSearching for: ${item.name}`);
      const result = await scrapeItem(page, item);
      if (result) {
        console.log(`✅ ${item.name}: $${result.price.toFixed(2)}, min qty: ${result.minQty}`);
      } else {
        console.log(`❌ ${item.name}: no listings found`);
      }
      results.push(result);
    }

    const shecklesResult = await scrapeShecklesPrice(page);
    results.push(shecklesResult);

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
