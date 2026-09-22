import { API_BASE } from './apiBase';

let _token: string | null = null;
let _refreshToken: string | null = null;
let _username: string | null = null;

export function setAuthTokens(token: string, refreshToken: string, username: string): void {
  _token = token;
  _refreshToken = refreshToken;
  _username = username;
  // Persist to localStorage for page refresh survival
  try {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_refresh', refreshToken);
    localStorage.setItem('auth_username', username);
  } catch { /* localStorage unavailable */ }
}

export function getAuthToken(): string | null { return _token; }
export function getUsername(): string | null { return _username; }

export function clearAuth(): void {
  _token = null;
  _refreshToken = null;
  _username = null;
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_refresh');
    localStorage.removeItem('auth_username');
  } catch { /* */ }
}

export function authHeaders(): HeadersInit {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}

/** Attempt to refresh the access token using the stored refresh token */
export async function refreshAccessToken(): Promise<boolean> {
  if (!_refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: _refreshToken }),
    });
    if (!res.ok) { clearAuth(); return false; }
    const data = await res.json() as { token: string; refreshToken: string };
    _token = data.token;
    _refreshToken = data.refreshToken;
    try {
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_refresh', data.refreshToken);
    } catch { /* */ }
    return true;
  } catch { clearAuth(); return false; }
}

/** Restore auth from localStorage on app init */
export function restoreAuth(): boolean {
  try {
    const t = localStorage.getItem('auth_token');
    const r = localStorage.getItem('auth_refresh');
    const u = localStorage.getItem('auth_username');
    if (t && r && u) { _token = t; _refreshToken = r; _username = u; return true; }
  } catch { /* */ }
  return false;
}
