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
