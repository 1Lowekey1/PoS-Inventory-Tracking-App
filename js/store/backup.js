// Backup, restore, erase and bulk insert (sample menu, v2 import).

import * as db from '../db.js';
import { S, DEFAULT_SETTINGS, put, commit, init, emit } from './state.js';
import { nowISO } from '../util.js';

/** Everything on this device as one JSON-ready object. */
export function exportAll() {
    const data = {};
    for (const k of Object.keys(S)) data[k] = k === 'settings' ? [S.settings] : S[k];
    return { app: 'PopPOS', schema: 1, exportedAt: nowISO(), data };
}

/** REPLACES all data with a PopPOS backup. Keeps this device's id. */
export async function importAll(json) {
    if (json?.app !== 'PopPOS' || !json.data) throw new Error('Not a PopPOS backup file.');
    const deviceId = S.settings.deviceId;
    const data = { ...json.data, settings: (json.data.settings || []).map((s) => ({ ...s, deviceId })) };
    await db.replaceAll(data);
    await init();
    emit();
}

/** Delete everything on this device (keeps its device id). */
export async function eraseEverything() {
    await db.replaceAll({ settings: [{ ...DEFAULT_SETTINGS, deviceId: S.settings.deviceId, onboarded: true }] });
    await init();
    emit();
}

/** Add records to several stores at once. data: { storeName: [records] }. */
export async function bulkInsert(data) {
    const ops = [];
    for (const [store, records] of Object.entries(data)) for (const r of records) ops.push(put(store, r));
    await commit(ops);
}
