<script lang="ts">
  import { tick } from 'svelte'

  let {
    value = $bindable<string>(''),
    aspect = 1 as number,       // 1 = square (logo), 1.777 = 16:9 (banner)
    label = '',
    hint = '',
    placeholder = 'Upload image',
  }: {
    value?: string
    aspect?: number
    label?: string
    hint?: string
    placeholder?: string
  } = $props()

  let fileInput = $state<HTMLInputElement>()
  let previewCanvas = $state<HTMLCanvasElement>()
  let cropperOpen = $state(false)

  // Natural image
  let rawImg: HTMLImageElement | null = null
  let imgNatW = 0
  let imgNatH = 0

  // Canvas display size
  let canvasW = $state(480)
  let canvasH = $state(320)

  // Image rendered rect within canvas
  let imgX = 0, imgY = 0, imgW = 0, imgH = 0

  // Crop box in canvas coords
  let cx = $state(0), cy = $state(0), cw = $state(100), ch = $state(100)

  // Drag / resize
  let dragMode: 'move' | 'resize-br' | 'resize-bl' | 'resize-tr' | 'resize-tl' | null = null
  let dragOriginX = 0, dragOriginY = 0
  let cropOrigin = { cx: 0, cy: 0, cw: 0, ch: 0 }

  // ── File handling ──────────────────────────

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((res) => {
      const r = new FileReader()
      r.onload = (e) => res(e.target!.result as string)
      r.readAsDataURL(file)
    })
  }

  async function onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) { alert('File too large (max 8 MB)'); return }

    const dataUrl = await readAsDataUrl(file)
    rawImg = new Image()
    rawImg.onload = () => {
      imgNatW = rawImg!.naturalWidth
      imgNatH = rawImg!.naturalHeight
      cropperOpen = true
      tick().then(initCanvas)
    }
    rawImg.src = dataUrl
  }

  function initCanvas() {
    if (!previewCanvas || !rawImg) return
    const container = previewCanvas.parentElement!
    canvasW = Math.min(container.clientWidth || 480, 540)
    canvasH = Math.round(canvasW * (aspect >= 1.5 ? 0.56 : 0.72))
    previewCanvas.width = canvasW
    previewCanvas.height = canvasH

    // Scale image to fit canvas with padding
    const pad = 24
    const scaleX = (canvasW - pad * 2) / imgNatW
    const scaleY = (canvasH - pad * 2) / imgNatH
    const scale = Math.min(scaleX, scaleY)
    imgW = imgNatW * scale
    imgH = imgNatH * scale
    imgX = (canvasW - imgW) / 2
    imgY = (canvasH - imgH) / 2

    // Initial crop: 80% of image, centred, matching aspect ratio
    cw = imgW * 0.8
    ch = cw / aspect
    if (ch > imgH * 0.9) { ch = imgH * 0.9; cw = ch * aspect }
    cx = imgX + (imgW - cw) / 2
    cy = imgY + (imgH - ch) / 2

    draw()
  }

  function draw() {
    if (!previewCanvas || !rawImg) return
    const ctx = previewCanvas.getContext('2d')!
    ctx.clearRect(0, 0, canvasW, canvasH)

    // Checkerboard background (transparent areas)
    for (let tx = 0; tx < canvasW; tx += 12) {
      for (let ty = 0; ty < canvasH; ty += 12) {
        ctx.fillStyle = ((tx + ty) / 12) % 2 === 0 ? '#e5e7eb' : '#f3f4f6'
        ctx.fillRect(tx, ty, 12, 12)
      }
    }

    // Full image dimmed
    ctx.globalAlpha = 0.4
    ctx.drawImage(rawImg, imgX, imgY, imgW, imgH)
    ctx.globalAlpha = 1

    // Crop overlay: sharp image inside crop rect
    ctx.save()
    ctx.beginPath()
    ctx.rect(cx, cy, cw, ch)
    ctx.clip()
    ctx.drawImage(rawImg, imgX, imgY, imgW, imgH)
    ctx.restore()

    // Dark vignette outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, canvasW, cy)
    ctx.fillRect(0, cy + ch, canvasW, canvasH - cy - ch)
    ctx.fillRect(0, cy, cx, ch)
    ctx.fillRect(cx + cw, cy, canvasW - cx - cw, ch)

    // Crop border
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeRect(cx, cy, cw, ch)

    // Rule-of-thirds grid
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 1; i <= 2; i++) {
      ctx.moveTo(cx + (cw / 3) * i, cy)
      ctx.lineTo(cx + (cw / 3) * i, cy + ch)
      ctx.moveTo(cx, cy + (ch / 3) * i)
      ctx.lineTo(cx + cw, cy + (ch / 3) * i)
    }
    ctx.stroke()

    // Corner handles
    const hs = 10
    ctx.fillStyle = '#ffffff'
    const corners = [
      [cx, cy], [cx + cw - hs, cy],
      [cx, cy + ch - hs], [cx + cw - hs, cy + ch - hs],
    ]
    corners.forEach(([hx, hy]) => ctx.fillRect(hx, hy, hs, hs))
  }

  // ── Mouse / Touch ──────────────────────────

  function canvasPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const rect = previewCanvas!.getBoundingClientRect()
    const sx = canvasW / rect.width, sy = canvasH / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }
    }
    return { x: ((e as MouseEvent).clientX - rect.left) * sx, y: ((e as MouseEvent).clientY - rect.top) * sy }
  }

  function hitTest(x: number, y: number): typeof dragMode {
    const hs = 18
    if (Math.abs(x - cx) < hs && Math.abs(y - cy) < hs) return 'resize-tl'
    if (Math.abs(x - (cx + cw)) < hs && Math.abs(y - cy) < hs) return 'resize-tr'
    if (Math.abs(x - cx) < hs && Math.abs(y - (cy + ch)) < hs) return 'resize-bl'
    if (Math.abs(x - (cx + cw)) < hs && Math.abs(y - (cy + ch)) < hs) return 'resize-br'
    if (x > cx && x < cx + cw && y > cy && y < cy + ch) return 'move'
    return null
  }

  function onPointerDown(e: MouseEvent | TouchEvent) {
    e.preventDefault()
    const { x, y } = canvasPos(e)
    dragMode = hitTest(x, y)
    if (!dragMode) return
    dragOriginX = x; dragOriginY = y
    cropOrigin = { cx, cy, cw, ch }
  }

  function onPointerMove(e: MouseEvent | TouchEvent) {
    if (!dragMode) return
    e.preventDefault()
    const { x, y } = canvasPos(e)
    const dx = x - dragOriginX, dy = y - dragOriginY

    const minSize = 40
    if (dragMode === 'move') {
      cx = Math.max(imgX, Math.min(cropOrigin.cx + dx, imgX + imgW - cw))
      cy = Math.max(imgY, Math.min(cropOrigin.cy + dy, imgY + imgH - ch))
    } else if (dragMode === 'resize-br') {
      let nw = Math.max(minSize, cropOrigin.cw + dx)
      if (cropOrigin.cx + nw > imgX + imgW) nw = imgX + imgW - cropOrigin.cx
      cw = nw; ch = cw / aspect
      if (cy + ch > imgY + imgH) { ch = imgY + imgH - cy; cw = ch * aspect }
    } else if (dragMode === 'resize-bl') {
      let nw = Math.max(minSize, cropOrigin.cw - dx)
      const newCx = cropOrigin.cx + cropOrigin.cw - nw
      if (newCx < imgX) nw = cropOrigin.cw + cropOrigin.cx - imgX
      cx = cropOrigin.cx + cropOrigin.cw - nw
      cw = nw; ch = cw / aspect
    } else if (dragMode === 'resize-tr') {
      let nw = Math.max(minSize, cropOrigin.cw + dx)
      if (cropOrigin.cx + nw > imgX + imgW) nw = imgX + imgW - cropOrigin.cx
      const nh = nw / aspect
      cy = cropOrigin.cy + cropOrigin.ch - nh
      if (cy < imgY) { cy = imgY; ch = cropOrigin.ch; cw = ch * aspect } else { cw = nw; ch = nh }
    } else if (dragMode === 'resize-tl') {
      let nw = Math.max(minSize, cropOrigin.cw - dx)
      const newCx = cropOrigin.cx + cropOrigin.cw - nw
      if (newCx < imgX) nw = cropOrigin.cw + cropOrigin.cx - imgX
      const nh = nw / aspect
      cx = cropOrigin.cx + cropOrigin.cw - nw
      cy = cropOrigin.cy + cropOrigin.ch - nh
      if (cy < imgY) { cy = imgY; ch = cropOrigin.ch; cw = ch * aspect } else { cw = nw; ch = nh }
    }
    draw()
  }

  function onPointerUp() { dragMode = null }

  // ── Cursor style ─────────────────────────

  function onMouseMoveForCursor(e: MouseEvent) {
    if (!previewCanvas) return
    const { x, y } = canvasPos(e)
    const mode = hitTest(x, y)
    if (mode === 'move') previewCanvas.style.cursor = 'move'
    else if (mode?.startsWith('resize-br') || mode?.startsWith('resize-tl')) previewCanvas.style.cursor = 'nwse-resize'
    else if (mode?.startsWith('resize-tr') || mode?.startsWith('resize-bl')) previewCanvas.style.cursor = 'nesw-resize'
    else previewCanvas.style.cursor = 'default'
  }

  // ── Apply & Cancel ────────────────────────

  function applyCrop() {
    if (!rawImg) return
    const outW = aspect === 1 ? 512 : 1280
    const outH = Math.round(outW / aspect)
    const out = document.createElement('canvas')
    out.width = outW; out.height = outH
    const ctx = out.getContext('2d')!

    // Map crop box back to source image coords
    const srcX = (cx - imgX) / imgW * imgNatW
    const srcY = (cy - imgY) / imgH * imgNatH
    const srcW = cw / imgW * imgNatW
    const srcH = ch / imgH * imgNatH

    ctx.drawImage(rawImg, srcX, srcY, srcW, srcH, 0, 0, outW, outH)
    value = out.toDataURL('image/jpeg', 0.85)
    cropperOpen = false
    rawImg = null
    if (fileInput) fileInput.value = ''
  }

  function cancel() {
    cropperOpen = false
    rawImg = null
    if (fileInput) fileInput.value = ''
  }

  function removeImage() {
    value = ''
    rawImg = null
    if (fileInput) fileInput.value = ''
  }
</script>

<div class="space-y-2">
  {#if label}
    <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</p>
  {/if}

  <!-- Current image preview + controls -->
  <div class="flex items-start gap-3">
    {#if value}
      <div class="relative group shrink-0">
        <img
          src={value}
          alt="Preview"
          class="rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
          style="width:{aspect === 1 ? '72px' : '128px'}; height:{aspect === 1 ? '72px' : '72px'}"
        />
        <button
          type="button"
          class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
          onclick={removeImage}
          title="Remove"
        >×</button>
      </div>
    {:else}
      <div
        class="shrink-0 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-600 flex items-center justify-center text-neutral-400 text-xs"
        style="width:{aspect === 1 ? '72px' : '128px'}; height:72px"
      >
        {aspect === 1 ? 'Logo' : 'Banner'}
      </div>
    {/if}

    <div class="flex-1 space-y-2">
      <div class="flex gap-2">
        <label
          class="h-9 px-4 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {value ? 'Change image' : placeholder}
          <input bind:this={fileInput} type="file" accept="image/*" onchange={onFileChange} class="hidden" />
        </label>
      </div>
      {#if hint}
        <p class="text-xs text-neutral-400">{hint}</p>
      {/if}
    </div>
  </div>
</div>

<!-- Cropper modal -->
{#if cropperOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
    <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
        <h3 class="font-semibold text-neutral-900 dark:text-neutral-100">Crop Image</h3>
        <button type="button" onclick={cancel} class="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Canvas -->
      <div class="p-4 bg-neutral-100 dark:bg-neutral-950">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <canvas
          bind:this={previewCanvas}
          class="w-full rounded-lg touch-none select-none"
          onmousedown={onPointerDown}
          onmousemove={(e) => { onPointerMove(e); onMouseMoveForCursor(e) }}
          onmouseup={onPointerUp}
          onmouseleave={onPointerUp}
          ontouchstart={onPointerDown}
          ontouchmove={onPointerMove}
          ontouchend={onPointerUp}
        ></canvas>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between px-5 py-4 border-t border-neutral-200 dark:border-neutral-700 gap-3">
        <p class="text-xs text-neutral-400">Drag to move · Drag corners to resize</p>
        <div class="flex gap-2">
          <button
            type="button"
            onclick={cancel}
            class="h-9 px-4 rounded-lg border border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={applyCrop}
            class="h-9 px-5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
