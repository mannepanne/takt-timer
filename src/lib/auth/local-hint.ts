// ABOUT: Persists a lightweight hint to localStorage so PasskeyPrompt can route
// ABOUT: returning users directly to sign-in rather than registration with no network round-trip.

const KEY = 'takt.auth.registered.v1';

export function markRegistered(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // localStorage unavailable — hint degrades gracefully to register-first
  }
}

export function hasRegisteredBefore(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
