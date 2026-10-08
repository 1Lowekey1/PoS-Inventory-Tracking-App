// Settings screen (one card per topic) and the phone-only "More" page.
//
// Simple settings save themselves on change: inputs carry data-set="key"
// ("printer.paper" for nested keys) plus data-num / data-bool / data-list
// to say how to read the value. See onChange().

import * as store from '../store.js';
import { S } from '../store.js';
import * as db from '../db.js';
import * as printer from '../printer.js';
import { esc, num, uid, plural, fmtDateTime } from '../util.js';
import { icon, toast, openModal, confirmDialog } from '../ui.js';
import { backupNow } from './event.js';
import { hasV2Data, importV2FromBrowser, importV2File, loadSample } from './onboarding.js';
import { cart } from './sell/cart.js';
import { APP_VERSION, applyTheme, setWakeLock } from '../system.js';

const BUILT_IN_PAYMENTS = ['cash', 'gcash', 'maya', 'card']; // can be switched off, not deleted

let root = null;
let storage = null; // { usage, quota, persisted }, loaded once in the background

export function renderMore(el) {
    el.innerHTML = `<div class="page"><header class="page-head"><h1>More</h1></header>
        <ul class="list big-links">
            <li><a class="list-item" href="#menu">${icon('menu')}<div class="grow"><b>Menu</b><small class="muted">Products, categories, add-ons</small></div></a></li>
            <li><a class="list-item" href="#settings">${icon('settings')}<div class="grow"><b>Settings</b><small class="muted">Receipt, payments, printer, backup</small></div></a></li>
        </ul></div>`;
}

export function render(el) {
    root = el;
    const st = store.settings();
    if (!storage) {
        db.storageInfo().then((info) => {
            storage = info;
            if (root?.isConnected && location.hash.startsWith('#settings')) render(root);
        });
    }

    el.innerHTML = `<div class="page settings">
        <header class="page-head"><h1>Settings</h1></header>
        ${businessCard(st)}
        ${paymentsCard(st)}
        ${sellingCard(st)}
        ${printerCard(st.printer)}
        ${displayCard(st)}
        ${practiceCard()}
        ${dataCard(st)}
        <p class="muted small center">PopPOS ${APP_VERSION} · ${navigator.onLine ? 'online' : 'offline'} · device ${esc(st.deviceId.slice(-6))}</p>
    </div>`;

    if (!el.dataset.wired) {
        el.dataset.wired = '1';
        el.addEventListener('change', onChange);
        el.addEventListener('click', onClick);
    }
}

// ---------- building blocks ----------

/** On/off row bound to a setting. value overrides the current setting (for nested printer keys). */
function toggle(key, label, hint, value) {
    const on = value ?? store.settings()[key];
    return `<label class="toggle-row"><div class="grow"><b>${esc(label)}</b><small class="muted">${esc(hint)}</small></div>
        <span class="switch"><input type="checkbox" data-set="${key}" data-bool ${on ? 'checked' : ''}><span></span></span></label>`;
}

/** <select> bound to a setting. options: [[value, label]]. */
function select(key, options, current, extra = '') {
    return `<select data-set="${key}" ${extra}>${options.map(([value, label]) =>
        `<option value="${value}" ${String(current) === String(value) ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
}

// ---------- cards ----------

function businessCard(st) {
    return `<section class="card">
        <h2>Business & receipt</h2>
        <div class="row2">
            <label class="field"><span>Business name</span><input data-set="businessName" value="${esc(st.businessName)}"></label>
            <label class="field"><span>Receipt line <small>(address, IG handle…)</small></span><input data-set="receiptLine" value="${esc(st.receiptLine)}"></label>
        </div>
        <label class="field"><span>Receipt footer</span><input data-set="receiptFooter" value="${esc(st.receiptFooter)}"></label>
        <div class="row2">
            <label class="field"><span>Currency symbol (screen)</span><input data-set="currency" value="${esc(st.currency)}" maxlength="4"></label>
            <label class="field"><span>Currency on printed receipts</span><input data-set="receiptCurrency" value="${esc(st.receiptCurrency)}" maxlength="4"><small class="muted">Most receipt printers can't print ₱.</small></label>
        </div>
    </section>`;
}

function paymentsCard(st) {
    return `<section class="card">
        <h2>Payment methods</h2>
        <ul class="list">${st.paymentMethods.map((p) => `<li class="list-item">
            <b class="grow">${esc(p.name)}</b>
            ${BUILT_IN_PAYMENTS.includes(p.id) ? '' : `<button class="icon-btn" data-delpay="${p.id}" aria-label="Remove">${icon('trash')}</button>`}
            <label class="switch"><input type="checkbox" data-pay="${p.id}" ${p.enabled ? 'checked' : ''}><span></span></label></li>`).join('')}</ul>
        <div class="inline-add"><input placeholder="Add method (e.g. Bank transfer)" data-newpay><button class="btn btn-sm" data-act="addpay">${icon('plus')} Add</button></div>
    </section>`;
}

function sellingCard(st) {
    const tileSizes = [['s', 'Small (more per screen)'], ['m', 'Medium'], ['l', 'Large (big fingers, tablets)']];
    return `<section class="card">
        <h2>Selling</h2>
        ${toggle('useQueue', 'Order queue', 'Sold orders wait in a "To make" strip until you tap them. Helps when a line forms.')}
        ${toggle('blockOutOfStock', 'Block sales when out of stock', 'Off = you can still sell when the system count hits zero (counts drift; your eyes win).')}
        <div class="row2">
            <label class="field"><span>Warn when a product has this many left</span><input type="number" min="0" data-set="lowCupsWarn" data-num value="${st.lowCupsWarn}"></label>
            <label class="field"><span>Tile size</span>${select('tileSize', tileSizes, st.tileSize)}</label>
        </div>
        <label class="field"><span>Quick cash buttons</span><input data-set="quickTender" data-list="num" value="${st.quickTender.join(', ')}"><small class="muted">Comma-separated bills, e.g. 100, 200, 500, 1000</small></label>
        <label class="field"><span>Expense categories</span><input data-set="expenseCategories" data-list="text" value="${esc(st.expenseCategories.join(', '))}"></label>
        <div class="field"><span>Discount presets</span>
            <ul class="list compact">${st.discounts.map((d) => `<li class="list-item"><b class="grow">${esc(d.name)}</b><span>${d.pct}%</span>
                <button class="icon-btn" data-deldisc="${d.id}" aria-label="Remove">${icon('trash')}</button></li>`).join('')}</ul>
            <div class="inline-add"><input placeholder="Name" data-newdisc-name><input type="number" placeholder="%" min="1" max="100" data-newdisc-pct class="w-num">
            <button class="btn btn-sm" data-act="adddisc">${icon('plus')} Add</button></div></div>
    </section>`;
}

function printerCard(pr) {
    const connected = printer.isConnected();
    const connectButton = (type, label) => `<button class="btn" data-connect="${type}" ${printer.support[type] ? '' : 'disabled'}>${label}</button>`;
    const printWhen = [['off', 'Only when I tap Receipt'], ['ask', 'Ask at each sale'], ['always', 'Always']];
    return `<section class="card">
        <h2>Receipt printer & cash drawer</h2>
        <p class="muted small">Works with ESC/POS thermal printers in Chrome or Edge (Windows, Android, ChromeOS, Mac). The cash drawer plugs into the printer's drawer port. iPhone and iPad can't connect to printers from a browser and will use the normal print dialog.</p>
        <div class="printer-status ${connected ? 'on' : ''}">${icon('print')} <b>${esc(printer.connectionLabel())}</b></div>
        <div class="btn-row">
            ${connectButton('serial', 'USB (COM / serial)')}${connectButton('usb', 'USB (direct)')}${connectButton('bluetooth', 'Bluetooth')}
            ${connected ? '<button class="btn btn-ghost" data-act="disconnect">Disconnect</button>' : ''}
        </div>
        <p class="muted small">Not sure which USB option? Try <b>USB (COM / serial)</b> first. If the printer doesn't show up, try <b>USB (direct)</b>. On Windows, direct USB may need the printer's own driver removed.</p>
        <div class="row2">
            <label class="field"><span>Paper width</span>${select('printer.paper', [[58, '58 mm'], [80, '80 mm']], pr.paper, 'data-num')}</label>
            <label class="field"><span>Print receipts</span>${select('printer.autoPrint', printWhen, pr.autoPrint)}</label>
        </div>
        ${toggle('printer.drawerOnCash', 'Open cash drawer on cash sales', 'Only when a printer is connected.', pr.drawerOnCash)}
        <details><summary class="small">Advanced</summary>
            <label class="field"><span>Serial baud rate</span><input type="number" data-set="printer.baud" data-num value="${pr.baud}"><small class="muted">Usually 9600 or 115200. Check the printer's self-test page.</small></label></details>
        <div class="btn-row mt">
            <button class="btn" data-act="testprint">${icon('print')} Test print</button>
            <button class="btn" data-act="drawer" ${connected ? '' : 'disabled'}>${icon('drawer')} Open drawer</button>
        </div>
    </section>`;
}

function displayCard(st) {
    return `<section class="card">
        <h2>Display</h2>
        <label class="field"><span>Theme</span>${select('theme', [['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']], st.theme)}</label>
        ${toggle('keepAwake', 'Keep screen on while a day is open', 'Stops the phone or tablet from sleeping at the counter.')}
    </section>`;
}

function practiceCard() {
    const count = S.orders.filter((o) => o.practice).length;
    return `<section class="card">
        <h2>Practice mode</h2>
        ${toggle('practice', 'Practice mode', 'Sell without an event, for training or testing prices. Practice sales use up stock so you can see the effect; everything is put back when you turn it off. Never in reports.')}
        ${count ? `<button class="btn btn-sm" data-act="clearpractice">${icon('trash')} Delete ${plural(count, 'practice order')}</button>` : ''}
    </section>`;
}

function dataCard(st) {
    const storageNote = !storage ? '' : `<p class="muted small">Using ${(storage.usage / 1048576).toFixed(1)} MB. ${storage.persisted
        ? 'Storage is protected from automatic clean-up.'
        : 'The browser may clear data if the device runs low on space. Install the app (Add to Home Screen) and back up after each day.'}</p>`;
    return `<section class="card">
        <h2>Data & backup</h2>
        <p class="small">Everything is stored on <b>this device only</b>. Last backup: <b>${st.lastBackupAt ? fmtDateTime(st.lastBackupAt) : 'never'}</b>.</p>
        ${storageNote}
        <div class="btn-row">
            <button class="btn btn-primary" data-act="backup">${icon('download')} Download backup</button>
            <label class="btn">${icon('upload')} Restore / import file<input type="file" accept=".json,application/json" data-restore hidden></label>
            ${hasV2Data() ? `<button class="btn" data-act="importv2">${icon('upload')} Import from old Booth POS</button>` : ''}
            <button class="btn btn-ghost" data-act="sample">Add sample menu</button>
        </div>
        <p class="muted small">Restore accepts PopPOS backups (replaces everything here) and old Booth POS backups (added to what's here). To move to another device: download a backup here, then restore it there.</p>
        <details class="danger-zone"><summary>Danger zone</summary>
            <button class="btn btn-danger" data-act="erase">${icon('trash')} Erase everything on this device</button></details>
    </section>`;
}

// ---------- events ----------

/** Auto-save for data-set inputs, plus payment toggles and the restore file picker. */
async function onChange(e) {
    const t = e.target;
    const st = store.settings();
    if (t.matches('[data-restore]')) { restore(t.files[0]); t.value = ''; return; }
    if (t.matches('[data-pay]')) {
        const methods = st.paymentMethods.map((p) => (p.id === t.dataset.pay ? { ...p, enabled: t.checked } : p));
        if (!methods.some((p) => p.enabled)) { toast('Keep at least one payment method on.', { type: 'error' }); t.checked = true; return; }
        await store.saveSettings({ paymentMethods: methods });
        return;
    }
    const key = t.dataset.set;
    if (!key) return;
    let v = t.dataset.bool !== undefined ? t.checked : t.value;
    if (t.dataset.num !== undefined) v = num(v);
    if (t.dataset.list === 'num') v = v.split(',').map((x) => num(x)).filter((x) => x > 0).sort((a, b) => a - b);
    if (t.dataset.list === 'text') v = v.split(',').map((x) => x.trim()).filter(Boolean);
    if (key.startsWith('printer.')) await store.saveSettings({ printer: { ...st.printer, [key.slice(8)]: v } });
    else if (key === 'practice') {
        await store.setPractice(v);
        toast(v ? 'Practice mode on. Stock changes will be put back when you turn it off.' : 'Practice mode off. Stock it used has been put back.', { type: 'success' });
        return;
    } else await store.saveSettings({ [key]: v });
    if (key === 'theme') applyTheme();
    if (key === 'keepAwake') setWakeLock();
    toast('Saved', { duration: 1200 });
}

/** Buttons: printer, payment/discount lists, backup and data actions. */
async function onClick(e) {
    const t = e.target.closest('[data-act], [data-connect], [data-delpay], [data-deldisc]');
    if (!t) return;
    const st = store.settings();
    try {
        if (t.dataset.connect) {
            await printer.connect(t.dataset.connect);
            await store.saveSettings({ printer: { ...st.printer, type: t.dataset.connect } });
            toast(`Connected: ${printer.connectionLabel()}`, { type: 'success' });
            return;
        }
        if (t.dataset.delpay) { await store.saveSettings({ paymentMethods: st.paymentMethods.filter((p) => p.id !== t.dataset.delpay) }); return; }
        if (t.dataset.deldisc) { await store.saveSettings({ discounts: st.discounts.filter((d) => d.id !== t.dataset.deldisc) }); return; }
        switch (t.dataset.act) {
            case 'addpay': {
                const name = root.querySelector('[data-newpay]').value.trim();
                if (name) await store.saveSettings({ paymentMethods: [...st.paymentMethods, { id: uid(), name, enabled: true }] });
                break;
            }
            case 'adddisc': {
                const name = root.querySelector('[data-newdisc-name]').value.trim();
                const pct = num(root.querySelector('[data-newdisc-pct]').value);
                if (!name || !(pct > 0 && pct <= 100)) { toast('Enter a name and a percent from 1 to 100.', { type: 'error' }); break; }
                await store.saveSettings({ discounts: [...st.discounts, { id: uid(), name, pct }] });
                break;
            }
            case 'disconnect': await printer.disconnect(); await store.saveSettings({ printer: { ...st.printer, type: 'none' } }); break;
            case 'testprint': await printer.testPrint(); break;
            case 'drawer': await printer.openDrawer(); break;
            case 'clearpractice':
                if (await confirmDialog('Delete practice orders?', 'Only practice orders are removed.', { danger: true, okLabel: 'Delete' })) await store.clearPractice();
                break;
            case 'backup': await backupNow('backup'); break;
            case 'importv2': await importV2FromBrowser(); break;
            case 'sample': await loadSample(); break;
            case 'erase': await erase(); break;
        }
    } catch (err) {
        if (err?.name === 'NotFoundError') return; // user closed the device picker
        toast(err.message || String(err), { type: 'error' });
    }
}

/** A PopPOS backup replaces everything; an old Booth POS backup is added. */
async function restore(file) {
    if (!file) return;
    let json;
    try { json = JSON.parse(await file.text()); } catch { toast('That file is not valid JSON.', { type: 'error' }); return; }
    try {
        if (json.app === 'PopPOS') {
            const d = json.data;
            const ok = await confirmDialog('Restore backup?',
                `Backup from ${fmtDateTime(json.exportedAt)}:\n${d.products?.length || 0} products, ${d.events?.length || 0} events, ${d.orders?.length || 0} orders.\n\n` +
                'This REPLACES everything currently on this device. Download a backup of the current data first if you might need it.',
                { danger: true, okLabel: 'Replace with backup' });
            if (!ok) return;
            await store.importAll(json);
            applyTheme();
            toast('Backup restored', { type: 'success' });
        } else if (Array.isArray(json.products) || Array.isArray(json.ingredients)) {
            await importV2File(json);
        } else {
            toast('Not a PopPOS or Booth POS backup file.', { type: 'error' });
        }
    } catch (err) { toast(err.message, { type: 'error' }); }
}

/** Requires typing ERASE, so it can't happen by accident. */
async function erase() {
    const ctl = openModal({
        title: 'Erase everything?', size: 's',
        body: `<p>Products, stock, events, orders and settings on this device will be deleted. This cannot be undone.</p>
            <label class="field"><span>Type <b>ERASE</b> to confirm</span><input data-confirm autocomplete="off"></label>`,
        footer: '<button class="btn" data-close>Cancel</button><button class="btn btn-danger" data-go disabled>Erase</button>',
        onMount(m) {
            const inp = m.querySelector('[data-confirm]');
            const go = m.querySelector('[data-go]');
            inp.addEventListener('input', () => { go.disabled = inp.value.trim() !== 'ERASE'; });
            go.addEventListener('click', async () => {
                await store.eraseEverything();
                cart.clear();
                ctl.close();
                toast('All data erased');
                location.hash = '#sell';
            });
        }
    });
}
