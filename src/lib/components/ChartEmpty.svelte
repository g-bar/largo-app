<script lang="ts">
	// Shown when a chart has no data for the current filter. The rest of the page still
	// renders; only this card degrades.
	let { title, subtitle }: { title: string; subtitle?: string } = $props()
</script>

<div class="card chart-card">
	<div class="chart-head">
		<div>
			<div class="chart-title">{title}</div>
			{#if subtitle}
				<div class="chart-subtitle">{subtitle}</div>
			{/if}
		</div>
	</div>
	<div class="chart empty">No data for this filter</div>
</div>

<style>
	.chart-card {
		padding: 16px 20px;
		min-width: 0;
	}
	.chart-head {
		display: flex;
		align-items: flex-start;
		margin-bottom: 8px;
	}
	.chart-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--heading-text);
	}
	.chart-subtitle {
		font-size: 12px;
		color: var(--muted-text);
		margin-top: 2px;
	}
	.chart {
		width: 100%;
		height: 300px;
	}
	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted-text);
		font-size: 13px;
		border: 1px dashed var(--control-border);
		border-radius: 6px;
	}
</style>
