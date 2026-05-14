import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// In Docker the backend container is reachable at http://backend:3000.
// Locally it runs on localhost:3000.
const API_TARGET = process.env.VITE_API_BASE ?? 'http://localhost:3000';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		proxy: {
			'/api': {
				target: API_TARGET,
				changeOrigin: true,
				// Prevent the proxy from timing out on slow DB/auth responses
				proxyTimeout: 30_000,
				timeout: 30_000,
				configure(proxy) {
					proxy.on('error', (err, _req, res) => {
						console.error('[proxy error]', err.message)
						if ('headersSent' in res && !res.headersSent) {
							(res as any).writeHead(502, { 'Content-Type': 'application/json' })
						}
						res.end(JSON.stringify({ error: 'Backend unavailable. Please try again.' }))
					})
				},
			},
		},
	},
});
