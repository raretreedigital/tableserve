import { writable } from 'svelte/store'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

export const toasts = writable<Toast[]>([])

export function addToast(type: Toast['type'], message: string, duration = 4000) {
  const id = Math.random().toString(36).slice(2)
  toasts.update((t) => [...t, { id, type, message }])
  setTimeout(() => removeToast(id), duration)
  return id
}

export function removeToast(id: string) {
  toasts.update((t) => t.filter((toast) => toast.id !== id))
}
