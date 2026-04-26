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
			},
		},
	},
});
