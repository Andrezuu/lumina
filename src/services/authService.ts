/**
 * authService.ts
 *
 * All calls to /api/v1/auth/* go through here.
 * Returns typed responses; throws Axios errors with backend `message` fields
 * so the UI can display them directly.
 */

import { apiClient } from '../lib/apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts a human-readable error message from an Axios error.
 * Falls back to a generic string so the UI always has something to show.
 */
export function extractErrorMessage(error: unknown, fallback = 'Ocurrió un error'): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as any).response?.data?.message
  ) {
    return (error as any).response.data.message as string;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new user account and returns a JWT.
 */
export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
  return data;
}

/**
 * POST /api/v1/auth/login
 * Authenticates an existing user and returns a JWT.
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
  return data;
}

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user (token must be set in apiClient).
 */
export async function getMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>('/auth/me');
  return data;
}
