<script lang="ts">
  import { page } from '$app/stores'
  import { onMount, onDestroy } from 'svelte'
  import { customerApi } from '$lib/api'
  import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte'

  const token = $derived($page.params.token)
  const orderId = $derived($page.params.orderId)

  type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled'

  interface OrderItem {
    id: string
    quantity: number
    unitPrice: string
    notes?: string
    menuItem: { id: string; name: string }
  }

  interface OrderData {
    id: string
    status: OrderStatus
    totalAmount: string
    taxAmount: string
    serviceChargeAmount: string
    notes?: string
    customerName?: string
    createdAt: string
    editableUntil?: string
    editWindowMinutes?: number
    items: OrderItem[]
    table?: { name: string }
    organization?: { name: string }
  }

  let order = $state<OrderData | null>(null)
  let loading = $state(true)
  let error = $state('')
  let interval: ReturnType<typeof setInterval>

  // Edit order state
  let editOpen = $state(false)
  let editSaving = $state(false)
  let editError = $state('')
  let editSuccess = $state('')
  let secondsLeft = $state(0)
  let countdownInterval: ReturnType<typeof setInterval>

  interface EditCartItem {
    menuItemId: string
    name: string
    unitPrice: string
    quantity: number
    notes: string
  }
  let editCart = $state<EditCartItem[]>([])
  let editOrderNotes = $state('')

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

  function updateCountdown() {
    if (!order?.editableUntil) { secondsLeft = 0; return }
    const diff = Math.floor((new Date(order.editableUntil).getTime() - Date.now()) / 1000)
    secondsLeft = Math.max(0, diff)
    if (secondsLeft === 0) clearInterval(countdownInterval)
  }

  async function fetchOrder() {
    const { data, err } = await customerApi.getOrderStatus(orderId ?? '') as any
    if (err || !data) {
      error = err ?? 'Order not found.'
      loading = false
      return
    }
    order = data as OrderData
    loading = false
    updateCountdown()

    if (order.status === 'served' || order.status === 'cancelled') {
      clearInterval(interval)
      clearInterval(countdownInterval)
    }
  }

  onMount(async () => {
    await fetchOrder()
    interval = setInterval(fetchOrder, 30_000)
    countdownInterval = setInterval(updateCountdown, 1_000)
  })

  onDestroy(() => {
    clearInterval(interval)
    clearInterval(countdownInterval)
  })

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

  function formatCountdown(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  function openEdit() {
    if (!order) return
    editCart = order.items.map(i => ({
      menuItemId: i.menuItem.id,
      name: i.menuItem.name,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      notes: i.notes ?? '',
    }))
    editOrderNotes = order.notes ?? ''
    editError = ''
    editSuccess = ''
    editOpen = true
  }

  function changeQty(idx: number, delta: number) {
    const item = editCart[idx]
    const next = item.quantity + delta
    if (next < 1) {
      editCart = editCart.filter((_, i) => i !== idx)
    } else {
      editCart = editCart.map((it, i) => i === idx ? { ...it, quantity: next } : it)
    }
  }

  const editTotal = $derived(
    editCart.reduce((s, i) => s + parseFloat(i.unitPrice) * i.quantity, 0)
  )

  async function submitEdit() {
    if (editCart.length === 0) { editError = 'Cart cannot be empty.'; return }
    editSaving = true
    editError = ''
    const payload = {
      items: editCart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes || undefined })),
      notes: editOrderNotes || undefined,
    }
    const { data, error: err } = await customerApi.editOrder(orderId ?? '', payload) as any
    editSaving = false
    if (err || !data) {
      editError = err ?? 'Failed to update order.'
    } else {
      editSuccess = 'Order updated!'
      editOpen = false
      await fetchOrder()
    }
  }

  const canEdit = $derived(
    !!order && order.status === 'pending' && secondsLeft > 0
  )
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
      <!-- Edit success toast -->
      {#if editSuccess}
        <div class="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-400">
          ✓ {editSuccess}
        </div>
      {/if}

      <!-- Edit Window Banner (pending + time left) -->
      {#if canEdit}
        <div class="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 flex items-center justify-between gap-3">
          <div>
            <p class="font-semibold text-blue-800 dark:text-blue-300 text-sm">Order editable</p>
            <p class="text-xs text-blue-600 dark:text-blue-400">{formatCountdown(secondsLeft)} remaining to make changes</p>
          </div>
          <button
            onclick={openEdit}
            class="shrink-0 h-9 px-4 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Edit Order
          </button>
        </div>
      {:else if order.status === 'pending' && secondsLeft === 0 && order.editableUntil}
        <div class="rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-3 text-sm text-neutral-500 dark:text-neutral-400">
          The edit window has closed. Please speak with staff for any changes.
        </div>
      {/if}

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

<!-- Edit Order Modal -->
{#if editOpen}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="absolute inset-0 bg-black/50"
      onclick={() => (editOpen = false)}
      aria-label="Close"
    ></button>

    <!-- Sheet -->
    <div class="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
        <div>
          <h2 class="font-bold text-neutral-900 dark:text-neutral-100">Edit Order</h2>
          {#if secondsLeft > 0}
            <p class="text-xs text-blue-600 dark:text-blue-400">{formatCountdown(secondsLeft)} remaining</p>
          {/if}
        </div>
        <button
          onclick={() => (editOpen = false)}
          class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Items -->
      <div class="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {#if editCart.length === 0}
          <p class="text-sm text-neutral-400 text-center py-8">No items. Add items from the menu.</p>
        {/if}
        {#each editCart as item, idx}
          <div class="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{item.name}</p>
              <p class="text-xs text-neutral-500">{fmt(item.unitPrice)} each</p>
              <input
                type="text"
                placeholder="Item note (optional)"
                value={item.notes}
                oninput={(e) => { editCart = editCart.map((it, i) => i === idx ? { ...it, notes: (e.target as HTMLInputElement).value } : it) }}
                class="mt-1.5 w-full text-xs bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg px-2 py-1 text-neutral-700 dark:text-neutral-300 placeholder-neutral-400"
              />
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                onclick={() => changeQty(idx, -1)}
                class="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold hover:bg-neutral-300 dark:hover:bg-neutral-600"
              >−</button>
              <span class="w-6 text-center text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.quantity}</span>
              <button
                onclick={() => changeQty(idx, 1)}
                class="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold hover:bg-neutral-300 dark:hover:bg-neutral-600"
              >+</button>
            </div>
          </div>
        {/each}

        <!-- Order note -->
        <div class="pt-2">
          <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">Order Note</label>
          <textarea
            bind:value={editOrderNotes}
            placeholder="Any special requests for the whole order..."
            rows="2"
            class="w-full text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 resize-none"
          ></textarea>
        </div>

        {#if editError}
          <p class="text-sm text-red-600 dark:text-red-400">{editError}</p>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 shrink-0 flex items-center justify-between gap-3">
        <div>
          <p class="text-xs text-neutral-400">New total (excl. tax)</p>
          <p class="font-bold text-neutral-900 dark:text-neutral-100">{fmt(editTotal)}</p>
        </div>
        <div class="flex gap-2">
          <button
            onclick={() => (editOpen = false)}
            class="h-10 px-4 rounded-xl text-sm font-medium border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onclick={submitEdit}
            disabled={editSaving || editCart.length === 0}
            class="h-10 px-5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {#if editSaving}
              <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            {/if}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
