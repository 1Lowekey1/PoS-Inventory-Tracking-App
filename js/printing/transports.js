// Ways to send bytes to a receipt printer from the browser.
//
// Every transport has the same shape:
//   static isSupported            does this browser have the API?
//   static async request(options) ask the user to pick a device (must run from a click)
//   static async reconnect(options) reuse a device allowed before, or null
//   label, async write(bytes), async close()
//
// To add a new connection type, subclass Transport and register it in TRANSPORTS.
// iPhone/iPad browsers support none of these (the app falls back to the print dialog).

export class Transport {
    static isSupported = false;
    label = 'Printer';
    /** Called if the printer disconnects on its own (e.g. Bluetooth out of range). */
    onDisconnect = () => {};
    async write() { throw new Error('Not implemented'); }
    async close() {}
}

/** Web Serial: USB printers that appear as a COM port. Chrome/Edge on desktop. Try this first. */
export class SerialTransport extends Transport {
    static isSupported = 'serial' in navigator;
    label = 'USB / Serial printer';
    #port;
    #writer;

    static async request({ baud }) { return SerialTransport.#open(await navigator.serial.requestPort(), baud); }

    static async reconnect({ baud }) {
        const [port] = await navigator.serial.getPorts();
        return port ? SerialTransport.#open(port, baud) : null;
    }

    static async #open(port, baud) {
        await port.open({ baudRate: Number(baud) || 9600 });
        const t = new SerialTransport();
        t.#port = port;
        t.#writer = port.writable.getWriter();
        return t;
    }

    write(bytes) { return this.#writer.write(bytes); }

    async close() {
        this.#writer.releaseLock();
        await this.#port.close();
    }
}

/**
 * WebUSB: raw USB printers (Chrome/Edge, Android Chrome). On Windows the
 * printer's own driver may hold the device; use Serial or remove the driver.
 */
export class UsbTransport extends Transport {
    static isSupported = 'usb' in navigator;
    #device;
    #endpoint;

    static async request() { return UsbTransport.#open(await navigator.usb.requestDevice({ filters: [] })); }

    static async reconnect() {
        const [device] = await navigator.usb.getDevices();
        return device ? UsbTransport.#open(device) : null;
    }

    static async #open(device) {
        await device.open();
        if (!device.configuration) await device.selectConfiguration(1);
        // Prefer the USB "printer" interface class (7); otherwise any interface we can write to.
        const interfaces = device.configuration.interfaces;
        const iface = interfaces.find((i) => i.alternates[0].interfaceClass === 7)
            || interfaces.find((i) => i.alternates[0].endpoints.some((e) => e.direction === 'out'));
        if (!iface) throw new Error('No printer interface found on this USB device.');
        await device.claimInterface(iface.interfaceNumber);
        const t = new UsbTransport();
        t.#device = device;
        t.#endpoint = iface.alternates[0].endpoints.find((e) => e.direction === 'out').endpointNumber;
        t.label = device.productName || 'USB printer';
        return t;
    }

    write(bytes) { return this.#device.transferOut(this.#endpoint, bytes); }
    close() { return this.#device.close(); }
}

/** Web Bluetooth: BLE thermal printers (Android Chrome, desktop Chrome). Can't auto-reconnect. */
export class BluetoothTransport extends Transport {
    static isSupported = 'bluetooth' in navigator;
    // GATT services used by common cheap BLE receipt printers.
    static SERVICES = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '0000ffe0-0000-1000-8000-00805f9b34fb'
    ];
    static CHUNK = 180; // BLE writes are small; send long receipts in pieces
    #device;
    #channel;

    static async request() {
        const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BluetoothTransport.SERVICES });
        const server = await device.gatt.connect();
        const channel = await BluetoothTransport.#findWritable(server);
        if (!channel) throw new Error('Could not find a writable printer channel on this Bluetooth device.');
        const t = new BluetoothTransport();
        t.#device = device;
        t.#channel = channel;
        t.label = device.name || 'Bluetooth printer';
        device.addEventListener('gattserverdisconnected', () => t.onDisconnect());
        return t;
    }

    /** Browsers don't let pages silently reconnect Bluetooth devices yet. */
    static async reconnect() { return null; }

    static async #findWritable(server) {
        for (const uuid of BluetoothTransport.SERVICES) {
            try {
                const service = await server.getPrimaryService(uuid);
                const channel = (await service.getCharacteristics()).find((c) => c.properties.writeWithoutResponse || c.properties.write);
                if (channel) return channel;
            } catch { /* this printer doesn't have that service */ }
        }
        return null;
    }

    async write(bytes) {
        for (let i = 0; i < bytes.length; i += BluetoothTransport.CHUNK) {
            const chunk = bytes.slice(i, i + BluetoothTransport.CHUNK);
            if (this.#channel.properties.writeWithoutResponse) await this.#channel.writeValueWithoutResponse(chunk);
            else await this.#channel.writeValue(chunk);
        }
    }

    close() { this.#device.gatt.disconnect(); }
}

/** Connection types by the id stored in settings.printer.type. */
export const TRANSPORTS = { serial: SerialTransport, usb: UsbTransport, bluetooth: BluetoothTransport };
