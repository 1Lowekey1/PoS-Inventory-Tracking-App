// App shell: boot, hash router, navigation, status bar, global keys,
// chart tooltip, offline/service-worker handling.

import * as store from './store.js';
import { S } from './store.js';
import * as db from './db.js';
import * as printer from './printer.js';
import { esc, money, sum, setCurrency } from './util.js';
import { icon, toast, modalOpen } from './ui.js';
import { applyTheme, setWakeLock } from './system.js';
import * as sell from './views/sell.js';
import * as orders from './views/orders.js';
import * as stock from './views/stock.js';
import * as event from './views/event.js';
import * as reports from './views/reports.js';
import * as menu from './views/menu.js';
import * as settings from './views/settings.js';
import { handleOnboardingClick } from './views/onboarding.js';

const ROUTES = {
    sell: { view: sell, label: 'Sell', icon: 'sell' },
    orders: { view: orders, label: 'Orders', icon: 'orders' },
    stock: { view: stock, label: 'Stock', icon: 'stock' },
    event: { view: event, label: 'Event', icon: 'event' },
    reports: { view: reports, label: 'Reports', icon: 'reports' },
    menu: { view: menu, label: 'Menu', icon: 'menu', secondary: true },
    settings: { view: settings, label: 'Settings', icon: 'settings', secondary: true },
    more: { view: { render: settings.renderMore }, label: 'More', icon: 'more', phoneOnly: true }
};

let route = 'sell';
let params = [];
const viewEl = () => document.getElementById('view');

function parseHash() {
    const [r, ...p] = location.hash.replace(/^#/, '').split('/');
    return { r: ROUTES[r] ? r : 'sell', p };
}

function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = Object.entries(ROUTES).map(([k, v]) => `
        <a href="#${k}" class="nav-item ${v.secondary ? 'nav-secondary' : ''} ${v.phoneOnly ? 'nav-phone' : ''}
            ${route === k || (k === 'more' && ROUTES[route].secondary) ? 'on' : ''}" ${route === k ? 'aria-current="page"' : ''}>
            ${icon(v.icon)}<span>${v.label}</span>${k === 'stock' ? lowBadge() : ''}</a>`).join('');
}

function lowBadge() {
    const n = S.ingredients.filter((i) => i.tracked && (i.stock <= 0 || (i.lowAt && i.stock <= i.lowAt))).length;
    return n ? `<span class="nav-badge" aria-label="${n} low">${n}</span>` : '';
}

function renderStatus() {
    const el = document.getElementById('status');
    const st = store.settings();
    const ev = store.activeEvent();
    const day = store.openDay();
    let pill;
    if (st.practice) pill = `<span class="pill pill-practice">Practice mode</span>`;
    else if (day) {
        const today = store.realOrders({ dayId: day.id });
        pill = `<a href="#event" class="pill pill-live"><span class="dot-live"></span>${esc(ev.name)} · Day ${day.index} · <b>${money(sum(today, (o) => o.total))}</b></a>`;
    } else if (ev) pill = `<a href="#event" class="pill">${esc(ev.name)} · day closed</a>`;
    else pill = `<a href="#event" class="pill">No event</a>`;
    el.innerHTML = `<span class="brand">${esc(st.businessName)}</span>${pill}
        <span class="grow"></span>
        ${navigator.onLine ? '' : `<span class="pill pill-offline" title="Everything still works offline">${icon('wifiOff')} Offline</span>`}
        ${printer.isConnected() ? `<span class="pill" title="${esc(printer.connectionLabel())}">${icon('print')}</span>` : ''}`;
}

function renderView() {
    const el = viewEl();
    el.dataset.route = route;
    ROUTES[route].view.render(el, params);
}

function go() {
    const { r, p } = parseHash();
    const changed = r !== route;
    route = r;
    params = p;
    if (changed) {
        // Fresh container per screen so per-view listeners don't stack up.
        // (Built from scratch: cloneNode would copy the data-wired flag.)
        const fresh = document.createElement('main');
        fresh.id = 'view';
        fresh.className = 'view';
        viewEl().replaceWith(fresh);
        window.scrollTo(0, 0);
    }
    renderNav();
    renderStatus();
    renderView();
}

function onStoreChange() {
    setCurrency(store.settings().currency);
    renderNav();
    renderStatus();
    // Don't yank focus out of a field the user is typing in on the page.
    const a = document.activeElement;
    const typing = a && viewEl().contains(a) && a.matches('input:not([type=checkbox]):not([type=file]), textarea, select');
    if (!typing || route === 'sell') renderView();
    setWakeLock();
}

// ---------- chart / bar tooltip ----------
function wireTooltip() {
    const tip = document.getElementById('tip');
    const show = (target, x, y) => {
        tip.textContent = target.dataset.tip;
        tip.hidden = false;
        const r = tip.getBoundingClientRect();
        tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
        tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
    };
    document.addEventListener('pointermove', (e) => {
        const t = e.target.closest?.('[data-tip]');
        if (t) show(t, e.clientX, e.clientY); else tip.hidden = true;
    });
    document.addEventListener('scroll', () => { tip.hidden = true; }, true);
}

// ---------- boot ----------
async function boot() {
    try {
        await store.init();
    } catch (err) {
        document.getElementById('view').innerHTML = `<div class="page"><div class="card"><h2>Storage unavailable</h2>
            <p>PopPOS couldn't open its database. Private/incognito windows and some in-app browsers block storage. Open it in Chrome, Edge or Safari normally.</p>
            <pre class="small">${esc(err?.message || err)}</pre></div></div>`;
        return;
    }
    setCurrency(store.settings().currency);
    applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    store.onChange(onStoreChange);

    window.addEventListener('hashchange', go);
    window.addEventListener('online', renderStatus);
    window.addEventListener('offline', renderStatus);
    document.addEventListener('visibilitychange', setWakeLock);
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (route === 'sell') sell.onKey(e);
        else if (!modalOpen() && e.key === 'F2') location.hash = '#sell';
    });
    document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-onb]');
        if (b) handleOnboardingClick(b.dataset.onb);
    });
    wireTooltip();
    go();
    setWakeLock();

    db.requestPersistence();
    if (await printer.autoReconnect()) { renderStatus(); toast(`Printer reconnected: ${printer.connectionLabel()}`); }
    registerSW();
    // Refresh live numbers (durations, run-out estimates) every minute.
    setInterval(() => { if (!modalOpen() && route !== 'sell' && route !== 'settings') renderView(); renderStatus(); }, 60000);
}

function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    // Skip on a local dev server so edits show up on reload (add ?sw to test offline locally).
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !location.search.includes('sw')) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            sw?.addEventListener('statechange', () => {
                if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                    toast('A new version is ready.', {
                        duration: 15000,
                        action: { label: 'Update', fn: () => sw.postMessage('SKIP_WAITING') }
                    });
                }
            });
        });
    }).catch((err) => console.warn('Service worker failed', err));
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
    });
}

boot();
