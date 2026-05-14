<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { authStore } from '$lib/stores/auth'
  import { themeStore } from '$lib/stores/theme'
  import { authApi } from '$lib/api'
  import Toaster from '$lib/components/ui/Toaster.svelte'

  let { children } = $props()

  onMount(async () => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved) {
        themeStore.set(saved as 'light' | 'dark')
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        themeStore.set('dark')
      }
    } catch { /* ignore theme errors */ }

    try {
      authStore.setLoading(true)
      const { data } = await authApi.getSession()
      if (data?.user) {
        authStore.setUser(data.user)
      } else {
        authStore.clear()
      }
    } catch {
      authStore.clear()
    }
  })
</script>

{@render children()}
<Toaster />
