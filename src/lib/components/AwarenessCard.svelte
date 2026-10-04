<script lang="ts">
	import type { Mode } from '#lib/chart.ts'

	// Awareness % (derived from the aware counts in the load) for the celebrity plus
	// the category-average awareness for each benchmark. Awareness is a whole-sample
	// fact, so in # mode it reads as a count out of the sample base (sampleBase), e.g.
	// 60% -> 720 / 1,200.
	const DOT_COLORS = ['#4A76A8', '#6B9AD4', '#8AB4E8', '#A8C8F0', '#C4DBF5']

	let {
		mode,
		sampleBase,
		awareness,
		categories,
	}: {
		mode: Mode
		sampleBase: number
		awareness: number
		categories: { id: string; label: string; awareness: number | null }[]
	} = $props()

	const indexed = $derived(mode === 'count')
	const toCount = (pct: number) => Math.round((pct * sampleBase) / 100)
	const fmt = (pct: number | null) => (pct === null ? '-' : indexed ? String(toCount(pct)) : pct + '%')
</script>

<div class="card awareness-card">
	<div class="awareness-title">Awareness</div>
	<div class="awareness-value">
		{#if indexed}
			{toCount(awareness)}<sup class="awareness-base"> / {sampleBase.toLocaleString()} *</sup>
		{:else}
			{awareness}%
		{/if}
	</div>
	<div class="awareness-sub">
		Category Averages for this Celebrity:{indexed ? ' *' : ''}
	</div>
	<ul class="awareness-list">
		{#each categories as cat, i (cat.id)}
			<li class:indexed>
				<span class="dot" style="background:{DOT_COLORS[i % DOT_COLORS.length]}"></span>
				<span class="cat-name">{cat.label}</span>
				<span class="cat-pct">{fmt(cat.awareness)}</span>
			</li>
		{/each}
	</ul>
	<div class="awareness-indexed-note" hidden={!indexed}>* Count out of sample base</div>
</div>

<style>
	.awareness-card {
		padding: 20px 24px;
	}
	.awareness-title {
		text-align: center;
		font-size: 15px;
		font-weight: 700;
		color: var(--heading-text);
	}
	.awareness-value {
		text-align: center;
		font-size: 44px;
		font-weight: 700;
		color: var(--awareness-purple);
		line-height: 1.1;
	}
	.awareness-base {
		font-size: 13px;
		font-weight: 400;
		color: var(--muted-text);
	}
	.awareness-sub {
		text-align: center;
		font-size: 12px;
		color: var(--muted-text);
		margin: 8px 0 12px;
	}
	.awareness-list {
		list-style: none;
		font-size: 13px;
	}
	.awareness-list li {
		display: flex;
		align-items: center;
		padding: 3px 0;
	}
	.awareness-list .dot {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		margin-right: 8px;
		flex-shrink: 0;
	}
	.awareness-list .cat-name {
		color: var(--body-text);
	}
	.awareness-list .cat-pct {
		margin-left: auto;
		font-weight: 500;
		color: var(--heading-text);
	}
	/* Indexed (counterfactual) counts read as reference, not observed tallies. */
	.awareness-list li.indexed .cat-name,
	.awareness-list li.indexed .cat-pct {
		color: var(--muted-text);
		font-weight: 400;
	}
	.awareness-indexed-note {
		font-size: 11px;
		color: var(--muted-text);
		font-style: italic;
		margin-top: 8px;
	}
</style>
