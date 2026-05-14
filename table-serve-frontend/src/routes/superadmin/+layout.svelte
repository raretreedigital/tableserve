<script lang="ts">
  import { goto } from '$app/navigation'
  import { authStore } from '$lib/stores/auth'
  import { authApi } from '$lib/api'
  import { addToast } from '$lib/stores/toast'
  import Sidebar from '$lib/components/layout/Sidebar.svelte'
  import { onMount } from 'svelte'

  let { children } = $props()

  const navItems = [
    {
      href: '/superadmin',
      label: 'Dashboard',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    },
    {
      href: '/superadmin/organizations',
      label: 'Organizations',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`,
    },
    {
      href: '/superadmin/analytics',
      label: 'Analytics',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
    },
    {
      href: '/superadmin/users',
      label: 'Users',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
    },
  ]

  onMount(() => {
    const unsub = authStore.subscribe((state) => {
      if (state.loading || !state.initialized) return
      if (!state.user || state.user.role !== 'superadmin') {
        goto('/superadmin/login')
      }
    })
    return unsub
  })

  async function signOut() {
    await authApi.signOut()
    authStore.clear()
    goto('/superadmin/login')
    addToast('success', 'Signed out successfully.')
  }
</script>

{#if $authStore.loading}
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
    <div class="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full"></div>
  </div>
{:else if $authStore.user?.role === 'superadmin'}
  <div class="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
    <Sidebar
      {navItems}
      title="Super Admin"
      user={$authStore.user ? { name: $authStore.user.name, email: $authStore.user.email, role: 'Super Admin' } : undefined}
      onsignout={signOut}
    />
    <main class="flex-1 min-w-0 overflow-auto">
      {@render children()}
    </main>
  </div>
{:else}
  {@render children()}
{/if}
