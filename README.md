# Ghost Pepper Price Tracker

Automatically scrapes the cheapest Ghost Pepper Seed price from Eldorado.gg every hour and updates a Google Sheet.

## Deploy to Render

1. Push this repo to GitHub
2. Go to render.com → New → Background Worker
3. Connect your GitHub repo
4. Add environment variable:
   - Key: `GOOGLE_SERVICE_ACCOUNT_JSON`
   - Value: paste the entire contents of your service account JSON file
5. Deploy
