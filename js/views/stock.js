// Stock screen: levels, warnings and every way stock changes by hand.
// Each change is a logged movement (sale, void, restock, waste, count…), never a
// silent overwrite. Tap an ingredient's name for its history.
// "Untracked" items (ice, napkins) have no count; you only log what you spend on them.
//
//   stock/ingredient-dialog.js   add / edit an ingredient (incl. unit conversion)

import * as store from '../store.js';
import { S, byId } from '../store.js';
import { runoutEstimates } from '../reports.js';
import { esc, money, num, r2, plural, qtyFmt, fmtDateTime } from '../util.js';
import { icon, toast, openModal, formModal, val } from '../ui.js';
import { expenseDialog } from './event.js';
import { ingredientDialog } from './stock/ingredient-dialog.js';

export { ingredientDialog }; // used by the product editor's "New ingredient…"

/** How each movement type reads in an ingredient's history. */
const MOVEMENT_LABEL = {
    sale: 'Sold', void: 'Void (returned)', restock: 'Bought / restock', made: 'Made (batch)', prep: 'Used to make another item',
    waste: 'Waste', count: 'Count adjustment', initial: 'Starting stock', practice: 'Practice sale', 'practice-revert': 'Practice mode ended (put back)'
};

const WASTE_REASONS = ['Spilled', 'Remade drink', 'Expired / spoiled', 'Tasting / sample', 'Staff drink'];

const byName = (a, b) => a.name.localeCompare(b.name);

/** 'bad' (out), 'warn' (at or below the alert level) or 'ok'. */
const stockState = (i) => (i.stock <= 0 ? 'bad' : i.lowAt && i.stock <= i.lowAt ? 'warn' : 'ok');

export function render(el) {
    const event = store.activeEvent();
    const day = store.openDay();
    const tracked = S.ingredients.filter((i) => i.tracked).sort(byName);
    const untracked = S.ingredients.filter((i) => !i.tracked).sort(byName);
    const out = tracked.filter((i) => stockState(i) === 'bad').length;
    const low = tracked.filter((i) => stockState(i) === 'warn').length;
    const runout = runoutEstimates(day);
    const startOf = day?.openingStock || event?.startingStock || {}; // level bars are relative to this

    el.innerHTML = `<div class="page">
        <header class="page-head"><h1>Stock</h1>
            <div class="head-actions">
                ${tracked.length ? `<button class="btn" data-act="count-all">${icon('check')} Stock count</button>` : ''}
                <button class="btn btn-primary" data-act="new">${icon('plus')} Ingredient</button>
            </div></header>
        ${event ? `<div class="hint">${icon('stock')} <span>Event running: <b>Restock</b> adds stock through Event → Expense (bought or made) so the cost is counted.</span></div>` : ''}
        ${out || low ? `<div class="banner ${out ? 'banner-bad' : 'banner-warn'}">${icon('alert')}<span>${[out ? `<b>${out} out</b>` : '', low ? `<b>${low} low</b>` : ''].filter(Boolean).join(' · ')}</span></div>` : ''}
        ${!S.ingredients.length ? `<div class="card"><h2>No ingredients yet</h2><p class="muted">Add what goes into your products: beans, milk, syrups, cups, lids. Mark things you can't measure (ice) as untracked.</p></div>` : ''}
        ${tracked.length ? `<ul class="stock-list">${tracked.map((i) => stockCardHTML(i, startOf[i.id], runout.get(i.id))).join('')}</ul>` : ''}
        ${untracked.length ? untrackedHTML(untracked) : ''}
    </div>`;

    if (!el.dataset.wired) {
        el.dataset.wired = '1';
        el.addEventListener('click', onClick);
    }
}

/** One tracked ingredient: amount, level bar, badges, run-out estimate, actions. */
function stockCardHTML(i, startAmount, hoursLeft) {
    const state = stockState(i);
    const full = Math.max(startAmount || 0, i.stock, (i.lowAt || 0) * 2) || 1;
    const percent = Math.max(0, Math.min(100, (i.stock / full) * 100));
    const runout = hoursLeft != null && hoursLeft < 12
        ? `<span class="muted">~${hoursLeft < 1 ? `${Math.round(hoursLeft * 60)} min` : `${hoursLeft.toFixed(1)} h`} left at today's pace</span>` : '';
    return `<li class="stock-item ${state}">
        <div class="stock-top">
            <button class="stock-name" data-act="history" data-id="${i.id}">${esc(i.name)}</button>
            <span class="stock-qty">${qtyFmt(i.stock)} <small>${esc(i.unit)}</small></span>
        </div>
        <div class="meter meter-${state === 'ok' ? 'accent' : state}"><div class="meter-fill" style="width:${percent}%"></div></div>
        <div class="stock-meta">
            ${state === 'bad' ? '<span class="badge bad">Out</span>' : state === 'warn' ? '<span class="badge warn">Low</span>' : ''}
            ${runout}
            ${i.lowAt ? `<span class="muted">alert at ${qtyFmt(i.lowAt)}</span>` : ''}
        </div>
        <div class="stock-actions">
            <button class="btn btn-sm" data-act="restock" data-id="${i.id}">${icon('plus')} Restock</button>
            <button class="btn btn-sm" data-act="waste" data-id="${i.id}">${icon('trash')} Waste</button>
            <button class="btn btn-sm" data-act="count" data-id="${i.id}">${icon('check')} Count</button>
            <button class="btn btn-sm btn-ghost" data-act="edit" data-id="${i.id}">${icon('edit')}<span class="sr">Edit</span></button>
        </div></li>`;
}

function untrackedHTML(items) {
    return `<section class="card">
        <h2>Untracked <small class="muted">· cost only, no count</small></h2>
        <ul class="list">${items.map((i) => `<li class="list-item">
            <div class="grow"><b>${esc(i.name)}</b></div>
            <button class="btn btn-sm" data-act="buy" data-id="${i.id}">${icon('cash')} Log purchase</button>
            <button class="btn btn-sm btn-ghost" data-act="edit" data-id="${i.id}">${icon('edit')}<span class="sr">Edit</span></button></li>`).join('')}</ul>
    </section>`;
}

function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const ing = t.dataset.id && byId('ingredients', t.dataset.id);
    switch (t.dataset.act) {
        case 'new': ingredientDialog(); break;
        case 'edit': ingredientDialog(ing); break;
        case 'restock':
            // During an event, stock comes in through Event → Restock so its cost is counted.
            if (store.activeEvent()) expenseDialog(null, 'restock', { ingredientId: ing.id });
            else adjustDialog(ing, 'restock');
            break;
        case 'waste': case 'count': adjustDialog(ing, t.dataset.act); break;
        case 'history': historyDialog(ing); break;
        case 'count-all': countAllDialog(); break;
        case 'buy': expenseDialog(null, 'expense', { category: ing.name, description: ing.name }); break;
    }
}

// ---------- dialogs ----------

/**
 * type 'restock' (no event running) · 'waste' · 'count'.
 * Counting MORE than expected during an event asks whether it was really a
 * restock, so its cost isn't missed.
 */
function adjustDialog(ing, type) {
    const ev = store.activeEvent();
    const titles = { restock: `Restock ${ing.name}`, waste: `Waste: ${ing.name}`, count: `Count ${ing.name}` };
    formModal({
        title: titles[type], size: 's', submitLabel: type === 'count' ? 'Set count' : type === 'restock' ? 'Add stock' : 'Log waste',
        fields: `
            <p class="muted small">Current: <b>${qtyFmt(ing.stock)} ${esc(ing.unit)}</b></p>
            <label class="field"><span>${type === 'count' ? 'Actual amount on hand' : type === 'restock' ? 'Amount added' : 'Amount wasted'} (${esc(ing.unit)})</span>
                <input type="number" name="qty" inputmode="decimal" min="0" step="any" ${type === 'count' ? `value="${r2(ing.stock)}"` : ''} required autofocus></label>
            ${type === 'restock' ? '<p class="muted small">No event is running, so no cost is recorded. During an event, use Event → Restock instead.</p>' : ''}
            ${type === 'count' && ev ? '<p class="muted small">Counting more than the app expects? If you bought or made more, log it as a restock so the cost is counted.</p>' : ''}
            ${type === 'waste' ? `<div class="chips wrap">${WASTE_REASONS.map((r) => `<button type="button" class="chip" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
            <label class="field"><span>Note</span><input name="note" placeholder="optional"></label>`,
        onMount(m) {
            m.addEventListener('click', (e) => {
                const c = e.target.closest('[data-r]');
                if (c) m.querySelector('[name=note]').value = c.dataset.r;
            });
        },
        async onSubmit(form) {
            const raw = val(form, 'qty');
            if (raw === '') throw new Error('Enter an amount.');
            const qty = num(raw);
            if (qty < 0) throw new Error('Amount can\'t be negative.');
            const current = byId('ingredients', ing.id).stock;
            if (type === 'count' && ev && qty > current) {
                const choice = await openModal({
                    title: 'More than expected', size: 's',
                    body: `<p>You counted <b>${qtyFmt(qty)} ${esc(ing.unit)}</b> but the app expected <b>${qtyFmt(current)}</b> (+${qtyFmt(r2(qty - current))}).</p>
                        <p class="muted small">If you bought or made more, log it as a restock so its cost is part of the event. If the app was simply off, keep it as a correction.</p>`,
                    footer: `<button class="btn" data-close="fix">It's a correction</button><button class="btn btn-primary" data-close="restock">Log as restock</button>`
                }).result;
                if (!choice) return false;
                if (choice === 'restock') {
                    setTimeout(() => expenseDialog(null, 'restock', { ingredientId: ing.id, qty: r2(qty - current) }), 50);
                    return;
                }
            }
            await store.adjustStock({ ingredientId: ing.id, type, qty, note: val(form, 'note') });
            const now = byId('ingredients', ing.id).stock;
            toast(`${ing.name}: now ${qtyFmt(now)} ${ing.unit}`, { type: 'success' });
        }
    });
}

/** Count every tracked ingredient at once; blank fields are left as they are. */
function countAllDialog() {
    const tracked = S.ingredients.filter((i) => i.tracked).sort(byName);
    formModal({
        title: 'Stock count', submitLabel: 'Save counts',
        fields: `<p class="muted small">Type what you actually have. Leave blank to keep the current number. Differences are logged as count adjustments.</p>
            ${store.activeEvent() ? '<p class="muted small">Bought or made more during the event? Use Event → Restock for that, so its cost is counted.</p>' : ''}
            <div class="count-grid">${tracked.map((i) => `<label class="count-row"><span>${esc(i.name)}</span>
                <input type="number" inputmode="decimal" step="any" min="0" data-count="${i.id}" placeholder="${qtyFmt(i.stock)}"><small>${esc(i.unit)}</small></label>`).join('')}</div>`,
        async onSubmit(form) {
            let n = 0;
            for (const inp of form.querySelectorAll('[data-count]')) {
                if (inp.value === '') continue;
                await store.adjustStock({ ingredientId: inp.dataset.count, type: 'count', qty: num(inp.value), note: 'Stock count' });
                n++;
            }
            toast(n ? `Updated ${plural(n, 'item')}` : 'Nothing changed');
        }
    });
}

/** The last 200 stock changes of one ingredient, newest first. */
function historyDialog(ing) {
    const moves = S.movements.filter((m) => m.ingredientId === ing.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
    openModal({
        title: ing.name,
        body: `<p class="muted small">Now ${qtyFmt(ing.stock)} ${esc(ing.unit)}${ing.unitCost ? ` · ${money(ing.unitCost)}/${esc(ing.unit)}` : ''}</p>
            ${moves.length ? `<ul class="list compact">${moves.map((m) => {
                const order = m.orderId && byId('orders', m.orderId);
                return `<li class="list-item"><div class="grow"><b>${MOVEMENT_LABEL[m.type] || m.type}</b>${order ? ` #${order.number}` : ''}
                    <small class="muted">${fmtDateTime(m.at)}${m.note ? ` · ${esc(m.note)}` : ''}</small></div>
                    <span class="${m.delta < 0 ? 'neg' : 'pos'}">${m.delta > 0 ? '+' : ''}${qtyFmt(m.delta)}</span></li>`;
            }).join('')}</ul>` : '<p class="muted">No movements yet.</p>'}`,
        footer: '<button class="btn btn-primary" data-close>Close</button>'
    });
}
