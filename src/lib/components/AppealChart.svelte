<script lang="ts">
	import type { DefaultLabelFormatterCallbackParams, EChartsOption } from 'echarts'
	import ChartCard from './ChartCard.svelte'
	import ChartSkeleton from './ChartSkeleton.svelte'
	import { AXIS, type Mode, makeView } from '#lib/chart.ts'
	import type { AppealData } from '#lib/server/types.ts'

	// Primary category's appeal distribution (6-point pie). A category is the pool of
	// its member actors' ratings (one respondent evaluating one actor = one rating), so
	// its base is a rating count. In # mode the slices are literal counts on that
	// rating base.
	let {
		mode,
		categoryName,
		appeal,
		base,
		load,
	}: {
		mode: Mode
		categoryName: string
		appeal?: AppealData
		base?: number
		load?: () => Promise<{ data: AppealData; base: number }>
	} = $props()

	let fetched = $state<{ data: AppealData; base: number } | undefined>()
	$effect(() => {
		if (!appeal && load) load().then(d => (fetched = d))
	})
	const data = $derived(appeal ?? fetched?.data)
	const sliceBase = $derived(base ?? fetched?.base ?? 0)

	const option = $derived.by<EChartsOption | undefined>(() => {
		if (!data) return undefined
		const view = makeView(mode, sliceBase)
		const slices = [
			{ name: 'Like A Lot', value: data.likeALot, color: '#4A76A8' },
			{ name: 'Like', value: data.like, color: '#6B9AD4' },
			{ name: 'Like Somewhat', value: data.likeSomewhat, color: '#A8C8F0' },
			{ name: 'Dislike Somewhat', value: data.dislikeSomewhat, color: '#F0C8A8' },
			{ name: 'Dislike', value: data.dislike, color: '#E89A6B' },
			{ name: 'Dislike A Lot', value: data.dislikeALot, color: '#D46B4A' },
		]
		const suffix = view.isPct ? '%' : ''
		const caption = view.isPct ? undefined : `Base: ${sliceBase.toLocaleString()} (ratings)`
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
					data: slices.map(s => ({
						name: s.name,
						value: view.value(s.value, sliceBase),
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
	<ChartCard title="Appeal" subtitle={categoryName} {option} />
{:else}
	<ChartSkeleton title="Appeal" subtitle={categoryName} />
{/if}
