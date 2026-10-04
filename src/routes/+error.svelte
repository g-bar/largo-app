<script lang="ts">
	import { page } from '$app/state'

	// Friendly label for the common statuses; fall back to the raw message otherwise.
	const headlines: Record<number, string> = {
		404: 'Not found',
		500: 'Something went wrong',
	}
	const headline = $derived(headlines[page.status] ?? 'Error')
	const detail = $derived(page.error?.message ?? '')
</script>

<svelte:head>
	<title>{page.status} - Largo E-Score</title>
</svelte:head>

<main class="content error-page">
	<div class="card error-card">
		<div class="badge">E-SCORE</div>
		<div class="status">{page.status}</div>
		<h1 class="headline">{headline}</h1>
		{#if detail}
			<p class="detail">{detail}</p>
		{/if}
		<a class="home" href="/">Back to scorecard</a>
	</div>
</main>

<style>
	.error-page {
		display: flex;
		justify-content: center;
		padding-top: 72px;
	}
	.error-card {
		position: relative;
		overflow: hidden;
		width: 420px;
		max-width: 100%;
		padding: 40px 32px 32px;
		text-align: center;
	}
	/* Red accent bar across the top, echoing the brand. */
	.error-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 6px;
		background: var(--brand-red);
	}
	.badge {
		display: inline-block;
		background: var(--brand-red);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1px;
		padding: 5px 10px;
		border-radius: 4px;
		margin-bottom: 20px;
	}
	.status {
		font-size: 88px;
		font-weight: 800;
		line-height: 1;
		color: var(--brand-red);
		letter-spacing: -2px;
		/* Subtle ghost shadow so the number pops. */
		text-shadow: 0 2px 0 rgba(190, 30, 45, 0.12);
	}
	.headline {
		font-size: 22px;
		font-weight: 700;
		color: var(--heading-text);
		margin-top: 8px;
	}
	.detail {
		font-size: 14px;
		color: var(--muted-text);
		margin-top: 10px;
	}
	.home {
		display: inline-block;
		margin-top: 24px;
		background: var(--brand-red);
		color: #fff;
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		padding: 10px 22px;
		border-radius: 4px;
	}
	.home:hover {
		background: #a51a27;
	}
</style>
