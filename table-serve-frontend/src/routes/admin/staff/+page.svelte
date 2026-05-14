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

  interface Member {
    id: string
    role: string
    createdAt: string
    userId: string
    name: string
    email: string
  }

  let orgId = $derived($activeOrgId)
  let members = $state<Member[]>([])
  let loading = $state(true)
  let modalOpen = $state(false)
  let saving = $state(false)
  let credentials = $state<{ email: string; password: string } | null>(null)
  let credModalOpen = $state(false)

  let form = $state({ name: '', email: '', role: 'member' })
  let formErrors = $state<Record<string, string>>({})

  onMount(async () => {
    await load()
  })

  async function load() {
    if (!orgId) { loading = false; return }
    loading = true
    const { data } = await adminApi.getMembers(orgId)
    if (data) members = (data as any).members ?? []
    loading = false
  }

  function openAdd() {
    form = { name: '', email: '', role: 'member' }
    formErrors = {}
    modalOpen = true
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required.'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required.'
    formErrors = e
    return Object.keys(e).length === 0
  }

  async function handleAdd(e: SubmitEvent) {
    e.preventDefault()
    if (!validate()) return
    saving = true
    const { data, error } = await adminApi.addMember(orgId, form)
    saving = false
    if (error) { addToast('error', error); return }
    const d = data as any
    if (d?.credentials) {
      credentials = d.credentials
      credModalOpen = true
    } else {
      addToast('success', 'Member added.')
    }
    modalOpen = false
    await load()
  }

  async function handleRemove(m: Member) {
    if (!confirm(`Remove ${m.name} from your organization?`)) return
    const { error } = await adminApi.removeMember(orgId, m.id)
    if (error) { addToast('error', error); return }
    addToast('success', 'Member removed.')
    await load()
  }

  function roleLabel(role: string) {
    return { owner: 'Owner', admin: 'Admin', member: 'Member' }[role] ?? role
  }

  function roleBadge(role: string): 'brand' | 'success' | 'info' {
    return role === 'owner' ? 'brand' : role === 'admin' ? 'success' : 'info'
  }

  function initials(name: string) {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    addToast('success', 'Copied to clipboard.')
  }
</script>

<svelte:head>
  <title>Staff - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Staff & Team</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
        Manage who has access to your admin panel. Members can view orders and menu; Admins can make changes.
      </p>
    </div>
    <Button onclick={openAdd}>Add Member</Button>
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(3) as _}
        <div class="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if members.length === 0}
    <Card>
      <p class="text-center text-neutral-500 dark:text-neutral-400 py-8">No team members yet.</p>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each members as m}
        <Card>
          <div class="flex items-center gap-4">
            <!-- Avatar -->
            <div class="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
              <span class="text-sm font-bold text-brand-700 dark:text-brand-400">{initials(m.name)}</span>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold text-neutral-900 dark:text-neutral-100">{m.name}</p>
                <Badge variant={roleBadge(m.role)}>{roleLabel(m.role)}</Badge>
              </div>
              <p class="text-sm text-neutral-500 dark:text-neutral-400">{m.email}</p>
              <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                Added {new Date(m.createdAt).toLocaleDateString()}
              </p>
            </div>

            <!-- Actions -->
            {#if m.role !== 'owner'}
              <Button size="sm" variant="danger" onclick={() => handleRemove(m)}>Remove</Button>
            {/if}
          </div>
        </Card>
      {/each}
    </div>

    <!-- Info box -->
    <Card>
      <h3 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Role Permissions</h3>
      <div class="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
        <div class="flex gap-2">
          <Badge variant="brand">Owner</Badge>
          <span>Full access including billing, deleting the organization, and managing all staff.</span>
        </div>
        <div class="flex gap-2">
          <Badge variant="success">Admin</Badge>
          <span>Can manage menu, tables, orders, categories, and settings. Cannot remove the owner.</span>
        </div>
        <div class="flex gap-2">
          <Badge variant="info">Member</Badge>
          <span>Read-only access to orders, dashboard, and menu. Cannot make changes.</span>
        </div>
      </div>
    </Card>
  {/if}
</div>

<!-- Add Member Modal -->
<Modal bind:open={modalOpen} title="Add Staff Member" size="sm">
  <form onsubmit={handleAdd} class="space-y-4">
    <Input label="Full Name" bind:value={form.name} error={formErrors.name} required placeholder="Jane Smith" />
    <Input label="Email Address" type="email" bind:value={form.email} error={formErrors.email} required placeholder="jane@example.com" />

    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Role</label>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="p-3 rounded-lg border-2 text-left transition-colors {form.role === 'member' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-neutral-200 dark:border-neutral-700'}"
          onclick={() => (form.role = 'member')}
        >
          <p class="font-medium text-sm text-neutral-900 dark:text-neutral-100">Member</p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">View only</p>
        </button>
        <button
          type="button"
          class="p-3 rounded-lg border-2 text-left transition-colors {form.role === 'admin' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-neutral-200 dark:border-neutral-700'}"
          onclick={() => (form.role = 'admin')}
        >
          <p class="font-medium text-sm text-neutral-900 dark:text-neutral-100">Admin</p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Full edit access</p>
        </button>
      </div>
    </div>

    <p class="text-xs text-neutral-500 dark:text-neutral-400">
      If this email doesn't have an account yet, one will be created automatically and temporary login credentials will be shown once.
    </p>

    <div class="flex gap-3">
      <Button type="submit" loading={saving} class="flex-1">Add Member</Button>
      <Button variant="outline" onclick={() => (modalOpen = false)} class="flex-1">Cancel</Button>
    </div>
  </form>
</Modal>

<!-- Credentials Modal (shown once) -->
{#if credentials}
  <Modal bind:open={credModalOpen} title="Login Credentials" size="sm">
    <div class="space-y-4">
      <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <p class="text-sm font-medium text-amber-700 dark:text-amber-400">⚠ Save these now — they cannot be shown again.</p>
      </div>

      <div class="space-y-3">
        <div>
          <p class="text-xs text-neutral-500 mb-1">Email</p>
          <div class="flex items-center gap-2 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <p class="font-mono text-sm flex-1 text-neutral-900 dark:text-neutral-100">{credentials.email}</p>
            <button onclick={() => copyToClipboard(credentials!.email)} class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        <div>
          <p class="text-xs text-neutral-500 mb-1">Temporary Password</p>
          <div class="flex items-center gap-2 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <p class="font-mono text-sm flex-1 text-neutral-900 dark:text-neutral-100 break-all">{credentials.password}</p>
            <button onclick={() => copyToClipboard(credentials!.password)} class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <Button onclick={() => { credModalOpen = false; credentials = null }} class="w-full">Done</Button>
    </div>
  </Modal>
{/if}
