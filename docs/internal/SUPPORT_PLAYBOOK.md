# Support Playbook

How to help someone using PopPOS: what to ask, how to diagnose, and how to fix. Users' data lives only on their device, so you can't see it. You need their description, screenshots, or a backup file they choose to send.

## First reply: what to ask

> Thanks for reaching out! To help quickly, could you send:
> 1. Your device and browser (e.g. Samsung A15, Chrome)
> 2. The version at the bottom of **Settings** (e.g. 3.2.0)
> 3. What you did, what you expected, and what happened instead
> 4. A screenshot if you can
>
> Please don't send your backup file unless I ask, because it contains your sales.

## Triage

| Severity | Examples | Response |
|---|---|---|
| **Urgent** | Can't sell during an event; data seems gone | Reply now, give a workaround first, investigate after |
| **High** | Wrong totals or stock maths; printer won't connect before an event | Same day |
| **Normal** | Confusing screen, feature request | Within a few days; log it |

## Common problems

### "I can't sell / the Charge button is greyed out"
- Button says **Open a day to sell** → Event → **Open day N**.
- Button says **Start an event to sell** → Event → **Start event**.
- Button says **Day closed** → the planned days are finished: **End event** or **Add a day**.
- Just trying it out → Settings → **Practice mode**.

### "My data is gone"
Ask: **same device? same browser? same address?** Data is tied to all three.
- Opened a different link, a different browser, or a private window → go back to the original.
- An installed app and the browser tab normally share data on Android/desktop; on iPhone the home-screen app has its own storage.
- Browser data cleared → restore the latest backup (Settings → Restore). Without a backup, it can't be recovered.

**Prevention:** back up after every day; install the app; don't use private windows.

### "It still shows the old version"
- Open the app **while online** and wait a few seconds for **"A new version is ready" → Update**.
- Still old: fully close the app/tab and reopen.
- Still old: check the live site actually has the new `VERSION` in `sw.js` (you may have forgotten to bump it).

### "Stock numbers are wrong"
1. Stock → tap the ingredient name → **history**. Every change is listed with the order number or reason.
2. Usual causes: recipe amount wrong (fix the product); a restock not logged (Event → Restock); waste not logged; counted in a different unit.
3. Fix today's number with **Count**. The Reports → *Adj.* column shows the difference.

### "Cash is short / over"
Expected cash = float + **cash** sales − expenses ticked **paid from drawer**. Check:
- GCash sales put through as cash? (Orders → *Wrong payment method?*)
- Cash expenses not ticked *paid from drawer*?
- Voided sales: the cash given back is already excluded.

### "Profit looks wrong"
- **Cost pending** entries count as ₱0 until filled in (Event tab or the event's report).
- Capital entered twice (once at start, again as an expense)?
- Remember that estimated margins don't affect profit.

### "Unit changed and numbers look strange"
- g↔kg and ml↔L convert automatically, recipes included.
- Other changes (packs → pcs) use the amount typed in the new unit. Recipes for that ingredient must be checked by hand; the app lists them.

### "Printer won't connect"
See the [Hardware Guide](../customer/HARDWARE_GUIDE.md) troubleshooting. Key questions: which browser (Chrome/Edge needed), which connection type, is it ESC/POS, and on Windows is the printer's own driver holding the USB port?

### "The app is blank / Storage unavailable"
- Opened from a file (`file://`) → use the website link.
- Opened inside Facebook/Instagram/Messenger → open in Chrome/Safari.
- Private window → use a normal window.

## Looking at a user's backup (only if they offer)

1. Use a **separate browser profile** or a spare device, never your own live data.
2. Settings → **Restore** their file (this replaces everything in that profile).
3. Reproduce the problem.
4. Erase the profile afterwards and delete the file. Tell the user you've done so.

## Logging a bug

```
Title: <short description>
Version: 3.2.0 · Device/browser: …
Steps:
1. …
2. …
Expected: …
Actual: …
Workaround given: …
```

Every confirmed bug gets a regression test in `tests/edge-cases.js` when it's fixed.

## Reply templates

**Workaround given**
> Here's how to keep going right now: [workaround]. I'll fix the underlying issue in the next update and let you know.

**Fixed**
> This is fixed in version [X.Y.Z]. Open PopPOS while online and tap **Update** when it appears. Thanks for reporting it!

**Feature request**
> Thanks, that's a good idea. I've added it to the list. I can't promise a date, but requests like this shape what gets built next.
