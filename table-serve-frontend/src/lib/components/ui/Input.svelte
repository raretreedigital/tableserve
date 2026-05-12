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
  const isPassword = type === 'password'
  let showPassword = $state(false)
  let effectiveType = $derived(isPassword ? (showPassword ? 'text' : 'password') : type)
</script>

<div class="flex flex-col gap-1 {extraClass}">
  {#if label}
    <label for={inputId} class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
      {label}
      {#if required}<span class="text-red-500 ml-0.5">*</span>{/if}
    </label>
  {/if}

  <div class="relative">
    <input
      type={effectiveType}
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
        h-10 rounded-lg border text-sm w-full
        bg-white dark:bg-neutral-900
        border-neutral-300 dark:border-neutral-600
        text-neutral-900 dark:text-neutral-100
        placeholder:text-neutral-400 dark:placeholder:text-neutral-500
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-150
        {error ? 'border-red-500 focus:ring-red-500' : ''}
        {isPassword ? 'pl-3 pr-10' : 'px-3'}
      "
    />
    {#if isPassword}
      <button
        type="button"
        onclick={() => (showPassword = !showPassword)}
        class="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {#if showPassword}
          <!-- eye-off -->
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
          </svg>
        {:else}
          <!-- eye -->
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        {/if}
      </button>
    {/if}
  </div>

  {#if error}
    <p class="text-xs text-red-500">{error}</p>
  {:else if hint}
    <p class="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
  {/if}
</div>
