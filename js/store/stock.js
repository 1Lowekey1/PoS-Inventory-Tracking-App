// Ingredients and stock changes.
//
// Stock is never overwritten silently: every change is an ingredient update
// PLUS a movement record that says why (sale, void, restock, made, prep, waste,
// count, initial, practice, practice-revert). The Stock tab's history and the
// reports' ingredient usage are built from these movements.

import { S, byId, put, del, stamp, commit, currentContext } from './state.js';
import { nowISO, r2, rq } from '../util.js';

/**
 * Ops that change one ingredient's stock by `delta` and log a movement.
 * Uses the ingredient's current stock, so don't change the same ingredient
 * twice in one commit (aggregate first, as checkout does).
 */
export function stockChange(ing, delta, type, meta = {}) {
    const d = rq(delta);
    return [
        put('ingredients', { ...ing, stock: rq(ing.stock + d) }),
        put('movements', { ingredientId: ing.id, ingredientName: ing.name, unit: ing.unit, delta: d, type, at: nowISO(), ...meta })
    ];
}

/** stockChange for many tracked ingredients. usage: Map ingredientId → qty; sign −1 uses, +1 returns. */
export function stockChanges(usage, sign, type, meta = {}) {
    const ops = [];
    for (const [ingredientId, qty] of usage) {
        const ing = byId('ingredients', ingredientId);
        if (ing?.tracked && qty) ops.push(...stockChange(ing, sign * qty, type, meta));
    }
    return ops;
}

/** Current stock of every tracked ingredient: { ingredientId: qty }. Saved on events and days. */
export const stockSnapshot = () => Object.fromEntries(S.ingredients.filter((i) => i.tracked).map((i) => [i.id, i.stock]));

// ---------- manual adjustments ----------

/**
 * type 'restock': add qty · 'waste': remove qty · 'count': set stock to qty.
 * Restock here is for setup (no event). During an event the app uses
 * restockIngredient so the cost lands in the event.
 */
export async function adjustStock({ ingredientId, type, qty, note = '', cost = 0, paidFromDrawer = false }) {
    const ing = byId('ingredients', ingredientId);
    if (!ing) return;
    const delta = { restock: Math.abs(qty), waste: -Math.abs(qty), count: qty - ing.stock }[type] ?? 0;
    const ctx = currentContext();
    const ops = [];
    // A count that matches is still logged: it records that someone checked.
    if (rq(delta) !== 0 || type === 'count') ops.push(...stockChange(ing, delta, type, { note, ...ctx }));
    if (type === 'restock' && cost > 0 && ctx.eventId) {
        ops.push(put('expenses', {
            ...ctx, kind: 'expense', category: 'Ingredients',
            description: `Bought: ${ing.name} (+${rq(delta)} ${ing.unit})`, amount: r2(cost), paidFromDrawer, at: nowISO()
        }));
    }
    await commit(ops);
}

/**
 * Add stock during an event, BOUGHT or MADE (e.g. homemade syrup).
 * - inputs: ingredients used up to make it; deducted as 'prep' and remembered
 *   as the ingredient's batchRecipe to suggest next time.
 * - cost > 0 becomes an expense. costLater creates a PENDING expense (amount 0)
 *   that the app reminds about until filled in.
 * Made from stock already paid for as capital? Leave cost empty: nothing is counted twice.
 */
export async function restockIngredient({ ingredientId, qty, source = 'bought', cost = 0, costLater = false, paidFromDrawer = false, inputs = [], note = '' }) {
    const ing = byId('ingredients', ingredientId);
    if (!ing) throw new Error('Pick an ingredient.');
    const amount = rq(Math.abs(Number(qty) || 0));
    if (!(amount > 0)) throw new Error('Enter how much was added.');
    const ctx = currentContext();
    const made = source === 'made';
    const ops = [];

    const used = inputs
        .map((inp) => ({ ingredientId: inp.ingredientId, qty: rq(inp.qty), ...(inp.unit ? { unit: inp.unit } : {}) }))
        .filter((inp) => inp.qty > 0 && inp.ingredientId !== ing.id && byId('ingredients', inp.ingredientId));
    for (const inp of used) {
        const src = byId('ingredients', inp.ingredientId);
        if (src.tracked) ops.push(...stockChange(src, -inp.qty, 'prep', { note: `Used to make ${ing.name}`, ...ctx }));
    }

    const usedText = used.map((u) => { const i = byId('ingredients', u.ingredientId); return `${u.qty} ${i.unit} ${i.name}`; }).join(', ');
    const target = made && used.length ? { ...ing, batchRecipe: { per: amount, inputs: used } } : ing;
    ops.push(...stockChange(target, amount, made ? 'made' : 'restock', { note: note || (usedText ? `From ${usedText}` : ''), ...ctx }));

    if (ctx.eventId && (cost > 0 || costLater)) {
        ops.push(put('expenses', {
            ...ctx, kind: 'expense', category: 'Ingredients', ingredientId: ing.id, at: nowISO(),
            description: `${made ? 'Made' : 'Bought'}: ${ing.name} (+${amount} ${ing.unit})`,
            amount: cost > 0 ? r2(cost) : 0, pending: !(cost > 0), paidFromDrawer: cost > 0 && !!paidFromDrawer
        }));
    }
    await commit(ops);
}

// ---------- units ----------

// Units that convert into each other: [dimension, size in the base unit].
const UNIT_FACTORS = { g: ['mass', 1], kg: ['mass', 1000], ml: ['vol', 1], L: ['vol', 1000] };

/** Multiplier from one unit to another (kg → g = 1000), or null if they don't convert. */
export function unitFactor(from, to) {
    if (from === to) return 1;
    const a = UNIT_FACTORS[from], b = UNIT_FACTORS[to];
    if (!a || !b || a[0] !== b[0]) return null;
    return a[1] / b[1];
}

/** Units an amount of this unit can be entered in: 'L' → ['ml', 'L'], 'pcs' → ['pcs']. */
export function compatibleUnits(unit) {
    const dimension = UNIT_FACTORS[unit]?.[0];
    if (!dimension) return [unit];
    return Object.keys(UNIT_FACTORS).filter((u) => UNIT_FACTORS[u][0] === dimension);
}

/** Unit to enter per-item recipe amounts in: the small unit for bulk stock (L → ml, kg → g). */
export const recipeUnitFor = (unit) => ({ L: 'ml', kg: 'g' })[unit] || unit;

/** Convert an amount between compatible units; unchanged if they don't convert. */
export const convertQty = (qty, from, to) => rq(Number(qty) * (unitFactor(from, to) ?? 1));

/**
 * Ops that rescale every stored amount of an ingredient after a unit change
 * (recipes, add-ons, batch recipes, sale snapshots, history, event/day
 * snapshots), plus the ingredient's own converted fields.
 */
function rescaleIngredient(ing, factor, unit) {
    const id = ing.id;
    const scale = (n) => (n == null || n === '' ? n : rq(Number(n) * factor));
    const scaleRows = (rows) => rows.map((r) => (r.ingredientId === id ? { ...r, qty: scale(r.qty) } : r));
    const usesIt = (rows) => rows?.some((r) => r.ingredientId === id);
    const scaleSnapshot = (snap) => (snap?.[id] != null ? { ...snap, [id]: scale(snap[id]) } : snap);
    const ops = [];

    for (const p of S.products) if (usesIt(p.recipe)) ops.push(put('products', { ...p, recipe: scaleRows(p.recipe) }));
    for (const m of S.modifiers) if (usesIt(m.recipe)) ops.push(put('modifiers', { ...m, recipe: scaleRows(m.recipe) }));
    for (const i of S.ingredients) {
        if (i.id !== id && usesIt(i.batchRecipe?.inputs)) ops.push(put('ingredients', { ...i, batchRecipe: { ...i.batchRecipe, inputs: scaleRows(i.batchRecipe.inputs) } }));
    }
    for (const o of S.orders) {
        if (o.items.some((it) => usesIt(it.recipe))) ops.push(put('orders', { ...o, items: o.items.map((it) => ({ ...it, recipe: scaleRows(it.recipe) })) }));
    }
    for (const m of S.movements) if (m.ingredientId === id) ops.push(put('movements', { ...m, delta: scale(m.delta), unit }));
    for (const e of S.events) {
        if (e.startingStock?.[id] != null || e.endingStock?.[id] != null) ops.push(put('events', { ...e, startingStock: scaleSnapshot(e.startingStock), endingStock: scaleSnapshot(e.endingStock) }));
    }
    for (const d of S.days) {
        if (d.openingStock?.[id] != null || d.closingStock?.[id] != null) ops.push(put('days', { ...d, openingStock: scaleSnapshot(d.openingStock), closingStock: scaleSnapshot(d.closingStock) }));
    }

    const hasCost = ing.unitCost != null && ing.unitCost !== '';
    return {
        ops,
        converted: {
            stock: scale(ing.stock),
            lowAt: scale(ing.lowAt),
            unitCost: hasCost ? Math.round((ing.unitCost / factor) * 1e6) / 1e6 : ing.unitCost,
            batchRecipe: ing.batchRecipe ? { ...ing.batchRecipe, per: scale(ing.batchRecipe.per) } : ing.batchRecipe
        }
    };
}

// ---------- ingredients ----------

/**
 * Create or update an ingredient.
 * Unit change g↔kg / ml↔L: everything is converted. Alert and cost are only
 * converted if left unchanged in this save (a retyped value is taken as already
 * in the new unit). Other unit changes: pass `stockOverride` = amount in the
 * new unit (logged as a count); recipes must be checked by hand.
 */
export async function saveIngredient(rec) {
    const existing = rec.id && byId('ingredients', rec.id);
    const { stockOverride, ...fields } = rec;
    const next = { ...existing, ...fields, stock: rq(existing ? existing.stock : rec.stock || 0) };
    const ops = [];

    if (existing && rec.unit && rec.unit !== existing.unit) {
        const factor = unitFactor(existing.unit, rec.unit);
        if (factor) {
            const { ops: rescale, converted } = rescaleIngredient(existing, factor, rec.unit);
            ops.push(...rescale);
            next.stock = converted.stock;
            next.batchRecipe = converted.batchRecipe;
            if (rec.lowAt === existing.lowAt) next.lowAt = converted.lowAt;
            if (rec.unitCost === existing.unitCost) next.unitCost = converted.unitCost;
        } else if (stockOverride != null && stockOverride !== '') {
            next.stock = rq(stockOverride);
            ops.push(put('movements', {
                ingredientId: existing.id, ingredientName: next.name, unit: rec.unit, delta: rq(next.stock - existing.stock),
                type: 'count', note: `Unit changed ${existing.unit} → ${rec.unit}`, at: nowISO(), ...currentContext()
            }));
        }
    }

    const ing = stamp(next);
    ops.push({ store: 'ingredients', put: ing });
    if (!existing && ing.tracked && ing.stock) {
        ops.push(put('movements', {
            ingredientId: ing.id, ingredientName: ing.name, unit: ing.unit, delta: ing.stock, type: 'initial', at: nowISO(), ...currentContext()
        }));
    }
    await commit(ops);
    return ing;
}

/** Names of products and add-ons whose recipe uses this ingredient. */
export const ingredientUsedIn = (id) => [
    ...S.products.filter((p) => p.recipe?.some((r) => r.ingredientId === id)).map((p) => p.name),
    ...S.modifiers.filter((m) => m.recipe?.some((r) => r.ingredientId === id)).map((m) => m.name)
];

/** Refuses while a recipe or add-on still uses it. Its history stays in reports. */
export async function deleteIngredient(id) {
    const used = ingredientUsedIn(id);
    if (used.length) throw new Error(`Used in: ${used.join(', ')}`);
    await commit([del('ingredients', id)]);
}

