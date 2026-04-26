<script lang="ts">
  import { goto } from '$app/navigation'
  import { authStore } from '$lib/stores/auth'
  import { onMount } from 'svelte'

  onMount(() => {
    const unsubscribe = authStore.subscribe((state) => {
      if (!state.initialized) return
      if (state.user?.role === 'superadmin') {
        goto('/superadmin')
      } else if (state.user) {
        goto('/admin')
      }
    })
    return unsubscribe
  })
</script>

<svelte:head>
  <title>Table Serve</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
  <div class="text-center max-w-md">
    <div class="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-6">
      <span class="text-white font-bold text-2xl">TS</span>
    </div>
    <h1 class="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">Table Serve</h1>
    <p class="text-neutral-500 dark:text-neutral-400 mb-8">
      NFC-powered restaurant menu and ordering platform.
    </p>
    <div class="flex flex-col sm:flex-row gap-3 justify-center">
      <a
        href="/admin/login"
        class="inline-flex items-center justify-center h-11 px-6 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
      >
        Restaurant Login
      </a>
      <a
        href="/superadmin/login"
        class="inline-flex items-center justify-center h-11 px-6 border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
      >
        Platform Admin
      </a>
    </div>
  </div>
</div>
