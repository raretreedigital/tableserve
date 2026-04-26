<script lang="ts">
  interface Option {
    value: string
    label: string
  }

  interface Props {
    label?: string
    options: Option[]
    value?: string
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    placeholder?: string
    class?: string
    onchange?: (e: Event) => void
  }

  let {
    label,
    options,
    value = $bindable(''),
    error,
    hint,
    required = false,
    disabled = false,
    placeholder,
    class: extraClass = '',
    onchange,
  }: Props = $props()

  const id = `select-${Math.random().toString(36).slice(2)}`
</script>

<div class="flex flex-col gap-1 {extraClass}">
  {#if label}
    <label for={id} class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
      {label}
      {#if required}<span class="text-red-500 ml-0.5">*</span>{/if}
    </label>
  {/if}

  <select
    {id}
    bind:value
    {required}
    {disabled}
    {onchange}
    class="
      h-10 px-3 rounded-lg border text-sm w-full appearance-none
      bg-white dark:bg-neutral-900
      border-neutral-300 dark:border-neutral-600
      text-neutral-900 dark:text-neutral-100
      focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-colors duration-150
      {error ? 'border-red-500' : ''}
    "
  >
    {#if placeholder}
      <option value="" disabled selected>{placeholder}</option>
    {/if}
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>

  {#if error}
    <p class="text-xs text-red-500">{error}</p>
  {:else if hint}
    <p class="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
  {/if}
</div>
