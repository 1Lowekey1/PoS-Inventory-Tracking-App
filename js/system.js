// Device-level concerns: version, theme, screen wake lock.
import * as store from './store.js';

export const APP_VERSION = '3.2.1';

/** Apply Settings → Theme: 'light' / 'dark' force it; 'auto' follows the device. */
export function applyTheme() {
    const t = store.settings().theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1a1512' : '#faf7f2');
}

let wakeLock = null;

/** Keep the screen on while a day is open (if enabled). Safe to call any time. */
export async function setWakeLock() {
    const want = store.settings().keepAwake && !!store.openDay() && document.visibilityState === 'visible';
    try {
        if (want && !wakeLock && 'wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } else if (!want && wakeLock) {
            await wakeLock.release();
            wakeLock = null;
        }
    } catch { wakeLock = null; /* denied, e.g. battery saver */ }
}
