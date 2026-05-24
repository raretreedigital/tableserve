<script lang="ts">
  import { onMount } from 'svelte'
  import { adminApi } from '$lib/api'
  import { activeOrgId } from '$lib/stores/org'
  import Card from '$lib/components/ui/Card.svelte'

  type Period = 'today' | 'week' | 'month' | 'quarter' | 'year'
  let orgId = $derived($activeOrgId)
  let period = $state<Period>('month')
  let data = $state<any>(null)
  let loading = $state(true)

  const DOW_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
    i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
  )

  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: '7 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: '90 Days' },
    { value: 'year', label: 'This Year' },
  ]

  async function load() {
    if (!orgId) { loading = false; return }
    loading = true
    const res = await adminApi.getReports(orgId, period)
    if (res.data) data = res.data
    loading = false
  }

  onMount(load)
  $effect(() => { if (period && orgId) load() })

  function fmt(val: string | number | null | undefined) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(String(val ?? '0')))
  }

  // ── Hourly data (0-23 filled) ──────────────
  let hourMap = $derived<Record<number, { orders: number; revenue: number }>>(() => {
    const m: Record<number, { orders: number; revenue: number }> = {}
    for (let i = 0; i < 24; i++) m[i] = { orders: 0, revenue: 0 }
    for (const row of data?.byHour ?? []) {
      m[Math.round(row.hour)] = { orders: Number(row.orders), revenue: parseFloat(row.revenue ?? '0') }
    }
    return m
  })

  let maxHourOrders = $derived(Math.max(1, ...Object.values(hourMap).map((h) => h.orders)))

  // ── DOW data ───────────────────────────────
  let dowMap = $derived<Record<number, { orders: number; revenue: number }>>(() => {
    const m: Record<number, { orders: number; revenue: number }> = {}
    for (let i = 0; i < 7; i++) m[i] = { orders: 0, revenue: 0 }
    for (const row of data?.byDow ?? []) {
      m[Math.round(row.dow)] = { orders: Number(row.orders), revenue: parseFloat(row.revenue ?? '0') }
    }
    return m
  })

  let maxDowOrders = $derived(Math.max(1, ...Object.values(dowMap).map((d) => d.orders)))

  // ── Table revenue bars ─────────────────────
  let maxTableRevenue = $derived(
    Math.max(1, ...(data?.byTable ?? []).map((t: any) => parseFloat(t.revenue ?? '0')))
  )

  // ── Daily trend ────────────────────────────
  let dailyMax = $derived(
    Math.max(1, ...(data?.dailyTrend ?? []).map((d: any) => parseFloat(d.revenue ?? '0')))
  )

  // ── Funnel ────────────────────────────────
  const FUNNEL_ORDER = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']
  const FUNNEL_COLOR: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#8b5cf6',
    ready: '#10b981', served: '#6b7280', cancelled: '#ef4444',
  }
  let funnelMap = $derived<Record<string, number>>(() => {
    const m: Record<string, number> = {}
    for (const row of data?.funnel ?? []) m[row.status] = Number(row.count)
    return m
  })
  let funnelMax = $derived(Math.max(1, ...Object.values(funnelMap)))

  // ── Wagon wheel (radial 24-hour chart) ─────
  // 24 segments in a circle, coloured by order volume
  function wagonWheelSegments(): { d: string; fill: string; orders: number; label: string; lx: number; ly: number }[] {
    const cx = 130, cy = 130, r = 110, innerR = 40
    const segments = []
    for (let h = 0; h < 24; h++) {
      const startAngle = (h / 24) * 2 * Math.PI - Math.PI / 2
      const endAngle = ((h + 1) / 24) * 2 * Math.PI - Math.PI / 2
      const oCount = hourMap[h]?.orders ?? 0
      const intensity = oCount / maxHourOrders

      const x1 = cx + innerR * Math.cos(startAngle)
      const y1 = cy + innerR * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(startAngle)
      const y2 = cy + r * Math.sin(startAngle)
      const x3 = cx + r * Math.cos(endAngle)
      const y3 = cy + r * Math.sin(endAngle)
      const x4 = cx + innerR * Math.cos(endAngle)
      const y4 = cy + innerR * Math.sin(endAngle)

      const d = `M ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerR} ${innerR} 0 0 0 ${x1} ${y1} Z`

      // Label position (midpoint of arc, slightly outside)
      const midAngle = startAngle + (endAngle - startAngle) / 2
      const labelR = r + 16
      const lx = cx + labelR * Math.cos(midAngle)
      const ly = cy + labelR * Math.sin(midAngle)

      // Colour: blue for daytime, deep blue for night, intensity
      let hue: number
      if (h >= 6 && h < 14) hue = 200      // morning / lunch
      else if (h >= 14 && h < 20) hue = 150  // afternoon / dinner
      else hue = 240                          // night

      const fill = intensity === 0
        ? '#1f2937'
        : `hsl(${hue}, ${40 + intensity * 50}%, ${25 + intensity * 35}%)`

      segments.push({ d, fill, orders: oCount, label: HOUR_LABELS[h], lx, ly })
    }
    return segments
  }
</script>

<svelte:head>
  <title>Reports - Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Reports</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Deep-dive into ordering patterns, table performance and fulfillment.</p>
    </div>
    <div class="flex rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
      {#each periods as p}
        <button
          class="px-3 py-1.5 text-sm font-medium transition-colors
            {period === p.value
              ? 'bg-brand-600 text-white'
              : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'}"
          onclick={() => (period = p.value)}
        >{p.label}</button>
      {/each}
    </div>
  </div>

  {#if loading}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {#each Array(6) as _}
        <div class="h-64 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if !data}
    <Card>
      <p class="text-center text-neutral-500 dark:text-neutral-400 py-12">No data available.</p>
    </Card>
  {:else}
    <!-- Summary strip -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {#each [
        { label: 'Total Orders', value: String((data.funnel ?? []).reduce((s: number, r: any) => s + Number(r.count), 0)) },
        { label: 'Avg Fulfillment', value: `${Math.round(data.avgFulfillmentMinutes ?? 0)} min` },
        { label: 'Busiest Hour', value: (() => { let bh = 0, bv = 0; Object.entries(hourMap).forEach(([h, v]) => { if (v.orders > bv) { bv = v.orders; bh = +h } }); return HOUR_LABELS[bh] })() },
        { label: 'Busiest Day', value: (() => { let bd = 0, bv = 0; Object.entries(dowMap).forEach(([d, v]) => { if (v.orders > bv) { bv = v.orders; bd = +d } }); return DOW_LABEL[bd] })() },
      ] as stat}
        <Card>
          <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">{stat.label}</p>
          <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stat.value}</p>
        </Card>
      {/each}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- ── Wagon Wheel 24h heatmap ── -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">24-Hour Order Pattern</h2>
        <p class="text-xs text-neutral-400 mb-4">Each segment = 1 hour. Darker = more orders.</p>
        <div class="flex justify-center">
          <svg viewBox="0 0 260 260" class="w-full max-w-[280px]">
            <!-- Segments -->
            {#each wagonWheelSegments() as seg}
              <path d={seg.d} fill={seg.fill} class="transition-opacity hover:opacity-80">
                <title>{seg.label}: {seg.orders} orders</title>
              </path>
            {/each}
            <!-- Hour labels for key hours (every 3h) -->
            {#each [0, 3, 6, 9, 12, 15, 18, 21] as h}
              {@const angle = ((h + 0.5) / 24) * 2 * Math.PI - Math.PI / 2}
              {@const lx = 130 + 122 * Math.cos(angle)}
              {@const ly = 130 + 122 * Math.sin(angle)}
              <text
                x={lx} y={ly}
                text-anchor="middle"
                dominant-baseline="middle"
                class="fill-neutral-400 dark:fill-neutral-500"
                font-size="8"
              >{HOUR_LABELS[h]}</text>
            {/each}
            <!-- Centre label -->
            <text x="130" y="126" text-anchor="middle" class="fill-neutral-400 dark:fill-neutral-500" font-size="9">Orders</text>
            <text x="130" y="137" text-anchor="middle" class="fill-neutral-300 dark:fill-neutral-400" font-size="9">by hour</text>
          </svg>
        </div>
        <!-- Legend row -->
        <div class="flex items-center justify-center gap-4 mt-3 text-xs text-neutral-400">
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-blue-900 inline-block"></span>Low</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-sm bg-blue-500 inline-block"></span>High</span>
        </div>
      </Card>

      <!-- ── Day of week bars ── -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Orders by Day of Week</h2>
        <div class="space-y-2">
          {#each DOW_LABEL as day, i}
            {@const v = dowMap[i] ?? { orders: 0, revenue: 0 }}
            {@const pct = Math.round((v.orders / maxDowOrders) * 100)}
            <div class="flex items-center gap-3">
              <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-8 shrink-0">{day}</span>
              <div class="flex-1 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  class="h-full rounded-md transition-all bg-violet-500 dark:bg-violet-600 flex items-center justify-end pr-2"
                  style="width:{pct}%"
                >
                  {#if pct > 15}<span class="text-xs font-medium text-white">{v.orders}</span>{/if}
                </div>
              </div>
              {#if pct <= 15}
                <span class="text-xs text-neutral-500 w-6 text-right">{v.orders}</span>
              {:else}
                <span class="w-6"></span>
              {/if}
              <span class="text-xs text-neutral-400 w-20 text-right">{fmt(v.revenue)}</span>
            </div>
          {/each}
        </div>
      </Card>

      <!-- ── Revenue trend ── -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Revenue Trend</h2>
        {#if !data.dailyTrend?.length}
          <p class="text-sm text-neutral-400 py-8 text-center">No data.</p>
        {:else}
          {@const pts = (data.dailyTrend ?? []).map((d: any, i: number) => ({
            x: (i / Math.max(data.dailyTrend.length - 1, 1)) * 460 + 20,
            y: 120 - (parseFloat(d.revenue ?? '0') / dailyMax) * 100,
            rev: d.revenue,
            date: d.date,
            orders: d.orders,
          }))}
          <svg viewBox="0 0 500 140" class="w-full">
            <!-- Grid lines -->
            {#each [0, 25, 50, 75, 100] as pct}
              <line x1="20" y1={120 - pct} x2="480" y2={120 - pct} stroke="currentColor" stroke-opacity="0.07" stroke-width="1" />
            {/each}
            <!-- Area fill -->
            <defs>
              <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            {#if pts.length > 1}
              <path
                d="M {pts[0].x} 120 {pts.map((p: any) => `L ${p.x} ${p.y}`).join(' ')} L {pts[pts.length-1].x} 120 Z"
                fill="url(#rev-grad)"
              />
              <polyline
                points={pts.map((p: any) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#3b82f6"
                stroke-width="2"
                stroke-linejoin="round"
              />
            {/if}
            <!-- Dots -->
            {#each pts as pt}
              <circle cx={pt.x} cy={pt.y} r="3" fill="#3b82f6" stroke="white" stroke-width="1.5">
                <title>{pt.date}: {fmt(pt.rev)} ({pt.orders} orders)</title>
              </circle>
            {/each}
            <!-- X-axis dates (first/mid/last) -->
            {#each [0, Math.floor(pts.length / 2), pts.length - 1] as idx}
              {#if pts[idx]}
                <text x={pts[idx].x} y="135" text-anchor="middle" font-size="8" class="fill-neutral-400">{pts[idx].date?.slice(5)}</text>
              {/if}
            {/each}
          </svg>
        {/if}
      </Card>

      <!-- ── Table performance ── -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Table Revenue</h2>
        {#if !data.byTable?.length}
          <p class="text-sm text-neutral-400 py-8 text-center">No data.</p>
        {:else}
          <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
            {#each data.byTable.slice(0, 12) as t}
              {@const pct = Math.round((parseFloat(t.revenue ?? '0') / maxTableRevenue) * 100)}
              <div class="flex items-center gap-3">
                <span class="text-xs font-medium text-neutral-700 dark:text-neutral-300 w-20 shrink-0 truncate" title={t.tableName ?? 'Unknown'}>
                  {t.tableName ?? 'Unknown'}
                </span>
                <div class="flex-1 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    class="h-full rounded-md bg-emerald-500 dark:bg-emerald-600 transition-all flex items-center justify-end pr-2"
                    style="width:{pct}%"
                  >
                    {#if pct > 20}<span class="text-xs font-medium text-white">{t.orders}</span>{/if}
                  </div>
                </div>
                <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-300 w-20 text-right">{fmt(t.revenue)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <!-- ── Order status funnel ── -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Order Status Breakdown</h2>
        <div class="space-y-2">
          {#each FUNNEL_ORDER as status}
            {@const cnt = funnelMap[status] ?? 0}
            {@const pct = Math.round((cnt / funnelMax) * 100)}
            {#if cnt > 0}
              <div class="flex items-center gap-3">
                <span class="text-xs font-medium capitalize w-20 shrink-0 text-neutral-600 dark:text-neutral-400">{status}</span>
                <div class="flex-1 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <div
                    class="h-full rounded-md transition-all flex items-center justify-end pr-2"
                    style="width:{pct}%; background-color:{FUNNEL_COLOR[status]}20; border-right: 3px solid {FUNNEL_COLOR[status]}"
                  >
                    <span class="text-xs font-semibold" style="color:{FUNNEL_COLOR[status]}">{cnt}</span>
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </Card>

      <!-- ── Hourly heat grid ── -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Hourly Activity Grid</h2>
        <div class="overflow-x-auto">
          <div class="grid gap-1" style="grid-template-columns: repeat(24, minmax(0, 1fr)); min-width: 480px">
            {#each Array.from({ length: 24 }, (_, h) => h) as h}
              {@const v = hourMap[h] ?? { orders: 0 }}
              {@const intensity = v.orders / maxHourOrders}
              <div
                class="rounded text-center"
                style="background: rgba(99,102,241,{0.08 + intensity * 0.85}); height: 40px; display:flex; flex-direction:column; align-items:center; justify-content:center"
                title="{HOUR_LABELS[h]}: {v.orders} orders"
              >
                <span class="text-[8px] text-neutral-500 dark:text-neutral-400 leading-none">{HOUR_LABELS[h]}</span>
                {#if v.orders > 0}
                  <span class="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 leading-none mt-0.5">{v.orders}</span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </Card>
    </div>
  {/if}
</div>
