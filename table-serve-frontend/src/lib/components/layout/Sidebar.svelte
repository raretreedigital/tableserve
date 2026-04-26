<script lang="ts">
  import { page } from '$app/stores'
  import ThemeToggle from './ThemeToggle.svelte'

  interface NavItem {
    href: string
    label: string
    icon: string
  }

  interface Props {
    navItems: NavItem[]
    title: string
    user?: { name: string; email: string; role?: string }
    onsignout?: () => void
  }

  let { navItems, title, user, onsignout }: Props = $props()
  let mobileOpen = $state(false)

  const currentPath = $derived($page.url.pathname)
</script>

<!-- Desktop Sidebar -->
<aside
  class="
    hidden lg:flex flex-col w-64 h-screen sticky top-0
    bg-white dark:bg-neutral-900
    border-r border-neutral-200 dark:border-neutral-700
  "
>
  <!-- Logo -->
  <div class="px-6 py-5 border-b border-neutral-200 dark:border-neutral-700">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
        <span class="text-white font-bold text-sm">TS</span>
      </div>
      <div>
        <p class="font-semibold text-neutral-900 dark:text-neutral-100 text-sm leading-none">Table Serve</p>
        <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{title}</p>
      </div>
    </div>
  </div>

  <!-- Nav -->
  <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
    {#each navItems as item}
      <a
        href={item.href}
        class="
          flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
          transition-colors duration-150
          {currentPath === item.href || currentPath.startsWith(item.href + '/')
            ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'}
        "
      >
        {@html item.icon}
        {item.label}
      </a>
    {/each}
  </nav>

  <!-- User -->
  {#if user}
    <div class="px-3 py-4 border-t border-neutral-200 dark:border-neutral-700">
      <div class="flex items-center gap-3 px-3 py-2 rounded-lg">
        <div class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
          <span class="text-brand-700 dark:text-brand-400 font-semibold text-xs uppercase">
            {user.name.charAt(0)}
          </span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{user.name}</p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">{user.email}</p>
        </div>
        <div class="flex items-center gap-1">
          <ThemeToggle />
          {#if onsignout}
            <button
              class="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-red-600 transition-colors"
              onclick={onsignout}
              title="Sign out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</aside>

<!-- Mobile header bar -->
<div class="lg:hidden flex items-center justify-between px-4 h-14 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-30">
  <div class="flex items-center gap-2">
    <div class="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center">
      <span class="text-white font-bold text-xs">TS</span>
    </div>
    <span class="font-semibold text-sm text-neutral-900 dark:text-neutral-100">{title}</span>
  </div>
  <div class="flex items-center gap-1">
    <ThemeToggle />
    <button
      class="w-9 h-9 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      onclick={() => (mobileOpen = !mobileOpen)}
      aria-label="Toggle menu"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        {#if mobileOpen}
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        {:else}
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        {/if}
      </svg>
    </button>
  </div>
</div>

<!-- Mobile drawer -->
{#if mobileOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="lg:hidden fixed inset-0 z-20 bg-black/50"
    onclick={() => (mobileOpen = false)}
  ></div>
  <div class="lg:hidden fixed left-0 top-14 bottom-0 w-64 z-30 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto">
    <nav class="px-3 py-4 space-y-1">
      {#each navItems as item}
        <a
          href={item.href}
          onclick={() => (mobileOpen = false)}
          class="
            flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            {currentPath === item.href || currentPath.startsWith(item.href + '/')
              ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}
          "
        >
          {@html item.icon}
          {item.label}
        </a>
      {/each}
    </nav>
    {#if onsignout}
      <div class="px-3 pt-2 border-t border-neutral-200 dark:border-neutral-700">
        <button
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
          onclick={onsignout}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    {/if}
  </div>
{/if}
