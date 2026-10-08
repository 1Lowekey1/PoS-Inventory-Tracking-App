// Selling: checkout, voids, the order queue and practice mode.
//
// Each order stores a snapshot of what was sold (names, prices, recipes), so
// reports and voids stay correct even after the menu changes.

import { S, byId, put, del, commit, stamp, activeEvent, openDay, saveSettings } from './state.js';
import { resolveLine, mergeLines, cartTotals, orderUsage } from './recipes.js';
import { stockChanges, stockChange } from './stock.js';
import { uid, nowISO, r2, rq } from '../util.js';

/** Snapshot each line as an order item: { ...resolved line, qty, lineTotal }. */
function orderItems(lines) {
    return lines.map((l) => {
        const resolved = resolveLine(l);
        if (!resolved) throw new Error('An item in this order was deleted from the menu. Remove it and try again.');
        return { ...resolved, qty: l.qty, lineTotal: r2(resolved.unitPrice * l.qty) };
    });
}

/** Only used when Settings → "Block sales when out of stock" is on. */
function assertInStock(usage) {
    for (const [id, qty] of usage) {
        const ing = byId('ingredients', id);
        if (ing?.tracked && qty > 0 && ing.stock < qty) throw new Error(`Not enough ${ing.name} (${ing.stock} ${ing.unit} left).`);
    }
}

/** Order numbers run per event (#1, #2… across all its days); practice orders have their own count. */
function nextOrderNumber(practice, eventId) {
    return S.orders.filter((o) => (practice ? o.practice : !o.practice && o.eventId === eventId)).length + 1;
}

/**
 * Complete a sale: save the order and use up its ingredients in one transaction.
 * method: payment method id. tendered: cash received (cash only; never below the total).
 * Practice orders need no event and are tagged with the practice session.
 */
export async function checkout({ lines, discount, method, tendered, note }) {
    const st = S.settings;
    const practice = !!st.practice;
    const ev = activeEvent();
    const day = openDay();
    if (!practice && (!ev || !day)) throw new Error('Open a day first (Event tab) before selling.');
    if (!lines.length) throw new Error('Order is empty.');

    // Split single cups are stored grouped: "3 × with syrup", not three lines.
    const grouped = mergeLines(lines);
    const items = orderItems(grouped);
    const usage = new Map();
    for (const item of items) for (const r of item.recipe) usage.set(r.ingredientId, (usage.get(r.ingredientId) || 0) + r.qty * item.qty);
    if (st.blockOutOfStock) assertInStock(usage);

    const { subtotal, discountAmt, total } = cartTotals(grouped, discount);
    const received = method === 'cash' ? Math.max(Number(tendered) || total, total) : total;
    const order = stamp({
        number: nextOrderNumber(practice, ev?.id),
        eventId: practice ? null : ev.id,
        dayId: practice ? null : day.id,
        items, subtotal, total,
        discount: discountAmt ? { name: discount.name, pct: discount.pct || null, amount: discountAmt } : null,
        payment: { method, tendered: r2(received), change: r2(received - total) },
        status: 'paid',
        fulfilment: st.useQueue ? 'pending' : 'done',
        note: note || '',
        practice,
        practiceSession: practice ? st.practiceSession : null
    });

    const meta = practice
        ? { orderId: order.id, practiceSession: st.practiceSession, eventId: null, dayId: null }
        : { orderId: order.id, eventId: ev.id, dayId: day.id };
    await commit([{ store: 'orders', put: order }, ...stockChanges(usage, -1, practice ? 'practice' : 'sale', meta)]);
    return order;
}

/**
 * Void an order and return its ingredients (from the sale-time snapshot).
 * A practice order only returns stock while its practice session is still on;
 * after that, ending practice mode already put everything back.
 */
export async function voidOrder(id, reason = '') {
    const o = byId('orders', id);
    if (!o || o.status === 'void') return;
    const ops = [put('orders', { ...o, status: 'void', voidedAt: nowISO(), voidReason: reason, fulfilment: 'done' })];
    if (!o.practice) {
        ops.push(...stockChanges(orderUsage(o), +1, 'void', { orderId: o.id, eventId: o.eventId, dayId: o.dayId }));
    } else if (o.practiceSession && o.practiceSession === S.settings.practiceSession) {
        ops.push(...stockChanges(orderUsage(o), +1, 'practice', { orderId: o.id, practiceSession: o.practiceSession, eventId: null, dayId: null }));
    }
    await commit(ops);
}

/** 'pending' (in the To make queue) or 'done' (handed over). */
export async function setFulfilment(id, fulfilment) {
    const o = byId('orders', id);
    if (o) await commit([put('orders', { ...o, fulfilment })]);
}

/** Fix a wrong payment method. Change is reset, since it no longer applies. */
export async function changePayment(id, method) {
    const o = byId('orders', id);
    if (o) await commit([put('orders', { ...o, payment: { method, tendered: o.total, change: 0 } })]);
}

// ---------- practice mode ----------

/** Delete all practice orders (they never affect reports anyway). */
export async function clearPractice() {
    await commit(S.orders.filter((o) => o.practice).map((o) => del('orders', o.id)));
}

/**
 * Practice sales use stock so you see the real effect. Turning practice off
 * reverses the net stock change of that session only; real changes made
 * meanwhile (e.g. a restock) are kept.
 */
export async function setPractice(on) {
    const st = S.settings;
    if (!!on === !!st.practice) return;
    if (on) {
        await saveSettings({ practice: true, practiceSession: uid(), practiceStartedAt: nowISO() });
        return;
    }
    const session = st.practiceSession;
    const net = new Map();
    for (const m of S.movements) {
        if (m.type === 'practice' && m.practiceSession === session) net.set(m.ingredientId, rq((net.get(m.ingredientId) || 0) + m.delta));
    }
    const ops = [];
    for (const [ingredientId, delta] of net) {
        const ing = byId('ingredients', ingredientId);
        if (ing && delta) ops.push(...stockChange(ing, -delta, 'practice-revert', { practiceSession: session, note: 'Practice mode ended', eventId: null, dayId: null }));
    }
    ops.push({ store: 'settings', put: { ...st, practice: false, practiceSession: null, practiceStartedAt: null, updatedAt: nowISO() } });
    await commit(ops);
}
