# PopPOS User Guide

A task-by-task guide to running your stall, pop-up or small café with PopPOS. If you only have five minutes, start with the [Quick Start](../../QUICK_START.md).

**Contents**
1. [The big picture](#1-the-big-picture)
2. [Setting up your menu](#2-setting-up-your-menu)
3. [Running an event](#3-running-an-event)
4. [Selling](#4-selling)
5. [Orders after the sale](#5-orders-after-the-sale)
6. [Stock during the day](#6-stock-during-the-day)
7. [Money: capital, expenses and profit](#7-money-capital-expenses-and-profit)
8. [Closing the day and ending the event](#8-closing-the-day-and-ending-the-event)
9. [Reports](#9-reports)
10. [Settings worth knowing](#10-settings-worth-knowing)
11. [Practice mode](#11-practice-mode)
12. [Keeping your data safe](#12-keeping-your-data-safe)

---

## 1. The big picture

PopPOS is built around **events**. An event is a market, fair, bazaar or pop-up that runs for one or more **days**.

```
Set up once:   Ingredients → Products (with recipes) → Add-ons
Every event:   Start event → Open day → Sell → Close day → (next day…) → End event
After:         Reports, compare events, export
```

- **Ingredients** are what you use (beans, milk, cups). PopPOS counts them down as you sell.
- **Products** are what you sell (Iced Latte). Each has a **recipe**: how much of each ingredient one item uses.
- **Add-ons** change a product (extra shot +₱30, oat milk +₱25).
- **Capital** is what you spent up front for the event. **Expenses** are what you buy during it.
- **Profit = Gross sales − (Capital + Expenses).**

Everything stays on your device and works without internet.

The screens: **Sell · Orders · Stock · Event · Reports**, plus **Menu** and **Settings**. On phones, Menu and Settings are under **More**.

---

## 2. Setting up your menu

### Ingredients (Stock → + Ingredient)

| Field | What to enter |
|---|---|
| **Name** | Espresso beans, Fresh milk, 16oz cups + lids |
| **Tracked / Untracked** | *Tracked* for anything you can measure per cup. *Untracked* for things like ice: no count, you only log what you spend |
| **Unit** | g, kg, ml, L, pcs, oz, shots, packs |
| **Amount on hand now** | What you have right now |
| **Low stock alert at** | When to warn you (e.g. 150 g beans) |
| **Cost per unit** *(optional)* | Enter pack price and pack size (₱430 for 500 g) and it works out ₱0.86/g. Only used for estimated margins |

**Changing a unit later:** g ↔ kg and ml ↔ L convert everything automatically, including recipes and history. For other changes (packs → pcs), PopPOS asks how much you have in the new unit and shows which recipes to check.

### Products (Menu → + Product)

1. **Name** and **price**.
2. **Category** (optional): becomes a tab on the Sell screen. **Tile colour** helps you find it fast.
3. **Recipe:** one row per ingredient, in amounts for **one** item.
   - Ingredient missing? Choose **＋ New ingredient…** at the bottom of the dropdown.
   - Tick **Optional** for free extras some customers want, e.g. *15 ml simple syrup* in an Iced Americano. It's only used when you tap it on the order.
4. **Add-ons offered:** which add-ons appear first for this product.
5. **Save.** The product list shows the estimated cost, the margin and "can make N more".

Tips: **Duplicate** makes sizes quickly (16oz → 22oz). The arrows reorder products; the order here is the order on the Sell screen. Switch a product off to hide it without deleting it.

### Add-ons (Menu → Add-ons)

| Example | Price change | Ingredient change |
|---|---|---|
| Extra shot | +30 | +18 g beans |
| Oat milk | +25 | −180 ml fresh milk, +180 ml oat milk |
| Less sweet | 0 | none |

Negative amounts *swap* an ingredient out. PopPOS never "gives back" more of an ingredient than the drink used.

**Optional row or add-on?** Free and simply with/without (sweetener) → optional recipe row. Costs extra or swaps something (shot, oat milk) → add-on.

---

## 3. Running an event

### Starting

**Event → Start event**:
- **Name**, location, start date
- **How many days?** 1 for a one-day pop-up, 2 for a weekend…
- **Planned output** (optional): items you expect to sell. PopPOS shows the price you need to average to break even.
- **Capital**: what you bought up front. One line with the total is fine, or list it.
- **Open Day 1 now** with your **starting cash** (float)

What you type is saved as you go. If the form closes by accident, open it again and it's all there.

### Each day

- **Open day N** in the morning (enter the float).
- Brought more stock than the app shows? Fix it with **Stock → Stock count**, or log the extra as a **Restock** so its cost is counted.
- **Close day** in the evening (see section 8).

After the last planned day, PopPOS offers **End event** or **Add a day**.

---

## 4. Selling

### The basics

1. Tap product tiles. Tapping the same tile again adds another.
2. Tap **Charge**.
3. Pick **Cash** (tap the bill the customer gave you, and the change shows big) or GCash / Maya / Card.
4. **Complete sale**.

An exact-cash sale is two taps after adding items. On a laptop: number keys `1`–`9` add products, then `Enter`, `Enter`.

Tiles show **"N left"** when stock is getting low, and **Out** when an ingredient has run out.

### Changing items

- **Hold a tile** (or right-click it) for quantity, optional extras and add-ons before adding it.
- Under each order line:
  - an **optional extra** chip (e.g. **+ Simple syrup**): one tap to include it, free
  - **+ Add-on**: opens the line editor
- **−** / **+** change the quantity.

### Group orders

A line stays grouped: *5 × Iced Americano*. When some cups are different:

1. Tap the line.
2. **Apply to** `3 of 5 cups`.
3. Pick syrup → **Update**.

The line becomes *3 × with syrup* and *2 × plain*. Repeat on any line for other combinations.

Almost every cup different? Tap the line → **Split into 5 single cups**, then set each cup with its chips. Identical cups are grouped again when you charge, so the receipt stays short.

### Other tools

| Tool | What it does |
|---|---|
| **Discount** | Senior/PWD 20%, Promo, or a custom % or amount |
| **Name / note** (when charging) | Shows in the *To make* queue, e.g. "Ana, less ice" |
| **↻ #N** | Adds the last order again |
| **+ Add-on** (top of the order) | Sells an add-on to someone who already paid, linked to their order number |
| **To make** strip | Orders waiting to be handed over. Tap one when it's done |

---

## 5. Orders after the sale

**Orders** lists today's sales (or the whole event's). Tap an order to:

- **Void** it, with a reason. Sales drop and the ingredients go back into stock.
- **Receipt**: print or reprint.
- Fix a **wrong payment method**.
- **Add-on**: add something the customer asked for after paying.
- **Mark made**.

Right after a sale, the message at the top has **Undo** for 5 seconds.

---

## 6. Stock during the day

The **Stock** tab shows every ingredient with a level bar, **Low** / **Out** badges, and "~1.5 h left at today's pace".

| Situation | What to do |
|---|---|
| Bought more milk | **Event → Restock** → Milk → **Bought** → amount and cost |
| Made a batch of syrup | **Event → Restock** → Syrup → **Made** → amount. The sugar used is suggested from last time and taken from stock |
| Don't know the cost yet | Tick **I'll add the cost later**. It shows as *Cost pending* until you fill it in |
| Spilled or remade a drink | Stock → **Waste** (pick a reason) |
| The number is just wrong | Stock → **Count** (type what you really have) |
| Check why a number changed | Tap the ingredient name for its full history |

During an event, the Restock button on the Stock tab opens the Event restock form, so costs always land in the event. If you count *more* than expected, PopPOS asks whether it was a restock or a correction.

---

## 7. Money: capital, expenses and profit

| | Example | Where |
|---|---|---|
| **Capital** | ₱1,500 of beans, milk, cups bought before the event | Start event, or Event → + Capital |
| **Expense** | ₱120 ice run, booth fee, transport | Event → + Expense |
| **Restock (bought)** | ₱95 for 1 L milk | Event → Restock (becomes an expense) |
| **Paid from drawer** | Tick it when you used till cash | Lowers the expected cash in the drawer |

**Profit = Gross sales − (Capital + Expenses).** The Event tab shows break-even progress live.

If you entered ingredient costs, reports also show an *estimated* margin per product. That's only a guide; the profit number above is the real one.

---

## 8. Closing the day and ending the event

**Event → Close day**:

1. Check the day's numbers.
2. **Count the cash** and type it in. PopPOS shows the expected amount (float + cash sales − cash paid out) and whether you're over or short.
3. *(Recommended)* **Count leftover stock**.
4. Add notes (weather, crowd, what sold out).
5. **Print summary** (a full page on any printer) and **Backup**.

After the last planned day: **End event**, or **Add a day** if you're staying longer. Ending takes you to the full report. Leftover stock stays for your next event.

Anything marked *Cost pending* can still be filled in after the event, in the event's report under **Costs still to enter**.

---

## 9. Reports

Pick an event, then **All days** or one day.

- **Headline numbers:** gross sales, capital + expenses, net profit or loss, average order, sales per hour
- **Break-even** and planned output progress
- **Sales by hour:** when you're busiest
- **Payment methods:** cash vs GCash etc., discounts, voids
- **Days:** each day's sales, expenses and cash difference
- **Products:** best sellers and add-on sales (plus estimated margins if you entered costs)
- **Capital & expenses** by category
- **Ingredient usage:** start, used, added, wasted, count adjustments, end
- **All events:** compare every event side by side

**Print** gives a clean page. **CSV** downloads sales, expenses and stock movements for Excel or Google Sheets.

---

## 10. Settings worth knowing

| Setting | Why |
|---|---|
| Business name, receipt line, footer | Shown on receipts and summaries |
| Payment methods | Turn on GCash / Maya / Card, or add your own |
| Order queue | The *To make* strip. Turn it off if you hand drinks over immediately |
| Block sales when out of stock | Off by default, because counts drift and you can see what's actually there |
| Warn when N left | When tiles start showing "N left" |
| Quick cash buttons | Your common bills |
| Discount presets | Your own % discounts |
| Tile size | Large tiles for tablets and busy hands |
| Receipt printer & cash drawer | See the [Hardware Guide](HARDWARE_GUIDE.md) |
| Keep screen on | Stops the device sleeping while a day is open |

---

## 11. Practice mode

**Settings → Practice mode** lets you sell without an event, for training a helper or trying out prices.

- Practice sales **do** use stock while it's on, so you see the real effect.
- When you turn it off, everything practice used is **put back**. Real changes you made meanwhile are kept.
- Practice orders never appear in reports. Delete them from Settings.

---

## 12. Keeping your data safe

Your data lives **only on the device** you use. There's no account and no cloud copy. Read [Data & Privacy](DATA_AND_PRIVACY.md) for details.

- **Back up after every day:** Close day → **Backup**, or Settings → **Download backup**. Save the file to Google Drive, email it to yourself, or copy it to a USB stick.
- **Moving to a new device:** back up on the old one → Settings → **Restore** on the new one.
- **Don't** use a private/incognito window. It forgets everything when closed.
