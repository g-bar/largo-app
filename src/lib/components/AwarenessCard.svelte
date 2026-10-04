<script lang="ts">
	// Awareness for the celebrity plus the category-average awareness for each
	// benchmark. Always shown as percentages: awareness is a rate, and the category list
	// compares different subjects with different bases, where only a rate is comparable
	// (raw counts across categories are not). So the %/# toggle does NOT affect this
	// card.
	const DOT_COLORS = ['#4A76A8', '#6B9AD4', '#8AB4E8', '#A8C8F0', '#C4DBF5']

	let {
		awareness,
		categories,
	}: {
		awareness: number
		categories: { id: string; label: string; pct: number | null }[]
	} = $props()

	const fmt = (pct: number | null) => (pct === null ? '-' : pct + '%')
</script>

<div class="card awareness-card">
	<div class="awareness-title">Awareness</div>
	<div class="awareness-value">{awareness}%</div>
	<div class="awareness-sub">Category Averages for this Celebrity:</div>
	<ul class="awareness-list">
		{#each categories as cat, i (cat.id)}
			<li>
				<span class="dot" style="background:{DOT_COLORS[i % DOT_COLORS.length]}"></span>
				<span class="cat-name">{cat.label}</span>
				<span class="cat-pct">{fmt(cat.pct)}</span>
			</li>
		{/each}
	</ul>
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
</style>
