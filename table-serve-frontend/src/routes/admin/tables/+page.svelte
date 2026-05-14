<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import Input from '$lib/components/ui/Input.svelte'
  import type { RestaurantTable } from '$lib/types'

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
    if (!confirm('Delete this table?')) return
    const { error } = await adminApi.deleteTable(orgId, id)
    if (error) { addToast('error', error); return }
    addToast('success', 'Table deleted.')
    await load()
  }

  async function endSession(t: RestaurantTable) {
    if (!confirm(`End session for ${t.name}? This will mark all active orders as served and clear the bill request.`)) return
    const { error } = await adminApi.endTableSession(orgId, t.id)
    if (error) { addToast('error', error); return }
    addToast('success', `Session ended for ${t.name}.`)
    await load()
  }

  function showNfc(t: RestaurantTable) {
    selectedTable = t
    nfcModalOpen = true
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
        <Card>
          <div class="flex items-start justify-between mb-3">
            <div>
              <p class="font-semibold text-neutral-900 dark:text-neutral-100">{table.name}</p>
              {#if table.location}
                <p class="text-xs text-neutral-500 dark:text-neutral-400">{table.location}</p>
              {/if}
            </div>
            <div class="flex flex-col items-end gap-1">
              <Badge variant={table.isActive ? 'success' : 'danger'}>
                {table.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {#if (table as any).billRequested}
                <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Bill Requested
                </span>
              {/if}
            </div>
          </div>

          <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Capacity: {table.capacity}</p>

          <div class="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onclick={() => showNfc(table)}>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              NFC Link
            </Button>
            <Button size="sm" variant="outline" onclick={() => openEdit(table)}>Edit</Button>
            <Button size="sm" variant="ghost" onclick={() => toggleActive(table)}>
              {table.isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button size="sm" variant="secondary" onclick={() => endSession(table)}>End Session</Button>
            <Button size="sm" variant="danger" onclick={() => deleteTable(table.id)}>Delete</Button>
          </div>
        </Card>
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
