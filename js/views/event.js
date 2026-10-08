// Event screen: the running event (day status, numbers, break-even, capital &
// expenses, days) or, when nothing runs, the Start button and past events.
//
//   event/start-event.js    Start / Edit event forms (draft autosave)
//   event/days.js           Open day, Close day (cash + stock count), End event
//   event/expense-dialog.js Expense, Restock (bought/made), Capital

import * as store from '../store.js';
import { S, byId } from '../store.js';
import { computeReport, eventSummaries } from '../reports.js';
import { plural, esc, money, r2, fmtDate, fmtTime, fmtDuration } from '../util.js';
import { icon, toast, confirmDialog, kpiHTML } from '../ui.js';
import { meter } from '../charts.js';
import { startEventDialog, editEventDialog } from './event/start-event.js';
import { openDayDialog, closeDayDialog, endEventFlow, backupNow } from './event/days.js';
import { expenseDialog } from './event/expense-dialog.js';

// Re-exported for other screens (Sell, Stock, Reports, Settings).
export { startEventDialog, openDayDialog, endEventFlow, backupNow, expenseDialog };

export function render(el) {
    const ev = store.activeEvent();
    el.innerHTML = `<div class="page">${ev ? activeHTML(ev) : idleHTML()}</div>`;
    if (!el.dataset.wired) {
        el.dataset.wired = '1';
        el.addEventListener('click', onClick);
    }
}

function idleHTML() {
    const rows = eventSummaries();
    return `
        <header class="page-head"><h1>Event</h1></header>
        <div class="card hero-card">
            <div>
                <h2>No event running</h2>
                <p class="muted">An event can run for one or several days. You'll enter your capital (what you bought up front) once, then open and close each day.</p>
            </div>
            <button class="btn btn-primary btn-lg" data-act="start">${icon('play')} Start event</button>
        </div>
        <section class="card">
            <h2>Past events</h2>
            ${rows.length ? historyTable(rows) : '<p class="muted">Finished events will appear here with their full reports.</p>'}
        </section>`;
}

function historyTable(rows) {
    return `<div class="table-wrap"><table class="table">
        <thead><tr><th>Event</th><th class="hide-sm">Days</th><th class="r hide-sm">Orders</th><th class="r">Gross</th><th class="r hide-sm">Costs</th><th class="r">Profit</th></tr></thead>
        <tbody>${rows.map((r) => `<tr class="clickable" data-report="${r.event.id}">
            <td><b>${esc(r.event.name)}</b><br><small class="muted">${fmtDate(r.event.startedAt)}${r.event.location ? ` · ${esc(r.event.location)}` : ''}${r.event.status === 'active' ? ' · running' : ''}</small></td>
            <td class="hide-sm">${r.days}</td><td class="r hide-sm">${r.orders}</td><td class="r">${money(r.gross)}</td><td class="r hide-sm">${money(r.costs)}</td>
            <td class="r ${r.profit < 0 ? 'neg' : 'pos'}">${money(r.profit)}</td></tr>`).join('')}</tbody></table></div>`;
}

/** The running event. `v` holds what every section needs, computed once. */
function activeHTML(event) {
    const days = store.eventDays(event.id);
    const day = store.openDay();
    const v = {
        event, days, day,
        rep: computeReport({ eventId: event.id }),
        today: day ? computeReport({ eventId: event.id, dayId: day.id }) : null,
        planned: Math.max(event.plannedDays || 1, days.length),
        pending: store.pendingCosts(event.id)
    };
    return `
        <header class="page-head">
            <div><h1>${esc(event.name)}</h1>
                <p class="muted">${event.location ? `${esc(event.location)} · ` : ''}Started ${fmtDate(event.startedAt)} · ${plural(v.planned, 'day')} planned</p></div>
            <div class="head-actions">
                <button class="btn btn-ghost btn-sm" data-act="edit-event">${icon('edit')} Edit</button>
                <a class="btn btn-ghost btn-sm" href="#reports/${event.id}">${icon('reports')} Full report</a>
            </div>
        </header>
        ${dayCardHTML(v)}
        ${kpisHTML(v)}
        ${breakEvenHTML(v)}
        ${moneyOutHTML(v)}
        ${days.length ? `<section class="card"><h2>Days</h2>${daysTable(v.rep.dayRows)}</section>` : ''}`;
}

/** What's happening today and the next action: close the day, open the next one, or end the event. */
function dayCardHTML({ event, days, day, planned }) {
    const lastClosed = [...days].reverse().find((d) => d.status === 'closed');
    const reopen = lastClosed ? `<button class="btn btn-ghost" data-act="reopen" data-id="${lastClosed.id}">${icon('undo')} Reopen day ${lastClosed.index}</button>` : '';

    if (day) {
        return `<div class="card day-card open">
            <div><span class="dot-live"></span><b>Day ${day.index} of ${planned} open</b>
            <span class="muted">since ${fmtTime(day.openedAt)} (${fmtDuration(Date.now() - new Date(day.openedAt))}) · float ${money(day.openingCash)}</span></div>
            <div class="head-actions">
                <button class="btn" data-act="expense">${icon('plus')} Expense</button>
                <button class="btn btn-primary" data-act="close-day">${icon('stop')} Close day ${day.index}</button>
            </div></div>`;
    }
    if (store.eventDaysDone(event)) {
        return `<div class="card day-card">
            <div><b>${days.length === 1 ? 'The day is closed' : `All ${days.length} days closed`}</b><span class="muted"> · ready to end the event</span></div>
            <div class="head-actions">${reopen}
                <button class="btn" data-act="open-day">${icon('plus')} Add a day</button>
                <button class="btn btn-primary" data-act="end">${icon('stop')} End event</button>
            </div></div>`;
    }
    return `<div class="card day-card">
        <div><b>No day open</b><span class="muted"> · ${days.length ? `Day ${days.length} closed ${fmtTime(lastClosed?.closedAt)}` : 'ready for day 1'}</span></div>
        <div class="head-actions">${reopen}
            ${days.length ? `<button class="btn" data-act="end">${icon('stop')} End event</button>` : ''}
            <button class="btn btn-primary" data-act="open-day">${icon('play')} Open day ${days.length + 1}</button>
        </div></div>`;
}

function kpisHTML({ rep, today, pending }) {
    return `<div class="kpis">
        ${today ? kpiHTML('Today', money(today.gross), `${plural(today.orderCount, 'order')} · ${plural(today.items, 'item')}`) : ''}
        ${kpiHTML('Event gross', money(rep.gross), `${plural(rep.orderCount, 'order')} · avg ${money(rep.aov)}`)}
        ${kpiHTML('Capital + expenses', money(rep.costs), `${money(rep.capital)} capital · ${money(rep.otherExpenses)} expenses`)}
        ${kpiHTML(rep.profit >= 0 ? 'Profit so far' : 'Still to recover', money(Math.abs(rep.profit)),
            pending.length ? `${plural(pending.length, 'cost')} not entered yet` : '', rep.profit >= 0 ? 'pos' : 'neg')}
    </div>`;
}

/** Sales vs costs, and (if set) items vs planned output with the price still needed per item. */
function breakEvenHTML({ rep, event }) {
    const toGo = r2(rep.costs - rep.gross);
    const status = toGo > 0 ? `${money(toGo)} to go` : rep.costs ? `Covered, ${money(-toGo)} above costs` : 'No costs logged yet';
    const remainingItems = (event.plannedOutput || 0) - rep.items;
    return `<section class="card">
        <div class="row-between"><h2>Break-even</h2><span class="muted">${status}</span></div>
        ${meter(rep.gross, rep.costs || 1, { tone: toGo > 0 ? 'accent' : 'good' })}
        ${event.plannedOutput ? `
            <div class="row-between mt"><h3 class="sub">Planned output</h3><span class="muted">${rep.items} / ${event.plannedOutput} items</span></div>
            ${meter(rep.items, event.plannedOutput)}
            ${remainingItems > 0 && toGo > 0 ? `<p class="muted small">You need about ${money(toGo / remainingItems)} per remaining item to break even.</p>` : ''}` : ''}
    </section>`;
}

/** Capital, expenses and restock costs. Pending costs first, then capital, then by time. */
function moneyOutHTML({ event, pending }) {
    const order = (e) => (e.pending ? 0 : e.kind === 'capital' ? 1 : 2);
    const entries = S.expenses.filter((e) => e.eventId === event.id).sort((a, b) => order(a) - order(b) || a.at.localeCompare(b.at));
    const row = (x) => `<li class="list-item clickable" data-exp="${x.id}">
        <div class="grow"><b>${esc(x.description || x.category)}</b>
        <small class="muted">${x.kind === 'capital' ? 'Capital' : esc(x.category)}${x.dayId ? ` · Day ${byId('days', x.dayId)?.index ?? '?'}` : ''} · ${fmtTime(x.at)}${x.paidFromDrawer ? ' · from drawer' : ''}</small></div>
        ${x.pending ? '<span class="badge warn">Cost pending</span>' : `<span>${money(x.amount)}</span>`}</li>`;
    return `<section class="card">
        <div class="row-between"><h2>Capital, expenses & restocks</h2>
            <div class="head-actions">
                <button class="btn btn-sm" data-act="capital">${icon('plus')} Capital</button>
                <button class="btn btn-sm" data-act="restock">${icon('stock')} Restock</button>
                <button class="btn btn-sm" data-act="expense">${icon('plus')} Expense</button>
            </div></div>
        ${pending.length ? `<div class="hint warn">${icon('alert')} <span>${plural(pending.length, 'cost')} still to fill in (marked <b>Cost pending</b>). Tap one to enter what it cost, so the profit is right.</span></div>` : ''}
        ${entries.length ? `<ul class="list">${entries.map(row).join('')}</ul>`
            : '<p class="muted">Nothing logged yet. Add what you bought up front as capital, anything bought during the event (e.g. ice) as an expense, and more ingredients as a restock.</p>'}
    </section>`;
}

/** Days table (also used by the Reports screen). rows come from computeReport().dayRows. */
export function daysTable(rows) {
    return `<div class="table-wrap"><table class="table">
        <thead><tr><th>Day</th><th class="r">Orders</th><th class="r">Gross</th><th class="r">Expenses</th><th class="r">Cash diff</th></tr></thead>
        <tbody>${rows.map((d) => `<tr>
            <td><b>Day ${d.index}</b><br><small class="muted">${fmtDate(d.openedAt)} ${fmtTime(d.openedAt)}–${d.closedAt ? fmtTime(d.closedAt) : 'now'}</small></td>
            <td class="r">${d.orders}</td><td class="r">${money(d.gross)}</td><td class="r">${money(d.expenses)}</td>
            <td class="r ${d.cashDiff < 0 ? 'neg' : d.cashDiff > 0 ? 'pos' : ''}">${d.cashDiff == null ? '—' : money(d.cashDiff, { sign: true })}</td></tr>`).join('')}
        </tbody></table></div>`;
}

async function onClick(e) {
    const t = e.target.closest('[data-act], [data-exp], [data-report]');
    if (!t) return;
    if (t.dataset.report) { location.hash = `#reports/${t.dataset.report}`; return; }
    if (t.dataset.exp) { expenseDialog(byId('expenses', t.dataset.exp)); return; }
    switch (t.dataset.act) {
        case 'start': startEventDialog(); break;
        case 'edit-event': editEventDialog(); break;
        case 'open-day': openDayDialog(); break;
        case 'close-day': closeDayDialog(); break;
        case 'expense': expenseDialog(); break;
        case 'capital': expenseDialog(null, 'capital'); break;
        case 'restock': expenseDialog(null, 'restock'); break;
        case 'reopen':
            if (await confirmDialog('Reopen day?', 'Use this if you closed the day by mistake. Sales will continue to count toward that day.', { okLabel: 'Reopen' })) {
                try { await store.reopenDay(t.dataset.id); } catch (err) { toast(err.message, { type: 'error' }); }
            }
            break;
        case 'end': endEventFlow(); break;
    }
}
