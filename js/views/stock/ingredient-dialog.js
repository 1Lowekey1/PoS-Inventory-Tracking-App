// Add / edit an ingredient.
//
// Changing the unit of an existing ingredient:
//   g ↔ kg, ml ↔ L   converts everything automatically (store.saveIngredient does the
//                    real conversion; this form previews it and converts its own fields)
//   anything else    asks for the amount on hand in the new unit

import * as store from '../../store.js';
import { S } from '../../store.js';
import { esc, num, qtyFmt } from '../../util.js';
import { icon, toast, formModal, confirmDialog, val } from '../../ui.js';

const UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'oz', 'shots', 'packs'];

/** Returns the Modal; its result resolves truthy when saved (used by the product editor's "New ingredient…"). */
export function ingredientDialog(ing = null) {
    const isNew = !ing;
    const modal = formModal({
        title: isNew ? 'New ingredient' : `Edit ${ing.name}`,
        submitLabel: isNew ? 'Add' : 'Save',
        extraFooter: isNew ? '' : `<button type="button" class="btn btn-danger-ghost" data-del>${icon('trash')} Delete</button>`,
        fields: formHTML(ing),
        onMount: (m) => wireForm(m, ing, () => modal),
        async onSubmit(form) {
            await store.saveIngredient(readForm(form, ing));
            toast(isNew ? `Added ${val(form, 'name')}` : 'Saved', { type: 'success' });
        }
    });
    return modal;
}

// ---------- layout ----------

function formHTML(ing) {
    const isNew = !ing;
    const unit = ing?.unit || 'g';
    const units = [...new Set([...UNITS, ing?.unit].filter(Boolean))];
    const untracked = ing?.tracked === false;
    return `
        <label class="field"><span>Name *</span><input name="name" value="${esc(ing?.name || '')}" placeholder="e.g. Espresso beans, Fresh milk, 16oz cups" required></label>
        <div class="seg">
            <button type="button" class="seg-btn ${untracked ? '' : 'on'}" data-tr="1">Tracked</button>
            <button type="button" class="seg-btn ${untracked ? 'on' : ''}" data-tr="0">Untracked (cost only)</button>
        </div>
        <input type="hidden" name="tracked" value="${untracked ? '0' : '1'}">
        <p class="muted small" data-trhint></p>
        <div data-tracked>
            <div class="row2">
                <label class="field"><span>Unit</span><select name="unit">${units.map((u) => `<option ${u === unit ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
                ${isNew
                    ? '<label class="field"><span>Amount on hand now</span><input type="number" name="stock" inputmode="decimal" min="0" step="any" placeholder="e.g. 1000"></label>'
                    : `<div class="field"><span>On hand</span><b class="onhand" data-onhand>${qtyFmt(ing.stock)} ${esc(ing.unit)}</b></div>`}
            </div>
            ${isNew ? '' : `<div class="hint" data-unitnote hidden></div>
            <label class="field" data-override hidden><span>Amount on hand in <span data-u></span> *</span>
                <input type="number" name="stockOverride" inputmode="decimal" min="0" step="any"></label>`}
            <label class="field"><span>Low stock alert at</span><input type="number" name="lowAt" inputmode="decimal" min="0" step="any" value="${ing?.lowAt ?? ''}" placeholder="optional"></label>
            <details class="field" ${ing?.unitCost ? 'open' : ''}><summary>Cost per unit <small class="muted">(optional, for estimated margins only)</small></summary>
                <div class="row2">
                    <label class="field"><span>Pack price</span><input type="number" name="packPrice" inputmode="decimal" min="0" step="any" placeholder="e.g. 430"></label>
                    <label class="field"><span>Pack size (<span data-u>${esc(unit)}</span>)</span><input type="number" name="packSize" inputmode="decimal" min="0" step="any" placeholder="e.g. 500"></label>
                </div>
                <label class="field"><span>= Cost per <span data-u>${esc(unit)}</span></span><input type="number" name="unitCost" inputmode="decimal" min="0" step="any" value="${ing?.unitCost ?? ''}"></label>
                <p class="muted small">Profit is still capital vs. sales. This only estimates which products earn the most.</p>
            </details>
        </div>`;
}

// ---------- behaviour ----------

function wireForm(m, ing, getModal) {
    const form = m.querySelector('form');
    let shownUnit = ing?.unit || form.elements.unit.value; // unit the form's numbers are currently in

    const refresh = () => {
        const tracked = form.elements.tracked.value === '1';
        m.querySelector('[data-tracked]').hidden = !tracked;
        m.querySelector('[data-trhint]').textContent = tracked
            ? 'Deducted automatically whenever a product using it is sold.'
            : 'For things you can\'t measure per cup, like ice. Log what you spend on it; no stock count.';
        m.querySelectorAll('[data-u]').forEach((s) => { s.textContent = form.elements.unit.value; });
    };

    m.addEventListener('click', async (e) => {
        const trackedBtn = e.target.closest('[data-tr]');
        if (trackedBtn) {
            form.elements.tracked.value = trackedBtn.dataset.tr;
            m.querySelectorAll('[data-tr]').forEach((x) => x.classList.toggle('on', x === trackedBtn));
            refresh();
        }
        if (e.target.closest('[data-del]')) await confirmDelete(ing, getModal());
    });

    // Pack price ÷ pack size fills in the cost per unit.
    form.addEventListener('input', (e) => {
        if (e.target.name !== 'packPrice' && e.target.name !== 'packSize') return;
        const price = num(form.elements.packPrice.value), size = num(form.elements.packSize.value);
        if (price > 0 && size > 0) form.elements.unitCost.value = Math.round((price / size) * 10000) / 10000;
    });

    form.elements.unit.addEventListener('change', () => {
        const next = form.elements.unit.value;
        if (ing) {
            convertTypedAmounts(form, shownUnit, next);
            previewUnitChange(m, ing, next);
        }
        shownUnit = next;
        refresh();
    });
    refresh();
}

/** Keep alert, pack size and unit cost meaning the same thing in the new unit (kg → g: 0.2 → 200). */
function convertTypedAmounts(form, from, to) {
    const factor = store.unitFactor(from, to);
    if (!factor) return;
    for (const name of ['lowAt', 'packSize']) {
        const field = form.elements[name];
        if (field.value !== '') field.value = Math.round(num(field.value) * factor * 1e4) / 1e4;
    }
    const cost = form.elements.unitCost;
    if (cost.value !== '') cost.value = Math.round((num(cost.value) / factor) * 1e6) / 1e6;
}

/** Show what saving will do: "1 kg → 1,000 g", or ask for the amount when units don't convert. */
function previewUnitChange(m, ing, next) {
    const factor = store.unitFactor(ing.unit, next);
    const note = m.querySelector('[data-unitnote]');
    const usedIn = store.ingredientUsedIn(ing.id);
    const unchanged = next === ing.unit;

    note.hidden = unchanged;
    note.className = factor || unchanged ? 'hint' : 'hint warn';
    m.querySelector('[data-override]').hidden = unchanged || !!factor;

    if (factor) {
        m.querySelector('[data-onhand]').textContent = `${qtyFmt(ing.stock * factor)} ${next}`;
        note.innerHTML = `Converts automatically: <b>${qtyFmt(ing.stock)} ${esc(ing.unit)} → ${qtyFmt(ing.stock * factor)} ${esc(next)}</b>.
            ${usedIn.length ? `Recipes using it (${esc(usedIn.join(', '))}), the alert, cost and history are converted too.` : 'The alert, cost and history are converted too.'}`;
    } else {
        m.querySelector('[data-onhand]').textContent = `${qtyFmt(ing.stock)} ${ing.unit}`;
        note.innerHTML = `${esc(ing.unit)} and ${esc(next)} can't be converted automatically. Enter how much you have in ${esc(next)} below${usedIn.length ? `, then check the recipes that use it: <b>${esc(usedIn.join(', '))}</b>` : ''}.`;
    }
}

async function confirmDelete(ing, modal) {
    if (!await confirmDialog('Delete ingredient?', `"${ing.name}" will be removed. Its history stays in past reports.`, { danger: true, okLabel: 'Delete' })) return;
    try {
        await store.deleteIngredient(ing.id);
        modal.close();
        toast('Deleted');
    } catch (err) {
        toast(`Can't delete. ${err.message}`, { type: 'error' });
    }
}

// ---------- saving ----------

/** Form → store.saveIngredient record. Throws a readable error for invalid input. */
function readForm(form, ing) {
    const isNew = !ing;
    const name = val(form, 'name');
    if (!name) throw new Error('Name is required.');
    if (S.ingredients.some((i) => i.id !== ing?.id && i.name.toLowerCase() === name.toLowerCase())) throw new Error(`"${name}" already exists.`);

    const tracked = val(form, 'tracked') === '1';
    const unit = tracked ? val(form, 'unit') : (ing?.unit || 'pcs');
    const needsAmount = !isNew && unit !== ing.unit && !store.unitFactor(ing.unit, unit);
    if (needsAmount && val(form, 'stockOverride') === '') throw new Error(`Enter how much you have in ${unit}.`);
    const optionalNumber = (field) => (val(form, field) === '' ? null : num(val(form, field)));

    return {
        ...ing,
        name, tracked, unit,
        stock: isNew ? num(val(form, 'stock')) : ing.stock,
        stockOverride: needsAmount ? num(val(form, 'stockOverride')) : null,
        lowAt: optionalNumber('lowAt'),
        unitCost: optionalNumber('unitCost')
    };
}
