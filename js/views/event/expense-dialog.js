// One form for money going out during an event:
//   Expense   anything bought during the event (ice, fees)
//   Restock   more of a tracked ingredient, BOUGHT or MADE (adds stock)
//   Capital   up-front purchases for the event
// Editing an existing entry also fills in "Cost pending" entries, including
// for events that have already ended (opened from Reports).

import * as store from '../../store.js';
import { S, byId } from '../../store.js';
import { esc, money, num, r2, qtyFmt } from '../../util.js';
import { icon, toast, formModal, confirmDialog, val, checked } from '../../ui.js';

/**
 * existing: an expense to edit (null for a new entry).
 * kind: which tab to open on, 'expense' | 'restock' | 'capital'.
 * preset: { ingredientId, qty, category, description } prefilled values.
 */
export function expenseDialog(existing = null, kind = 'expense', preset = {}) {
    const event = existing ? byId('events', existing.eventId) : store.activeEvent();
    if (!event) { toast('Start an event to log expenses.', { type: 'error' }); return; }

    const state = {
        mode: existing ? existing.kind : kind,   // 'expense' | 'restock' | 'capital'
        source: 'bought',                        // restock only: 'bought' | 'made'
        inputsEdited: false,                     // stop auto-suggesting once the user edits "Made from"
        day: existing ? byId('days', existing.dayId) : store.openDay(),
        existing, preset
    };

    return formModal({
        title: existing ? (existing.pending ? 'Enter the cost' : 'Edit entry') : 'Add expense / restock',
        size: 'm',
        submitLabel: existing ? 'Save' : 'Add',
        extraFooter: existing ? `<button type="button" class="btn btn-danger-ghost" data-del>${icon('trash')} Delete</button>` : '',
        fields: formHTML(state),
        onMount: (m, ctl) => wireForm(m, ctl, state),
        onSubmit: (form) => (state.mode === 'restock' ? saveRestock(form, state) : saveExpense(form, state))
    });
}

// ---------- layout ----------

const trackedIngredients = () => S.ingredients.filter((i) => i.tracked).sort((a, b) => a.name.localeCompare(b.name));

/** One "Made from" row: ingredient + amount used. */
const inputRowHTML = (row = {}) => `<div class="recipe-row">
    <select data-in-ing><option value="">Ingredient…</option>${S.ingredients.map((i) => `<option value="${i.id}" ${i.id === row.ingredientId ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select>
    <input type="number" data-in-qty inputmode="decimal" step="any" min="0" value="${row.qty ?? ''}" placeholder="qty">
    <span class="unit" data-in-unit>${esc(byId('ingredients', row.ingredientId)?.unit || '')}</span>
    <button type="button" class="icon-btn" data-rmrow aria-label="Remove">${icon('x')}</button></div>`;

function formHTML({ mode, day, existing, preset }) {
    const tracked = trackedIngredients();
    const categories = [...new Set([...store.settings().expenseCategories, ...S.ingredients.filter((i) => !i.tracked).map((i) => i.name)])];
    const category = existing?.category || preset.category || '';
    const tab = (id, label, disabled = false) => `<button type="button" class="seg-btn ${mode === id ? 'on' : ''}" data-mode="${id}" ${disabled ? 'disabled' : ''}>${label}</button>`;

    return `
        ${existing ? '' : `<div class="seg" role="radiogroup" aria-label="Type">
            ${tab('expense', 'Expense')}${tab('restock', 'Restock', !tracked.length)}${tab('capital', 'Capital')}
        </div>`}

        <div data-section="restock">
            <p class="muted small">Adds stock to an ingredient. Choose whether you bought it or made it.</p>
            <label class="field"><span>Ingredient</span><select name="ingredientId"><option value="">Pick an ingredient…</option>
                ${tracked.map((i) => `<option value="${i.id}" ${i.id === preset.ingredientId ? 'selected' : ''}>${esc(i.name)} (${qtyFmt(i.stock)} ${esc(i.unit)} now)</option>`).join('')}
            </select></label>
            <div class="seg" role="radiogroup" aria-label="Source">
                <button type="button" class="seg-btn on" data-source="bought">Bought</button>
                <button type="button" class="seg-btn" data-source="made">Made</button>
            </div>
            <label class="field"><span>Amount added <span data-unit></span></span><input type="number" name="qty" inputmode="decimal" min="0" step="any" value="${preset.qty ?? ''}"></label>
            <fieldset class="field" data-made hidden><legend>Made from <small>(optional: ingredients used up)</small></legend>
                <div data-inputs></div>
                <button type="button" class="btn btn-ghost btn-sm" data-addrow>${icon('plus')} Ingredient used</button>
                <small class="muted">Taken from stock automatically. Made from stock you already paid for as capital? Leave the cost below empty, nothing is counted twice.</small>
            </fieldset>
        </div>

        <div data-section="money">
            <label class="field"><span data-amountlabel>Amount *</span><input type="number" name="amount" inputmode="decimal" min="0" step="any" value="${existing?.pending ? '' : existing?.amount ?? ''}"></label>
            <label class="check" data-later hidden><input type="checkbox" name="later"> I'll add the cost later <small class="muted">(shows as "Cost pending" until filled in)</small></label>
        </div>

        <div data-section="details">
            <div class="field"><span>Category</span><div class="chips wrap">${categories.map((c) => `<button type="button" class="chip ${category === c ? 'on' : ''}" data-catpick="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
            <input type="hidden" name="category" value="${esc(category)}">
            <label class="field"><span>Description</span><input name="description" value="${esc(existing?.description || preset.description || '')}" placeholder="e.g. 2 bags of ice"></label>
        </div>
        ${day ? `<label class="check" data-drawer><input type="checkbox" name="drawer" ${existing?.paidFromDrawer ? 'checked' : ''}> Paid with cash from the drawer <small class="muted">(lowers expected cash)</small></label>` : ''}`;
}

// ---------- behaviour ----------

/** Show only the fields that apply to the current tab and source. */
function syncVisibility(m, form, { mode, source, existing }) {
    const restock = mode === 'restock';
    const later = form.elements.later.checked;
    m.querySelector('[data-section="restock"]').hidden = !restock;
    m.querySelector('[data-section="details"]').hidden = restock;
    m.querySelector('[data-made]').hidden = !(restock && source === 'made');
    m.querySelector('[data-later]').hidden = !(restock || existing?.pending);
    form.elements.amount.disabled = later;
    m.querySelector('[data-amountlabel]').textContent = restock
        ? (source === 'made' ? 'Cost (optional, e.g. sugar you bought for it)' : 'What it cost')
        : (existing?.pending ? 'Cost' : 'Amount *');
    const drawer = m.querySelector('[data-drawer]');
    if (drawer) drawer.hidden = mode === 'capital' || later;
    const ing = byId('ingredients', form.elements.ingredientId.value);
    m.querySelector('[data-unit]').textContent = ing ? `(${ing.unit})` : '';
}

/** "Made": suggest last batch's ingredients, scaled to the amount being made. */
function suggestBatchInputs(m, form, state) {
    const ing = byId('ingredients', form.elements.ingredientId.value);
    const batch = ing?.batchRecipe;
    if (state.inputsEdited || state.source !== 'made' || !batch?.inputs?.length) return;
    const made = num(form.elements.qty.value);
    const scale = made > 0 && batch.per ? made / batch.per : 1;
    m.querySelector('[data-inputs]').innerHTML = batch.inputs.map((r) => inputRowHTML({ ingredientId: r.ingredientId, qty: r2(r.qty * scale) })).join('');
}

/** Turn on one button in a group of toggle buttons. */
const selectIn = (m, attr, btn) => m.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle('on', x === btn));

function wireForm(m, ctl, state) {
    const form = m.querySelector('form');
    const inputs = m.querySelector('[data-inputs]');
    const sync = () => syncVisibility(m, form, state);
    const suggest = () => suggestBatchInputs(m, form, state);

    m.addEventListener('click', async (e) => {
        const t = e.target;
        const modeBtn = t.closest('[data-mode]');
        if (modeBtn) { state.mode = modeBtn.dataset.mode; selectIn(m, 'data-mode', modeBtn); }
        const sourceBtn = t.closest('[data-source]');
        if (sourceBtn) { state.source = sourceBtn.dataset.source; selectIn(m, 'data-source', sourceBtn); suggest(); }
        const categoryBtn = t.closest('[data-catpick]');
        if (categoryBtn) { form.elements.category.value = categoryBtn.dataset.catpick; selectIn(m, 'data-catpick', categoryBtn); }
        if (t.closest('[data-addrow]')) { state.inputsEdited = true; inputs.insertAdjacentHTML('beforeend', inputRowHTML()); }
        if (t.closest('[data-rmrow]')) { state.inputsEdited = true; t.closest('.recipe-row').remove(); }
        if (t.closest('[data-del]')) await confirmDelete(state.existing, ctl);
        sync();
    });
    m.addEventListener('change', (e) => {
        if (e.target.name === 'ingredientId') { state.inputsEdited = false; inputs.innerHTML = ''; suggest(); }
        if (e.target.matches('[data-in-ing]')) {
            state.inputsEdited = true;
            e.target.parentElement.querySelector('[data-in-unit]').textContent = byId('ingredients', e.target.value)?.unit || '';
        }
        sync();
    });
    m.addEventListener('input', (e) => {
        if (e.target.name === 'qty') suggest();
        if (e.target.matches('[data-in-qty]')) state.inputsEdited = true;
    });
    sync();
}

async function confirmDelete(existing, ctl) {
    const label = `${existing.description || existing.category}${existing.pending ? '' : ` · ${money(existing.amount)}`}`;
    const ok = await confirmDialog('Delete entry?', `${label}\n\nStock that was added with it is not changed; use Stock → Count if needed.`, { danger: true, okLabel: 'Delete' });
    if (!ok) return;
    await store.deleteExpense(existing.id);
    ctl.close();
}

// ---------- saving ----------

async function saveRestock(form, state) {
    const amount = num(val(form, 'amount'));
    const later = checked(form, 'later');
    const inputs = [...form.querySelectorAll('.recipe-row')]
        .map((row) => ({ ingredientId: row.querySelector('[data-in-ing]').value, qty: num(row.querySelector('[data-in-qty]').value) }))
        .filter((x) => x.ingredientId && x.qty > 0);
    const ingredientId = val(form, 'ingredientId');
    await store.restockIngredient({
        ingredientId, qty: num(val(form, 'qty')), source: state.source,
        cost: later ? 0 : amount, costLater: later, paidFromDrawer: checked(form, 'drawer'), inputs
    });
    const ing = byId('ingredients', ingredientId);
    const costNote = later ? ' · cost pending' : amount ? ` · ${money(amount)} expense` : '';
    toast(`${ing.name}: now ${qtyFmt(ing.stock)} ${ing.unit}${costNote}`, { type: 'success' });
}

async function saveExpense(form, { mode, day, existing }) {
    const amount = num(val(form, 'amount'));
    if (existing?.pending && (checked(form, 'later') || !(amount > 0))) return; // still pending: nothing to save
    if (!(amount > 0)) throw new Error('Enter an amount.');
    const category = val(form, 'category') || (mode === 'capital' ? 'Ingredients' : 'Other');
    await store.saveExpense({
        ...existing, kind: mode, amount, category, pending: false,
        description: val(form, 'description') || category,
        paidFromDrawer: mode !== 'capital' && checked(form, 'drawer'),
        dayId: existing ? existing.dayId : (mode === 'capital' ? null : day?.id || null)
    });
    toast(`${mode === 'capital' ? 'Capital' : 'Expense'} saved: ${money(amount)}`, { type: 'success' });
}
