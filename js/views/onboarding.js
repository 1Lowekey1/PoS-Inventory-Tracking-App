// First-run helpers: sample menu, and import from the old v2 app
// (Booth POS, which stored everything under localStorage "booth_*" keys).

import * as store from '../store.js';
import { S } from '../store.js';
import { uid, r2, plural } from '../util.js';
import { icon, toast, confirmDialog } from '../ui.js';

const V2_KEYS = ['booth_ingredients', 'booth_products', 'booth_sales', 'booth_active_event', 'booth_event_history'];

const readLS = (k) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
};

/** v2 data present in this browser (same site), and not imported yet? */
export function hasV2Data() {
    if (store.settings().migratedV2) return false;
    return V2_KEYS.some((k) => {
        const v = readLS(k);
        return Array.isArray(v) ? v.length > 0 : !!v;
    });
}

/** Welcome card shown on the Sell screen while the menu is empty. */
export function emptyMenuCard() {
    return `<div class="card onboarding">
        <h2>Welcome to PopPOS</h2>
        <p class="muted">Set up once, then each event is: <b>Start event → Open day → Sell → Close day</b>.</p>
        <ol class="steps">
            <li><b>Ingredients</b>: what goes into your products, and how much you have.</li>
            <li><b>Products</b>: price and recipe (e.g. Latte = 18 g beans + 200 ml milk + 1 cup).</li>
            <li><b>Start an event</b> with your capital, then open Day 1.</li>
        </ol>
        <div class="btn-row">
            <a class="btn btn-primary" href="#menu">${icon('plus')} Set up my menu</a>
            <button class="btn" data-onb="sample">${icon('sell')} Try a sample coffee menu</button>
            ${hasV2Data() ? `<button class="btn" data-onb="import-v2">${icon('upload')} Import from old Booth POS</button>` : ''}
        </div>
        <p class="muted small">Just exploring? Turn on <b>Practice mode</b> in Settings to sell without an event. Practice sales never count.</p>
    </div>`;
}

/** Buttons on the welcome card ([data-onb]). */
export async function handleOnboardingClick(action) {
    try {
        if (action === 'sample') await loadSample();
        if (action === 'import-v2') await importV2FromBrowser();
    } catch (err) {
        toast(err.message, { type: 'error' });
    }
}

// ---------- sample data ----------
export async function loadSample() {
    if (S.products.length && !await confirmDialog('Add sample menu?', 'Sample products and ingredients will be added next to your existing ones.')) return;
    const ing = (name, unit, stock, lowAt, unitCost, tracked = true) => ({ id: uid(), name, unit, stock, lowAt, unitCost, tracked });
    const beans = ing('Espresso beans', 'g', 1000, 150, 0.86);
    const milk = ing('Fresh milk', 'ml', 6000, 1000, 0.1);
    const oat = ing('Oat milk', 'ml', 2000, 400, 0.2);
    const caramel = ing('Caramel syrup', 'ml', 750, 100, 0.78);
    const vanilla = ing('Vanilla syrup', 'ml', 750, 100, 0.7);
    const condensed = ing('Condensed milk', 'ml', 1200, 200, 0.12);
    const matcha = ing('Matcha powder', 'g', 200, 30, 4.5);
    const cups = ing('16oz cups + lids', 'pcs', 100, 20, 5.5);
    const ice = ing('Ice', 'bags', 0, null, null, false);
    const sugar = ing('Sugar', 'g', 2000, 300, 0.08);
    // Made in-house: Event → Restock → Made suggests this batch recipe next time.
    const syrup = { ...ing('Simple syrup', 'ml', 500, 100, null), batchRecipe: { per: 1000, inputs: [{ ingredientId: sugar.id, qty: 700 }] } };
    const coffee = { id: uid(), name: 'Coffee', color: '#8b5e3c', sort: 0 };
    const nonCoffee = { id: uid(), name: 'Non-coffee', color: '#4d7c0f', sort: 1 };
    const shot = { id: uid(), name: 'Extra shot', priceDelta: 30, recipe: [{ ingredientId: beans.id, qty: 18 }] };
    const oatSwap = { id: uid(), name: 'Oat milk', priceDelta: 25, recipe: [{ ingredientId: milk.id, qty: -180 }, { ingredientId: oat.id, qty: 180 }] };
    const lessSweet = { id: uid(), name: 'Less sweet', priceDelta: 0, recipe: [] };
    const base = [{ ingredientId: cups.id, qty: 1 }];
    const esp = { ingredientId: beans.id, qty: 18 };
    const m = (q) => ({ ingredientId: milk.id, qty: q });
    let sort = 0;
    const prod = (name, price, cat, recipe, mods = [shot.id, oatSwap.id]) =>
        ({ id: uid(), name, price, categoryId: cat.id, recipe: [...recipe, ...base], modifierIds: mods, active: true, sort: sort++ });
    await store.bulkInsert({
        ingredients: [beans, milk, oat, caramel, vanilla, condensed, matcha, cups, sugar, syrup, ice],
        categories: [coffee, nonCoffee],
        modifiers: [shot, oatSwap, lessSweet],
        products: [
            prod('Iced Americano', 90, coffee, [esp, { ingredientId: syrup.id, qty: 15, optional: true }], [shot.id]),
            prod('Iced Latte', 120, coffee, [esp, m(180)]),
            prod('Spanish Latte', 140, coffee, [esp, m(150), { ingredientId: condensed.id, qty: 30 }], [shot.id, oatSwap.id, lessSweet.id]),
            prod('Caramel Latte', 140, coffee, [esp, m(170), { ingredientId: caramel.id, qty: 20 }], [shot.id, oatSwap.id, lessSweet.id]),
            prod('Vanilla Latte', 140, coffee, [esp, m(170), { ingredientId: vanilla.id, qty: 20 }], [shot.id, oatSwap.id, lessSweet.id]),
            prod('Matcha Latte', 150, nonCoffee, [{ ingredientId: matcha.id, qty: 4 }, m(200)], [oatSwap.id, lessSweet.id]),
            prod('Dirty Matcha', 170, nonCoffee, [{ ingredientId: matcha.id, qty: 4 }, m(170), esp], [oatSwap.id])
        ]
    });
    toast('Sample menu added. Edit anything on the Menu and Stock tabs.', { type: 'success', duration: 5000 });
}

// ---------- v2 import ----------
const UNIT_MAP = { grams: 'g', gram: 'g', ml: 'ml', pcs: 'pcs', pieces: 'pcs' };

/**
 * Convert v2 data into PopPOS records. Shared by the in-browser import and
 * the v2 backup-file import. v2 backups only hold ingredients, products and
 * the current sales (no event history), so those sales become one event.
 */
export function convertV2({ ingredients = [], products = [], sales = [], activeEvent = null, eventHistory = [] }) {
    const out = { ingredients: [], products: [], events: [], days: [], orders: [], expenses: [] };
    const recipeOf = new Map();

    for (const i of ingredients) {
        out.ingredients.push({
            id: i.id, name: i.name, unit: UNIT_MAP[i.unit] || i.unit || 'pcs', tracked: true,
            stock: r2(i.totalQuantity ?? i.currentStock ?? 0), lowAt: i.lowStockThreshold ?? null,
            unitCost: i.totalCost && i.totalQuantity ? r2(i.totalCost / i.totalQuantity) : null
        });
    }
    products.forEach((p, idx) => {
        const recipe = (p.recipe || []).map((r) => ({ ingredientId: r.ingredientId, qty: Number(r.quantity ?? r.qty) || 0 })).filter((r) => r.qty);
        recipeOf.set(p.id, recipe);
        out.products.push({ id: p.id, name: p.name, price: Number(p.sellingPrice ?? p.price) || 0, recipe, active: p.active !== false, sort: idx, modifierIds: [], categoryId: null });
    });

    const addEvent = (ev, evSales, status) => {
        const id = uid();
        const dayId = uid();
        const startedAt = ev.startTime || evSales[0]?.timestamp || new Date().toISOString();
        const endedAt = status === 'closed' ? (ev.endTime || evSales[evSales.length - 1]?.timestamp || startedAt) : null;
        const snap = (inv) => inv ? Object.fromEntries(inv.map((i) => [i.id, i.totalQuantity])) : {};
        out.events.push({
            id, name: ev.name || 'Imported event', location: '', status, startedAt, endedAt, createdAt: startedAt,
            plannedOutput: ev.plannedOutput || null, notes: 'Imported from Booth POS v2',
            startingStock: snap(ev.startingInventory), endingStock: status === 'closed' ? snap(ev.endingInventory) : null
        });
        out.days.push({
            id: dayId, eventId: id, index: 1, status: status === 'closed' ? 'closed' : 'open', openedAt: startedAt, closedAt: endedAt,
            createdAt: startedAt, openingCash: 0, openingStock: snap(ev.startingInventory), expectedCash: null, countedCash: null
        });
        if (ev.fixedCost > 0) {
            out.expenses.push({ eventId: id, dayId: null, kind: 'capital', category: 'Ingredients', description: 'Capital (from v2 fixed cost)', amount: r2(ev.fixedCost), at: startedAt, createdAt: startedAt, paidFromDrawer: false });
        }
        evSales.filter((s) => !s.isDemoMode).sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || '')).forEach((s, n) => {
            const qty = Number(s.quantity) || 1;
            const total = r2(s.sellingPrice);
            const recipe = recipeOf.get(s.productId) || [];
            out.orders.push({
                id: s.id || uid(), number: n + 1, eventId: id, dayId, createdAt: s.timestamp, practice: false,
                items: [{ productId: s.productId, name: s.productName, categoryId: null, qty, unitPrice: r2(total / qty), modifiers: [], recipe, lineTotal: total }],
                subtotal: total, total, discount: null, payment: { method: 'cash', tendered: total, change: 0 },
                status: 'paid', fulfilment: 'done', note: ''
            });
        });
    };

    for (const ev of eventHistory) addEvent(ev, ev.salesLog || [], 'closed');
    if (activeEvent && activeEvent.status === 'active') addEvent(activeEvent, sales, 'active');
    else if (sales.some((s) => !s.isDemoMode)) addEvent({ name: 'Imported sales' }, sales, 'closed');
    return out;
}

function summaryText(d) {
    return [plural(d.ingredients.length, 'ingredient'), plural(d.products.length, 'product'), plural(d.events.length, 'event'), plural(d.orders.length, 'sale')].join(', ');
}

async function applyImport(data) {
    if (data.events.some((e) => e.status === 'active') && store.activeEvent()) {
        // Only one running event allowed: close the imported one.
        data.events.forEach((e) => { if (e.status === 'active') { e.status = 'closed'; e.endedAt = new Date().toISOString(); } });
        data.days.forEach((d) => { if (d.status === 'open') { d.status = 'closed'; d.closedAt = new Date().toISOString(); } });
    }
    await store.bulkInsert(data);
    await store.saveSettings({ migratedV2: true });
}

/** Import Booth POS v2 data stored by this browser (same site address). */
export async function importV2FromBrowser() {
    const data = convertV2({
        ingredients: readLS('booth_ingredients') || [],
        products: readLS('booth_products') || [],
        sales: readLS('booth_sales') || [],
        activeEvent: readLS('booth_active_event'),
        eventHistory: readLS('booth_event_history') || []
    });
    if (!await confirmDialog('Import from Booth POS?', `Found ${summaryText(data)}.\n\nYour old app's data is left untouched.`, { okLabel: 'Import' })) return;
    await applyImport(data);
    toast(`Imported ${summaryText(data)}`, { type: 'success', duration: 5000 });
}

/** Import a v2 backup JSON ({ ingredients, products, sales, exportDate }). */
export async function importV2File(json) {
    const data = convertV2({ ingredients: json.ingredients, products: json.products, sales: json.sales });
    if (!await confirmDialog('Import Booth POS backup?', `This file has ${summaryText(data)}.\n\nIt will be added to what's already here.`, { okLabel: 'Import' })) return;
    await applyImport(data);
    toast(`Imported ${summaryText(data)}`, { type: 'success', duration: 5000 });
}

