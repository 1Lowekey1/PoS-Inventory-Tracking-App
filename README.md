# PopPOS v3

Offline point-of-sale and inventory for pop-ups, markets and small cafés. It's built so **one person can run the counter while making the drinks**, and it gives you detailed numbers during the event and after it.

- **Works offline.** Install it once from the web and it runs without internet. All data stays on the device.
- **Free to host.** Plain HTML/CSS/JavaScript with no build step, no server and no accounts. GitHub Pages hosts it for free.
- **Runs on anything.** Phone, tablet, laptop or a mini PC at a café counter, in portrait or landscape.
- **Receipt printer + cash drawer** support on Chrome/Edge (USB or Bluetooth ESC/POS printers).

> Coming from the old **Booth POS (v2)**? Read [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md). For a 5-minute setup see [QUICK_START.md](QUICK_START.md). To check the app yourself, see [TESTING.md](TESTING.md). User guides, launch material and team docs are in [docs/](docs/README.md).

---

## How it works

```
Setup (once)          Event (1 or more days)                 After
────────────          ──────────────────────                 ─────
Ingredients    →      Start event (capital)                  Full event report
Products +            ┌→ Open day (cash float)               Compare past events
  recipes             │   Sell · expenses · restock          CSV export
Add-ons               │   Close day (cash count, stock count) Fill in pending costs
                      └─ next day… → last planned day → End event
```

### Money: capital vs gross

Profit is calculated the way pop-ups actually buy stock:

```
Net profit = Gross sales − (Capital + Expenses)
```

| Term | What it is | Example |
|---|---|---|
| **Capital** | What you bought *up front* for the event | ₱1,500 for beans, milk, cups |
| **Expense** | Anything bought *during* the event | ₱120 for 2 bags of ice, booth fee |
| **Gross sales** | Total paid by customers after discounts, voids excluded | ₱4,820 |

Per-cup costing is **optional**. If you enter a unit cost for an ingredient, reports also show an *estimated margin per product* so you can see which drinks earn the most. That estimate never changes the profit number.

### Stock: tracked vs untracked

- **Tracked** ingredients (beans, milk, syrups, cups) are deducted automatically whenever a product that uses them is sold.
- **Untracked** items (ice, napkins) are things you can't measure per cup. They have no count. Log what you spend on them with **Log purchase** and the cost goes into expenses.
- **Optional** recipe rows (e.g. syrup in an Iced Americano) are free extras that are only used when you tap them on the order.
- **Units:** changing an ingredient between **g ↔ kg** or **ml ↔ L** converts everything: stock, alert level, cost, every recipe and add-on, and past history. 1 kg becomes 1,000 g, not "1 g". For other changes (packs → pcs) the app asks how much you have in the new unit.

#### Adding stock during an event: bought or made

While an event is running, stock is added through **Event → Restock** (the Stock tab's Restock button opens the same form), so its cost lands in the event:

| | Use it for | What happens |
|---|---|---|
| **Bought** | Ran out of milk and bought more | Stock goes up; what it cost becomes an expense (tick *paid from drawer* if it came from the till) |
| **Made** | Homemade syrup, cold brew, sauces | Stock goes up; the ingredients you used (e.g. 700 g sugar) are taken from stock. The app remembers the batch recipe and scales it next time |

The cost is optional. If you made it from stock you already paid for as capital, leave it blank and nothing is counted twice. If you'll only know the cost later, tick **"I'll add the cost later"**. It shows as **Cost pending** and you're reminded when closing the day, ending the event, and on the event's report, where you can fill it in even after the event has ended.

Outside an event (setting up), Restock simply adds stock. **Count** is for corrections. During an event, if you count *more* than expected, the app asks whether it was a restock (to record the cost) or a correction.

Every stock change is logged as a *movement* (sale, void, restock, waste, count adjustment), so you can always see why a number changed. Tap an ingredient's name on the Stock tab to see its history.

---

## Screens

| Tab | What you do there |
|---|---|
| **Sell** | Tap products into an order, then **Charge**. Each line has one-tap chips for optional extras and **+ Add-on**. Hold a tile (or right-click it) for quantity, extras and add-ons. **+ Add-on** at the top sells an add-on for an order that's already paid. The "To make" strip shows orders still to hand over. |
| **Orders** | Today's or the whole event's orders. Void any order (stock is restored), reprint, fix the payment method, mark as made, or add an add-on to it. |
| **Stock** | Levels with low/out alerts and "~1.5 h left at today's pace". Restock, Waste, Count, Stock count for everything at once, and full history per ingredient. |
| **Event** | Start an event (with number of days), open/close days, log capital, expenses and restocks (bought/made), see break-even progress, end the event, browse past events. |
| **Reports** | Any event, all days or one day: KPIs, break-even, sales by hour, payment split, products and add-ons, expenses, ingredient usage, all-events comparison, pending costs. Print or export CSV. |
| **Menu** | Products (price, category, colour, recipe with optional rows, add-ons), categories, add-ons. Shows estimated cost/margin and "can make N more". |
| **Settings** | Business/receipt text, payment methods, discounts, selling options, printer and drawer, theme, practice mode, backup/restore. |

On phones, **Menu** and **Settings** are under **More**.

### Selling, fast

- **Exact cash:** tap products → **Charge** → **Complete sale**. That's two taps after adding items.
- **Cash with change:** quick buttons for the next round amounts and your usual bills (₱100/200/500/1000). Change is shown large.
- **GCash / Maya / card / custom** methods can be switched on in Settings.
- **Undo:** every sale shows a toast with **Undo** for 5 seconds. After that, void it from Orders.
- **↻ #12** (in the empty order panel) re-adds the last order's items, useful for "same again".
- **Optional extras:** tap **+ Simple syrup** under a line to include it. It's free and only taken from stock when picked.
- **Group orders (cups that differ):** a line stays grouped ("5 × Iced Americano"). Tap the line, set **Apply to 3 of 5 cups**, pick syrup, then Update. It splits into *3 × with syrup* and *2 × plain*. Repeat on any line for other combinations (e.g. *1 of 2* with an extra shot). Lines that end up the same merge back together.
- **Very mixed orders:** in the same dialog, **Split into 5 single cups** gives every cup its own line and chips. Identical cups are grouped again when you charge, so the receipt, queue and reports stay tidy.
- **Add-on after paying:** tap **+ Add-on** (top of the order, or on the order in Orders), pick the order number and the add-on, then charge it as a small order. Only what the add-on adds is taken from stock.
- **Discounts:** Senior/PWD 20% and Promo 10% are preset. Add your own, or type a custom % or amount.
- **Name / note** on an order (e.g. "Ana, less ice") shows in the "To make" queue.

### Keyboard (laptop / mini PC)

| Key | Action |
|---|---|
| `1`–`9` | Add the Nth product on screen |
| `Enter` | Charge, then Enter again to complete |
| `Backspace` | Remove one of the last item |
| `Esc` | Clear the order / close a dialog |
| `/` | Search products |

### Practice mode

Settings → **Practice mode** lets you sell without an event, for training a helper or testing prices. Practice sales **do** use up stock while it's on, so you see exactly what would happen to your inventory. When you turn practice mode off, everything it used is put back automatically. Changes you made meanwhile, like a real restock, are kept. Practice orders never appear in reports. Delete them from Settings when you're done.

---

## Install & hosting (free)

### GitHub Pages

1. Put the contents of this folder at the root of your GitHub repository (the `.nojekyll` file must come along).
2. Repository → **Settings → Pages** → Source: *Deploy from a branch* → `main` / root → Save.
3. Open `https://<your-username>.github.io/<repo>/` on each device.

### Install on each device (makes it work offline)

| Device | How |
|---|---|
| Android (Chrome) | Menu ⋮ → **Install app** / **Add to Home screen** |
| iPhone / iPad (Safari) | Share → **Add to Home Screen** |
| Windows / Mac (Chrome/Edge) | Install icon in the address bar |

After the first visit, the app loads with no internet. When you publish a new version, the app shows **"A new version is ready → Update"** the next time it's opened online.

> **Publishing updates:** change `VERSION` in `sw.js` (e.g. `poppos-v3.2.1`) whenever you change any file. Otherwise devices keep the old cached copy. The full checklist is in [docs/internal/RELEASE_PROCESS.md](docs/internal/RELEASE_PROCESS.md).

### Running locally

```bash
python devserver.py
```

Run it inside this folder, then open <http://localhost:5173>. To use another port, run `python devserver.py 5174`. The edge-case tests are at <http://localhost:5173/tests/>. Any static file server works (`npx serve PopPOS`), but opening `index.html` directly as a file does **not** work, because browsers block JavaScript modules on `file://`. Offline caching is switched off on `localhost` so your edits show on reload. Add `?sw` to the URL to test offline mode locally.

---

## Receipt printer & cash drawer

| Connection | Works on | Use for |
|---|---|---|
| **USB (COM / serial)** | Chrome/Edge on Windows, Mac, ChromeOS, Linux | Most USB thermal printers. Try this first. |
| **USB (direct)** | Chrome/Edge, Android Chrome | Printers that don't show a COM port. On Windows the printer's own driver may need removing. |
| **Bluetooth** | Android Chrome, desktop Chrome | Cheap 58 mm BLE printers |
| **Browser print** (automatic fallback) | Everything, including iPhone/iPad | Any printer the device can print to |

- The **cash drawer** plugs into the printer's RJ11/RJ12 "DK" port. PopPOS opens it on cash sales (Settings → *Open cash drawer on cash sales*) and from the **Open drawer** button.
- Choose **58 mm** or **80 mm** paper. Receipts print `P` instead of `₱` because most printers lack the peso glyph; you can change this in Settings.
- **Print receipts:** *Only when I tap Receipt* (default), *Ask at each sale*, or *Always*.
- USB printers reconnect automatically when the app opens. Bluetooth needs a tap on **Bluetooth** after each app restart (a browser restriction).
- Receipts say *"This is not an official receipt."* PopPOS is not a BIR-accredited POS.
- **Day summaries** (Close day → *Print summary*) print as a normal **full page** (A4/Letter) on any printer, with headline numbers, sales, payments, cash drawer, expenses, products and event-to-date profit. If a receipt printer is connected there's also a *Receipt printer* button for a slip version.

iPhone and iPad browsers can't talk to USB or Bluetooth printers at all, so they always use the print dialog. For a printer + drawer setup, use an Android tablet, a Chromebook or a Windows mini PC.

---

## Your data

Everything is stored in the browser's IndexedDB **on that one device**. There is no cloud copy.

- **Backup:** Settings → *Download backup* (also offered every time you close a day). This saves a `.json` file. Keep it somewhere safe, e.g. Google Drive.
- **Restore / move to another device:** Settings → *Restore / import file*. A PopPOS backup **replaces** everything on the device. A v2 Booth POS backup is **added** to what's there.
- **CSV:** Reports → **CSV** downloads sales (one row per item), expenses and stock movements for Excel / Google Sheets.
- Private/incognito windows don't keep data. Installing the app and allowing persistent storage makes the browser much less likely to clear it.

### One device per event

Each event runs on one device. Every record carries an ID, timestamps and a device ID, so a local-network sync hub (e.g. a small helper on a café mini PC) can be added later without changing the data.

---

## Project structure

```
PopPOS/
├── index.html            App shell
├── manifest.webmanifest  Install metadata
├── sw.js                 Offline cache (bump VERSION on every release)
├── .nojekyll             Tells GitHub Pages to serve files as-is
├── devserver.py          Local no-cache server for development
├── css/app.css           All styles (light + dark, phone → desktop, print)
├── icons/                App icons
├── js/
│   ├── app.js            Boot, router, nav, status bar, keyboard, service worker
│   ├── store.js          The data API (index of js/store/*): start reading here
│   ├── store/            state, recipes, sales, stock, menu, events, backup
│   ├── reports.js        Report calculations
│   ├── printer.js        Printer class: receipts, summaries, cash drawer
│   ├── printing/         EscPos builder, USB/Serial/Bluetooth transports, documents
│   ├── db.js             IndexedDB wrapper (atomic multi-store writes)
│   ├── ui.js             Modal, FormDraft, forms, toasts, icons
│   ├── charts.js         SVG/HTML charts
│   ├── system.js         Theme, wake lock, version
│   ├── util.js           Numbers, formatting, CSV, downloads
│   └── views/            One file per screen; bigger screens have a helper folder
│                         (sell/cart.js = Cart class, sell/dialogs.js, event/*, stock/*)
├── tests/                Edge-case test page (see TESTING.md)
├── docs/                 Customer guides, launch material, internal docs (see docs/README.md)
├── README.md             This file
├── QUICK_START.md        5-minute setup + event-day routine
├── MIGRATION_GUIDE.md    Booth POS v2 → PopPOS v3, and updating between versions
└── TESTING.md            Automated + hands-on edge cases
```

New to the code? Read [docs/internal/ARCHITECTURE.md](docs/internal/ARCHITECTURE.md): folder map, which parts are classes and why, the data flow and the rules not to break.

### Data model (IndexedDB stores)

| Store | Key fields |
|---|---|
| `ingredients` | name, unit, tracked, stock, lowAt, unitCost?, batchRecipe? (for made items) |
| `products` | name, price, categoryId, color, recipe `[{ingredientId, qty, optional?}]`, modifierIds, active, sort |
| `modifiers` | name, priceDelta, recipe (negative qty = swap out) |
| `categories` | name, color, sort |
| `events` | name, location, status (active/closed), plannedDays, plannedOutput, startingStock, endingStock |
| `days` | eventId, index, status, openingCash, expectedCash, countedCash, openingStock, closingStock, notes |
| `orders` | number, eventId, dayId, items (with **recipe snapshot**, options, add-ons; or a standalone add-on `addonId` + `forOrder`), subtotal, discount, total, payment, status (paid/void), fulfilment, practice, practiceSession |
| `expenses` | eventId, dayId, kind (capital/expense), category, amount, paidFromDrawer, pending (cost not entered yet) |
| `movements` | ingredientId, delta, type (sale/void/restock/made/prep/waste/count/initial/practice/practice-revert), orderId, eventId, dayId |
| `settings` | single record `main` |

Orders store the recipe used at sale time, so a void restores exactly what was taken even if the recipe has changed since. Stock quantities are kept to 4 decimals (0.018 kg stays exact); money to 2.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page when opening `index.html` directly | Serve it (GitHub Pages or `python devserver.py`). Modules don't run from `file://`. |
| "Storage unavailable" | You're in a private window or an in-app browser (Facebook/Instagram). Open in Chrome/Safari normally. |
| Changes not showing after publishing | Bump `VERSION` in `sw.js`, then open the app online and tap **Update**. |
| Stock numbers drift from reality | Close-day stock counts and Stock → Count fix them. Big negative *Adj.* in reports means recipe amounts are lower than real use. |
| Printer not listed | Try the other USB option; check the printer is on; on Windows try USB (COM). Bluetooth: pair isn't needed, but the printer must not be connected to another phone. |
| Drawer doesn't open | The drawer is wired *through* the printer; connect the printer first. Use the **Open drawer** test button. |
| Can't start selling | Event tab → **Start event** (or **Open day N**). Or turn on Practice mode to try things out. |
| "Day closed" on the Sell screen | All planned days are done. Tap **End event**, or **Add a day** if the event continues. |
| Profit looks too high | Check for **Cost pending** entries (Event tab or the event's report) and fill them in. |
| Lost what I typed in Start event | It's saved as you type. Open Start event again and it's restored (tap *Start fresh* to clear it). |

---

## Changelog

**3.2.2**: clearer "Out"
- An "Out" product now says why: the tile (hover), a message when you tap it, and the Menu list name the ingredient that's short, e.g. "Out: Caramel syrup at 0 ml"
- Saving a new tracked ingredient with **Amount on hand** left blank now asks first, because it starts at 0 and makes every product using it show Out (this was behind "duplicated products show Out")

**3.2.1**: code clean-up for developers (no change to how the app works)
- Code reorganised: the data layer is split by topic (`js/store/`), printing into `js/printing/`, and big screens have helper folders
- Classes where they help: `Cart`, `Printer` with one `Transport` class per connection type, `EscPos`, `Modal`, `FormDraft`
- Long functions broken into named steps; comments rewritten to be short and say *why*
- Fixes found along the way: **Erase everything** now also clears the current order; the past-events table no longer counts add-ons sold on their own as extra items; the sales CSV now lists optional extras (e.g. syrup); the expenses CSV shows pending costs
- 4 new edge-case tests (51 in total) for the cart and receipt formatting

**3.2.0**: group orders
- Line editor: **"Apply to N of M cups"** counter (replaces *All / Just 1 cup*), e.g. 5 Americanos → 3 with syrup + 2 plain in one step
- **Split into single cups** for very mixed orders; identical cups are regrouped automatically at checkout

**3.1.0**: fixes and requests from the first round of hands-on testing
- Changing an ingredient's unit (g↔kg, ml↔L) converts stock, alert, cost, recipes, add-ons and history (it used to keep the number: 1 kg → "1 g")
- **Optional recipe ingredients** (e.g. syrup), free per-order chips on each order line
- Grouped order lines with **"Just 1 cup"** split for per-cup extras and add-ons; **+ Add-on** chip on each line
- **Sell an add-on after the order was paid** (from the Sell screen or the order itself), linked to the order number
- **"+ New ingredient…"** moved into the ingredient dropdown of the product editor
- **Practice mode** now uses stock while on and puts it all back when turned off
- **Start event** form saves as you type and restores after an accidental close; forms no longer close when you tap outside them
- **Restock moved into Event → Expense** during an event: *Bought* (cost becomes an expense) or *Made* (uses up ingredients, remembers the batch recipe). **"Add the cost later"** creates a *Cost pending* entry with reminders. Counting more than expected during an event asks if it was a restock
- **Day summary prints as a full page** on any printer (receipt-printer slip is optional)
- **Events have a number of days**. Closing the last day offers *End event* instead of asking for "Day 2"
- Stock quantities kept to 4 decimals (kg/L recipes stay exact); messages moved to the top of the screen so they never cover buttons

**3.0.0**: full rebuild
- Order cart with add-ons, quantities, discounts, notes, and a "To make" queue
- Multi-day events: open/close days with cash float, cash count and over/short
- Capital + mid-event expenses (cost-only items like ice)
- Payment methods (Cash, GCash, Maya, Card, custom) with change calculator
- Void any order with reason; stock is restored from the sale-time recipe snapshot
- Stock movement log: restock (with cost), waste (with reason), counts, full history
- Reports for any event or day: sales by hour, products, payments, expenses, ingredient usage, event comparison, CSV
- Receipt printer (ESC/POS over USB/Serial/Bluetooth) and cash drawer
- Installable offline PWA; IndexedDB storage; full backup/restore; v2 import
- Practice mode, keyboard shortcuts, dark mode, phone/tablet/desktop layouts
- Fixed from v2: the confirm dialog's Cancel button did nothing, "Reset Event" wiped live sales, backups missed event history, past events couldn't be viewed, stock showed float noise, `nojekyll.txt` was misnamed
