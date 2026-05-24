<script lang="ts">
  import { confirmState, confirmResolve } from '$lib/stores/confirm.svelte'

  const icons = {
    danger: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
    </svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
    </svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
    </svg>`,
  }

  const iconColors = {
    danger: 'text-red-500 bg-red-50 dark:bg-red-950/40',
    warning: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40',
    info: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40',
  }

  const confirmBtnColors = {
    danger: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500 text-white',
  }

  const variant = $derived(confirmState.options.variant ?? 'danger')

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) confirmResolve(false)
  }

  function handleKey(e: KeyboardEvent) {
    if (!confirmState.open) return
    if (e.key === 'Escape') confirmResolve(false)
    if (e.key === 'Enter') confirmResolve(true)
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if confirmState.open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    onclick={handleBackdrop}
    style="animation: fadeIn 120ms ease"
  >
    <div
      class="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      style="animation: slideUp 160ms cubic-bezier(0.34,1.56,0.64,1)"
    >
      <!-- Body -->
      <div class="px-6 pt-6 pb-5 flex gap-4">
        <!-- Icon -->
        <div class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center {iconColors[variant]}">
          {@html icons[variant]}
        </div>

        <!-- Text -->
        <div class="flex-1 min-w-0">
          {#if confirmState.options.title}
            <p id="confirm-title" class="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
              {confirmState.options.title}
            </p>
          {/if}
          <p id="confirm-message" class="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {confirmState.options.message}
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 px-6 pb-5 justify-end">
        <button
          class="px-4 py-2 text-sm font-medium rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          onclick={() => confirmResolve(false)}
        >
          {confirmState.options.cancelLabel ?? 'Cancel'}
        </button>
        <button
          class="px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 {confirmBtnColors[variant]}"
          onclick={() => confirmResolve(true)}
        >
          {confirmState.options.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fadeIn {
    from { opacity: 0 }
    to   { opacity: 1 }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: scale(0.92) translateY(12px) }
    to   { opacity: 1; transform: scale(1) translateY(0) }
  }
</style>
