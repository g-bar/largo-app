<script lang="ts">
	import type { EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartEmpty from './ChartEmpty.svelte'
	import ChartSkeleton from './ChartSkeleton.svelte'
	import { GREY_BAR, RED, barBase, makeView } from '#lib/chart.ts'
	import type { OrderedMap } from '#lib/server/types.ts'

	// Celebrity vs primary-category power factors. The category series is a benchmark on
	// a different population, so this chart compares subjects and is always shown as
	// rates: counts across a celebrity (people) and a category (ratings) are not
	// comparable, and category counts are meaningless on the celebrity's page. The %/#
	// toggle does not apply; this chart ignores `mode` and always renders %.
	type Slice = { data: OrderedMap; base: number }
	type Slices = { celeb: Slice | null; category: Slice | null }
	let {
		celebName,
		categoryName,
		slices,
		load,
	}: {
		celebName: string
		categoryName: string | null
		slices?: Slices
		load?: () => Promise<Slices>
	} = $props()

	let fetched = $state<Slices | undefined>()
	$effect(() => {
		if (!slices && load) load().then(d => (fetched = d))
	})
	const data = $derived(slices ?? fetched)

	const option = $derived.by<EChartsOption | undefined>(() => {
		if (!data || !data.celeb) return undefined
		const celeb = data.celeb
		const view = makeView('pct', celeb.base)
		const cats = Object.keys(celeb.data)
		const opt = barBase(view, cats, 60, 15, 30)
		const series = [
			{
				name: celebName,
				type: 'bar' as const,
				data: view.series(
					cats.map(k => celeb.data[k]),
					celeb.base,
				),
				itemStyle: { color: RED },
				label: view.barLabel(),
			},
		]
		if (data.category && categoryName) {
			const cat = data.category
			series.push({
				name: `${categoryName} Avg.`,
				type: 'bar' as const,
				data: view.series(
					cats.map(k => cat.data[k]),
					cat.base,
				),
				itemStyle: { color: GREY_BAR },
				label: { show: false },
			})
		}
		opt.series = series
		return opt
	})
</script>

{#if option}
	<ChartCard title="Power Factors&trade;" {option} exportId="power-factors" />
{:else if data}
	<ChartEmpty title="Power Factors&trade;" />
{:else}
	<ChartSkeleton title="Power Factors&trade;" />
{/if}
