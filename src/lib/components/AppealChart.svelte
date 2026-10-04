<script lang="ts">
	import type { DefaultLabelFormatterCallbackParams, EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartEmpty from './ChartEmpty.svelte'
	import ChartSkeleton from './ChartSkeleton.svelte'
	import type { AppealData } from '#lib/server/types.ts'

	// Primary category's appeal distribution (6-point pie). A category is a benchmark on
	// a different population from the page subject, so it is always shown as a rate: a
	// count here (category ratings) would be meaningless on the celebrity's page. The
	// %/# toggle does not apply; this chart ignores `mode` and always renders %.
	type Slice = { data: AppealData; base: number }
	let {
		categoryName,
		slice,
		load,
	}: {
		categoryName: string | null
		slice?: Slice | null
		load?: () => Promise<Slice>
	} = $props()

	let fetched = $state<Slice | undefined>()
	$effect(() => {
		if (slice === undefined && load) load().then(d => (fetched = d))
	})
	const data = $derived(slice === undefined ? fetched : slice)

	const title = 'Appeal'
	const subtitle = $derived(categoryName ?? undefined)

	const option = $derived.by<EChartsOption | undefined>(() => {
		if (!data) return undefined
		const d = data.data
		const parts = [
			{ name: 'Like A Lot', value: d.likeALot, color: '#4A76A8' },
			{ name: 'Like', value: d.like, color: '#6B9AD4' },
			{ name: 'Like Somewhat', value: d.likeSomewhat, color: '#A8C8F0' },
			{ name: 'Dislike Somewhat', value: d.dislikeSomewhat, color: '#F0C8A8' },
			{ name: 'Dislike', value: d.dislike, color: '#E89A6B' },
			{ name: 'Dislike A Lot', value: d.dislikeALot, color: '#D46B4A' },
		]
		return {
			tooltip: {
				trigger: 'item',
				formatter: p =>
					`${(p as DefaultLabelFormatterCallbackParams).name}: ${(p as DefaultLabelFormatterCallbackParams).value}%`,
			},
			series: [
				{
					type: 'pie',
					radius: '62%',
					center: ['50%', '52%'],
					clockwise: false,
					startAngle: 0,
					data: parts.map(s => ({
						name: s.name,
						value: s.value,
						itemStyle: { color: s.color },
					})),
					label: {
						formatter: (p: DefaultLabelFormatterCallbackParams) => `${p.name}, ${p.value}%`,
						color: '#515A68',
						fontSize: 12,
					},
					labelLine: { length: 12, length2: 14 },
				},
			],
		}
	})
</script>

{#if option}
	<ChartCard {title} {subtitle} {option} />
{:else if data === null}
	<ChartEmpty {title} {subtitle} />
{:else}
	<ChartSkeleton {title} {subtitle} />
{/if}
