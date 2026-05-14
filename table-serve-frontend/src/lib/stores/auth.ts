import { writable } from 'svelte/store'
import type { User } from '../types'

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    loading: true,   // start as loading so guards wait for the session fetch
    initialized: false,
  })

  return {
    subscribe,
    setUser: (user: User | null) =>
      update((s) => ({ ...s, user, loading: false, initialized: true })),
    setLoading: (loading: boolean) => update((s) => ({ ...s, loading })),
    clear: () => set({ user: null, loading: false, initialized: true }),
  }
}

export const authStore = createAuthStore()
