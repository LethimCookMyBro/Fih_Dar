import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);

  // `change` is the primary signal, but it is not guaranteed to arrive in every
  // environment (emulated viewport resizes and backgrounded tabs can both skip
  // it). resize/orientationchange/visibilitychange are cheap belt-and-braces:
  // they only ever trigger a re-read, and the read itself is the source of truth.
  mql.addEventListener('change', onChange);
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  document.addEventListener('visibilitychange', onChange);

  return () => {
    mql.removeEventListener('change', onChange);
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

/** Live read — evaluated on every render, so a dropped event self-heals. */
function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/** Desktop-first on the server; the client corrects on hydration. */
function getServerSnapshot() {
  return false;
}

/**
 * Tracks the mobile breakpoint.
 *
 * Uses useSyncExternalStore rather than useState + useEffect deliberately. The
 * previous implementation latched the value in state and only updated it from
 * the mediaQuery `change` callback, so if that event was ever missed the
 * navigation stayed in the wrong branch until a full reload — the desktop
 * sidebar would remain mounted at 390px wide. useSyncExternalStore re-reads
 * `getSnapshot` on every render, so the value cannot go permanently stale.
 *
 * It also fixes a first-render bug: the old hook started at `undefined` and
 * returned `!!undefined` === false, so the very first client render always
 * claimed "desktop" and mobile users got a flash of the desktop layout.
 *
 * Reads `matchMedia(...).matches` rather than comparing `window.innerWidth`,
 * so the JS branch and the Tailwind `md:` utilities resolve the identical
 * breakpoint from the identical measurement.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
