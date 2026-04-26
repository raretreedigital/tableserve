<script lang="ts">
  import { onMount } from 'svelte'
  import { superAdminApi } from '$lib/api'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import Input from '$lib/components/ui/Input.svelte'

  interface UserRow {
    id: string
    name: string
    email: string
    role: string
    banned: boolean
    banReason?: string
    createdAt: string
  }

  let users = $state<UserRow[]>([])
  let loading = $state(true)
  let search = $state('')
  let banUserId = $state('')
  let banReason = $state('')
  let banOpen = $state(false)
  let banning = $state(false)

  onMount(async () => {
    const { data } = await superAdminApi.getUsers()
    if (data) users = (data as any).users ?? []
    loading = false
  })

  let filtered = $derived(
    users.filter((u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    )
  )

  async function handleBan(e: SubmitEvent) {
    e.preventDefault()
    banning = true
    const { error } = await superAdminApi.banUser(banUserId, banReason || undefined)
    banning = false
    if (error) { addToast('error', error); return }
    addToast('success', 'User banned.')
    banOpen = false
    users = users.map((u) => u.id === banUserId ? { ...u, banned: true, banReason } : u)
  }

  async function handleUnban(id: string) {
    const { error } = await superAdminApi.unbanUser(id)
    if (error) { addToast('error', error); return }
    addToast('success', 'User unbanned.')
    users = users.map((u) => u.id === id ? { ...u, banned: false, banReason: undefined } : u)
  }
</script>

<svelte:head>
  <title>Users - Super Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Users</h1>
    <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{users.length} total users</p>
  </div>

  <input
    type="search"
    bind:value={search}
    placeholder="Search by name or email..."
    class="h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm w-full max-w-md text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
  />

  {#if loading}
    <div class="space-y-3">
      {#each Array(5) as _}
        <div class="h-16 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else}
    <Card padding={false}>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-200 dark:border-neutral-700">
              <th class="text-left p-4 font-medium text-neutral-500 dark:text-neutral-400">User</th>
              <th class="text-left p-4 font-medium text-neutral-500 dark:text-neutral-400">Role</th>
              <th class="text-left p-4 font-medium text-neutral-500 dark:text-neutral-400">Status</th>
              <th class="text-left p-4 font-medium text-neutral-500 dark:text-neutral-400">Joined</th>
              <th class="text-right p-4 font-medium text-neutral-500 dark:text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filtered as u}
              <tr class="border-b border-neutral-100 dark:border-neutral-800 last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <td class="p-4">
                  <p class="font-medium text-neutral-900 dark:text-neutral-100">{u.name}</p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400">{u.email}</p>
                </td>
                <td class="p-4">
                  <Badge variant={u.role === 'superadmin' ? 'brand' : 'neutral'}>{u.role}</Badge>
                </td>
                <td class="p-4">
                  {#if u.banned}
                    <Badge variant="danger">Banned</Badge>
                  {:else}
                    <Badge variant="success">Active</Badge>
                  {/if}
                </td>
                <td class="p-4 text-neutral-500 dark:text-neutral-400">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td class="p-4 text-right">
                  {#if u.banned}
                    <Button size="sm" variant="outline" onclick={() => handleUnban(u.id)}>Unban</Button>
                  {:else if u.role !== 'superadmin'}
                    <Button
                      size="sm"
                      variant="danger"
                      onclick={() => { banUserId = u.id; banReason = ''; banOpen = true }}
                    >
                      Ban
                    </Button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</div>

<Modal bind:open={banOpen} title="Ban User" size="sm">
  <form onsubmit={handleBan} class="space-y-4">
    <Input label="Reason (optional)" bind:value={banReason} placeholder="Reason for ban..." />
    <div class="flex gap-3">
      <Button type="submit" variant="danger" loading={banning} class="flex-1">Ban User</Button>
      <Button variant="outline" onclick={() => (banOpen = false)} class="flex-1">Cancel</Button>
    </div>
  </form>
</Modal>
