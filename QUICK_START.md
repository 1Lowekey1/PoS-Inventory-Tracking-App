# PopPOS Quick Start

From zero to selling in about 5 minutes. Full details are in [README.md](README.md).

---

## 1. Open and install (once per device)

1. Open your PopPOS link, e.g. `https://<you>.github.io/<repo>/`.
2. Install it:
   - **Android:** Chrome menu ⋮ → *Install app*
   - **iPhone/iPad:** Safari Share → *Add to Home Screen*
   - **Laptop / mini PC:** install icon in the Chrome/Edge address bar
3. Open it from the home screen icon. From now on it works **without internet**.

> Just want to look around? Tap **Try a sample coffee menu** on the Sell screen, then turn on **Settings → Practice mode** to sell without starting an event.

---

## 2. Set up your menu (once)

### Ingredients (Stock tab → **+ Ingredient**)

| Field | Example | Notes |
|---|---|---|
| Name | Espresso beans | |
| Tracked / Untracked | Tracked | Choose **Untracked** for things like ice that you can't measure per cup |
| Unit | g | g, kg, ml, L, pcs, oz, shots, packs |
| Amount on hand now | 1000 | |
| Low stock alert at | 150 | Shows "Low" and a red badge on the Stock tab |
| Cost per unit *(optional)* | 430 per 500 g → 0.86 | Only used for estimated margins |

Add everything that goes into a drink: beans, milk, syrups, **cups and lids**.

Picked the wrong unit? Edit the ingredient and change it. **g ↔ kg** and **ml ↔ L** convert automatically (1 kg → 1,000 g, recipes included).

### Products (Menu → **+ Product**; on phones Menu is under **More**)

| Field | Example |
|---|---|
| Name | Iced Latte |
| Price | 120 |
| Category *(optional)* | Coffee |
| Recipe (per 1 drink) | 18 g Espresso beans · 180 ml Fresh milk · 1 pcs 16oz cups |
| Add-ons offered | Extra shot, Oat milk |

- Ingredient not created yet? Pick **＋ New ingredient…** at the bottom of the ingredient dropdown.
- Each row has a **unit picker**: milk stocked in L can be entered as **180 ml**. It starts on the small unit (ml / g). If an amount looks impossible, the editor warns you.
- Tick **Optional** on a recipe row for free extras some customers want, e.g. *15 ml Simple syrup* in an Iced Americano. It's only used when you tap it on the order.
- Use **Duplicate** to make a 22oz version quickly.

### Add-ons (Menu → Add-ons)

| Add-on | Price change | Ingredient change |
|---|---|---|
| Extra shot | +30 | +18 g beans |
| Oat milk | +25 | −180 ml fresh milk, +180 ml oat milk |
| Less sweet | 0 | *(none)* |

**Optional ingredient or add-on?** Free and just "with or without" (sweetener) → optional recipe row. Costs extra or swaps an ingredient (extra shot, oat milk) → add-on.

---

## 3. Event day

### Before opening

1. **Event tab → Start event**
   - Name, e.g. *Weekend Market*
   - **How many days?** 1 for a one-day pop-up, 2 for a weekend, and so on
   - **Capital**: what you spent up front, either one line with the total or itemised
   - **Planned output** *(optional)*: how many items you expect to sell. Shows the price you need to average to break even.
   - Leave **Open Day 1 now** ticked and enter your **starting cash** (float), e.g. ₱500
2. Did the amounts you brought differ from the app? **Stock → Stock count** and fix them.

Closed the form by accident? Open **Start event** again: what you typed is still there.

### While selling

| To do this | Do this |
|---|---|
| Sell | Tap products → **Charge** → choose Cash/GCash → **Complete sale** |
| Several of one item | Tap the tile several times, or **hold** it for quantity and add-ons |
| Sweet / with syrup | Tap the **+ Simple syrup** chip under that line (free) |
| Group order where some cups differ (e.g. 3 of 5 want syrup) | Tap the line → **Apply to** `3 of 5 cups` → pick syrup → **Update**. Repeat for other combinations |
| Almost every cup is different | Tap the line → **Split into single cups** → set each cup with its chips |
| Extra shot for someone who already paid | **+ Add-on** (top of the order) → pick their order # → charge it |
| Give change | Tap the bill the customer handed you (₱500…); change shows big |
| Mistake right after a sale | Tap **Undo** on the message at the top (shown for 5 seconds) |
| Mistake on an older sale | Orders → tap it → **Void** (stock goes back) |
| Remember who ordered what | Add a **Name / note** when charging; it shows in **To make** |
| Hand over a drink | Tap its chip in the **To make** strip |
| Bought ice / supplies | Event → **+ Expense** (tick *Paid from drawer* if you used till cash) |
| Ran to the store for more milk | Event → **Restock** → Milk → **Bought** → amount + cost |
| Made a new batch of syrup | Event → **Restock** → Syrup → **Made** → amount (sugar used is filled in from last time). Don't know the cost yet? Tick **I'll add the cost later** |
| Spilled / remade a drink | Stock → **Waste** |
| Same order again | **↻ #N** button in the empty order panel |

### Closing the day

1. **Event → Close day**
2. Count the cash and type it in. You'll see **over / short** against what's expected.
3. *(Recommended)* expand **Count leftover stock** and type real amounts.
4. Add a note (weather, crowd, what ran out).
5. Tap **Print summary** for a full-page summary on any printer (optional), and **Backup** to save the file somewhere safe.

More days to go? Next morning: **Event → Open day 2**.

### Ending the event

After the **last planned day**, the close-day screen offers **End event** (or **Add a day** if you're staying longer). You can also end it anytime from the Event tab once the day is closed. You'll land on the full report. Leftover stock stays for your next event.

Costs you marked *add later* show as **Cost pending**. Fill them in on the Event tab, or after the event in the event's report under **Costs still to enter**.

---

## 4. After the event

**Reports** tab:
- Pick the event and **All days** or a single day
- Net profit = Gross − (Capital + Expenses)
- Sales by hour (when to staff up), best sellers, payment split, ingredient usage, waste
- **CSV** for Excel / Google Sheets · **Print** for a paper copy

---

## Optional: receipt printer & cash drawer

Settings → **Receipt printer & cash drawer** → *USB (COM / serial)* (try first), *USB (direct)* or *Bluetooth* → **Test print** → **Open drawer**.
Works in Chrome/Edge on Windows, Android, ChromeOS and Mac. iPhone/iPad use the normal print dialog.

---

## Daily checklist

**Before:** ☐ Phone/tablet charged ☐ App opens offline ☐ Event started / day opened ☐ Float counted ☐ Stock count matches

**During:** ☐ Log ice/supply runs as expenses ☐ Log bought/made stock with Event → Restock ☐ Watch the *Low* badge on Stock

**After:** ☐ Close day with cash count ☐ Leftover stock counted ☐ **Backup downloaded** ☐ Note what sold out ☐ No **Cost pending** left (by the end of the event)
