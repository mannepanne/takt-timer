// ABOUT: Thin fetch wrapper that always sends cookies for authenticated requests.

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, credentials: 'include' });
}
