// Edge-case tests for PopPOS business logic.
// Open tests/index.html from the same server as the app (e.g. http://localhost:5173/tests/).
// Each test starts from an empty throwaway database.

import * as db from '../js/db.js';
import * as store from '../js/store.js';
import { S, byId } from '../js/store.js';
import { computeReport } from '../js/reports.js';
import { convertV2 } from '../js/views/onboarding.js';
import { esc, toCSV, r2 } from '../js/util.js';
import { Cart } from '../js/views/sell/cart.js';
import { readAmount, shownAmount } from '../js/views/unit-amount.js';
import { EscPos } from '../js/printing/escpos.js';

const tests = [];
const test = (name, why, fn) => tests.push({ name, why, fn });

// ---------- tiny assert kit ----------
class Fail extends Error {}
const eq = (actual, expected, msg = '') => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Fail(`${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const ok = (cond, msg) => { if (!cond) throw new Fail(msg); };
const rejects = async (fn, pattern, msg) => {
    try { await fn(); } catch (e) {
        if (pattern && !pattern.test(e.message)) throw new Fail(`${msg}: wrong error "${e.message}"`);
        return;
    }
    throw new Fail(`${msg}: expected an error, none thrown`);
};

// ---------- fixtures ----------
async function fresh() {
    await store.eraseEverything();
}

/** Coffee setup: beans 1000 g, milk 2000 ml, oat 1000 ml, cups 10, ice untracked. */
async function setup() {
    await fresh();
    const beans = await store.saveIngredient({ name: 'Beans', unit: 'g', tracked: true, stock: 1000, lowAt: 100, unitCost: 0.8 });
    const milk = await store.saveIngredient({ name: 'Milk', unit: 'ml', tracked: true, stock: 2000, lowAt: 300, unitCost: 0.1 });
    const oat = await store.saveIngredient({ name: 'Oat', unit: 'ml', tracked: true, stock: 1000, lowAt: null, unitCost: null });
    const cups = await store.saveIngredient({ name: 'Cups', unit: 'pcs', tracked: true, stock: 10, lowAt: 3, unitCost: 5 });
    const ice = await store.saveIngredient({ name: 'Ice', unit: 'bags', tracked: false, stock: 0 });
    await store.saveProduct({ name: 'Latte', price: 120, active: true, modifierIds: [], recipe: [
        { ingredientId: beans.id, qty: 18 }, { ingredientId: milk.id, qty: 150 }, { ingredientId: cups.id, qty: 1 }, { ingredientId: ice.id, qty: 1 }
    ] });
    await store.saveProduct({ name: 'Americano', price: 90, active: true, modifierIds: [], recipe: [
        { ingredientId: beans.id, qty: 18 }, { ingredientId: cups.id, qty: 1 }
    ] });
    await store.saveModifier({ name: 'Oat swap', priceDelta: 25, recipe: [{ ingredientId: milk.id, qty: -180 }, { ingredientId: oat.id, qty: 180 }] });
    const latte = S.products.find((p) => p.name === 'Latte');
    const americano = S.products.find((p) => p.name === 'Americano');
    const oatSwap = S.modifiers[0];
    return { beans, milk, oat, cups, ice, latte, americano, oatSwap };
}

const line = (product, qty = 1, modifierIds = [], optionIds = []) => ({ productId: product.id, qty, modifierIds, optionIds });
const addonLine = (mod, qty = 1, forOrder = null) => ({ addonId: mod.id, qty, forOrder });
const stock = (ing) => byId('ingredients', ing.id).stock;
const sell = (lines, method = 'cash', tendered = 0, discount = null) => store.checkout({ lines, method, tendered, discount });
const startDay = async (capital = 1000, openingCash = 500) =>
    store.startEvent({ name: 'Test Fair', capitalItems: [{ description: 'Stock', amount: capital }], openingCash });

// ======================================================================
// Selling & stock
// ======================================================================

test('Sale deducts the exact recipe amounts', 'Core promise: stock follows sales.', async () => {
    const f = await setup();
    await startDay();
    await sell([line(f.latte, 2)]);
    eq(stock(f.beans), 964, 'beans');
    eq(stock(f.milk), 1700, 'milk');
    eq(stock(f.cups), 8, 'cups');
});

test('Untracked ingredient in a recipe is never deducted', 'Ice is cost-only; it has no count to go down.', async () => {
    const f = await setup();
    await startDay();
    await sell([line(f.latte)]);
    eq(stock(f.ice), 0, 'ice stock');
    ok(!S.movements.some((m) => m.ingredientId === f.ice.id), 'no movement logged for ice');
});

test('Decimal amounts do not drift (0.1 + 0.2 problem)', 'v2 showed values like 963.6999999.', async () => {
    const f = await setup();
    await store.saveProduct({ ...f.americano, recipe: [{ ingredientId: f.beans.id, qty: 0.1 }] });
    await startDay();
    for (let i = 0; i < 7; i++) await sell([line(byId('products', f.americano.id))]);
    eq(stock(f.beans), 999.3, 'beans after 7 × 0.1 g');
});

test('Add-on swap that removes more than the base never ADDS stock', 'Regression: oat swap −180 ml on a 150 ml latte used to put milk back.', async () => {
    const f = await setup();
    await startDay();
    await sell([line(f.latte, 1, [f.oatSwap.id])]);
    eq(stock(f.milk), 2000, 'milk unchanged (clamped at 0 used)');
    eq(stock(f.oat), 820, 'oat used 180');
});

test('Add-on price is included in the line and order total', '', async () => {
    const f = await setup();
    await startDay();
    const o = await sell([line(f.latte, 2, [f.oatSwap.id])]);
    eq(o.items[0].unitPrice, 145, 'unit price');
    eq(o.total, 290, 'total');
});

test('Out of stock: allowed by default, stock goes negative', 'Counts drift; the barista must not be blocked by a wrong number.', async () => {
    const f = await setup();
    await startDay();
    await sell([line(f.americano, 12)]); // only 10 cups
    eq(stock(f.cups), -2, 'cups');
});

test('Out of stock: blocked when "Block sales" is on, nothing saved', 'Failed sale must not half-save.', async () => {
    const f = await setup();
    await store.saveSettings({ blockOutOfStock: true });
    await startDay();
    await rejects(() => sell([line(f.americano, 11)]), /Not enough Cups/, 'should block');
    eq(stock(f.cups), 10, 'cups untouched');
    eq(store.realOrders().length, 0, 'no order saved');
});

test('Duplicated product stays available; "Out" names the missing ingredient', 'Regression: a copy using a new 0-stock ingredient showed "Out" with no reason.', async () => {
    const f = await setup();
    const latte = byId('products', f.latte.id);
    await store.saveProduct({ ...latte, id: undefined, createdAt: undefined, sort: undefined, name: 'Latte (copy)' });
    const copy = S.products.find((p) => p.name === 'Latte (copy)');
    eq(store.unitsAvailable(copy), store.unitsAvailable(latte), 'copy has the same availability');
    const syrup = await store.saveIngredient({ name: 'Caramel syrup', unit: 'ml', tracked: true }); // amount left blank = 0
    await store.saveProduct({ ...copy, recipe: [...copy.recipe, { ingredientId: syrup.id, qty: 20 }] });
    eq(store.unitsAvailable(byId('products', copy.id)), 0, 'out');
    eq(store.missingIngredients(byId('products', copy.id)).map((m) => m.name), ['Caramel syrup'], 'reason');
});

test('"N left" respects what is already in the cart', 'Tile badge must not promise cups you already rang up.', async () => {
    const f = await setup();
    const reserved = store.cartUsage([line(f.latte, 7)]);
    eq(store.unitsAvailable(f.americano), 10, 'empty cart');
    eq(store.unitsAvailable(f.americano, [], reserved), 3, 'with 7 lattes in cart');
});

test('Selling with no event / no open day is refused', '', async () => {
    const f = await setup();
    await rejects(() => sell([line(f.latte)]), /Open a day/, 'no event');
    await store.startEvent({ name: 'X', capitalItems: [] }); // no day opened
    await rejects(() => sell([line(f.latte)]), /Open a day/, 'event but no day');
});

test('Empty order is refused', '', async () => {
    await setup();
    await startDay();
    await rejects(() => sell([]), /empty/i, 'empty cart');
});

test('Practice mode: uses stock while on, puts it all back when turned off', 'Lets you see the effect on inventory without losing real counts.', async () => {
    const f = await setup();
    await store.setPractice(true);
    const o = await sell([line(f.latte, 3)]);
    ok(o.practice, 'flagged practice');
    eq(stock(f.beans), 946, 'beans used during practice');
    await store.adjustStock({ ingredientId: f.milk.id, type: 'restock', qty: 500 }); // a real change made meanwhile
    await store.setPractice(false);
    eq(stock(f.beans), 1000, 'beans put back');
    eq(stock(f.milk), 2500, 'milk put back, real restock kept');
    const ev = await startDay();
    eq(computeReport({ eventId: ev.id }).orderCount, 0, 'report ignores practice');
    await store.clearPractice();
    eq(S.orders.length, 0, 'practice orders cleared');
});

test('Practice void restores during the session, and is not double-restored after it ends', '', async () => {
    const f = await setup();
    await store.setPractice(true);
    const a = await sell([line(f.americano, 2)]);
    const b = await sell([line(f.americano, 1)]);
    await store.voidOrder(a.id);
    eq(stock(f.cups), 9, 'only order b still holds a cup');
    await store.setPractice(false);
    eq(stock(f.cups), 10, 'all back');
    await store.voidOrder(b.id);
    eq(stock(f.cups), 10, 'voiding after practice ended changes nothing');
});

// ======================================================================
// Discounts & payment
// ======================================================================

test('Percent discount rounds to centavos', '', async () => {
    const f = await setup();
    await startDay();
    const o = await sell([line(f.americano, 1)], 'cash', 0, { name: '15%', pct: 15 });
    eq(o.discount.amount, 13.5, 'discount');
    eq(o.total, 76.5, 'total');
});

test('Fixed discount larger than the order is capped (total never negative)', '', async () => {
    const f = await setup();
    await startDay();
    const o = await sell([line(f.americano)], 'cash', 0, { name: 'Big', amount: 500 });
    eq(o.total, 0, 'total');
    eq(o.discount.amount, 90, 'capped at subtotal');
});

test('Cash change is never negative; non-cash has no change', '', async () => {
    const f = await setup();
    await startDay();
    const short = await sell([line(f.latte)], 'cash', 50);
    eq(short.payment.change, 0, 'short tender treated as exact');
    const g = await sell([line(f.latte)], 'gcash', 1000);
    eq([g.payment.tendered, g.payment.change], [120, 0], 'gcash');
    const c = await sell([line(f.latte)], 'cash', 500);
    eq(c.payment.change, 380, 'change from 500');
});

// ======================================================================
// Voids
// ======================================================================

test('Void restores stock using the recipe AT SALE TIME', 'Regression: v2 used the current recipe, so editing a recipe broke undo.', async () => {
    const f = await setup();
    await startDay();
    const o = await sell([line(f.latte, 2)]);
    await store.saveProduct({ ...byId('products', f.latte.id), recipe: [{ ingredientId: f.beans.id, qty: 50 }] });
    await store.voidOrder(o.id, 'test');
    eq(stock(f.beans), 1000, 'beans');
    eq(stock(f.milk), 2000, 'milk');
    eq(stock(f.cups), 10, 'cups');
});

test('Voiding twice does not restore stock twice', '', async () => {
    const f = await setup();
    await startDay();
    const o = await sell([line(f.americano)]);
    await store.voidOrder(o.id);
    await store.voidOrder(o.id);
    eq(stock(f.cups), 10, 'cups');
});

test('Any order can be voided, not just the last one', 'v2 could only undo the most recent sale.', async () => {
    const f = await setup();
    await startDay();
    const first = await sell([line(f.americano)]);
    await sell([line(f.latte)]);
    await store.voidOrder(first.id);
    eq(store.realOrders().length, 1, 'one order left');
    eq(stock(f.cups), 9, 'only the latte cup used');
});

test('Void of a product that was later deleted still restores stock', '', async () => {
    const f = await setup();
    await startDay();
    const o = await sell([line(f.americano)]);
    await store.deleteProduct(f.americano.id);
    await store.voidOrder(o.id);
    eq(stock(f.beans), 1000, 'beans');
});

// ======================================================================
// Events, days & cash
// ======================================================================

test('Only one event and one open day at a time', '', async () => {
    await setup();
    await startDay();
    await rejects(() => store.startEvent({ name: 'Second', capitalItems: [] }), /already running/, 'second event');
    await rejects(() => store.openNewDay({ openingCash: 0 }), /already open/, 'second day');
    await rejects(() => store.endEvent(), /Close the current day/, 'end with open day');
});

test('Expected cash = float + cash sales − drawer expenses (not GCash, not voids)', '', async () => {
    const f = await setup();
    await startDay(1000, 500);
    await sell([line(f.latte)], 'cash', 200);         // +120
    await sell([line(f.latte)], 'gcash');             // not cash
    const v = await sell([line(f.americano)], 'cash'); // voided below
    await store.voidOrder(v.id);
    await store.saveExpense({ amount: 60, category: 'Ice', paidFromDrawer: true });
    await store.saveExpense({ amount: 300, category: 'Supplies', paidFromDrawer: false });
    eq(store.expectedCash(store.openDay()), 560, '500 + 120 − 60');
});

test('Closing a day records the cash difference and stock counts', '', async () => {
    const f = await setup();
    await startDay(1000, 500);
    await sell([line(f.latte)], 'cash');
    const day = await store.closeDay({ countedCash: 610, counts: { [f.beans.id]: 950, [f.milk.id]: '' } });
    eq([day.expectedCash, day.countedCash], [620, 610], 'cash');
    eq(stock(f.beans), 950, 'beans set to counted');
    eq(stock(f.milk), 1850, 'blank count leaves milk alone');
    const adj = S.movements.find((m) => m.type === 'count' && m.ingredientId === f.beans.id);
    eq(adj.delta, -32, 'count adjustment logged (982 → 950)');
});

test('Order numbers continue across days and restart for a new event', '', async () => {
    const f = await setup();
    await startDay();
    await sell([line(f.latte)]);
    await store.closeDay({});
    await store.openNewDay({ openingCash: 0 });
    const o2 = await sell([line(f.latte)]);
    eq(o2.number, 2, 'day 2 continues');
    await store.closeDay({});
    await store.endEvent();
    await startDay();
    const o3 = await sell([line(f.latte)]);
    eq(o3.number, 1, 'new event restarts');
});

test('Reopened day keeps collecting its own sales', 'For "I closed the day by mistake".', async () => {
    const f = await setup();
    await startDay();
    await sell([line(f.latte)]);
    const d = await store.closeDay({});
    await store.reopenDay(d.id);
    await sell([line(f.latte)]);
    eq(store.realOrders({ dayId: d.id }).length, 2, 'both orders on day 1');
    eq(store.eventDays(d.eventId).length, 1, 'still one day');
});

// ======================================================================
// Accounting & reports
// ======================================================================

test('Profit = gross − (capital + expenses), never per-cup costs', 'Matches the original capital-vs-gross model.', async () => {
    const f = await setup();
    const ev = await startDay(1500, 0);
    await sell([line(f.latte, 10)]);
    await store.saveExpense({ amount: 120, category: 'Ice' });
    const rep = computeReport({ eventId: ev.id });
    eq([rep.gross, rep.capital, rep.otherExpenses, rep.profit], [1200, 1500, 120, -420], 'gross/capital/expenses/profit');
});

test('Day report excludes capital; days add up to the event', '', async () => {
    const f = await setup();
    const ev = await startDay(1500, 0);
    await sell([line(f.latte, 2)]);
    await store.saveExpense({ amount: 50, category: 'Ice' });
    const d1 = await store.closeDay({});
    await store.openNewDay({ openingCash: 0 });
    await sell([line(f.americano, 3)]);
    const d2 = store.openDay();
    const r1 = computeReport({ eventId: ev.id, dayId: d1.id });
    const r2 = computeReport({ eventId: ev.id, dayId: d2.id });
    const all = computeReport({ eventId: ev.id });
    eq(r1.costs, 50, 'day 1 costs = its expense only');
    eq(r1.gross + r2.gross, all.gross, 'days sum to event');
    eq(all.costs, 1550, 'event costs include capital');
});

test('Product report spreads order discounts so it adds up to gross', '', async () => {
    const f = await setup();
    const ev = await startDay();
    await sell([line(f.latte, 1), line(f.americano, 1)], 'cash', 0, { name: '10%', pct: 10 });
    const rep = computeReport({ eventId: ev.id });
    eq(r2(rep.products.reduce((s, p) => s + p.gross, 0)), rep.gross, 'products sum = gross');
});

test('Restock with a cost logs an expense; waste shows in usage', '', async () => {
    const f = await setup();
    const ev = await startDay(0, 0);
    await store.adjustStock({ ingredientId: f.milk.id, type: 'restock', qty: 1000, cost: 95 });
    await store.adjustStock({ ingredientId: f.milk.id, type: 'waste', qty: 200, note: 'Spilled' });
    eq(stock(f.milk), 2800, 'milk');
    const rep = computeReport({ eventId: ev.id });
    eq(rep.otherExpenses, 95, 'restock cost is an expense');
    const milk = rep.ingredients.find((i) => i.name === 'Milk');
    eq([milk.restocked, milk.wasted], [1000, 200], 'usage table');
});


// ======================================================================
// Optional ingredients, add-ons, per-cup
// ======================================================================

test('Optional ingredient is skipped unless picked for that order', 'e.g. Iced Americano with or without syrup.', async () => {
    const f = await setup();
    const syrup = await store.saveIngredient({ name: 'Syrup', unit: 'ml', tracked: true, stock: 500 });
    await store.saveProduct({ ...f.americano, recipe: [...f.americano.recipe, { ingredientId: syrup.id, qty: 15, optional: true }] });
    await startDay();
    await sell([line(f.americano, 2)]);
    eq(stock(syrup), 500, 'plain: syrup untouched');
    const o = await sell([line(f.americano, 1, [], [syrup.id])]);
    eq(stock(syrup), 485, 'sweet: 15 ml used');
    eq(o.items[0].options.map((x) => x.name), ['Syrup'], 'option on the order');
    eq(o.total, 90, 'optional ingredient is free');
});

test('Optional rows do not count toward "N left" or estimated cost', '', async () => {
    const f = await setup();
    const syrup = await store.saveIngredient({ name: 'Syrup', unit: 'ml', tracked: true, stock: 0, unitCost: 1 });
    const recipe = [...f.americano.recipe, { ingredientId: syrup.id, qty: 15, optional: true }];
    await store.saveProduct({ ...f.americano, recipe });
    eq(store.unitsAvailable(byId('products', f.americano.id)), 10, 'syrup at 0 does not block');
    eq(store.estUnitCost(recipe), 19.4, '18 g × 0.8 + 1 cup × 5 (syrup ignored)');
});

test('Add-on sold on its own: charged, only adds stock usage, linked to the order', 'Customer comes back: "extra shot for #3".', async () => {
    const f = await setup();
    await store.saveModifier({ name: 'Extra shot', priceDelta: 30, recipe: [{ ingredientId: f.beans.id, qty: 18 }] });
    const shot = S.modifiers.find((m) => m.name === 'Extra shot');
    const ev = await startDay();
    const first = await sell([line(f.latte)]);
    const extra = await sell([addonLine(shot, 1, first.number), addonLine(f.oatSwap, 1, first.number)]);
    eq(extra.total, 55, '30 + 25');
    eq(stock(f.beans), 964, '18 for the latte + 18 for the shot');
    eq(stock(f.milk), 1850, 'oat swap sold later does NOT give milk back');
    eq(stock(f.oat), 820, 'oat milk used');
    ok(extra.items[0].name.includes(`#${first.number}`), 'name says which order');
    const rep = computeReport({ eventId: ev.id });
    eq(rep.items, 1, 'add-ons are not counted as extra items');
    ok(rep.products.some((p) => p.name === 'Extra shot (add-on)'), 'add-on appears in product report');
});

test('Same product with different options/add-ons stays on separate lines', 'Grouped lines, but per-cup differences are kept apart.', async () => {
    const f = await setup();
    const a = store.lineKey(line(f.latte, 1));
    const b = store.lineKey(line(f.latte, 1, [f.oatSwap.id]));
    const c = store.lineKey(line(f.latte, 1, [], [f.ice.id]));
    ok(a !== b && a !== c && b !== c, 'keys differ');
    eq(store.lineKey(line(f.latte, 2, ['x', 'y'])), store.lineKey(line(f.latte, 1, ['y', 'x'])), 'add-on order does not matter');
});

test('Group order: 5 Americanos split 3 with syrup + 2 plain keeps total and stock right', '"Apply to 3 of 5 cups".', async () => {
    const f = await setup();
    const syrup = await store.saveIngredient({ name: 'Syrup', unit: 'ml', tracked: true, stock: 500 });
    await store.saveProduct({ ...f.americano, recipe: [...f.americano.recipe, { ingredientId: syrup.id, qty: 15, optional: true }] });
    await startDay();
    const o = await sell([line(f.americano, 2), line(f.americano, 3, [], [syrup.id])]);
    eq(o.total, 450, '5 × 90, syrup free');
    eq(o.items.map((i) => `${i.qty}${i.options.length ? '+syrup' : ''}`), ['2', '3+syrup'], 'two grouped lines');
    eq([stock(syrup), stock(f.cups)], [455, 5], '45 ml syrup, 5 cups');
});

test('Cups split into singles are grouped again at checkout', '"Split into single cups" for very mixed orders.', async () => {
    const f = await setup();
    await store.saveModifier({ name: 'Extra shot', priceDelta: 30, recipe: [{ ingredientId: f.beans.id, qty: 18 }] });
    const shot = S.modifiers.find((m) => m.name === 'Extra shot');
    await startDay();
    const single = (mods, n) => ({ ...line(f.americano, 1, mods), splitId: `s${n}` });
    const cart = [single([], 1), single([shot.id], 2), single([], 3), single([shot.id], 4), single([], 5)];
    ok(new Set(cart.map(store.lineKey)).size === 5, 'five separate lines while editing');
    eq(store.mergeLines(cart).map((l) => l.qty), [3, 2], 'merged: 3 plain + 2 with shot');
    const o = await sell(cart);
    eq(o.items.length, 2, 'order has 2 grouped items');
    eq(o.total, 510, '5 × 90 + 2 × 30');
    eq(stock(f.beans), 1000 - 5 * 18 - 2 * 18, 'beans');
});

// ======================================================================
// Units
// ======================================================================

test('Changing kg → g converts stock, alert, cost, recipes and history', 'Regression: 1 kg became "1 g" after switching unit.', async () => {
    await fresh();
    const beans = await store.saveIngredient({ name: 'Beans', unit: 'kg', tracked: true, stock: 1, lowAt: 0.2, unitCost: 860 });
    await store.saveProduct({ name: 'Espresso', price: 80, active: true, modifierIds: [], recipe: [{ ingredientId: beans.id, qty: 0.018 }] });
    await startDay();
    const o = await sell([line(S.products[0], 1)]);
    const cur = byId('ingredients', beans.id);
    await store.saveIngredient({ ...cur, unit: 'g' });
    const now = byId('ingredients', beans.id);
    eq([now.stock, now.lowAt, now.unitCost], [982, 200, 0.86], 'stock / alert / cost');
    eq(S.products[0].recipe[0].qty, 18, 'recipe 0.018 kg → 18 g');
    ok(S.movements.filter((m) => m.ingredientId === beans.id).every((m) => m.unit === 'g'), 'history in g');
    await store.voidOrder(o.id);
    eq(stock(beans), 1000, 'void after the change restores 18 g, not 0.018');
});

test('Recipe amounts can be typed in a smaller unit: 180 ml of milk stocked in L', 'Regression: typing 180 for an L ingredient meant 180 litres per drink.', async () => {
    await fresh();
    const milk = await store.saveIngredient({ name: 'Milk', unit: 'L', tracked: true, stock: 5 });
    eq(store.compatibleUnits('L'), ['ml', 'L'], 'units offered');
    eq(store.recipeUnitFor('L'), 'ml', 'defaults to ml');
    const row = { ingredientId: milk.id, ...readAmount(milk.id, 180, 'ml') };
    eq([row.qty, row.unit], [0.18, 'ml'], 'saved as 0.18 L, remembered as ml');
    eq(shownAmount(row), 180, 'shown as 180 ml again');
    await store.saveProduct({ name: 'Latte', price: 120, active: true, modifierIds: [], recipe: [row] });
    eq(store.unitsAvailable(S.products[0]), 27, '5 L ÷ 0.18 L');
    await startDay();
    await sell([line(S.products[0], 2)]);
    eq(stock(milk), 4.64, '2 lattes used 0.36 L');
    eq(store.convertQty(1, 'pcs', 'pcs'), 1, 'non-convertible units stay as they are');
});

test('Changing to a unit that cannot convert uses the amount you enter', '', async () => {
    await fresh();
    const lids = await store.saveIngredient({ name: 'Lids', unit: 'packs', tracked: true, stock: 2 });
    await store.saveIngredient({ ...byId('ingredients', lids.id), unit: 'pcs', stockOverride: 100 });
    eq([stock(lids), byId('ingredients', lids.id).unit], [100, 'pcs'], 'stock set from override');
    ok(S.movements.some((m) => m.type === 'count' && m.note.includes('packs → pcs')), 'logged as a count');
});

// ======================================================================
// Restock during an event (bought / made) & pending costs
// ======================================================================

test('Restock BOUGHT adds stock and logs the cost as an expense', '', async () => {
    const f = await setup();
    const ev = await startDay(1000, 500);
    await store.restockIngredient({ ingredientId: f.milk.id, qty: 1000, source: 'bought', cost: 95, paidFromDrawer: true });
    eq(stock(f.milk), 3000, 'milk');
    eq(computeReport({ eventId: ev.id }).otherExpenses, 95, 'expense');
    eq(store.expectedCash(store.openDay()), 405, 'paid from drawer lowers expected cash');
});

test('Restock MADE uses up its inputs; no cost = nothing counted twice', 'Homemade syrup from sugar already bought as capital.', async () => {
    const f = await setup();
    const sugar = await store.saveIngredient({ name: 'Sugar', unit: 'g', tracked: true, stock: 1000 });
    const syrup = await store.saveIngredient({ name: 'Syrup', unit: 'ml', tracked: true, stock: 0 });
    const ev = await startDay(1000, 0);
    await store.restockIngredient({ ingredientId: syrup.id, qty: 1000, source: 'made', inputs: [{ ingredientId: sugar.id, qty: 700 }] });
    eq([stock(syrup), stock(sugar)], [1000, 300], 'syrup made, sugar used');
    eq(computeReport({ eventId: ev.id }).otherExpenses, 0, 'no new expense');
    eq(byId('ingredients', syrup.id).batchRecipe, { per: 1000, inputs: [{ ingredientId: sugar.id, qty: 700 }] }, 'batch recipe remembered');
    const usage = computeReport({ eventId: ev.id }).ingredients;
    eq(usage.find((i) => i.name === 'Sugar').used, 700, 'sugar shows as used');
    eq(usage.find((i) => i.name === 'Syrup').restocked, 1000, 'syrup shows as added');
});

test('"Add the cost later" stays pending until a cost is entered', '', async () => {
    const f = await setup();
    const ev = await startDay(1000, 0);
    await store.restockIngredient({ ingredientId: f.oat.id, qty: 500, source: 'made', costLater: true });
    eq(store.pendingCosts(ev.id).length, 1, 'one pending');
    eq(computeReport({ eventId: ev.id }).pending.length, 1, 'report knows');
    await store.closeDay({});
    await store.endEvent();
    const p = store.pendingCosts(ev.id)[0];
    await store.saveExpense({ ...p, amount: 60, pending: false });
    eq(store.pendingCosts(ev.id).length, 0, 'filled in after the event ended');
    eq(computeReport({ eventId: ev.id }).otherExpenses, 60, 'now counted in profit');
});

// ======================================================================
// Planned days
// ======================================================================

test('One-day event: after closing the day, the app is done with days', 'Regression: a 1-day event asked to open Day 2.', async () => {
    const f = await setup();
    const ev = await store.startEvent({ name: 'One day', plannedDays: 1, capitalItems: [], openingCash: 0 });
    ok(!store.eventDaysDone(ev), 'not done while open');
    await sell([line(f.latte)]);
    await store.closeDay({});
    ok(store.eventDaysDone(store.activeEvent()), 'done after closing day 1');
});

test('Multi-day plan; opening an extra day extends it', '', async () => {
    await setup();
    const ev = await store.startEvent({ name: 'Two days', plannedDays: 2, capitalItems: [], openingCash: 0 });
    await store.closeDay({});
    ok(!store.eventDaysDone(store.activeEvent()), 'day 2 still to go');
    await store.openNewDay({ openingCash: 0 });
    await store.closeDay({});
    ok(store.eventDaysDone(store.activeEvent()), 'done after day 2');
    await store.openNewDay({ openingCash: 0 });
    eq(byId('events', ev.id).plannedDays, 3, 'extra day extends the plan');
});

// ======================================================================
// Cart (the order being built) & receipt formatting
// ======================================================================

test('Cart: same item merges, different extras stay separate, empty cart drops its discount', '', async () => {
    const f = await setup();
    const cart = new Cart(); // in memory only
    cart.add({ productId: f.latte.id });
    cart.add({ productId: f.latte.id }, 2);
    cart.add({ productId: f.latte.id, modifierIds: [f.oatSwap.id] });
    eq(cart.lines.map((l) => l.qty), [3, 1], 'grouped lines');
    eq(cart.itemCount, 4, 'item count');
    cart.setDiscount({ name: '10%', pct: 10 });
    for (const l of [...cart.lines]) cart.setQty(l.key, 0);
    ok(cart.isEmpty && cart.discount === null, 'discount cleared with the last line');
});

test('Cart: "Apply to 3 of 5" keeps line order and merges back when identical', '', async () => {
    const f = await setup();
    const cart = new Cart();
    cart.add({ productId: f.americano.id }, 5);
    cart.add({ productId: f.latte.id });
    const [americanos] = cart.lines;
    cart.replace(americanos.key, [
        { productId: f.americano.id, qty: 2 },
        { productId: f.americano.id, modifierIds: [f.oatSwap.id], qty: 3 }
    ]);
    eq(cart.lines.map((l) => `${l.qty}${l.modifierIds.length ? '+oat' : ''}`), ['2', '3+oat', '1'], 'split in place, latte still last');
    const oat = cart.lines[1];
    cart.replace(oat.key, [{ productId: f.americano.id, qty: 3 }]);
    eq(cart.lines.map((l) => l.qty), [5, 1], 'identical lines merged back');
});

test('Cart: split into single cups, edit one, totals unchanged until extras change price', '', async () => {
    const f = await setup();
    const cart = new Cart();
    cart.add({ productId: f.americano.id }, 3);
    eq(cart.splitIntoSingles(cart.lines[0].key), 3, 'three singles');
    eq(cart.lines.length, 3, 'separate lines while editing');
    eq(cart.totals.total, 270, 'total unchanged');
    cart.replace(cart.lines[0].key, [{ productId: f.americano.id, modifierIds: [f.oatSwap.id], qty: 1, splitId: cart.lines[0].splitId }]);
    eq(cart.totals.total, 295, 'one cup with oat (+25)');
    eq(store.mergeLines(cart.lines).map((l) => l.qty), [1, 2], 'checkout groups them: 1 oat + 2 plain');
});

test('Receipt: label/amount rows fit the paper width; long names wrap; ₱ becomes P', '', async () => {
    const decode = (doc) => new TextDecoder().decode(doc.build().slice(2)); // skip the reset command
    const row = decode(new EscPos({ columns: 32 }).pair('2 x Iced Latte', '240.00'));
    eq(row, `${'2 x Iced Latte'.padEnd(26)}240.00\n`, '32 columns exactly');
    const long = decode(new EscPos({ columns: 32 }).pair('1 x Extra Large Caramel Macchiato', '185.00'));
    eq(long.split('\n')[1].length, 32, 'value right-aligned on its own line');
    eq(decode(new EscPos({ currency: 'P' }).text('₱120 café')), 'P120 cafe', 'ASCII only');
});

// ======================================================================
// Data safety
// ======================================================================

test('Ingredient used in a recipe cannot be deleted', '', async () => {
    const f = await setup();
    await rejects(() => store.deleteIngredient(f.beans.id), /Latte/, 'delete beans');
    await store.deleteIngredient(f.oat.id).catch(() => {}); // oat is used by the add-on
    ok(byId('ingredients', f.oat.id), 'oat (used by an add-on) also protected');
});

test('Past orders keep their product names after the product is deleted', '', async () => {
    const f = await setup();
    const ev = await startDay();
    await sell([line(f.latte)]);
    await store.deleteProduct(f.latte.id);
    eq(computeReport({ eventId: ev.id }).products[0].name, 'Latte', 'name from sale snapshot');
});

test('Backup → restore round-trip keeps everything', '', async () => {
    const f = await setup();
    await startDay();
    await sell([line(f.latte, 2)]);
    const backup = JSON.parse(JSON.stringify(store.exportAll()));
    const counts = Object.fromEntries(Object.keys(backup.data).map((k) => [k, backup.data[k].length]));
    await fresh();
    await store.importAll(backup);
    eq(Object.fromEntries(Object.keys(counts).map((k) => [k, k === 'settings' ? 1 : S[k].length])), counts, 'record counts');
    eq(stock(f.beans), 964, 'stock survived');
});

test('Restore rejects files that are not PopPOS backups', '', async () => {
    await setup();
    await rejects(() => store.importAll({ hello: 'world' }), /Not a PopPOS/, 'random JSON');
    ok(S.products.length === 2, 'existing data untouched');
});

test('v2 import: units, capital, demo sales and recipes convert correctly', '', async () => {
    const out = convertV2({
        ingredients: [{ id: 'i1', name: 'Coffee', unit: 'grams', totalQuantity: 400, lowStockThreshold: 50 }],
        products: [{ id: 'p1', name: 'Latte', sellingPrice: 120, active: true, recipe: [{ ingredientId: 'i1', quantity: 18 }] }],
        sales: [
            { id: 's1', productId: 'p1', productName: 'Latte', sellingPrice: 240, quantity: 2, timestamp: '2026-01-01T10:00:00Z' },
            { id: 's2', productId: 'p1', productName: 'Latte', sellingPrice: 120, quantity: 1, timestamp: '2026-01-01T10:05:00Z', isDemoMode: true }
        ],
        activeEvent: { id: 'e1', name: 'Fair', fixedCost: 1500, status: 'active', startTime: '2026-01-01T09:00:00Z', startingInventory: [{ id: 'i1', totalQuantity: 436 }] },
        eventHistory: []
    });
    eq(out.ingredients[0].unit, 'g', 'grams → g');
    eq(out.products[0].recipe, [{ ingredientId: 'i1', qty: 18 }], 'quantity → qty');
    eq(out.orders.length, 1, 'demo sale dropped');
    eq([out.orders[0].items[0].qty, out.orders[0].items[0].unitPrice], [2, 120], 'batch sale split into qty × unit price');
    eq(out.expenses[0].amount, 1500, 'fixed cost → capital');
    eq([out.events[0].status, out.days[0].status], ['active', 'open'], 'running event stays running');
});

test('Names with HTML are escaped, CSV cells with commas/quotes are quoted', 'A product called <b>"Mocha, Large"</b> must not break the page or the spreadsheet.', async () => {
    eq(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;', 'html');
    eq(toCSV([{ name: 'Mocha, "Large"', qty: 1 }]), 'name,qty\n"Mocha, ""Large""",1', 'csv');
});

// ======================================================================
// runner
// ======================================================================

async function run() {
    const list = document.getElementById('results');
    const summary = document.getElementById('summary');
    list.innerHTML = '';
    summary.className = 'summary';
    summary.textContent = 'Running…';
    db.useDatabase(`poppos-test-${Date.now()}`);
    await store.init();
    let passed = 0;
    for (const t of tests) {
        const li = document.createElement('li');
        try {
            await t.fn();
            passed++;
            li.className = 'pass';
            li.innerHTML = `<span class="tag">PASS</span>${esc(t.name)}${t.why ? `<span class="why">${esc(t.why)}</span>` : ''}`;
        } catch (e) {
            li.className = 'fail';
            li.innerHTML = `<span class="tag">FAIL</span>${esc(t.name)}<pre>${esc(e instanceof Fail ? e.message : e.stack || e)}</pre>`;
        }
        list.appendChild(li);
    }
    await db.deleteDatabase();
    const failed = tests.length - passed;
    summary.className = `summary ${failed ? 'fail' : 'ok'}`;
    summary.textContent = failed ? `${failed} of ${tests.length} failed` : `All ${tests.length} edge cases passed`;
    window.__results = { passed, failed, total: tests.length };
}

document.getElementById('run').addEventListener('click', run);
run();
