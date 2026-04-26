<script lang="ts">
  import { page } from '$app/stores'
  import { onMount } from 'svelte'
  import { superAdminApi } from '$lib/api'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import Button from '$lib/components/ui/Button.svelte'

  const orgId = $derived($page.params.id)
  let data = $state<any>(null)
  let loading = $state(true)

  onMount(async () => {
    const res = await superAdminApi.getOrganization(orgId)
    if (res.data) data = res.data
    loading = false
  })

  async function activate() {
    const { error } = await superAdminApi.activateOrganization(orgId)
    if (error) { addToast('error', error); return }
    addToast('success', 'Organization activated.')
    data.organization.organization_profile.status = 'active'
  }

  async function suspend() {
    const reason = prompt('Reason for suspension:')
    if (!reason) return
    const { error } = await superAdminApi.suspendOrganization(orgId, reason)
    if (error) { addToast('error', error); return }
    addToast('success', 'Organization suspended.')
    data.organization.organization_profile.status = 'suspended'
  }
</script>

<svelte:head>
  <title>{data?.organization?.organization?.name ?? 'Organization'} - Super Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex items-center gap-3">
    <a href="/superadmin/organizations" class="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </a>
    <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
      {data?.organization?.organization?.name ?? 'Loading...'}
    </h1>
  </div>

  {#if loading}
    <div class="space-y-4">
      {#each Array(3) as _}
        <div class="h-32 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if data}
    {@const org = data.organization?.organization}
    {@const profile = data.organization?.organization_profile}
    {@const members = data.members ?? []}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Organization Details</h2>
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between">
            <dt class="text-neutral-500 dark:text-neutral-400">Name</dt>
            <dd class="font-medium text-neutral-900 dark:text-neutral-100">{org?.name}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-neutral-500 dark:text-neutral-400">Slug</dt>
            <dd class="font-medium text-neutral-900 dark:text-neutral-100">{org?.slug}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-neutral-500 dark:text-neutral-400">Status</dt>
            <dd>
              <Badge variant={profile?.status === 'active' ? 'success' : profile?.status === 'suspended' ? 'danger' : 'warning'}>
                {profile?.status}
              </Badge>
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-neutral-500 dark:text-neutral-400">Plan</dt>
            <dd>
              <Badge variant={profile?.subscriptionPlan === 'premium' ? 'brand' : profile?.subscriptionPlan === 'basic' ? 'info' : 'neutral'}>
                {profile?.subscriptionPlan}
              </Badge>
            </dd>
          </div>
          {#if profile?.email}
            <div class="flex justify-between">
              <dt class="text-neutral-500 dark:text-neutral-400">Email</dt>
              <dd class="font-medium text-neutral-900 dark:text-neutral-100">{profile.email}</dd>
            </div>
          {/if}
          {#if profile?.phone}
            <div class="flex justify-between">
              <dt class="text-neutral-500 dark:text-neutral-400">Phone</dt>
              <dd class="font-medium text-neutral-900 dark:text-neutral-100">{profile.phone}</dd>
            </div>
          {/if}
          <div class="flex justify-between">
            <dt class="text-neutral-500 dark:text-neutral-400">Created</dt>
            <dd class="font-medium text-neutral-900 dark:text-neutral-100">{new Date(org?.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>

        <div class="flex gap-2 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          {#if profile?.status === 'suspended'}
            <Button size="sm" variant="outline" onclick={activate}>Activate</Button>
          {:else}
            <Button size="sm" variant="danger" onclick={suspend}>Suspend</Button>
          {/if}
        </div>
      </Card>

      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Members ({members.length})</h2>
        {#if members.length === 0}
          <p class="text-sm text-neutral-500 dark:text-neutral-400">No members found.</p>
        {:else}
          <div class="space-y-3">
            {#each members as m}
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{m.name}</p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400">{m.email}</p>
                </div>
                <Badge variant="neutral">{m.role}</Badge>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>
  {/if}
</div>
