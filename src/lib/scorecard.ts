// The scorecard model: data lookup, the display-mode view adapter, and the four
// chart option builders. Ported from the static dashboard's scorecard.js with the
// DOM removed: builders return ECharts options, components do the rendering.

import type { EChartsOption, DefaultLabelFormatterCallbackParams } from 'echarts'
import SCORECARDS from './data/scorecards.json'

export interface Scorecard {
	subjectId: string
	segmentId: string
	fieldingDate: string
	// base is the respondent count behind a celebrity record's percentages. The #
	// toggle turns the whole page into counts out of the viewed celebrity's base:
	// count = round(pct * base / 100). Brad Pitt's own figures become real
	// headcounts. Category benchmarks are a pooled rate across all actors; their own
	// base is on a different scale, so the page never uses it. Category figures are
	// instead INDEXED to Brad Pitt's base so the comparison reads in one unit, and
	// the UI flags them as indexed. Hence only brad-pitt records carry a base and
	// eScore; category records don't.
	base?: number
	eScore?: number
	awareness: number
	totalAppeal: {
		overall: number[]
		byName: number[]
		byFace: number[]
	}
	appeal: {
		likeALot: number
		like: number
		likeSomewhat: number
		dislikeSomewhat: number
		dislike: number
		dislikeALot: number
	}
	attributes: Record<string, number>
	powerFactors: Record<string, number>
}

const scorecards = SCORECARDS as Scorecard[]

export function getScorecard(subjectId: string, segmentId: string, fieldingDate: string): Scorecard {
	const found = scorecards.find(
		s => s.subjectId === subjectId && s.segmentId === segmentId && s.fieldingDate === fieldingDate,
	)
	if (!found) throw new Error(`No scorecard for ${subjectId}/${segmentId}/${fieldingDate}`)
	return found
}

export const DATE = '2025-07-25'

// Visual tokens (sampled from the mockup).
const RED = '#BE1E2D'
const AXIS = '#B8BDC6'
const GREY_BAR = '#D1D5DB'

export type Mode = 'pct' | 'count'

// View adapter: the ONE place that knows about display mode. Built once per render
// from (mode, refBase); every presentation helper comes from here, so no builder
// reads the mode or the base directly.
export interface View {
	mode: Mode
	refBase: number
	isPct: boolean
	value: (pct: number) => number
	fmt: (pct: number) => string
	series: (pcts: number[]) => number[]
	axisScale: number
	baseCaption: string | null
	indexedCaption: string | null
	barLabel: () => Record<string, unknown>
}

export function makeView(mode: Mode, refBase: number): View {
	const isPct = mode === 'pct'
	const toCount = (pct: number) => Math.round((pct * refBase) / 100)
	return {
		mode,
		refBase,
		isPct,
		value: pct => (isPct ? pct : toCount(pct)),
		fmt: pct => (isPct ? pct + '%' : String(toCount(pct))),
		series: pcts => (isPct ? pcts : pcts.map(toCount)),
		axisScale: isPct ? 1 : refBase / 100,
		baseCaption: isPct ? null : 'Base: ' + refBase.toLocaleString() + ' (Brad Pitt respondents)',
		indexedCaption: isPct ? null : 'Indexed to base: ' + refBase.toLocaleString() + ' (Brad Pitt respondents)',
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
// the same proportions and the axis reads in counts.
function barBase(view: View, categories: string[], pctMax: number, pctInterval: number, rotate: number): EChartsOption {
	const scale = view.axisScale
	return {
		title: view.baseCaption
			? {
					text: view.baseCaption,
					left: 'center',
					top: 2,
					textStyle: { color: AXIS, fontSize: 11, fontWeight: 'normal' },
				}
			: undefined,
		grid: { left: 44, right: 16, top: view.isPct ? 24 : 40, bottom: 70 },
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

// Total Appeal: Brad Pitt total, bundled overall/byName/byFace.
export function totalAppealOption(mode: Mode, base: number): EChartsOption {
	const view = makeView(mode, base)
	const a = getScorecard('brad-pitt', 'total', DATE).totalAppeal
	const cats = [
		'Top Two Box\n(Like A Lot / Like)',
		'Top Three Box\n(Like A Lot / Like / Like Some)',
		'Bottom Two Box\n(Dislike A Lot / Dislike)',
		'Bottom Three Box\n(Dislike A Lot / Dislike / Dislike Some)',
	]
	const opt = barBase(view, cats, 100, 25, 0)
	// keep manual line breaks
	;(opt.xAxis as { axisLabel: Record<string, unknown> }).axisLabel.formatter = (v: string) => v
	opt.series = [
		{
			name: 'Total',
			type: 'bar',
			data: view.series(a.overall),
			itemStyle: { color: RED },
			label: view.barLabel(),
		},
		{
			name: 'Name',
			type: 'bar',
			data: view.series(a.byName),
			itemStyle: { color: '#E87A7A' },
			label: view.barLabel(),
		},
		{
			name: 'Face',
			type: 'bar',
			data: view.series(a.byFace),
			itemStyle: { color: '#F5B8B8' },
			label: view.barLabel(),
		},
	]
	return opt
}

// Attributes: Brad Pitt total/male/female. All three are Brad Pitt's own data,
// shown as real counts out of his base.
export function attributesOption(mode: Mode, base: number): EChartsOption {
	const view = makeView(mode, base)
	const total = getScorecard('brad-pitt', 'total', DATE).attributes
	const male = getScorecard('brad-pitt', 'male', DATE).attributes
	const female = getScorecard('brad-pitt', 'female', DATE).attributes
	const cats = Object.keys(total)
	const opt = barBase(view, cats, 60, 15, 30)
	opt.series = [
		{
			name: 'Total',
			type: 'bar',
			data: view.series(cats.map(k => total[k])),
			itemStyle: { color: RED },
			label: view.barLabel(),
		},
		{
			name: 'Male',
			type: 'bar',
			data: view.series(cats.map(k => male[k])),
			itemStyle: { color: '#4A76A8' },
		},
		{
			name: 'Female',
			type: 'bar',
			data: view.series(cats.map(k => female[k])),
			itemStyle: { color: '#E8A8C8' },
		},
	]
	return opt
}

// Appeal pie: Film Personality - Actor category, 6-point scale. A category
// benchmark; on Brad Pitt's page its raw counts are meaningless, so in # mode the
// slices are indexed to his base. The title note flags that.
export function appealOption(mode: Mode, base: number): EChartsOption {
	const view = makeView(mode, base)
	const a = getScorecard('film-personality-actor', 'total', DATE).appeal
	const slices = [
		{ name: 'Like A Lot', value: a.likeALot, color: '#4A76A8' },
		{ name: 'Like', value: a.like, color: '#6B9AD4' },
		{ name: 'Like Somewhat', value: a.likeSomewhat, color: '#A8C8F0' },
		{ name: 'Dislike Somewhat', value: a.dislikeSomewhat, color: '#F0C8A8' },
		{ name: 'Dislike', value: a.dislike, color: '#E89A6B' },
		{ name: 'Dislike A Lot', value: a.dislikeALot, color: '#D46B4A' },
	]
	const suffix = view.isPct ? '%' : ''
	return {
		title: view.indexedCaption
			? {
					text: view.indexedCaption,
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
					value: view.value(s.value),
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
}

// Power Factors: Brad Pitt vs Film Personality - Actor average. Brad Pitt's bars
// are real counts; the category-average bars are indexed to his base. The legend
// flags the category series as indexed in # mode.
export function powerFactorsOption(mode: Mode, base: number): EChartsOption {
	const view = makeView(mode, base)
	const celeb = getScorecard('brad-pitt', 'total', DATE).powerFactors
	const cat = getScorecard('film-personality-actor', 'total', DATE).powerFactors
	const cats = Object.keys(celeb)
	const catName = 'Film Personality - Actor Avg.' + (view.isPct ? '' : ' (indexed)')
	const opt = barBase(view, cats, 60, 15, 30)
	opt.series = [
		{
			name: 'Brad Pitt',
			type: 'bar',
			data: view.series(cats.map(k => celeb[k])),
			itemStyle: { color: RED },
			label: view.barLabel(),
		},
		{
			name: catName,
			type: 'bar',
			data: view.series(cats.map(k => cat[k])),
			itemStyle: { color: GREY_BAR },
		},
	]
	return opt
}
