// Small shared helpers: ids, numbers, formatting, files. No dependencies, no app state
// (except the currency symbol, which Settings can change).

// ---------- ids & time ----------

/** Short unique id, sortable by creation time: "muyqvbog43l0gq". */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const nowISO = () => new Date().toISOString();

/** Local date as YYYY-MM-DD (for date inputs and file names). */
export const todayISODate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- numbers ----------

/** Round MONEY to 2 decimals (keeps float noise like 0.1 + 0.2 out of totals). */
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Round a stock QUANTITY to 4 decimals (keeps 0.018 kg exact). */
export const rq = (n) => Math.round((Number(n) || 0) * 1e4) / 1e4;

/** Parse a number from user input; `fallback` for blanks and junk. */
export const num = (value, fallback = 0) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
};

/** Sum of fn(item) over a list (non-numbers count as 0). */
export const sum = (list, fn = (x) => x) => list.reduce((total, x) => total + (Number(fn(x)) || 0), 0);

/** Map of key → items with that key. */
export const groupBy = (list, keyOf) => {
    const groups = new Map();
    for (const x of list) {
        const key = keyOf(x);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(x);
    }
    return groups;
};

// ---------- formatting ----------

/** Escape text for HTML templates. Use for EVERY user-provided string. */
export const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let currencySymbol = '₱';
export const setCurrency = (symbol) => { currencySymbol = symbol || '₱'; };

/** ₱1,234.50 · −₱20.00 · with sign: +₱5.00 */
export const money = (n, { sign = false } = {}) => {
    const v = Number(n) || 0;
    const digits = Math.abs(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const prefix = v < 0 ? '−' : (sign && v > 0 ? '+' : '');
    return `${prefix}${currencySymbol}${digits}`;
};

/** Compact money for chart axes: ₱950 · ₱12.9K · ₱1.2M */
export const moneyShort = (n) => {
    const v = Number(n) || 0;
    const a = Math.abs(v);
    const prefix = v < 0 ? '−' : '';
    if (a >= 1e6) return `${prefix}${currencySymbol}${(a / 1e6).toFixed(1)}M`;
    if (a >= 1e4) return `${prefix}${currencySymbol}${(a / 1e3).toFixed(1)}K`;
    return `${prefix}${currencySymbol}${Math.round(a).toLocaleString('en-PH')}`;
};

/** Stock amounts: 1,000 · 0.928 (up to 3 decimals, no trailing zeros). */
export const qtyFmt = (n) => {
    const v = Math.round((Number(n) || 0) * 1000) / 1000;
    return Number.isInteger(v) ? v.toLocaleString('en-PH') : v.toLocaleString('en-PH', { maximumFractionDigits: 3 });
};

/** "1 order", "3 orders"; pass `many` for irregular words: plural(n, 'entry', 'entries'). */
export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '');
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
export const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : '');

/** 95 min → "1h 35m" · 20 min → "20m" */
export const fmtDuration = (ms) => {
    const minutes = Math.max(0, Math.round(ms / 60000));
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

/** "Weekend Market!" → "weekend-market" (for file names). */
export const slug = (s) => String(s || 'export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- files ----------

/** Save text or a Blob as a file download. */
export const download = (filename, content, type = 'application/json') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Rows of objects → CSV text (columns from the first row; quotes cells with commas, quotes or newlines). */
export const toCSV = (rows) => {
    if (!rows.length) return '';
    const columns = Object.keys(rows[0]);
    const cell = (v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n');
};
