# Architecture & Developer Guide

How PopPOS is put together and how to change it without breaking anything. Pair this with the data model in the [README](../../README.md#data-model-indexeddb-stores).

## Principles

1. **No build step, no dependencies.** Plain ES modules, served as static files. Anyone can open the code and edit it.
2. **Local-first.** IndexedDB on the device is the source of truth. The network is only used to fetch the app.
3. **One person behind the counter.** Selling must stay fast (≤ 2 taps for exact cash), forgiving (undo, void) and never blocked by a printer or a wrong stock count.
4. **Capital-vs-gross accounting.** Profit = gross − (capital + expenses). Per-unit costs are estimates only and never change profit.
5. **Every stock change is a movement.** Never overwrite stock silently; log why it changed.
6. **Sync-ready records.** Every record has `id`, `createdAt`, `updatedAt` and `deviceId`.

## Folder map

```
js/
├── app.js                  Boot, hash router, nav, status bar, keyboard, tooltip, service worker
├── store.js                The data API: an index that re-exports js/store/* (read this first)
├── store/
│   ├── state.js            S (all data), commit() / put() / del(), init, settings, lookups
│   ├── recipes.js          Recipes, prices, cart lines, totals, availability (pure)
│   ├── sales.js            checkout, voids, queue, practice mode
│   ├── stock.js            Ingredients, stock movements, restock (bought/made), unit conversion
│   ├── menu.js             Products, categories, add-ons
│   ├── events.js           Events, days, cash count, expenses
│   └── backup.js           Backup / restore / erase / bulk insert
├── reports.js              computeReport() and other read-only report maths
├── printer.js              Printer class + function shortcuts (printReceipt, openDrawer…)
├── printing/
│   ├── escpos.js           EscPos class: ESC/POS command builder
│   ├── transports.js       Transport classes: Serial, USB, Bluetooth
│   └── documents.js        Receipts & summaries as ESC/POS and HTML; print dialog
├── db.js                   IndexedDB wrapper (atomic multi-store writes)
├── ui.js                   Modal, FormDraft, formModal, confirmDialog, toast, icon, kpiHTML
├── charts.js               SVG / HTML charts
├── system.js               Version, theme, screen wake lock
├── util.js                 Numbers, formatting, CSV, downloads
└── views/                  One file per screen; helpers in a folder named after it
    ├── sell.js             Sell screen        sell/cart.js (Cart class), sell/dialogs.js
    ├── orders.js           Orders screen
    ├── stock.js            Stock screen       stock/ingredient-dialog.js
    ├── event.js            Event screen       event/start-event.js, event/days.js, event/expense-dialog.js
    ├── reports.js          Reports screen
    ├── menu.js             Menu screen
    ├── settings.js         Settings + phone "More" page
    └── onboarding.js       Welcome card, sample menu, Booth POS v2 import
```

**Rule of thumb:** business rules live in `store/` (and `reports.js` for read-only maths); screens never change data except through `store.*` calls; `store/` never touches the DOM.

## Where classes are used, and why

Classes are used where one object **owns state and behaviour together**. Plain functions are used where code just turns data into other data.

| Class | Owns | Why a class |
|---|---|---|
| `Cart` (`views/sell/cart.js`) | Lines, discount, saving to localStorage, change listeners | All the order-editing rules in one object. Testable without a screen: `new Cart()` with no storage key runs in memory |
| `Printer` (`printer.js`) | The current connection | Connect, reconnect, print and open the drawer all depend on that connection |
| `Transport` → `SerialTransport`, `UsbTransport`, `BluetoothTransport` | One device connection | Same interface (`request`, `reconnect`, `write`, `close`), so `Printer` doesn't care which. Adding a connection type = one subclass + one line in `TRANSPORTS` |
| `EscPos` (`printing/escpos.js`) | The bytes of one document | Chained builder: `.align('center').bold(true).line('Hi').cut()` |
| `Modal` (`ui.js`) | One open dialog and its result promise | Lifecycle (open, close, Esc, stack of open dialogs) in one place |
| `FormDraft` (`ui.js`) | A form's autosaved values | Reusable "don't lose what I typed" for any form |

The **store** stays as plain functions over one shared state (`S`). Each function is a self-contained business rule (`checkout`, `voidOrder`, `closeDay`), and keeping them as functions keeps the public API a flat, searchable list in `store.js`. **Reports** are pure functions of the data, with nothing to hold onto between calls.

## Data flow

1. A screen calls a store function, e.g. `store.checkout({...})`.
2. The store builds **ops** with `put(store, record)` / `del(store, id)` and calls `commit(ops)`.
3. `commit` writes them in **one IndexedDB transaction**, updates `S`, then notifies listeners.
4. `app.js` re-renders the status bar, nav and current screen. It skips the screen if the user is typing in it, so focus isn't lost.

Anything that must be all-or-nothing (a sale = order + movements + ingredient levels) goes through a single `commit`.

## Key rules

| Rule | Where | Why |
|---|---|---|
| A sale stores a **recipe snapshot** per item | `store/sales.js` `checkout` | Voids restore what was actually used, even after recipe edits |
| Stock changes go through `stockChange()` | `store/stock.js` | Always updates the ingredient **and** logs a movement |
| Combined recipe drops anything ≤ 0 | `store/recipes.js` `lineRecipe` | A swap add-on must never *add* stock |
| Optional recipe rows only count when picked | `lineRecipe(product, mods, optionIds)` | Free per-order extras |
| Standalone add-ons only use their positive rows | `addonRecipe` | Can't un-pour milk from a finished drink |
| Split cart lines carry `splitId`; checkout merges them | `lineKey`, `mergeLines` | Edit cups one by one, store them grouped |
| Practice movements carry `practiceSession`; `setPractice(false)` reverses them | `store/sales.js` | Practice shows the effect, then undoes it |
| Unit change g↔kg / ml↔L rescales everything | `store/stock.js` `saveIngredient` | Recipes, snapshots and history stay consistent |
| Quantities round to 4 dp (`rq`), money to 2 dp (`r2`) | `util.js` | 0.018 kg stays exact |
| Pending costs are expenses with `amount: 0, pending: true` | `restockIngredient`, `saveExpense` | Reminders until a cost is entered |
| `eventDaysDone` = no open day and days ≥ `plannedDays` | `store/events.js` | A 1-day event ends cleanly |
| Printing never throws into a sale | `Printer.afterSale` | A broken printer must not block selling |

## Adding a feature (checklist)

1. **Data:** new fields on existing records are fine (IndexedDB is schemaless). Give them safe defaults when reading old records.
2. **Logic** goes in the matching `store/*.js` module and is exported from `store.js`. Read-only maths goes in `reports.js`.
3. **UI** goes in the owning screen, or its helper folder once a dialog is big. Use `formModal` for forms (tapping outside doesn't lose input), `toast` for feedback, `esc()` for **every** user-provided string.
4. **Tests:** add cases to `tests/edge-cases.js` for money and stock effects, including a regression test for any bug you fix.
5. **Docs:** README (feature + data model), Quick Start (if the routine changes), [Release Notes](../customer/RELEASE_NOTES.md), TESTING.md.
6. **Offline:** new files must be added to `FILES` in `sw.js`, or the offline install fails.
7. **Release:** follow the [Release Process](RELEASE_PROCESS.md).

## Adding a new IndexedDB store

Add its name to `STORES` in `db.js` **and** bump `DB_VERSION` (`onupgradeneeded` only runs on a version change). Add it to `S` in `store/state.js`. Backups include every store automatically.

## Screens

Each screen exports `render(el, params)`. On a route change `app.js` gives it a **fresh** `<main id="view">`, so listeners attached once (guarded by `el.dataset.wired`) don't stack. Big screens build their HTML from small section functions that all take the same view object, e.g. `kpisHTML(v)` and `productsHTML(v)` in `views/reports.js`. The Sell screen redraws by region (banner, queue, categories, tiles, cart) and listens to `cart.onChange`.

## Printing

`Printer` holds the connection. Each document is built twice in `printing/documents.js`: as `EscPos` bytes for a thermal printer, and as HTML for the browser print dialog. Without a printer, receipts print at receipt width and day summaries print as a full A4/Letter page.

## Offline / updates

`sw.js` caches every file in `FILES` under `VERSION` and serves them cache-first. A new `VERSION` installs in the background; the app shows **Update**, which activates it and reloads. The service worker is skipped on `localhost` unless the URL contains `?sw`.

## Local development

```bash
python devserver.py
```

Run it in the PopPOS folder; pass a port to change it, e.g. `python devserver.py 5174`. The server disables caching. Tests are at `/tests/` and use a throwaway database (`db.useDatabase`).

## Code style

- Vanilla JS, ES modules, 4-space indent, single quotes, template strings for HTML.
- Escape every user string in templates with `esc()`.
- Private class members use `#`.
- Comments say **why** (or what isn't obvious from the name), never restate the code.
- One file per screen; when a dialog grows past ~100 lines, move it into the screen's folder.
- Keep screens free of business rules; keep `store/` free of DOM.
