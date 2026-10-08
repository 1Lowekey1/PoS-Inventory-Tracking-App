# Migrating from Booth POS v2 to PopPOS v3

PopPOS v3 is a full rebuild of the Booth POS app. Your products, ingredients and past sales can come with you. Your v2 data is never modified or deleted by the import.

---

## What changed

| Area | Booth POS v2 | PopPOS v3 |
|---|---|---|
| Selling | One product per sale, quantity popup on every tap | Order with many items, add-ons, discount, note; 2 taps for exact cash |
| Payment | Always "cash" | Cash (with change), GCash, Maya, Card, custom methods |
| Events | One session; ending it hid the data | Multi-day events with open/close day, cash float and cash count |
| Costs | One fixed cost per event | **Capital** (up front) + **expenses** during the event (ice runs, fees) |
| Profit | Revenue − fixed cost | Gross − (capital + expenses), same model, plus optional per-product margin estimates |
| Undo | Last sale only, using the *current* recipe | Void **any** order; restores the recipe used **at sale time** |
| Stock | Number overwritten by edits | Logged movements: sale, void, restock (bought or made, with cost), waste (with reason), count |
| Recipes | Fixed list | Optional rows (e.g. syrup) picked per order, add-ons that add or swap ingredients |
| Units | Changing the unit kept the number | g↔kg and ml↔L convert everything automatically |
| Untracked items | Not possible | Ice etc. as cost-only items |
| Reports | Current session only; history stored but not viewable | Any past event or single day; hourly sales, products, payments, expenses, ingredient usage, comparison, CSV |
| Backup | Ingredients/products/current sales only; restore via browser console | Everything, one-tap backup and restore in Settings |
| Storage | `localStorage` | IndexedDB with persistent-storage request |
| Offline | Only if opened from a file | Installable app (PWA) with offline cache |
| Hardware | none | ESC/POS receipt printer + cash drawer |
| Demo mode | Separate demo sales | **Practice mode**: never counted in reports; uses stock while on and puts it back when turned off |

### v2 bugs that no longer exist
- The **Cancel** button in confirm dialogs did nothing.
- **Reset Event** on the Reports screen wiped the running event's sales.
- Undo after editing a recipe restored the wrong amounts.
- "Restock low items" added a made-up amount (threshold × 2).
- Stock showed float noise like `963.6999999 ml`.
- Ended events were saved but there was no screen to view them, and they weren't in backups.
- `nojekyll.txt` didn't work for GitHub Pages (v3 ships a correct `.nojekyll`).

---

## How data maps

| v2 | v3 |
|---|---|
| Ingredient `unit: "grams"` | `g` (`ml`, `pcs` unchanged) |
| Ingredient `totalQuantity` | Stock on hand (tracked ingredient) |
| Ingredient `lowStockThreshold` | Low stock alert |
| Ingredient `totalCost / totalQuantity` (very old versions) | Optional unit cost |
| Product `sellingPrice` | Price |
| Recipe `quantity` | Recipe `qty` |
| Product `active` | "Show on Sell screen" |
| Each ended event (history) | A **closed** event with one day |
| Running event | A **running** event with Day 1 open (or closed, if v3 already has a running event). Planned days = 1; use *Add a day* if it continues |
| Event `fixedCost` | A **Capital** entry |
| Event `plannedOutput` | Planned output |
| Each sale (`quantity` × product) | An order with one line (qty × unit price), paid in **Cash** |
| Demo-mode sales | **Not imported** |
| Starting/ending inventory snapshots | Event starting/ending stock (feeds the ingredient usage table) |

**Not carried over:** demo sales, theme/demo settings, and payment types (v2 only had cash). Order numbers are assigned in time order per event.

---

## Option A: same website (automatic)

Use this if v3 is published at **the same address** as v2 (e.g. you replace the files in the same GitHub Pages repo). Both versions then share the browser's storage, so v3 can see your v2 data.

1. **First, back up v2:** in the old app, Reports → **💾 Backup Data**. Keep that file.
2. Replace the repository files with the contents of the `PopPOS/` folder (see *Deploying* below).
3. Open the site on the device that has your v2 data.
4. Tap **Import from old Booth POS**. It's on the Sell screen while the menu is empty, and always under Settings → Data & backup.
5. Check the summary ("Found 12 ingredients, 9 products, 3 events, 412 sales") → **Import**.

The button disappears once imported, so you can't import twice by accident.

## Option B: from a v2 backup file

Use this for a different device or address, or if Option A doesn't show the button.

1. In the old app: Reports → **💾 Backup Data** → you get `booth-data-YYYY-MM-DD.json`.
2. In PopPOS: Settings → **Restore / import file** → pick that file → **Import**.

> v2 backup files only contain ingredients, products and the **current** sales (not past events). Those sales are imported as one event called *Imported sales*. To bring past events too, use Option A on the original device.

---

## After importing: checklist

1. **Stock tab:** check the amounts. Mark things like ice as **Untracked** (Edit → Untracked).
2. **Menu:** add categories and colours, set up add-ons (oat milk, extra shot), re-order products.
3. **Settings:** business name and receipt text, turn on GCash/Maya, set quick-cash bills.
4. **Reports:** open an imported event and compare the gross with what v2 showed.
5. **Settings → Download backup** to save your first v3 backup.

---

## Deploying v3 to your existing GitHub Pages repo

```bash
cd PoS-Inventory-Tracking-App
git checkout -b v3
```

1. Delete the old `index.html`, `app.js`, `styles.css` and `nojekyll.txt`.
2. Copy everything from `PopPOS/` into the repo root, **including the hidden `.nojekyll` file**.
3. Commit and push, then merge to `main` when you're happy:

```bash
git add -A
git commit -m "PopPOS v3"
git push -u origin v3
```

GitHub Pages serves `main`, so the site updates when `v3` is merged. The site address stays the same, which is what Option A relies on.

### Keeping v2 around (optional)

To run both side by side for a while, put v2 in a subfolder (e.g. `/v2/`) of the same repo. It's still the same site address, so v3 can still import its data. Remove it once you're confident.

### Updating PopPOS later (e.g. 3.1 → 3.2)

1. Copy the new files over the old ones in the repo, including `sw.js` (its `VERSION` changes with every release).
2. Commit and push.
3. Open the app online on each device. When it shows **"A new version is ready → Update"**, tap **Update**.

Your data stays on each device and upgrades itself, so no import is needed. Notes for **3.0 → 3.1**:
- Events started in 3.0 count as **1-day** events. If one was running over several days, open **Event → Edit → How many days?**, or just use **Add a day**.
- If practice mode was on during the update, practice sales made under 3.0 didn't use stock, so there's nothing to put back. From 3.1 on, practice sales use stock and turning practice off restores it.
- A half-built order in the cart carries over.

Notes for **3.1 → 3.2**: nothing to do. Group-order editing (*Apply to N of M cups*, *Split into single cups*) works on existing carts and menus.

### Rolling back

Your v2 data is untouched, so rolling back is just restoring the old files with `git revert` or checking out the previous commit. Anything sold in v3 stays in v3 (back it up from v3's Settings first).

---

## FAQ

**Will the import double-count stock?**
No. Stock comes from v2's current amounts. Imported sales don't deduct again.

**My imported event shows a loss.**
v2's fixed cost becomes capital. If you also bought things mid-event, add them as expenses on that event for a truer profit.

**Can I import into a PopPOS that already has data?**
Yes. Imported records are added alongside. If you're already running an event in v3, the imported running event is saved as closed (only one event can run at a time).
