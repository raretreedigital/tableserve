<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Input from '$lib/components/ui/Input.svelte'
  import Select from '$lib/components/ui/Select.svelte'
  import Textarea from '$lib/components/ui/Textarea.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import type { OrganizationProfile } from '$lib/types'

  let orgId = $derived($activeOrgId)
  let profile = $state<OrganizationProfile | null>(null)
  let orgName = $state('')
  let loading = $state(true)
  let saving = $state(false)

  const fontOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Poppins', label: 'Poppins' },
    { value: 'Playfair Display', label: 'Playfair Display' },
    { value: 'Lato', label: 'Lato' },
    { value: 'Montserrat', label: 'Montserrat' },
  ]

  let form = $state({
    address: '',
    phone: '',
    email: '',
    website: '',
    description: '',
    primaryColor: '#1a1a1a',
    secondaryColor: '#f5f5f5',
    accentColor: '#e85d04',
    fontFamily: 'Inter',
    bannerUrl: '',
    menuLayout: 'grid',
    showCalories: true,
    showAllergens: true,
    showPreparationTime: true,
    showSpiceLevel: true,
    currencySymbol: '$',
    currencyCode: 'USD',
    taxRate: '0',
    serviceChargeRate: '0',
    welcomeMessage: '',
    footerText: '',
    instagramUrl: '',
    facebookUrl: '',
    twitterUrl: '',
  })

  onMount(async () => {
    const stored = localStorage.getItem('adminOrgId')
    if (stored) activeOrgId.set(stored)
    await load()
  })

  async function load() {
    if (!orgId) { loading = false; return }
    const { data } = await adminApi.getProfile(orgId)
    if (data) {
      const d = data as any
      orgName = d.organization?.name ?? ''
      const p: OrganizationProfile = d.organization_profile
      if (p) {
        profile = p
        form = {
          address: p.address ?? '',
          phone: p.phone ?? '',
          email: p.email ?? '',
          website: p.website ?? '',
          description: p.description ?? '',
          primaryColor: p.primaryColor,
          secondaryColor: p.secondaryColor,
          accentColor: p.accentColor,
          fontFamily: p.fontFamily,
          bannerUrl: p.bannerUrl ?? '',
          menuLayout: p.menuLayout,
          showCalories: p.showCalories,
          showAllergens: p.showAllergens,
          showPreparationTime: p.showPreparationTime,
          showSpiceLevel: p.showSpiceLevel,
          currencySymbol: p.currencySymbol,
          currencyCode: p.currencyCode,
          taxRate: p.taxRate,
          serviceChargeRate: p.serviceChargeRate,
          welcomeMessage: p.welcomeMessage ?? '',
          footerText: p.footerText ?? '',
          instagramUrl: (p.socialLinks as any)?.instagram ?? '',
          facebookUrl: (p.socialLinks as any)?.facebook ?? '',
          twitterUrl: (p.socialLinks as any)?.twitter ?? '',
        }
      }
    }
    loading = false
  }

  async function handleSave(e: SubmitEvent) {
    e.preventDefault()
    saving = true

    const payload = {
      address: form.address || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      description: form.description || undefined,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      accentColor: form.accentColor,
      fontFamily: form.fontFamily,
      bannerUrl: form.bannerUrl || undefined,
      menuLayout: form.menuLayout,
      showCalories: form.showCalories,
      showAllergens: form.showAllergens,
      showPreparationTime: form.showPreparationTime,
      showSpiceLevel: form.showSpiceLevel,
      currencySymbol: form.currencySymbol,
      currencyCode: form.currencyCode,
      taxRate: parseFloat(form.taxRate),
      serviceChargeRate: parseFloat(form.serviceChargeRate),
      welcomeMessage: form.welcomeMessage || undefined,
      footerText: form.footerText || undefined,
      socialLinks: {
        instagram: form.instagramUrl || undefined,
        facebook: form.facebookUrl || undefined,
        twitter: form.twitterUrl || undefined,
      },
    }

    const { error } = await adminApi.updateProfile(orgId, payload)
    saving = false
    if (error) { addToast('error', error); return }
    addToast('success', 'Settings saved.')
    await load()
  }
</script>

<svelte:head>
  <title>Settings - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div>
    <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Settings</h1>
    <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Customize your restaurant's menu and branding.</p>
  </div>

  {#if loading}
    <div class="space-y-4">
      {#each Array(4) as _}
        <div class="h-32 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else}
    <form onsubmit={handleSave} class="space-y-6">
      <!-- Subscription -->
      {#if profile}
        <Card>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-semibold text-neutral-900 dark:text-neutral-100">Subscription</h2>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Your current plan and limits.</p>
            </div>
            <div class="flex items-center gap-2">
              <Badge variant={profile.subscriptionPlan === 'premium' ? 'brand' : profile.subscriptionPlan === 'basic' ? 'info' : 'neutral'}>
                {profile.subscriptionPlan}
              </Badge>
              <Badge variant={profile.status === 'active' ? 'success' : profile.status === 'trial' ? 'warning' : 'danger'}>
                {profile.status}
              </Badge>
            </div>
          </div>
          {#if profile.subscriptionExpiry}
            <p class="text-xs text-neutral-500 mt-3">Expires: {new Date(profile.subscriptionExpiry).toLocaleDateString()}</p>
          {/if}
        </Card>
      {/if}

      <!-- Restaurant Info -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Restaurant Information</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Restaurant Name" value={orgName} disabled hint="Contact support to change." />
          <Input label="Contact Email" type="email" bind:value={form.email} />
          <Input label="Phone" type="tel" bind:value={form.phone} />
          <Input label="Website" type="url" bind:value={form.website} />
          <Textarea label="Address" bind:value={form.address} rows={2} class="sm:col-span-2" />
          <Textarea label="Description" bind:value={form.description} rows={3} class="sm:col-span-2" />
        </div>
      </Card>

      <!-- Branding -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Branding</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Primary Color</label>
            <div class="flex gap-2">
              <input type="color" bind:value={form.primaryColor} class="h-10 w-14 rounded-lg border border-neutral-300 dark:border-neutral-600 cursor-pointer" />
              <Input bind:value={form.primaryColor} class="flex-1" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Accent Color</label>
            <div class="flex gap-2">
              <input type="color" bind:value={form.accentColor} class="h-10 w-14 rounded-lg border border-neutral-300 dark:border-neutral-600 cursor-pointer" />
              <Input bind:value={form.accentColor} class="flex-1" />
            </div>
          </div>
          <Select label="Font Family" bind:value={form.fontFamily} options={fontOptions} />
          <Select
            label="Menu Layout"
            bind:value={form.menuLayout}
            options={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }]}
          />
          <Input label="Banner Image URL" bind:value={form.bannerUrl} placeholder="https://..." class="sm:col-span-2" />
        </div>
      </Card>

      <!-- Customer-facing Content -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Customer-facing Content</h2>
        <div class="space-y-4">
          <Input label="Welcome Message" bind:value={form.welcomeMessage} placeholder="Welcome to our restaurant!" />
          <Input label="Footer Text" bind:value={form.footerText} placeholder="Thank you for dining with us." />
        </div>
      </Card>

      <!-- Pricing -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Pricing Settings</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input label="Currency Symbol" bind:value={form.currencySymbol} placeholder="$" />
          <Input label="Currency Code" bind:value={form.currencyCode} placeholder="USD" />
          <Input label="Tax Rate (%)" type="number" bind:value={form.taxRate} min="0" max="100" step="0.01" />
          <Input label="Service Charge (%)" type="number" bind:value={form.serviceChargeRate} min="0" max="100" step="0.01" />
        </div>
      </Card>

      <!-- Display Options -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Menu Display Options</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {#each [['showCalories', 'Show Calories'], ['showAllergens', 'Show Allergens'], ['showPreparationTime', 'Show Prep Time'], ['showSpiceLevel', 'Show Spice Level']] as [key, label]}
            <label class="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={(form as any)[key]}
                onchange={(e) => { (form as any)[key] = (e.target as HTMLInputElement).checked }}
                class="accent-brand-600 w-4 h-4"
              />
              {label}
            </label>
          {/each}
        </div>
      </Card>

      <!-- Social Links -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Social Links</h2>
        <div class="space-y-3">
          <Input label="Instagram" bind:value={form.instagramUrl} placeholder="https://instagram.com/..." />
          <Input label="Facebook" bind:value={form.facebookUrl} placeholder="https://facebook.com/..." />
          <Input label="Twitter / X" bind:value={form.twitterUrl} placeholder="https://twitter.com/..." />
        </div>
      </Card>

      <div class="flex justify-end">
        <Button type="submit" loading={saving} size="lg">Save Settings</Button>
      </div>
    </form>
  {/if}
</div>
