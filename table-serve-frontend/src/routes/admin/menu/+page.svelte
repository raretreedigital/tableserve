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
  import Select from '$lib/components/ui/Select.svelte'
  import Textarea from '$lib/components/ui/Textarea.svelte'
  import type { MenuItem, MenuCategory } from '$lib/types'

  let orgId = $derived($activeOrgId)
  let items = $state<{ item: MenuItem; categoryName?: string }[]>([])
  let categories = $state<MenuCategory[]>([])
  let loading = $state(true)
  let search = $state('')
  let filterCategory = $state('')
  let filterAvailable = $state('')
  let filterSpecial = $state(false)

  // Form state
  let modalOpen = $state(false)
  let saving = $state(false)
  let editId = $state<string | null>(null)

  const defaultForm = () => ({
    categoryId: '',
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    isChefSpecial: false,
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    spiceLevel: 'none',
    allergens: '',
    tags: '',
    preparationTime: '',
    calories: '',
    sortOrder: '0',
  })

  let form = $state(defaultForm())
  let formErrors = $state<Record<string, string>>({})

  onMount(async () => {
    await loadData()
  })

  async function loadData() {
    if (!orgId) { loading = false; return }
    loading = true
    const [itemsRes, catsRes] = await Promise.all([
      adminApi.getMenuItems(orgId),
      adminApi.getCategories(orgId),
    ])
    if (itemsRes.data) items = (itemsRes.data as any).items ?? []
    if (catsRes.data) categories = (catsRes.data as any).categories ?? []
    loading = false
  }

  let filtered = $derived(
    items.filter((row) => {
      if (search && !row.item.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterCategory && row.item.categoryId !== filterCategory) return false
      if (filterAvailable === 'available' && !row.item.isAvailable) return false
      if (filterAvailable === 'unavailable' && row.item.isAvailable) return false
      if (filterSpecial && !row.item.isChefSpecial) return false
      return true
    })
  )

  function openCreate() {
    editId = null
    form = defaultForm()
    formErrors = {}
    modalOpen = true
  }

  function openEdit(item: MenuItem) {
    editId = item.id
    form = {
      categoryId: item.categoryId ?? '',
      name: item.name,
      description: item.description ?? '',
      price: item.price,
      imageUrl: item.imageUrl ?? '',
      isChefSpecial: item.isChefSpecial,
      isVegetarian: item.isVegetarian,
      isVegan: item.isVegan,
      isGlutenFree: item.isGlutenFree,
      spiceLevel: item.spiceLevel,
      allergens: item.allergens.join(', '),
      tags: item.tags.join(', '),
      preparationTime: item.preparationTime?.toString() ?? '',
      calories: item.calories?.toString() ?? '',
      sortOrder: item.sortOrder.toString(),
    }
    formErrors = {}
    modalOpen = true
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required.'
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) <= 0) e.price = 'Valid price required.'
    formErrors = e
    return Object.keys(e).length === 0
  }

  async function handleSave(e: SubmitEvent) {
    e.preventDefault()
    if (!validate()) return
    saving = true

    const payload = {
      ...form,
      price: parseFloat(form.price),
      categoryId: form.categoryId || undefined,
      allergens: form.allergens ? form.allergens.split(',').map((s) => s.trim()).filter(Boolean) : [],
      tags: form.tags ? form.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      preparationTime: form.preparationTime ? parseInt(form.preparationTime) : undefined,
      calories: form.calories ? parseInt(form.calories) : undefined,
      sortOrder: parseInt(form.sortOrder),
      imageUrl: form.imageUrl || undefined,
    }

    const { error } = editId
      ? await adminApi.updateMenuItem(orgId, editId, payload)
      : await adminApi.createMenuItem(orgId, payload)

    saving = false
    if (error) { addToast('error', error); return }
    addToast('success', editId ? 'Item updated.' : 'Item created.')
    modalOpen = false
    await loadData()
  }

  async function toggleAvailability(item: MenuItem) {
    const { error } = await adminApi.updateMenuItem(orgId, item.id, {
      isAvailable: !item.isAvailable,
    })
    if (error) { addToast('error', error); return }
    await loadData()
  }

  async function deleteItem(id: string) {
    if (!confirm('Deactivate this menu item?')) return
    const { error } = await adminApi.deleteMenuItem(orgId, id)
    if (error) { addToast('error', error); return }
    addToast('success', 'Item deactivated.')
    await loadData()
  }
</script>

<svelte:head>
  <title>Menu - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Menu Items</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{items.length} items</p>
    </div>
    <Button onclick={openCreate}>Add Item</Button>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-3">
    <input
      type="search"
      bind:value={search}
      placeholder="Search items..."
      class="h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500 flex-1 min-w-48"
    />
    <select
      bind:value={filterCategory}
      class="h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      <option value="">All categories</option>
      {#each categories as cat}
        <option value={cat.id}>{cat.name}</option>
      {/each}
    </select>
    <select
      bind:value={filterAvailable}
      class="h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      <option value="">All availability</option>
      <option value="available">Available</option>
      <option value="unavailable">Unavailable</option>
    </select>
    <label class="flex items-center gap-2 h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-300 cursor-pointer">
      <input type="checkbox" bind:checked={filterSpecial} class="accent-brand-600" />
      Chef's Special
    </label>
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(5) as _}
        <div class="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if filtered.length === 0}
    <Card>
      <p class="text-center text-neutral-500 dark:text-neutral-400 py-8">
        {items.length === 0 ? 'No menu items yet. Add your first item.' : 'No items match your filters.'}
      </p>
    </Card>
  {:else}
    <div class="space-y-2">
      {#each filtered as row}
        <Card padding={false}>
          <div class="flex items-center gap-4 p-4">
            {#if row.item.imageUrl}
              <img src={row.item.imageUrl} alt={row.item.name} class="w-14 h-14 rounded-lg object-cover shrink-0" />
            {:else}
              <div class="w-14 h-14 rounded-lg bg-neutral-100 dark:bg-neutral-800 shrink-0 flex items-center justify-center text-xl text-neutral-400">
                -
              </div>
            {/if}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold text-neutral-900 dark:text-neutral-100">{row.item.name}</p>
                {#if row.item.isChefSpecial}
                  <Badge variant="brand">Chef's Special</Badge>
                {/if}
                {#if !row.item.isAvailable}
                  <Badge variant="danger">Unavailable</Badge>
                {/if}
                {#if row.item.isVegetarian}
                  <Badge variant="success">Veg</Badge>
                {/if}
                {#if row.item.isVegan}
                  <Badge variant="success">Vegan</Badge>
                {/if}
              </div>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {row.categoryName ?? 'Uncategorized'}
                {#if row.item.calories} &middot; {row.item.calories} cal{/if}
                {#if row.item.preparationTime} &middot; {row.item.preparationTime} min{/if}
              </p>
              {#if row.item.tags.length > 0}
                <div class="flex gap-1 mt-1 flex-wrap">
                  {#each row.item.tags as tag}
                    <span class="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded">{tag}</span>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="text-right shrink-0">
              <p class="font-bold text-neutral-900 dark:text-neutral-100">${parseFloat(row.item.price).toFixed(2)}</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onclick={() => toggleAvailability(row.item)}>
                {row.item.isAvailable ? 'Hide' : 'Show'}
              </Button>
              <Button size="sm" variant="outline" onclick={() => openEdit(row.item)}>Edit</Button>
              <Button size="sm" variant="danger" onclick={() => deleteItem(row.item.id)}>Remove</Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<!-- Create/Edit Modal -->
<Modal bind:open={modalOpen} title={editId ? 'Edit Menu Item' : 'Add Menu Item'} size="lg">
  <form onsubmit={handleSave} class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <Input label="Name" bind:value={form.name} error={formErrors.name} required class="col-span-2" />

      <Select
        label="Category"
        bind:value={form.categoryId}
        options={[{ value: '', label: 'No category' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
      />

      <Input label="Price" type="number" bind:value={form.price} error={formErrors.price} required min="0.01" step="0.01" />
    </div>

    <Textarea label="Description" bind:value={form.description} rows={2} />

    <Input label="Image URL" bind:value={form.imageUrl} placeholder="https://..." />

    <div class="grid grid-cols-2 gap-4">
      <Input label="Preparation Time (min)" type="number" bind:value={form.preparationTime} min="1" />
      <Input label="Calories" type="number" bind:value={form.calories} min="0" />
    </div>

    <Select
      label="Spice Level"
      bind:value={form.spiceLevel}
      options={[
        { value: 'none', label: 'No spice' },
        { value: 'mild', label: 'Mild' },
        { value: 'medium', label: 'Medium' },
        { value: 'hot', label: 'Hot' },
      ]}
    />

    <Input label="Tags (comma-separated)" bind:value={form.tags} placeholder="popular, new, seasonal" />
    <Input label="Allergens (comma-separated)" bind:value={form.allergens} placeholder="nuts, dairy, gluten" />

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
      {#each [['isChefSpecial', "Chef's Special"], ['isVegetarian', 'Vegetarian'], ['isVegan', 'Vegan'], ['isGlutenFree', 'Gluten Free']] as [key, label]}
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

    <div class="flex gap-3 pt-2">
      <Button type="submit" loading={saving} class="flex-1">
        {editId ? 'Save Changes' : 'Add Item'}
      </Button>
      <Button variant="outline" onclick={() => (modalOpen = false)} class="flex-1">Cancel</Button>
    </div>
  </form>
</Modal>
