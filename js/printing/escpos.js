// ESC/POS command builder: the language nearly every thermal receipt printer speaks.
//
//   const doc = new EscPos({ columns: 32, currency: 'P' });
//   doc.align('center').bold(true).line('My Pop-up').bold(false).pair('TOTAL', '120.00').cut();
//   transport.write(doc.build());
//
// Text is reduced to plain ASCII because most printers lack accents and the ₱ sign.

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export class EscPos {
    #bytes = [ESC, 0x40]; // ESC @ = reset the printer

    /** columns: characters per line (32 for 58 mm paper, 48 for 80 mm). currency: replaces ₱. */
    constructor({ columns = 32, currency = 'P' } = {}) {
        this.columns = columns;
        this.currency = currency;
    }

    /** Append raw command bytes. */
    raw(...bytes) { this.#bytes.push(...bytes); return this; }

    text(value) {
        const ascii = String(value)
            .normalize('NFD').replace(/[̀-ͯ]/g, '') // é → e
            .replace(/₱/g, this.currency)
            .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[−–—]/g, '-');
        for (const ch of ascii) {
            const code = ch.charCodeAt(0);
            this.#bytes.push(code < 128 ? code : 63); // anything else prints as "?"
        }
        return this;
    }

    line(value = '') { return this.text(value).raw(LF); }
    align(where) { return this.raw(ESC, 0x61, { left: 0, center: 1, right: 2 }[where]); }
    bold(on) { return this.raw(ESC, 0x45, on ? 1 : 0); }
    big(on) { return this.raw(GS, 0x21, on ? 0x11 : 0); } // double width + height
    rule(ch = '-') { return this.line(ch.repeat(this.columns)); }

    /** Label on the left, value on the right; wraps the value to its own line if both don't fit. */
    pair(label, value) {
        label = String(label);
        value = String(value);
        const room = this.columns - value.length;
        if (label.length > room - 1) return this.line(label).line(value.padStart(this.columns));
        return this.line(label.padEnd(room) + value);
    }

    feed(lines = 3) { return this.raw(ESC, 0x64, lines); }
    cut() { return this.raw(GS, 0x56, 0x42, 0x00); }           // partial cut after feeding
    openDrawer() { return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa); } // pulse the drawer pin

    build() { return new Uint8Array(this.#bytes); }
}
