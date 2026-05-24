<script lang="ts">
  import { onMount } from 'svelte'
  import { superAdminApi } from '$lib/api'
  import Card from '$lib/components/ui/Card.svelte'

  type Period = 'today' | 'week' | 'month' | 'quarter' | 'year'
  let period = $state<Period>('month')
  let data = $state<any>(null)
  let loading = $state(true)

  async function load() {
    loading = true
    const res = await superAdminApi.getAnalytics(period)
    if (res.data) data = res.data
    loading = false
  }

  onMount(load)
  $effect(() => { if (period) load() })

  function fmt(val?: string | number | null) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      parseFloat(String(val ?? '0'))
    )
  }

  const DOW_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
    i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
  )
  const STATUS_COLOR: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#3b82f6', preparing: '#8b5cf6',
    ready: '#10b981', served: '#6b7280', cancelled: '#ef4444',
  }
  const PLAN_COLOR: Record<string, string> = {
    free: '#6b7280', basic: '#3b82f6', pro: '#8b5cf6', enterprise: '#f59e0b',
  }
  const ORG_STATUS_COLOR: Record<string, string> = {
    trial: '#f59e0b', active: '#10b981', suspended: '#ef4444', inactive: '#6b7280',
  }

  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: '7 Days' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: '90 Days' },
    { value: 'year', label: 'This Year' },
  ]

  let hourMap = $derived((() => {
    const m: Record<number, { orders: number; revenue: number }> = {}
    for (let i = 0; i < 24; i++) m[i] = { orders: 0, revenue: 0 }
    for (const r of data?.byHour ?? []) m[Math.round(r.hour)] = { orders: Number(r.orders), revenue: parseFloat(r.revenue ?? '0') }
    return m
  })())
  let maxHourOrders = $derived(Math.max(1, ...Object.values(hourMap).map((h) => h.orders)))

  let dowMap = $derived((() => {
    const m: Record<number, { orders: number; revenue: number }> = {}
    for (let i = 0; i < 7; i++) m[i] = { orders: 0, revenue: 0 }
    for (const r of data?.byDow ?? []) m[Math.round(r.dow)] = { orders: Number(r.orders), revenue: parseFloat(r.revenue ?? '0') }
    return m
  })())
  let maxDowOrders = $derived(Math.max(1, ...Object.values(dowMap).map((d) => d.orders)))
  let dailyMax = $derived(Math.max(1, ...(data?.dailyRevenue ?? []).map((d: any) => parseFloat(d.revenue ?? '0'))))
  let orgGrowthMax = $derived(Math.max(1, ...(data?.orgGrowth ?? []).map((d: any) => Number(d.newOrgs))))
  let statusMax = $derived(Math.max(1, ...(data?.statusBreakdown ?? []).map((s: any) => Number(s.count))))
  let planTotal = $derived((data?.planDistribution ?? []).reduce((s: number, p: any) => s + Number(p.count), 0) || 1)
  let orgStatusTotal = $derived((data?.statusDistribution ?? []).reduce((s: number, d: any) => s + Number(d.count), 0) || 1)

  function wagonWheel() {
    const cx = 130, cy = 130, r = 110, innerR = 40
    return Array.from({ length: 24 }, (_, h) => {
      const s = (h / 24) * 2 * Math.PI - Math.PI / 2
      const e = ((h + 1) / 24) * 2 * Math.PI - Math.PI / 2
      const intensity = (hourMap[h]?.orders ?? 0) / maxHourOrders
      const d = `M ${cx + innerR * Math.cos(s)} ${cy + innerR * Math.sin(s)} L ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)} L ${cx + innerR * Math.cos(e)} ${cy + innerR * Math.sin(e)} A ${innerR} ${innerR} 0 0 0 ${cx + innerR * Math.cos(s)} ${cy + innerR * Math.sin(s)} Z`
      const hue = h >= 6 && h < 14 ? 200 : h >= 14 && h < 20 ? 150 : 240
      return { d, fill: intensity === 0 ? '#1f2937' : `hsl(${hue},${40 + intensity * 50}%,${25 + intensity * 35}%)`, orders: hourMap[h]?.orders ?? 0, h }
    })
  }

  function donutSlices(rows: any[], colorMap: Record<string, string>, key: string, total: number) {
    let start = -90
    return rows.map((p) => {
      const pct = (Number(p.count) / total) * 360
      const s = (start * Math.PI) / 180, e = ((start + pct) * Math.PI) / 180
      const la = pct > 180 ? 1 : 0
      const slice = {
        d: `M ${60 + 28 * Math.cos(s)} ${60 + 28 * Math.sin(s)} L ${60 + 50 * Math.cos(s)} ${60 + 50 * Math.sin(s)} A 50 50 0 ${la} 1 ${60 + 50 * Math.cos(e)} ${60 + 50 * Math.sin(e)} L ${60 + 28 * Math.cos(e)} ${60 + 28 * Math.sin(e)} A 28 28 0 ${la} 0 ${60 + 28 * Math.cos(s)} ${60 + 28 * Math.sin(s)} Z`,
        color: colorMap[p[key] ?? ''] ?? '#6b7280',
        label: p[key], count: p.count,
      }
      start += pct
      return slice
    })
  }
</script>

<svelte:head>
  <title>Analytics - Super Admin</title>
</svelte:head>

<div class="p-6 lg:p-8 space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Platform Analytics</h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Performance metrics across all organizations.</p>
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
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {#each Array(8) as _}
        <div class="h-24 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"></div>
      {/each}
    </div>
  {:else if data}
    <!-- KPIs -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {#each [
        { label: 'Total Revenue', value: fmt(data.summary?.totalRevenue) },
        { label: 'Total Orders', value: String(data.summary?.totalOrders ?? 0) },
        { label: 'Avg Order Value', value: fmt(data.summary?.avgOrderValue) },
        { label: 'Total Tables', value: String(data.summary?.totalTables ?? 0) },
      ] as stat}
        <Card>
          <p class="text-xs font-medium text-neutral-500 uppercase tracking-wide">{stat.label}</p>
          <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{stat.value}</p>
        </Card>
      {/each}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- Wagon wheel -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">24-Hour Order Heatmap</h2>
        <p class="text-xs text-neutral-400 mb-3">Platform-wide orders by hour. Darker = more activity.</p>
        <div class="flex justify-center">
          <svg viewBox="0 0 260 260" class="w-full max-w-[260px]">
            {#each wagonWheel() as seg}
              <path d={seg.d} fill={seg.fill}><title>{HOUR_LABELS[seg.h]}: {seg.orders} orders</title></path>
            {/each}
            {#each [0, 3, 6, 9, 12, 15, 18, 21] as h}
              {@const angle = ((h + 0.5) / 24) * 2 * Math.PI - Math.PI / 2}
              <text x={130 + 122 * Math.cos(angle)} y={130 + 122 * Math.sin(angle)}
                text-anchor="middle" dominant-baseline="middle" font-size="8" class="fill-neutral-400">
                {HOUR_LABELS[h]}
              </text>
            {/each}
            <text x="130" y="126" text-anchor="middle" font-size="9" class="fill-neutral-400">Orders</text>
            <text x="130" y="138" text-anchor="middle" font-size="9" class="fill-neutral-500">by hour</text>
          </svg>
        </div>
      </Card>

      <!-- DOW bars -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Orders by Day of Week</h2>
        <div class="space-y-2">
          {#each DOW_LABEL as day, i}
            {@const v = dowMap[i] ?? { orders: 0, revenue: 0 }}
            {@const pct = Math.round((v.orders / maxDowOrders) * 100)}
            <div class="flex items-center gap-3">
              <span class="text-xs font-medium text-neutral-500 w-8 shrink-0">{day}</span>
              <div class="flex-1 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div class="h-full rounded-md bg-violet-500 dark:bg-violet-600 flex items-center justify-end pr-2 transition-all" style="width:{pct}%">
                  {#if pct > 15}<span class="text-xs font-medium text-white">{v.orders}</span>{/if}
                </div>
              </div>
              {#if pct <= 15}<span class="text-xs text-neutral-400 w-6 text-right">{v.orders}</span>{:else}<span class="w-6"></span>{/if}
              <span class="text-xs text-neutral-400 w-20 text-right">{fmt(v.revenue)}</span>
            </div>
          {/each}
        </div>
      </Card>

      <!-- Revenue trend -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Revenue Trend</h2>
        {#if !data.dailyRevenue?.length}
          <p class="text-sm text-neutral-400 text-center py-8">No data.</p>
        {:else}
          {@const pts = data.dailyRevenue.map((d: any, i: number) => ({
            x: (i / Math.max(data.dailyRevenue.length - 1, 1)) * 460 + 20,
            y: 120 - (parseFloat(d.revenue ?? '0') / dailyMax) * 100,
            rev: d.revenue, date: d.date, orders: d.orders,
          }))}
          <svg viewBox="0 0 500 140" class="w-full">
            {#each [0,25,50,75,100] as g}
              <line x1="20" y1={120-g} x2="480" y2={120-g} stroke="currentColor" stroke-opacity="0.07" stroke-width="1"/>
            {/each}
            <defs>
              <linearGradient id="sa-rg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>
              </linearGradient>
            </defs>
            {#if pts.length > 1}
              <path d="M {pts[0].x} 120 {pts.map((p: any) => `L ${p.x} ${p.y}`).join(' ')} L {pts[pts.length-1].x} 120 Z" fill="url(#sa-rg)"/>
              <polyline points={pts.map((p: any) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>
            {/if}
            {#each pts as pt}
              <circle cx={pt.x} cy={pt.y} r="3" fill="#3b82f6" stroke="white" stroke-width="1.5">
                <title>{pt.date}: {fmt(pt.rev)} ({pt.orders} orders)</title>
              </circle>
            {/each}
            {#each [0, Math.floor(pts.length/2), pts.length-1] as idx}
              {#if pts[idx]}<text x={pts[idx].x} y="135" text-anchor="middle" font-size="8" class="fill-neutral-400">{pts[idx].date?.slice(5)}</text>{/if}
            {/each}
          </svg>
        {/if}
      </Card>

      <!-- Org growth -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">New Organizations</h2>
        {#if !data.orgGrowth?.length}
          <p class="text-sm text-neutral-400 text-center py-8">No new orgs in this period.</p>
        {:else}
          {@const pts = data.orgGrowth.map((d: any, i: number) => ({
            x: (i / Math.max(data.orgGrowth.length - 1, 1)) * 460 + 20,
            y: 100 - (Number(d.newOrgs) / orgGrowthMax) * 80,
            n: d.newOrgs, date: d.date,
          }))}
          <svg viewBox="0 0 500 120" class="w-full">
            <defs>
              <linearGradient id="sa-og" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#10b981" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#10b981" stop-opacity="0.02"/>
              </linearGradient>
            </defs>
            {#if pts.length > 1}
              <path d="M {pts[0].x} 110 {pts.map((p: any) => `L ${p.x} ${p.y}`).join(' ')} L {pts[pts.length-1].x} 110 Z" fill="url(#sa-og)"/>
              <polyline points={pts.map((p: any) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#10b981" stroke-width="2" stroke-linejoin="round"/>
            {/if}
            {#each pts as pt}
              <circle cx={pt.x} cy={pt.y} r="3.5" fill="#10b981" stroke="white" stroke-width="1.5">
                <title>{pt.date}: {pt.n} new org{pt.n !== 1 ? 's' : ''}</title>
              </circle>
            {/each}
          </svg>
          <p class="text-xs text-neutral-400 text-center mt-1">
            {data.orgGrowth.reduce((s: number, d: any) => s + Number(d.newOrgs), 0)} new organizations this period
          </p>
        {/if}
      </Card>

      <!-- Hourly grid -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Hourly Activity Grid</h2>
        <div class="overflow-x-auto">
          <div class="grid gap-1" style="grid-template-columns: repeat(24, minmax(0, 1fr)); min-width: 480px">
            {#each Array.from({ length: 24 }, (_, h) => h) as h}
              {@const v = hourMap[h] ?? { orders: 0 }}
              {@const intensity = v.orders / maxHourOrders}
              <div style="background: rgba(99,102,241,{0.08 + intensity * 0.85}); height:44px; display:flex; flex-direction:column; align-items:center; justify-content:center" class="rounded" title="{HOUR_LABELS[h]}: {v.orders}">
                <span class="text-[8px] text-neutral-500 leading-none">{HOUR_LABELS[h]}</span>
                {#if v.orders > 0}<span class="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 leading-none mt-0.5">{v.orders}</span>{/if}
              </div>
            {/each}
          </div>
        </div>
      </Card>

      <!-- Order status -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Order Status Breakdown</h2>
        <div class="space-y-2">
          {#each (data.statusBreakdown ?? []).slice().sort((a: any, b: any) => Number(b.count) - Number(a.count)) as row}
            {@const pct = Math.round((Number(row.count) / statusMax) * 100)}
            {@const color = STATUS_COLOR[row.status] ?? '#6b7280'}
            <div class="flex items-center gap-3">
              <span class="text-xs font-medium capitalize w-20 shrink-0 text-neutral-600 dark:text-neutral-400">{row.status}</span>
              <div class="flex-1 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div class="h-full rounded-md flex items-center justify-end pr-2 transition-all"
                  style="width:{pct}%; background-color:{color}20; border-right:3px solid {color}">
                  <span class="text-xs font-semibold" style="color:{color}">{row.count}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </Card>

      <!-- Top orgs -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Top Organizations by Revenue</h2>
        {#if !data.topOrganizations?.length}
          <p class="text-sm text-neutral-400 text-center py-8">No data.</p>
        {:else}
          {@const maxR = Math.max(1, ...data.topOrganizations.map((o: any) => parseFloat(o.totalRevenue ?? '0')))}
          <div class="space-y-2">
            {#each data.topOrganizations as org, i}
              {@const pct = Math.round((parseFloat(org.totalRevenue ?? '0') / maxR) * 100)}
              <div class="flex items-center gap-3">
                <span class="text-xs font-bold text-neutral-400 w-5 text-center">{i + 1}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">{org.name}</p>
                  <div class="mt-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div class="h-full rounded-full bg-brand-500 transition-all" style="width:{pct}%"></div>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{fmt(org.totalRevenue)}</p>
                  <p class="text-xs text-neutral-400">{org.orderCount} orders</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <!-- Top items -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Top Menu Items (Platform)</h2>
        {#if !data.topItems?.length}
          <p class="text-sm text-neutral-400 text-center py-8">No data.</p>
        {:else}
          {@const maxQ = Math.max(1, ...data.topItems.map((it: any) => Number(it.totalQuantity)))}
          <div class="space-y-2">
            {#each data.topItems as item, i}
              {@const pct = Math.round((Number(item.totalQuantity) / maxQ) * 100)}
              <div class="flex items-center gap-3">
                <span class="text-xs font-bold text-neutral-400 w-5 text-center">{i + 1}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">{item.name}</p>
                  <div class="mt-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div class="h-full rounded-full bg-amber-400 transition-all" style="width:{pct}%"></div>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{fmt(item.totalRevenue)}</p>
                  <p class="text-xs text-neutral-400">×{item.totalQuantity}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>

      <!-- Plan donut -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Subscription Plans</h2>
        {#if data.planDistribution?.length}
          {@const slices = donutSlices(data.planDistribution, PLAN_COLOR, 'plan', planTotal)}
          <div class="flex items-center justify-center gap-6 flex-wrap">
            <svg viewBox="0 0 120 120" class="w-28 h-28 shrink-0">
              {#each slices as s}<path d={s.d} fill={s.color}><title>{s.label}: {s.count}</title></path>{/each}
              <text x="60" y="56" text-anchor="middle" font-size="9" class="fill-neutral-400">Plans</text>
              <text x="60" y="67" text-anchor="middle" font-size="11" font-weight="bold" class="fill-neutral-700 dark:fill-neutral-300">{planTotal}</text>
            </svg>
            <div class="space-y-2">
              {#each data.planDistribution as p}
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full" style="background:{PLAN_COLOR[p.plan ?? ''] ?? '#6b7280'}"></span>
                  <span class="text-xs capitalize text-neutral-600 dark:text-neutral-400 w-20">{p.plan ?? 'unknown'}</span>
                  <span class="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{p.count}</span>
                  <span class="text-xs text-neutral-400">({Math.round((Number(p.count)/planTotal)*100)}%)</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </Card>

      <!-- Org status donut -->
      <Card>
        <h2 class="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Organization Status</h2>
        {#if data.statusDistribution?.length}
          {@const slices = donutSlices(data.statusDistribution, ORG_STATUS_COLOR, 'status', orgStatusTotal)}
          <div class="flex items-center justify-center gap-6 flex-wrap">
            <svg viewBox="0 0 120 120" class="w-28 h-28 shrink-0">
              {#each slices as s}<path d={s.d} fill={s.color}><title>{s.label}: {s.count}</title></path>{/each}
              <text x="60" y="56" text-anchor="middle" font-size="9" class="fill-neutral-400">Orgs</text>
              <text x="60" y="67" text-anchor="middle" font-size="11" font-weight="bold" class="fill-neutral-700 dark:fill-neutral-300">{orgStatusTotal}</text>
            </svg>
            <div class="space-y-2">
              {#each data.statusDistribution as s}
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full" style="background:{ORG_STATUS_COLOR[s.status ?? ''] ?? '#6b7280'}"></span>
                  <span class="text-xs capitalize text-neutral-600 dark:text-neutral-400 w-20">{s.status ?? 'unknown'}</span>
                  <span class="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{s.count}</span>
                  <span class="text-xs text-neutral-400">({Math.round((Number(s.count)/orgStatusTotal)*100)}%)</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </Card>

    </div>
  {:else}
    <Card>
      <p class="text-center text-neutral-500 py-12">No data available for this period.</p>
    </Card>
  {/if}
</div>
