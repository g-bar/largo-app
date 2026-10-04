<script lang="ts">
	import type { EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartEmpty from './ChartEmpty.svelte'
	import ChartSkeleton from './ChartSkeleton.svelte'
	import { GREY_BAR, RED, type Mode, barBase, makeView } from '#lib/chart.ts'
	import type { OrderedMap } from '#lib/server/types.ts'

	// Celebrity vs primary-category power factors. The celebrity series is measured
	// among people aware of the celebrity; the category series is the pool of its member
	// actors' ratings (one respondent x one actor = one rating), flagged "(ratings)". In
	// # mode each series shows literal counts on its own base. If the celebrity slice is
	// null the chart is empty; a null category slice just drops that series.
	type Slice = { data: OrderedMap; base: number }
	type Slices = { celeb: Slice | null; category: Slice | null }
	let {
		mode,
		celebName,
		categoryName,
		slices,
		load,
	}: {
		mode: Mode
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
		const bases = [celeb.base, ...(data.category ? [data.category.base] : [])]
		const view = makeView(mode, Math.max(...bases))
		const cats = Object.keys(celeb.data)
		const opt = barBase(view, cats, 60, 15, 30)
		const series = [
			{
				name: celebName,
				type: 'bar' as const,
				data: view.series(cats.map(k => celeb.data[k]), celeb.base),
				itemStyle: { color: RED },
				label: view.barLabel(),
			},
		]
		if (data.category && categoryName) {
			const cat = data.category
			series.push({
				name: `${categoryName} Avg. (ratings)`,
				type: 'bar' as const,
				data: view.series(cats.map(k => cat.data[k]), cat.base),
				itemStyle: { color: GREY_BAR },
				label: { show: false },
			})
		}
		opt.series = series
		return opt
	})
</script>

{#if option}
	<ChartCard title="Power Factors&trade;" {option} />
{:else if data}
	<ChartEmpty title="Power Factors&trade;" />
{:else}
	<ChartSkeleton title="Power Factors&trade;" />
{/if}
