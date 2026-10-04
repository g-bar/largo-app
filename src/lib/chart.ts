// Shared chart pieces: display-mode view adapter, the bar-chart axis/grid base, and
// the visual tokens. Each chart component builds its own ECharts option on top of
// these.
import type { EChartsOption } from 'echarts'

// Visual tokens (sampled from the mockup).
export const RED = '#BE1E2D'
export const AXIS = '#B8BDC6'
export const GREY_BAR = '#D1D5DB'

// Distinct series colors, cycled per subject in the comparison chart. First is the
// brand red so a single-subject compare matches the scorecard charts.
export const PALETTE = ['#BE1E2D', '#4A76A8', '#E8A8C8', '#5BA85B', '#E89A3C']
export const paletteColor = (i: number) => PALETTE[i % PALETTE.length]

export type Mode = 'pct' | 'count'

// Box scores (Top Two / Top Three / Bottom Two / Bottom Three) derived from a
// 6-point appeal distribution. Not stored; computed at render.
export type AppealDist = {
	likeALot: number
	like: number
	likeSomewhat: number
	dislikeSomewhat: number
	dislike: number
	dislikeALot: number
}

export function boxScores(a: AppealDist): number[] {
	const topTwo = a.likeALot + a.like
	const topThree = topTwo + a.likeSomewhat
	const bottomTwo = a.dislike + a.dislikeALot
	const bottomThree = bottomTwo + a.dislikeSomewhat
	return [topTwo, topThree, bottomTwo, bottomThree]
}

// View adapter: the ONE place that knows about display mode. In # mode every series
// shows literal counts on its OWN base (count = round(pct * base / 100)); series are
// not re-indexed to a common base, so bars are honest tallies rather than rescaled
// percentages. Because the bars share one y-axis, the axis is scaled by axisBase (the
// largest series base) so every series fits. % mode ignores bases entirely.
export interface View {
	mode: Mode
	isPct: boolean
	// pct -> displayed value for a series measured against `base`.
	value: (pct: number, base: number) => number
	fmt: (pct: number, base: number) => string
	series: (pcts: number[], base: number) => number[]
	axisScale: number
	barLabel: () => Record<string, unknown>
}

export function makeView(mode: Mode, axisBase: number): View {
	const isPct = mode === 'pct'
	const toCount = (pct: number, base: number) => Math.round((pct * base) / 100)
	return {
		mode,
		isPct,
		value: (pct, base) => (isPct ? pct : toCount(pct, base)),
		fmt: (pct, base) => (isPct ? pct + '%' : String(toCount(pct, base))),
		series: (pcts, base) => (isPct ? pcts : pcts.map(p => toCount(p, base))),
		axisScale: isPct ? 1 : axisBase / 100,
		barLabel: () => ({
			show: true,
			position: 'top',
			formatter: (p: { value: number }) => (isPct ? p.value + '%' : p.value),
			color: '#515A68',
			fontSize: 11,
		}),
	}
}

// Shared axis / grid defaults for the bar charts. pctMax/pctInterval describe the
// y-axis in percent; in count mode they're scaled (via view.axisScale) so bars keep
// the same proportions and the axis reads in counts. `caption` is an optional title
// line (e.g. the base note), shown only when provided.
export function barBase(
	view: View,
	categories: string[],
	pctMax: number,
	pctInterval: number,
	rotate: number,
	caption?: string,
): EChartsOption {
	const scale = view.axisScale
	return {
		title: caption
			? {
					text: caption,
					left: 'center',
					top: 2,
					textStyle: { color: AXIS, fontSize: 11, fontWeight: 'normal' },
				}
			: undefined,
		grid: { left: 44, right: 16, top: caption ? 40 : 24, bottom: 70 },
		xAxis: {
			type: 'category',
			data: categories,
			axisLabel: {
				color: AXIS,
				fontSize: 10,
				interval: 0,
				rotate: rotate || 0,
				width: 90,
				overflow: 'break',
			},
			axisTick: { show: false },
			axisLine: { lineStyle: { color: '#E5E7EB' } },
		},
		yAxis: {
			type: 'value',
			min: 0,
			max: Math.round(pctMax * scale),
			interval: Math.round(pctInterval * scale),
			axisLabel: { color: AXIS, fontSize: 10 },
			splitLine: { lineStyle: { color: '#EEF0F2', type: 'dashed' } },
		},
		legend: { bottom: 0, textStyle: { color: '#515A68', fontSize: 12 } },
		tooltip: {
			trigger: 'axis',
			valueFormatter: v => (view.isPct ? v + '%' : String(v)),
		},
	}
}
