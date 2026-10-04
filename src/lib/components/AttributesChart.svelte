<script lang="ts">
	import type { EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartEmpty from './ChartEmpty.svelte'
	import ChartSkeleton from './ChartSkeleton.svelte'
	import { RED, type Mode, barBase, makeView } from '#lib/chart.ts'
	import type { OrderedMap } from '#lib/server/types.ts'

	// Attributes for total / male / female. Comparison axis is gender (always all three,
	// ignoring the page gender filter; inherits age/fielding). In # mode each gender
	// shows literal counts on its own aware base. A null slice is omitted; if the Total
	// slice is null the chart shows an empty state.
	type Slice = { data: OrderedMap; base: number }
	type Slices = { total: Slice | null; male: Slice | null; female: Slice | null }
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
		if (!data || !data.total) return undefined
		const series = [{ name: 'Total', color: RED, slice: data.total }]
		if (data.male) series.push({ name: 'Male', color: '#4A76A8', slice: data.male })
		if (data.female) series.push({ name: 'Female', color: '#E8A8C8', slice: data.female })
		const axisBase = Math.max(...series.map(s => s.slice.base))
		const view = makeView(mode, axisBase)
		const cats = Object.keys(data.total.data)
		const opt = barBase(view, cats, 60, 15, 30)
		opt.series = series.map(s => ({
			name: s.name,
			type: 'bar' as const,
			data: view.series(cats.map(k => s.slice.data[k]), s.slice.base),
			itemStyle: { color: s.color },
			label: s.name === 'Total' ? view.barLabel() : undefined,
		}))
		return opt
	})
</script>

{#if option}
	<ChartCard title="Attributes" {option} />
{:else if data}
	<ChartEmpty title="Attributes" />
{:else}
	<ChartSkeleton title="Attributes" />
{/if}
