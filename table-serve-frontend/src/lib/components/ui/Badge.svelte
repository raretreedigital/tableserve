<script lang="ts">
  interface Props {
    variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
    size?: 'sm' | 'md'
    class?: string
    children?: any
  }

  let { variant = 'neutral', size = 'sm', class: extraClass = '', children }: Props = $props()

  const variants = {
    neutral: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    brand: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }
</script>

<span class="inline-flex items-center gap-1 font-medium rounded-full {variants[variant]} {sizes[size]} {extraClass}">
  {@render children?.()}
</span>
