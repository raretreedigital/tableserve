<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { fmtDate } from '$lib/date'
  import { activeOrgId } from '$lib/stores/org'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Input from '$lib/components/ui/Input.svelte'
  import Select from '$lib/components/ui/Select.svelte'
  import Textarea from '$lib/components/ui/Textarea.svelte'
  import Badge from '$lib/components/ui/Badge.svelte'
  import type { OrganizationProfile } from '$lib/types'
  import KdsTokenCard from '$lib/components/KdsTokenCard.svelte'
  import ImageCropper from '$lib/components/ImageCropper.svelte'

  let orgId = $derived($activeOrgId)
  let profile = $state<OrganizationProfile | null>(null)
  let orgName = $state('')
  let orgNameSaving = $state(false)
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
    supportName: '',
    primaryColor: '#1a1a1a',
    secondaryColor: '#f5f5f5',
    accentColor: '#e85d04',
    fontFamily: 'Inter',
    bannerUrl: '',
    logoUrl: '',
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
    orderEditWindowMinutes: '5',
    instagramUrl: '',
    facebookUrl: '',
    twitterUrl: '',
    receiptHeaderNote: '',
    receiptFooterNote: '',
    receiptThankYouMessage: '',
    receiptShowTax: true,
    receiptShowServiceCharge: true,
    receiptShowOrderId: true,
    receiptShowLogo: true,
    receiptShowItemizedList: true,
  })

  onMount(async () => {
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
          description: p.description ?? '',          supportName: (p as any).supportName ?? '',          primaryColor: p.primaryColor,
          secondaryColor: p.secondaryColor,
          accentColor: p.accentColor,
          fontFamily: p.fontFamily,
          bannerUrl: p.bannerUrl ?? '',
          logoUrl: (p as any).logoUrl ?? '',
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
          orderEditWindowMinutes: String((p as any).orderEditWindowMinutes ?? 5),
          instagramUrl: (p.socialLinks as any)?.instagram ?? '',
          facebookUrl: (p.socialLinks as any)?.facebook ?? '',
          twitterUrl: (p.socialLinks as any)?.twitter ?? '',
          receiptHeaderNote: (p as any).receiptSettings?.headerNote ?? '',
          receiptFooterNote: (p as any).receiptSettings?.footerNote ?? '',
          receiptThankYouMessage: (p as any).receiptSettings?.thankYouMessage ?? '',
          receiptShowTax: (p as any).receiptSettings?.showTax ?? true,
          receiptShowServiceCharge: (p as any).receiptSettings?.showServiceCharge ?? true,
          receiptShowOrderId: (p as any).receiptSettings?.showOrderId ?? true,
          receiptShowLogo: (p as any).receiptSettings?.showLogo ?? true,
          receiptShowItemizedList: (p as any).receiptSettings?.showItemizedList ?? true,
        }
      }
    }
    loading = false
  }

  async function handleSaveOrgName() {
    if (!orgName.trim()) return
    orgNameSaving = true
    const { error } = await adminApi.updateOrgName(orgId, orgName)
    orgNameSaving = false
    if (error) { addToast('error', error); return }
    addToast('success', 'Restaurant name updated.')
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
      supportName: form.supportName || undefined,
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      accentColor: form.accentColor,
      fontFamily: form.fontFamily,
      bannerUrl: form.bannerUrl || undefined,
      logoUrl: form.logoUrl || undefined,
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
      orderEditWindowMinutes: parseInt(form.orderEditWindowMinutes) || 5,
      socialLinks: {
        instagram: form.instagramUrl || undefined,
        facebook: form.facebookUrl || undefined,
        twitter: form.twitterUrl || undefined,
      },
      receiptSettings: {
        headerNote: form.receiptHeaderNote || undefined,
        footerNote: form.receiptFooterNote || undefined,
        thankYouMessage: form.receiptThankYouMessage || undefined,
        showTax: form.receiptShowTax,
        showServiceCharge: form.receiptShowServiceCharge,
        showOrderId: form.receiptShowOrderId,
        showLogo: form.receiptShowLogo,
        showItemizedList: form.receiptShowItemizedList,
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
        {@const plan = profile.subscriptionPlan}
        {@const isPaid = plan === 'basic' || plan === 'premium'}
        {@const isPremium = plan === 'premium'}
        <Card>
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 class="font-semibold text-neutral-900 dark:text-neutral-100">Subscription</h2>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Your current plan and limits.</p>
            </div>
            <div class="flex items-center gap-2">
              <Badge variant={plan === 'premium' ? 'brand' : plan === 'basic' ? 'info' : 'neutral'}>
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </Badge>
              <Badge variant={profile.status === 'active' ? 'success' : profile.status === 'trial' ? 'warning' : 'danger'}>
                {profile.status}
              </Badge>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {#each [
              { label: 'Tables', free: '1', basic: '10', premium: 'Unlimited' },
              { label: 'Menu Items', free: '20', basic: '100', premium: 'Unlimited' },
              { label: 'Branding', free: 'No', basic: 'Yes', premium: 'Yes' },
              { label: 'Order Editing', free: 'No', basic: 'Yes', premium: 'Yes' },
              { label: 'Analytics', free: 'Basic', basic: '30 days', premium: '90 days' },
              { label: 'Social Links', free: 'No', basic: 'No', premium: 'Yes' },
            ] as feat}
              <div class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <p class="text-xs text-neutral-400 mb-1">{feat.label}</p>
                <p class="font-semibold text-neutral-900 dark:text-neutral-100">
                  {plan === 'premium' ? feat.premium : plan === 'basic' ? feat.basic : feat.free}
                </p>
              </div>
            {/each}
          </div>
          {#if profile.subscriptionExpiry}
            <p class="text-xs text-neutral-500 mt-3">Expires: {fmtDate(profile.subscriptionExpiry)}</p>
          {/if}
          {#if !isPaid}
            <div class="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
              You are on the Free plan. Upgrade to Basic or Premium to unlock branding, order editing, and more.
            </div>
          {/if}
        </Card>
      {/if}

      <!-- Kitchen Display System -->
      <KdsTokenCard {orgId} />

      <!-- Restaurant Info -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Restaurant Information</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1 sm:col-span-2">
            <label class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Restaurant Name</label>
            <div class="flex gap-2">
              <input
                type="text"
                bind:value={orgName}
                class="flex-1 h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Your restaurant name"
              />
              <button
                type="button"
                onclick={handleSaveOrgName}
                disabled={orgNameSaving}
                class="px-4 h-10 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >{orgNameSaving ? 'Saving…' : 'Update Name'}</button>
            </div>
          </div>
          <Input label="Support Name" bind:value={form.supportName} placeholder="e.g. Pizza Palace Team" hint="Shown to customers for support & contact purposes." />
          <Input label="Contact Email" type="email" bind:value={form.email} />
          <Input label="Phone" type="tel" bind:value={form.phone} />
          <Input label="Website" type="url" bind:value={form.website} />
          <div class="sm:col-span-2">
            <ImageCropper
              bind:value={form.logoUrl}
              aspect={1}
              label="Company Logo"
              hint="Square image recommended. Click to upload and crop."
              placeholder="Upload logo"
            />
          </div>
          <Textarea label="Address" bind:value={form.address} rows={2} class="sm:col-span-2" />
          <Textarea label="Description" bind:value={form.description} rows={3} class="sm:col-span-2" />
        </div>
      </Card>

      <!-- Branding -->
      <Card>
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-neutral-900 dark:text-neutral-100">Branding</h2>
          {#if profile && profile.subscriptionPlan === 'free'}
            <Badge variant="warning">Basic+ only</Badge>
          {/if}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label for="primary-color" class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Primary Color</label>
            <div class="flex gap-2">
              <input id="primary-color" type="color" bind:value={form.primaryColor} class="h-10 w-14 rounded-lg border border-neutral-300 dark:border-neutral-600 cursor-pointer" />
              <Input bind:value={form.primaryColor} class="flex-1" />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <label for="accent-color" class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Accent Color</label>
            <div class="flex gap-2">
              <input id="accent-color" type="color" bind:value={form.accentColor} class="h-10 w-14 rounded-lg border border-neutral-300 dark:border-neutral-600 cursor-pointer" />
              <Input bind:value={form.accentColor} class="flex-1" />
            </div>
          </div>
          <Select label="Font Family" bind:value={form.fontFamily} options={fontOptions} />
          <Select
            label="Menu Layout"
            bind:value={form.menuLayout}
            options={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }]}
          />
          <div class="sm:col-span-2">
            <ImageCropper
              bind:value={form.bannerUrl}
              aspect={16/9}
              label="Banner Image"
              hint="16:9 landscape image. Displayed at the top of your customer menu page."
              placeholder="Upload banner"
            />
          </div>
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
          <div class="col-span-2">
            <label for="currency-select" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Currency</label>
            <select
              id="currency-select"
              class="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={`${form.currencyCode}|${form.currencySymbol}`}
              onchange={(e) => {
                const [code, symbol] = (e.currentTarget as HTMLSelectElement).value.split('|')
                form.currencyCode = code
                form.currencySymbol = symbol
              }}
            >
              {#each [
                { code: 'USD', symbol: '$', label: 'USD — US Dollar ($)' },
                { code: 'EUR', symbol: '€', label: 'EUR — Euro (€)' },
                { code: 'GBP', symbol: '£', label: 'GBP — British Pound (£)' },
                { code: 'INR', symbol: '₹', label: 'INR — Indian Rupee (₹)' },
                { code: 'AED', symbol: 'AED', label: 'AED — UAE Dirham (AED)' },
                { code: 'SGD', symbol: 'S$', label: 'SGD — Singapore Dollar (S$)' },
                { code: 'AUD', symbol: 'A$', label: 'AUD — Australian Dollar (A$)' },
                { code: 'CAD', symbol: 'C$', label: 'CAD — Canadian Dollar (C$)' },
                { code: 'JPY', symbol: '¥', label: 'JPY — Japanese Yen (¥)' },
                { code: 'CNY', symbol: '¥', label: 'CNY — Chinese Yuan (¥)' },
                { code: 'CHF', symbol: 'CHF', label: 'CHF — Swiss Franc (CHF)' },
                { code: 'MYR', symbol: 'RM', label: 'MYR — Malaysian Ringgit (RM)' },
                { code: 'THB', symbol: '฿', label: 'THB — Thai Baht (฿)' },
                { code: 'IDR', symbol: 'Rp', label: 'IDR — Indonesian Rupiah (Rp)' },
                { code: 'PHP', symbol: '₱', label: 'PHP — Philippine Peso (₱)' },
                { code: 'SAR', symbol: 'SAR', label: 'SAR — Saudi Riyal (SAR)' },
                { code: 'QAR', symbol: 'QAR', label: 'QAR — Qatari Riyal (QAR)' },
                { code: 'KWD', symbol: 'KD', label: 'KWD — Kuwaiti Dinar (KD)' },
                { code: 'BHD', symbol: 'BD', label: 'BHD — Bahraini Dinar (BD)' },
                { code: 'OMR', symbol: 'OMR', label: 'OMR — Omani Rial (OMR)' },
                { code: 'NZD', symbol: 'NZ$', label: 'NZD — New Zealand Dollar (NZ$)' },
                { code: 'ZAR', symbol: 'R', label: 'ZAR — South African Rand (R)' },
                { code: 'BRL', symbol: 'R$', label: 'BRL — Brazilian Real (R$)' },
                { code: 'MXN', symbol: 'MX$', label: 'MXN — Mexican Peso (MX$)' },
                { code: 'KRW', symbol: '₩', label: 'KRW — South Korean Won (₩)' },
                { code: 'HKD', symbol: 'HK$', label: 'HKD — Hong Kong Dollar (HK$)' },
                { code: 'TWD', symbol: 'NT$', label: 'TWD — Taiwan Dollar (NT$)' },
                { code: 'SEK', symbol: 'kr', label: 'SEK — Swedish Krona (kr)' },
                { code: 'NOK', symbol: 'kr', label: 'NOK — Norwegian Krone (kr)' },
                { code: 'DKK', symbol: 'kr', label: 'DKK — Danish Krone (kr)' },
                { code: 'PLN', symbol: 'zł', label: 'PLN — Polish Złoty (zł)' },
                { code: 'CZK', symbol: 'Kč', label: 'CZK — Czech Koruna (Kč)' },
                { code: 'HUF', symbol: 'Ft', label: 'HUF — Hungarian Forint (Ft)' },
                { code: 'TRY', symbol: '₺', label: 'TRY — Turkish Lira (₺)' },
                { code: 'RUB', symbol: '₽', label: 'RUB — Russian Ruble (₽)' },
                { code: 'PKR', symbol: '₨', label: 'PKR — Pakistani Rupee (₨)' },
                { code: 'BDT', symbol: '৳', label: 'BDT — Bangladeshi Taka (৳)' },
                { code: 'LKR', symbol: 'Rs', label: 'LKR — Sri Lankan Rupee (Rs)' },
                { code: 'NPR', symbol: 'Rs', label: 'NPR — Nepalese Rupee (Rs)' },
                { code: 'EGP', symbol: 'E£', label: 'EGP — Egyptian Pound (E£)' },
                { code: 'NGN', symbol: '₦', label: 'NGN — Nigerian Naira (₦)' },
                { code: 'KES', symbol: 'KSh', label: 'KES — Kenyan Shilling (KSh)' },
                { code: 'GHS', symbol: 'GH₵', label: 'GHS — Ghanaian Cedi (GH₵)' },
                { code: 'MAD', symbol: 'MAD', label: 'MAD — Moroccan Dirham (MAD)' },
                { code: 'ILS', symbol: '₪', label: 'ILS — Israeli Shekel (₪)' },
                { code: 'VND', symbol: '₫', label: 'VND — Vietnamese Dong (₫)' },
                { code: 'COP', symbol: 'CO$', label: 'COP — Colombian Peso (CO$)' },
                { code: 'ARS', symbol: 'AR$', label: 'ARS — Argentine Peso (AR$)' },
                { code: 'CLP', symbol: 'CL$', label: 'CLP — Chilean Peso (CL$)' },
                { code: 'PEN', symbol: 'S/', label: 'PEN — Peruvian Sol (S/)' },
              ] as c}
                <option value={`${c.code}|${c.symbol}`}>{c.label}</option>
              {/each}
            </select>
          </div>
          <Input label="Tax Rate (%)" type="number" bind:value={form.taxRate} min="0" max="100" step="0.01" />
          <Input label="Service Charge (%)" type="number" bind:value={form.serviceChargeRate} min="0" max="100" step="0.01" />
        </div>
        <div class="mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-4">
          <div class="flex items-center justify-between mb-2">
            <div>
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Order Edit Window</p>
              <p class="text-xs text-neutral-400">How many minutes customers can edit their order after placing it. Set to 0 to disable.</p>
            </div>
            {#if profile && profile.subscriptionPlan === 'free'}
              <Badge variant="warning">Basic+ only</Badge>
            {/if}
          </div>
          <div class="flex items-center gap-3">
            <Input type="number" bind:value={form.orderEditWindowMinutes} min="0" max="60" step="1" class="w-28" />
            <span class="text-sm text-neutral-500">minutes (default: 5)</span>
          </div>
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
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-neutral-900 dark:text-neutral-100">Social Links</h2>
          {#if profile && profile.subscriptionPlan !== 'premium'}
            <Badge variant="brand">Premium only</Badge>
          {/if}
        </div>
        <div class="space-y-3">
          <Input label="Instagram" bind:value={form.instagramUrl} placeholder="https://instagram.com/..." />
          <Input label="Facebook" bind:value={form.facebookUrl} placeholder="https://facebook.com/..." />
          <Input label="Twitter / X" bind:value={form.twitterUrl} placeholder="https://twitter.com/..." />
        </div>
      </Card>

      <!-- Receipt Customization -->
      <Card>
        <div class="flex items-start justify-between mb-1">
          <div>
            <h2 class="font-semibold text-neutral-900 dark:text-neutral-100">Receipt Customization</h2>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Control what appears on the digital receipt shown to customers when they request the bill.</p>
          </div>
        </div>

        <!-- Live preview strip -->
        <div class="mt-5 p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 text-xs font-mono space-y-1.5">
          <p class="text-center text-[10px] font-sans font-semibold text-neutral-400 uppercase tracking-widest mb-2">Receipt Preview</p>
          {#if form.receiptShowLogo && form.logoUrl}
            <div class="flex justify-center mb-2">
              <img src={form.logoUrl} alt="logo" class="h-8 w-8 rounded object-cover" />
            </div>
          {/if}
          <p class="text-center font-bold text-neutral-900 dark:text-neutral-100">{orgName || 'Your Restaurant'}</p>
          {#if form.receiptHeaderNote}
            <p class="text-center text-neutral-500 dark:text-neutral-400 whitespace-pre-wrap">{form.receiptHeaderNote}</p>
          {/if}
          <div class="border-t border-dashed border-neutral-300 dark:border-neutral-600 my-1.5"></div>
          {#if form.receiptShowItemizedList}
            <div class="flex justify-between text-neutral-700 dark:text-neutral-300"><span>1× Example Item</span><span>{form.currencySymbol}12.00</span></div>
            <div class="flex justify-between text-neutral-700 dark:text-neutral-300"><span>2× Another Item</span><span>{form.currencySymbol}18.00</span></div>
          {/if}
          <div class="border-t border-dashed border-neutral-300 dark:border-neutral-600 my-1.5"></div>
          <div class="flex justify-between text-neutral-600 dark:text-neutral-400"><span>Subtotal</span><span>{form.currencySymbol}30.00</span></div>
          {#if form.receiptShowTax && parseFloat(form.taxRate) > 0}
            <div class="flex justify-between text-neutral-600 dark:text-neutral-400"><span>Tax ({form.taxRate}%)</span><span>{form.currencySymbol}{(30 * parseFloat(form.taxRate) / 100).toFixed(2)}</span></div>
          {/if}
          {#if form.receiptShowServiceCharge && parseFloat(form.serviceChargeRate) > 0}
            <div class="flex justify-between text-neutral-600 dark:text-neutral-400"><span>Service Charge ({form.serviceChargeRate}%)</span><span>{form.currencySymbol}{(30 * parseFloat(form.serviceChargeRate) / 100).toFixed(2)}</span></div>
          {/if}
          <div class="flex justify-between font-bold text-neutral-900 dark:text-neutral-100 pt-0.5"><span>Total</span><span>{form.currencySymbol}30.00</span></div>
          {#if form.receiptShowOrderId}
            <p class="text-neutral-400 mt-1">Order #ORD-EXAMPLE</p>
          {/if}
          <div class="border-t border-dashed border-neutral-300 dark:border-neutral-600 my-1.5"></div>
          {#if form.receiptThankYouMessage}
            <p class="text-center font-medium text-neutral-700 dark:text-neutral-300">{form.receiptThankYouMessage}</p>
          {/if}
          {#if form.receiptFooterNote}
            <p class="text-center text-neutral-400 whitespace-pre-wrap">{form.receiptFooterNote}</p>
          {/if}
        </div>

        <!-- Controls -->
        <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Textarea
            label="Header Note"
            bind:value={form.receiptHeaderNote}
            rows={2}
            placeholder="e.g. GST Reg No: 12345678&#10;All prices inclusive of tax"
          />
          <Textarea
            label="Footer Note"
            bind:value={form.receiptFooterNote}
            rows={2}
            placeholder="e.g. No exchange or refund policy&#10;Thank you for your visit"
          />
          <Input
            label="Thank You Message"
            bind:value={form.receiptThankYouMessage}
            placeholder="e.g. Thank you for dining with us! 🙏"
          />
        </div>

        <div class="mt-5 border-t border-neutral-100 dark:border-neutral-800 pt-4">
          <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Show on Receipt</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {#each [
              ['receiptShowLogo', 'Restaurant Logo'],
              ['receiptShowItemizedList', 'Itemized List'],
              ['receiptShowTax', 'Tax Breakdown'],
              ['receiptShowServiceCharge', 'Service Charge'],
              ['receiptShowOrderId', 'Order ID'],
            ] as [key, label]}
              <label class="flex items-center gap-2.5 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={(form as any)[key]}
                  onchange={(e) => { (form as any)[key] = (e.target as HTMLInputElement).checked }}
                  class="accent-brand-600 w-4 h-4 shrink-0"
                />
                {label}
              </label>
            {/each}
          </div>
        </div>
      </Card>

      <div class="flex justify-end">
        <Button type="submit" loading={saving} size="lg">Save Settings</Button>
      </div>
    </form>
  {/if}
</div>

