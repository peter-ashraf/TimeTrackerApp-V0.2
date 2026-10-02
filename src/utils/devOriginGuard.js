import { isLocalDevMode } from './localDevBackend';

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

  const mode = isLocalDevMode ? 'localdev' : 'real';
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored && stored !== mode) {
      const wantPort = stored === 'localdev' ? '5199 (npm run dev:local)' : 'any other port (npm run dev)';
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
