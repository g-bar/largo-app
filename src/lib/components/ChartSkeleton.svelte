<script lang="ts">
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
	<div class="chart skeleton"></div>
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
	.skeleton {
		border-radius: 6px;
		background: linear-gradient(90deg, #eef0f2 25%, #f6f7f8 37%, #eef0f2 63%);
		background-size: 400% 100%;
		animation: shimmer 1.4s ease infinite;
	}
	@keyframes shimmer {
		0% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0 50%;
		}
	}
</style>
