<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { kdsApi } from '$lib/api'

  type Status = 'pending' | 'confirmed' | 'preparing' | 'ready'

  interface OrderItem {
    id: string
    menuItemName: string
    quantity: number
    notes?: string | null
  }

  interface Order {
    id: string
    tableId: string | null
    tableName: string | null
    status: Status
    notes: string | null
    totalAmount: string
    createdAt: string
    items: OrderItem[]
  }

  const KITCHEN_STATUSES: Status[] = ['pending', 'confirmed', 'preparing', 'ready']

  const STATUS_LABEL: Record<Status, string> = {
    pending: 'New',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
  }

  const STATUS_NEXT: Partial<Record<Status, Status>> = {
    pending: 'confirmed',
    confirmed: 'preparing',
    preparing: 'ready',
  }

  const STATUS_COLOR: Record<Status, string> = {
    pending: 'border-amber-400 bg-amber-50 dark:bg-amber-950/40',
    confirmed: 'border-blue-400 bg-blue-50 dark:bg-blue-950/40',
    preparing: 'border-purple-400 bg-purple-50 dark:bg-purple-950/40',
    ready: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
  }

  const STATUS_HEADER_COLOR: Record<Status, string> = {
    pending: 'bg-amber-500',
    confirmed: 'bg-blue-500',
    preparing: 'bg-purple-500',
    ready: 'bg-emerald-500',
  }

  const STATUS_NEXT_LABEL: Record<Status, string> = {
    pending: 'Confirm',
    confirmed: 'Start Cooking',
    preparing: 'Mark Ready',
    ready: '',
  }

  let token = $derived($page.params.token ?? '')
  let orders = $state<Order[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  let lastRefresh = $state(new Date())
  let advancing = $state<Record<string, boolean>>({})
  let interval: ReturnType<typeof setInterval>

  let byStatus = $derived(
    KITCHEN_STATUSES.reduce((acc, s) => {
      acc[s] = orders.filter((o) => o.status === s)
      return acc
    }, {} as Record<Status, Order[]>)
  )

  async function load() {
    const res = await kdsApi.getOrders(token)
    if (res.error) {
      error = res.error
      loading = false
      return
    }
    orders = (res.data?.orders ?? []) as Order[]
    lastRefresh = new Date()
    loading = false
    error = null
  }

  async function advance(order: Order) {
    const next = STATUS_NEXT[order.status]
    if (!next) return
    advancing[order.id] = true
    const res = await kdsApi.advanceOrder(token, order.id)
    advancing[order.id] = false
    if (res.error) return
    order.status = next
    orders = orders.filter((o) => KITCHEN_STATUSES.includes(o.status))
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

  onMount(() => {
    load()
    interval = setInterval(load, 8000)
  })

  onDestroy(() => clearInterval(interval))
</script>

<svelte:head>
  <title>Kitchen Display System</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-white">
  <!-- Header bar -->
  <div class="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
      <span class="font-bold text-lg tracking-wide">Kitchen Display</span>
      <span class="text-neutral-500 text-sm">{orders.length} active order{orders.length !== 1 ? 's' : ''}</span>
    </div>
    <span class="text-xs text-neutral-600">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
  </div>

  {#if loading}
    <div class="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
      {#each Array(4) as _}
        <div class="h-64 rounded-xl bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if error}
    <div class="flex items-center justify-center min-h-[80vh]">
      <div class="text-center space-y-4">
        <p class="text-5xl">⚠️</p>
        <p class="text-xl font-semibold text-red-400">Unable to load orders</p>
        <p class="text-neutral-400 text-sm">{error}</p>
        <button
          class="mt-4 px-6 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium transition-colors"
          onclick={load}
        >
          Retry
        </button>
      </div>
    </div>
  {:else}
    <!-- Scrollable column layout — works on small screens and large TVs alike -->
    <div class="p-4 overflow-x-auto">
      <div class="flex gap-4 min-w-max lg:min-w-0 lg:grid lg:grid-cols-4">
        {#each KITCHEN_STATUSES as status}
          <div class="w-72 lg:w-auto flex-shrink-0 space-y-3">
            <!-- Column header -->
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full {STATUS_HEADER_COLOR[status]}"></span>
                <h2 class="font-bold text-sm uppercase tracking-widest text-neutral-300">
                  {STATUS_LABEL[status]}
                </h2>
              </div>
              <span class="w-6 h-6 rounded-full bg-neutral-800 text-xs font-bold flex items-center justify-center text-neutral-300">
                {byStatus[status]?.length ?? 0}
              </span>
            </div>

            {#if byStatus[status]?.length === 0}
              <div class="rounded-xl border-2 border-dashed border-neutral-800 p-8 text-center">
                <p class="text-xs text-neutral-600">No orders</p>
              </div>
            {:else}
              {#each byStatus[status] as order (order.id)}
                <div class="rounded-xl border-2 p-4 space-y-3 {STATUS_COLOR[status]} {isUrgent(order.createdAt, status) ? 'ring-2 ring-red-500' : ''}">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="font-bold text-base text-white">{order.tableName ?? `Table ${order.tableId?.slice(0,6) ?? '?'}`}</p>
                      <p class="text-xs text-neutral-400">#{order.id.slice(0, 8)}</p>
                    </div>
                    <p class="text-xs font-semibold {isUrgent(order.createdAt, status) ? 'text-red-400 font-bold' : 'text-neutral-400'} whitespace-nowrap">
                      {elapsed(order.createdAt)}
                    </p>
                  </div>

                  <ul class="space-y-1.5">
                    {#each order.items as item}
                      <li class="flex gap-2 text-sm text-white">
                        <span class="font-bold min-w-[1.75rem] text-neutral-300">×{item.quantity}</span>
                        <span class="flex-1 leading-tight">{item.menuItemName}</span>
                      </li>
                      {#if item.notes}
                        <li class="text-xs text-amber-400 pl-8 italic">⚠ {item.notes}</li>
                      {/if}
                    {/each}
                  </ul>

                  {#if order.notes}
                    <p class="text-xs text-amber-400 italic border-t border-white/10 pt-2">Note: {order.notes}</p>
                  {/if}

                  {#if STATUS_NEXT[status]}
                    <button
                      class="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                      disabled={advancing[order.id]}
                      onclick={() => advance(order)}
                    >
                      {advancing[order.id] ? '...' : STATUS_NEXT_LABEL[status]}
                    </button>
                  {:else}
                    <div class="w-full py-2 px-3 rounded-lg bg-emerald-500/20 text-emerald-300 text-sm font-semibold text-center">
                      Ready for pickup
                    </div>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
