import { isLocalDevMode, isRealDevMode } from './localDevBackend';

const MODE_KEY = '__tt_dev_origin_mode__';

/**
 * Dev-server safety net. localStorage is shared by everything served from the
 * same origin (host + port), so running the fake-backend dev server and the
 * real-Supabase dev server on one origin would mix test data into real data.
 *
 * Remembers which mode last used this origin and refuses to start the app in
 * the other one. Returns an error message when there is a conflict, else null.
 * Does nothing in production builds.
 */
export function checkDevOriginMode() {
  if (!import.meta.env.DEV) return null;

  // A bare `vite` (mode "development") would talk to the REAL database without
  // anyone choosing that. Only the two named scripts are allowed.
  if (!isLocalDevMode && !isRealDevMode) {
    return (
      'Unknown dev mode "' + import.meta.env.MODE + '". Start the app with ' +
      '"npm run dev" (safe, fake local data) or "npm run dev:real" (REAL database).'
    );
  }

  const mode = isLocalDevMode ? 'localdev' : 'real';
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored && stored !== mode) {
      const wantPort = stored === 'localdev' ? '5199 (npm run dev)' : 'any other port (npm run dev:real)';
      return (
        `This browser address (${location.origin}) was last used in "${stored}" mode, but this server runs in "${mode}" mode. ` +
        `Mixing them could copy test data into your real account. Use ${wantPort} instead, ` +
        `or clear site data for ${location.origin} in your browser if you really want to switch.`
      );
    }
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // storage unavailable: nothing to protect
  }
  return null;
}

/**
 * `npm run dev:real` talks to the live database. Make that impossible to miss:
 * ask for confirmation once per browser tab and pin a warning bar to the page.
 * Returns an error message when the user declines, else null.
 */
export function confirmRealDatabase() {
  if (!import.meta.env.DEV || !isRealDevMode) return null;

  try {
    if (!sessionStorage.getItem('__tt_real_db_ack__')) {
      const ok = window.confirm(
        'REAL DATABASE\n\nThis dev server is connected to your LIVE Supabase data. ' +
        'Anything you save, import or delete here changes real entries.\n\n' +
        'For testing use "npm run dev" instead.\n\nContinue with the real database?'
      );
      if (!ok) return 'You chose not to connect to the real database. Run "npm run dev" for safe local test data.';
      sessionStorage.setItem('__tt_real_db_ack__', '1');
    }
  } catch {
    // sessionStorage unavailable: fall through to the banner only
  }

  const bar = document.createElement('div');
  bar.textContent = 'REAL DATABASE (dev server) - changes affect live data';
  bar.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:2147483647;height:20px;line-height:20px;' +
    'text-align:center;font:700 11px system-ui;color:#fff;background:#c62828;pointer-events:none';
  document.body.appendChild(bar);
  return null;
}
