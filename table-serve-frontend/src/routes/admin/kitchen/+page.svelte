<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import { addToast } from '$lib/stores/toast'
  import Badge from '$lib/components/ui/Badge.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import KdsTokenCard from '$lib/components/KdsTokenCard.svelte'

  let orgId = $derived($activeOrgId)

  type Status = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled'
  interface Order { id: string; tableId?: string; tableName?: string; status: Status; totalAmount: string; createdAt: string; notes?: string }
  interface OrderWithItems extends Order { items: { menuItemName: string; quantity: number; notes?: string }[] }

  // Which columns to show in the kitchen board
  const KITCHEN_STATUSES: Status[] = ['pending', 'confirmed', 'preparing', 'ready']
  const STATUS_NEXT: Partial<Record<Status, Status>> = {
    pending: 'confirmed',
    confirmed: 'preparing',
    preparing: 'ready',
    ready: 'served',
  }
  const STATUS_LABEL: Record<Status, string> = {
    pending: 'New',
    confirmed: 'Confirmed',
    preparing: 'Cooking',
    ready: 'Ready',
    served: 'Served',
    cancelled: 'Cancelled',
  }
  const STATUS_COLOR: Record<Status, string> = {
    pending: 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700',
    confirmed: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700',
    preparing: 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700',
    ready: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700',
    served: 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700',
    cancelled: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
  }

  let orders = $state<OrderWithItems[]>([])
  let loading = $state(true)
  let advancing = $state<Record<string, boolean>>({})
  let lastRefresh = $state(new Date())
  let interval: ReturnType<typeof setInterval>

  onMount(async () => {
    await load()
    // Auto-refresh every 8 seconds
    interval = setInterval(load, 8000)
  })

  onDestroy(() => clearInterval(interval))

  async function load() {
    if (!orgId) return
    const res = await adminApi.getOrders(orgId, undefined, true)
    if (res.data) {
      const raw = (res.data as any).orders ?? []
      // Only show active orders (not served/cancelled)
      orders = raw.filter((o: Order) => KITCHEN_STATUSES.includes(o.status))
      lastRefresh = new Date()
      if (!loading) return
    }
    loading = false
  }

  async function advance(order: OrderWithItems) {
    const next = STATUS_NEXT[order.status]
    if (!next) return
    advancing[order.id] = true
    const { error } = await adminApi.updateOrderStatus(orgId, order.id, next)
    advancing[order.id] = false
    if (error) { addToast('error', error); return }
    order.status = next
    orders = orders.filter(o => KITCHEN_STATUSES.includes(o.status))
  }

  function elapsed(dateStr: string) {
    const ms = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'just now'
    if (m === 1) return '1 min ago'
    return `${m} mins ago`
  }

  function isUrgent(dateStr: string, status: Status) {
    const ms = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(ms / 60000)
    return (status === 'pending' && m >= 3) || (status === 'confirmed' && m >= 10) || (status === 'preparing' && m >= 20)
  }

  let byStatus = $derived(
    KITCHEN_STATUSES.reduce((acc, s) => {
      acc[s] = orders.filter(o => o.status === s)
      return acc
    }, {} as Record<Status, OrderWithItems[]>)
  )
</script>

<svelte:head>
  <title>Kitchen Display - Admin</title>
</svelte:head>

<div class="p-4 lg:p-6 space-y-4">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Kitchen Display</h1>
      <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
        Auto-refreshes every 8 seconds &nbsp;·&nbsp; Last: {lastRefresh.toLocaleTimeString()}
      </p>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-sm text-neutral-500 dark:text-neutral-400">{orders.length} active order{orders.length !== 1 ? 's' : ''}</span>
      <Button size="sm" variant="outline" onclick={load}>Refresh</Button>
    </div>
  </div>

  <!-- Standalone KDS link -->
  <KdsTokenCard orgId={orgId} />

  {#if loading}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {#each Array(4) as _}
        <div class="h-64 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each KITCHEN_STATUSES as status}
        <div class="space-y-3">
          <!-- Column header -->
          <div class="flex items-center justify-between px-1">
            <h2 class="font-bold text-sm uppercase tracking-wide text-neutral-700 dark:text-neutral-300">
              {STATUS_LABEL[status]}
            </h2>
            <span class="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-700 text-xs font-bold flex items-center justify-center text-neutral-700 dark:text-neutral-300">
              {byStatus[status]?.length ?? 0}
            </span>
          </div>

          <!-- Order cards -->
          {#if byStatus[status]?.length === 0}
            <div class="rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 p-6 text-center">
              <p class="text-xs text-neutral-400">No orders</p>
            </div>
          {:else}
            {#each byStatus[status] as order (order.id)}
              <div class="rounded-xl border-2 p-4 space-y-3 transition-all {STATUS_COLOR[status]} {isUrgent(order.createdAt, status) ? 'ring-2 ring-red-500' : ''}">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                      {order.tableName ?? `Table ${order.tableId?.slice(0,6) ?? '?'}`}
                    </p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">#{order.id.slice(0, 8)}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs font-medium {isUrgent(order.createdAt, status) ? 'text-red-600 dark:text-red-400 font-bold' : 'text-neutral-500 dark:text-neutral-400'}">
                      {elapsed(order.createdAt)}
                    </p>
                  </div>
                </div>

                <!-- Items -->
                <ul class="space-y-1">
                  {#each (order as any).items ?? [] as item}
                    <li class="text-sm text-neutral-800 dark:text-neutral-200 flex gap-2">
                      <span class="font-bold min-w-[1.5rem]">×{item.quantity}</span>
                      <span class="flex-1">{item.menuItemName}</span>
                    </li>
                    {#if item.notes}
                      <li class="text-xs text-amber-700 dark:text-amber-400 pl-8 italic">⚠ {item.notes}</li>
                    {/if}
                  {/each}
                </ul>

                {#if order.notes}
                  <p class="text-xs text-amber-700 dark:text-amber-400 italic border-t border-amber-300/50 pt-2">Note: {order.notes}</p>
                {/if}

                {#if STATUS_NEXT[status]}
                  <Button
                    size="sm"
                    class="w-full"
                    loading={advancing[order.id]}
                    onclick={() => advance(order)}
                  >
                    Mark as {STATUS_LABEL[STATUS_NEXT[status]!]}
                  </Button>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
