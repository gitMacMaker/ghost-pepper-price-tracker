const puppeteer = require("puppeteer");
const { google } = require("googleapis");
const cron = require("node-cron");

const SPREADSHEET_ID = "1124M88x32AuUN9TzmE_dr4ot6Rnt1Gu62VYPnBHXgxE";
const SHEET_NAME = "Tracker";
const URL = "https://www.eldorado.gg/grow-a-garden-2-shop/i/430?gag2-items-type=seeds&hotSearchQuery=Ghost%20Pepper&offerSortingCriterion=Price&isAscending=true&gamePageOfferIndex=1&gamePageOfferSize=24";

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
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");

    console.log("Navigating to Eldorado...");
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait for price elements to load
    await page.waitForSelector("[class*='price'], [class*='Price'], [data-price]", { timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));

    const price = await page.evaluate(() => {
      // Try various selectors Eldorado might use
      const selectors = [
        "[class*='offerPrice']",
        "[class*='offer-price']",
        "[class*='price__value']",
        "[class*='Price']",
        "[class*='price']",
        "[data-price]",
      ];

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          const text = el.textContent.trim();
          const match = text.match(/[\$£€]?\s*([\d]+(?:\.\d{1,2})?)/);
          if (match) {
            const val = parseFloat(match[1]);
            if (val > 0 && val < 10000) return val;
          }
          const dataPrice = el.getAttribute("data-price");
          if (dataPrice) {
            const val = parseFloat(dataPrice);
            if (val > 0 && val < 10000) return val;
          }
        }
      }

      // Fallback: scan all text on the page for price patterns near "Ghost Pepper"
      const body = document.body.innerText;
      const lines = body.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes("ghost pepper")) {
          for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            const match = lines[j].match(/\$\s*([\d]+(?:\.\d{1,2})?)/);
            if (match) {
              const val = parseFloat(match[1]);
              if (val > 0 && val < 10000) return val;
            }
          }
        }
      }

      return null;
    });

    return price;
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

  console.log(`Sheet updated — lowest price: $${price.toFixed(2)}, your price: $${(price * 1.5).toFixed(2)}`);
}

async function run() {
  console.log(`[${new Date().toISOString()}] Running price check...`);
  try {
    const price = await scrapePrice();
    if (price) {
      console.log(`Found price: $${price}`);
      await updateSheet(price);
    } else {
      console.log("Could not find price on page.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

// Run immediately on startup
run();

// Then run every hour
cron.schedule("0 * * * *", run);

console.log("Price tracker running. Will check Eldorado every hour.");
