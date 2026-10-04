<script lang="ts">
	import type { EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartSkeleton from './ChartSkeleton.svelte'
	import { RED, type AppealDist, type Mode, barBase, boxScores, makeView } from '#lib/chart.ts'
	import type { AppealData } from '#lib/server/types.ts'

	// Appeal box scores per awarenessMode (Total always; Name/Face when present). Box
	// scores are derived here, not stored. In # mode each series shows literal counts
	// on its own aware base (no indexing): Total out of its all-aware base, Name out of
	// name-aware, Face out of face-aware. If `slices` is absent, fetch via `load`.
	type Slice = { data: AppealData; base: number }
	type Slices = { any: Slice; name?: Slice; face?: Slice }
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

	const CATS = [
		'Top Two Box\n(Like A Lot / Like)',
		'Top Three Box\n(Like A Lot / Like / Like Some)',
		'Bottom Two Box\n(Dislike A Lot / Dislike)',
		'Bottom Three Box\n(Dislike A Lot / Dislike / Dislike Some)',
	]

	const option = $derived.by<EChartsOption | undefined>(() => {
		if (!data) return undefined
		const series = [{ name: 'Total', color: RED, slice: data.any }]
		if (data.name) series.push({ name: 'Name', color: '#E87A7A', slice: data.name })
		if (data.face) series.push({ name: 'Face', color: '#F5B8B8', slice: data.face })
		// Axis spans the largest series base so every series fits.
		const axisBase = Math.max(...series.map(s => s.slice.base))
		const view = makeView(mode, axisBase)
		const opt = barBase(view, CATS, 100, 25, 0)
		// keep manual line breaks
		;(opt.xAxis as { axisLabel: Record<string, unknown> }).axisLabel.formatter = (v: string) => v
		opt.series = series.map(s => ({
			name: s.name,
			type: 'bar' as const,
			data: view.series(boxScores(s.slice.data as AppealDist), s.slice.base),
			itemStyle: { color: s.color },
			label: view.barLabel(),
		}))
		return opt
	})
</script>

{#if option}
	<ChartCard title="Total Appeal" {option} />
{:else}
	<ChartSkeleton title="Total Appeal" />
{/if}
