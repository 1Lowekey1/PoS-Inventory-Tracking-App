// Orders screen: today's / this event's orders, void (restores stock),
// reprint, fix the payment method, mark made.

import * as store from '../store.js';
import { S, byId } from '../store.js';
import { plural, esc, money, fmtTime, fmtDateTime } from '../util.js';
import { icon, toast, openModal } from '../ui.js';
import * as printer from '../printer.js';
import { openAddonPicker } from './sell.js';

let scope = 'day'; // day | event | practice
let query = '';
let root = null;

export function render(el) {
    root = el;
    const st = store.settings();
    const ev = store.activeEvent();
    const day = store.openDay();
    if (st.practice) scope = 'practice';
    else if (scope === 'practice') scope = 'day';
    if (scope === 'day' && !day) scope = 'event';

    let list = S.orders.filter((o) => {
        if (scope === 'practice') return o.practice;
        if (o.practice) return false;
        if (scope === 'day') return day && o.dayId === day.id;
        return ev && o.eventId === ev.id;
    });
    if (query) {
        const q = query.toLowerCase();
        list = list.filter((o) => String(o.number) === q.replace('#', '') || o.note?.toLowerCase().includes(q) ||
            o.items.some((i) => i.name.toLowerCase().includes(q)));
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const paid = list.filter((o) => o.status !== 'void');

    el.innerHTML = `<div class="page">
        <header class="page-head"><h1>Orders</h1>
            <div class="seg seg-sm">
                ${st.practice ? '<button class="seg-btn on">Practice</button>' : `
                <button class="seg-btn ${scope === 'day' ? 'on' : ''}" data-scope="day" ${day ? '' : 'disabled'}>Today</button>
                <button class="seg-btn ${scope === 'event' ? 'on' : ''}" data-scope="event" ${ev ? '' : 'disabled'}>Whole event</button>`}
            </div></header>
        <div class="toolbar">
            <label class="search grow">${icon('search')}<input type="search" placeholder="Order #, name or product" value="${esc(query)}" data-q></label>
            <span class="muted">${plural(paid.length, 'order')} · ${money(paid.reduce((s, o) => s + o.total, 0))}</span>
        </div>
        ${!ev && !st.practice ? '<p class="muted">No event running. Past orders are in each event\'s report.</p>' : ''}
        ${list.length ? `<ul class="list orders">${list.map(row).join('')}</ul>` : (ev || st.practice ? '<p class="muted pad">No orders yet.</p>' : '')}
    </div>`;

    if (!el.dataset.wired) {
        el.dataset.wired = '1';
        el.addEventListener('click', (e) => {
            const s = e.target.closest('[data-scope]');
            if (s && !s.disabled) { scope = s.dataset.scope; render(root); return; }
            const o = e.target.closest('[data-order]');
            if (o) detail(o.dataset.order);
        });
        el.addEventListener('input', (e) => {
            if (e.target.matches('[data-q]')) {
                query = e.target.value.trim();
                const pos = e.target.selectionStart;
                render(root);
                const inp = root.querySelector('[data-q]');
                inp.focus();
                inp.setSelectionRange(pos, pos);
            }
        });
    }
}

function row(o) {
    const items = o.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
    return `<li class="list-item clickable ${o.status === 'void' ? 'void' : ''}" data-order="${o.id}">
        <div class="order-num">#${o.number}</div>
        <div class="grow"><b>${esc(items)}</b>
            <small class="muted">${fmtTime(o.createdAt)} · ${esc(store.paymentName(o.payment.method))}${o.note ? ` · ${esc(o.note)}` : ''}${o.discount ? ` · ${esc(o.discount.name)}` : ''}</small></div>
        <div class="r">
            <div>${money(o.total)}</div>
            ${o.status === 'void' ? '<span class="badge bad">Void</span>' : o.fulfilment === 'pending' ? '<span class="badge warn">To make</span>' : ''}
        </div></li>`;
}

function detail(id) {
    const o = byId('orders', id);
    if (!o) return;
    const methods = store.enabledPayments();
    const ctl = openModal({
        title: `Order #${o.number}`, size: 's',
        body: `
            <p class="muted small">${fmtDateTime(o.createdAt)}${o.note ? ` · ${esc(o.note)}` : ''}${o.practice ? ' · practice' : ''}</p>
            ${o.status === 'void' ? `<div class="hint bad">Voided ${fmtTime(o.voidedAt)}${o.voidReason ? `: ${esc(o.voidReason)}` : ''}. Stock was restored.</div>` : ''}
            <ul class="receipt">
                ${o.items.map((i) => `<li><span>${i.qty} × ${esc(i.name)}${[...(i.options || []), ...i.modifiers].length ? `<small>${[...(i.options || []), ...i.modifiers].map((m) => esc(m.name)).join(' · ')}</small>` : ''}</span><span>${money(i.lineTotal)}</span></li>`).join('')}
                ${o.discount ? `<li class="muted"><span>Subtotal</span><span>${money(o.subtotal)}</span></li><li><span>${esc(o.discount.name)}</span><span class="neg">−${money(o.discount.amount)}</span></li>` : ''}
                <li class="total"><span>Total</span><span>${money(o.total)}</span></li>
                <li class="muted"><span>${esc(store.paymentName(o.payment.method))}${o.payment.change > 0 ? ` · received ${money(o.payment.tendered)}` : ''}</span><span>${o.payment.change > 0 ? `change ${money(o.payment.change)}` : ''}</span></li>
            </ul>
            ${o.status !== 'void' && methods.length > 1 ? `<details class="field"><summary>Wrong payment method?</summary>
                <div class="seg">${methods.map((m) => `<button type="button" class="seg-btn ${m.id === o.payment.method ? 'on' : ''}" data-pay="${m.id}">${esc(m.name)}</button>`).join('')}</div></details>` : ''}`,
        footer: `${o.status !== 'void' ? `<button class="btn btn-danger-ghost" data-a="void">${icon('undo')} Void</button>` : ''}
            <button class="btn" data-a="print">${icon('print')} Receipt</button>
            ${o.status !== 'void' && S.modifiers.length ? `<button class="btn" data-a="addon" title="Customer wants to add something to this order">${icon('plus')} Add-on</button>` : ''}
            <span class="grow"></span>
            ${o.status !== 'void' && o.fulfilment === 'pending' ? `<button class="btn btn-primary" data-a="done">${icon('check')} Mark made</button>` : '<button class="btn btn-primary" data-close>Close</button>'}`,
        onMount(m) {
            m.addEventListener('click', async (e) => {
                const pay = e.target.closest('[data-pay]');
                if (pay) { await store.changePayment(o.id, pay.dataset.pay); toast(`#${o.number} set to ${store.paymentName(pay.dataset.pay)}`); ctl.close(); return; }
                const a = e.target.closest('[data-a]')?.dataset.a;
                if (a === 'print') printer.printReceipt(o).catch((err) => toast(err.message, { type: 'error' }));
                if (a === 'addon') {
                    ctl.close();
                    location.hash = '#sell';
                    setTimeout(() => openAddonPicker(o.number), 60);
                }
                if (a === 'done') { await store.setFulfilment(o.id, 'done'); ctl.close(); }
                if (a === 'void') {
                    ctl.close();
                    const reason = await voidReason(o);
                    if (reason === null) return;
                    await store.voidOrder(o.id, reason);
                    toast(`#${o.number} voided${o.practice ? '' : ', stock restored'}`, { type: 'success' });
                }
            });
        }
    });
}

function voidReason(o) {
    const reasons = ['Customer changed mind', 'Wrong item', 'Rang up twice', 'Made wrong / remade'];
    let pick = '';
    return openModal({
        title: `Void #${o.number}?`, size: 's',
        body: `<p>${money(o.total)} will be removed from sales${o.practice ? '' : ' and the ingredients put back in stock'}.</p>
            <div class="chips wrap">${reasons.map((r) => `<button type="button" class="chip" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
            <label class="field"><span>Reason</span><input data-reason placeholder="optional"></label>
            <p class="muted small">If the drink was made and thrown away, also log the ingredients as waste on the Stock tab.</p>`,
        footer: `<button class="btn" data-close>Cancel</button><button class="btn btn-danger" data-close="ok">Void order</button>`,
        onMount(m) {
            m.addEventListener('click', (e) => {
                const c = e.target.closest('[data-r]');
                if (c) { pick = c.dataset.r; m.querySelector('[data-reason]').value = pick; }
            });
            m.querySelector('[data-reason]').addEventListener('input', (e) => { pick = e.target.value.trim(); });
        }
    }).result.then((v) => (v === 'ok' ? pick : null));
}

