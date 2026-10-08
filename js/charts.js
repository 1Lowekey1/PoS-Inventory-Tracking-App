// Minimal chart helpers. Single-series only, so one accent colour and no legend:
// the section title names what is plotted. Every mark carries data-tip for the
// shared hover tooltip (wired in app.js).
import { esc } from './util.js';

const niceMax = (v) => {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/**
 * Vertical columns. data: [{ label, value, tip }]
 */
export function columnChart(data, { format = String, height = 190 } = {}) {
    if (!data.length) return '<p class="muted">No data yet.</p>';
    const W = 440, H = height, padL = 50, padB = 24, padT = 10, padR = 6;
    const max = niceMax(Math.max(...data.map((d) => d.value)));
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const slot = plotW / data.length;
    const bw = Math.min(24, slot * 0.62);
    const y = (v) => padT + plotH - (v / max) * plotH;
    const ticks = [0, max / 2, max];
    const every = Math.ceil(data.length / 12);

    const grid = ticks.map((t) => `
        <line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="ch-grid"/>
        <text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end" class="ch-axis">${esc(format(t))}</text>`).join('');

    const bars = data.map((d, i) => {
        const x = padL + slot * i + (slot - bw) / 2;
        const top = y(d.value);
        const h = Math.max(0, padT + plotH - top);
        const r = Math.min(4, h, bw / 2);
        const path = h > 0
            ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${top + h} Z`
            : '';
        const label = i % every === 0 ? `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="ch-axis">${esc(d.label)}</text>` : '';
        // Hit target is the whole slot, taller than the mark.
        return `<g data-tip="${esc(d.tip || `${d.label}: ${format(d.value)}`)}">
            <rect x="${padL + slot * i}" y="${padT}" width="${slot}" height="${plotH}" class="ch-hit"/>
            ${path ? `<path d="${path}" class="ch-bar"/>` : ''}${label}</g>`;
    }).join('');

    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${bars}
        <line x1="${padL}" x2="${W - padR}" y1="${padT + plotH}" y2="${padT + plotH}" class="ch-base"/></svg>`;
}

/**
 * Horizontal bar list (HTML, wraps nicely on phones).
 * rows: [{ label, value, display, sub, tip }]
 */
export function barList(rows, { format = String } = {}) {
    if (!rows.length) return '<p class="muted">No data yet.</p>';
    const max = Math.max(...rows.map((r) => r.value), 0) || 1;
    return `<div class="barlist">${rows.map((r) => `
        <div class="barlist-row" data-tip="${esc(r.tip || `${r.label}: ${format(r.value)}`)}">
            <div class="barlist-label"><span>${esc(r.label)}</span>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</div>
            <div class="barlist-track"><div class="barlist-fill" style="width:${Math.max(1, (r.value / max) * 100)}%"></div></div>
            <div class="barlist-value">${esc(r.display ?? format(r.value))}</div>
        </div>`).join('')}</div>`;
}

/** Progress meter with label. */
export function meter(value, max, { tone = 'accent' } = {}) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return `<div class="meter meter-${tone}"><div class="meter-fill" style="width:${pct}%"></div></div>`;
}
