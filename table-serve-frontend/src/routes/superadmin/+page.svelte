<script lang="ts">
  import { onMount } from 'svelte'
  import { superAdminApi } from '$lib/api'
  import Card from '$lib/components/ui/Card.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import type { PlatformStats } from '$lib/types'

  let stats = $state<PlatformStats | null>(null)
  let loading = $state(true)

  onMount(async () => {
    const { data } = await superAdminApi.getStats()
    if (data) stats = data as PlatformStats
    loading = false
  })

  function formatCurrency(val: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      parseFloat(val ?? '0')
    )
  }
</script>

<svelte:head>
  <title>Dashboard - Super Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-8">
  <div>
    <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Platform Dashboard</h1>
    <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Overview of all organizations and activity.</p>
  </div>

  {#if loading}
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {#each Array(6) as _}
        <div class="h-28 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if stats}
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total Organizations</p>
        <p class="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">{stats.organizations}</p>
        <div class="flex gap-2 mt-3">
          <Badge variant="success">{stats.activeOrganizations} active</Badge>
          {#if stats.suspendedOrganizations > 0}
            <Badge variant="danger">{stats.suspendedOrganizations} suspended</Badge>
          {/if}
        </div>
      </Card>

      <Card>
        <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total Users</p>
        <p class="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">{stats.users}</p>
      </Card>

      <Card>
        <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total Orders</p>
        <p class="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">{stats.orders}</p>
      </Card>

      <Card class="col-span-2 lg:col-span-3">
        <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total Revenue</p>
        <p class="text-4xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">{formatCurrency(stats.totalRevenue)}</p>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Across all organizations</p>
      </Card>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Quick Actions</h2>
        <div class="space-y-2">
          <a href="/superadmin/organizations" class="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group">
            <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Manage Organizations</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-neutral-400 group-hover:text-brand-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
          <a href="/superadmin/analytics" class="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group">
            <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">View Analytics</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-neutral-400 group-hover:text-brand-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
          <a href="/superadmin/users" class="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group">
            <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Manage Users</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-neutral-400 group-hover:text-brand-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </Card>

      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Subscription Distribution</h2>
        <div class="space-y-3">
          {#each [['Free', 'neutral'], ['Basic', 'info'], ['Premium', 'brand']] as [plan, variant]}
            <div class="flex items-center justify-between">
              <Badge variant={variant as any}>{plan}</Badge>
              <span class="text-sm text-neutral-500 dark:text-neutral-400">-</span>
            </div>
          {/each}
        </div>
        <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-4">
          Visit <a href="/superadmin/organizations" class="underline text-brand-600">Organizations</a> for details.
        </p>
      </Card>
    </div>
  {/if}
</div>
