// DOM helpers: icons, modals, confirm, toasts.
import { esc } from './util.js';

const ICONS = {
    sell: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    stock: '<path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
    event: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    menu: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M13 7l4 4"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    drawer: '<rect x="3" y="10" width="18" height="10" rx="2"/><path d="M5 10V5h14v5M10 15h4"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17v.01"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    download: '<path d="M12 4v12M6 11l6 6 6-6M4 20h16"/>',
    upload: '<path d="M12 20V8M6 13l6-6 6 6M4 4h16"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    play: '<path d="M7 4v16l13-8L7 4Z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    note: '<path d="M4 4h16v12l-4 4H4V4Z"/><path d="M16 20v-4h4"/>',
    tag: '<path d="M3 12V3h9l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    wifiOff: '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5"/><circle cx="12" cy="20" r="1"/>'
};

/** Inline SVG icon by name (see ICONS). Inherits the text colour. */
export const icon = (name, cls = '') =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ---------- toasts ----------
export function toast(message, { type = 'info', action = null, duration = 3200 } = {}) {
    const host = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span class="toast-msg">${esc(message)}</span>${action ? `<button class="toast-btn">${esc(action.label)}</button>` : ''}`;
    if (action) el.querySelector('.toast-btn').addEventListener('click', () => { action.fn(); el.remove(); });
    host.appendChild(el);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => el.classList.add('out'), duration);
    setTimeout(() => el.remove(), duration + 300);
}

// ---------- modals ----------

/**
 * A dialog on top of the screen.
 *
 *   const m = new Modal({ title, body, footer });
 *   const answer = await m.result;   // value of the [data-close] button pressed, or null
 *
 * Any element with [data-close="x"] closes it and resolves `result` with "x".
 * Escape and the ✕ close it with null (unless dismissable: false).
 */
export class Modal {
    static #open = []; // stack of open modals, topmost last

    /** True while any modal is open (keyboard shortcuts pause). */
    static get anyOpen() { return Modal.#open.length > 0; }

    static {
        document.addEventListener('keydown', (e) => {
            const top = Modal.#open.at(-1);
            if (e.key === 'Escape' && top?.dismissable) { e.preventDefault(); top.close(null); }
        });
    }

    #wrap;
    #resolve;
    #onClose;

    /**
     * size: 's' | 'm' | 'l'. onMount(el, modal) runs once it's on screen.
     * backdropClose: tapping the dark area closes it (off for forms, so input isn't lost).
     */
    constructor({ title, body, footer = '', size = 'm', onMount, dismissable = true, backdropClose = dismissable, onClose }) {
        this.dismissable = dismissable;
        this.#onClose = onClose;
        this.result = new Promise((resolve) => { this.#resolve = resolve; });

        this.#wrap = document.createElement('div');
        this.#wrap.className = 'modal-wrap';
        this.#wrap.innerHTML = `
            <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
                <header class="modal-head"><h2>${esc(title)}</h2>
                    ${dismissable ? `<button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>` : ''}</header>
                <div class="modal-body">${body}</div>
                ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
            </div>`;
        /** The dialog element (query inside it for its fields). */
        this.el = this.#wrap.querySelector('.modal');

        this.#wrap.addEventListener('click', (e) => {
            const closer = e.target.closest('[data-close]');
            if (closer) { e.preventDefault(); this.close(closer.dataset.close || null); }
            else if (e.target === this.#wrap && backdropClose) this.close(null);
        });

        document.getElementById('modals').appendChild(this.#wrap);
        Modal.#open.push(this);
        onMount?.(this.el, this);
        this.#focusFirstField();
    }

    close(value = null) {
        this.#onClose?.(value);
        Modal.#open = Modal.#open.filter((m) => m !== this);
        this.#wrap.classList.add('out');
        setTimeout(() => this.#wrap.remove(), 160);
        this.#resolve(value);
    }

    /** On devices with a mouse/keyboard, put the cursor in the first field. (On phones it would pop up the keyboard.) */
    #focusFirstField() {
        const first = this.el.querySelector('[autofocus], input:not([type=hidden]):not([type=checkbox]), select, textarea');
        if (first && matchMedia('(pointer: fine)').matches) setTimeout(() => first.focus(), 30);
    }
}

/** Shorthand for new Modal(options). */
export const openModal = (options) => new Modal(options);

export const modalOpen = () => Modal.anyOpen;

/** Resolves true if the user confirms. */
export function confirmDialog(title, message, { okLabel = 'Confirm', danger = false } = {}) {
    return new Modal({
        title, size: 's',
        body: `<p class="pre">${esc(message)}</p>`,
        footer: `<button class="btn" data-close>Cancel</button>
                 <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-close="ok">${esc(okLabel)}</button>`
    }).result.then((v) => v === 'ok');
}

/**
 * A modal containing a <form>. onSubmit(form, modal) saves; throwing shows the
 * error and keeps the form open; returning false keeps it open silently.
 * Tapping outside does NOT close it, so a stray tap can't lose input.
 */
export function formModal({ title, fields, submitLabel = 'Save', size = 'm', onMount, onSubmit, onClose, extraFooter = '' }) {
    const modal = new Modal({
        title, size, backdropClose: false, onClose, onMount,
        body: `<form class="form" novalidate>${fields}<button type="submit" hidden></button></form>`,
        footer: `${extraFooter}<span class="grow"></span><button class="btn" data-close>Cancel</button>
                 <button class="btn btn-primary" data-submit>${esc(submitLabel)}</button>`
    });
    const form = modal.el.querySelector('form');
    const submit = async (e) => {
        e?.preventDefault();
        try {
            const value = await onSubmit(form, modal);
            if (value !== false) modal.close(value ?? true);
        } catch (err) {
            toast(err.message, { type: 'error' });
        }
    };
    form.addEventListener('submit', submit);
    modal.el.querySelector('[data-submit]').addEventListener('click', submit);
    return modal;
}

/** Trimmed value of a form field ('' if missing). */
export const val = (form, name) => form.elements[name]?.value?.trim() ?? '';
export const checked = (form, name) => !!form.elements[name]?.checked;

// ---------- form drafts ----------

/**
 * Remembers what was typed in a form (localStorage), so closing it by accident
 * loses nothing. Used by Start event.
 *
 *   const draft = new FormDraft('poppos.draft.startEvent');
 *   draft.load()  →  saved object or null
 *   draft.save(values) on every input · draft.clear() after a successful submit
 */
export class FormDraft {
    constructor(storageKey) { this.storageKey = storageKey; }

    load() {
        try { return JSON.parse(localStorage.getItem(this.storageKey)) || null; } catch { return null; }
    }

    save(values) {
        try { localStorage.setItem(this.storageKey, JSON.stringify(values)); } catch { /* storage unavailable */ }
    }

    clear() {
        try { localStorage.removeItem(this.storageKey); } catch { /* ignore */ }
    }
}

// ---------- small shared pieces ----------

/** A headline number tile. value is trusted HTML (already formatted); tone: 'pos' | 'neg' | ''. */
export const kpiHTML = (label, value, sub = '', tone = '') =>
    `<div class="kpi"><span class="kpi-label">${esc(label)}</span><span class="kpi-value ${tone}">${value}</span>${sub ? `<span class="kpi-sub">${esc(sub)}</span>` : ''}</div>`;
