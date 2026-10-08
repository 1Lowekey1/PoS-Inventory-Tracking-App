# PopPOS Hardware Guide

PopPOS runs on what you already have. Hardware is only needed if you want printed receipts or a cash drawer.

## Choosing a device

| Setup | Good for | Notes |
|---|---|---|
| **Phone** | Solo pop-ups, small stalls | Portrait layout with a big order bar. Use a stand so both hands are free |
| **Android tablet** | Busy stalls, a counter you share with a helper | Side-by-side products and order panel. Can drive USB and Bluetooth printers |
| **iPad** | Counter without a thermal printer | Works well, but can't connect to USB/Bluetooth printers (print dialog only) |
| **Laptop** | Fairs with a table, keyboard users | Number keys add products; Enter charges |
| **Mini PC + touch screen** | Small cafés, permanent counters | Best with a USB receipt printer and cash drawer |

**Browser:** Chrome or Edge (Windows, Android, ChromeOS, Mac) for printer support; Safari on iPhone/iPad.

**Tips for event days**
- Install the app (Add to Home Screen) and open it once **before** you leave home, so it's ready offline.
- Bring a **power bank** and cable. Settings → *Keep screen on* stops the screen sleeping while a day is open, which uses more battery.
- Turn on **Large tiles** (Settings) if the device is far from you or your hands are busy.

## Receipt printers

PopPOS speaks **ESC/POS**, the command language used by nearly all thermal receipt printers.

| What to look for | Why |
|---|---|
| "ESC/POS compatible" | PopPOS can drive it directly |
| **58 mm** paper | Small, cheap, portable; fine for pop-ups |
| **80 mm** paper | Wider receipts; common in cafés |
| **USB** | Most reliable with laptops and mini PCs |
| **Bluetooth (BLE)** | Wireless with Android tablets/phones |
| A **DK / cash drawer port** (RJ11/RJ12) | Needed if you want a cash drawer |

### Connecting

Settings → **Receipt printer & cash drawer**:

1. **USB (COM / serial)**: try this first for USB printers. Pick the printer in the list.
2. **USB (direct)**: if the printer doesn't appear under COM. On Windows, the printer's own driver may need to be removed first.
3. **Bluetooth**: turn the printer on, tap *Bluetooth*, pick it. It must not be connected to another phone.
4. Tap **Test print**.
5. Choose **58 mm** or **80 mm** paper.
6. Choose when to print receipts: *only when I tap Receipt*, *ask at each sale*, or *always*.

USB printers reconnect automatically each time the app opens. Bluetooth printers need a tap on **Bluetooth** again after the app restarts (a browser rule, not a setting).

**Peso sign:** most thermal printers can't print ₱, so receipts print `P` by default. You can change it in Settings → *Currency on printed receipts*.

## Cash drawer

A standard POS cash drawer plugs into the **printer's** drawer port, not into the device. The printer then opens it on PopPOS's signal.

- Settings → *Open cash drawer on cash sales* opens it automatically after cash sales. GCash/card sales don't open it.
- **Open drawer** in Settings tests it.
- No printer connected means no drawer. Without a printer, use a manual cash box.

## Printing without a receipt printer

Everything still prints through the device's normal print dialog:
- **Receipts** print in a narrow receipt layout.
- **Day summaries** print as a **full A4/Letter page**: headline numbers, sales, payments, cash drawer, expenses, products and event-to-date profit.
- **Reports** print as a clean page with no buttons.

## Troubleshooting

| Problem | Try |
|---|---|
| Printer not in the list | Check it's on and plugged in; try the other USB option; use Chrome or Edge |
| Bluetooth printer not found | Turn it off and on; disconnect it from other phones; stay within a few metres |
| Prints gibberish | Check the baud rate in Settings → Advanced (usually 9600 or 115200; see the printer's self-test page) |
| Text cut off on the right | Set the correct paper width (58 / 80 mm) |
| Drawer doesn't open | The drawer cable must go into the printer's DK port; test with **Open drawer** |
| Printer unplugged mid-sale | The sale still completes; a message says printing failed. Reprint from Orders |
