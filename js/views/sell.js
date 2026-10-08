// Sell screen: product tiles on the left, the current order on the right
// (a bottom sheet on phones). Built for one person behind the counter: big
// targets, exact cash in two taps, and a "To make" queue.
//
//   sell/cart.js     the order being built (lines, discount, saved locally)
//   sell/dialogs.js  line editor, add-on picker, discount, charge
//
// The screen is drawn in regions (banner, queue, categories, tiles, cart) so a
// tap on a tile redraws only what changed.

import * as store from '../store.js';
import { S, byId } from '../store.js';
import { esc, money, plural } from '../util.js';
import { icon, toast, modalOpen } from '../ui.js';
import { startEventDialog, openDayDialog, endEventFlow } from './event.js';
import { emptyMenuCard } from './onboarding.js';
import { cart } from './sell/cart.js';
import { openItemDialog, openAddonPicker, openDiscountDialog, openChargeDialog } from './sell/dialogs.js';

export { openAddonPicker }; // used by the Orders screen

const LONG_PRESS_MS = 450;

let root = null;          // the screen's container while it's on screen
let category = 'all';     // selected category tab
let search = '';          // search box text (lower case)
let pressTimer = null;
let longPressed = false;  // swallow the click that follows a long press

const onScreen = () => !!root?.isConnected;

cart.onChange((change) => {
    if (!onScreen()) return;
    renderCart();
    renderTiles();
    if (change === 'add') bumpTotal();
});

// ---------- rendering ----------

export function render(el) {
    root = el;
    if (!root.querySelector('.sell')) buildShell();
    cart.dropDeleted();
    renderBanner();
    renderQueue();
    renderCategories();
    renderTiles();
    renderCart();
}

function buildShell() {
    root.innerHTML = `
        <div class="sell">
            <section class="sell-main">
                <div data-region="banner"></div>
                <div data-region="queue"></div>
                <div class="sell-toolbar">
                    <div class="chips" data-region="cats"></div>
                    <label class="search">${icon('search')}<input type="search" placeholder="Search" aria-label="Search products" data-search></label>
                </div>
                <div class="tile-grid" data-region="tiles"></div>
            </section>
            <aside class="cart" data-region="cart"></aside>
        </div>`;
    root.addEventListener('click', onClick);
    root.addEventListener('input', (e) => {
        if (e.target.matches('[data-search]')) { search = e.target.value.trim().toLowerCase(); renderTiles(); }
    });
    // Long press (or right-click) on a tile opens the line editor before adding.
    root.addEventListener('pointerdown', onPointerDown);
    for (const ev of ['pointerup', 'pointercancel']) root.addEventListener(ev, cancelLongPress);
    root.addEventListener('pointerleave', cancelLongPress, true);
    root.addEventListener('contextmenu', (e) => {
        const tile = e.target.closest('[data-add]');
        if (tile) { e.preventDefault(); openItemDialog({ productId: tile.dataset.add }); }
    });
}

const region = (name) => root.querySelector(`[data-region="${name}"]`);

/** What to do next when selling isn't possible yet (or practice mode is on). */
function renderBanner() {
    const st = store.settings();
    const ev = store.activeEvent();
    const day = store.openDay();
    let html = '';
    if (st.practice) {
        html = `<div class="banner banner-practice">${icon('alert')}<span><b>Practice mode.</b> Orders aren't counted. Stock changes are put back when you turn it off.</span>
            <button class="btn btn-sm" data-act="practice-off">Turn off</button></div>`;
    } else if (!ev) {
        html = `<div class="banner banner-info">${icon('event')}<span>No event running. Start one to begin selling.</span>
            <button class="btn btn-primary btn-sm" data-act="start-event">Start event</button></div>`;
    } else if (!day && store.eventDaysDone(ev)) {
        const n = store.eventDays(ev.id).length;
        html = `<div class="banner banner-info">${icon('check')}<span><b>${esc(ev.name)}</b> · ${n === 1 ? 'The day is' : `All ${n} days are`} closed.</span>
            <button class="btn btn-sm" data-act="open-day">Add a day</button>
            <button class="btn btn-primary btn-sm" data-act="end-event">End event</button></div>`;
    } else if (!day) {
        const n = store.eventDays(ev.id).length + 1;
        html = `<div class="banner banner-info">${icon('play')}<span><b>${esc(ev.name)}</b> · Day ${n} of ${Math.max(n, ev.plannedDays || 1)} not opened yet.</span>
            <button class="btn btn-primary btn-sm" data-act="open-day">Open day ${n}</button></div>`;
    }
    region('banner').innerHTML = html;
}

/** "Not enough Caramel syrup (0 ml left)": why a product shows Out. */
function outReason(product, reserved = store.cartUsage(cart.lines)) {
    const missing = store.missingIngredients(product, [], reserved);
    if (!missing.length) return 'Out of stock';
    return `Not enough ${missing.map((m) => `${m.name} (${m.left} ${m.unit} left)`).join(', ')}`;
}

/** "2× Iced Americano (Simple syrup)" */
const itemSummary = (i) => {
    const extras = [...(i.options || []), ...(i.modifiers || [])].map((x) => x.name);
    return `${i.qty}× ${i.name}${extras.length ? ` (${extras.join(', ')})` : ''}`;
};

/** Orders sold but not handed over yet. Tap one when it's done. */
function renderQueue() {
    const st = store.settings();
    const day = store.openDay();
    const pending = !st.useQueue ? [] : S.orders
        .filter((o) => o.fulfilment === 'pending' && o.status !== 'void' &&
            (st.practice ? o.practice : !o.practice && day && o.dayId === day.id))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    region('queue').innerHTML = !pending.length ? '' : `<div class="queue" aria-label="Orders to make">
        <span class="queue-label">To make</span>
        ${pending.map((o) => `<button class="queue-chip" data-done="${o.id}" title="Tap when handed over">
            <b>#${o.number}</b>${o.note ? ` ${esc(o.note)}` : ''}
            <small>${esc(o.items.map(itemSummary).join(', '))}</small>
        </button>`).join('')}</div>`;
}

function renderCategories() {
    const cats = store.sortedCategories();
    if (category !== 'all' && !cats.some((c) => c.id === category)) category = 'all';
    region('cats').innerHTML = !cats.length ? '' : [{ id: 'all', name: 'All' }, ...cats].map((c) =>
        `<button class="chip ${category === c.id ? 'on' : ''}" data-cat="${c.id}" ${c.color ? `style="--chip:${c.color}"` : ''}>${esc(c.name)}</button>`).join('');
}

function visibleProducts() {
    return store.sortedProducts().filter((p) => p.active !== false &&
        (category === 'all' || p.categoryId === category) &&
        (!search || p.name.toLowerCase().includes(search)));
}

function renderTiles() {
    if (!onScreen()) return;
    const el = region('tiles');
    const st = store.settings();
    if (!S.products.length) { el.innerHTML = emptyMenuCard(); return; }
    const products = visibleProducts();
    if (!products.length) { el.innerHTML = '<p class="muted pad">No products match.</p>'; return; }

    const reserved = store.cartUsage(cart.lines); // so "N left" accounts for the cart
    const inCart = new Map();
    for (const l of cart.lines) if (l.productId) inCart.set(l.productId, (inCart.get(l.productId) || 0) + l.qty);

    el.className = `tile-grid tiles-${st.tileSize}`;
    el.innerHTML = products.map((p, i) => {
        const left = store.unitsAvailable(p, [], reserved);
        const out = left <= 0;
        const low = !out && left <= st.lowCupsWarn;
        const color = p.color || byId('categories', p.categoryId)?.color || '';
        const hasChoices = p.modifierIds?.length || store.productOptions(p).length;
        return `<button class="tile ${out ? 'out' : ''}" data-add="${p.id}" ${color ? `style="--tile:${color}"` : ''} ${out && st.blockOutOfStock ? 'disabled' : ''}>
            ${i < 9 ? `<kbd class="tile-key">${i + 1}</kbd>` : ''}
            ${inCart.get(p.id) ? `<span class="tile-count">${inCart.get(p.id)}</span>` : ''}
            <span class="tile-name">${esc(p.name)}</span>
            <span class="tile-price">${money(p.price)}</span>
            ${out ? `<span class="tile-badge bad" title="${esc(outReason(p, reserved))}">Out</span>` : low ? `<span class="tile-badge warn">${left} left</span>` : ''}
            ${hasChoices ? '<span class="tile-opts" title="Hold for options">•••</span>' : ''}
        </button>`;
    }).join('');
}

function lineHTML(line) {
    const resolved = store.resolveLine(line);
    const stepper = `<div class="stepper">
        <button class="icon-btn" data-dec="${line.key}" aria-label="One less">${icon('minus')}</button>
        <span>${line.qty}</span>
        <button class="icon-btn" data-inc="${line.key}" aria-label="One more">${icon('plus')}</button></div>`;

    if (line.addonId) {
        return `<li class="line line-addon"><div class="line-body">
            <div class="line-main static"><span class="line-name">+ ${esc(resolved.name)}</span><span class="line-price">${money(resolved.unitPrice * line.qty)}</span></div>
            </div>${stepper}</li>`;
    }

    const options = store.productOptions(byId('products', line.productId));
    const optionChip = (o) => {
        const on = line.optionIds.includes(o.ingredientId);
        return `<button class="mini-chip ${on ? 'on' : ''}" data-opt="${line.key}" data-ing="${o.ingredientId}" aria-pressed="${on}">${icon(on ? 'check' : 'plus')}${esc(o.name)}</button>`;
    };
    const canAddOns = S.modifiers.length > 0;
    return `<li class="line"><div class="line-body">
        <button class="line-main" data-edit="${line.key}">
            <span class="line-name">${esc(resolved.name)}</span>
            ${resolved.modifiers.length ? `<span class="line-mods">${resolved.modifiers.map((m) => esc(m.name)).join(' · ')}</span>` : ''}
            <span class="line-price">${money(resolved.unitPrice * line.qty)}</span>
        </button>
        ${options.length || canAddOns ? `<div class="line-chips">
            ${options.map(optionChip).join('')}
            ${canAddOns ? `<button class="mini-chip ghost" data-edit="${line.key}">${icon('plus')}Add-on</button>` : ''}
        </div>` : ''}
        </div>${stepper}</li>`;
}

/** Label of the main button when you can't sell yet. */
function chargeBlockedLabel() {
    const ev = store.activeEvent();
    if (!ev) return 'Start an event to sell';
    return store.eventDaysDone(ev) ? 'Day closed' : 'Open a day to sell';
}

function lastOrder() {
    const practice = !!store.settings().practice;
    return [...S.orders].filter((o) => !!o.practice === practice && o.status !== 'void')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function renderCart() {
    if (!onScreen()) return;
    const el = region('cart');
    const lines = cart.lines;
    const discount = cart.discount;
    const { subtotal, discountAmt, total } = cart.totals;
    const count = cart.itemCount;
    const canSell = store.settings().practice || (store.activeEvent() && store.openDay());
    const last = lastOrder();
    const expanded = el.classList.contains('expanded');

    const headButtons = [
        S.modifiers.length ? `<button class="btn btn-ghost btn-sm" data-act="addon" title="Sell an add-on on its own, e.g. an extra shot for an order that's already paid">${icon('plus')} Add-on</button>` : '',
        lines.length
            ? `<button class="btn btn-ghost btn-sm" data-act="clear">${icon('trash')} Clear</button>`
            : last ? `<button class="btn btn-ghost btn-sm" data-act="repeat" title="Add the items from order #${last.number} again">${icon('repeat')} #${last.number}</button>` : ''
    ].join('');

    el.innerHTML = `
        <button class="cart-bar" data-act="toggle-cart" aria-expanded="${expanded}">
            <span>${count ? plural(count, 'item') : 'No items'}</span>
            <span class="cart-bar-total">${money(total)}</span>
            ${icon(expanded ? 'down' : 'up')}
        </button>
        <div class="cart-panel">
            <div class="cart-head"><h2>Current order</h2><div class="head-actions">${headButtons}</div></div>
            ${lines.length
                ? `<ul class="lines">${lines.map(lineHTML).join('')}</ul>`
                : '<div class="cart-empty">Tap a product to add it.<br><small>Hold a product (or right-click) for quantity, add-ons and options.</small></div>'}
            <div class="cart-foot">
                ${lines.length ? `<div class="cart-row">
                    <button class="btn btn-ghost btn-sm" data-act="discount">${icon('tag')} ${discount ? esc(discount.name) : 'Discount'}</button>
                    ${discount ? `<span class="neg">−${money(discountAmt)}</span>` : ''}
                </div>` : ''}
                ${discount ? `<div class="cart-row muted"><span>Subtotal</span><span>${money(subtotal)}</span></div>` : ''}
                <div class="cart-total"><span>Total</span><span>${money(total)}</span></div>
                <button class="btn btn-primary btn-xl btn-block" data-act="charge" ${!lines.length || !canSell ? 'disabled' : ''}>
                    ${canSell ? `Charge ${money(total)}` : chargeBlockedLabel()}
                </button>
            </div>
        </div>`;
}

/** Small "pop" on the phone's total bar so you see the tap registered. */
function bumpTotal() {
    const el = root?.querySelector('.cart-bar-total');
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('bump');
}

// ---------- interaction ----------

function onPointerDown(e) {
    const tile = e.target.closest('[data-add]');
    if (!tile || e.button !== 0) return;
    longPressed = false;
    pressTimer = setTimeout(() => {
        longPressed = true;
        navigator.vibrate?.(15);
        openItemDialog({ productId: tile.dataset.add });
    }, LONG_PRESS_MS);
}

function cancelLongPress() { clearTimeout(pressTimer); }

async function onClick(e) {
    const target = e.target.closest('button, [data-add]');
    if (!target) return;
    const d = target.dataset;

    if (d.add) {
        if (longPressed) { longPressed = false; return; }
        const product = byId('products', d.add);
        const reason = store.unitsAvailable(product, [], store.cartUsage(cart.lines)) <= 0 ? outReason(product) : '';
        cart.add({ productId: d.add });
        // Selling past zero is allowed (counts drift), but say why the tile says Out.
        if (reason) toast(`${reason}. Fix it on the Stock tab (Count or Restock) if that's wrong.`, { type: 'warn', duration: 4500 });
        return;
    }
    if (d.cat) { category = d.cat; renderCategories(); renderTiles(); return; }
    if (d.inc) return cart.setQty(d.inc, cart.find(d.inc).qty + 1);
    if (d.dec) return cart.setQty(d.dec, cart.find(d.dec).qty - 1);
    if (d.opt) return cart.toggleOption(d.opt, d.ing);
    if (d.edit) return openItemDialog({ key: d.edit });
    if (d.done) return markHandedOver(d.done);

    switch (d.act) {
        case 'toggle-cart': region('cart').classList.toggle('expanded'); renderCart(); break;
        case 'clear': cart.clear(); break;
        case 'repeat': repeatLastOrder(); break;
        case 'addon': openAddonPicker(); break;
        case 'discount': openDiscountDialog(); break;
        case 'charge': openChargeDialog({ onSold: () => region('cart')?.classList.remove('expanded') }); break;
        case 'start-event': startEventDialog(); break;
        case 'open-day': openDayDialog(); break;
        case 'end-event': endEventFlow(); break;
        case 'practice-off':
            await store.setPractice(false);
            toast('Practice mode off. Stock it used has been put back.', { type: 'success' });
            break;
    }
}

async function markHandedOver(orderId) {
    await store.setFulfilment(orderId, 'done');
    toast(`#${byId('orders', orderId).number} handed over`, { action: { label: 'Undo', fn: () => store.setFulfilment(orderId, 'pending') } });
}

/** Add the previous order's items again (skips deleted products and standalone add-ons). */
function repeatLastOrder() {
    for (const item of lastOrder()?.items || []) {
        if (item.addonId || !byId('products', item.productId)) continue;
        cart.add({
            productId: item.productId,
            modifierIds: item.modifiers.map((m) => m.id).filter((id) => byId('modifiers', id)),
            optionIds: (item.options || []).map((o) => o.ingredientId)
        }, item.qty);
    }
}

// ---------- keyboard (laptop / mini PC) ----------

/** 1–9 add products · Enter charges · Backspace removes one · Esc clears · / searches. */
export function onKey(e) {
    if (modalOpen()) return;
    const typing = e.target.matches('input, textarea, select');
    if (e.key === '/' && !typing) { e.preventDefault(); root.querySelector('[data-search]')?.focus(); return; }
    if (typing) {
        if (e.key === 'Escape') { e.target.value = ''; search = ''; e.target.blur(); renderTiles(); }
        return;
    }
    const lines = cart.lines;
    if (/^[1-9]$/.test(e.key)) {
        const product = visibleProducts()[Number(e.key) - 1];
        if (product) cart.add({ productId: product.id });
    } else if (e.key === 'Enter' && lines.length) {
        e.preventDefault();
        root.querySelector('[data-act="charge"]:not([disabled])')?.click();
    } else if (e.key === 'Backspace' && lines.length) {
        const last = lines[lines.length - 1];
        cart.setQty(last.key, last.qty - 1);
    } else if (e.key === 'Escape' && lines.length) {
        cart.clear();
    }
}
