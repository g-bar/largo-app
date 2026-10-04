<script lang="ts">
	import { getScorecard, DATE, makeView, type Mode } from '#lib/scorecard.ts'

	const AWARENESS_CATEGORIES = [
		{ id: 'film-personality-actor', label: 'Film Personality - Actor', color: '#4A76A8' },
		{
			id: 'film-personality-actor-action-adventure',
			label: 'Film Personality - Actor - Action-Adventure',
			color: '#6B9AD4',
		},
		{ id: 'spokesperson', label: 'Spokesperson', color: '#8AB4E8' },
		{
			id: 'film-personality-actor-romance',
			label: 'Film Personality - Actor - Romance',
			color: '#A8C8F0',
		},
		{ id: 'streaming-actor', label: 'Streaming Actor', color: '#C4DBF5' },
	]

	let { mode, base }: { mode: Mode; base: number } = $props()
	const view = $derived(makeView(mode, base))

	const bp = $derived(getScorecard('brad-pitt', 'total', DATE))
	const indexed = $derived(!view.isPct)
	const categories = $derived(
		AWARENESS_CATEGORIES.map(cat => ({
			...cat,
			pct: getScorecard(cat.id, 'total', DATE).awareness,
		})),
	)
</script>

<div class="card awareness-card">
	<div class="awareness-title">Awareness</div>
	<div class="awareness-value">
		{#if indexed}
			{view.value(bp.awareness)}<sup class="awareness-base"> / {view.refBase.toLocaleString()} *</sup>
		{:else}
			{bp.awareness}%
		{/if}
	</div>
	<div class="awareness-sub">
		Category Averages for this Celebrity:{indexed ? ' *' : ''}
	</div>
	<ul class="awareness-list">
		{#each categories as cat (cat.id)}
			<li class:indexed>
				<span class="dot" style="background:{cat.color}"></span>
				<span class="cat-name">{cat.label}</span>
				<span class="cat-pct">{view.fmt(cat.pct)}</span>
			</li>
		{/each}
	</ul>
	<div class="awareness-indexed-note" hidden={!indexed}>* Brad Pitt respondents base</div>
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
