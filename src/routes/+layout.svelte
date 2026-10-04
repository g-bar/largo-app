<script lang="ts">
	import '../app.css'
	import Nav from '#lib/components/Nav.svelte'
	import type { LayoutProps } from './$types'

	let { children }: LayoutProps = $props()
</script>

<Nav />

{@render children()}
