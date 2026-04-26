<script lang="ts">
  interface Props {
    label?: string
    type?: string
    placeholder?: string
    value?: string | number
    error?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    class?: string
    id?: string
    autocomplete?: string
    min?: string | number
    max?: string | number
    step?: string | number
    oninput?: (e: Event) => void
    onchange?: (e: Event) => void
    onblur?: (e: FocusEvent) => void
  }

  let {
    label,
    type = 'text',
    placeholder,
    value = $bindable(''),
    error,
    hint,
    required = false,
    disabled = false,
    class: extraClass = '',
    id,
    autocomplete,
    min,
    max,
    step,
    oninput,
    onchange,
    onblur,
  }: Props = $props()

  const inputId = id ?? `input-${Math.random().toString(36).slice(2)}`
</script>

<div class="flex flex-col gap-1 {extraClass}">
  {#if label}
    <label for={inputId} class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
      {label}
      {#if required}<span class="text-red-500 ml-0.5">*</span>{/if}
    </label>
  {/if}

  <input
    {type}
    id={inputId}
    bind:value
    {placeholder}
    {required}
    {disabled}
    {autocomplete}
    {min}
    {max}
    {step}
    {oninput}
    {onchange}
    {onblur}
    class="
      h-10 px-3 rounded-lg border text-sm w-full
      bg-white dark:bg-neutral-900
      border-neutral-300 dark:border-neutral-600
      text-neutral-900 dark:text-neutral-100
      placeholder:text-neutral-400 dark:placeholder:text-neutral-500
      focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-colors duration-150
      {error ? 'border-red-500 focus:ring-red-500' : ''}
    "
  />

  {#if error}
    <p class="text-xs text-red-500">{error}</p>
  {:else if hint}
    <p class="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
  {/if}
</div>
