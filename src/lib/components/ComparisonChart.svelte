<script lang="ts">
	import type { EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartEmpty from './ChartEmpty.svelte'
	import { type AppealDist, barBase, boxScores, makeView, paletteColor } from '#lib/chart.ts'
	import type {  CompareMetric, OrderedMap, QuestionData } from '#lib/server/types.ts'

	// Compare N subjects on one metric. The layout is driven by the metric's data shape:
	//   - awareness / e_score (scalar): one bar per subject (x-axis = subjects).
	//   - appeal / attributes / power_factors (many values): grouped bars (x-axis = the
	//     metric's keys, one bar per subject within each group).
	// Always rendered as rates (%). Cross-subject counts sit on different exposure bases
	// and can invert the truth, so comparison is percent-only (no %/# toggle). Appeal is
	// shown as box scores (Top/Bottom Two/Three), the legible comparison form.
	type Subject = { id: string; name: string; kind: 'celebrity' | 'category'; data: QuestionData }
	let { metric, subjects }: { metric: CompareMetric; subjects: Subject[] } = $props()

	const METRIC_TITLES: Record<CompareMetric, string> = {
		awareness: 'Awareness',
		e_score: 'E-Score',
		appeal: 'Appeal (Box Scores)',
		attributes: 'Attributes',
		power_factors: 'Power Factors',
	}
	const title = $derived(METRIC_TITLES[metric])

	const isScalar = $derived(metric === 'awareness' || metric === 'e_score')

	// Box-score category labels for appeal; otherwise the metric's own keys.
	const APPEAL_CATS = ['Top Two Box', 'Top Three Box', 'Bottom Two Box', 'Bottom Three Box']

	// % view; bases are irrelevant in % mode (axisBase unused), pass 100.
	const view = makeView('pct', 100)

	// Pull the comparable value array for a subject in key order.
	function valuesFor(s: Subject, cats: string[]): number[] {
		if (metric === 'appeal') return boxScores(s.data as AppealDist)
		if (isScalar) return [s.data as number]
		const map = s.data as OrderedMap
		return cats.map(k => map[k])
	}

	const option = $derived.by<EChartsOption | undefined>(() => {
		if (subjects.length === 0) return undefined

		// Grouped bars: x = the metric's keys, one series per subject.
		// Scalar metrics (awareness, e_score) are treated as single-value grouped bars.
		const first = subjects[0]
		const keys = metric === 'appeal' ? APPEAL_CATS : isScalar ? ['Score'] : Object.keys(first.data as OrderedMap)
		const pctMax = metric === 'appeal' ? 100 : 60
		const interval = metric === 'appeal' ? 25 : 15
		const opt = barBase(view, keys, pctMax, interval, 30)
		opt.series = subjects.map((s, i) => ({
			name: s.name,
			type: 'bar' as const,
			data: valuesFor(s, keys),
			itemStyle: { color: paletteColor(i) },
		}))
		return opt
	})
</script>

{#if option}
	<ChartCard {title} {option} />
{:else}
	<ChartEmpty {title} subtitle="Select subjects to compare" />
{/if}
