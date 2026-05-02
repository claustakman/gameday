const BASE = import.meta.env.VITE_API_URL ?? '/api';

function getToken(): string | null {
  return localStorage.getItem('gd_token');
}

// Called on 401 — clears storage and reloads so React re-renders to LoginPage
function handleUnauthorized() {
  localStorage.removeItem('gd_token');
  localStorage.removeItem('gd_user');
  window.location.reload();
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !path.startsWith('/auth/')) {
    handleUnauthorized();
    // Throw so any awaiting code stops — the page will reload anyway
    throw new Error('Session udløbet — log ind igen');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string)                   => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)    => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown)    => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown)    => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                   => request<T>('DELETE', path),
};
