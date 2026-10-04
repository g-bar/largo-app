export default [
	{
		ignores: [
			'.svelte-kit/',
			'build/',
			'dist/',
			'node_modules/',
			'package-lock.json',
			'pnpm-lock.yaml',
			'vite.config.ts',
			'**/*.json',
		],
	},
	{
		rules: {
			'no-console': ['error', { allow: ['warn', 'error'] }],
		},
	},
]
