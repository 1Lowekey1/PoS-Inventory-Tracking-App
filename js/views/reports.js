// Reports screen: one event, all days or a single day.
// Routes: #reports (running or latest event) · #reports/<eventId> · #reports/<eventId>/<dayId>
//
// The numbers come from reports.js (computeReport); this file only lays them out.
// Each section is its own function taking the same view object `v`.

import * as store from '../store.js';
import { S, byId } from '../store.js';
import { computeReport, eventSummaries } from '../reports.js';
import { plural, esc, money, moneyShort, qtyFmt, fmtDate, fmtTime, fmtDuration, fmtDateTime, download, toCSV, slug, todayISODate } from '../util.js';
import { icon, toast, kpiHTML } from '../ui.js';
import { columnChart, barList, meter } from '../charts.js';
import { daysTable, expenseDialog } from './event.js';

let scope = { eventId: null, dayId: null }; // what's on screen (for CSV and day switching)

export function render(el, [eventId, dayId] = []) {
    const latest = store.activeEvent() || [...S.events].sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))[0];
    scope = {
        eventId: byId('events', eventId) ? eventId : latest?.id || null,
        dayId: dayId && byId('days', dayId) ? dayId : null
    };

    if (!scope.eventId) {
        el.innerHTML = `<div class="page"><header class="page-head"><h1>Reports</h1></header>
            <div class="card"><h2>No events yet</h2><p class="muted">Reports appear once you start an event and make sales. Practice-mode orders are never included.</p></div></div>`;
        return;
    }

    const rep = computeReport(scope);
    const v = {
        rep,
        event: rep.event,
        days: store.eventDays(scope.eventId),
        day: scope.dayId ? byId('days', scope.dayId) : null,
        isDay: !!scope.dayId,
        summaries: eventSummaries()
    };

    el.innerHTML = `<div class="page report">
        ${headerHTML(v)}
        ${kpisHTML(v)}
        ${pendingCostsHTML(v)}
        ${breakEvenHTML(v)}
        <div class="grid-2">${hourlyHTML(v)}${paymentsHTML(v)}</div>
        ${daysHTML(v)}
        ${productsHTML(v)}
        <div class="grid-2">${expensesHTML(v)}${ingredientsHTML(v)}</div>
        ${allEventsHTML(v)}
    </div>`;

    if (!el.dataset.wired) {
        el.dataset.wired = '1';
        el.addEventListener('change', (e) => {
            if (e.target.matches('[data-pick-event]')) location.hash = `#reports/${e.target.value}`;
        });
        el.addEventListener('click', onClick);
    }
}

function onClick(e) {
    const t = e.target.closest('[data-day], [data-act], [data-goto], [data-exp]');
    if (!t) return;
    const d = t.dataset;
    if (d.exp) expenseDialog(byId('expenses', d.exp));            // fill in a pending cost
    else if (d.goto) location.hash = `#reports/${d.goto}`;          // another event
    else if (d.day !== undefined) location.hash = `#reports/${scope.eventId}${d.day ? `/${d.day}` : ''}`;
    else if (d.act === 'print') window.print();                     // print stylesheet hides controls
    else if (d.act === 'csv') exportCSV();
}

// ---------- sections ----------

const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`; // 13 → "1p"
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

function headerHTML({ event, days, isDay, summaries }) {
    const dates = `${fmtDate(event.startedAt)}${event.endedAt ? ` – ${fmtDate(event.endedAt)}` : ' · running'}`;
    return `
        <header class="page-head">
            <div><h1>Reports</h1><p class="muted">${esc(event.name)} · ${dates}${event.location ? ` · ${esc(event.location)}` : ''}</p></div>
            <div class="head-actions no-print">
                <button class="btn btn-sm" data-act="print">${icon('print')} Print</button>
                <button class="btn btn-sm" data-act="csv">${icon('download')} CSV</button>
            </div>
        </header>
        <div class="toolbar no-print">
            <select data-pick-event aria-label="Event">${summaries.map((s) => `<option value="${s.event.id}" ${s.event.id === event.id ? 'selected' : ''}>${esc(s.event.name)} (${fmtDate(s.event.startedAt)})</option>`).join('')}</select>
            <div class="chips">
                <button class="chip ${!isDay ? 'on' : ''}" data-day="">All days</button>
                ${days.map((d) => `<button class="chip ${d.id === scope.dayId ? 'on' : ''}" data-day="${d.id}">Day ${d.index}</button>`).join('')}
            </div>
        </div>`;
}

function kpisHTML({ rep, day, isDay }) {
    const sales = kpiHTML('Gross sales', money(rep.gross), `${plural(rep.orderCount, 'order')} · ${plural(rep.items, 'item')}`);

    const costs = isDay
        ? kpiHTML('Expenses this day', money(rep.costs), 'capital is counted at event level')
        : kpiHTML('Capital + expenses', money(rep.costs), `${money(rep.capital)} capital · ${money(rep.otherExpenses)} expenses`);

    let third;
    if (isDay) {
        const counted = day.countedCash != null;
        third = kpiHTML('Cash count',
            counted ? money(day.countedCash - day.expectedCash, { sign: true }) : '—',
            counted ? `expected ${money(day.expectedCash)}` : day.status === 'open' ? 'day still open' : 'not counted',
            counted && day.countedCash < day.expectedCash ? 'neg' : '');
    } else {
        const margin = rep.gross ? `${percent(rep.profit, rep.gross).toString().replace('-', '−')}% of sales` : '';
        third = kpiHTML(rep.profit >= 0 ? 'Net profit' : 'Net loss', money(Math.abs(rep.profit)), margin, rep.profit >= 0 ? 'pos' : 'neg');
    }

    // Sales per hour is noise for very short days, so only show it after 30 minutes.
    const pace = rep.durationMs >= 1800000 ? `${money(rep.perHour)}/hour over ${fmtDuration(rep.durationMs)}` : `open ${fmtDuration(rep.durationMs)}`;
    return `<div class="kpis">${sales}${costs}${third}${kpiHTML('Average order', money(rep.aov), pace)}</div>`;
}

function pendingCostsHTML({ rep }) {
    if (!rep.pending.length) return '';
    return `<section class="card pending-card no-print">
        <h2>Costs still to enter</h2>
        <p class="muted small">Logged with "I'll add the cost later". Profit above doesn't include them yet. Tap one to enter what it cost.</p>
        <ul class="list">${rep.pending.map((x) => `<li class="list-item clickable" data-exp="${x.id}">
            <div class="grow"><b>${esc(x.description)}</b><small class="muted">${x.dayId ? `Day ${byId('days', x.dayId)?.index ?? '?'} · ` : ''}${fmtTime(x.at)}</small></div>
            <span class="badge warn">Cost pending</span></li>`).join('')}</ul></section>`;
}

function breakEvenHTML({ rep, event, isDay }) {
    if (isDay) return '';
    const covered = rep.gross >= rep.costs;
    const status = covered ? `covered${rep.costs ? ` · ${percent(rep.gross, rep.costs)}% of costs` : ''}` : `${money(rep.costs - rep.gross)} short`;
    return `<section class="card">
        <div class="row-between"><h2>Break-even</h2><span class="muted">${status}</span></div>
        ${meter(rep.gross, rep.costs || 1, { tone: covered ? 'good' : 'accent' })}
        ${event.plannedOutput ? `<div class="row-between mt"><h3 class="sub">Planned output</h3><span class="muted">${rep.items} / ${event.plannedOutput} items (${percent(rep.items, event.plannedOutput)}%)</span></div>${meter(rep.items, event.plannedOutput)}` : ''}
    </section>`;
}

function hourlyHTML({ rep, days, isDay }) {
    const bars = rep.hours.map((h) => ({ label: hourLabel(h.hour), value: h.gross, tip: `${hourLabel(h.hour)}: ${money(h.gross)} · ${plural(h.orders, 'order')}` }));
    return `<section class="card">
        <div class="row-between"><h2>Sales by hour</h2>${rep.peak ? `<span class="muted">peak ${hourLabel(rep.peak.hour)} · ${money(rep.peak.gross)}</span>` : ''}</div>
        ${!isDay && days.length > 1 ? '<p class="muted small">All days combined, by time of day.</p>' : ''}
        ${columnChart(bars, { format: moneyShort })}
    </section>`;
}

function paymentsHTML({ rep }) {
    const notes = [
        rep.discounts ? `Discounts given: ${money(rep.discounts)}.` : '',
        rep.voids.length ? `Voided: ${plural(rep.voids.length, 'order')} (${money(rep.voidAmount)}), not counted in sales.` : ''
    ].filter(Boolean).join(' ');
    return `<section class="card">
        <h2>Payment methods</h2>
        ${barList(rep.payments.map((p) => ({ label: p.name, sub: plural(p.count, 'order'), value: p.amount, display: money(p.amount) })), { format: money })}
        ${notes ? `<p class="muted small mt">${notes}</p>` : ''}
    </section>`;
}

function daysHTML({ rep, days, day, isDay }) {
    if (isDay) return day.notes ? `<section class="card"><h2>Notes</h2><p>${esc(day.notes)}</p></section>` : '';
    if (!days.length) return '';
    const withNotes = days.filter((d) => d.notes);
    return `<section class="card"><h2>Days</h2>${daysTable(rep.dayRows)}
        ${withNotes.length ? `<ul class="notes">${withNotes.map((d) => `<li><b>Day ${d.index}:</b> ${esc(d.notes)}</li>`).join('')}</ul>` : ''}</section>`;
}

function productsHTML({ rep }) {
    const bars = barList(rep.products.map((p) => ({ label: p.name, sub: `${p.qty} sold · ${Math.round(p.share * 100)}%`, value: p.gross, display: money(p.gross) })), { format: money });
    const margins = rep.products.some((p) => p.estCost !== null) ? `<details class="mt"><summary>Estimated margins (from ingredient unit costs)</summary>
        <div class="table-wrap"><table class="table"><thead><tr><th>Product</th><th class="r">Sold</th><th class="r">Sales</th><th class="r">Est. ingredient cost</th><th class="r">Est. margin</th></tr></thead>
        <tbody>${rep.products.map((p) => `<tr><td>${esc(p.name)}</td><td class="r">${p.qty}</td><td class="r">${money(p.gross)}</td>
            <td class="r">${p.estCost === null ? '—' : money(p.estCost)}</td>
            <td class="r">${p.estCost === null ? '—' : `${money(p.gross - p.estCost)} (${percent(p.gross - p.estCost, p.gross)}%)`}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted small">Estimates only. Net profit above is the real number (sales minus everything you spent).</p></details>` : '';
    return `<section class="card"><h2>Products</h2>${bars}${margins}</section>`;
}

function expensesHTML({ rep, isDay }) {
    return `<section class="card">
        <h2>${isDay ? 'Expenses' : 'Capital & expenses'}</h2>
        ${barList(rep.expenseCats.map((c) => ({ label: c.category, sub: plural(c.count, 'entry', 'entries'), value: c.amount, display: money(c.amount) })), { format: money })}
    </section>`;
}

function ingredientsHTML({ rep, event, day, isDay }) {
    if (!rep.ingredients.length) return '<section class="card"><h2>Ingredient usage</h2><p class="muted">No tracked ingredients used.</p></section>';
    const finished = event.endedAt || (isDay && day.closedAt);
    const cell = (n, cls = '') => `<td class="r ${cls}">${n ? qtyFmt(n) : ''}</td>`;
    return `<section class="card">
        <h2>Ingredient usage</h2>
        <div class="table-wrap"><table class="table small">
            <thead><tr><th>Ingredient</th><th class="r">Start</th><th class="r">Used</th><th class="r">Added</th><th class="r">Waste</th><th class="r">Adj.</th><th class="r">${finished ? 'End' : 'Now'}</th></tr></thead>
            <tbody>${rep.ingredients.map((i) => `<tr><td>${esc(i.name)} <small class="muted">${esc(i.unit)}</small></td>
                <td class="r">${i.start == null ? '—' : qtyFmt(i.start)}</td><td class="r">${qtyFmt(i.used)}</td>${cell(i.restocked)}
                ${cell(i.wasted, i.wasted ? 'neg' : '')}${cell(i.counted)}
                <td class="r">${i.end == null ? '—' : qtyFmt(i.end)}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted small">Adj. = difference found when counting. A big negative adjustment usually means the recipe amounts are lower than what you actually use.</p>
    </section>`;
}

function allEventsHTML({ event, isDay, summaries }) {
    if (isDay || summaries.length < 2) return '';
    return `<section class="card"><h2>All events</h2>
        <div class="table-wrap"><table class="table"><thead><tr><th>Event</th><th class="r">Days</th><th class="r">Items</th><th class="r">Gross</th><th class="r">Costs</th><th class="r">Profit</th><th class="r">Per day</th></tr></thead>
        <tbody>${summaries.map((s) => `<tr class="clickable ${s.event.id === event.id ? 'current' : ''}" data-goto="${s.event.id}">
            <td>${esc(s.event.name)}<br><small class="muted">${fmtDate(s.event.startedAt)}</small></td><td class="r">${s.days}</td><td class="r">${s.items}</td>
            <td class="r">${money(s.gross)}</td><td class="r">${money(s.costs)}</td><td class="r ${s.profit < 0 ? 'neg' : 'pos'}">${money(s.profit)}</td>
            <td class="r">${s.days ? money(s.gross / s.days) : '—'}</td></tr>`).join('')}</tbody></table></div></section>`;
}

// ---------- CSV export ----------

const inScope = (rec) => rec.eventId === scope.eventId && (!scope.dayId || rec.dayId === scope.dayId);
const dayNumber = (dayId) => byId('days', dayId)?.index ?? '';

/** Three CSV files for spreadsheets: sales (one row per item), expenses, stock movements. */
function exportCSV() {
    const event = byId('events', scope.eventId);

    const sales = S.orders.filter((o) => !o.practice && inScope(o)).flatMap((o) => o.items.map((item) => ({
        order: o.number, date: fmtDate(o.createdAt), time: fmtTime(o.createdAt), day: dayNumber(o.dayId),
        status: o.status, payment: store.paymentName(o.payment.method), product: item.name,
        addons: [...(item.options || []), ...item.modifiers].map((x) => x.name).join(' + '),
        qty: item.qty, unit_price: item.unitPrice, line_total: item.lineTotal,
        order_discount: o.discount?.amount || 0, order_total: o.total, note: o.note || ''
    })));

    const expenses = S.expenses.filter(inScope).map((x) => ({
        date: fmtDateTime(x.at), day: dayNumber(x.dayId), kind: x.kind, category: x.category,
        description: x.description, amount: x.amount, pending: x.pending ? 'yes' : 'no', paid_from_drawer: x.paidFromDrawer ? 'yes' : 'no'
    }));

    const stock = S.movements.filter(inScope).map((m) => ({
        date: fmtDateTime(m.at), day: dayNumber(m.dayId), ingredient: m.ingredientName, unit: m.unit,
        type: m.type, change: m.delta, order: m.orderId ? byId('orders', m.orderId)?.number ?? '' : '', note: m.note || ''
    }));

    if (!sales.length && !expenses.length && !stock.length) { toast('Nothing to export yet.'); return; }
    const base = `poppos-${slug(event.name)}${scope.dayId ? `-day${dayNumber(scope.dayId)}` : ''}-${todayISODate()}`;
    // Small delays: some browsers block several downloads fired at the same instant.
    [[sales, 'sales'], [expenses, 'expenses'], [stock, 'stock']]
        .filter(([rows]) => rows.length)
        .forEach(([rows, name], i) => setTimeout(() => download(`${base}-${name}.csv`, toCSV(rows), 'text/csv'), i * 300));
    toast('CSV files downloaded (sales, expenses, stock). They open in Excel or Google Sheets.', { type: 'success', duration: 5000 });
}
