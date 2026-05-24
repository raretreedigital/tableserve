interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
}

interface ConfirmState {
  open: boolean
  options: ConfirmOptions
  resolve: ((value: boolean) => void) | null
}

export const confirmState = $state<ConfirmState>({
  open: false,
  options: { message: '' },
  resolve: null,
})

export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    confirmState.open = true
    confirmState.options = options
    confirmState.resolve = resolve
  })
}

export function confirmResolve(value: boolean) {
  confirmState.resolve?.(value)
  confirmState.open = false
  confirmState.resolve = null
}
