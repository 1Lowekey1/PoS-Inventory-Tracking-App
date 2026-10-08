// The receipt printer and cash drawer, as one object the app talks to.
//
//   printing/escpos.js      ESC/POS command builder
//   printing/transports.js  USB (serial / direct) and Bluetooth connections
//   printing/documents.js   receipts and summaries (ESC/POS + HTML), print dialog
//
// The cash drawer plugs into the printer's RJ11/RJ12 "DK" port, so it only
// works while a printer is connected. Without a printer everything falls back
// to the browser's print dialog. Printing must never block or undo a sale.

import { settings } from './store.js';
import { fmtDateTime, money, qtyFmt } from './util.js';
import { TRANSPORTS } from './printing/transports.js';
import {
    newEscPos, receiptEscPos, receiptHTML, summaryEscPos, summaryReceiptHTML, summaryPageHTML,
    printReceiptPage, printFullPage
} from './printing/documents.js';

export class Printer {
    #transport = null;

    /** Which connection types this browser supports: { serial, usb, bluetooth }. */
    static support = Object.fromEntries(Object.entries(TRANSPORTS).map(([id, T]) => [id, T.isSupported]));

    get isConnected() { return !!this.#transport; }
    get label() { return this.#transport?.label || 'Not connected'; }

    /** Ask the user to pick a printer. type: 'serial' | 'usb' | 'bluetooth'. Must run from a click. */
    async connect(type) {
        await this.disconnect();
        this.#attach(await TRANSPORTS[type].request(settings().printer));
    }

    /** On app start: reconnect to the printer allowed last time, without asking. */
    async autoReconnect() {
        const Type = TRANSPORTS[settings().printer.type];
        if (!Type?.isSupported) return false;
        try {
            this.#attach(await Type.reconnect(settings().printer));
        } catch (e) {
            console.warn('Printer reconnect failed', e);
        }
        return this.isConnected;
    }

    async disconnect() {
        try { await this.#transport?.close(); } catch { /* already gone */ }
        this.#transport = null;
    }

    #attach(transport) {
        this.#transport = transport;
        if (transport) transport.onDisconnect = () => { this.#transport = null; };
    }

    async #send(doc) {
        if (!this.#transport) throw new Error('Printer not connected.');
        await this.#transport.write(doc.build());
    }

    // ---------- printing ----------

    async printReceipt(order) {
        if (this.isConnected) return this.#send(receiptEscPos(order));
        printReceiptPage(receiptHTML(order));
    }

    /**
     * Day / event summary.
     * target 'page': full A4/Letter page on any printer (default).
     * target 'receipt': thermal printer if connected, else a receipt-width page.
     */
    async printSummary(title, sections, { target = 'page', kpis = [] } = {}) {
        if (target === 'page') return printFullPage(summaryPageHTML(title, sections, kpis));
        if (this.isConnected) return this.#send(summaryEscPos(title, sections));
        printReceiptPage(summaryReceiptHTML(title, sections));
    }

    async openDrawer() {
        if (!this.isConnected) throw new Error('Connect the receipt printer first (the drawer is wired through it).');
        await this.#send(newEscPos().openDrawer());
    }

    /** After every sale: open the drawer for cash and print if set to. Returns error messages; never throws. */
    async afterSale(order, { forcePrint = false } = {}) {
        const pr = settings().printer;
        const errors = [];
        if (order.payment.method === 'cash' && pr.drawerOnCash && this.isConnected) {
            try { await this.openDrawer(); } catch (e) { errors.push(e.message); }
        }
        if (forcePrint || pr.autoPrint === 'always') {
            try { await this.printReceipt(order); } catch (e) { errors.push(e.message); }
        }
        return errors;
    }

    async testPrint() {
        if (!this.isConnected) {
            printReceiptPage('<h1>PopPOS test print</h1><p>No printer connected — this is the browser print fallback.</p>');
            return;
        }
        const doc = newEscPos();
        doc.align('center').bold(true).line('PopPOS test print').bold(false).line(fmtDateTime(new Date().toISOString())).align('left').rule();
        doc.pair('Left text', 'Right');
        doc.pair(`Paper ${settings().printer.paper}mm`, `${doc.columns} cols`);
        doc.line(`Money: ${money(1234.5)}`).line(`Qty: ${qtyFmt(12.5)}`);
        await this.#send(doc.feed(3).cut());
    }
}

/** The app's one printer. */
export const printer = new Printer();

// Function-style shortcuts used across the app (import * as printer from './printer.js').
export const support = Printer.support;
export const isConnected = () => printer.isConnected;
export const connectionLabel = () => printer.label;
export const connect = (type) => printer.connect(type);
export const autoReconnect = () => printer.autoReconnect();
export const disconnect = () => printer.disconnect();
export const printReceipt = (order) => printer.printReceipt(order);
export const printSummary = (...args) => printer.printSummary(...args);
export const openDrawer = () => printer.openDrawer();
export const afterSale = (...args) => printer.afterSale(...args);
export const testPrint = () => printer.testPrint();
