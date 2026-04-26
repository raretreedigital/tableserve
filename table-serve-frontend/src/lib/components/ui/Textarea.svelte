<script lang="ts">
  interface Props {
    label?: string
    value?: string
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    rows?: number
    placeholder?: string
    class?: string
  }

  let {
    label,
    value = $bindable(''),
    error,
    hint,
    required = false,
    disabled = false,
    rows = 3,
    placeholder,
    class: extraClass = '',
  }: Props = $props()

  const id = `textarea-${Math.random().toString(36).slice(2)}`
</script>

<div class="flex flex-col gap-1 {extraClass}">
  {#if label}
    <label for={id} class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
      {label}
      {#if required}<span class="text-red-500 ml-0.5">*</span>{/if}
    </label>
  {/if}

  <textarea
    {id}
    bind:value
    {rows}
    {placeholder}
    {required}
    {disabled}
    class="
      px-3 py-2 rounded-lg border text-sm w-full resize-y min-h-[80px]
      bg-white dark:bg-neutral-900
      border-neutral-300 dark:border-neutral-600
      text-neutral-900 dark:text-neutral-100
      placeholder:text-neutral-400 dark:placeholder:text-neutral-500
      focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-colors duration-150
      {error ? 'border-red-500 focus:ring-red-500' : ''}
    "
  ></textarea>

  {#if error}
    <p class="text-xs text-red-500">{error}</p>
  {:else if hint}
    <p class="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
  {/if}
</div>
