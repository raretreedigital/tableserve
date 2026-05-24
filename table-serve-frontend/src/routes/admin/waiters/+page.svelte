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

  let orgId = $derived($activeOrgId)
  let waiters = $state<any[]>([])
  let tables = $state<any[]>([])
  let loading = $state(true)
  let modalOpen = $state(false)
  let saving = $state(false)
  let credentialsModal = $state(false)
  let credentials = $state<{ email: string; password: string } | null>(null)
  let regenLoading = $state(false)

  let form = $state({ name: '', email: '', tableIds: [] as string[] })
  let formErrors = $state<Record<string, string>>({})

  onMount(async () => {
    await load()
  })

  async function load() {
    if (!orgId) { loading = false; return }
    loading = true
    const [w, t] = await Promise.all([
      adminApi.getWaiters(orgId),
      adminApi.getTables(orgId),
    ])
    if (w.data) waiters = (w.data as any) ?? []
    if (t.data) tables = (t.data as any).tables ?? []
    loading = false
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault()
    formErrors = {}
    if (!form.name.trim()) formErrors.name = 'Required'
    if (!form.email.trim()) formErrors.email = 'Required'
    if (Object.keys(formErrors).length) return

    saving = true
    const { data, error } = await adminApi.createWaiter(orgId, {
      name: form.name,
      email: form.email,
      tableIds: form.tableIds,
    })
    saving = false

    if (error) { addToast('error', error); return }

    credentials = (data as any).credentials
    modalOpen = false
    credentialsModal = true
    form = { name: '', email: '', tableIds: [] }
    await load()
  }

  async function toggleActive(w: any) {
    const { error } = await adminApi.updateWaiter(orgId, w.id, { isActive: !w.isActive })
    if (error) { addToast('error', error); return }
    addToast('success', w.isActive ? 'Waiter deactivated.' : 'Waiter activated.')
    await load()
  }

  async function regen(id: string) {
    if (!await showConfirm({ title: 'Regenerate credentials', message: 'The old password will stop working immediately.', confirmLabel: 'Regenerate', variant: 'warning' })) return
    regenLoading = true
    const { data, error } = await adminApi.regenerateCredentials(orgId, id)
    regenLoading = false
    if (error) { addToast('error', error); return }
    credentials = (data as any).credentials
    credentialsModal = true
  }

  function toggleTable(id: string) {
    if (form.tableIds.includes(id)) {
      form.tableIds = form.tableIds.filter(t => t !== id)
    } else {
      form.tableIds = [...form.tableIds, id]
    }
  }
</script>

<svelte:head>
  <title>Waiters - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Waiters</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Manage staff accounts and table assignments.</p>
    </div>
    <Button onclick={() => { form = { name: '', email: '', tableIds: [] }; formErrors = {}; modalOpen = true }}>Add Waiter</Button>
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _}
        <div class="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if waiters.length === 0}
    <Card>
      <div class="text-center py-10">
        <p class="text-neutral-500 dark:text-neutral-400 mb-4">No waiters yet. Add your first staff member.</p>
        <Button onclick={() => (modalOpen = true)}>Add Waiter</Button>
      </div>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each waiters as w}
        <Card padding={false}>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-semibold text-neutral-900 dark:text-neutral-100">{w.name}</span>
                <Badge variant={w.isActive ? 'success' : 'danger'}>{w.isActive ? 'Active' : 'Inactive'}</Badge>
                {#if w.dutyStatus}
                  <Badge variant={w.dutyStatus === 'on_duty' ? 'info' : 'neutral'}>{w.dutyStatus === 'on_duty' ? 'On Duty' : 'Off Duty'}</Badge>
                {/if}
              </div>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{w.email}</p>
              {#if w.tableIds?.length}
                <p class="text-xs text-neutral-400 mt-0.5">
                  Tables: {w.tableIds.map((id: string) => tables.find(t => t.id === id)?.name ?? id).join(', ')}
                </p>
              {:else}
                <p class="text-xs text-neutral-400 mt-0.5">No tables assigned</p>
              {/if}
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onclick={() => toggleActive(w)}>
                {w.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="sm" variant="secondary" loading={regenLoading} onclick={() => regen(w.id)}>
                Reset Password
              </Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Waiter Modal -->
<Modal bind:open={modalOpen} title="Add Waiter" size="md">
  <form onsubmit={handleCreate} class="space-y-4">
    <Input label="Full Name" bind:value={form.name} error={formErrors.name} required />
    <Input label="Email" type="email" bind:value={form.email} error={formErrors.email} required />

    {#if tables.length > 0}
      <div>
        <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Assign Tables (optional)</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {#each tables.filter(t => t.isActive) as t}
            <label class="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <input
                type="checkbox"
                checked={form.tableIds.includes(t.id)}
                onchange={() => toggleTable(t.id)}
                class="accent-brand-600 w-4 h-4"
              />
              {t.name}
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <p class="text-xs text-neutral-500 dark:text-neutral-400 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
      ⚠️ A password will be auto-generated and shown once. Make sure to copy it before closing.
    </p>

    <div class="flex gap-3">
      <Button type="submit" loading={saving} class="flex-1">Create Waiter</Button>
      <Button variant="outline" onclick={() => (modalOpen = false)} class="flex-1">Cancel</Button>
    </div>
  </form>
</Modal>

<!-- Credentials Modal (shown once) -->
<Modal bind:open={credentialsModal} title="Waiter Credentials" size="sm">
  {#if credentials}
    <div class="space-y-4">
      <div class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
        ⚠️ Copy these credentials now. They will not be shown again.
      </div>
      <div class="space-y-2">
        <div class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
          <p class="text-xs text-neutral-500 mb-1">Email</p>
          <p class="font-mono text-sm text-neutral-900 dark:text-neutral-100 break-all">{credentials.email}</p>
        </div>
        <div class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
          <p class="text-xs text-neutral-500 mb-1">Password</p>
          <p class="font-mono text-sm text-neutral-900 dark:text-neutral-100 break-all">{credentials.password}</p>
        </div>
      </div>
      <Button
        class="w-full"
        onclick={() => {
          navigator.clipboard.writeText(`Email: ${credentials!.email}\nPassword: ${credentials!.password}`)
          addToast('success', 'Credentials copied.')
        }}
      >Copy to Clipboard</Button>
      <Button variant="outline" class="w-full" onclick={() => { credentialsModal = false; credentials = null }}>Done</Button>
    </div>
  {/if}
</Modal>
