// Recipes, prices and cart lines: pure calculations, no saving.
//
// A cart line is one of:
//   { productId, qty, modifierIds, optionIds, splitId? }  a product
//   { addonId, qty, forOrder }                              an add-on sold after payment
//
// Recipe rows are { ingredientId, qty, optional? }. Optional rows (e.g.
// sweetener) only count when picked; add-ons (modifiers) add or, with negative
// amounts, swap ingredients.

import { byId } from './state.js';
import { r2, rq, sum } from '../util.js';

/** Add recipe rows into a Map of ingredientId → qty. */
function addRows(map, rows, times = 1) {
    for (const r of rows || []) map.set(r.ingredientId, (map.get(r.ingredientId) || 0) + Number(r.qty) * times);
    return map;
}

/** Per-unit recipe of a product with the picked add-ons and optional extras. */
export function lineRecipe(product, modifierIds = [], optionIds = []) {
    const map = new Map();
    addRows(map, (product.recipe || []).filter((r) => !r.optional || optionIds.includes(r.ingredientId)));
    for (const id of modifierIds) addRows(map, byId('modifiers', id)?.recipe);
    // A swap can remove more than the drink uses (oat swap −180 ml on a 150 ml
    // drink). A sale must never ADD stock, so drop anything that ends ≤ 0.
    return [...map].filter(([, q]) => q > 0).map(([ingredientId, qty]) => ({ ingredientId, qty: rq(qty) }));
}

/** Product price plus add-on prices. Optional extras are free. */
export function linePrice(product, modifierIds = []) {
    return r2(product.price + sum(modifierIds, (id) => byId('modifiers', id)?.priceDelta || 0));
}

/** The product's optional recipe rows, with ingredient names (for the order chips). */
export const productOptions = (product) => (product?.recipe || [])
    .filter((r) => r.optional)
    .map((r) => ({ ingredientId: r.ingredientId, qty: r.qty, name: byId('ingredients', r.ingredientId)?.name || '?' }));

/** Ingredients an add-on uses when sold on its own: only what it adds (can't un-pour milk). */
export const addonRecipe = (mod) => (mod?.recipe || [])
    .filter((r) => r.qty > 0)
    .map((r) => ({ ingredientId: r.ingredientId, qty: rq(r.qty) }));

// ---------- line identity ----------

const sortedIds = (ids) => [...(ids || [])].sort().join(',');

/** Same product + add-ons + options = same content key. */
export const contentKey = (l) => (l.addonId
    ? `addon|${l.addonId}|${l.forOrder ?? ''}`
    : `${l.productId}|${sortedIds(l.modifierIds)}|${sortedIds(l.optionIds)}`);

/** Cart key. Split single cups carry a splitId so identical cups stay separate while edited. */
export const lineKey = (l) => `${contentKey(l)}${l.splitId ? `#${l.splitId}` : ''}`;

/** Merge identical lines (e.g. split single cups) back into grouped lines. */
export function mergeLines(lines) {
    const merged = new Map();
    for (const line of lines) {
        const key = contentKey(line);
        const existing = merged.get(key);
        if (existing) existing.qty += line.qty;
        else {
            const { splitId, ...rest } = line;
            merged.set(key, { ...rest, key });
        }
    }
    return [...merged.values()];
}

/**
 * Everything needed to show, charge and stock-deduct a line:
 * { productId, addonId?, name, unitPrice, modifiers, options, recipe }.
 * Returns null if its product/add-on was deleted.
 */
export function resolveLine(l) {
    if (l.addonId) {
        const m = byId('modifiers', l.addonId);
        if (!m) return null;
        return {
            productId: null, addonId: m.id, forOrder: l.forOrder ?? null,
            name: `${m.name}${l.forOrder ? ` (for #${l.forOrder})` : ' (add-on)'}`,
            categoryId: null, unitPrice: r2(m.priceDelta || 0), modifiers: [], options: [], recipe: addonRecipe(m)
        };
    }
    const p = byId('products', l.productId);
    if (!p) return null;
    const modifierIds = (l.modifierIds || []).filter((id) => byId('modifiers', id));
    const optionIds = l.optionIds || [];
    return {
        productId: p.id, name: p.name, categoryId: p.categoryId || null,
        unitPrice: linePrice(p, modifierIds),
        modifiers: modifierIds.map((id) => byId('modifiers', id)).map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta || 0 })),
        options: productOptions(p).filter((o) => optionIds.includes(o.ingredientId)).map((o) => ({ ingredientId: o.ingredientId, name: o.name })),
        recipe: lineRecipe(p, modifierIds, optionIds)
    };
}

// ---------- totals & availability ----------

/** Ingredient amounts a list of cart lines would use: Map ingredientId → qty. */
export function cartUsage(lines) {
    const usage = new Map();
    for (const line of lines) addRows(usage, resolveLine(line)?.recipe, line.qty);
    return usage;
}

/** Ingredient amounts a saved order used (from its recipe snapshots). */
export function orderUsage(order) {
    const usage = new Map();
    for (const item of order.items) addRows(usage, item.recipe, item.qty);
    return usage;
}

/** discount: { pct } or { amount }. A fixed discount never exceeds the subtotal. */
export function cartTotals(lines, discount) {
    const subtotal = r2(sum(lines, (l) => (resolveLine(l)?.unitPrice || 0) * l.qty));
    let discountAmt = 0;
    if (discount) discountAmt = discount.pct ? r2(subtotal * discount.pct / 100) : Math.min(r2(discount.amount || 0), subtotal);
    return { subtotal, discountAmt, total: r2(subtotal - discountAmt) };
}

/**
 * How many more can be made from tracked stock (Infinity if nothing is tracked).
 * `reserved` = usage already in the cart, so tiles don't promise the same cups twice.
 */
export function unitsAvailable(product, modifierIds = [], reserved = new Map()) {
    let min = Infinity;
    for (const { ingredientId, qty } of lineRecipe(product, modifierIds)) {
        const ing = byId('ingredients', ingredientId);
        if (!ing?.tracked || qty <= 0) continue;
        const left = ing.stock - (reserved.get(ingredientId) || 0);
        min = Math.min(min, Math.floor(left / qty));
    }
    return min;
}

/**
 * Tracked ingredients that can't cover one more of this product (the reason a tile says "Out"):
 * [{ name, unit, left }]. `reserved` = usage already in the cart.
 */
export function missingIngredients(product, modifierIds = [], reserved = new Map()) {
    const missing = [];
    for (const { ingredientId, qty } of lineRecipe(product, modifierIds)) {
        const ing = byId('ingredients', ingredientId);
        if (!ing?.tracked) continue;
        const left = rq(ing.stock - (reserved.get(ingredientId) || 0));
        if (left < qty) missing.push({ name: ing.name, unit: ing.unit, left });
    }
    return missing;
}

/** Estimated cost of one item from ingredient unit costs; null if any cost is missing. Optional rows are ignored. */
export function estUnitCost(recipe) {
    let total = 0;
    for (const r of recipe) {
        if (r.optional) continue;
        const ing = byId('ingredients', r.ingredientId);
        if (!ing || ing.unitCost == null || ing.unitCost === '') return null;
        total += Number(ing.unitCost) * r.qty;
    }
    return r2(total);
}

