<script lang="ts">
	import type { EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartSkeleton from './ChartSkeleton.svelte'
	import { RED, type Mode, barBase, makeView } from '#lib/chart.ts'
	import type { OrderedMap } from '#lib/server/types.ts'

	// Brad Pitt's attributes for total / male / female. In # mode each gender shows
	// literal counts on its own aware base (no indexing); bars are honest tallies, not
	// rescaled to a common base.
	type Slice = { data: OrderedMap; base: number }
	type Slices = { total: Slice; male: Slice; female: Slice }
	let {
		mode,
		slices,
		load,
	}: {
		mode: Mode
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
		const axisBase = Math.max(d.total.base, d.male.base, d.female.base)
		const view = makeView(mode, axisBase)
		const cats = Object.keys(d.total.data)
		const opt = barBase(view, cats, 60, 15, 30)
		opt.series = [
			{
				name: 'Total',
				type: 'bar',
				data: view.series(cats.map(k => d.total.data[k]), d.total.base),
				itemStyle: { color: RED },
				label: view.barLabel(),
			},
			{
				name: 'Male',
				type: 'bar',
				data: view.series(cats.map(k => d.male.data[k]), d.male.base),
				itemStyle: { color: '#4A76A8' },
			},
			{
				name: 'Female',
				type: 'bar',
				data: view.series(cats.map(k => d.female.data[k]), d.female.base),
				itemStyle: { color: '#E8A8C8' },
			},
		]
		return opt
	})
</script>

{#if option}
	<ChartCard title="Attributes" {option} />
{:else}
	<ChartSkeleton title="Attributes" />
{/if}
