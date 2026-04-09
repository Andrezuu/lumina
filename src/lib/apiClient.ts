/**
 * apiClient.ts
 *
 * Axios instance pre-configured for the Lumina backend.
 *
 * ── Cycle-free token injection ──────────────────────────────────────────────
 * Instead of importing useAuthStore here (which creates a require cycle
 * apiClient → useAuthStore → authService → apiClient), we use two
 * setter functions that useAuthStore calls once after it is created:
 *
 *   setTokenGetter(() => useAuthStore.getState().token)
 *   setLogoutCallback(() => useAuthStore.getState().logout())
 *
 * apiClient never imports the store; it just calls the registered callbacks.
 */

import axios from 'axios';

// ─── Injected callbacks (set by useAuthStore after creation) ────────────────

let _getToken:  () => string | null  = () => null;
let _onLogout:  () => void           = () => {};

export function setTokenGetter(fn: () => string | null) { _getToken = fn; }
export function setLogoutCallback(fn: () => void)        { _onLogout = fn; }

// ─── Axios instance ─────────────────────────────────────────────────────────

const BASE_URL =
  (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_URL ??
  'http://10.0.2.2:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor ────────────────────────────────────────────────────
apiClient.interceptors.request.use(config => {
  const token = _getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor ───────────────────────────────────────────────────
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      _onLogout();
    }
    return Promise.reject(error);
  },
);
