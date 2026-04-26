<script lang="ts">
  import { onMount } from 'svelte'
  import { superAdminApi } from '$lib/api'
  import Card from '$lib/components/ui/Card.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import type { AnalyticsResponse } from '$lib/types'

  type Period = 'today' | 'week' | 'month' | 'quarter' | 'year'
  let period = $state<Period>('month')
  let data = $state<AnalyticsResponse | null>(null)
  let loading = $state(true)

  async function load() {
    loading = true
    const res = await superAdminApi.getAnalytics(period)
    if (res.data) data = res.data as AnalyticsResponse
    loading = false
  }

  onMount(load)

  $effect(() => {
    if (period) load()
  })

  function fmt(val?: string | null) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      parseFloat(val ?? '0')
    )
  }

  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: '7 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: '90 Days' },
    { value: 'year', label: 'This Year' },
  ]
</script>

<svelte:head>
  <title>Analytics - Super Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Platform Analytics</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Performance metrics across all organizations.</p>
    </div>
    <div class="flex rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
      {#each periods as p}
        <button
          class="px-3 py-1.5 text-sm font-medium transition-colors
            {period === p.value
              ? 'bg-brand-600 text-white'
              : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
          onclick={() => (period = p.value)}
        >
          {p.label}
        </button>
      {/each}
    </div>
  </div>

  {#if loading}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {#each Array(4) as _}
        <div class="h-24 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if data}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Total Revenue</p>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{fmt(data.summary.totalRevenue)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Total Orders</p>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{data.summary.totalOrders}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Avg Order Value</p>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{fmt(data.summary.avgOrderValue)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Period</p>
        <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 mt-1">
          {new Date(data.period.from).toLocaleDateString()} - {new Date(data.period.to).toLocaleDateString()}
        </p>
      </Card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Top Menu Items</h2>
        {#if data.topItems.length === 0}
          <p class="text-sm text-neutral-500 dark:text-neutral-400">No data for this period.</p>
        {:else}
          <div class="space-y-3">
            {#each data.topItems as item, i}
              <div class="flex items-center gap-3">
                <span class="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-600 dark:text-neutral-400 shrink-0">
                  {i + 1}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{item.name}</p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400">{item.totalQuantity} orders</p>
                </div>
                <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 shrink-0">{fmt(item.totalRevenue)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Top Organizations</h2>
        {#if !(data as any).topOrganizations?.length}
          <p class="text-sm text-neutral-500 dark:text-neutral-400">No data for this period.</p>
        {:else}
          <div class="space-y-3">
            {#each (data as any).topOrganizations as org, i}
              <div class="flex items-center gap-3">
                <span class="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-600 dark:text-neutral-400 shrink-0">
                  {i + 1}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{org.name}</p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400">{org.orderCount} orders</p>
                </div>
                <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 shrink-0">{fmt(org.totalRevenue)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>

    <Card>
      <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Daily Revenue</h2>
      {#if data.dailyRevenue.length === 0}
        <p class="text-sm text-neutral-500 dark:text-neutral-400">No data for this period.</p>
      {:else}
        {@const maxRev = Math.max(...data.dailyRevenue.map((d) => parseFloat(d.revenue ?? '0')))}
        <div class="flex items-end gap-1 h-40">
          {#each data.dailyRevenue as day}
            {@const height = maxRev > 0 ? (parseFloat(day.revenue ?? '0') / maxRev) * 100 : 0}
            <div class="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                class="w-full bg-brand-500 dark:bg-brand-600 rounded-t-sm hover:bg-brand-600 dark:hover:bg-brand-500 transition-colors cursor-pointer"
                style="height: {height}%"
                title="{day.date}: {fmt(day.revenue)} ({day.orders} orders)"
              ></div>
            </div>
          {/each}
        </div>
        <div class="flex justify-between mt-2 text-xs text-neutral-400">
          <span>{data.dailyRevenue[0]?.date}</span>
          <span>{data.dailyRevenue[data.dailyRevenue.length - 1]?.date}</span>
        </div>
      {/if}
    </Card>
  {/if}
</div>
