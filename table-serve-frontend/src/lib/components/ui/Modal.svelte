<script lang="ts">
  interface Props {
    open?: boolean
    title?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
    onclose?: () => void
    children?: any
    footer?: any
  }

  let {
    open = $bindable(false),
    title,
    size = 'md',
    onclose,
    children,
    footer,
  }: Props = $props()

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      open = false
      onclose?.()
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false
      onclose?.()
    }
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    onclick={handleBackdrop}
  >
    <div
      class="
        w-full {sizes[size]} bg-white dark:bg-neutral-900
        rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700
        flex flex-col max-h-[90vh]
      "
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {#if title}
        <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 id="modal-title" class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </h2>
          <button
            class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
            onclick={() => { open = false; onclose?.() }}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/if}

      <div class="flex-1 overflow-y-auto px-6 py-4">
        {@render children?.()}
      </div>

      {#if footer}
        <div class="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 flex gap-3 justify-end">
          {@render footer?.()}
        </div>
      {/if}
    </div>
  </div>
{/if}
