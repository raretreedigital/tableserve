<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { superAdminApi } from '$lib/api'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import Input from '$lib/components/ui/Input.svelte'
  import Select from '$lib/components/ui/Select.svelte'

  interface Org {
    id: string
    name: string
    slug: string
    createdAt: string
    status: string
    subscriptionPlan: string
    subscriptionExpiry?: string
    email?: string
    phone?: string
  }

  let orgs = $state<Org[]>([])
  let loading = $state(true)
  let search = $state('')
  let filterStatus = $state('')

  // Create org modal
  let createOpen = $state(false)
  let creating = $state(false)
  let createForm = $state({
    name: '', slug: '', ownerEmail: '', ownerName: '', ownerPassword: '',
  })
  let createErrors = $state<Record<string, string>>({})

  // Suspend modal
  let suspendId = $state('')
  let suspendReason = $state('')
  let suspending = $state(false)
  let suspendOpen = $state(false)

  // Subscription modal
  let subId = $state('')
  let subPlan = $state('free')
  let subDays = $state('')
  let subOpen = $state(false)
  let subLoading = $state(false)

  onMount(async () => {
    await loadOrgs()
  })

  async function loadOrgs() {
    loading = true
    const { data } = await superAdminApi.getOrganizations()
    if (data) orgs = (data as any).organizations ?? []
    loading = false
  }

  let filtered = $derived(
    orgs.filter((o) => {
      const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.toLowerCase().includes(search.toLowerCase())
      const matchStatus = !filterStatus || o.status === filterStatus
      return matchSearch && matchStatus
    })
  )

  function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'active') return 'success'
    if (status === 'trial') return 'warning'
    if (status === 'suspended') return 'danger'
    return 'neutral'
  }

  function planVariant(plan: string): 'neutral' | 'info' | 'brand' {
    if (plan === 'basic') return 'info'
    if (plan === 'premium') return 'brand'
    return 'neutral'
  }

  function slugify(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault()
    createErrors = {}
    if (!createForm.name) createErrors.name = 'Required'
    if (!createForm.slug) createErrors.slug = 'Required'
    if (!createForm.ownerEmail) createErrors.ownerEmail = 'Required'
    if (!createForm.ownerName) createErrors.ownerName = 'Required'
    if (!createForm.ownerPassword || createForm.ownerPassword.length < 8) createErrors.ownerPassword = 'Min 8 characters'
    if (Object.keys(createErrors).length > 0) return

    creating = true
    const { error } = await superAdminApi.createOrganization(createForm)
    creating = false
    if (error) { addToast('error', error); return }
    addToast('success', 'Organization created.')
    createOpen = false
    createForm = { name: '', slug: '', ownerEmail: '', ownerName: '', ownerPassword: '' }
    await loadOrgs()
  }

  async function handleSuspend(e: SubmitEvent) {
    e.preventDefault()
    suspending = true
    const { error } = await superAdminApi.suspendOrganization(suspendId, suspendReason)
    suspending = false
    if (error) { addToast('error', error); return }
    addToast('success', 'Organization suspended.')
    suspendOpen = false
    suspendReason = ''
    await loadOrgs()
  }

  async function activate(id: string) {
    const { error } = await superAdminApi.activateOrganization(id)
    if (error) { addToast('error', error); return }
    addToast('success', 'Organization activated.')
    await loadOrgs()
  }

  async function handleUpdateSub(e: SubmitEvent) {
    e.preventDefault()
    subLoading = true
    const { error } = await superAdminApi.updateSubscription(subId, {
      plan: subPlan,
      expiryDays: subDays ? parseInt(subDays) : undefined,
    })
    subLoading = false
    if (error) { addToast('error', error); return }
    addToast('success', 'Subscription updated.')
    subOpen = false
    await loadOrgs()
  }
</script>

<svelte:head>
  <title>Organizations - Super Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Organizations</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{orgs.length} total</p>
    </div>
    <Button onclick={() => (createOpen = true)}>Add Organization</Button>
  </div>

  <!-- Filters -->
  <div class="flex flex-col sm:flex-row gap-3">
    <input
      type="search"
      bind:value={search}
      placeholder="Search by name or slug..."
      class="h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 flex-1"
    />
    <select
      bind:value={filterStatus}
      class="h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      <option value="">All statuses</option>
      <option value="active">Active</option>
      <option value="trial">Trial</option>
      <option value="suspended">Suspended</option>
      <option value="inactive">Inactive</option>
    </select>
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(5) as _}
        <div class="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if filtered.length === 0}
    <Card>
      <p class="text-center text-neutral-500 dark:text-neutral-400 py-8">No organizations found.</p>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each filtered as org}
        <Card padding={false}>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-semibold text-neutral-900 dark:text-neutral-100">{org.name}</h3>
                <Badge variant={statusVariant(org.status)}>{org.status}</Badge>
                <Badge variant={planVariant(org.subscriptionPlan)}>{org.subscriptionPlan}</Badge>
              </div>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                {org.slug} {#if org.email} &middot; {org.email}{/if}
              </p>
              <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                Created {new Date(org.createdAt).toLocaleDateString()}
                {#if org.subscriptionExpiry}
                  &middot; Expires {new Date(org.subscriptionExpiry).toLocaleDateString()}
                {/if}
              </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onclick={() => goto(`/superadmin/organizations/${org.id}`)}
              >
                View
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onclick={() => { subId = org.id; subPlan = org.subscriptionPlan; subDays = ''; subOpen = true }}
              >
                Subscription
              </Button>
              {#if org.status === 'suspended'}
                <Button size="sm" variant="outline" onclick={() => activate(org.id)}>Activate</Button>
              {:else}
                <Button
                  size="sm"
                  variant="danger"
                  onclick={() => { suspendId = org.id; suspendOpen = true }}
                >
                  Suspend
                </Button>
              {/if}
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Create Organization Modal -->
<Modal bind:open={createOpen} title="Add Organization" size="md">
  <form onsubmit={handleCreate} class="space-y-4">
    <Input label="Organization Name" bind:value={createForm.name} error={createErrors.name} required
      oninput={() => { createForm.slug = slugify(createForm.name) }} />
    <Input label="Slug" bind:value={createForm.slug} error={createErrors.slug} required
      hint="Used in URLs. Lowercase letters, numbers, hyphens only." />
    <div class="pt-2 border-t border-neutral-200 dark:border-neutral-700">
      <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Owner Account</p>
      <div class="space-y-3">
        <Input label="Owner Name" bind:value={createForm.ownerName} error={createErrors.ownerName} required />
        <Input label="Owner Email" type="email" bind:value={createForm.ownerEmail} error={createErrors.ownerEmail} required />
        <Input label="Owner Password" type="password" bind:value={createForm.ownerPassword} error={createErrors.ownerPassword} required hint="Min 8 characters" />
      </div>
    </div>
    <div class="flex gap-3 pt-2">
      <Button type="submit" loading={creating} class="flex-1">Create</Button>
      <Button variant="outline" onclick={() => (createOpen = false)} class="flex-1">Cancel</Button>
    </div>
  </form>
</Modal>

<!-- Suspend Modal -->
<Modal bind:open={suspendOpen} title="Suspend Organization" size="sm">
  <form onsubmit={handleSuspend} class="space-y-4">
    <p class="text-sm text-neutral-600 dark:text-neutral-400">
      This will prevent the restaurant from accepting new orders and block their admin access.
    </p>
    <Input
      label="Reason"
      bind:value={suspendReason}
      required
      placeholder="Reason for suspension..."
    />
    <div class="flex gap-3">
      <Button type="submit" variant="danger" loading={suspending} class="flex-1">Suspend</Button>
      <Button variant="outline" onclick={() => (suspendOpen = false)} class="flex-1">Cancel</Button>
    </div>
  </form>
</Modal>

<!-- Subscription Modal -->
<Modal bind:open={subOpen} title="Update Subscription" size="sm">
  <form onsubmit={handleUpdateSub} class="space-y-4">
    <Select
      label="Plan"
      bind:value={subPlan}
      options={[
        { value: 'free', label: 'Free (1 table, 20 items)' },
        { value: 'basic', label: 'Basic (10 tables, 100 items)' },
        { value: 'premium', label: 'Premium (unlimited)' },
      ]}
    />
    <Input
      label="Expiry (days from now)"
      type="number"
      bind:value={subDays}
      min="1"
      placeholder="Leave blank to keep current"
    />
    <div class="flex gap-3">
      <Button type="submit" loading={subLoading} class="flex-1">Update</Button>
      <Button variant="outline" onclick={() => (subOpen = false)} class="flex-1">Cancel</Button>
    </div>
  </form>
</Modal>
