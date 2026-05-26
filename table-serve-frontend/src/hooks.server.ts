import type { Handle } from '@sveltejs/kit'

// In production (Railway), VITE_API_BASE is set to the backend Railway URL.
// In dev, Vite's proxy handles /api → localhost:3000 so this is a no-op.
const API_BASE = process.env.VITE_API_BASE ?? ''

export const handle: Handle = async ({ event, resolve }) => {
  if (API_BASE && event.url.pathname.startsWith('/api')) {
    const upstream = `${API_BASE}${event.url.pathname}${event.url.search}`

    const headers = new Headers(event.request.headers)
    headers.set('x-forwarded-for', event.getClientAddress())
    // Strip host so the backend sees its own host
    headers.delete('host')

    const response = await fetch(upstream, {
      method: event.request.method,
      headers,
      body: ['GET', 'HEAD'].includes(event.request.method)
        ? undefined
        : event.request.body,
      // @ts-expect-error – node fetch duplex
      duplex: 'half',
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  }

  return resolve(event)
}
