// Start event and Edit event forms.
// The Start form autosaves a draft as you type, so closing it by accident loses nothing.

import * as store from '../../store.js';
import { esc, money, num, sum, todayISODate } from '../../util.js';
import { icon, toast, formModal, val, checked, FormDraft } from '../../ui.js';

const draft = new FormDraft('poppos.draft.startEvent');

/** A blank Start event form. */
const emptyForm = () => ({
    name: '', location: '', startDate: todayISODate(), capital: [['', '']],
    plannedDays: 1, plannedOutput: '', openNow: true, openingCash: 0, notes: ''
});

const hasContent = (v) => v.name || v.location || v.notes || v.plannedOutput || v.capital.some(([what, amount]) => what || amount);

// ---------- Start event ----------

/** Start event form. Restores an autosaved draft if there is one. */
export function startEventDialog() {
    if (store.activeEvent()) { location.hash = '#event'; return; }
    const saved = draft.load();
    const values = { ...emptyForm(), ...saved };
    if (saved?.caps && !saved.capital) values.capital = saved.caps; // drafts saved by 3.1/3.2
    let started = false; // stop autosaving once the event exists

    formModal({
        title: 'Start event',
        submitLabel: 'Start event',
        fields: startFormHTML(values, saved && hasContent(values)),
        onMount: (m) => wireStartForm(m, () => !started),
        async onSubmit(form) {
            const ev = await store.startEvent(readStartForm(form));
            started = true;
            draft.clear();
            toast(`"${ev.name}" started${checked(form, 'openNow') ? ', Day 1 open' : ''}`, { type: 'success' });
            location.hash = '#sell';
        }
    });
}

/** One capital line: what was bought + amount. */
const capitalRowHTML = (what = '', amount = '') => `<div class="cap-row">
    <input type="text" name="capDesc" placeholder="What (e.g. Coffee beans, milk, cups)" value="${esc(what)}">
    <input type="number" name="capAmt" inputmode="decimal" min="0" step="any" placeholder="₱" value="${esc(amount)}">
    <button type="button" class="icon-btn" data-rm aria-label="Remove">${icon('x')}</button></div>`;

function startFormHTML(v, restored) {
    return `
        ${restored ? `<div class="hint" data-draftnote>${icon('note')}<span class="grow">Restored what you typed earlier.</span>
            <button type="button" class="btn btn-ghost btn-sm" data-cleardraft>Start fresh</button></div>` : ''}
        <label class="field"><span>Event name *</span><input name="name" required placeholder="e.g. Weekend Market, School Fair" value="${esc(v.name)}"></label>
        <div class="row2">
            <label class="field"><span>Location</span><input name="location" placeholder="optional" value="${esc(v.location)}"></label>
            <label class="field"><span>Start date</span><input type="date" name="startDate" value="${esc(v.startDate)}"></label>
        </div>
        <div class="row2">
            <label class="field"><span>How many days?</span><input type="number" name="plannedDays" inputmode="numeric" min="1" max="60" value="${esc(v.plannedDays)}"></label>
            <label class="field"><span>Planned output <small>(items, optional)</small></span><input type="number" name="plannedOutput" inputmode="numeric" min="0" placeholder="e.g. 150" value="${esc(v.plannedOutput)}"></label>
        </div>
        <small class="muted field-note">After the last day you'll be asked to end the event (you can always add a day). Planned output shows the price you need to average to break even.</small>
        <fieldset class="field"><legend>Capital <small>(what you bought up front for this event)</small></legend>
            <div data-caps>${(v.capital.length ? v.capital : [['', '']]).map(([what, amount]) => capitalRowHTML(what, amount)).join('')}</div>
            <div class="row-between"><button type="button" class="btn btn-ghost btn-sm" data-addcap>${icon('plus')} Add line</button>
            <span>Total <b data-captotal>${money(0)}</b></span></div>
            <small class="muted">One line with the total is fine. Anything bought later (ice, extra milk) goes in as an expense or restock during the event.</small>
        </fieldset>
        <div class="hint" data-be hidden></div>
        <label class="check"><input type="checkbox" name="openNow" ${v.openNow ? 'checked' : ''}> Open Day 1 now</label>
        <label class="field" data-float><span>Starting cash in drawer (float)</span><input type="number" name="openingCash" inputmode="decimal" min="0" step="any" value="${esc(v.openingCash)}"></label>
        <label class="field"><span>Notes</span><textarea name="notes" rows="2" placeholder="optional">${esc(v.notes)}</textarea></label>`;
}

/** Everything in the form, for the draft. */
function formValues(form) {
    const f = form.elements;
    return {
        name: f.name.value, location: f.location.value, startDate: f.startDate.value,
        capital: [...form.querySelectorAll('.cap-row')].map((row) => [row.querySelector('[name=capDesc]').value, row.querySelector('[name=capAmt]').value]),
        plannedDays: f.plannedDays.value, plannedOutput: f.plannedOutput.value,
        openNow: f.openNow.checked, openingCash: f.openingCash.value, notes: f.notes.value
    };
}

/** Capital total, break-even hint ("average ₱30 per item"), float field visibility. */
function refreshSummary(m, form) {
    const capital = sum([...form.querySelectorAll('[name=capAmt]')], (i) => num(i.value));
    const planned = num(form.elements.plannedOutput.value);
    m.querySelector('[data-captotal]').textContent = money(capital);
    const hint = m.querySelector('[data-be]');
    hint.hidden = !(capital > 0 && planned > 0);
    if (!hint.hidden) hint.innerHTML = `To cover ${money(capital)} with ${planned} items you need to average <b>${money(capital / planned)}</b> per item.`;
    m.querySelector('[data-float]').hidden = !form.elements.openNow.checked;
}

function resetForm(m, form) {
    const blank = emptyForm();
    for (const [name, value] of Object.entries(blank)) {
        const field = form.elements[name];
        if (!field || name === 'capital') continue;
        if (field.type === 'checkbox') field.checked = value; else field.value = value;
    }
    m.querySelector('[data-caps]').innerHTML = capitalRowHTML();
    m.querySelector('[data-draftnote]')?.remove();
}

/** keepDraft(): false once the event has started, so a late keystroke doesn't recreate the draft. */
function wireStartForm(m, keepDraft) {
    const form = m.querySelector('form');
    const rows = m.querySelector('[data-caps]');
    const update = () => {
        refreshSummary(m, form);
        if (keepDraft()) draft.save(formValues(form));
    };

    m.addEventListener('input', update);
    m.addEventListener('change', update);
    m.addEventListener('click', (e) => {
        if (e.target.closest('[data-addcap]')) {
            rows.insertAdjacentHTML('beforeend', capitalRowHTML());
            rows.lastElementChild.querySelector('input').focus();
        }
        const remove = e.target.closest('[data-rm]');
        if (remove && rows.children.length > 1) { remove.parentElement.remove(); update(); }
        if (e.target.closest('[data-cleardraft]')) {
            draft.clear();
            resetForm(m, form);
            refreshSummary(m, form);
        }
    });
    refreshSummary(m, form);
}

/** Form → store.startEvent arguments. */
function readStartForm(form) {
    const name = val(form, 'name');
    if (!name) throw new Error('Give the event a name.');
    const capitalItems = [...form.querySelectorAll('.cap-row')]
        .map((row) => ({ description: row.querySelector('[name=capDesc]').value.trim() || 'Capital', amount: num(row.querySelector('[name=capAmt]').value) }))
        .filter((c) => c.amount > 0);
    return {
        name,
        location: val(form, 'location'),
        startDate: val(form, 'startDate'),
        plannedDays: Math.floor(num(val(form, 'plannedDays'), 1)) || 1,
        plannedOutput: Math.floor(num(val(form, 'plannedOutput'))) || null,
        notes: val(form, 'notes'),
        capitalItems,
        openingCash: checked(form, 'openNow') ? num(val(form, 'openingCash')) : null
    };
}

// ---------- Edit event ----------

/** Name, location, planned days (never fewer than already run), planned output, notes. */
export function editEventDialog() {
    const ev = store.activeEvent();
    const daysRun = store.eventDays(ev.id).length;
    formModal({
        title: 'Edit event',
        fields: `
            <label class="field"><span>Event name</span><input name="name" value="${esc(ev.name)}"></label>
            <label class="field"><span>Location</span><input name="location" value="${esc(ev.location)}"></label>
            <div class="row2">
                <label class="field"><span>How many days?</span><input type="number" name="plannedDays" min="${Math.max(1, daysRun)}" value="${ev.plannedDays || 1}"></label>
                <label class="field"><span>Planned output</span><input type="number" name="plannedOutput" min="0" value="${ev.plannedOutput || ''}"></label>
            </div>
            <label class="field"><span>Notes</span><textarea name="notes" rows="3">${esc(ev.notes)}</textarea></label>`,
        async onSubmit(form) {
            await store.updateEvent(ev.id, {
                name: val(form, 'name') || ev.name,
                location: val(form, 'location'),
                plannedDays: Math.max(1, daysRun, Math.floor(num(val(form, 'plannedDays'), 1))),
                plannedOutput: Math.floor(num(val(form, 'plannedOutput'))) || null,
                notes: val(form, 'notes')
            });
        }
    });
}
