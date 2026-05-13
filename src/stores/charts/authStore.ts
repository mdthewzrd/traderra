import { create } from 'zustand'

/**
 * Cloud/auth state — user identity, API sync.
 */

interface AuthState {
  userId: string | null
  userName: string | null
  userEmail: string | null
  token: string | null

  setAuth: (userId: string, userName: string, userEmail: string, token: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: null,
  userName: null,
  userEmail: null,
  token: null,

  setAuth: (userId, userName, userEmail, token) =>
    set({ userId, userName, userEmail, token }),

  clearAuth: () =>
    set({ userId: null, userName: null, userEmail: null, token: null }),

  isAuthenticated: () => get().token !== null,
}))
