# Testing PopPOS

There are two parts:

1. **Automated edge-case suite:** 53 tests of the money, stock and data logic. Takes about 2 seconds.
2. **Hands-on edge cases:** things only a person with a real phone, printer or bad Wi-Fi can check.

---

## 1. Automated edge-case suite

```bash
python devserver.py
```

Run it inside the `PopPOS` folder, then open **<http://localhost:5173/tests/>**. On GitHub Pages it's at `https://<you>.github.io/<repo>/tests/`.

The suite uses its own throwaway database and deletes it afterwards, so **your real data is never touched**. You should see **"All 53 edge cases passed"**. A failure shows the expected vs actual value.

| Area | What's covered |
|---|---|
| Selling & stock | exact recipe deduction · untracked items never deducted · no decimal drift (`0.1 + 0.2`) · add-on swap can't add stock · add-on pricing · selling past zero (allowed / blocked, no half-saves) · "N left" counts the cart · no sale without an open day · empty order refused · practice mode uses stock and puts it back · practice voids not double-restored |
| Extras & add-ons | optional ingredient only used when picked · optional rows ignored for "N left" and cost · add-on sold after paying (only adds stock, linked to order, not an extra item) · different extras stay on separate lines · group order 3-with-syrup + 2-plain keeps total and stock right · split single cups are regrouped at checkout |
| Units | recipe amount typed as 180 ml for milk stocked in L saves 0.18 L and sells correctly · kg → g converts stock, alert, cost, recipes, add-ons, history and later voids · non-convertible unit uses the amount you enter |
| Restock & costs | bought → expense (and drawer cash) · made → inputs used up, no double counting, batch recipe remembered · "add cost later" stays pending until filled, even after the event ended |
| Planned days | 1-day event is done after closing day 1 (no "Day 2") · extra day extends the plan |
| Cart & receipts | same item merges, empty cart drops its discount · "Apply to 3 of 5" keeps line order and merges back · split singles regroup at checkout · receipt rows fit the paper width, ₱ prints as P |
| Money | % discount rounding · discount bigger than the order · change never negative, none for GCash |
| Voids | restores the **sale-time** recipe after a recipe edit · double void · void an older order · void after the product was deleted |
| Events & days | one event / one open day / can't end with an open day · expected cash (float + cash − drawer expenses, ignoring GCash and voids) · close-day cash + stock counts · order numbering across days and events · reopening a day |
| Reports | profit = gross − (capital + expenses) · day report excludes capital, days add up to the event · products add up to gross with discounts · restock cost → expense, waste in usage |
| Data safety | can't delete an ingredient a recipe/add-on uses · deleted products keep names in reports · backup → restore round-trip · rejects non-PopPOS files · v2 import mapping · HTML/CSV escaping |

**Run it after every change** to `js/store/`, `js/reports.js`, `js/views/sell/cart.js`, `js/printing/` or `js/views/onboarding.js`.

---

## 2. Hands-on edge cases

Use **Settings → Practice mode** for selling tests where noted, or a throwaway event. Afterwards, Event → End event (or Settings → Danger zone → Erase everything if it was all test data).

Each item lists **what to do** and **what should happen** (✅).

### A. Rush hour at the counter

| # | Do | ✅ Expected |
|---|---|---|
| A1 | Tap the same tile 5 times quickly | One line with qty 5; tile shows a **5** badge; total updates every tap |
| A2 | Hold a tile ~½ s (right-click on laptop) | Options sheet with quantity and add-ons; it does **not** also add a plain item |
| A3 | Add a latte with Oat milk, then a plain latte | Two separate lines (different add-ons never merge) |
| A4 | Exact cash: Charge → Complete | Done in 2 taps; green message *Order #N · ₱… · Undo* |
| A5 | Charge ₱380, tap **₱500** | Change **₱120** shown large |
| A6 | Type cash received lower than the total and press Complete | Blocked with *"Cash received is less than the total"*; nothing saved |
| A7 | Double-tap **Complete sale** very fast | Only **one** order is created |
| A8 | Tap **Undo** on the sale message | Order voided, stock restored, message confirms |
| A9 | Laptop: press `1`, `1`, `3`, `Enter`, `Enter` | 2× product 1 + 1× product 3 sold as exact cash |
| A10 | Laptop: type in the search box, then press `1` | The digit goes into the search box, not the cart |
| A11 | Build an order, **close the browser tab**, reopen | The unfinished order is still there |
| A12 | Empty order → **Repeat #N** | Previous order's items re-added, including extras and add-ons (deleted products skipped) |
| A13 | Product with an *Optional* syrup row: add 1, tap **+ Simple syrup** under the line | Chip turns on (✓), price unchanged; after the sale only that cup used syrup |
| A14 | 5 × Iced Americano → tap the line → **Apply to** 3 of 5 → syrup → Update | Two lines: 2 plain + 3 with syrup; total unchanged (syrup is free) |
| A15 | Then tap the plain line → 1 of 2 → Extra shot → Update | Lines: 1 plain, 1 with extra shot, 3 with syrup; total +₱30 |
| A15b | Same as A14 but leave **All** | One line of 5, all with syrup |
| A15c | Tap a 3-cup line → **Split into 3 single cups** → turn syrup off on one → Charge | 3 single lines while editing; the order/receipt shows grouped lines (e.g. 2 × syrup, 1 × plain) |
| A15d | Apply changes that make a line identical to another line | The two lines merge into one (quantities added) |
| A16 | Toggle an extra on the first of several lines | The line stays in its place (doesn't jump to the bottom) |
| A17 | Sell order #1, then **+ Add-on** → *For order #1* → Extra shot ×2 → charge | New small order "Extra shot (for #1)" ₱60; 36 g beans used; queue shows it |
| A18 | Orders → open a paid order → **Add-on** | Goes to Sell with that order preselected in the add-on picker |
| A19 | Add-on picker: Oat milk for an order that's already made | Only oat milk is used; fresh milk is **not** put back |

### B. Stock surprises

| # | Do | ✅ Expected |
|---|---|---|
| B1 | Set Cups to 3, then add 3 lattes to the order | Tile badge counts down; shows **Out** at 0 in the cart |
| B2 | Sell a 4th latte with *Block sales when out of stock* **off** | Sale goes through; Cups shows **−1** and an **Out** badge |
| B3 | Same with the setting **on** | Error *"Not enough Cups"*; nothing saved |
| B4 | Oat milk add-on on a drink whose milk is **less** than the swap amount | Fresh milk stock does **not** go up |
| B5 | Sell drinks for 15+ min, then open Stock | "~X h left at today's pace" appears on used items |
| B6 | During an event: Stock → **Restock** on Milk | Opens the Event *Restock* form with Milk picked (not the old simple restock) |
| B7 | Restock with **no** event running | Simple restock: stock up, no cost asked (no event to charge it to) |
| B8 | Try to delete an ingredient used in a recipe or add-on | Refused; message lists where it's used |
| B9 | Close a day and count beans 30 g lower than the app says | Reports → Ingredient usage shows **Adj. −30** |
| B10 | Ingredient with 1 kg → Edit → unit **g** | Preview shows *1 kg → 1,000 g*; after saving: stock 1,000 g, alert and cost converted, recipes using it now in g |
| B11 | Then sell a drink using 18 g and void it | Stock goes 1,000 → 982 → 1,000 |
| B12 | Ingredient in **packs** → change unit to **pcs** | Warning that it can't convert; must type the amount in pcs; recipes listed to check |
| B13 | During an event, **Count** an item *higher* than the app shows | Asks *Log as restock* or *It's a correction*; restock opens the Restock form with the difference filled in |
| B14 | Duplicate a product, add a new ingredient to the copy from "＋ New ingredient…" and leave its amount blank | Asked "No amount on hand?" first; if saved with 0 the copy shows **Out**, and tapping it says "Not enough Caramel syrup (0 ml left)"; Menu list shows the same reason |
| B15 | Milk stocked in **L**. New product → recipe row → Milk | Unit picker shows **ml** (with L available); 180 ml saves and reopens as *180 ml*; switching to **L** shows "180 L Milk per item is more than you have in stock"; Cups shows a fixed *pcs* |

### C. Money & cash drawer

| # | Do | ✅ Expected |
|---|---|---|
| C1 | Open a day with ₱500 float; sell ₱380 cash + ₱264 GCash; log a ₱120 expense *paid from drawer*; close the day | Expected cash **₱760** (GCash not counted) |
| C2 | In C1, enter counted ₱750 | Shows **−₱10.00 short** live, then on the day summary and in Reports → Days |
| C3 | Void a cash sale, then close the day | Expected cash excludes the voided sale |
| C4 | Senior/PWD discount on ₱330 | −₱66.00, total ₱264.00 |
| C5 | Custom amount discount larger than the order | Total ₱0.00, never negative |
| C6 | Order → *Wrong payment method?* → switch Cash to GCash | Order updates; expected cash for the day drops accordingly |
| C7 | Start an event with capital ₱1,500 and planned output 50 | Hint: *average ₱30.00 per item* |
| C8 | Event → **Restock** → Milk → **Bought** 1,000 ml, ₱95, *paid from drawer* | Milk +1,000; ₱95 expense; expected cash drops by ₱95 |
| C9 | Event → **Restock** → Syrup → **Made** 1,000 ml from 700 g sugar, no cost | Syrup +1,000, sugar −700; **no** new expense (sugar was capital) |
| C10 | Next time: Restock → Syrup → Made → type 500 | "Made from" fills in **350 g sugar** automatically |
| C11 | Made something with **I'll add the cost later** | Entry shows **Cost pending**; Event tab warning; close-day and end-event mention it |
| C12 | End the event, open its report → **Costs still to enter** → enter ₱45 | Pending card disappears; net profit drops by ₱45 |

### D. Multi-day events

| # | Do | ✅ Expected |
|---|---|---|
| D1 | Sell on Day 1, close it, open Day 2, sell | Order numbers continue (#5, #6…); Reports has *Day 1 / Day 2 / All days* |
| D2 | Close Day 2 by mistake → **Reopen day 2** | Day open again; new sales count toward Day 2 |
| D3 | Try **End event** while a day is open | Not offered (only after closing the day) |
| D7 | Start a **1-day** event, sell, close the day | Close screen says it was the last planned day with **End event** / **Add a day**; Sell banner says *The day is closed* (never "Open day 2") |
| D8 | In D7 tap **Add a day** | Opens Day 2 and the plan becomes 2 days |
| D9 | Start a **2-day** event, close Day 1 | Offers *Open day 2* as normal; after Day 2 it offers *End event* |
| D4 | End the event | Lands on the full report; Event tab lists it under *Past events* |
| D5 | Start a second event | Order numbers restart at #1; Reports → *All events* compares both |
| D6 | Leave a day open overnight and reopen the app | Still open with the correct duration; sales keep counting to that day |

### E. Data safety & devices

| # | Do | ✅ Expected |
|---|---|---|
| E1 | Settings → Download backup → Erase everything → Restore the file | Everything back: menu, events, orders, stock |
| E2 | Restore a random `.json` file | *"Not a PopPOS or Booth POS backup file"*; nothing changed |
| E3 | Restore a **v2** `booth-data-*.json` | Ingredients/products added; sales imported as *Imported sales* |
| E4 | Product named `<b>Mocha, "Large"</b>` | Shows literally (no bold); CSV opens correctly in Excel/Sheets |
| E5 | Open PopPOS in a **private/incognito** window | Either works (and forgets on close) or shows the *Storage unavailable* help |
| E6 | Back up on phone → restore on a tablet | Tablet has identical data |
| E7 | Practice mode on → sell 2 lattes → check Stock → turn practice off | Stock **drops** during practice, then is **back to the original** after turning it off; practice orders never in Reports |
| E8 | Practice on → sell → do a real restock (no event) → practice off | Practice usage put back, the real restock kept |
| E9 | Start event → type a name and capital → close with ✕ → open Start event again | *"Restored what you typed earlier"*, fields filled; **Start fresh** clears them |
| E10 | Any form (product, expense, start event): tap the dark area outside it | Form stays open (only ✕ / Cancel / Esc close it) |

### F. Offline & updates (on the published GitHub Pages site)

| # | Do | ✅ Expected |
|---|---|---|
| F1 | Open once online, install it, then turn on **airplane mode** and open the app | Loads normally; status bar shows **Offline**; selling works |
| F2 | Sell while offline, close the app, reopen still offline | Sales are still there |
| F3 | Publish a change (bump `VERSION` in `sw.js`), open the app online | *"A new version is ready → Update"*; tapping it reloads into the new version, data intact |
| F4 | Leave the app open on the Sell screen during a day | Screen doesn't go to sleep (if *Keep screen on* is enabled) |

### G. Printer & cash drawer (Chrome/Edge, real hardware)

| # | Do | ✅ Expected |
|---|---|---|
| G0 | **No receipt printer:** close a day → **Print summary** | Print dialog shows a **full A4/Letter page**: headline numbers, sales, payments, cash drawer, expenses, products, event to date |
| G1 | Settings → USB (COM / serial) → pick the printer → **Test print** | Test slip prints and cuts |
| G2 | **Open drawer** | Drawer pops |
| G3 | Cash sale with *Open cash drawer on cash sales* on | Drawer pops on Complete; GCash sales don't open it |
| G4 | *Print receipts: Always* → sell | Receipt prints with items, add-ons, discount, change, `P` currency |
| G5 | Unplug the printer, then sell | Sale still completes; a printer error message shows (printing never blocks selling) |
| G6 | Restart the app with a USB printer | Status bar shows the printer icon (auto-reconnected) |
| G7 | 80 mm paper: switch paper width → Test print | Lines use the full width (48 columns) |
| G8 | iPhone/iPad → Orders → order → **Receipt** | System print dialog with a narrow receipt layout |
| G9 | Receipt printer connected → close a day | Both **Print summary** (full page) and **Receipt printer** (slip with totals) are offered |

### H. Layout

| # | Do | ✅ Expected |
|---|---|---|
| H1 | Phone portrait | Bottom nav; order total bar above it; tap the bar for the full order sheet |
| H2 | Tablet landscape / laptop | Side rail nav; order panel always visible on the right |
| H3 | Settings → Theme Dark/Light/Match device | All screens readable, including charts and badges |
| H4 | Settings → Tile size Large | Bigger tiles on Sell |
| H5 | Reports → Print | Clean page without nav or buttons |

---

## Reporting a problem

Note the test number (e.g. *C2*), the device and browser, what you did and what you saw. A screenshot plus a backup file (Settings → Download backup) makes it easy to reproduce.
