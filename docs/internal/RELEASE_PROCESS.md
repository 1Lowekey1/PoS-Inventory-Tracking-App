# Release Process

Follow this for every change that goes live, however small. Skipping the version bump is the most common cause of "my phone still shows the old version".

## Version numbers

`MAJOR.MINOR.PATCH`, e.g. 3.2.0
- **PATCH** (3.2.1): fixes, wording, styling
- **MINOR** (3.3.0): new features, data stays compatible
- **MAJOR** (4.0.0): big changes that need a migration note

## Steps

### 1. Make and check the change
- [ ] Logic changes are in `js/store/*` / `reports.js` (exported from `store.js`), with tests added to `tests/edge-cases.js`
- [ ] Run locally: `python devserver.py` in the PopPOS folder
- [ ] `/tests/` shows **All N edge cases passed**
- [ ] Browser console has no errors on each screen (Sell, Orders, Stock, Event, Reports, Menu, Settings)
- [ ] Checked at phone width (≈375 px) and desktop width
- [ ] Hands-on checks in [TESTING.md](../../TESTING.md) for the areas you touched

### 2. Bump the version (two places)
- [ ] `sw.js` → `const VERSION = 'poppos-vX.Y.Z';`
- [ ] `js/system.js` → `export const APP_VERSION = 'X.Y.Z';`
- [ ] Any new file added to `FILES` in `sw.js` (a missing file breaks the offline install)

### 3. Update the docs
- [ ] README changelog
- [ ] [Release Notes](../customer/RELEASE_NOTES.md) in plain language
- [ ] README / Quick Start / User Guide if screens or the routine changed
- [ ] TESTING.md: new hands-on checks and the test count
- [ ] Migration Guide → "Updating PopPOS later" if users must do anything

### 4. Copy into the repo

From the project folder (where `PopPOS/` lives), in PowerShell:

```powershell
Copy-Item -Path "PopPOS\*" -Destination "Basis App\PoS-Inventory-Tracking-App\" -Recurse -Force
```

### 5. Commit and publish

```bash
cd "Basis App/PoS-Inventory-Tracking-App"
git checkout -b release/X.Y.Z
git add -A
git commit -m "PopPOS X.Y.Z: <summary>"
git push -u origin release/X.Y.Z
```

Open a pull request into `main` and merge it. GitHub Pages redeploys `main` in about a minute.

### 6. Verify the live site
- [ ] Open the site; Settings shows the new version at the bottom
- [ ] On an installed device: open online → **"A new version is ready"** → **Update** → data intact
- [ ] Visit `https://<you>.github.io/<repo>/tests/`; all pass
- [ ] Airplane mode → app still opens

### 7. Announce (if users will notice)
- Short post with the Release Notes highlights, and a reminder to tap **Update**.

## Rolling back

```bash
git revert <bad commit>
git push
```

Bump `VERSION` again in the revert, so devices that already updated pick up the rollback. User data isn't affected by code rollbacks, but data written by a newer version may carry fields the older code ignores. That's harmless.

## Hotfix during an event

If something breaks mid-event, **don't update the live site in a hurry.** Users can keep selling on the version they have. Workarounds:
- Wrong stock → Stock → Count
- Wrong sale → Orders → Void
- Stuck screen → reload the page (data is saved after every action)

Fix it properly afterwards, with a test.
