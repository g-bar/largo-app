<script lang="ts">
	import type { EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartSkeleton from './ChartSkeleton.svelte'
	import { GREY_BAR, RED, type Mode, barBase, makeView } from '#lib/chart.ts'
	import type { OrderedMap } from '#lib/server/types.ts'

	// Celebrity vs primary-category power factors. The celebrity series is measured
	// among people aware of the celebrity; the category series is the pool of its member
	// actors' ratings (one respondent x one actor = one rating). Different units, so the
	// category legend is flagged "(ratings)". In # mode each series shows literal counts
	// on its own base.
	type Slice = { data: OrderedMap; base: number }
	type Slices = { celeb: Slice; category: Slice }
	let {
		mode,
		celebName,
		categoryName,
		slices,
		load,
	}: {
		mode: Mode
		celebName: string
		categoryName: string
		slices?: Slices
		load?: () => Promise<Slices>
	} = $props()

	let fetched = $state<Slices | undefined>()
	$effect(() => {
		if (!slices && load) load().then(d => (fetched = d))
	})
	const data = $derived(slices ?? fetched)

	const option = $derived.by<EChartsOption | undefined>(() => {
		if (!data) return undefined
		const d = data
		const axisBase = Math.max(d.celeb.base, d.category.base)
		const view = makeView(mode, axisBase)
		const cats = Object.keys(d.celeb.data)
		const opt = barBase(view, cats, 60, 15, 30)
		opt.series = [
			{
				name: celebName,
				type: 'bar',
				data: view.series(cats.map(k => d.celeb.data[k]), d.celeb.base),
				itemStyle: { color: RED },
				label: view.barLabel(),
			},
			{
				name: `${categoryName} Avg. (ratings)`,
				type: 'bar',
				data: view.series(cats.map(k => d.category.data[k]), d.category.base),
				itemStyle: { color: GREY_BAR },
			},
		]
		return opt
	})
</script>

{#if option}
	<ChartCard title="Power Factors&trade;" {option} />
{:else}
	<ChartSkeleton title="Power Factors&trade;" />
{/if}
