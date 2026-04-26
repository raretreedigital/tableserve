<script lang="ts">
  import { toasts, removeToast } from '$lib/stores/toast'

  const icons = {
    success: `<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />`,
    error: `<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />`,
    warning: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />`,
    info: `<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`,
  }

  const styles = {
    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
    warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
  }
</script>

<div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
  {#each $toasts as toast (toast.id)}
    <div
      class="
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        pointer-events-auto cursor-pointer
        animate-in slide-in-from-right
        {styles[toast.type]}
      "
      role="alert"
      onclick={() => removeToast(toast.id)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        {@html icons[toast.type]}
      </svg>
      <p class="text-sm font-medium flex-1">{toast.message}</p>
    </div>
  {/each}
</div>
