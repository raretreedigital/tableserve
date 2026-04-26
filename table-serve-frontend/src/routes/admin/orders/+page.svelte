<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import type { Order, OrderItem } from '$lib/types'

  let orgId = $derived($activeOrgId)
  let orders = $state<Order[]>([])
  let loading = $state(true)
  let filterStatus = $state('')
  let detailOrder = $state<{ order: Order; items: OrderItem[] } | null>(null)
  let detailOpen = $state(false)
  let updatingStatus = $state(false)

  const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']
  const statusVariant: Record<string, string> = {
    pending: 'warning',
    confirmed: 'info',
    preparing: 'info',
    ready: 'success',
    served: 'neutral',
    cancelled: 'danger',
  }

  onMount(async () => {
    const stored = localStorage.getItem('adminOrgId')
    if (stored) activeOrgId.set(stored)
    await load()
  })

  async function load() {
    if (!orgId) { loading = false; return }
    const { data } = await adminApi.getOrders(orgId, filterStatus || undefined)
    if (data) orders = (data as any).orders ?? []
    loading = false
  }

  $effect(() => {
    if (filterStatus !== undefined && orgId) load()
  })

  async function openDetail(order: Order) {
    const { data } = await adminApi.getOrder(orgId, order.id)
    if (data) {
      detailOrder = { order: (data as any).order, items: (data as any).items ?? [] }
      detailOpen = true
    }
  }

  async function updateStatus(orderId: string, status: string) {
    updatingStatus = true
    const { error } = await adminApi.updateOrderStatus(orgId, orderId, status)
    updatingStatus = false
    if (error) { addToast('error', error); return }
    addToast('success', 'Order status updated.')
    await load()
    if (detailOrder?.order.id === orderId) {
      detailOrder = { ...detailOrder, order: { ...detailOrder.order, status: status as any } }
    }
  }

  function fmt(val: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(val ?? '0'))
  }
</script>

<svelte:head>
  <title>Orders - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Orders</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{orders.length} orders</p>
    </div>
  </div>

  <!-- Status filter tabs -->
  <div class="flex gap-1 overflow-x-auto pb-1">
    <button
      class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
        {filterStatus === '' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
      onclick={() => (filterStatus = '')}
    >
      All
    </button>
    {#each statuses as s}
      <button
        class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap capitalize
          {filterStatus === s ? 'bg-brand-600 text-white' : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
        onclick={() => (filterStatus = s)}
      >
        {s}
      </button>
    {/each}
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(5) as _}
        <div class="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if orders.length === 0}
    <Card>
      <p class="text-center text-neutral-500 dark:text-neutral-400 py-8">No orders found.</p>
    </Card>
  {:else}
    <div class="space-y-2">
      {#each orders as order}
        <Card padding={false}>
          <button
            class="w-full flex items-center gap-4 p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors rounded-xl"
            onclick={() => openDetail(order)}
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold text-neutral-900 dark:text-neutral-100">
                  {order.tableName ?? 'Unknown table'}
                </p>
                {#if order.customerName}
                  <span class="text-sm text-neutral-500 dark:text-neutral-400">&mdash; {order.customerName}</span>
                {/if}
                <Badge variant={(statusVariant[order.status] ?? 'neutral') as any}>{order.status}</Badge>
              </div>
              <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                {new Date(order.createdAt).toLocaleString()}
                {#if order.notes} &middot; {order.notes}{/if}
              </p>
            </div>
            <span class="font-bold text-neutral-900 dark:text-neutral-100 shrink-0">{fmt(order.totalAmount)}</span>
          </button>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Order Detail Modal -->
{#if detailOrder}
  <Modal bind:open={detailOpen} title="Order Details" size="md">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="font-semibold text-neutral-900 dark:text-neutral-100">{detailOrder.order.tableName}</p>
          {#if detailOrder.order.customerName}
            <p class="text-sm text-neutral-500 dark:text-neutral-400">{detailOrder.order.customerName}
              {#if detailOrder.order.customerPhone} &middot; {detailOrder.order.customerPhone}{/if}
            </p>
          {/if}
          <p class="text-xs text-neutral-400 dark:text-neutral-500">{new Date(detailOrder.order.createdAt).toLocaleString()}</p>
        </div>
        <Badge variant={(statusVariant[detailOrder.order.status] ?? 'neutral') as any}>
          {detailOrder.order.status}
        </Badge>
      </div>

      <div class="space-y-2">
        {#each detailOrder.items as item}
          <div class="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
            <div>
              <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{item.menuItemName}</p>
              {#if item.notes}<p class="text-xs text-neutral-500 dark:text-neutral-400">{item.notes}</p>{/if}
            </div>
            <div class="text-right">
              <p class="text-sm text-neutral-500 dark:text-neutral-400">x{item.quantity} @ {fmt(item.unitPrice)}</p>
              <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{fmt(item.totalPrice)}</p>
            </div>
          </div>
        {/each}
      </div>

      <div class="pt-3 border-t border-neutral-200 dark:border-neutral-700 space-y-1 text-sm">
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
        <div class="flex justify-between font-bold text-neutral-900 dark:text-neutral-100 pt-1">
          <span>Total</span><span>{fmt(detailOrder.order.totalAmount)}</span>
        </div>
      </div>

      {#if detailOrder.order.notes}
        <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p class="text-xs font-medium text-amber-700 dark:text-amber-400">Note from customer</p>
          <p class="text-sm text-amber-800 dark:text-amber-300 mt-0.5">{detailOrder.order.notes}</p>
        </div>
      {/if}

      <div>
        <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Update Status</p>
        <div class="flex flex-wrap gap-2">
          {#each statuses as s}
            <Button
              size="sm"
              variant={detailOrder.order.status === s ? 'primary' : 'outline'}
              loading={updatingStatus}
              onclick={() => updateStatus(detailOrder!.order.id, s)}
              class="capitalize"
            >
              {s}
            </Button>
          {/each}
        </div>
      </div>
    </div>
  </Modal>
{/if}
