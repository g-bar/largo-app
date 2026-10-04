import process from 'node:process'
import adapter from '@sveltejs/adapter-node'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
	// Vite loads .env into import.meta.env, not process.env. The server-only db
	// client reads process.env.DATABASE_URL (SvelteKit 3 has no $env/dynamic/private),
	// so copy the loaded vars across for dev / preview / build. In production the
	// real environment (or `node --env-file=.env build`) provides them.
	Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

	return {
		plugins: [
			sveltekit({
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
				},
				adapter: adapter(),
			}),
		],
	}
})
