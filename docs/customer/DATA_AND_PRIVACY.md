# Your Data & Privacy in PopPOS

## The short version

- Everything you enter stays **on your device**, inside your browser.
- PopPOS has **no accounts, no servers and no cloud**. Nothing is uploaded, sold or shared.
- Because of that, **you** are responsible for backups. One backup file after each day is enough.

## What PopPOS stores

| Data | Example |
|---|---|
| Menu | Products, prices, recipes, categories, add-ons |
| Stock | Ingredient amounts and the history of every change |
| Events and days | Names, dates, cash float and cash counts, notes |
| Orders | Items, totals, discounts, payment method, an optional name/note |
| Money | Capital, expenses, restock costs |
| Settings | Business name, receipt text, payment methods, printer settings |

PopPOS does not ask for customer phone numbers, emails or card details. The optional **name / note** on an order (e.g. "Ana") is only for your queue. Keep it to first names or table numbers.

## Where it lives

- In the browser's storage (IndexedDB) on that one device.
- Installing the app (Add to Home Screen) makes the browser much less likely to clear it when the device is low on space. PopPOS asks the browser to protect its storage automatically.
- A **private/incognito window** forgets everything when it closes. Don't run events in one.
- Clearing your browser's site data for PopPOS **deletes** your PopPOS data on that device.

## Backups

| Action | Where |
|---|---|
| Back up | Settings → **Download backup**, or **Backup** after closing a day |
| Restore / move to a new device | Settings → **Restore / import file** (replaces what's on that device) |
| Export for spreadsheets | Reports → **CSV** (sales, expenses, stock movements) |

The backup is a `.json` file containing everything above. Treat it like a business record:
- Keep a copy off the device (Google Drive, email to yourself, USB stick).
- Only share it with people you'd show your sales figures to.

## Internet use

PopPOS needs the internet only to **download the app itself** (the first time, and when there's an update). Your sales and stock data are never sent online.

## Hardware access

When you connect a receipt printer, the browser asks permission to use that USB or Bluetooth device. PopPOS only uses it to print and to open the cash drawer.

## Deleting your data

Settings → Danger zone → **Erase everything on this device** (you'll be asked to type ERASE). Back up first if you might need the data again.
