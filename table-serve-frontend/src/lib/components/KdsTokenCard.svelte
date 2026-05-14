<script lang="ts">
  import { adminApi } from '$lib/api'
  import { addToast } from '$lib/stores/toast'
  import Card from '$lib/components/ui/Card.svelte'
  import Button from '$lib/components/ui/Button.svelte'

  let { orgId }: { orgId: string | null } = $props()

  let kdsToken = $state<string | null>(null)
  let loading = $state(false)
  let regenerating = $state(false)
  let copied = $state(false)

  async function load() {
    if (!orgId) return
    loading = true
    const { data } = await adminApi.getKdsToken(orgId)
    if (data) kdsToken = data.kdsToken
    loading = false
  }

  async function regenerate() {
    if (!orgId || !confirm('Regenerate KDS token? The old link will stop working immediately.')) return
    regenerating = true
    const { data, error } = await adminApi.regenerateKdsToken(orgId)
    regenerating = false
    if (error) { addToast('error', error); return }
    if (data) kdsToken = data.kdsToken
    addToast('success', 'KDS token regenerated.')
  }

  function kdsUrl(token: string) {
    return `${window.location.origin}/kds/${token}`
  }

  async function copyUrl() {
    if (!kdsToken) return
    await navigator.clipboard.writeText(kdsUrl(kdsToken))
    copied = true
    setTimeout(() => copied = false, 2000)
  }

  $effect(() => {
    if (orgId) load()
  })
</script>

<Card>
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div>
      <h2 class="font-semibold text-neutral-900 dark:text-neutral-100">Kitchen Display System (KDS)</h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
        Open this link on a kitchen TV or tablet — no login required.
      </p>
    </div>
    <Button size="sm" variant="outline" onclick={regenerate} loading={regenerating}>
      Regenerate Link
    </Button>
  </div>

  {#if loading}
    <div class="mt-4 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
  {:else if kdsToken}
    <div class="mt-4 flex gap-2 items-center">
      <input
        type="text"
        readonly
        value={kdsUrl(kdsToken)}
        class="flex-1 h-10 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-700 dark:text-neutral-300 font-mono truncate focus:outline-none"
      />
      <Button size="sm" onclick={copyUrl} variant={copied ? 'outline' : 'primary'}>
        {copied ? 'Copied!' : 'Copy'}
      </Button>
      <a
        href="/kds/{kdsToken}"
        target="_blank"
        class="h-9 px-3 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
      >
        Open ↗
      </a>
    </div>
    <p class="mt-2 text-xs text-neutral-400">
      Keep this link private. Anyone with the link can view and advance kitchen orders.
    </p>
  {/if}
</Card>
