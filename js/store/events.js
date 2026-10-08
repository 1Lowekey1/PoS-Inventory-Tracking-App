// Events, days, cash and expenses.
//
// Money model (by design, matches how pop-ups buy stock):
//   Profit = Gross sales − (Capital + Expenses)
//   Capital  = bought up front for the event (kind 'capital')
//   Expenses = bought during it (kind 'expense'), incl. restock costs
// A 'pending' expense has amount 0 until its cost is entered.

import { S, byId, put, del, commit, stamp, activeEvent, openDay, eventDays, realOrders } from './state.js';
import { stockChange, stockSnapshot } from './stock.js';
import { nowISO, r2, rq, sum } from '../util.js';

/**
 * Start an event. capitalItems: [{ description, amount }].
 * openingCash !== null also opens Day 1 with that float.
 */
export async function startEvent({ name, location, startDate, plannedOutput, plannedDays = 1, notes, capitalItems = [], openingCash = null }) {
    if (activeEvent()) throw new Error('An event is already running.');
    const ev = stamp({
        name: name.trim(), location: location || '', startDate, plannedOutput: plannedOutput || null,
        plannedDays: Math.max(1, Math.floor(plannedDays) || 1),
        notes: notes || '', status: 'active', startedAt: nowISO(), startingStock: stockSnapshot()
    });
    const capital = capitalItems.filter((c) => c.amount > 0).map((c) => put('expenses', {
        eventId: ev.id, dayId: null, kind: 'capital', category: c.category || 'Ingredients',
        description: c.description || 'Capital', amount: r2(c.amount), paidFromDrawer: false, at: nowISO()
    }));
    await commit([{ store: 'events', put: ev }, ...capital]);
    if (openingCash !== null) await openNewDay({ openingCash });
    return ev;
}

export const updateEvent = (id, patch) => commit([put('events', { ...byId('events', id), ...patch })]);

/** Open the next day. Opening a day beyond the plan extends plannedDays. */
export async function openNewDay({ openingCash = 0 }) {
    const ev = activeEvent();
    if (!ev) throw new Error('Start an event first.');
    if (openDay()) throw new Error('A day is already open.');
    const index = eventDays(ev.id).length + 1;
    const day = stamp({ eventId: ev.id, index, status: 'open', openedAt: nowISO(), openingCash: r2(openingCash), openingStock: stockSnapshot() });
    const ops = [{ store: 'days', put: day }];
    if (index > (ev.plannedDays || 1)) ops.push(put('events', { ...ev, plannedDays: index }));
    await commit(ops);
    return day;
}

/** True when no day is open and all planned days have been run. The UI then offers End event. */
export function eventDaysDone(ev) {
    if (!ev || openDay()) return false;
    return eventDays(ev.id).length >= (ev.plannedDays || 1);
}

/** Cash that should be in the drawer: float + cash sales − expenses paid from the drawer. */
export function expectedCash(day) {
    const cashSales = sum(realOrders({ dayId: day.id }).filter((o) => o.payment.method === 'cash'), (o) => o.total);
    const paidOut = sum(S.expenses.filter((e) => e.dayId === day.id && e.paidFromDrawer), (e) => e.amount);
    return r2((day.openingCash || 0) + cashSales - paidOut);
}

/**
 * Close the open day. counts: { ingredientId: actual amount } (blank = keep);
 * differences are logged as 'count' movements before the closing snapshot.
 */
export async function closeDay({ countedCash, counts = {}, notes = '' }) {
    const day = openDay();
    if (!day) return;
    const countOps = [];
    for (const [ingredientId, actual] of Object.entries(counts)) {
        const ing = byId('ingredients', ingredientId);
        if (!ing || actual === '' || actual == null) continue;
        const delta = rq(Number(actual) - ing.stock);
        if (delta !== 0) countOps.push(...stockChange(ing, delta, 'count', { note: 'End-of-day count', eventId: day.eventId, dayId: day.id }));
    }
    await commit(countOps);
    // Second commit so the closing snapshot includes the counts above.
    await commit([put('days', {
        ...day, status: 'closed', closedAt: nowISO(), notes,
        expectedCash: expectedCash(day),
        countedCash: countedCash === '' || countedCash == null ? null : r2(countedCash),
        closingStock: stockSnapshot()
    })]);
    return byId('days', day.id);
}

/** For "I closed the day by mistake". */
export async function reopenDay(id) {
    if (openDay()) throw new Error('Close the open day first.');
    await commit([put('days', { ...byId('days', id), status: 'open', closedAt: null })]);
}

/** Close the running event and snapshot leftover stock. The day must be closed first. */
export async function endEvent() {
    const ev = activeEvent();
    if (!ev) return;
    if (openDay()) throw new Error('Close the current day first.');
    await commit([put('events', { ...ev, status: 'closed', endedAt: nowISO(), endingStock: stockSnapshot() })]);
    return byId('events', ev.id);
}

// ---------- expenses ----------

/** Expenses still waiting for a cost (logged with "I'll add the cost later"). */
export const pendingCosts = (eventId) => S.expenses.filter((e) => e.eventId === eventId && e.pending);

/**
 * Create or update an expense / capital entry. Works for past events too
 * (filling in pending costs after an event ended). Entering an amount clears `pending`.
 */
export async function saveExpense(rec) {
    const eventId = rec.eventId || activeEvent()?.id;
    if (!eventId) throw new Error('Start an event to log expenses.');
    const amount = r2(rec.amount);
    await commit([put('expenses', {
        kind: 'expense', paidFromDrawer: false, at: nowISO(), dayId: openDay()?.id || null,
        ...rec, eventId, amount, pending: !!rec.pending && !(amount > 0)
    })]);
}

export const deleteExpense = (id) => commit([del('expenses', id)]);
