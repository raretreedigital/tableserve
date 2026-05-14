<script lang="ts">
  import { goto } from '$app/navigation'
  import { authApi } from '$lib/api'
  import { authStore } from '$lib/stores/auth'
  import { addToast } from '$lib/stores/toast'
  import Input from '$lib/components/ui/Input.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte'

  let email = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state('')

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault()
    error = ''
    loading = true

    const { data, error: err } = await authApi.signIn(email, password)
    loading = false

    if (err) {
      error = err
      return
    }

    // Fetch session to verify superadmin role
    const { data: session } = await authApi.getSession()
    if (!session?.user) {
      error = 'Authentication failed.'
      return
    }

    if (session.user.role !== 'superadmin') {
      await authApi.signOut()
      error = 'This login is for super admins only.'
      return
    }

    authStore.setUser(session.user)
    addToast('success', `Welcome back, ${session.user.name}.`)
    goto('/superadmin')
  }
</script>

<svelte:head>
  <title>Super Admin Login - Table Serve</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
  <div class="absolute top-4 right-4">
    <ThemeToggle />
  </div>

  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <div class="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
        <span class="text-white font-bold">TS</span>
      </div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Super Admin</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">This login is for super admins only</p>
    </div>

    <div class="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
      <form onsubmit={handleLogin} class="space-y-4">
        {#if error}
          <div class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        {/if}

        <Input
          label="Email"
          type="email"
          bind:value={email}
          placeholder="admin@tableserve.app"
          required
          autocomplete="email"
        />

        <Input
          label="Password"
          type="password"
          bind:value={password}
          placeholder="Your password"
          required
          autocomplete="current-password"
        />

        <Button type="submit" {loading} class="w-full">
          Sign In
        </Button>
      </form>
    </div>

    <p class="text-center text-sm text-neutral-500 dark:text-neutral-400 mt-6">
      Need an account?
      <a href="/superadmin/register" class="text-brand-600 dark:text-brand-400 font-medium hover:underline">Register</a>
    </p>
  </div>
</div>
