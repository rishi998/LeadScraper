/** Client-facing base (may be `/backend` on Vercel when proxied). */
export function getPublicApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
}

/** Resolve API base for fetch — SSR uses API_URL directly when set. */
function resolveApiBase(): string {
  if (typeof window === 'undefined' && process.env.API_URL) {
    return process.env.API_URL.replace(/\/$/, '');
  }
  return getPublicApiBase();
}

function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${resolveApiBase()}${normalized}`;
}

/** @deprecated Prefer apiUrl() for new code. */
export const API_URL = getPublicApiBase();

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(apiUrl(path), { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
}

export { apiUrl };
