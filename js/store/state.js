// In-memory state, persistence and lookups. Every other store module builds on this.
//
// How a change is saved:
//   1. Build a list of ops with put()/del().
//   2. commit(ops) writes them in ONE IndexedDB transaction, updates `S`,
//      then notifies listeners (the UI re-renders).
// So a sale (order + stock movements + ingredient levels) is all-or-nothing.
//
// Every record gets id / createdAt / updatedAt / deviceId (see stamp()), so a
// future sync hub can merge data from several devices.

import * as db from '../db.js';
import { uid, nowISO } from '../util.js';

export const DEFAULT_SETTINGS = {
    id: 'main',
    businessName: 'My Pop-up',
    receiptLine: '',
    receiptFooter: 'Thank you, come again!',
    currency: '₱',
    receiptCurrency: 'P', // most thermal printers can't print ₱
    paymentMethods: [
        { id: 'cash', name: 'Cash', enabled: true },
        { id: 'gcash', name: 'GCash', enabled: true },
        { id: 'maya', name: 'Maya', enabled: false },
        { id: 'card', name: 'Card', enabled: false }
    ],
    quickTender: [100, 200, 500, 1000],
    discounts: [
        { id: 'sc', name: 'Senior / PWD', pct: 20 },
        { id: 'promo', name: 'Promo', pct: 10 }
    ],
    expenseCategories: ['Ingredients', 'Ice', 'Supplies', 'Transport', 'Booth fee', 'Food & staff', 'Other'],
    useQueue: true,
    blockOutOfStock: false, // counts drift; by default never stop a sale
    lowCupsWarn: 10,
    theme: 'auto',
    keepAwake: true,
    practice: false,
    practiceSession: null,
    tileSize: 'm',
    printer: { type: 'none', paper: 58, autoPrint: 'off', drawerOnCash: true, baud: 9600 },
    onboarded: false,
    lastBackupAt: null
};

/** All app data, one array per IndexedDB store (settings is a single object). */
export const S = {
    settings: null,
    ingredients: [], categories: [], products: [], modifiers: [],
    events: [], days: [], orders: [], expenses: [], movements: []
};

// ---------- change notification ----------

const listeners = new Set();

/** Run `fn` after every saved change. */
export const onChange = (fn) => listeners.add(fn);

/** Tell listeners something changed (commit() does this; also used after a restore). */
export const emit = () => listeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error(e); }
});

// ---------- persistence ----------

/** Add id and timestamps (keeps an existing id / createdAt). */
export function stamp(rec) {
    const t = nowISO();
    return { ...rec, id: rec.id || uid(), createdAt: rec.createdAt || t, updatedAt: t, deviceId: S.settings?.deviceId };
}

/** Op: insert or replace a record. */
export const put = (store, rec) => ({ store, put: stamp(rec) });

/** Op: delete a record by id. */
export const del = (store, id) => ({ store, del: id });

/** Save ops atomically, mirror them into `S`, then notify listeners. */
export async function commit(ops) {
    await db.write(ops);
    for (const op of ops) {
        if (op.store === 'settings') { S.settings = op.put; continue; }
        const arr = S[op.store];
        const i = arr.findIndex((x) => x.id === (op.del ?? op.put.id));
        if (op.del !== undefined) { if (i >= 0) arr.splice(i, 1); }
        else if (i >= 0) arr[i] = op.put;
        else arr.push(op.put);
    }
    emit();
    return ops;
}

/** Load everything from IndexedDB. Missing settings fall back to DEFAULT_SETTINGS. */
export async function init() {
    const data = await db.loadAll();
    for (const k of Object.keys(S)) if (k !== 'settings') S[k] = data[k] || [];
    const saved = data.settings?.find((s) => s.id === 'main');
    S.settings = { ...DEFAULT_SETTINGS, ...saved, printer: { ...DEFAULT_SETTINGS.printer, ...saved?.printer } };
    if (!S.settings.deviceId) {
        S.settings.deviceId = uid();
        await db.write([{ store: 'settings', put: S.settings }]);
    }
}

export const settings = () => S.settings;

export async function saveSettings(patch) {
    await commit([{ store: 'settings', put: { ...S.settings, ...patch, id: 'main', updatedAt: nowISO() } }]);
}

// ---------- lookups ----------

export const byId = (store, id) => S[store].find((x) => x.id === id);
export const activeEvent = () => S.events.find((e) => e.status === 'active') || null;
export const openDay = () => S.days.find((d) => d.status === 'open') || null;
export const eventDays = (eventId) => S.days.filter((d) => d.eventId === eventId).sort((a, b) => a.index - b.index);

/** { eventId, dayId } of what's running now; null when nothing is. Stamped on movements/expenses. */
export const currentContext = () => ({ eventId: activeEvent()?.id || null, dayId: openDay()?.id || null });

export const enabledPayments = () => S.settings.paymentMethods.filter((p) => p.enabled);
export const paymentName = (id) => S.settings.paymentMethods.find((p) => p.id === id)?.name || id;

export const sortedProducts = () => [...S.products].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
export const sortedCategories = () => [...S.categories].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

/** Orders that count toward sales: not practice, not voided (unless includeVoid). */
export const realOrders = ({ eventId, dayId, includeVoid = false } = {}) => S.orders.filter((o) =>
    !o.practice && (includeVoid || o.status !== 'void') &&
    (!eventId || o.eventId === eventId) && (!dayId || o.dayId === dayId));
