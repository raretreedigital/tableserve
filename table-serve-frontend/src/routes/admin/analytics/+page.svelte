<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import Card from '$lib/components/ui/Card.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import type { AnalyticsResponse } from '$lib/types'

  type Period = 'today' | 'week' | 'month' | 'quarter' | 'year'
  let orgId = $derived($activeOrgId)
  let period = $state<Period>('month')
  let data = $state<AnalyticsResponse | null>(null)
  let loading = $state(true)
  let exporting = $state(false)

  async function load() {
    if (!orgId) { loading = false; return }
    loading = true
    const res = await adminApi.getAnalytics(orgId, period)
    if (res.data) data = res.data as AnalyticsResponse
    loading = false
  }

  async function exportCsv() {
    if (!orgId) return
    exporting = true
    try {
      const res = await adminApi.exportOrders(orgId, period)
      if (!res.ok) { exporting = false; return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-${period}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      exporting = false
    }
  }

  onMount(() => {
    load()
  })

  $effect(() => {
    if (period && orgId) load()
  })

  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: '7 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: '90 Days' },
    { value: 'year', label: 'This Year' },
  ]

  function fmt(val?: string | null) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(val ?? '0'))
  }

  const statusVariant: Record<string, string> = {
    pending: 'warning', confirmed: 'info', preparing: 'info',
    ready: 'success', served: 'neutral', cancelled: 'danger',
  }
</script>

<svelte:head>
  <title>Analytics - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Analytics</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Performance insights for your restaurant.</p>
    </div>
    <div class="flex items-center gap-3">
      <button
        class="h-9 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        onclick={exportCsv}
        disabled={exporting}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {exporting ? 'Exporting...' : 'Export CSV'}
      </button>
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
  </div>

  {#if loading}
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {#each Array(6) as _}
        <div class="h-24 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if data}
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Orders by Status</h2>
        {#if data.byStatus?.length}
          <div class="space-y-2">
            {#each data.byStatus as row}
              <div class="flex items-center justify-between">
                <Badge variant={(statusVariant[row.status] ?? 'neutral') as any} class="capitalize">{row.status}</Badge>
                <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{row.count}</span>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-neutral-500">No data.</p>
        {/if}
      </Card>

      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Top Menu Items</h2>
        {#if data.topItems.length === 0}
          <p class="text-sm text-neutral-500 dark:text-neutral-400">No data for this period.</p>
        {:else}
          <div class="space-y-3">
            {#each data.topItems as item, i}
              <div class="flex items-center gap-3">
                <span class="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-600 shrink-0">
                  {i + 1}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{item.name}</p>
                  <p class="text-xs text-neutral-500">{item.totalQuantity} ordered</p>
                </div>
                <span class="text-sm font-semibold shrink-0">{fmt(item.totalRevenue)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>

    {#if data.revenueByCategory?.length}
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Revenue by Category</h2>
        <div class="space-y-3">
          {#each data.revenueByCategory as row}
            <div class="flex items-center justify-between">
              <span class="text-sm text-neutral-700 dark:text-neutral-300">{row.categoryName ?? 'Uncategorized'}</span>
              <div class="text-right">
                <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{fmt(row.totalRevenue)}</span>
                <span class="text-xs text-neutral-500 ml-2">{row.totalQuantity} items</span>
              </div>
            </div>
          {/each}
        </div>
      </Card>
    {/if}

    <Card>
      <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Daily Revenue</h2>
      {#if data.dailyRevenue.length === 0}
        <p class="text-sm text-neutral-500 dark:text-neutral-400">No data for this period.</p>
      {:else}
        {@const maxRev = Math.max(...data.dailyRevenue.map((d) => parseFloat(d.revenue ?? '0')))}
        <div class="flex items-end gap-1 h-40">
          {#each data.dailyRevenue as day}
            {@const h = maxRev > 0 ? (parseFloat(day.revenue ?? '0') / maxRev) * 100 : 0}
            <div
              class="flex-1 bg-blue-500 dark:bg-blue-600 rounded-t-sm hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors cursor-default"
              style="height: {h}%"
              title="{day.date}: {fmt(day.revenue)} ({day.orders} orders)"
            ></div>
          {/each}
        </div>
        <div class="flex justify-between mt-2 text-xs text-neutral-400">
          <span>{data.dailyRevenue[0]?.date}</span>
          <span>{data.dailyRevenue[data.dailyRevenue.length - 1]?.date}</span>
        </div>
      {/if}
    </Card>

    {#if data.slowItems?.length}
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Slow Moving Items</h2>
        <div class="space-y-3">
          {#each data.slowItems as item}
            <div class="flex items-center justify-between">
              <p class="text-sm text-neutral-700 dark:text-neutral-300">{item.name}</p>
              <span class="text-sm text-neutral-500">{item.totalQuantity} sold</span>
            </div>
          {/each}
        </div>
        <p class="text-xs text-neutral-400 mt-4">Consider promoting or removing these items.</p>
      </Card>
    {/if}
  {/if}
</div>
