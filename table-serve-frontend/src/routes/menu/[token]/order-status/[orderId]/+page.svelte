<script lang="ts">
  import { page } from '$app/stores'
  import { onMount, onDestroy } from 'svelte'
  import { customerApi } from '$lib/api'
  import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte'

  const token = $derived($page.params.token)
  const orderId = $derived($page.params.orderId)

  type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled'

  interface OrderData {
    id: string
    status: OrderStatus
    totalAmount: string
    taxAmount: string
    serviceChargeAmount: string
    notes?: string
    customerName?: string
    createdAt: string
    items: Array<{
      id: string
      quantity: number
      unitPrice: string
      notes?: string
      menuItem: { id: string; name: string }
    }>
    table?: { name: string }
    organization?: { name: string }
  }

  let order = $state<OrderData | null>(null)
  let loading = $state(true)
  let error = $state('')
  let interval: ReturnType<typeof setInterval>

  const steps: { status: OrderStatus; label: string; description: string }[] = [
    { status: 'pending', label: 'Order Received', description: 'Your order has been received.' },
    { status: 'confirmed', label: 'Confirmed', description: 'The kitchen has confirmed your order.' },
    { status: 'preparing', label: 'Preparing', description: 'Your food is being prepared.' },
    { status: 'ready', label: 'Ready', description: 'Your order is ready!' },
    { status: 'served', label: 'Served', description: 'Enjoy your meal.' },
  ]

  const statusOrder: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'served']

  function getStepIndex(status: OrderStatus) {
    return statusOrder.indexOf(status)
  }

  async function fetchOrder() {
    const { data, error: err } = await customerApi.getOrderStatus(orderId ?? '')
    if (err || !data) {
      error = err ?? 'Order not found.'
      loading = false
      return
    }
    order = data as OrderData
    loading = false

    if (order.status === 'served' || order.status === 'cancelled') {
      clearInterval(interval)
    }
  }

  onMount(async () => {
    await fetchOrder()
    interval = setInterval(fetchOrder, 30_000)
  })

  onDestroy(() => clearInterval(interval))

  function fmt(val: string | number) {
    const n = typeof val === 'string' ? parseFloat(val) : val
    return `$${n.toFixed(2)}`
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diff / 60_000)
    if (min < 1) return 'just now'
    if (min < 60) return `${min}m ago`
    return `${Math.floor(min / 60)}h ${min % 60}m ago`
  }
</script>

<svelte:head>
  <title>Order Status</title>
</svelte:head>

<div class="min-h-screen bg-neutral-50 dark:bg-neutral-950">
  <!-- Header -->
  <header class="sticky top-0 z-20 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
    <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
      <div>
        <h1 class="font-bold text-neutral-900 dark:text-neutral-100">Order Status</h1>
        {#if order?.table}
          <p class="text-xs text-neutral-500">{order.table.name}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <ThemeToggle />
        <a
          href="/menu/{token}"
          class="h-9 px-4 rounded-lg text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center"
        >
          Back to menu
        </a>
      </div>
    </div>
  </header>

  <div class="max-w-2xl mx-auto px-4 py-8 space-y-6">
    {#if loading}
      <div class="flex items-center justify-center h-48">
        <div class="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full"></div>
      </div>
    {:else if error}
      <div class="text-center py-12">
        <p class="text-neutral-500 dark:text-neutral-400">{error}</p>
      </div>
    {:else if order}
      <!-- Status Banner -->
      {#if order.status === 'cancelled'}
        <div class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p class="font-semibold text-red-800 dark:text-red-300">Order Cancelled</p>
            <p class="text-sm text-red-600 dark:text-red-400">This order has been cancelled. Please speak with staff.</p>
          </div>
        </div>
      {:else if order.status === 'served'}
        <div class="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p class="font-semibold text-green-800 dark:text-green-300">Order Served</p>
            <p class="text-sm text-green-600 dark:text-green-400">Enjoy your meal!</p>
          </div>
        </div>
      {:else if order.status === 'ready'}
        <div class="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-center gap-3 animate-pulse">
          <div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <p class="font-semibold text-amber-800 dark:text-amber-300">Your order is ready!</p>
            <p class="text-sm text-amber-600 dark:text-amber-400">Staff will bring it to your table shortly.</p>
          </div>
        </div>
      {/if}

      <!-- Progress Timeline -->
      {#if order.status !== 'cancelled'}
        <div class="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
          <h2 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-6">Order Progress</h2>
          <div class="relative">
            <!-- Connector line -->
            <div class="absolute left-5 top-5 bottom-5 w-0.5 bg-neutral-200 dark:bg-neutral-700"></div>
            <div
              class="absolute left-5 top-5 w-0.5 bg-brand-600 transition-all duration-700"
              style="height: {Math.min(getStepIndex(order.status) / (steps.length - 1) * 100, 100)}%"
            ></div>

            <div class="space-y-6">
              {#each steps as step, i}
                {@const active = getStepIndex(order.status) >= i}
                {@const current = order.status === step.status}
                <div class="flex gap-4 items-start relative">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-300 z-10"
                    class:bg-brand-600={active}
                    class:border-brand-600={active}
                    class:bg-white={!active}
                    class:dark:bg-neutral-900={!active}
                    class:border-neutral-300={!active}
                    class:dark:border-neutral-600={!active}
                  >
                    {#if active}
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    {:else}
                      <span class="w-2.5 h-2.5 rounded-full bg-neutral-300 dark:bg-neutral-600"></span>
                    {/if}
                  </div>
                  <div class="pt-1.5">
                    <p class="font-medium {active ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-600'}">
                      {step.label}
                      {#if current}
                        <span class="inline-flex items-center gap-1 ml-2 text-xs font-normal text-brand-600">
                          <span class="w-1.5 h-1.5 rounded-full bg-brand-600 animate-pulse"></span>
                          Current
                        </span>
                      {/if}
                    </p>
                    <p class="text-sm {active ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-300 dark:text-neutral-700'}">{step.description}</p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}

      <!-- Order Summary -->
      <div class="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Order Summary</h2>
          <span class="text-xs text-neutral-400">{timeAgo(order.createdAt)}</span>
        </div>

        {#if order.customerName}
          <p class="text-sm text-neutral-700 dark:text-neutral-300">For: <span class="font-medium">{order.customerName}</span></p>
        {/if}

        <div class="space-y-2">
          {#each order.items as item}
            <div class="flex items-start gap-3">
              <span class="w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-600 dark:text-neutral-400 shrink-0">{item.quantity}</span>
              <div class="flex-1">
                <p class="text-sm text-neutral-900 dark:text-neutral-100">{item.menuItem.name}</p>
                {#if item.notes}<p class="text-xs text-neutral-400">{item.notes}</p>{/if}
              </div>
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 shrink-0">{fmt(parseFloat(item.unitPrice) * item.quantity)}</p>
            </div>
          {/each}
        </div>

        {#if order.notes}
          <div class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-600 dark:text-neutral-400">
            Note: {order.notes}
          </div>
        {/if}

        <div class="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1 text-sm">
          {#each [order.items.reduce((s, i) => s + parseFloat(i.unitPrice) * i.quantity, 0)] as subtotal}
          <div class="flex justify-between text-neutral-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          {#if parseFloat(order.taxAmount) > 0}
            <div class="flex justify-between text-neutral-500"><span>Tax</span><span>{fmt(order.taxAmount)}</span></div>
          {/if}
          {#if parseFloat(order.serviceChargeAmount) > 0}
            <div class="flex justify-between text-neutral-500"><span>Service</span><span>{fmt(order.serviceChargeAmount)}</span></div>
          {/if}
          <div class="flex justify-between font-bold text-neutral-900 dark:text-neutral-100 pt-1">
            <span>Total</span><span>{fmt(order.totalAmount)}</span>
          </div>
          {/each}
        </div>
      </div>

      <p class="text-center text-xs text-neutral-400 dark:text-neutral-600">Auto-refreshes every 30 seconds &bull; Order ID: {order.id.slice(0, 8)}&hellip;</p>
    {/if}
  </div>
</div>
