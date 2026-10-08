// What gets printed: receipts and day/event summaries, in two formats each:
//   ESC/POS bytes for a thermal printer, and HTML for the browser's print dialog.
//
// A summary is: title + sections [{ title, rows: [[label, value]], total?: [label, value], wide? }]
// plus optional headline kpis [[label, value]] for the full-page version.

import { settings, paymentName, byId } from '../store.js';
import { fmtDateTime, esc, money } from '../util.js';
import { EscPos } from './escpos.js';

const amount = (n) => (Number(n) || 0).toFixed(2);
const now = () => fmtDateTime(new Date().toISOString());
const extrasOf = (item) => [...item.modifiers, ...(item.options || [])];

/** Builder sized for the configured paper (58 mm = 32 columns, 80 mm = 48). */
export function newEscPos() {
    const st = settings();
    return new EscPos({ columns: st.printer.paper === 80 ? 48 : 32, currency: st.receiptCurrency || 'P' });
}

// ---------- receipts ----------

/** Receipt as ESC/POS commands for a thermal printer. */
export function receiptEscPos(order) {
    const st = settings();
    const doc = newEscPos();
    const event = order.eventId ? byId('events', order.eventId) : null;

    doc.align('center').bold(true).big(true).line(st.businessName).big(false).bold(false);
    if (st.receiptLine) doc.line(st.receiptLine);
    if (event) doc.line(event.name);
    doc.line(fmtDateTime(order.createdAt));
    doc.bold(true).line(`Order #${order.number}${order.practice ? ' (PRACTICE)' : ''}`).bold(false);
    if (order.note) doc.line(`For: ${order.note}`);

    doc.align('left').rule();
    for (const item of order.items) {
        doc.pair(`${item.qty} x ${item.name}`, amount(item.lineTotal));
        for (const extra of extrasOf(item)) doc.line(`   + ${extra.name}`);
    }
    doc.rule();
    if (order.discount) {
        doc.pair('Subtotal', amount(order.subtotal));
        doc.pair(`Discount (${order.discount.name})`, `-${amount(order.discount.amount)}`);
    }
    doc.bold(true).big(true).pair('TOTAL', amount(order.total)).big(false).bold(false);
    doc.pair(paymentName(order.payment.method), amount(order.payment.tendered));
    if (order.payment.change > 0) doc.pair('Change', amount(order.payment.change));
    if (order.status === 'void') doc.align('center').bold(true).line('*** VOIDED ***').bold(false);

    doc.align('center').line('');
    if (st.receiptFooter) doc.line(st.receiptFooter);
    doc.line('This is not an official receipt.');
    return doc.feed(3).cut();
}

/** Receipt as HTML for the print dialog (no thermal printer). */
export function receiptHTML(order) {
    const st = settings();
    const rows = order.items.map((item) => `
        <tr><td>${item.qty} × ${esc(item.name)}${extrasOf(item).map((x) => `<div class="mod">+ ${esc(x.name)}</div>`).join('')}</td>
        <td class="r">${amount(item.lineTotal)}</td></tr>`).join('');
    return `
        <h1>${esc(st.businessName)}</h1>
        ${st.receiptLine ? `<p>${esc(st.receiptLine)}</p>` : ''}
        <p>${esc(fmtDateTime(order.createdAt))}<br><b>Order #${order.number}</b>${order.note ? `<br>For: ${esc(order.note)}` : ''}</p>
        <table>${rows}
        ${order.discount ? `<tr class="t"><td>Subtotal</td><td class="r">${amount(order.subtotal)}</td></tr>
            <tr><td>Discount (${esc(order.discount.name)})</td><td class="r">-${amount(order.discount.amount)}</td></tr>` : ''}
        <tr class="t big"><td>TOTAL</td><td class="r">${money(order.total)}</td></tr>
        <tr><td>${esc(paymentName(order.payment.method))}</td><td class="r">${amount(order.payment.tendered)}</td></tr>
        ${order.payment.change > 0 ? `<tr><td>Change</td><td class="r">${amount(order.payment.change)}</td></tr>` : ''}
        </table>
        ${order.status === 'void' ? '<p><b>*** VOIDED ***</b></p>' : ''}
        <p>${esc(st.receiptFooter || '')}<br><small>This is not an official receipt.</small></p>`;
}

// ---------- summaries ----------

/** Summary slip for a thermal printer. */
export function summaryEscPos(title, sections) {
    const doc = newEscPos();
    doc.align('center').bold(true).line(settings().businessName).line(title).bold(false).line(now()).align('left');
    for (const s of sections) {
        doc.rule().bold(true).line(s.title).bold(false);
        for (const [label, value] of s.rows) doc.pair(label, value);
        if (s.total) doc.bold(true).pair(...s.total).bold(false);
    }
    return doc.rule().feed(3).cut();
}

/** Receipt-width HTML (print dialog without a thermal printer). */
export function summaryReceiptHTML(title, sections) {
    const table = (s) => `<table>${[...s.rows, ...(s.total ? [s.total] : [])].map(([l, v]) => `<tr><td>${esc(l)}</td><td class="r">${esc(v)}</td></tr>`).join('')}</table>`;
    return `<h1>${esc(settings().businessName)}</h1><p><b>${esc(title)}</b><br>${esc(now())}</p>
        ${sections.map((s) => `<h2>${esc(s.title)}</h2>${table(s)}`).join('')}`;
}

/** Full A4/Letter page for normal printers. */
export function summaryPageHTML(title, sections, kpis = []) {
    const st = settings();
    const section = (s) => `<section class="${s.wide ? 'wide' : ''}"><h2>${esc(s.title)}</h2><table>
        ${s.rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="r">${esc(v)}</td></tr>`).join('')}
        ${s.total ? `<tr class="total"><td>${esc(s.total[0])}</td><td class="r">${esc(s.total[1])}</td></tr>` : ''}
    </table></section>`;
    return `<header><div><h1>${esc(st.businessName)}</h1><div class="sub">${esc(title)}</div></div>
            <div class="sub">Printed ${esc(now())}</div></header>
        ${kpis.length ? `<div class="kpis">${kpis.map(([l, v]) => `<div class="kpi"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
        <div class="grid">${sections.filter((s) => s.rows.length).map(section).join('')}</div>
        <footer>PopPOS · ${esc(st.receiptLine || '')}</footer>`;
}

// ---------- browser print dialog ----------

const RECEIPT_CSS = (width) => `
    @page { margin: 4mm; }
    body { font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; width: ${width}; margin: 0 auto; color: #000; }
    h1 { font-size: 16px; text-align: center; margin: 0 0 4px; } h2 { font-size: 13px; margin: 10px 0 2px; border-top: 1px dashed #000; padding-top: 6px; }
    p { text-align: center; margin: 6px 0; } table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; vertical-align: top; } .r { text-align: right; white-space: nowrap; padding-left: 8px; }
    .mod { padding-left: 12px; font-size: 11px; } .t td { border-top: 1px dashed #000; padding-top: 4px; } .big td { font-size: 15px; font-weight: 700; }`;

const PAGE_CSS = `
    @page { size: auto; margin: 14mm; }
    body { font: 11pt/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
    header h1 { font-size: 20pt; margin: 0; } header .sub { color: #555; font-size: 10pt; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; }
    .kpi span { display: block; font-size: 9pt; color: #555; } .kpi b { font-size: 14pt; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; }
    section { break-inside: avoid; } section.wide { grid-column: 1 / -1; }
    h2 { font-size: 11pt; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .04em; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    td { padding: 3px 0; border-bottom: 1px dotted #ddd; vertical-align: top; } .r { text-align: right; white-space: nowrap; padding-left: 12px; }
    tr.total td { font-weight: 700; border-top: 1px solid #111; border-bottom: 0; }
    footer { margin-top: 18px; color: #777; font-size: 9pt; text-align: center; }`;

/** Print HTML through the system print dialog, using a hidden iframe so the app itself isn't printed. */
function printInFrame(bodyHTML, css) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>PopPOS</title><style>${css}</style></head><body>${bodyHTML}</body></html>`);
    doc.close();
    frame.contentWindow.focus();
    setTimeout(() => {
        frame.contentWindow.print();
        setTimeout(() => frame.remove(), 1500);
    }, 100);
}

/** Receipt-width page (48 or 72 mm). */
export const printReceiptPage = (html) => printInFrame(html, RECEIPT_CSS(settings().printer.paper === 80 ? '72mm' : '48mm'));

/** Full A4/Letter page. */
export const printFullPage = (html) => printInFrame(html, PAGE_CSS);
