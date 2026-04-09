/**
 * useAuthStore.ts
 *
 * Global auth state managed by Zustand and persisted to AsyncStorage.
 * The store exposes:
 *   • state  — token, user, loading, error
 *   • actions — login(), register(), logout(), clearError()
 *
 * apiClient reads token via useAuthStore.getState().token, so there is
 * no circular-dependency risk: apiClient uses getState() (not a hook),
 * while the store uses apiClient (imported module).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as authService from '../services/authService';
import type { AuthUser, LoginPayload, RegisterPayload } from '../services/authService';

// ─── State shape ─────────────────────────────────────────────────────────────

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  // Actions
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:   null,
      user:    null,
      loading: false,
      error:   null,

      // ── login ───────────────────────────────────────────────────────────────
      login: async (payload) => {
        set({ loading: true, error: null });
        try {
          const { token, user } = await authService.login(payload);
          set({ token, user, loading: false });
        } catch (err) {
          set({ loading: false, error: authService.extractErrorMessage(err, 'Credenciales inválidas') });
        }
      },

      // ── register ─────────────────────────────────────────────────────────────
      register: async (payload) => {
        set({ loading: true, error: null });
        try {
          const { token, user } = await authService.register(payload);
          set({ token, user, loading: false });
        } catch (err) {
          set({ loading: false, error: authService.extractErrorMessage(err, 'No se pudo crear la cuenta') });
        }
      },

      // ── logout ────────────────────────────────────────────────────────────────
      logout: () => set({ token: null, user: null, error: null }),

      // ── clearError ────────────────────────────────────────────────────────────
      clearError: () => set({ error: null }),
    }),
    {
      name: 'lumina-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist token and user; ephemeral UI state stays in memory
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
