<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import Card from '$lib/components/ui/Card.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'

  let stats = $state<any>(null)
  let loading = $state(true)
  let orgId = $derived($activeOrgId)

  onMount(async () => {
    // Wait briefly for the layout to resolve the org ID, then load
    await new Promise(r => setTimeout(r, 50))
    if (!$activeOrgId) { loading = false; return }
    const { data } = await adminApi.getDashboard($activeOrgId)
    if (data) stats = data
    loading = false
  })

  function fmt(val: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(val ?? '0'))
  }

  function statusClass(status: string) {
    const map: Record<string, string> = {
      pending: 'warning',
      confirmed: 'info',
      preparing: 'info',
      ready: 'success',
      served: 'neutral',
      cancelled: 'danger',
    }
    return (map[status] ?? 'neutral') as any
  }
</script>

<svelte:head>
  <title>Dashboard - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-8">
  <div>
    <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Dashboard</h1>
    <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Your restaurant at a glance.</p>
  </div>

  {#if !orgId && !loading}
    <Card>
      <div class="text-center py-8">
        <p class="text-neutral-500 dark:text-neutral-400 mb-4">
          No organization found. Please contact support or check your account setup.
        </p>
      </div>
    </Card>
  {:else if loading}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {#each Array(4) as _}
        <div class="h-24 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if stats}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Today's Orders</p>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.today.orders}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Today's Revenue</p>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{fmt(stats.today.revenue)}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Monthly Orders</p>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.thisMonth.orders}</p>
      </Card>
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Monthly Revenue</p>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{fmt(stats.thisMonth.revenue)}</p>
      </Card>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Menu Items</p>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.totalMenuItems}</p>
        <a href="/admin/menu" class="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-1 block">Manage menu</a>
      </Card>
      <Card>
        <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">Tables</p>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stats.totalTables}</p>
        <a href="/admin/tables" class="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-1 block">Manage tables</a>
      </Card>
    </div>

    {#if stats.pendingOrders?.length > 0}
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
          Pending Orders ({stats.pendingOrders.length})
        </h2>
        <div class="space-y-2">
          {#each stats.pendingOrders.slice(0, 5) as order}
            <div class="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
              <div>
                <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {order.tableName ?? 'Unknown table'}
                  {#if order.customerName} - {order.customerName}{/if}
                </p>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  {new Date(order.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div class="flex items-center gap-3">
                <Badge variant={statusClass(order.status)}>{order.status}</Badge>
                <span class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{fmt(order.totalAmount)}</span>
              </div>
            </div>
          {/each}
        </div>
        <a href="/admin/orders" class="text-sm text-brand-600 dark:text-brand-400 hover:underline mt-3 block">View all orders</a>
      </Card>
    {/if}
  {/if}
</div>
