# Known Limitations & Roadmap

Be upfront about these with users. Nothing on the roadmap is a promise or has a date.

## Known limitations (3.2)

| Limitation | Impact | Workaround |
|---|---|---|
| **One device per event**, no live sync between devices | Two cashiers can't share one event | One device sells; move data between devices with backup/restore |
| **No cloud backup** | Data loss if the device is lost or browser data cleared | Back up after every day; keep the file off the device |
| **Not BIR-accredited** | Receipts are not official receipts | Use registered receipts/POS where required |
| **iPhone/iPad can't drive thermal printers** | No direct USB/Bluetooth printing on iOS | Print dialog, or use an Android tablet/laptop at the counter |
| **Bluetooth printers need reconnecting** after an app restart | One extra tap | Settings → Bluetooth |
| **Non-convertible unit changes** (packs → pcs) don't rescale recipes | Recipes using that ingredient must be checked by hand | The app lists them when you change the unit |
| **Add-ons sold after payment** only add ingredients | A swap (oat milk) can't put fresh milk back once a drink is made | Log real waste with Stock → Waste if needed |
| **No product variants** (sizes) as one product | Each size is its own product | Use **Duplicate** |
| **No customer accounts / loyalty** | — | Use the order name/note |
| **Reports are per device** | Events on different devices aren't combined | Export CSVs and combine in a spreadsheet |
| **Single currency** per device | — | Currency symbol is configurable |

## Roadmap ideas

Grouped by how often the need comes up. Revisit after each round of user feedback.

### Next
- **Low-stock shopping list:** one screen listing what's low, with amounts to buy for the next event
- **Event templates:** reuse last event's capital lines and settings
- **Better CSV:** one combined workbook-style export per event

### Later
- **Local-network sync hub** for cafés: a small helper on the counter mini PC that merges data from several devices on the same Wi-Fi (records are already sync-ready: `id`, `updatedAt`, `deviceId`)
- **Optional cloud backup** (user-chosen provider, off by default)
- **Product sizes** as variants of one product
- **Bluetooth printer auto-reconnect** where browsers allow it
- **Shift handover** (cash count between two people in one day)

### Not planned
- Online ordering or delivery integration
- Card terminal integration
- BIR accreditation (requires registration processes outside the app)

## How to propose something

Log it with: who needs it, how often, what they do today instead, and what would change for them. Requests that save time at the counter during a rush come first.
