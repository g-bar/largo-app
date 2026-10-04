<script lang="ts">
	import type { DefaultLabelFormatterCallbackParams, EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartEmpty from './ChartEmpty.svelte'
	import ChartSkeleton from './ChartSkeleton.svelte'
	import { AXIS, type Mode, makeView } from '#lib/chart.ts'
	import type { AppealData } from '#lib/server/types.ts'

	// Primary category's appeal distribution (6-point pie). A category is the pool of
	// its member actors' ratings (one respondent evaluating one actor = one rating), so
	// its base is a rating count. In # mode the slices are literal counts on that rating
	// base. A null slice shows an empty state.
	type Slice = { data: AppealData; base: number }
	let {
		mode,
		categoryName,
		slice,
		load,
	}: {
		mode: Mode
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
		const base = data.base
		const d = data.data
		const view = makeView(mode, base)
		const parts = [
			{ name: 'Like A Lot', value: d.likeALot, color: '#4A76A8' },
			{ name: 'Like', value: d.like, color: '#6B9AD4' },
			{ name: 'Like Somewhat', value: d.likeSomewhat, color: '#A8C8F0' },
			{ name: 'Dislike Somewhat', value: d.dislikeSomewhat, color: '#F0C8A8' },
			{ name: 'Dislike', value: d.dislike, color: '#E89A6B' },
			{ name: 'Dislike A Lot', value: d.dislikeALot, color: '#D46B4A' },
		]
		const suffix = view.isPct ? '%' : ''
		const caption = view.isPct ? undefined : `Base: ${base.toLocaleString()} (ratings)`
		return {
			title: caption
				? {
						text: caption,
						left: 'center',
						top: 2,
						textStyle: { color: AXIS, fontSize: 11, fontWeight: 'normal' },
					}
				: undefined,
			tooltip: {
				trigger: 'item',
				formatter: p =>
					`${(p as DefaultLabelFormatterCallbackParams).name}: ${(p as DefaultLabelFormatterCallbackParams).value}${suffix}`,
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
						value: view.value(s.value, base),
						itemStyle: { color: s.color },
					})),
					label: {
						formatter: (p: DefaultLabelFormatterCallbackParams) => `${p.name}, ${p.value}${suffix}`,
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
