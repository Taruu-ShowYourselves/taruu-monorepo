/**
 * Device-local municipality preference - geo-first entry without an account.
 * Stored in localStorage (+ mirror cookie for future SSR use); never sent
 * anywhere by itself. Components listen for LOCALITY_EVENT to react live.
 */

const STORAGE_KEY = 'taruu.municipality';
const COOKIE_KEY = 'taruu_muni';
const DISMISS_KEY = 'taruu.muni.dismissed';

export const LOCALITY_EVENT = 'taruu:municipality';

export function getStoredMunicipality(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredMunicipality(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* storage unavailable - cookie still set below */
  }
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(name)};path=/;max-age=31536000;samesite=lax`;
  window.dispatchEvent(new CustomEvent(LOCALITY_EVENT, { detail: name }));
}

/**
 * Read every authority instead of one.
 *
 * Not the same as never having chosen: the desks fall back to national heat
 * either way, but this is a decision the reader made and can undo, so it is
 * broadcast like any other change of locality.
 */
export function clearStoredMunicipality(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable - cookie still cleared below */
  }
  document.cookie = `${COOKIE_KEY}=;path=/;max-age=0;samesite=lax`;
  window.dispatchEvent(new CustomEvent(LOCALITY_EVENT, { detail: null }));
}

/** "Not now" - stay quiet for this browser session. */
export function dismissLocalityPrompt(): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function isLocalityPromptDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}
