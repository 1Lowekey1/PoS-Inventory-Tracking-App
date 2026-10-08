// Sell screen dialogs: line editor, add-on picker, discount, and charge.
// They change the order only through cart.js; the Sell screen re-renders itself.

import * as store from '../../store.js';
import { S, byId } from '../../store.js';
import { esc, money, num, r2, plural } from '../../util.js';
import { icon, toast, openModal } from '../../ui.js';
import * as printer from '../../printer.js';
import { cart } from './cart.js';

const addonButton = (m, on) => `<button type="button" class="opt ${on ? 'on' : ''}" data-mod="${m.id}">
    <span>${esc(m.name)}</span><small>${m.priceDelta ? money(m.priceDelta, { sign: true }) : 'free'}</small></button>`;

const toggleIn = (set, id) => (set.has(id) ? set.delete(id) : set.add(id));

// ---------- line editor ----------

/**
 * Quantity, optional extras and add-ons, for a new product ({ productId }) or
 * an existing cart line ({ key }).
 * For a line of several cups, "Apply to N of M cups" splits it: N cups get the
 * new choices, the rest keep the old ones (5 Americanos → 3 with syrup + 2 plain).
 * "Split into single cups" gives every cup its own line instead.
 */
export function openItemDialog({ productId, key }) {
    const existing = key ? cart.find(key) : null;
    if (existing?.addonId) return;
    const product = byId('products', existing ? existing.productId : productId);
    if (!product) return;

    const cups = existing ? existing.qty : 0;   // cups on the existing line
    const multi = cups > 1;
    let qty = existing ? existing.qty : 1;      // new quantity when editing the whole line
    let apply = cups;                           // how many of those cups get the changes
    const addons = new Set(existing ? existing.modifierIds : []);
    const extras = new Set(existing ? existing.optionIds : []);

    const options = store.productOptions(product);
    const offered = (product.modifierIds || []).map((id) => byId('modifiers', id)).filter(Boolean);
    const others = S.modifiers.filter((m) => !offered.includes(m));

    const ctl = openModal({
        title: product.name, size: 's',
        body: itemDialogHTML({ product, cups, multi, apply, qty, addons, extras, options, offered, others }),
        footer: `${existing ? `<button class="btn btn-danger-ghost" data-close="remove">${icon('trash')} Remove</button>` : ''}
            <span class="grow"></span><button class="btn" data-close>Cancel</button>
            <button class="btn btn-primary" data-close="ok">${existing ? 'Update' : 'Add to order'}</button>`,
        onMount(m) {
            const qtyInput = m.querySelector('[data-qty]');
            const refresh = () => {
                const partial = multi && apply < cups;
                m.querySelector('[data-qtyrow]').hidden = partial;
                if (multi) {
                    m.querySelector('[data-apply]').textContent = apply;
                    m.querySelector('[data-all]').classList.toggle('on', !partial);
                    m.querySelector('[data-applyhint]').textContent = partial
                        ? `${plural(apply, 'cup')} get the choices below; the other ${cups - apply} stay as they are.`
                        : 'Changes apply to every cup on this line.';
                }
                m.querySelector('[data-totlabel]').textContent = partial ? `These ${plural(apply, 'cup')}` : 'Line total';
                m.querySelector('[data-total]').textContent = money(store.linePrice(product, [...addons]) * (partial ? apply : qty));
            };
            m.addEventListener('click', (e) => {
                const b = e.target.closest('button');
                if (!b) return;
                const d = b.dataset;
                if (d.q) { qty = Math.max(1, qty + Number(d.q)); qtyInput.value = qty; }
                if (d.a) apply = Math.min(cups, Math.max(1, apply + Number(d.a)));
                if (b.hasAttribute('data-all')) apply = cups;
                if (d.mod) { toggleIn(addons, d.mod); b.classList.toggle('on'); }
                if (d.optn) { toggleIn(extras, d.optn); b.classList.toggle('on'); }
                refresh();
            });
            qtyInput.addEventListener('input', () => { qty = Math.max(1, Math.floor(num(qtyInput.value, 1))); refresh(); });
            m.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); m.querySelector('[data-close="ok"]').click(); } });
            refresh();
        }
    });

    ctl.result.then((action) => {
        if (action === 'remove') return cart.setQty(existing.key, 0);
        if (action === 'split') {
            const n = cart.splitIntoSingles(existing.key);
            return toast(`Split into ${n} cups. Set each one; identical cups are grouped again when you charge.`);
        }
        if (action !== 'ok') return;
        const chosen = { productId: product.id, modifierIds: [...addons], optionIds: [...extras] };
        if (!existing) return cart.add(chosen, qty);
        if (apply < cups) {
            const unchanged = { productId: product.id, modifierIds: existing.modifierIds, optionIds: existing.optionIds, splitId: existing.splitId };
            return cart.replace(existing.key, [{ ...unchanged, qty: cups - apply }, { ...chosen, qty: apply }]);
        }
        cart.replace(existing.key, [{ ...chosen, splitId: existing.splitId, qty }]);
    });
}

/** Body of the line editor: "Apply to N of M cups", quantity, optional extras, add-ons, split. */
function itemDialogHTML({ cups, multi, apply, qty, addons, extras, options, offered, others }) {
    return `
            ${multi ? `<div class="apply-row">
                <span class="apply-label">Apply to</span>
                <div class="stepper apply-stepper">
                    <button type="button" class="icon-btn lg" data-a="-1" aria-label="One cup less">${icon('minus')}</button>
                    <span><b data-apply>${apply}</b> <small class="muted">of ${cups} cups</small></span>
                    <button type="button" class="icon-btn lg" data-a="1" aria-label="One cup more">${icon('plus')}</button>
                </div>
                <button type="button" class="chip" data-all>All</button>
            </div>
            <p class="muted small" data-applyhint></p>` : ''}
            <div class="qty-big" data-qtyrow>
                <button class="icon-btn lg" data-q="-1" aria-label="One less">${icon('minus')}</button>
                <input type="number" inputmode="numeric" min="1" value="${qty}" data-qty aria-label="Quantity">
                <button class="icon-btn lg" data-q="1" aria-label="One more">${icon('plus')}</button>
            </div>
            ${options.length ? `<h3 class="sub">Optional <small class="muted">(no extra charge)</small></h3><div class="opts">${options.map((o) =>
                `<button type="button" class="opt ${extras.has(o.ingredientId) ? 'on' : ''}" data-optn="${o.ingredientId}"><span>${esc(o.name)}</span><small>free</small></button>`).join('')}</div>` : ''}
            ${offered.length ? `<h3 class="sub">Add-ons</h3><div class="opts">${offered.map((m) => addonButton(m, addons.has(m.id))).join('')}</div>` : ''}
            ${others.length ? `<details class="more-opts" ${offered.length ? '' : 'open'}><summary>${offered.length ? 'Other add-ons' : 'Add-ons'}</summary>
                <div class="opts">${others.map((m) => addonButton(m, addons.has(m.id))).join('')}</div></details>` : ''}
            ${multi ? `<button type="button" class="btn btn-ghost btn-sm split-btn" data-close="split">${icon('copy')} Split into ${cups} single cups</button>` : ''}
            <div class="opt-total"><span data-totlabel>Line total</span><b data-total></b></div>`;
}

// ---------- add-on after payment ----------

/**
 * Sell add-ons on their own, e.g. "extra shot for #12" after #12 was paid.
 * forOrderNumber preselects the order (when opened from the Orders screen).
 */
export function openAddonPicker(forOrderNumber = null) {
    if (!S.modifiers.length) { toast('No add-ons yet. Create them in Menu → Add-ons.', { type: 'error' }); return; }
    const st = store.settings();
    const day = store.openDay();
    const recentOrders = S.orders
        .filter((o) => o.status !== 'void' && (st.practice ? o.practice : !o.practice && day && o.dayId === day.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 20);
    const picked = new Map(); // addonId → count

    const ctl = openModal({
        title: 'Add-on', size: 's',
        body: `
            <p class="muted small">For a customer adding something after paying, e.g. an extra shot. It's charged as its own small order.</p>
            <label class="field"><span>For order</span><select data-for>
                <option value="">Not linked to an order</option>
                ${recentOrders.map((o) => `<option value="${o.number}" ${o.number === forOrderNumber ? 'selected' : ''}>#${o.number}${o.note ? ` · ${esc(o.note)}` : ''} · ${esc(o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')).slice(0, 60)}</option>`).join('')}
            </select></label>
            <div class="opts">${S.modifiers.map((m) => `<button type="button" class="opt" data-pick="${m.id}">
                <span>${esc(m.name)} <b data-n></b></span><small>${m.priceDelta ? money(m.priceDelta, { sign: true }) : 'free'}</small></button>`).join('')}</div>
            <p class="muted small">Tap an add-on again to add another. Only what the add-on <i>adds</i> is taken from stock (a swap like oat milk can't be undone after the drink is made).</p>`,
        footer: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-close="ok">Add to order</button>`,
        onMount(m) {
            m.addEventListener('click', (e) => {
                const b = e.target.closest('[data-pick]');
                if (!b) return;
                const id = b.dataset.pick;
                picked.set(id, (picked.get(id) || 0) + 1);
                b.classList.add('on');
                b.querySelector('[data-n]').textContent = `×${picked.get(id)}`;
            });
        }
    });
    ctl.result.then((action) => {
        if (action !== 'ok' || !picked.size) return;
        const forOrder = Number(ctl.el.querySelector('[data-for]').value) || null;
        for (const [addonId, n] of picked) cart.add({ addonId, forOrder }, n);
        toast('Add-on added to the current order. Charge it as usual.');
    });
}

// ---------- discount ----------

/** Preset discounts (e.g. Senior/PWD 20%) or a custom % / amount for the whole order. */
export function openDiscountDialog() {
    const st = store.settings();
    const current = cart.discount;
    const ctl = openModal({
        title: 'Discount', size: 's',
        body: `
            <div class="opts">${st.discounts.map((d) => `<button type="button" class="opt ${current?.name === d.name ? 'on' : ''}" data-close="preset:${d.id}">
                <span>${esc(d.name)}</span><small>${d.pct}% off</small></button>`).join('')}</div>
            <h3 class="sub">Custom</h3>
            <div class="row2">
                <label class="field"><span>Percent off</span><input type="number" inputmode="decimal" min="0" max="100" data-pct placeholder="e.g. 15"></label>
                <label class="field"><span>Amount off</span><input type="number" inputmode="decimal" min="0" data-amt placeholder="e.g. 20"></label>
            </div>`,
        footer: `${current ? '<button class="btn btn-danger-ghost" data-close="none">Remove discount</button>' : ''}
            <span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn btn-primary" data-close="custom">Apply</button>`
    });
    ctl.result.then((action) => {
        if (!action) return;
        if (action === 'none') return cart.setDiscount(null);
        if (action.startsWith('preset:')) {
            const d = st.discounts.find((x) => x.id === action.slice(7));
            return cart.setDiscount({ name: d.name, pct: d.pct });
        }
        const pct = num(ctl.el.querySelector('[data-pct]').value);
        const amount = num(ctl.el.querySelector('[data-amt]').value);
        if (pct > 0) cart.setDiscount({ name: `${pct}% off`, pct: Math.min(100, pct) });
        else if (amount > 0) cart.setDiscount({ name: `${money(amount)} off`, amount });
    });
}

// ---------- charge ----------

/** Quick cash buttons: the next round amounts (₱20/50/100) and your usual bills, above the total. */
function quickTenderAmounts(total, bills) {
    const roundUps = [20, 50, 100].map((step) => Math.ceil(total / step) * step);
    return [...new Set([...roundUps, ...bills])].filter((v) => v > total).sort((a, b) => a - b).slice(0, 5);
}

/** Body of the charge dialog: total, payment methods, cash tender + change, name/note, print option. */
function chargeDialogHTML({ total, methods, method, quickAmounts, askToPrint }) {
    return `
            <div class="charge-total">${money(total)}</div>
            <div class="seg" role="radiogroup" aria-label="Payment method">
                ${methods.map((m) => `<button type="button" class="seg-btn ${m.id === method ? 'on' : ''}" data-method="${m.id}">${esc(m.name)}</button>`).join('')}
            </div>
            <div data-cash>
                <div class="tender">
                    <button type="button" class="opt on" data-tender="${total}"><span>Exact</span></button>
                    ${quickAmounts.map((v) => `<button type="button" class="opt" data-tender="${v}"><span>${money(v)}</span></button>`).join('')}
                </div>
                <label class="field"><span>Cash received</span><input type="number" inputmode="decimal" data-tendered value="${total}" min="0" step="any"></label>
                <div class="change"><span>Change</span><b data-change>${money(0)}</b></div>
            </div>
            <label class="field"><span>Name / note <small>(optional, shows in the queue)</small></span><input type="text" data-note maxlength="40" placeholder="e.g. Ana, less ice"></label>
            ${askToPrint ? `<label class="check"><input type="checkbox" data-print> Print receipt</label>` : ''}`;
}

/**
 * Take payment and complete the sale. Exact cash is preselected so a sale is
 * Charge → Complete. onSold(order) runs after the sale is saved.
 */
export function openChargeDialog({ onSold } = {}) {
    const st = store.settings();
    const { total } = cart.totals;
    const methods = store.enabledPayments();
    let method = methods.some((m) => m.id === 'cash') ? 'cash' : methods[0]?.id;
    let tendered = total;

    const ctl = openModal({
        title: 'Charge', size: 's',
        body: chargeDialogHTML({ total, methods, method, quickAmounts: quickTenderAmounts(total, st.quickTender), askToPrint: st.printer.autoPrint === 'ask' }),
        footer: `<button class="btn" data-close>Back</button><button class="btn btn-primary btn-lg grow" data-complete>${icon('check')} Complete sale</button>`,
        onMount(m) {
            const tenderedInput = m.querySelector('[data-tendered]');
            const refresh = () => {
                m.querySelector('[data-cash]').hidden = method !== 'cash';
                const change = r2(tendered - total);
                const out = m.querySelector('[data-change]');
                out.textContent = change < 0 ? `Short ${money(-change)}` : money(change);
                out.classList.toggle('neg', change < 0);
                m.querySelectorAll('[data-tender]').forEach((b) => b.classList.toggle('on', Number(b.dataset.tender) === tendered));
            };

            let busy = false; // a fast double tap must not create two orders
            const complete = async () => {
                if (busy) return;
                if (method === 'cash' && tendered < total) { toast('Cash received is less than the total.', { type: 'error' }); return; }
                busy = true;
                try {
                    const order = await store.checkout({
                        lines: cart.lines, discount: cart.discount, method, tendered,
                        note: m.querySelector('[data-note]').value.trim()
                    });
                    const wantPrint = m.querySelector('[data-print]')?.checked;
                    ctl.close('done');
                    cart.clear();
                    onSold?.(order);
                    const change = order.payment.change > 0 ? ` · Change ${money(order.payment.change)}` : '';
                    toast(`Order #${order.number} · ${money(order.total)}${change}`, {
                        type: 'success', duration: 5000,
                        action: { label: 'Undo', fn: () => store.voidOrder(order.id, 'Undone at counter').then(() => toast(`Order #${order.number} voided, stock restored`)) }
                    });
                    // Drawer/printer problems are reported but never undo the sale.
                    (await printer.afterSale(order, { forcePrint: wantPrint })).forEach((msg) => toast(msg, { type: 'error' }));
                } catch (err) {
                    busy = false;
                    toast(err.message, { type: 'error' });
                }
            };

            m.addEventListener('click', (e) => {
                const b = e.target.closest('button');
                if (!b) return;
                if (b.dataset.method) {
                    method = b.dataset.method;
                    m.querySelectorAll('[data-method]').forEach((x) => x.classList.toggle('on', x === b));
                }
                if (b.dataset.tender) { tendered = Number(b.dataset.tender); tenderedInput.value = tendered; }
                if (b.hasAttribute('data-complete')) complete();
                refresh();
            });
            tenderedInput.addEventListener('input', () => { tendered = num(tenderedInput.value, 0); refresh(); });
            tenderedInput.addEventListener('focus', () => tenderedInput.select());
            m.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); complete(); } });
            refresh();
        }
    });
}
