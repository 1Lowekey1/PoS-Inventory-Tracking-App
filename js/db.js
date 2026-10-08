// Thin IndexedDB wrapper. Every collection is an object store keyed by `id`.
// All writes for one action go through a single transaction so a sale
// (order + stock movements + ingredient levels) is saved all-or-nothing.

let DB_NAME = 'poppos';
const DB_VERSION = 1;

export const STORES = [
    'settings', 'ingredients', 'categories', 'products', 'modifiers',
    'events', 'days', 'orders', 'expenses', 'movements'
];

let dbPromise = null;

/** Point at a different database (the test page uses a throwaway one). */
export function useDatabase(name) {
    DB_NAME = name;
    dbPromise = null;
}

/** Delete the current database entirely (tests only). */
export async function deleteDatabase() {
    const db = await dbPromise;
    db?.close();
    dbPromise = null;
    await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
}

function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            for (const name of STORES) {
                if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

const done = (tx) => new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
});

/** Every store's records: { storeName: [records] }. */
export async function loadAll() {
    const db = await open();
    const tx = db.transaction(STORES, 'readonly');
    const out = {};
    await Promise.all(STORES.map((name) => new Promise((resolve, reject) => {
        const req = tx.objectStore(name).getAll();
        req.onsuccess = () => { out[name] = req.result; resolve(); };
        req.onerror = () => reject(req.error);
    })));
    return out;
}

/**
 * Apply a batch of writes atomically.
 * ops: [{ store, put: record } | { store, del: id }]
 */
export async function write(ops) {
    if (!ops.length) return;
    const db = await open();
    const names = [...new Set(ops.map((o) => o.store))];
    const tx = db.transaction(names, 'readwrite');
    for (const op of ops) {
        const s = tx.objectStore(op.store);
        if (op.del !== undefined) s.delete(op.del);
        else s.put(op.put);
    }
    return done(tx);
}

/** Replace every store's contents (used by restore). */
export async function replaceAll(data) {
    const db = await open();
    const tx = db.transaction(STORES, 'readwrite');
    for (const name of STORES) {
        const s = tx.objectStore(name);
        s.clear();
        for (const rec of data[name] || []) s.put(rec);
    }
    return done(tx);
}

/** Ask the browser not to clear our data when space runs low. True if granted. */
export async function requestPersistence() {
    try {
        if (navigator.storage?.persisted && await navigator.storage.persisted()) return true;
        if (navigator.storage?.persist) return await navigator.storage.persist();
    } catch { /* not supported */ }
    return false;
}

/** { usage, quota, persisted } for the Settings screen; zeros if unsupported. */
export async function storageInfo() {
    try {
        const [est, persisted] = await Promise.all([
            navigator.storage?.estimate?.(),
            navigator.storage?.persisted?.()
        ]);
        return { usage: est?.usage || 0, quota: est?.quota || 0, persisted: !!persisted };
    } catch {
        return { usage: 0, quota: 0, persisted: false };
    }
}
