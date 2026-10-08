// Report calculations: read-only maths over the store, no DOM.
//
// computeReport({ eventId, dayId? }) is the one entry point for the Event and
// Reports screens and the printed summaries. Each section is its own helper.
//
// Scope rule: an event report's costs include capital; a day report only has
// that day's expenses (capital belongs to the event as a whole).

import { S, byId, eventDays, realOrders, paymentName, expectedCash } from './store.js';
import { sum, r2, rq, groupBy } from './util.js';

const HOUR_MS = 3600000;

/** Items sold in an order. Add-ons sold on their own don't count as extra items. */
const itemCount = (order) => sum(order.items.filter((i) => !i.addonId), (i) => i.qty);

const totalOf = (orders) => r2(sum(orders, (o) => o.total));
const amountOf = (expenses) => r2(sum(expenses, (e) => e.amount));

/** Everything the report screens show for an event, or one day of it. Null if the event doesn't exist. */
export function computeReport({ eventId, dayId = null }) {
    const event = byId('events', eventId);
    if (!event) return null;

    const days = dayId ? [byId('days', dayId)].filter(Boolean) : eventDays(eventId);
    const orders = realOrders({ eventId, dayId });
    const voids = realOrders({ eventId, dayId, includeVoid: true }).filter((o) => o.status === 'void');
    const expenses = S.expenses.filter((e) => e.eventId === eventId && (!dayId || e.dayId === dayId));

    const gross = totalOf(orders);
    const capital = amountOf(expenses.filter((e) => e.kind === 'capital'));
    const otherExpenses = amountOf(expenses.filter((e) => e.kind !== 'capital'));
    const costs = r2(capital + otherExpenses);
    const durationMs = sum(days, (d) => (d.closedAt ? new Date(d.closedAt) : new Date()) - new Date(d.openedAt));
    const hours = salesByHour(orders);

    // Whole-event totals, so a day view can still show event break-even.
    const eventOrders = dayId ? realOrders({ eventId }) : orders;
    const evGross = totalOf(eventOrders);
    const evCosts = amountOf(S.expenses.filter((e) => e.eventId === eventId));

    return {
        event, days, orders, voids, expenses,
        gross, capital, otherExpenses, costs,
        profit: r2(gross - costs),
        discounts: r2(sum(orders, (o) => o.discount?.amount || 0)),
        items: sum(orders, itemCount),
        orderCount: orders.length,
        aov: orders.length ? r2(gross / orders.length) : 0,
        voidAmount: totalOf(voids),
        durationMs,
        perHour: durationMs > 0 ? r2(gross / (durationMs / HOUR_MS)) : 0,
        hours,
        peak: hours.reduce((best, h) => (h.gross > (best?.gross || 0) ? h : best), null),
        products: productBreakdown(orders, gross),
        payments: paymentBreakdown(orders),
        dayRows: days.map(dayRow),
        expenseCats: expensesByCategory(expenses),
        ingredients: ingredientUsage(event, days, eventId, dayId),
        pending: expenses.filter((e) => e.pending),
        evGross, evCosts,
        evItems: sum(eventOrders, itemCount),
        evProfit: r2(evGross - evCosts)
    };
}

// ---------- sections ----------

/**
 * Per product (and per add-on sold on its own): qty, gross, share of sales and
 * estimated ingredient cost (null if any ingredient has no unit cost).
 * Order discounts are spread over the lines so product totals add up to gross.
 */
function productBreakdown(orders, gross) {
    const byProduct = new Map();
    for (const order of orders) {
        const discountFactor = order.subtotal ? order.total / order.subtotal : 1;
        for (const item of order.items) {
            const key = item.productId || `addon:${item.addonId}`;
            const name = item.addonId ? `${item.name.replace(/ \((for #\d+|add-on)\)$/, '')} (add-on)` : item.name;
            const row = byProduct.get(key) || { name, qty: 0, gross: 0, estCost: 0, costKnown: true };
            row.qty += item.qty;
            row.gross += item.lineTotal * discountFactor;
            const unitCost = recipeCost(item.recipe);
            if (unitCost === null) row.costKnown = false;
            else row.estCost += unitCost * item.qty;
            byProduct.set(key, row);
        }
    }
    return [...byProduct.values()]
        .map((p) => ({ ...p, gross: r2(p.gross), estCost: p.costKnown ? r2(p.estCost) : null, share: gross ? p.gross / gross : 0 }))
        .sort((a, b) => b.gross - a.gross);
}

/** Cost of one item from ingredient unit costs, or null if any is missing. */
function recipeCost(recipe) {
    let total = 0;
    for (const r of recipe || []) {
        const ing = byId('ingredients', r.ingredientId);
        if (!ing || ing.unitCost == null || ing.unitCost === '') return null;
        total += ing.unitCost * r.qty;
    }
    return total;
}

function paymentBreakdown(orders) {
    return [...groupBy(orders, (o) => o.payment.method)]
        .map(([method, list]) => ({ method, name: paymentName(method), count: list.length, amount: totalOf(list) }))
        .sort((a, b) => b.amount - a.amount);
}

/** Sales per hour of the day, from the first to the last busy hour (gaps filled with 0). */
function salesByHour(orders) {
    const byHour = new Map();
    for (const o of orders) {
        const hour = new Date(o.createdAt).getHours();
        const bucket = byHour.get(hour) || { hour, gross: 0, orders: 0 };
        bucket.gross += o.total;
        bucket.orders += 1;
        byHour.set(hour, bucket);
    }
    if (!byHour.size) return [];
    const busy = [...byHour.keys()];
    const result = [];
    for (let h = Math.min(...busy); h <= Math.max(...busy); h++) {
        const b = byHour.get(h) || { hour: h, gross: 0, orders: 0 };
        result.push({ ...b, gross: r2(b.gross) });
    }
    return result;
}

/** One row of the Days table: sales, expenses and the cash count. */
function dayRow(day) {
    const orders = realOrders({ dayId: day.id });
    const expected = day.status === 'closed' ? day.expectedCash : expectedCash(day);
    return {
        id: day.id, index: day.index, openedAt: day.openedAt, closedAt: day.closedAt, status: day.status,
        orders: orders.length,
        gross: totalOf(orders),
        expenses: amountOf(S.expenses.filter((e) => e.dayId === day.id)),
        expectedCash: expected,
        countedCash: day.countedCash ?? null,
        cashDiff: day.countedCash == null ? null : r2(day.countedCash - expected)
    };
}

function expensesByCategory(expenses) {
    return [...groupBy(expenses, (e) => (e.kind === 'capital' ? `Capital · ${e.category}` : e.category))]
        .map(([category, list]) => ({ category, amount: amountOf(list), count: list.length }))
        .sort((a, b) => b.amount - a.amount);
}

/**
 * Per ingredient: start, used (sold net of voids + used to make other items),
 * added (bought + made), wasted, count adjustments, end. Built from movements.
 */
function ingredientUsage(event, days, eventId, dayId) {
    const moves = S.movements.filter((m) => m.eventId === eventId && (!dayId || m.dayId === dayId));
    const startStock = dayId ? days[0]?.openingStock : event.startingStock;
    const endStock = (dayId ? days[0]?.closingStock : event.endingStock) || null; // null = still running: show current stock
    const ids = new Set([...Object.keys(startStock || {}), ...moves.map((m) => m.ingredientId)]);

    return [...ids].map((id) => {
        const ing = byId('ingredients', id);
        const own = moves.filter((m) => m.ingredientId === id);
        const total = (type) => rq(sum(own.filter((m) => m.type === type), (m) => m.delta));
        const used = rq(-(total('sale') + total('void') + total('prep')));
        return {
            id,
            name: ing?.name || own[0]?.ingredientName || 'Deleted item',
            unit: ing?.unit || own[0]?.unit || '',
            start: startStock?.[id] ?? null,
            used,
            restocked: rq(total('restock') + total('made')),
            wasted: rq(-total('waste')),
            counted: total('count'),
            end: endStock ? endStock[id] ?? null : ing?.stock ?? null,
            estCost: ing?.unitCost ? r2(used * ing.unitCost) : null
        };
    })
        .filter((x) => x.used || x.restocked || x.wasted || x.counted || x.start)
        .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- other reports ----------

/** One summary row per event (newest first), for the history list and comparison table. */
export function eventSummaries() {
    return [...S.events]
        .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))
        .map((event) => {
            const orders = realOrders({ eventId: event.id });
            const gross = totalOf(orders);
            const costs = amountOf(S.expenses.filter((e) => e.eventId === event.id));
            return { event, days: eventDays(event.id).length, orders: orders.length, items: sum(orders, itemCount), gross, costs, profit: r2(gross - costs) };
        });
}

/**
 * Hours of stock left per tracked ingredient at today's selling pace: Map id → hours.
 * Empty during the first 15 minutes of a day, when the pace isn't meaningful yet.
 */
export function runoutEstimates(day) {
    const result = new Map();
    if (!day) return result;
    const hoursOpen = (Date.now() - new Date(day.openedAt)) / HOUR_MS;
    if (hoursOpen < 0.25) return result;
    const sold = S.movements.filter((m) => m.dayId === day.id && (m.type === 'sale' || m.type === 'void'));
    for (const [id, moves] of groupBy(sold, (m) => m.ingredientId)) {
        const used = -sum(moves, (m) => m.delta);
        const ing = byId('ingredients', id);
        if (ing && used > 0) result.set(id, ing.stock / (used / hoursOpen));
    }
    return result;
}
