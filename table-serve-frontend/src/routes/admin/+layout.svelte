<script lang="ts">
  import { goto } from '$app/navigation'
  import { authStore } from '$lib/stores/auth'
  import { authApi } from '$lib/api'
  import { addToast } from '$lib/stores/toast'
  import Sidebar from '$lib/components/layout/Sidebar.svelte'
  import { onMount } from 'svelte'
  import { writable } from 'svelte/store'

  export const orgIdStore = writable<string>('')

  let { children } = $props()

  const navItems = [
    {
      href: '/admin',
      label: 'Dashboard',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    },
    {
      href: '/admin/menu',
      label: 'Menu',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`,
    },
    {
      href: '/admin/categories',
      label: 'Categories',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>`,
    },
    {
      href: '/admin/tables',
      label: 'Tables',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18"/></svg>`,
    },
    {
      href: '/admin/orders',
      label: 'Orders',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>`,
    },
    {
      href: '/admin/analytics',
      label: 'Analytics',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
    },
    {
      href: '/admin/settings',
      label: 'Settings',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>`,
    },
  ]

  let user = $derived($authStore.user)
  let initialized = $derived($authStore.initialized)

  onMount(() => {
    const unsub = authStore.subscribe((state) => {
      if (state.initialized && !state.user) {
        goto('/admin/login')
      }
      if (state.initialized && state.user?.role === 'superadmin') {
        goto('/superadmin')
      }
    })
    return unsub
  })

  async function signOut() {
    await authApi.signOut()
    authStore.clear()
    goto('/admin/login')
    addToast('success', 'Signed out.')
  }
</script>

{#if !initialized}
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
    <div class="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full"></div>
  </div>
{:else if user}
  <div class="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
    <Sidebar
      {navItems}
      title="Admin"
      user={user ? { name: user.name, email: user.email } : undefined}
      onsignout={signOut}
    />
    <main class="flex-1 min-w-0 overflow-auto">
      {@render children()}
    </main>
  </div>
{/if}
