import { writable } from 'svelte/store'
import { browser } from '$app/environment'

type Theme = 'light' | 'dark'

function createThemeStore() {
  const initial: Theme =
    browser
      ? ((localStorage.getItem('theme') as Theme) ?? 'light')
      : 'light'

  const { subscribe, set } = writable<Theme>(initial)

  return {
    subscribe,
    toggle: () => {
      set((current: Theme) => {
        const next: Theme = current === 'light' ? 'dark' : 'light'
        if (browser) {
          localStorage.setItem('theme', next)
          document.documentElement.classList.toggle('dark', next === 'dark')
        }
        return next
      } as any)
    },
    set: (theme: Theme) => {
      if (browser) {
        localStorage.setItem('theme', theme)
        document.documentElement.classList.toggle('dark', theme === 'dark')
      }
      set(theme)
    },
  }
}

export const themeStore = createThemeStore()
