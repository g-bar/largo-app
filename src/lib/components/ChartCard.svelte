<script lang="ts">
	import { onMount } from 'svelte'
	import * as echarts from 'echarts'
	import type { EChartsOption } from 'echarts'

	let { title, subtitle, option }: { title: string; subtitle?: string; option: EChartsOption } = $props()

	let el: HTMLDivElement
	let chart: echarts.ECharts

	onMount(() => {
		chart = echarts.init(el)
		chart.setOption(option, true)
		const onResize = () => chart.resize()
		window.addEventListener('resize', onResize)
		return () => {
			window.removeEventListener('resize', onResize)
			chart.dispose()
		}
	})

	// Re-apply whenever the builder returns a new option (e.g. the %/# toggle).
	$effect(() => {
		if (chart) chart.setOption(option, true)
	})
</script>

<div class="card chart-card">
	<div class="chart-head">
		<div>
			<div class="chart-title">{title}</div>
			{#if subtitle}
				<div class="chart-subtitle">{subtitle}</div>
			{/if}
		</div>
		<div class="chart-actions"><span>&hellip;</span><span>&#8599;</span></div>
	</div>
	<div class="chart" bind:this={el}></div>
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
	.chart-actions {
		margin-left: auto;
		display: flex;
		gap: 12px;
		color: var(--muted-text-2);
	}
	.chart-actions span {
		cursor: pointer;
		font-size: 16px;
	}
	.chart {
		width: 100%;
		height: 300px;
		min-width: 0;
	}
</style>
