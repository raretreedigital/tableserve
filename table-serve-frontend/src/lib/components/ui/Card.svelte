<script lang="ts">
  interface Props {
    class?: string
    padding?: boolean
    children?: any
  }

  let { class: extraClass = '', padding = true, children }: Props = $props()
</script>

<div
  class="
    bg-white dark:bg-neutral-900
    border border-neutral-200 dark:border-neutral-700
    rounded-xl shadow-sm
    {padding ? 'p-6' : ''}
    {extraClass}
  "
>
  {@render children?.()}
</div>
