<script lang="ts">
  import { page } from '$app/stores'
  import { onMount, onDestroy } from 'svelte'
  import { customerApi, hydrateTableSession, clearTableSession } from '$lib/api'
  import { goto } from '$app/navigation'
  import type { MenuItem, MenuCategory, CartItem } from '$lib/types'
  import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'

  const token = $derived($page.params.token)

  interface OrgInfo {
    id: string
    name: string
    primaryColor: string
    accentColor: string
    fontFamily: string
    bannerUrl?: string
    welcomeMessage?: string
    footerText?: string
    menuLayout: 'grid' | 'list'
    showCalories: boolean
    showAllergens: boolean
    showPreparationTime: boolean
    showSpiceLevel: boolean
    currencySymbol: string
    taxRate: string
    serviceChargeRate: string
    socialLinks?: any
    description?: string
  }

  interface TableInfo {
    id: string
    name: string
    organizationId: string
  }

  let org = $state<OrgInfo | null>(null)
  let table = $state<TableInfo | null>(null)
  let categories = $state<MenuCategory[]>([])
  let items = $state<MenuItem[]>([])
  let loading = $state(true)
  let error = $state('')
  let cart = $state<CartItem[]>([])
  let activeCategory = $state<string | 'all'>('all')
  let cartOpen = $state(false)
  let orderOpen = $state(false)
  let orderSuccess = $state(false)
  let placingOrder = $state(false)
  let orderId = $state('')
  let customerName = $state('')
  let customerPhone = $state('')
  let orderNotes = $state('')
  let idempotencyKey = $state('')
  let selectedItem = $state<MenuItem | null>(null)
  let itemDetailOpen = $state(false)
  let itemNote = $state('')
  let itemQty = $state(1)
  let filterChefSpecial = $state(false)
  let filterVeg = $state(false)
  let searchQuery = $state('')

  // ── My Orders ──
  interface PlacedOrder {
    id: string
    status: string
    totalAmount: string
    createdAt: string
    editableUntil: string | null
    notes: string | null
    items: { menuItemId: string; menuItemName: string; quantity: number; unitPrice: string; notes: string | null }[]
  }
  let myOrders = $state<PlacedOrder[]>([])
  let myOrdersOpen = $state(false)
  let billRequested = $state(false)
  let requestingBill = $state(false)
  let pollingInterval: ReturnType<typeof setInterval> | null = null
  let approvalPollInterval: ReturnType<typeof setInterval> | null = null

  // ── Edit Order ──
  interface EditCartItem { menuItemId: string; menuItemName: string; unitPrice: string; quantity: number; notes: string }
  let editingOrder = $state<PlacedOrder | null>(null)
  let editCart = $state<EditCartItem[]>([])
  let editNotes = $state('')
  let editOpen = $state(false)
  let editSaving = $state(false)
  let editError = $state('')
  let editTimeLeft = $state('')
  let editTimerInterval: ReturnType<typeof setInterval> | null = null
  let editAddCategory = $state<string>('all')

  function openEditOrder(o: PlacedOrder) {
    editingOrder = o
    editCart = o.items.map(i => ({ menuItemId: i.menuItemId, menuItemName: i.menuItemName, unitPrice: i.unitPrice, quantity: i.quantity, notes: i.notes ?? '' }))
    editNotes = o.notes ?? ''
    editError = ''
    editAddCategory = 'all'
    editOpen = true
    if (editTimerInterval) clearInterval(editTimerInterval)
    editTimerInterval = setInterval(() => {
      if (!editingOrder?.editableUntil) { editTimeLeft = ''; return }
      const secs = Math.floor((new Date(editingOrder.editableUntil).getTime() - Date.now()) / 1000)
      if (secs <= 0) {
        editTimeLeft = 'Expired'
        clearInterval(editTimerInterval!)
        editTimerInterval = null
      } else {
        editTimeLeft = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
      }
    }, 1000)
  }

  function closeEditOrder() {
    editOpen = false
    if (editTimerInterval) { clearInterval(editTimerInterval); editTimerInterval = null }
  }

  function editCartQty(menuItemId: string, delta: number) {
    editCart = editCart.map(i => i.menuItemId === menuItemId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
  }

  function removeEditCartItem(menuItemId: string) {
    editCart = editCart.filter(i => i.menuItemId !== menuItemId)
  }

  function addEditCartFromMenu(item: MenuItem) {
    const existing = editCart.find(i => i.menuItemId === item.id)
    if (existing) {
      editCart = editCart.map(i => i.menuItemId === item.id ? { ...i, quantity: i.quantity + 1 } : i)
    } else {
      editCart = [...editCart, { menuItemId: item.id, menuItemName: item.name, unitPrice: item.price, quantity: 1, notes: '' }]
    }
  }

  async function saveEditOrder() {
    if (!editingOrder || !editCart.length) return
    editError = ''
    editSaving = true
    const { error } = await customerApi.editOrder(editingOrder.id, {
      items: editCart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes || undefined })),
      notes: editNotes || undefined,
    })
    editSaving = false
    if (error) { editError = error; return }
    closeEditOrder()
    await fetchMyOrders()
  }

  function isEditable(o: PlacedOrder) {
    return o.status === 'pending' && !!o.editableUntil && new Date(o.editableUntil) > new Date()
  }

  // ── Session flow ──
  type Stage = 'loading' | 'form' | 'waiting' | 'ready' | 'session-ended'
  let stage = $state<Stage>('loading')
  let settings = $state({ collectCustomerDetails: false, requireOrderingOtp: false, requireSessionApproval: false, receiptSettings: {} as any })
  let formName = $state('')
  let formPhone = $state('')
  let formPartySize = $state('')
  let formOtp = $state('')
  let formError = $state('')
  let formSubmitting = $state(false)

  async function fetchMyOrders() {
    if (!token) return
    const { data } = await customerApi.getTableOrders(token)
    if (data) {
      if ((data as any).sessionEnded) {
        // Admin ended the session — clear everything and show the welcome form
        if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null }
        clearTableSession()
        try {
          sessionStorage.removeItem(`customer-name-${token}`)
          sessionStorage.removeItem(`customer-phone-${token}`)
        } catch {}
        myOrders = []
        billRequested = false
        cart = []
        customerName = ''
        customerPhone = ''
        formName = ''
        formPhone = ''
        formOtp = ''
        formError = ''
        stage = 'session-ended'
        return
      }
      myOrders = (data as any).orders ?? []
      billRequested = (data as any).billRequested ?? false
    }
  }

  async function handleRequestBill() {
    if (!token || requestingBill) return
    requestingBill = true
    const { error } = await customerApi.requestBill(token)
    requestingBill = false
    if (!error) {
      billRequested = true
    }
  }

  function statusColor(status: string) {
    const map: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      preparing: '#8b5cf6',
      ready: '#10b981',
      served: '#6b7280',
      cancelled: '#ef4444',
    }
    return map[status] ?? '#6b7280'
  }

  function statusLabel(status: string) {
    return { pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready ✓', served: 'Served', cancelled: 'Cancelled' }[status] ?? status
  }

  let totalSpent = $derived(myOrders.reduce((s, o) => s + parseFloat(o.totalAmount ?? '0'), 0))
  let activeOrderCount = $derived(myOrders.filter((o) => !['served', 'cancelled'].includes(o.status)).length)

  onMount(async () => {
    const tableRes = await customerApi.resolveTable(token ?? '')
    if (tableRes.error || !tableRes.data) {
      error = tableRes.error ?? 'Table not found.'
      loading = false
      return
    }

    const d = tableRes.data as any
    org = d.organization
    table = d.table
    settings = d.settings ?? { collectCustomerDetails: false, requireOrderingOtp: false, requireSessionApproval: false }

    // Always show the welcome form to collect customer details
    loading = false

    // Restore session if the customer refreshed the page in the same tab
    const sessionRestored = hydrateTableSession(token ?? '')
    if (sessionRestored) {
      try {
        customerName  = sessionStorage.getItem(`customer-name-${token}`)  ?? ''
        customerPhone = sessionStorage.getItem(`customer-phone-${token}`) ?? ''
      } catch {}
      await loadMenu()
      return
    }

    stage = 'form'
  })

  onDestroy(() => {
    if (pollingInterval) clearInterval(pollingInterval)
    if (approvalPollInterval) clearInterval(approvalPollInterval)
    if (editTimerInterval) clearInterval(editTimerInterval)
  })

  async function submitSession(data: { name?: string; partySize?: number; otp?: string }) {
    const res = await customerApi.startSession(token ?? '', data)
    if (res.error) {
      if (stage === 'form') {
        formError = res.error
        formSubmitting = false
      } else {
        error = res.error
        loading = false
      }
      return
    }
    const d = res.data as any
    if (d.pendingApproval) {
      stage = 'waiting'
      loading = false
      approvalPollInterval = setInterval(async () => {
        const statusRes = await customerApi.getSessionStatus(token ?? '')
        if (statusRes.data?.approved) {
          clearInterval(approvalPollInterval!)
          approvalPollInterval = null
          await loadMenu()
        }
      }, 3000)
      return
    }
    await loadMenu()
  }

  async function loadMenu() {
    const menuRes = await customerApi.getMenu(table!.organizationId)
    if (menuRes.data) {
      categories = (menuRes.data as any).categories ?? []
      items = (menuRes.data as any).items ?? []
    }
    loading = false
    stage = 'ready'
    pollingInterval = setInterval(fetchMyOrders, 10_000)
    fetchMyOrders()
  }

  async function handleFormSubmit(e: SubmitEvent) {
    e.preventDefault()
    formError = ''
    formSubmitting = true
    // Store details for use when placing orders
    customerName = formName.trim()
    customerPhone = formPhone.trim()
    await submitSession({
      name: formName.trim() || undefined,
      partySize: formPartySize ? parseInt(formPartySize) : undefined,
      otp: formOtp.trim() || undefined,
    })
    // Persist so the customer survives a page refresh
    try {
      sessionStorage.setItem(`customer-name-${token}`,  customerName)
      sessionStorage.setItem(`customer-phone-${token}`, customerPhone)
    } catch {}
    formSubmitting = false
  }

  let displayedItems = $derived(
    items.filter((item) => {
      if (activeCategory !== 'all' && item.categoryId !== activeCategory) return false
      if (filterChefSpecial && !item.isChefSpecial) return false
      if (filterVeg && !item.isVegetarian && !item.isVegan) return false
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  )

  let cartTotal = $derived(
    cart.reduce((sum, c) => sum + parseFloat(c.menuItem.price) * c.quantity, 0)
  )

  let cartCount = $derived(cart.reduce((sum, c) => sum + c.quantity, 0))

  let tax = $derived(org ? cartTotal * (parseFloat(org.taxRate ?? '0') / 100) : 0)
  let service = $derived(org ? cartTotal * (parseFloat(org.serviceChargeRate ?? '0') / 100) : 0)
  let grandTotal = $derived(cartTotal + tax + service)

  function openItemDetail(item: MenuItem) {
    selectedItem = item
    itemNote = ''
    itemQty = 1
    itemDetailOpen = true
  }

  function addToCart(item: MenuItem, qty: number, note?: string) {
    const existing = cart.findIndex((c) => c.menuItem.id === item.id)
    if (existing >= 0) {
      cart = cart.map((c, i) => i === existing ? { ...c, quantity: c.quantity + qty, notes: note || c.notes } : c)
    } else {
      cart = [...cart, { menuItem: item, quantity: qty, notes: note }]
    }
  }

  function updateCartQty(itemId: string, delta: number) {
    cart = cart
      .map((c) => c.menuItem.id === itemId ? { ...c, quantity: c.quantity + delta } : c)
      .filter((c) => c.quantity > 0)
  }

  function removeFromCart(itemId: string) {
    cart = cart.filter((c) => c.menuItem.id !== itemId)
  }

  function getCartQty(itemId: string) {
    return cart.find((c) => c.menuItem.id === itemId)?.quantity ?? 0
  }

  async function placeOrder(e: SubmitEvent) {
    e.preventDefault()
    if (!cart.length || !table || !org) return
    placingOrder = true

    const { data, error: err } = await customerApi.placeOrder({
      tableToken: token,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      notes: orderNotes || undefined,
      items: cart.map((c) => ({
        menuItemId: c.menuItem.id,
        quantity: c.quantity,
        notes: c.notes,
      })),
    }, idempotencyKey)

    placingOrder = false

    if (err) {
      orderNotes = ''
      return
    }

    orderId = (data as any).orderId
    orderSuccess = true
    cart = []
    // Fetch orders immediately after placing
    await fetchMyOrders()
  }

  function spiceLabel(level: string) {
    return { none: 'No spice', mild: 'Mild', medium: 'Medium', hot: 'Hot' }[level] ?? level
  }

  function fmt(val: string | number) {
    const n = typeof val === 'string' ? parseFloat(val) : val
    return `${org?.currencySymbol ?? '$'}${n.toFixed(2)}`
  }
</script>

<svelte:head>
  <title>{org?.name ?? 'Menu'}</title>
</svelte:head>

{#if loading}
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
    <div class="text-center">
      <div class="animate-spin w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-neutral-500 dark:text-neutral-400">Loading menu...</p>
    </div>
  </div>
{:else if error}
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
    <div class="text-center max-w-sm">
      <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 class="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Table Not Found</h1>
      <p class="text-neutral-500 dark:text-neutral-400">{error}</p>
    </div>
  </div>
{:else if stage === 'form' && org && table}
  <!-- Welcome screen — always shown before menu -->
  <div class="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950" style="font-family: '{org.fontFamily}', sans-serif;">

    <!-- Top hero -->
    <div class="relative flex-shrink-0">
      {#if org.bannerUrl}
        <img src={org.bannerUrl} alt={org.name} class="w-full h-52 sm:h-64 object-cover" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 px-6 pb-6">
          <h1 class="text-3xl font-bold text-white drop-shadow-lg">{org.name}</h1>
          <p class="text-white/80 text-sm mt-0.5">{table.name}</p>
        </div>
      {:else}
        <div class="h-40 flex flex-col items-center justify-center px-6" style="background: linear-gradient(135deg, {org.accentColor}22, {org.accentColor}44)">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-3" style="background-color: {org.accentColor}">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 text-center">{org.name}</h1>
          <p class="text-neutral-500 dark:text-neutral-400 text-sm mt-0.5">{table.name}</p>
        </div>
      {/if}
    </div>

    <!-- Form card -->
    <div class="flex-1 flex items-start justify-center px-4 pt-6 pb-10">
      <div class="w-full max-w-sm">
        {#if org.welcomeMessage}
          <p class="text-center text-neutral-600 dark:text-neutral-400 text-sm mb-5 leading-relaxed">{org.welcomeMessage}</p>
        {/if}

        <form onsubmit={handleFormSubmit} class="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden">

          <div class="px-6 pt-6 pb-2">
            <h2 class="text-lg font-bold text-neutral-900 dark:text-neutral-100">Welcome! 👋</h2>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Tell us a little about yourself to get started.</p>
          </div>

          <div class="px-6 py-4 space-y-4">

            <!-- Name — always required -->
            <div>
              <label for="sess-name" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Your Name <span class="text-red-500">*</span>
              </label>
              <input
                id="sess-name"
                type="text"
                bind:value={formName}
                required
                autocomplete="name"
                placeholder="e.g. Sarah"
                class="h-11 px-4 w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-neutral-700 transition-colors"
                style="--tw-ring-color: {org.accentColor}"
              />
            </div>

            <!-- Phone — always optional -->
            <div>
              <label for="sess-phone" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Phone Number
                <span class="text-neutral-400 font-normal ml-1">(optional)</span>
              </label>
              <input
                id="sess-phone"
                type="tel"
                bind:value={formPhone}
                autocomplete="tel"
                placeholder="+1 555 000 0000"
                class="h-11 px-4 w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-neutral-700 transition-colors"
                style="--tw-ring-color: {org.accentColor}"
              />
            </div>

            <!-- Party size — only if admin enabled it -->
            {#if settings.collectCustomerDetails}
              <div>
                <label for="sess-party" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  How many guests?
                  <span class="text-neutral-400 font-normal ml-1">(optional)</span>
                </label>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    class="w-11 h-11 rounded-xl border-2 flex items-center justify-center text-xl font-bold shrink-0 transition-colors"
                    style="border-color: {org.accentColor}; color: {org.accentColor}"
                    onclick={() => { const v = parseInt(formPartySize || '1'); if (v > 1) formPartySize = String(v - 1) }}
                  >−</button>
                  <input
                    id="sess-party"
                    type="number"
                    bind:value={formPartySize}
                    min="1" max="50"
                    placeholder="2"
                    class="h-11 px-4 w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-sm text-center font-semibold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-neutral-700 transition-colors"
                    style="--tw-ring-color: {org.accentColor}"
                  />
                  <button
                    type="button"
                    class="w-11 h-11 rounded-xl text-white flex items-center justify-center text-xl font-bold shrink-0"
                    style="background-color: {org.accentColor}"
                    onclick={() => { const v = parseInt(formPartySize || '0'); formPartySize = String(Math.min(50, v + 1)) }}
                  >+</button>
                </div>
              </div>
            {/if}

            <!-- OTP -->
            {#if settings.requireOrderingOtp}
              <div>
                <label for="sess-otp" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Table Code <span class="text-red-500">*</span></label>
                <p class="text-xs text-neutral-400 mb-2">Ask your server for the 6-digit code to unlock ordering.</p>
                <input
                  id="sess-otp"
                  type="text"
                  bind:value={formOtp}
                  required
                  maxlength="6"
                  inputmode="numeric"
                  placeholder="· · · · · ·"
                  class="h-13 px-4 w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-2xl font-mono text-center text-neutral-900 dark:text-neutral-100 tracking-[0.6em] focus:outline-none focus:ring-2 focus:bg-white dark:focus:bg-neutral-700 transition-colors"
                  style="--tw-ring-color: {org.accentColor}"
                />
              </div>
            {/if}

            {#if formError}
              <div class="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p class="text-sm text-red-600 dark:text-red-400">{formError}</p>
              </div>
            {/if}
          </div>

          <!-- CTA -->
          <div class="px-6 pb-6">
            <button
              type="submit"
              disabled={formSubmitting || !formName.trim()}
              class="w-full h-13 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 text-base transition-opacity hover:opacity-90"
              style="background-color: {org.accentColor}"
            >
              {#if formSubmitting}
                <div class="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                Just a moment…
              {:else if settings.requireSessionApproval}
                Request a Seat
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              {:else}
                View Menu &amp; Order
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              {/if}
            </button>
          </div>

        </form>

        <p class="text-center text-xs text-neutral-400 dark:text-neutral-500 mt-4">
          Your details are only used to personalize your experience.
        </p>
      </div>
    </div>
  </div>

{:else if stage === 'session-ended' && org && table}
  <!-- Session ended by admin -->
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4" style="font-family: '{org.fontFamily}', sans-serif;">
    <div class="text-center max-w-sm">
      <div class="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Session Ended</h1>
      <p class="text-neutral-500 dark:text-neutral-400 mb-6">
        Your table session has been closed. Thank you for dining at {org.name}!
      </p>
      <p class="text-xs text-neutral-400 mb-8">{org.name} · {table.name}</p>
      <button
        class="w-full h-12 rounded-xl font-semibold text-white text-sm"
        style="background-color: {org.accentColor}"
        onclick={() => { formName = ''; formPhone = ''; formOtp = ''; formError = ''; stage = 'form' }}
      >
        Start New Session
      </button>
    </div>
  </div>

{:else if stage === 'waiting' && org && table}
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4" style="font-family: '{org.fontFamily}', sans-serif;">
    <div class="text-center max-w-sm">
      <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style="background-color: {org.accentColor}20">
        <div class="animate-spin w-10 h-10 border-4 border-t-transparent rounded-full" style="border-color: {org.accentColor}; border-top-color: transparent"></div>
      </div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Awaiting Approval</h1>
      <p class="text-neutral-500 dark:text-neutral-400 mb-2">
        Please show this screen to your server or wait a moment — they'll approve your seat shortly.
      </p>
      <p class="text-xs text-neutral-400">{org.name} · {table.name}{formName ? ` · ${formName}` : ''}</p>
    </div>
  </div>

{:else if stage === 'ready' && org && table}
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-950" style="font-family: '{org.fontFamily}', sans-serif;">
    <!-- Header -->
    <header class="sticky top-0 z-30 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 shadow-sm">
      <div class="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h1 class="font-bold text-neutral-900 dark:text-neutral-100 truncate">{org.name}</h1>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">{table.name}</p>
        </div>

        <div class="flex items-center gap-2">
          <ThemeToggle />
          {#if myOrders.length > 0}
            <button
              class="relative flex items-center gap-2 h-10 px-3 rounded-lg font-medium text-sm transition-colors border"
              style="border-color: {org.accentColor}; color: {org.accentColor}"
              onclick={() => (myOrdersOpen = true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Orders
              {#if activeOrderCount > 0}
                <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold" style="background-color: {org.accentColor}">{activeOrderCount}</span>
              {/if}
            </button>
          {/if}
          {#if cart.length > 0}
            <button
              class="relative flex items-center gap-2 h-10 px-4 rounded-lg font-medium text-sm transition-colors text-white"
              style="background-color: {org.accentColor}"
              onclick={() => (cartOpen = true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Cart
              <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/25 text-xs font-bold">{cartCount}</span>
            </button>
          {/if}
        </div>
      </div>
    </header>

    <!-- Banner -->
    {#if org.bannerUrl}
      <div class="w-full h-40 sm:h-56 overflow-hidden">
        <img src={org.bannerUrl} alt={org.name} class="w-full h-full object-cover" />
      </div>
    {/if}

    <!-- Welcome -->
    {#if org.welcomeMessage}
      <div class="max-w-4xl mx-auto px-4 pt-6">
        <div class="p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-center">
          <p class="text-neutral-700 dark:text-neutral-300">{org.welcomeMessage}</p>
        </div>
      </div>
    {/if}

    <!-- Search and Filters -->
    <div class="max-w-4xl mx-auto px-4 pt-4 space-y-3">
      <input
        type="search"
        bind:value={searchQuery}
        placeholder="Search menu..."
        class="h-10 px-4 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm w-full text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-offset-0"
        style="--tw-ring-color: {org.accentColor}"
      />

      <div class="flex gap-2 flex-wrap">
        <button
          class="px-3 py-1.5 rounded-full text-sm font-medium transition-all border
            {filterChefSpecial
              ? 'text-white border-transparent'
              : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'}"
          style={filterChefSpecial ? `background-color: ${org.accentColor}; border-color: ${org.accentColor}` : ''}
          onclick={() => (filterChefSpecial = !filterChefSpecial)}
        >
          Chef's Special
        </button>
        <button
          class="px-3 py-1.5 rounded-full text-sm font-medium transition-all border
            {filterVeg
              ? 'text-white border-transparent bg-green-600'
              : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'}"
          onclick={() => (filterVeg = !filterVeg)}
        >
          Vegetarian / Vegan
        </button>
      </div>
    </div>

    <!-- Category tabs -->
    {#if categories.length > 0}
      <div class="max-w-4xl mx-auto px-4 pt-4">
        <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border
              {activeCategory === 'all'
                ? 'text-white border-transparent'
                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'}"
            style={activeCategory === 'all' ? `background-color: ${org.accentColor}; border-color: ${org.accentColor}` : ''}
            onclick={() => (activeCategory = 'all')}
          >
            All
          </button>
          {#each categories as cat}
            <button
              class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border
                {activeCategory === cat.id
                  ? 'text-white border-transparent'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'}"
              style={activeCategory === cat.id ? `background-color: ${org.accentColor}; border-color: ${org.accentColor}` : ''}
              onclick={() => (activeCategory = cat.id)}
            >
              {cat.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Menu Items -->
    <div class="max-w-4xl mx-auto px-4 py-6">
      {#if displayedItems.length === 0}
        <div class="text-center py-12">
          <p class="text-neutral-500 dark:text-neutral-400">No items found.</p>
        </div>
      {:else if org.menuLayout === 'grid'}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {#each displayedItems as item}
            <div
              class="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              role="button"
              tabindex="0"
              onclick={() => openItemDetail(item)}
              onkeydown={(e) => e.key === 'Enter' && openItemDetail(item)}
            >
              {#if item.imageUrl}
                <img src={item.imageUrl} alt={item.name} class="w-full h-44 object-cover" />
              {/if}
              <div class="p-4">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <p class="font-semibold text-neutral-900 dark:text-neutral-100">{item.name}</p>
                      {#if item.isChefSpecial}
                        <span class="text-xs font-medium px-1.5 py-0.5 rounded-full text-white" style="background-color: {org.accentColor}">Chef's Special</span>
                      {/if}
                    </div>
                    {#if item.description}
                      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{item.description}</p>
                    {/if}
                  </div>
                </div>

                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  {#if item.isVegetarian}
                    <Badge variant="success">Veg</Badge>
                  {/if}
                  {#if item.isVegan}
                    <Badge variant="success">Vegan</Badge>
                  {/if}
                  {#if item.isGlutenFree}
                    <Badge variant="info">GF</Badge>
                  {/if}
                  {#if org.showSpiceLevel && item.spiceLevel !== 'none'}
                    <Badge variant="warning">{spiceLabel(item.spiceLevel)}</Badge>
                  {/if}
                </div>

                <div class="flex items-center gap-2 mt-2 flex-wrap text-xs text-neutral-400">
                  {#if org.showCalories && item.calories}
                    <span>{item.calories} cal</span>
                  {/if}
                  {#if org.showPreparationTime && item.preparationTime}
                    <span>{item.preparationTime} min</span>
                  {/if}
                </div>

                <div class="flex items-center justify-between mt-3">
                  <p class="text-lg font-bold" style="color: {org.accentColor}">{fmt(item.price)}</p>
                  {#if getCartQty(item.id) > 0}
                    <div class="flex items-center gap-2">
                      <button
                        class="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-lg"
                        style="border-color: {org.accentColor}; color: {org.accentColor}"
                        onclick={(e) => { e.stopPropagation(); updateCartQty(item.id, -1) }}
                      >-</button>
                      <span class="font-bold text-neutral-900 dark:text-neutral-100 w-4 text-center">{getCartQty(item.id)}</span>
                      <button
                        class="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-lg"
                        style="background-color: {org.accentColor}"
                        onclick={(e) => { e.stopPropagation(); addToCart(item, 1) }}
                      >+</button>
                    </div>
                  {:else}
                    <button
                      class="h-9 px-4 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                      style="background-color: {org.accentColor}"
                      onclick={(e) => { e.stopPropagation(); addToCart(item, 1) }}
                    >
                      Add
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="space-y-3">
          {#each displayedItems as item}
            <div
              class="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 flex gap-4 cursor-pointer hover:shadow-md transition-shadow"
              role="button"
              tabindex="0"
              onclick={() => openItemDetail(item)}
              onkeydown={(e) => e.key === 'Enter' && openItemDetail(item)}
            >
              {#if item.imageUrl}
                <img src={item.imageUrl} alt={item.name} class="w-20 h-20 rounded-lg object-cover shrink-0" />
              {/if}
              <div class="flex-1 min-w-0">
                <div class="flex items-start gap-2 justify-between">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <p class="font-semibold text-neutral-900 dark:text-neutral-100">{item.name}</p>
                      {#if item.isChefSpecial}
                        <span class="text-xs font-medium px-1.5 py-0.5 rounded-full text-white" style="background-color: {org.accentColor}">Chef's Special</span>
                      {/if}
                    </div>
                    {#if item.description}
                      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{item.description}</p>
                    {/if}
                  </div>
                  <p class="text-base font-bold shrink-0" style="color: {org.accentColor}">{fmt(item.price)}</p>
                </div>

                <div class="flex items-center justify-between mt-2">
                  <div class="flex gap-1.5 flex-wrap">
                    {#if item.isVegetarian}<Badge variant="success" size="sm">Veg</Badge>{/if}
                    {#if item.isVegan}<Badge variant="success" size="sm">Vegan</Badge>{/if}
                    {#if org.showSpiceLevel && item.spiceLevel !== 'none'}<Badge variant="warning" size="sm">{spiceLabel(item.spiceLevel)}</Badge>{/if}
                    {#if org.showCalories && item.calories}<span class="text-xs text-neutral-400">{item.calories} cal</span>{/if}
                  </div>
                  {#if getCartQty(item.id) > 0}
                    <div class="flex items-center gap-2">
                      <button
                        class="w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold"
                        style="border-color: {org.accentColor}; color: {org.accentColor}"
                        onclick={(e) => { e.stopPropagation(); updateCartQty(item.id, -1) }}
                      >-</button>
                      <span class="font-bold text-neutral-900 dark:text-neutral-100">{getCartQty(item.id)}</span>
                      <button
                        class="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold"
                        style="background-color: {org.accentColor}"
                        onclick={(e) => { e.stopPropagation(); addToCart(item, 1) }}
                      >+</button>
                    </div>
                  {:else}
                    <button
                      class="h-8 px-3 rounded-lg text-sm font-medium text-white"
                      style="background-color: {org.accentColor}"
                      onclick={(e) => { e.stopPropagation(); addToCart(item, 1) }}
                    >Add</button>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Footer -->
    {#if org.footerText}
      <div class="text-center py-8 px-4 text-sm text-neutral-400 dark:text-neutral-500">
        {org.footerText}
      </div>
    {/if}
  </div>

  <!-- Item Detail Modal -->
  {#if selectedItem}
    <Modal bind:open={itemDetailOpen} size="md">
      <div class="space-y-4">
        {#if selectedItem.imageUrl}
          <img src={selectedItem.imageUrl} alt={selectedItem.name} class="w-full h-48 object-cover rounded-t-lg" style="margin: -1.5rem -1.5rem 0; width: calc(100% + 3rem)" />
        {/if}

        <div>
          <div class="flex items-start justify-between gap-2">
            <h2 class="text-xl font-bold text-neutral-900 dark:text-neutral-100">{selectedItem.name}</h2>
            <p class="text-xl font-bold shrink-0" style="color: {org?.accentColor}">{fmt(selectedItem.price)}</p>
          </div>
          {#if selectedItem.description}
            <p class="text-neutral-500 dark:text-neutral-400 mt-2">{selectedItem.description}</p>
          {/if}
        </div>

        <div class="flex flex-wrap gap-2">
          {#if selectedItem.isChefSpecial}
            <Badge variant="brand">Chef's Special</Badge>
          {/if}
          {#if selectedItem.isVegetarian}<Badge variant="success">Vegetarian</Badge>{/if}
          {#if selectedItem.isVegan}<Badge variant="success">Vegan</Badge>{/if}
          {#if selectedItem.isGlutenFree}<Badge variant="info">Gluten Free</Badge>{/if}
          {#if selectedItem.spiceLevel !== 'none'}<Badge variant="warning">{spiceLabel(selectedItem.spiceLevel)}</Badge>{/if}
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm">
          {#if org?.showCalories && selectedItem.calories}
            <div class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
              <p class="text-xs text-neutral-400">Calories</p>
              <p class="font-semibold text-neutral-900 dark:text-neutral-100">{selectedItem.calories} kcal</p>
            </div>
          {/if}
          {#if org?.showPreparationTime && selectedItem.preparationTime}
            <div class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
              <p class="text-xs text-neutral-400">Prep Time</p>
              <p class="font-semibold text-neutral-900 dark:text-neutral-100">{selectedItem.preparationTime} min</p>
            </div>
          {/if}
        </div>

        {#if org?.showAllergens && selectedItem.allergens.length > 0}
          <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p class="text-xs font-medium text-amber-700 dark:text-amber-400">Allergens</p>
            <p class="text-sm text-amber-800 dark:text-amber-300 mt-0.5">{selectedItem.allergens.join(', ')}</p>
          </div>
        {/if}

        <div class="flex flex-col gap-2">
          <label for="item-note" class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Special instructions (optional)</label>
          <textarea
            id="item-note"
            bind:value={itemNote}
            rows={2}
            placeholder="Any special requests..."
            class="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm resize-none focus:outline-none focus:ring-2"
            style="--tw-ring-color: {org?.accentColor}"
          ></textarea>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button
              class="w-9 h-9 rounded-full border-2 flex items-center justify-center text-xl font-bold"
              style="border-color: {org?.accentColor}; color: {org?.accentColor}"
              onclick={() => { if (itemQty > 1) itemQty-- }}
            >-</button>
            <span class="text-lg font-bold text-neutral-900 dark:text-neutral-100 w-6 text-center">{itemQty}</span>
            <button
              class="w-9 h-9 rounded-full text-white flex items-center justify-center text-xl font-bold"
              style="background-color: {org?.accentColor}"
              onclick={() => itemQty++}
            >+</button>
          </div>

          <button
            class="h-11 px-6 rounded-lg font-semibold text-white"
            style="background-color: {org?.accentColor}"
            onclick={() => {
              addToCart(selectedItem!, itemQty, itemNote)
              itemDetailOpen = false
            }}
          >
            Add {itemQty > 1 ? `(${itemQty})` : ''} - {fmt(parseFloat(selectedItem.price) * itemQty)}
          </button>
        </div>
      </div>
    </Modal>
  {/if}

  <!-- Cart Modal -->
  <Modal bind:open={cartOpen} title="Your Cart" size="md">
    {#if cart.length === 0}
      <p class="text-center text-neutral-500 dark:text-neutral-400 py-8">Your cart is empty.</p>
    {:else}
      <div class="space-y-3">
        {#each cart as item}
          <div class="flex items-center gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
            <div class="flex-1 min-w-0">
              <p class="font-medium text-neutral-900 dark:text-neutral-100">{item.menuItem.name}</p>
              {#if item.notes}<p class="text-xs text-neutral-500">{item.notes}</p>{/if}
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                class="w-7 h-7 rounded-full border flex items-center justify-center border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400"
                onclick={() => updateCartQty(item.menuItem.id, -1)}
              >-</button>
              <span class="text-sm font-medium w-4 text-center text-neutral-900 dark:text-neutral-100">{item.quantity}</span>
              <button
                class="w-7 h-7 rounded-full border flex items-center justify-center border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400"
                onclick={() => updateCartQty(item.menuItem.id, 1)}
              >+</button>
            </div>
            <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 w-16 text-right">
              {fmt(parseFloat(item.menuItem.price) * item.quantity)}
            </p>
          </div>
        {/each}
      </div>

      <div class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 space-y-1 text-sm">
        <div class="flex justify-between text-neutral-500"><span>Subtotal</span><span>{fmt(cartTotal)}</span></div>
        {#if tax > 0}
          <div class="flex justify-between text-neutral-500"><span>Tax</span><span>{fmt(tax)}</span></div>
        {/if}
        {#if service > 0}
          <div class="flex justify-between text-neutral-500"><span>Service charge</span><span>{fmt(service)}</span></div>
        {/if}
        <div class="flex justify-between font-bold text-neutral-900 dark:text-neutral-100 pt-1">
          <span>Total</span><span>{fmt(grandTotal)}</span>
        </div>
      </div>

      <button
        class="w-full h-12 rounded-lg font-semibold text-white mt-4"
        style="background-color: {org?.accentColor}"
        onclick={() => { cartOpen = false; idempotencyKey = crypto.randomUUID(); orderOpen = true }}
      >
        Proceed to Order
      </button>
    {/if}
  </Modal>

  <!-- Order Form Modal -->
  <Modal bind:open={orderOpen} title={orderSuccess ? 'Order Placed' : 'Place Order'} size="sm">
    {#if orderSuccess}
      <div class="text-center space-y-4 py-4">
        <div class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-bold text-neutral-900 dark:text-neutral-100">Order Placed Successfully</h3>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Your order has been sent to the kitchen.</p>
          <p class="text-xs text-neutral-400 mt-2">Order ID: {orderId}</p>
        </div>
        <button
          class="w-full h-11 rounded-lg font-medium text-white"
          style="background-color: {org?.accentColor}"
          onclick={() => { orderOpen = false; orderSuccess = false }}
        >
          Done
        </button>
      </div>
    {:else}
      <form onsubmit={placeOrder} class="space-y-4">
        <!-- Order summary strip -->
        <div class="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
          <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background-color: {org?.accentColor}22">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="color: {org?.accentColor}"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{cartCount} {cartCount === 1 ? 'item' : 'items'} · {fmt(grandTotal)}</p>
            {#if customerName}
              <p class="text-xs text-neutral-500 dark:text-neutral-400">For {customerName}</p>
            {/if}
          </div>
        </div>

        <div>
          <label for="order-notes" class="text-sm font-medium text-neutral-700 dark:text-neutral-300 block mb-1">Special Instructions <span class="text-neutral-400 font-normal">(optional)</span></label>
          <textarea
            id="order-notes"
            bind:value={orderNotes}
            rows={2}
            placeholder="Allergies, preferences..."
            class="px-3 py-2 w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm resize-none focus:outline-none focus:ring-2"
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={placingOrder}
          class="w-full h-12 rounded-lg font-semibold text-white disabled:opacity-60"
          style="background-color: {org?.accentColor}"
        >
          {placingOrder ? 'Placing order...' : `Confirm Order - ${fmt(grandTotal)}`}
        </button>
      </form>
    {/if}
  </Modal>

  <!-- My Orders Panel -->
  <Modal bind:open={myOrdersOpen} title="My Orders" size="md">
    {#if myOrders.length === 0}
      <div class="text-center py-8">
        <p class="text-neutral-500 dark:text-neutral-400">No orders placed yet.</p>
      </div>
    {:else}
      <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {#each myOrders as o}
          <div class="rounded-xl border overflow-hidden
            {o.status === 'pending' ? 'border-amber-200 dark:border-amber-800' : 'border-neutral-200 dark:border-neutral-700'}">

            <!-- Order header -->
            <div class="flex items-center gap-2 px-4 py-3
              {o.status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-white dark:bg-neutral-900'}">
              <div class="flex-1 min-w-0">
                <p class="text-xs text-neutral-400">{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p class="font-semibold text-neutral-900 dark:text-neutral-100">{fmt(o.totalAmount)}</p>
              </div>
              <span
                class="text-xs font-semibold px-2.5 py-1 rounded-full text-white shrink-0"
                style="background-color: {statusColor(o.status)}"
              >{statusLabel(o.status)}</span>
              {#if isEditable(o)}
                <button
                  class="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border-2 transition-colors"
                  style="border-color: {org?.accentColor}; color: {org?.accentColor}"
                  onclick={() => { myOrdersOpen = false; openEditOrder(o) }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                  </svg>
                  Edit
                </button>
              {/if}
            </div>

            <!-- Items -->
            <ul class="px-4 py-2 space-y-0.5 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800">
              {#each o.items as item}
                <li class="text-sm text-neutral-600 dark:text-neutral-400 flex justify-between">
                  <span>{item.quantity}× {item.menuItemName}</span>
                  <span>{fmt(parseFloat(item.unitPrice) * item.quantity)}</span>
                </li>
              {/each}
              {#if o.notes}
                <li class="text-xs text-neutral-400 italic pt-0.5">"{o.notes}"</li>
              {/if}
            </ul>
          </div>
        {/each}
      </div>

      <!-- Receipt / Bill Summary -->
      <div class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">

        <!-- Receipt card — shown when bill is requested -->
        {#if billRequested}
          {@const rs = settings.receiptSettings}
          <div class="rounded-2xl border border-neutral-200 dark:border-neutral-700 overflow-hidden mb-4 text-sm">

            <!-- Receipt header -->
            <div class="px-5 pt-5 pb-4 text-center border-b border-dashed border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              {#if rs.showLogo !== false && org?.bannerUrl}
                <img src={org.bannerUrl} alt={org.name} class="h-10 w-10 rounded-lg object-cover mx-auto mb-2" />
              {/if}
              <p class="font-bold text-neutral-900 dark:text-neutral-100 text-base">{org?.name}</p>
              {#if table?.name}
                <p class="text-xs text-neutral-400 mt-0.5">{table.name}{customerName ? ` · ${customerName}` : ''}</p>
              {/if}
              {#if rs.headerNote}
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-2 whitespace-pre-wrap leading-relaxed">{rs.headerNote}</p>
              {/if}
            </div>

            <!-- Line items -->
            {#if rs.showItemizedList !== false}
              <div class="px-5 py-3 bg-white dark:bg-neutral-900 space-y-1">
                {#each myOrders as o}
                  {#each o.items as item}
                    <div class="flex justify-between text-neutral-700 dark:text-neutral-300">
                      <span class="flex-1 min-w-0 truncate">{item.quantity}× {item.menuItemName}</span>
                      <span class="shrink-0 ml-3">{fmt(parseFloat(item.unitPrice) * item.quantity)}</span>
                    </div>
                  {/each}
                {/each}
              </div>
              <div class="border-t border-dashed border-neutral-200 dark:border-neutral-700"></div>
            {/if}

            <!-- Totals -->
            <div class="px-5 py-3 bg-white dark:bg-neutral-900 space-y-1">
              {#if rs.showItemizedList !== false}
                <div class="flex justify-between text-neutral-500 dark:text-neutral-400">
                  <span>Subtotal</span>
                  <span>{fmt(totalSpent)}</span>
                </div>
              {/if}
              {#if rs.showTax !== false && org && parseFloat(org.taxRate) > 0}
                {@const taxAmt = totalSpent * (parseFloat(org.taxRate) / 100)}
                <div class="flex justify-between text-neutral-500 dark:text-neutral-400">
                  <span>Tax ({org.taxRate}%)</span>
                  <span>{fmt(taxAmt)}</span>
                </div>
              {/if}
              {#if rs.showServiceCharge !== false && org && parseFloat(org.serviceChargeRate) > 0}
                {@const svcAmt = totalSpent * (parseFloat(org.serviceChargeRate) / 100)}
                <div class="flex justify-between text-neutral-500 dark:text-neutral-400">
                  <span>Service Charge ({org.serviceChargeRate}%)</span>
                  <span>{fmt(svcAmt)}</span>
                </div>
              {/if}
              <div class="flex justify-between font-bold text-neutral-900 dark:text-neutral-100 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                <span>Total</span>
                <span>{fmt(totalSpent)}</span>
              </div>
            </div>

            <!-- Receipt footer -->
            {#if rs.showOrderId !== false || rs.thankYouMessage || rs.footerNote}
              <div class="px-5 py-3 text-center border-t border-dashed border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 space-y-1">
                {#if rs.thankYouMessage}
                  <p class="font-medium text-neutral-700 dark:text-neutral-300">{rs.thankYouMessage}</p>
                {/if}
                {#if rs.showOrderId !== false && myOrders[0]?.id}
                  <p class="text-xs text-neutral-400 font-mono">Order #{myOrders[0].id.slice(0, 8).toUpperCase()}</p>
                {/if}
                {#if rs.footerNote}
                  <p class="text-xs text-neutral-400 whitespace-pre-wrap leading-relaxed mt-1">{rs.footerNote}</p>
                {/if}
              </div>
            {/if}
          </div>

          <div class="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p class="text-sm text-green-700 dark:text-green-400 font-medium">Bill requested — a waiter will be with you shortly.</p>
          </div>

        {:else}
          <!-- Pre-bill: show total + request button -->
          <div class="flex justify-between font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            <span>Total spent</span>
            <span>{fmt(totalSpent)}</span>
          </div>
          <button
            onclick={handleRequestBill}
            disabled={requestingBill}
            class="w-full h-12 rounded-xl font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style="background-color: {org?.accentColor}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 14H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4m-4 4l-4-4m4 4l4-4" />
            </svg>
            {requestingBill ? 'Requesting...' : 'Request Bill'}
          </button>
        {/if}
      </div>
    {/if}
  </Modal>

  <!-- Edit Order Modal -->
  <Modal
    bind:open={editOpen}
    title="Edit Order"
    size="md"
    onclose={closeEditOrder}
  >
    {#if editingOrder}
      <!-- countdown badge -->
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-neutral-500 dark:text-neutral-400">Adjust items or quantities below.</p>
        {#if editTimeLeft && editTimeLeft !== 'Expired'}
          <span class="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"/>
            </svg>
            {editTimeLeft} left
          </span>
        {:else if editTimeLeft === 'Expired'}
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
            Edit window closed
          </span>
        {/if}
      </div>

      <!-- Current cart items -->
      <div class="space-y-2 mb-4">
        {#each editCart as item}
          <div class="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{item.menuItemName}</p>
              <p class="text-xs text-neutral-500">{fmt(parseFloat(item.unitPrice))} each</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                class="w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-base leading-none"
                style="border-color: {org?.accentColor}; color: {org?.accentColor}"
                onclick={() => editCart.length === 1 && item.quantity === 1 ? null : (item.quantity === 1 ? removeEditCartItem(item.menuItemId) : editCartQty(item.menuItemId, -1))}
              >−</button>
              <span class="w-5 text-center font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{item.quantity}</span>
              <button
                class="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-base"
                style="background-color: {org?.accentColor}"
                onclick={() => editCartQty(item.menuItemId, 1)}
              >+</button>
            </div>
            <p class="w-14 text-right text-sm font-semibold text-neutral-900 dark:text-neutral-100 shrink-0">
              {fmt(parseFloat(item.unitPrice) * item.quantity)}
            </p>
            <button
              class="shrink-0 text-neutral-300 hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400 transition-colors"
              onclick={() => removeEditCartItem(item.menuItemId)}
              aria-label="Remove"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        {/each}
      </div>

      <!-- Add more items from menu -->
      <details class="mb-4">
        <summary class="cursor-pointer text-sm font-medium select-none py-2 px-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add more items
        </summary>
        <!-- Category filter pills -->
        {#if categories.length > 0}
          <div class="flex gap-1.5 overflow-x-auto pb-1.5 pt-2 scrollbar-hide">
            <button
              class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all"
              class:text-white={editAddCategory === 'all'}
              class:border-transparent={editAddCategory === 'all'}
              class:bg-neutral-200={editAddCategory !== 'all'}
              class:dark:bg-neutral-700={editAddCategory !== 'all'}
              class:text-neutral-600={editAddCategory !== 'all'}
              class:dark:text-neutral-300={editAddCategory !== 'all'}
              class:border-neutral-300={editAddCategory !== 'all'}
              style={editAddCategory === 'all' ? `background-color: ${org?.accentColor}; border-color: ${org?.accentColor}` : ''}
              onclick={() => (editAddCategory = 'all')}
            >All</button>
            {#each categories as cat}
              <button
                class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all"
                class:text-white={editAddCategory === cat.id}
                class:border-transparent={editAddCategory === cat.id}
                class:bg-neutral-200={editAddCategory !== cat.id}
                class:dark:bg-neutral-700={editAddCategory !== cat.id}
                class:text-neutral-600={editAddCategory !== cat.id}
                class:dark:text-neutral-300={editAddCategory !== cat.id}
                class:border-neutral-300={editAddCategory !== cat.id}
                style={editAddCategory === cat.id ? `background-color: ${org?.accentColor}; border-color: ${org?.accentColor}` : ''}
                onclick={() => (editAddCategory = cat.id)}
              >{cat.name}</button>
            {/each}
          </div>
        {/if}
        <div class="mt-1.5 max-h-48 overflow-y-auto space-y-1 pr-1">
          {#each items.filter(i => i.isAvailable && (editAddCategory === 'all' || i.categoryId === editAddCategory)) as item}
            <button
              class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
              onclick={() => addEditCartFromMenu(item)}
            >
              <span class="text-sm text-neutral-800 dark:text-neutral-200 truncate flex-1">{item.name}</span>
              <span class="text-sm font-semibold shrink-0" style="color: {org?.accentColor}">{fmt(item.price)}</span>
              <span class="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold" style="background-color: {org?.accentColor}">+</span>
            </button>
          {/each}
        </div>
      </details>

      <!-- Order notes -->
      <div class="mb-4">
        <label for="edit-notes" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
          Order Notes <span class="text-neutral-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="edit-notes"
          bind:value={editNotes}
          rows={2}
          placeholder="Allergies, preferences..."
          class="px-3 py-2 w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm resize-none focus:outline-none focus:ring-2"
          style="--tw-ring-color: {org?.accentColor}"
        ></textarea>
      </div>

      <!-- Total -->
      <div class="flex justify-between text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-4 px-1">
        <span>New Total</span>
        <span style="color: {org?.accentColor}">
          {fmt(editCart.reduce((s, i) => s + parseFloat(i.unitPrice) * i.quantity, 0))}
        </span>
      </div>

      {#if editError}
        <div class="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
          </svg>
          <p class="text-sm text-red-600 dark:text-red-400">{editError}</p>
        </div>
      {/if}

      <div class="flex gap-2">
        <button
          class="flex-1 h-11 rounded-xl font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          onclick={closeEditOrder}
        >Cancel</button>
        <button
          class="flex-1 h-11 rounded-xl font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
          style="background-color: {org?.accentColor}"
          disabled={editSaving || editCart.length === 0 || editTimeLeft === 'Expired'}
          onclick={saveEditOrder}
        >
          {#if editSaving}
            <div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
            Saving…
          {:else}
            Save Changes
          {/if}
        </button>
      </div>
    {/if}
  </Modal>{/if}