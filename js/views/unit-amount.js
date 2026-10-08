// Amount + unit inputs for recipe-style rows (product recipes, add-ons, "Made from").
//
// Amounts are SAVED in the ingredient's own unit (so stock maths never changes),
// but can be ENTERED in any compatible unit: milk stocked in L → "180 ml".
// The row remembers the unit it was entered in (`unit`) so it reads the same next time.
// Changing the unit picker keeps the typed number and changes what it means.

import * as store from '../store.js';
import { byId } from '../store.js';
import { esc, qtyFmt } from '../util.js';

/** Unit a row is shown in: the one it was entered in if still valid, else the small unit (L → ml). */
export function entryUnit(ingredient, savedUnit) {
    if (!ingredient) return '';
    return store.compatibleUnits(ingredient.unit).includes(savedUnit) ? savedUnit : store.recipeUnitFor(ingredient.unit);
}

/** <select data-unit> with the units this ingredient can be entered in (fixed if there's only one). */
export function unitSelectHTML(ingredient, selected) {
    if (!ingredient) return '<select data-unit aria-label="Unit" disabled><option></option></select>';
    const units = store.compatibleUnits(ingredient.unit);
    return `<select data-unit aria-label="Unit" ${units.length < 2 ? 'disabled' : ''}>${units.map((u) =>
        `<option ${u === selected ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select>`;
}

/** A saved row's amount in the unit it's shown in ('' if not set). */
export function shownAmount(row) {
    const ingredient = byId('ingredients', row.ingredientId);
    if (!ingredient || row.qty == null || row.qty === '') return row.qty ?? '';
    return store.convertQty(row.qty, ingredient.unit, entryUnit(ingredient, row.unit));
}

/** Typed amount in the chosen unit → { qty in the ingredient's unit, unit it was entered in }. */
export function readAmount(ingredientId, typed, chosenUnit) {
    const ingredient = byId('ingredients', ingredientId);
    const unit = chosenUnit || ingredient.unit;
    return { qty: store.convertQty(typed, unit, ingredient.unit), unit };
}

/** "180 ml" for display. */
export function amountText(row) {
    const ingredient = byId('ingredients', row.ingredientId);
    return ingredient ? `${qtyFmt(shownAmount(row))} ${entryUnit(ingredient, row.unit)}` : '';
}
