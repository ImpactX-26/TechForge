import type { AuthUser } from './types';

export const BASE: string = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const KEY = 'educaro_session';

export interface Session {
  token: string;
  user: AuthUser;
}

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
export function saveSession(s: Session) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}
export function clearSession() {
  sessionStorage.removeItem(KEY);
}

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : 'Something went wrong';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function authHeader(): Record<string, string> {
  const s = getSession();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const m = data?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  } catch {
    // ignore body parse errors
  }
  return `Request failed (${res.status})`;
}

function handleUnauthorized() {
  const s = getSession();
  if (!s) return;
  const owner = s.user.role === 'OWNER';
  clearSession();
  window.location.href = owner ? '/owner/login' : '/login';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...authHeader() };
  if (typeof init.body === 'string') headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw new ApiError(await readError(res), res.status);
  }
  return (await res.json()) as T;
}

const json = (body?: unknown) => (body === undefined ? undefined : JSON.stringify(body));

async function fetchBlob(path: string): Promise<Blob> {
  const res = await fetch(BASE + path, { headers: authHeader() });
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    throw new ApiError(await readError(res), res.status);
  }
  return res.blob();
}

export const api = {
  get: <T,>(p: string) => request<T>(p),
  post: <T,>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: json(body) }),
  put: <T,>(p: string, body?: unknown) => request<T>(p, { method: 'PUT', body: json(body) }),
  patch: <T,>(p: string, body?: unknown) => request<T>(p, { method: 'PATCH', body: json(body) }),
  del: <T,>(p: string) => request<T>(p, { method: 'DELETE' }),
  upload: <T,>(p: string, form: FormData) => request<T>(p, { method: 'POST', body: form }),

  /** Authenticated file download (the Bearer token cannot be sent via a plain link). */
  async download(path: string, filename: string) {
    const blob = await fetchBlob(path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },

  /** Returns an object URL (caller must revoke it). Used to play the owner-only video. */
  async blobUrl(path: string): Promise<string> {
    return URL.createObjectURL(await fetchBlob(path));
  },
};
