// The order being built on the Sell screen.
//
// Lines are grouped ("3 × Iced Americano"): a line's key is its content
// (product + add-ons + options), so adding the same thing again bumps the
// quantity. The cart saves itself to localStorage so a reload or crash doesn't
// lose a half-taken order, and tells listeners (the Sell screen) after every change.
//
// A line is { key, productId, qty, modifierIds, optionIds, splitId? }
//         or { key, addonId, qty, forOrder } (an add-on for an order already paid).

import * as store from '../../store.js';
import { uid } from '../../util.js';

export class Cart {
    #lines = [];
    #discount = null;
    #listeners = new Set();

    /** storageKey: localStorage key; null keeps the cart in memory only. */
    constructor(storageKey = null) {
        this.storageKey = storageKey;
        this.#load();
    }

    // ---------- reading ----------

    get lines() { return this.#lines; }
    get discount() { return this.#discount; }
    get itemCount() { return this.#lines.reduce((n, l) => n + l.qty, 0); }
    get isEmpty() { return this.#lines.length === 0; }

    /** { subtotal, discountAmt, total } */
    get totals() { return store.cartTotals(this.#lines, this.#discount); }

    find(key) { return this.#lines.find((l) => l.key === key); }

    /** fn(change) runs after every change; change is 'add' | 'change' | 'clear'. */
    onChange(fn) { this.#listeners.add(fn); }

    // ---------- changing ----------

    /** spec: { productId, modifierIds?, optionIds?, splitId? } or { addonId, forOrder? }. Ignored if it no longer exists. */
    add(spec, qty = 1) {
        const line = Cart.#makeLine(spec, qty);
        if (!store.resolveLine(line)) return;
        this.#insertOrMerge(line);
        this.#changed('add');
    }

    /** Set a line's quantity; 0 removes it. */
    setQty(key, qty) {
        const line = this.find(key);
        if (!line) return;
        if (qty <= 0) this.#lines = this.#lines.filter((l) => l !== line);
        else line.qty = qty;
        this.#changed('change');
    }

    /**
     * Replace a line, in place, with one or more lines: specs [{ ...spec, qty }].
     * Used to edit a line and for "Apply to N of M cups" (unchanged + changed line).
     */
    replace(oldKey, specs) {
        let index = this.#lines.findIndex((l) => l.key === oldKey);
        this.#lines = this.#lines.filter((l) => l.key !== oldKey);
        if (index < 0) index = this.#lines.length;
        for (const spec of specs) {
            if (spec.qty > 0) index = this.#insertOrMerge(Cart.#makeLine(spec, spec.qty), index);
        }
        this.#changed('change');
    }

    /** Turn an optional extra (e.g. syrup) on or off for a whole line. */
    toggleOption(key, ingredientId) {
        const l = this.find(key);
        if (!l) return;
        const optionIds = l.optionIds.includes(ingredientId)
            ? l.optionIds.filter((id) => id !== ingredientId)
            : [...l.optionIds, ingredientId];
        this.replace(key, [{ productId: l.productId, modifierIds: l.modifierIds, optionIds, splitId: l.splitId, qty: l.qty }]);
    }

    /**
     * "5 × Iced Americano" → five 1-cup lines, each editable on its own. Each gets
     * a splitId so identical cups don't merge back until checkout. Returns the count.
     */
    splitIntoSingles(key) {
        const l = this.find(key);
        if (!l || l.qty < 2) return 0;
        const base = { productId: l.productId, modifierIds: l.modifierIds, optionIds: l.optionIds };
        this.replace(key, Array.from({ length: l.qty }, () => ({ ...base, qty: 1, splitId: uid() })));
        return l.qty;
    }

    /** discount: { name, pct } | { name, amount } | null */
    setDiscount(discount) {
        this.#discount = discount;
        this.#changed('change');
    }

    clear() {
        this.#lines = [];
        this.#discount = null;
        this.#changed('clear');
    }

    /** Remove lines whose product or add-on was deleted from the menu. */
    dropDeleted() {
        const before = this.#lines.length;
        this.#lines = this.#lines.filter((l) => store.resolveLine(l));
        if (this.#lines.length !== before) this.#changed('change');
    }

    // ---------- internals ----------

    static #makeLine(spec, qty) {
        const line = spec.addonId
            ? { addonId: spec.addonId, forOrder: spec.forOrder ?? null, qty }
            : { productId: spec.productId, modifierIds: [...(spec.modifierIds || [])], optionIds: [...(spec.optionIds || [])], qty };
        if (spec.splitId) line.splitId = spec.splitId;
        line.key = store.lineKey(line);
        return line;
    }

    /** Insert at `index`, or merge into an identical line. Returns the next insert position. */
    #insertOrMerge(line, index = this.#lines.length) {
        const same = this.find(line.key);
        if (same) { same.qty += line.qty; return index; }
        this.#lines.splice(index, 0, line);
        return index + 1;
    }

    #changed(change) {
        if (!this.#lines.length) this.#discount = null; // a discount on an empty order makes no sense
        this.#save();
        this.#listeners.forEach((fn) => fn(change));
    }

    #load() {
        if (!this.storageKey) return;
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey)) || {};
            // Normalise lines saved by older versions (missing arrays / old key format).
            this.#lines = (saved.lines || []).map((l) => {
                const line = { modifierIds: [], optionIds: [], ...l };
                return { ...line, key: store.lineKey(line) };
            });
            this.#discount = saved.discount || null;
        } catch { /* unreadable: start empty */ }
    }

    #save() {
        if (!this.storageKey) return;
        try { localStorage.setItem(this.storageKey, JSON.stringify({ lines: this.#lines, discount: this.#discount })); }
        catch { /* storage unavailable: keep in memory */ }
    }
}

/** The Sell screen's cart (one per device). */
export const cart = new Cart('poppos.cart');
