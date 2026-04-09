/**
 * apiClient.ts
 *
 * Axios instance pre-configured for the Lumina backend.
 * The request interceptor automatically injects the Bearer token
 * stored in useAuthStore every time a request is made, so individual
 * service functions never have to handle headers manually.
 */

import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Change this to your real backend URL (env var recommended for production)
const BASE_URL =
  (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_URL ??
  'http://10.0.2.2:3000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor ────────────────────────────────────────────────────
// Reads the token from Zustand state (synchronous — no async needed)
// and injects it into the Authorization header for every request.
apiClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor ───────────────────────────────────────────────────
// On 401 the session is considered expired: clear auth state.
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
