<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Input from '$lib/components/ui/Input.svelte'

  let orgId = $derived($activeOrgId)

  // Change password
  let pwForm = $state({ currentPassword: '', newPassword: '', confirmPassword: '' })
  let pwErrors = $state<Record<string, string>>({})
  let pwSaving = $state(false)

  // Sessions
  let sessions = $state<any[]>([])
  let sessionsLoading = $state(true)
  let revokingAll = $state(false)
  let revoking = $state<Record<string, boolean>>({})

  onMount(async () => {
    await loadSessions()
  })

  async function loadSessions() {
    if (!orgId) return
    sessionsLoading = true
    const { data } = await adminApi.getSessions(orgId)
    if (data) sessions = (data as any).sessions ?? []
    sessionsLoading = false
  }

  async function handleChangePassword(e: SubmitEvent) {
    e.preventDefault()
    pwErrors = {}
    if (!pwForm.currentPassword) pwErrors.current = 'Required'
    if (pwForm.newPassword.length < 8) pwErrors.new = 'Min 8 characters'
    if (pwForm.newPassword !== pwForm.confirmPassword) pwErrors.confirm = 'Passwords do not match'
    if (Object.keys(pwErrors).length) return

    pwSaving = true
    const { error } = await adminApi.changePassword(orgId, {
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    })
    pwSaving = false

    if (error) { addToast('error', error); return }
    addToast('success', 'Password changed successfully.')
    pwForm = { currentPassword: '', newPassword: '', confirmPassword: '' }
  }

  async function revokeSession(token: string) {
    revoking[token] = true
    const { error } = await adminApi.revokeSession(orgId, token)
    revoking[token] = false
    if (error) { addToast('error', error); return }
    addToast('success', 'Session revoked.')
    await loadSessions()
  }

  async function revokeAll() {
    if (!confirm('Sign out of all other devices?')) return
    revokingAll = true
    const { error } = await adminApi.revokeAllOtherSessions(orgId)
    revokingAll = false
    if (error) { addToast('error', error); return }
    addToast('success', 'All other sessions revoked.')
    await loadSessions()
  }

  function deviceLabel(session: any) {
    const ua = session.userAgent ?? ''
    if (ua.includes('iPhone') || ua.includes('iPad')) return '📱 iOS'
    if (ua.includes('Android')) return '📱 Android'
    if (ua.includes('Mac')) return '💻 Mac'
    if (ua.includes('Windows')) return '🖥️ Windows'
    if (ua.includes('Linux')) return '🐧 Linux'
    return '🌐 Browser'
  }
</script>

<svelte:head>
  <title>Security - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Security</h1>
    <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Manage your password and active sessions.</p>
  </div>

  <!-- Change Password -->
  <Card>
    <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Change Password</h2>
    <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Use a strong, unique password for your account.</p>

    <form onsubmit={handleChangePassword} class="space-y-4 max-w-sm">
      <Input
        label="Current Password"
        type="password"
        bind:value={pwForm.currentPassword}
        error={pwErrors.current}
        autocomplete="current-password"
        required
      />
      <Input
        label="New Password"
        type="password"
        bind:value={pwForm.newPassword}
        error={pwErrors.new}
        autocomplete="new-password"
        hint="Minimum 8 characters"
        required
      />
      <Input
        label="Confirm New Password"
        type="password"
        bind:value={pwForm.confirmPassword}
        error={pwErrors.confirm}
        autocomplete="new-password"
        required
      />
      <Button type="submit" loading={pwSaving}>Update Password</Button>
    </form>
  </Card>

  <!-- Active Sessions -->
  <Card>
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100">Active Sessions</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">These devices are signed in to your account.</p>
      </div>
      {#if sessions.length > 1}
        <Button variant="danger" size="sm" loading={revokingAll} onclick={revokeAll}>
          Sign out all other devices
        </Button>
      {/if}
    </div>

    {#if sessionsLoading}
      <div class="space-y-3">
        {#each Array(3) as _}
          <div class="h-16 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
        {/each}
      </div>
    {:else if sessions.length === 0}
      <p class="text-sm text-neutral-500 dark:text-neutral-400 py-4">No active sessions found.</p>
    {:else}
      <div class="space-y-2">
        {#each sessions as session}
          <div class="flex items-center justify-between gap-4 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{deviceLabel(session)}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                {session.ipAddress ?? 'Unknown IP'}
                {#if session.createdAt}
                  &nbsp;·&nbsp; Signed in {new Date(session.createdAt).toLocaleString()}
                {/if}
              </p>
              {#if session.current}
                <span class="text-xs text-green-600 dark:text-green-400 font-medium">Current session</span>
              {/if}
            </div>
            {#if !session.current}
              <Button
                size="sm"
                variant="danger"
                loading={revoking[session.token]}
                onclick={() => revokeSession(session.token)}
              >
                Revoke
              </Button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- Security Tips -->
  <Card>
    <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Security Best Practices</h2>
    <ul class="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
      <li class="flex items-start gap-2">
        <span class="text-green-500 mt-0.5">✓</span>
        Use a unique password not used on any other site.
      </li>
      <li class="flex items-start gap-2">
        <span class="text-green-500 mt-0.5">✓</span>
        Regularly review active sessions and revoke any you don't recognize.
      </li>
      <li class="flex items-start gap-2">
        <span class="text-green-500 mt-0.5">✓</span>
        Never share your admin credentials with waiters — use the Waiters section to create staff accounts.
      </li>
      <li class="flex items-start gap-2">
        <span class="text-green-500 mt-0.5">✓</span>
        Sign out when using shared or public computers.
      </li>
      <li class="flex items-start gap-2">
        <span class="text-green-500 mt-0.5">✓</span>
        Waiter passwords are auto-generated and shown only once — reset them if compromised.
      </li>
    </ul>
  </Card>
</div>
