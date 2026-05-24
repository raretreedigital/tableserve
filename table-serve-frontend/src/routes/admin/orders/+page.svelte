<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import type { Order, OrderItem } from '$lib/types'
  import { fmtTime, fmtDateTime } from '$lib/date'

  let orgId = $derived($activeOrgId)
  let orders = $state<Order[]>([])
  let loading = $state(true)
  let filterStatus = $state('')
  let detailOrder = $state<{ order: Order; items: OrderItem[] } | null>(null)
  let detailOpen = $state(false)
  let updatingStatus = $state<string | null>(null)

  // Key format: `${orderId}:${status}` so each row has its own loading state

  // Active (non-terminal) statuses shown as a pipeline
  const pipeline = ['pending', 'confirmed', 'preparing', 'ready']
  const allStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']

  // Per-status design tokens
  const statusConfig: Record<string, { label: string; dot: string; badge: string; card: string; btn: string }> = {
    pending:   { label: 'Pending',   dot: 'bg-amber-400',   badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',    card: 'border-amber-200 dark:border-amber-800',   btn: 'bg-blue-600 hover:bg-blue-700 text-white' },
    confirmed: { label: 'Confirmed', dot: 'bg-blue-500',    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',       card: 'border-blue-200 dark:border-blue-800',     btn: 'bg-violet-600 hover:bg-violet-700 text-white' },
    preparing: { label: 'Preparing', dot: 'bg-violet-500',  badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300', card: 'border-violet-200 dark:border-violet-800', btn: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    ready:     { label: 'Ready',     dot: 'bg-emerald-500', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300', card: 'border-emerald-200 dark:border-emerald-800', btn: 'bg-neutral-600 hover:bg-neutral-700 text-white' },
    served:    { label: 'Served',    dot: 'bg-neutral-400', badge: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400',  card: 'border-neutral-200 dark:border-neutral-700', btn: 'bg-neutral-500 hover:bg-neutral-600 text-white' },
    cancelled: { label: 'Cancelled', dot: 'bg-red-400',     badge: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',             card: 'border-red-200 dark:border-red-800',       btn: 'bg-red-600 hover:bg-red-700 text-white' },
  }

  // Next logical status for one-tap advance
  const nextStatus: Record<string, string> = {
    pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'served',
  }

  const nextLabel: Record<string, string> = {
    pending: 'Confirm', confirmed: 'Start Preparing', preparing: 'Mark Ready', ready: 'Mark Served',
  }

  onMount(async () => { await load() })

  async function load() {
    if (!orgId) { loading = false; return }
    const { data } = await adminApi.getOrders(orgId, filterStatus || undefined)
    if (data) orders = (data as any).orders ?? []
    loading = false
  }

  $effect(() => { if (filterStatus !== undefined && orgId) load() })

  async function openDetail(order: Order) {
    const { data } = await adminApi.getOrder(orgId, order.id)
    if (data) {
      detailOrder = { order: (data as any).order, items: (data as any).items ?? [] }
      detailOpen = true
    }
  }

  async function updateStatus(orderId: string, status: string) {
    updatingStatus = `${orderId}:${status}`
    const { error } = await adminApi.updateOrderStatus(orgId, orderId, status)
    updatingStatus = null
    if (error) { addToast('error', error); return }
    addToast('success', `Order marked as ${status}.`)
    await load()
    if (detailOrder?.order.id === orderId) {
      detailOrder = { ...detailOrder, order: { ...detailOrder.order, status: status as any } }
    }
  }

  function fmt(val: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(val ?? '0'))
  }

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return fmtTime(dateStr)
  }

  // Pipeline step index — -1 for served/cancelled
  function pipelineIndex(status: string) {
    return pipeline.indexOf(status)
  }
</script>

<svelte:head>
  <title>Orders - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-5">

  <!-- Header -->
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Orders</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{orders.length} result{orders.length !== 1 ? 's' : ''}</p>
    </div>
    <button
      class="h-9 px-3 rounded-lg text-sm font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
      onclick={load}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Refresh
    </button>
  </div>

  <!-- Status filter pills -->
  <div class="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
    <button
      class="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border
        {filterStatus === '' ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-transparent' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'}"
      onclick={() => (filterStatus = '')}
    >All</button>
    {#each allStatuses as s}
      {@const cfg = statusConfig[s]}
      <button
        class="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border flex items-center gap-1.5
          {filterStatus === s ? cfg.badge + ' border-transparent' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'}"
        onclick={() => (filterStatus = s)}
      >
        <span class="w-1.5 h-1.5 rounded-full {cfg.dot} shrink-0"></span>
        {cfg.label}
      </button>
    {/each}
  </div>

  <!-- Order list -->
  {#if loading}
    <div class="space-y-2">
      {#each Array(5) as _}
        <div class="h-[72px] rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if orders.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <p class="font-medium text-neutral-700 dark:text-neutral-300">No orders yet</p>
      <p class="text-sm text-neutral-400 mt-1">Orders will appear here once customers start ordering.</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each orders as order}
        {@const cfg = statusConfig[order.status] ?? statusConfig.served}
        {@const next = nextStatus[order.status]}
        <div class="group bg-white dark:bg-neutral-900 rounded-xl border {cfg.card} shadow-sm overflow-hidden transition-shadow hover:shadow-md">
          <div class="flex items-center gap-3 px-4 py-3">

            <!-- Status dot -->
            <span class="w-2.5 h-2.5 rounded-full shrink-0 {cfg.dot}
              {['pending','confirmed','preparing'].includes(order.status) ? 'animate-pulse' : ''}">
            </span>

            <!-- Main info — click to open detail -->
            <button
              class="flex-1 min-w-0 text-left"
              onclick={() => openDetail(order)}
            >
              <div class="flex items-baseline gap-2 flex-wrap">
                <span class="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {order.tableName ?? 'Unknown table'}
                </span>
                {#if order.customerName}
                  <span class="text-sm text-neutral-400 truncate">{order.customerName}</span>
                {/if}
              </div>
              <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full {cfg.badge}">{cfg.label}</span>
                <span class="text-xs text-neutral-400">{timeAgo(order.createdAt)}</span>
                {#if order.notes}
                  <span class="text-xs text-neutral-400 truncate max-w-[140px]">"{order.notes}"</span>
                {/if}
              </div>
            </button>

            <!-- Amount -->
            <span class="font-bold text-neutral-900 dark:text-neutral-100 shrink-0 text-sm tabular-nums">
              {fmt(order.totalAmount)}
            </span>

            <!-- Quick advance button -->
            {#if next}
              {@const isLoading = updatingStatus === `${order.id}:${next}`}
              <button
                class="shrink-0 h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
                  flex items-center gap-1.5 {statusConfig[next].btn} disabled:opacity-50 shadow-sm"
                disabled={updatingStatus !== null}
                onclick={(e) => { e.stopPropagation(); updateStatus(order.id, next) }}
              >
                {#if isLoading}
                  <svg class="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                {/if}
                {nextLabel[order.status]}
              </button>
            {/if}

            <!-- Chevron -->
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0 group-hover:text-neutral-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Order Detail Modal -->
{#if detailOrder}
  {@const cfg = statusConfig[detailOrder.order.status] ?? statusConfig.served}
  {@const pIdx = pipelineIndex(detailOrder.order.status)}
  <Modal bind:open={detailOpen} title={detailOrder.order.tableName ?? 'Order'} size="md">
    <div class="space-y-5">

      <!-- Status badge + customer info row -->
      <div class="flex items-start justify-between gap-3 -mt-1">
        <div class="min-w-0">
          {#if detailOrder.order.customerName}
            <p class="text-sm text-neutral-600 dark:text-neutral-400 truncate">
              {detailOrder.order.customerName}
              {#if detailOrder.order.customerPhone} · {detailOrder.order.customerPhone}{/if}
            </p>
          {/if}
          <p class="text-xs text-neutral-400 mt-0.5 font-mono">#…{detailOrder.order.id.slice(-6).toUpperCase()} · {fmtDateTime(detailOrder.order.createdAt)}</p>
        </div>
        <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full {cfg.badge}">{cfg.label}</span>
      </div>

      <!-- Pipeline stepper (only for active orders) -->
      {#if pIdx >= 0}
        <div class="flex items-center gap-0">
          {#each pipeline as step, i}
            {@const stepCfg = statusConfig[step]}
            {@const done = i < pIdx}
            {@const active = i === pIdx}
            <div class="flex items-center flex-1 last:flex-none">
              <div class="flex flex-col items-center gap-1">
                <div class="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all
                  {done   ? 'bg-emerald-500 border-emerald-500'
                   : active ? stepCfg.dot.replace('bg-', 'bg-') + ' border-transparent'
                   : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'}">
                  {#if done}
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  {:else}
                    <span class="w-2 h-2 rounded-full {active ? stepCfg.dot : 'bg-neutral-200 dark:bg-neutral-700'}"></span>
                  {/if}
                </div>
                <span class="text-[10px] font-medium whitespace-nowrap {active ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400'}">{stepCfg.label}</span>
              </div>
              {#if i < pipeline.length - 1}
                <div class="flex-1 h-0.5 mx-1 mb-4 rounded-full transition-colors {done ? 'bg-emerald-400' : 'bg-neutral-200 dark:bg-neutral-700'}"></div>
              {/if}
            </div>
          {/each}
        </div>
      {:else if detailOrder.order.status === 'cancelled'}
        <div class="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          This order was cancelled.
        </div>
      {/if}

      <!-- Metadata row -->
      <div class="flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
        <span class="font-mono">#…{detailOrder.order.id.slice(-6).toUpperCase()}</span>
        <span>·</span>
        <span>{fmtDateTime(detailOrder.order.createdAt)}</span>
      </div>

      <!-- Customer note -->
      {#if detailOrder.order.notes}
        <div class="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
          </svg>
          <p class="text-sm text-amber-800 dark:text-amber-300">{detailOrder.order.notes}</p>
        </div>
      {/if}

      <!-- Line items -->
      <div class="rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
        {#each detailOrder.items as item, i}
          <div class="flex items-center gap-3 px-4 py-3 {i > 0 ? 'border-t border-neutral-100 dark:border-neutral-800' : ''}">
            <div class="w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-neutral-500 dark:text-neutral-400">{item.quantity}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{item.menuItemName}</p>
              {#if item.notes}
                <p class="text-xs text-neutral-400 italic truncate">{item.notes}</p>
              {/if}
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{fmt(item.totalPrice)}</p>
              <p class="text-xs text-neutral-400">{fmt(item.unitPrice)} each</p>
            </div>
          </div>
        {/each}
      </div>

      <!-- Totals -->
      <div class="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 space-y-1.5 text-sm">
        <div class="flex justify-between text-neutral-500 dark:text-neutral-400">
          <span>Subtotal</span><span>{fmt(detailOrder.order.subtotal)}</span>
        </div>
        {#if parseFloat(detailOrder.order.taxAmount) > 0}
          <div class="flex justify-between text-neutral-500 dark:text-neutral-400">
            <span>Tax</span><span>{fmt(detailOrder.order.taxAmount)}</span>
          </div>
        {/if}
        {#if parseFloat(detailOrder.order.serviceCharge) > 0}
          <div class="flex justify-between text-neutral-500 dark:text-neutral-400">
            <span>Service charge</span><span>{fmt(detailOrder.order.serviceCharge)}</span>
          </div>
        {/if}
        <div class="flex justify-between font-bold text-neutral-900 dark:text-neutral-100 pt-1.5 border-t border-neutral-200 dark:border-neutral-700">
          <span>Total</span><span>{fmt(detailOrder.order.totalAmount)}</span>
        </div>
      </div>

      <!-- Status actions -->
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-2.5">Update Status</p>
        <div class="grid grid-cols-3 gap-2">
          {#each allStatuses as s}
            {@const sCfg = statusConfig[s]}
            {@const isActive = detailOrder.order.status === s}
            {@const isUpdating = updatingStatus === `${detailOrder.order.id}:${s}`}
            <button
              class="relative flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all disabled:opacity-50
                {isActive
                  ? sCfg.badge + ' border-current'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'}"
              disabled={updatingStatus !== null}
              onclick={() => updateStatus(detailOrder!.order.id, s)}
            >
              {#if isUpdating}
                <svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              {:else}
                <span class="w-2.5 h-2.5 rounded-full {sCfg.dot}"></span>
              {/if}
              {sCfg.label}
              {#if isActive}
                <span class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full {sCfg.dot}"></span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

    </div>
  </Modal>
{/if}
