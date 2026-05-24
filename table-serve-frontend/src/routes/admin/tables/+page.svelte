<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import { addToast } from '$lib/stores/toast'
  import { showConfirm } from '$lib/stores/confirm.svelte'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import Input from '$lib/components/ui/Input.svelte'
  import type { RestaurantTable } from '$lib/types'
  import { fmtTime, fmtDateTime, TZ } from '$lib/date'

  let orgId = $derived($activeOrgId)
  let tables = $state<RestaurantTable[]>([])
  let loading = $state(true)
  let modalOpen = $state(false)
  let saving = $state(false)
  let editId = $state<string | null>(null)
  let form = $state({ name: '', capacity: '4', location: '' })
  let formErrors = $state<Record<string, string>>({})
  let nfcModalOpen = $state(false)
  let selectedTable = $state<RestaurantTable | null>(null)
  let otpModalOpen = $state(false)
  let otpValue = $state('')
  let otpTableName = $state('')
  let generatingOtp = $state<Record<string, boolean>>({})
  let approvingSession = $state<Record<string, boolean>>({})

  onMount(async () => {
    await load()
  })

  async function load() {
    if (!orgId) { loading = false; return }
    const { data } = await adminApi.getTables(orgId)
    if (data) tables = (data as any).tables ?? []
    loading = false
  }

  function openCreate() {
    editId = null
    form = { name: '', capacity: '4', location: '' }
    formErrors = {}
    modalOpen = true
  }

  function openEdit(t: RestaurantTable) {
    editId = t.id
    form = { name: t.name, capacity: t.capacity.toString(), location: t.location ?? '' }
    formErrors = {}
    modalOpen = true
  }

  async function handleSave(e: SubmitEvent) {
    e.preventDefault()
    if (!form.name.trim()) { formErrors.name = 'Required.'; return }
    saving = true

    const payload = {
      name: form.name,
      capacity: parseInt(form.capacity) || 4,
      location: form.location || undefined,
    }

    const { error } = editId
      ? await adminApi.updateTable(orgId, editId, payload)
      : await adminApi.createTable(orgId, payload)

    saving = false
    if (error) { addToast('error', error); return }
    addToast('success', editId ? 'Table updated.' : 'Table created.')
    modalOpen = false
    await load()
  }

  async function toggleActive(t: RestaurantTable) {
    const { error } = await adminApi.updateTable(orgId, t.id, { isActive: !t.isActive })
    if (error) { addToast('error', error); return }
    await load()
  }

  async function deleteTable(id: string) {
    if (!await showConfirm({ title: 'Delete table', message: 'This table and its QR code will be permanently removed.', confirmLabel: 'Delete', variant: 'danger' })) return
    const { error } = await adminApi.deleteTable(orgId, id)
    if (error) { addToast('error', error); return }
    addToast('success', 'Table deleted.')
    await load()
  }

  async function endSession(t: RestaurantTable) {
    if (!await showConfirm({ title: `End session — ${t.name}`, message: 'All active orders will be marked as served and the bill request will be cleared.', confirmLabel: 'End session', variant: 'warning' })) return
    const { error } = await adminApi.endTableSession(orgId, t.id)
    if (error) { addToast('error', error); return }
    addToast('success', `Session ended for ${t.name}.`)
    await load()
  }

  function showNfc(t: RestaurantTable) {
    selectedTable = t
    nfcModalOpen = true
  }

  async function generateOtp(t: RestaurantTable) {
    generatingOtp[t.id] = true
    const { data, error } = await adminApi.generateTableOtp(orgId, t.id)
    generatingOtp[t.id] = false
    if (error) { addToast('error', error); return }
    otpValue = (data as any)?.otp ?? ''
    otpTableName = t.name
    otpModalOpen = true
  }

  async function approveSession(t: RestaurantTable) {
    approvingSession[t.id] = true
    const { error } = await adminApi.approveTableSession(orgId, t.id)
    approvingSession[t.id] = false
    if (error) { addToast('error', error); return }
    addToast('success', `Session approved for ${t.name}.`)
    await load()
  }

  async function printBill(t: RestaurantTable) {
    const { data, error } = await adminApi.getTableOrders(orgId, t.id)
    if (error || !data) { addToast('error', 'Could not load orders.'); return }
    const orders = data.orders ?? []
    const items = data.items ?? []
    if (!orders.length) { addToast('warning', 'No orders this session.'); return }

    const itemsByOrder = items.reduce((acc: Record<string, any[]>, item: any) => {
      ;(acc[item.orderId] ??= []).push(item)
      return acc
    }, {})
    const total = orders.reduce((s: number, o: any) => s + parseFloat(o.totalAmount ?? '0'), 0)

    const win = window.open('', '_blank', 'width=420,height=700')
    if (!win) { addToast('error', 'Allow popups to print.'); return }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bill — ${t.name}</title>
<style>body{font-family:monospace;font-size:13px;padding:20px;max-width:380px;margin:0 auto}
h1{font-size:18px;text-align:center;margin-bottom:4px}.center{text-align:center}
.div{border-top:1px dashed #000;margin:10px 0}.row{display:flex;justify-content:space-between;margin:3px 0}
.total{font-weight:bold;font-size:15px}@media print{button{display:none}}</style></head><body>
<h1>Receipt</h1><p class="center">${t.name}</p><p class="center">${new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' })}</p>
<div class="div"></div>
${orders.map((o: any) =>
  `<div style="margin-bottom:8px">
  <div class="row"><span>#${o.id.slice(0,8)}</span><span>${new Date(o.createdAt).toLocaleTimeString('en-AE',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Dubai'})}</span></div>
  ${(itemsByOrder[o.id] ?? []).map((i: any) => `<div class="row"><span>${i.quantity}× ${i.menuItemName}</span><span>$${parseFloat(i.unitPrice ?? i.totalPrice ?? '0').toFixed(2)}</span></div>`).join('')}
  </div>`).join('<div class="div"></div>')}
<div class="div"></div>
<div class="row total"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>
<div class="div"></div>
<p class="center" style="margin-top:16px">Thank you!</p>
<button onclick="window.print()" style="margin:20px auto;display:block;padding:8px 24px;font-size:14px;cursor:pointer">Print</button>
</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  function getNfcUrl(t: RestaurantTable) {
    return `${window.location.origin}/menu/${t.nfcToken}`
  }

  function copyNfcUrl(t: RestaurantTable) {
    navigator.clipboard.writeText(getNfcUrl(t))
    addToast('success', 'NFC URL copied to clipboard.')
  }
</script>

<svelte:head>
  <title>Tables - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Restaurant Tables</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Each table has a unique NFC token for customer ordering.</p>
    </div>
    <Button onclick={openCreate}>Add Table</Button>
  </div>

  {#if loading}
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {#each Array(6) as _}
        <div class="h-36 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if tables.length === 0}
    <Card>
      <p class="text-center text-neutral-500 dark:text-neutral-400 py-8">No tables yet. Add your first table to get NFC links.</p>
    </Card>
  {:else}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each tables as table}
        {@const hasSession = !!(table as any).sessionStartedAt}
        {@const pendingApproval = (table as any).sessionApproved === false && hasSession}
        {@const billReq = !!(table as any).billRequested}
        <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <!-- Card Header -->
          <div class="px-4 pt-4 pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <!-- Status dot -->
                <span class="relative flex-shrink-0 mt-0.5">
                  <span class="w-2.5 h-2.5 rounded-full block {table.isActive ? 'bg-emerald-400' : 'bg-neutral-300 dark:bg-neutral-600'}"></span>
                  {#if hasSession && table.isActive}
                    <span class="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70"></span>
                  {/if}
                </span>
                <div class="min-w-0">
                  <p class="font-semibold text-neutral-900 dark:text-neutral-100 truncate leading-snug">{table.name}</p>
                  <p class="text-xs text-neutral-400 mt-0.5 truncate">
                    {#if table.location}{table.location} · {/if}{table.capacity} seats
                  </p>
                </div>
              </div>
              <!-- Alert badges -->
              <div class="flex flex-col items-end gap-1 shrink-0">
                {#if billReq}
                  <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                    Bill
                  </span>
                {/if}
                {#if pendingApproval}
                  <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-300 dark:ring-blue-700">
                    ⏳ Pending
                  </span>
                {/if}
              </div>
            </div>
          </div>

          <!-- Session info strip -->
          {#if hasSession}
            <div class="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              <span class="text-xs text-emerald-700 dark:text-emerald-400 font-medium truncate">
                {(table as any).customerName
                  ? `${(table as any).customerName}${(table as any).partySize ? ` · ${(table as any).partySize} guests` : ''}`
                  : 'Session active'}
              </span>
              <span class="ml-auto text-xs text-emerald-600 dark:text-emerald-500 shrink-0">
                {fmtTime((table as any).sessionStartedAt)}
              </span>
            </div>
          {/if}

          <!-- Primary actions row -->
          <div class="px-4 py-3 flex items-center gap-2">
            {#if pendingApproval}
              <!-- Session awaiting approval: Approve + Reject -->
              <button
                onclick={() => approveSession(table)}
                disabled={approvingSession[table.id]}
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
              >
                {approvingSession[table.id] ? '…' : '✓ Approve'}
              </button>
              <button
                onclick={() => endSession(table)}
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                Reject
              </button>
            {:else if hasSession}
              <!-- Active session: Print Bill + End Session -->
              <button
                onclick={() => printBill(table)}
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center justify-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                </svg>
                Print Bill
              </button>
              <button
                onclick={() => endSession(table)}
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-300 transition-colors"
              >
                End Session
              </button>
            {:else}
              <!-- No session: NFC Link + Get OTP -->
              <button
                onclick={() => showNfc(table)}
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors flex items-center justify-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
                NFC Link
              </button>
              <button
                onclick={() => generateOtp(table)}
                disabled={generatingOtp[table.id]}
                class="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 disabled:opacity-50 transition-colors"
              >
                {generatingOtp[table.id] ? '…' : 'Get OTP'}
              </button>
            {/if}
          </div>

          <!-- Footer: secondary actions -->
          <div class="px-4 pb-3 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 pt-2">
            <div class="flex items-center gap-2">
              {#if hasSession}
                <button
                  onclick={() => showNfc(table)}
                  class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                  title="NFC Link"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                  </svg>
                </button>
              {/if}
              <button
                onclick={() => openEdit(table)}
                class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button
                onclick={() => deleteTable(table.id)}
                class="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
            <button
              onclick={() => toggleActive(table)}
              class="text-xs font-medium {table.isActive
                ? 'text-neutral-400 hover:text-red-500'
                : 'text-emerald-500 hover:text-emerald-600'} transition-colors"
            >
              {table.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create/Edit Table Modal -->
<Modal bind:open={modalOpen} title={editId ? 'Edit Table' : 'Add Table'} size="sm">
  <form onsubmit={handleSave} class="space-y-4">
    <Input label="Table Name" bind:value={form.name} error={formErrors.name} required placeholder="Table 1, VIP Room..." />
    <Input label="Capacity (seats)" type="number" bind:value={form.capacity} min="1" max="50" />
    <Input label="Location" bind:value={form.location} placeholder="Ground floor, Patio..." />
    <div class="flex gap-3">
      <Button type="submit" loading={saving} class="flex-1">
        {editId ? 'Save' : 'Create'}
      </Button>
      <Button variant="outline" onclick={() => (modalOpen = false)} class="flex-1">Cancel</Button>
    </div>
  </form>
</Modal>

<!-- NFC Link Modal -->
{#if selectedTable}
  <Modal bind:open={nfcModalOpen} title="NFC Link - {selectedTable.name}" size="sm">
    <div class="space-y-4">
      <p class="text-sm text-neutral-600 dark:text-neutral-400">
        Program this URL or token into your NFC tag. When customers scan the tag, they will be taken to the menu for this table.
      </p>

      <div class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 break-all">
        <p class="text-xs font-mono text-neutral-700 dark:text-neutral-300">{getNfcUrl(selectedTable)}</p>
      </div>

      <div class="p-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600">
        <p class="text-xs text-neutral-500 dark:text-neutral-400 mb-1">NFC Token</p>
        <p class="text-sm font-mono text-neutral-700 dark:text-neutral-300 break-all">{selectedTable.nfcToken}</p>
      </div>

      <Button onclick={() => copyNfcUrl(selectedTable!)} class="w-full">Copy URL</Button>
    </div>
  </Modal>
{/if}

<!-- OTP Display Modal -->
<Modal bind:open={otpModalOpen} title="Table Code — {otpTableName}" size="sm">
  <div class="space-y-4 text-center">
    <p class="text-sm text-neutral-500 dark:text-neutral-400">Show or read this code to the customer. It expires in 10 minutes.</p>
    <div class="py-6 px-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800 border-2 border-dashed border-neutral-300 dark:border-neutral-600">
      <p class="text-5xl font-mono font-bold tracking-[0.4em] text-neutral-900 dark:text-neutral-100">{otpValue}</p>
    </div>
    <p class="text-xs text-neutral-400">The customer enters this code when they scan the NFC tag.</p>
    <Button onclick={() => { navigator.clipboard.writeText(otpValue); addToast('success', 'OTP copied.') }} class="w-full">Copy Code</Button>
  </div>
</Modal>
