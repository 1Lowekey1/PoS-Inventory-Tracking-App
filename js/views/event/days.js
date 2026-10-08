// Opening and closing days, the day summary (print/backup), and ending the event.

import * as store from '../../store.js';
import { S, byId } from '../../store.js';
import { computeReport } from '../../reports.js';
import { plural, esc, money, num, r2, fmtDate, todayISODate, qtyFmt, download, slug } from '../../util.js';
import { icon, toast, openModal, formModal, confirmDialog, val } from '../../ui.js';
import * as printer from '../../printer.js';
import { startEventDialog } from './start-event.js';

/** Open the next day with a cash float. Warns about low stock first. */
export function openDayDialog() {
    const ev = store.activeEvent();
    if (!ev) { startEventDialog(); return; }
    const days = store.eventDays(ev.id);
    const n = days.length + 1;
    const extra = n > (ev.plannedDays || 1);
    const lastFloat = days[days.length - 1]?.openingCash ?? 0;
    const low = S.ingredients.filter((i) => i.tracked && i.lowAt && i.stock <= i.lowAt);
    formModal({
        title: extra ? `Add day ${n}` : `Open day ${n}`, size: 's', submitLabel: `Open day ${n}`,
        fields: `
            ${extra ? `<div class="hint">${icon('plus')} <span>This event was planned for ${plural(ev.plannedDays || 1, 'day')}. Opening day ${n} extends it.</span></div>` : ''}
            <label class="field"><span>Starting cash in drawer (float)</span><input type="number" name="openingCash" inputmode="decimal" min="0" step="any" value="${lastFloat}"></label>
            ${low.length ? `<div class="hint warn">${icon('alert')} <span>Low before opening: ${low.map((i) => `${esc(i.name)} (${qtyFmt(i.stock)} ${esc(i.unit)})`).join(', ')}.</span></div>` : ''}
            ${n > 1 ? '<p class="muted small">Brought more stock today? Add it with <b>Event → Restock</b> (bought or made) so its cost is counted.</p>' : ''}`,
        async onSubmit(form) {
            await store.openNewDay({ openingCash: num(val(form, 'openingCash')) });
            toast(`Day ${n} open. Good luck!`, { type: 'success' });
            location.hash = '#sell';
        }
    });
}

const pendingHint = (ev) => {
    const p = store.pendingCosts(ev.id);
    return p.length ? `<div class="hint warn">${icon('alert')} <span>${plural(p.length, 'cost')} still pending: ${p.map((x) => esc(x.description)).join(', ')}.
        You can fill ${p.length > 1 ? 'them' : 'it'} in now or later from the Event tab; profit isn't final until you do.</span></div>` : '';
};

/** Close the day: cash count (expected vs counted), optional stock count, notes. */
export function closeDayDialog() {
    const day = store.openDay();
    const ev = store.activeEvent();
    const rep = computeReport({ eventId: ev.id, dayId: day.id });
    const expected = store.expectedCash(day);
    const pending = S.orders.filter((o) => o.dayId === day.id && o.fulfilment === 'pending' && o.status !== 'void').length;
    const tracked = S.ingredients.filter((i) => i.tracked).sort((a, b) => a.name.localeCompare(b.name));

    formModal({
        title: `Close day ${day.index}`, submitLabel: `Close day ${day.index}`,
        fields: `
            <div class="summary-grid">
                <div><span class="muted">Orders</span><b>${rep.orderCount}</b></div>
                <div><span class="muted">Items</span><b>${rep.items}</b></div>
                <div><span class="muted">Gross</span><b>${money(rep.gross)}</b></div>
                <div><span class="muted">Expenses today</span><b>${money(rep.costs)}</b></div>
            </div>
            ${rep.payments.length ? `<p class="muted small">${rep.payments.map((p) => `${esc(p.name)} ${money(p.amount)} (${p.count})`).join(' · ')}</p>` : ''}
            ${pending ? `<div class="hint warn">${icon('alert')} <span>${pending} order${pending > 1 ? 's are' : ' is'} still marked "to make". They'll be marked done.</span></div>` : ''}
            ${pendingHint(ev)}
            <fieldset class="field"><legend>Cash count</legend>
                <p class="small">Expected in drawer: <b>${money(expected)}</b>
                <span class="muted">(float ${money(day.openingCash)} + cash sales − expenses paid from drawer)</span></p>
                <label class="field"><span>Counted cash</span><input type="number" name="counted" inputmode="decimal" min="0" step="any" placeholder="${expected.toFixed(2)}"></label>
                <div class="change"><span>Difference</span><b data-diff>—</b></div>
            </fieldset>
            ${tracked.length ? `<details class="field"><summary>Count leftover stock (optional)</summary>
                <p class="muted small">Enter what you actually have. Leave blank to keep the system count.</p>
                <div class="count-grid">${tracked.map((i) => `<label class="count-row"><span>${esc(i.name)}</span>
                    <input type="number" inputmode="decimal" step="any" min="0" data-count="${i.id}" placeholder="${qtyFmt(i.stock)}"><small>${esc(i.unit)}</small></label>`).join('')}</div>
            </details>` : ''}
            <label class="field"><span>Notes for today</span><textarea name="notes" rows="2" placeholder="Weather, foot traffic, what ran out…"></textarea></label>`,
        onMount(m) {
            const inp = m.querySelector('[name=counted]');
            inp.addEventListener('input', () => {
                const out = m.querySelector('[data-diff]');
                if (inp.value === '') { out.textContent = '—'; out.className = ''; return; }
                const d = r2(num(inp.value) - expected);
                out.textContent = d === 0 ? 'Exact' : `${money(d, { sign: true })} ${d > 0 ? 'over' : 'short'}`;
                out.className = d < 0 ? 'neg' : d > 0 ? 'pos' : '';
            });
        },
        async onSubmit(form) {
            const counts = {};
            form.querySelectorAll('[data-count]').forEach((i) => { if (i.value !== '') counts[i.dataset.count] = num(i.value); });
            for (const o of S.orders.filter((x) => x.dayId === day.id && x.fulfilment === 'pending')) await store.setFulfilment(o.id, 'done');
            const closed = await store.closeDay({ countedCash: val(form, 'counted'), counts, notes: val(form, 'notes') });
            dayClosedDialog(closed);
        }
    });
}

/** Sections + headline numbers for a printed day summary. */
function daySummary(ev, day) {
    const rep = computeReport({ eventId: ev.id, dayId: day.id });
    const evRep = computeReport({ eventId: ev.id });
    const diff = day.countedCash == null ? null : r2(day.countedCash - day.expectedCash);
    return {
        title: `${ev.name} · Day ${day.index} summary · ${fmtDate(day.openedAt)}`,
        kpis: [
            ['Gross sales', money(rep.gross)], ['Orders', String(rep.orderCount)], ['Items', String(rep.items)],
            ['Cash difference', diff == null ? 'not counted' : diff === 0 ? 'Exact' : money(diff, { sign: true })]
        ],
        sections: [
            { title: 'Sales', rows: [
                ['Orders', String(rep.orderCount)], ['Items', String(rep.items)], ['Discounts', money(rep.discounts)],
                ['Voids', `${rep.voids.length} (${money(rep.voidAmount)})`], ['Average order', money(rep.aov)]
            ], total: ['Gross sales', money(rep.gross)] },
            { title: 'Payments', rows: rep.payments.map((p) => [`${p.name} (${p.count})`, money(p.amount)]), total: ['Total', money(rep.gross)] },
            { title: 'Cash drawer', rows: [
                ['Float', money(day.openingCash)], ['Expected', money(day.expectedCash ?? store.expectedCash(day))],
                ['Counted', day.countedCash == null ? '-' : money(day.countedCash)]
            ], total: ['Difference', diff == null ? '-' : money(diff, { sign: true })] },
            { title: 'Expenses today', rows: rep.expenses.map((x) => [x.description || x.category, x.pending ? 'pending' : money(x.amount)]), total: ['Total', money(rep.costs)] },
            { title: 'Products', wide: true, rows: rep.products.map((p) => [`${p.qty} × ${p.name}`, money(p.gross)]) },
            { title: 'Event to date', rows: [
                ['Gross', money(evRep.gross)], ['Capital + expenses', money(evRep.costs)],
                ...(evRep.pending.length ? [['Costs still pending', String(evRep.pending.length)]] : [])
            ], total: ['Profit', money(evRep.profit)] },
            ...(day.notes ? [{ title: 'Notes', rows: [[day.notes, '']] }] : [])
        ]
    };
}

function dayClosedDialog(day) {
    const ev = byId('events', day.eventId);
    const rep = computeReport({ eventId: ev.id, dayId: day.id });
    const last = store.eventDaysDone(ev);
    const hasPrinter = printer.isConnected();
    const ctl = openModal({
        title: `Day ${day.index} closed`, size: 's',
        body: `
            <div class="charge-total">${money(rep.gross)}</div>
            <p class="center muted">${plural(rep.orderCount, 'order')} · ${plural(rep.items, 'item')}${day.countedCash != null ? ` · cash ${r2(day.countedCash - day.expectedCash) === 0 ? 'exact' : money(day.countedCash - day.expectedCash, { sign: true })}` : ''}</p>
            ${last ? `<div class="hint">${icon('check')} <span>That was the last planned day${(ev.plannedDays || 1) > 1 ? ` (${ev.plannedDays} of ${ev.plannedDays})` : ''}. End the event to see the final report, or add another day.</span></div>` : ''}
            <p class="small">Save a backup now. If this device is lost or the browser data is cleared, the backup file is your only copy.</p>
            <div class="btn-row">
                <button class="btn" data-act="print">${icon('print')} Print summary</button>
                ${hasPrinter ? `<button class="btn" data-act="print-receipt">${icon('print')} Receipt printer</button>` : ''}
                <button class="btn" data-act="backup">${icon('download')} Backup</button>
            </div>`,
        footer: last
            ? `<button class="btn" data-act="add-day">${icon('plus')} Add a day</button><span class="grow"></span><button class="btn btn-primary" data-act="end-now">${icon('stop')} End event</button>`
            : `<span class="grow"></span><button class="btn btn-primary" data-close>Done</button>`,
        onMount(m) {
            m.addEventListener('click', async (e) => {
                const a = e.target.closest('[data-act]')?.dataset.act;
                if (!a) return;
                try {
                    const s = daySummary(ev, byId('days', day.id));
                    if (a === 'print') await printer.printSummary(s.title, s.sections, { target: 'page', kpis: s.kpis });
                    if (a === 'print-receipt') await printer.printSummary(`Day ${day.index} summary`, s.sections, { target: 'receipt' });
                    if (a === 'backup') await backupNow(ev.name);
                    if (a === 'add-day') { ctl.close(); openDayDialog(); }
                    if (a === 'end-now') { ctl.close(); endEventFlow(); }
                } catch (err) { toast(err.message, { type: 'error' }); }
            });
        }
    });
    return ctl;
}

/** Download a full backup file and remember when. */
export async function backupNow(label = 'backup') {
    download(`poppos-${slug(label)}-${todayISODate()}.json`, JSON.stringify(store.exportAll()));
    await store.saveSettings({ lastBackupAt: new Date().toISOString() });
    toast('Backup downloaded', { type: 'success' });
}

/** Confirm and end the event (mentions pending costs), then show its report. */
export async function endEventFlow() {
    const ev = store.activeEvent();
    if (!ev) return;
    if (store.openDay()) { toast('Close the current day first (Event → Close day).', { type: 'error' }); return; }
    const rep = computeReport({ eventId: ev.id });
    const pending = store.pendingCosts(ev.id);
    const ok = await confirmDialog(`End "${ev.name}"?`,
        `Gross ${money(rep.gross)} − costs ${money(rep.costs)} = ${rep.profit >= 0 ? 'profit' : 'loss'} ${money(Math.abs(rep.profit))}.\n\n` +
        (pending.length ? `${plural(pending.length, 'cost')} still pending (${pending.map((p) => p.description).join(', ')}). You can still fill ${pending.length > 1 ? 'them' : 'it'} in after ending, under "Costs still to enter" in the event's report.\n\n` : '') +
        'Leftover stock stays in your inventory for the next event. You can still view this event in Reports.',
        { okLabel: 'End event', danger: true });
    if (!ok) return;
    try {
        await store.endEvent();
        location.hash = `#reports/${ev.id}`;
        toast('Event ended. Here is the full report.', { type: 'success', action: { label: 'Backup', fn: () => backupNow(ev.name) }, duration: 8000 });
    } catch (err) { toast(err.message, { type: 'error' }); }
}
