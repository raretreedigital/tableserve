<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import { addToast } from '$lib/stores/toast'
  import { showConfirm } from '$lib/stores/confirm.svelte'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import Input from '$lib/components/ui/Input.svelte'
  import Textarea from '$lib/components/ui/Textarea.svelte'
  import type { MenuCategory } from '$lib/types'

  let orgId = $derived($activeOrgId)
  let categories = $state<MenuCategory[]>([])
  let loading = $state(true)
  let modalOpen = $state(false)
  let saving = $state(false)
  let editId = $state<string | null>(null)
  let form = $state({ name: '', description: '', imageUrl: '', sortOrder: '0' })
  let formErrors = $state<Record<string, string>>({})

  onMount(async () => {
    await load()
  })

  async function load() {
    if (!orgId) { loading = false; return }
    const { data } = await adminApi.getCategories(orgId)
    if (data) categories = (data as any).categories ?? []
    loading = false
  }

  function openCreate() {
    editId = null
    form = { name: '', description: '', imageUrl: '', sortOrder: '0' }
    formErrors = {}
    modalOpen = true
  }

  function openEdit(cat: MenuCategory) {
    editId = cat.id
    form = {
      name: cat.name,
      description: cat.description ?? '',
      imageUrl: cat.imageUrl ?? '',
      sortOrder: cat.sortOrder.toString(),
    }
    formErrors = {}
    modalOpen = true
  }

  async function handleSave(e: SubmitEvent) {
    e.preventDefault()
    if (!form.name.trim()) { formErrors.name = 'Required.'; return }
    saving = true

    const payload = {
      name: form.name,
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
      sortOrder: parseInt(form.sortOrder),
    }

    const { error } = editId
      ? await adminApi.updateCategory(orgId, editId, payload)
      : await adminApi.createCategory(orgId, payload)

    saving = false
    if (error) { addToast('error', error); return }
    addToast('success', editId ? 'Category updated.' : 'Category created.')
    modalOpen = false
    await load()
  }

  async function toggleActive(cat: MenuCategory) {
    const { error } = await adminApi.updateCategory(orgId, cat.id, { isActive: !cat.isActive })
    if (error) { addToast('error', error); return }
    await load()
  }

  async function deleteCategory(id: string) {
    if (!await showConfirm({ title: 'Delete category', message: 'Items in it will become uncategorized.', confirmLabel: 'Delete', variant: 'danger' })) return
    const { error } = await adminApi.deleteCategory(orgId, id)
    if (error) { addToast('error', error); return }
    addToast('success', 'Category deleted.')
    await load()
  }
</script>

<svelte:head>
  <title>Categories - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Menu Categories</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Group your menu items into sections.</p>
    </div>
    <Button onclick={openCreate}>Add Category</Button>
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _}
        <div class="h-16 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if categories.length === 0}
    <Card>
      <p class="text-center text-neutral-500 dark:text-neutral-400 py-8">No categories yet.</p>
    </Card>
  {:else}
    <div class="space-y-2">
      {#each categories as cat}
        <Card padding={false}>
          <div class="flex items-center gap-4 p-4">
            {#if cat.imageUrl}
              <img src={cat.imageUrl} alt={cat.name} class="w-12 h-12 rounded-lg object-cover shrink-0" />
            {:else}
              <div class="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 shrink-0 font-bold text-lg">
                {cat.name.charAt(0)}
              </div>
            {/if}
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-neutral-900 dark:text-neutral-100 {!cat.isActive ? 'line-through text-neutral-400' : ''}">
                {cat.name}
              </p>
              {#if cat.description}
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{cat.description}</p>
              {/if}
              <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Sort order: {cat.sortOrder}</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onclick={() => toggleActive(cat)}>
                {cat.isActive ? 'Hide' : 'Show'}
              </Button>
              <Button size="sm" variant="outline" onclick={() => openEdit(cat)}>Edit</Button>
              <Button size="sm" variant="danger" onclick={() => deleteCategory(cat.id)}>Delete</Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>

<Modal bind:open={modalOpen} title={editId ? 'Edit Category' : 'Add Category'} size="sm">
  <form onsubmit={handleSave} class="space-y-4">
    <Input label="Name" bind:value={form.name} error={formErrors.name} required />
    <Textarea label="Description" bind:value={form.description} rows={2} />
    <Input label="Image URL" bind:value={form.imageUrl} placeholder="https://..." />
    <Input label="Sort Order" type="number" bind:value={form.sortOrder} min="0" hint="Lower numbers appear first." />
    <div class="flex gap-3">
      <Button type="submit" loading={saving} class="flex-1">
        {editId ? 'Save' : 'Create'}
      </Button>
      <Button variant="outline" onclick={() => (modalOpen = false)} class="flex-1">Cancel</Button>
    </div>
  </form>
</Modal>
