<script lang="ts">
  import { goto } from '$app/navigation'
  import { superAdminApi } from '$lib/api'
  import { addToast } from '$lib/stores/toast'
  import Input from '$lib/components/ui/Input.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte'

  let name = $state('')
  let email = $state('')
  let password = $state('')
  let confirmPassword = $state('')
  let masterPassword = $state('')
  let loading = $state(false)
  let errors = $state<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim() || name.length < 2) e.name = 'Name must be at least 2 characters.'
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email.'
    if (!password || password.length < 8) e.password = 'Password must be at least 8 characters.'
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match.'
    if (!masterPassword) e.masterPassword = 'Master password is required.'
    errors = e
    return Object.keys(e).length === 0
  }

  async function handleRegister(e: SubmitEvent) {
    e.preventDefault()
    if (!validate()) return
    loading = true

    const { error } = await superAdminApi.register({ name, email, password, masterPassword })
    loading = false

    if (error) {
      errors.general = error
      return
    }

    addToast('success', 'Super admin account created. Please sign in.')
    goto('/superadmin/login')
  }
</script>

<svelte:head>
  <title>Register Super Admin - Table Serve</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-12">
  <div class="absolute top-4 right-4">
    <ThemeToggle />
  </div>

  <div class="w-full max-w-sm">
    <div class="text-center mb-8">
      <div class="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
        <span class="text-white font-bold">TS</span>
      </div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Create Super Admin</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Requires the platform master password</p>
    </div>

    <div class="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 shadow-sm">
      <form onsubmit={handleRegister} class="space-y-4">
        {#if errors.general}
          <div class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p class="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
          </div>
        {/if}

        <Input label="Full Name" bind:value={name} error={errors.name} required placeholder="Jane Smith" />
        <Input label="Email" type="email" bind:value={email} error={errors.email} required placeholder="jane@tableserve.app" />
        <Input label="Password" type="password" bind:value={password} error={errors.password} required placeholder="Min 8 characters" />
        <Input label="Confirm Password" type="password" bind:value={confirmPassword} error={errors.confirmPassword} required placeholder="Repeat password" />

        <div class="pt-2 border-t border-neutral-200 dark:border-neutral-700">
          <Input
            label="Master Password"
            type="password"
            bind:value={masterPassword}
            error={errors.masterPassword}
            required
            placeholder="Platform master password"
            hint="Provided by your system administrator."
          />
        </div>

        <Button type="submit" {loading} class="w-full">
          Create Account
        </Button>
      </form>
    </div>

    <p class="text-center text-sm text-neutral-500 dark:text-neutral-400 mt-6">
      Already have an account?
      <a href="/superadmin/login" class="text-brand-600 dark:text-brand-400 font-medium hover:underline">Sign in</a>
    </p>
  </div>
</div>
