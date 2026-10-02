/**
 * Auth lock that only serialises work inside this tab.
 *
 * supabase-js falls back to the browser-wide Web Locks API when no lock
 * function is given (passing `lock: null` does NOT disable it). A hung or
 * crashed tab can then hold that lock indefinitely, and every auth call
 * (getSession, and therefore every query) in other tabs waits forever.
 *
 * Operations run one after another in call order; a failed operation never
 * blocks the ones queued behind it. supabase-js already handles re-entrant
 * calls itself, so this is only used for top-level acquisitions.
 */
export const createInTabLock = () => {
  let tail = Promise.resolve();

  return (_name, _acquireTimeout, fn) => {
    const run = tail.then(() => fn());
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
};
