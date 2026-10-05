// Client-side scorecard export: flatten the loaded page data into one CSV for the
// current filter. Mirrors what the charts show, so no extra server call is needed.
import { boxScores, type AppealDist } from '#lib/chart.ts'
import type { AppealData, OrderedMap } from '#lib/server/types.ts'

type Slice<T> = { data: T; base: number } | null

export type ScorecardExport = {
	celebrity: { name: string }
	filter: { fieldingDate: string; gender: string; ageBand: string }
	eScore: number | null
	awareness: number
	awarenessCategories: { label: string; pct: number | null }[]
	totalAppeal: { any: Slice<AppealData>; name: Slice<AppealData>; face: Slice<AppealData> }
	attributes: { total: Slice<OrderedMap>; male: Slice<OrderedMap>; female: Slice<OrderedMap> }
	appeal: { categoryName: string | null; slice: Slice<AppealData> }
	powerFactors: { categoryName: string | null; celeb: Slice<OrderedMap>; category: Slice<OrderedMap> }
}

type Row = (string | number)[]

const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v))

const BOX_LABELS = ['Top Two Box', 'Top Three Box', 'Bottom Two Box', 'Bottom Three Box']

export function scorecardCsv(d: ScorecardExport): string {
	const rows: Row[] = []
	const section = (title: string, head: string[], body: Row[]) => {
		if (rows.length) rows.push([])
		rows.push([title], head, ...body)
	}

	rows.push(['Largo E-Score Scorecard'])
	rows.push(['Celebrity', d.celebrity.name])
	rows.push(['Fielding date', d.filter.fieldingDate])
	rows.push(['Gender', d.filter.gender])
	rows.push(['Age', d.filter.ageBand])

	section(
		'Headline',
		['Metric', 'Value'],
		[
			['E-Score', d.eScore ?? ''],
			['Awareness %', d.awareness],
		],
	)

	section(
		'Category Awareness',
		['Category', '%'],
		d.awarenessCategories.map(c => [c.label, c.pct ?? '']),
	)

	// Total Appeal: box scores per recognition mode.
	const appealCols = [
		['Total', d.totalAppeal.any],
		['Name', d.totalAppeal.name],
		['Face', d.totalAppeal.face],
	] as const
	const present = appealCols.filter(([, s]) => s)
	section(
		'Total Appeal (Box Scores, %)',
		['', ...present.map(([n]) => n)],
		BOX_LABELS.map((label, i) => [label, ...present.map(([, s]) => boxScores(s!.data as AppealDist)[i])]),
	)

	// Attributes and Power Factors: ordered maps, one row per key.
	if (d.attributes.total) {
		const cols = [
			['Total', d.attributes.total],
			['Male', d.attributes.male],
			['Female', d.attributes.female],
		].filter(([, s]) => s) as [string, Slice<OrderedMap>][]
		section(
			'Attributes (%)',
			['Attribute', ...cols.map(([n]) => n)],
			Object.keys(d.attributes.total.data).map(k => [k, ...cols.map(([, s]) => s!.data[k])]),
		)
	}

	if (d.powerFactors.celeb) {
		const celeb = d.powerFactors.celeb
		const cat = d.powerFactors.category
		const head = [d.celebrity.name]
		if (cat && d.powerFactors.categoryName) head.push(`${d.powerFactors.categoryName} Avg.`)
		section(
			'Power Factors (%)',
			['Factor', ...head],
			Object.keys(celeb.data).map(k => {
				const row: Row = [k, celeb.data[k]]
				if (cat && d.powerFactors.categoryName) row.push(cat.data[k])
				return row
			}),
		)
	}

	if (d.appeal.slice) {
		const a = d.appeal.slice.data
		section(
			`Appeal Distribution${d.appeal.categoryName ? ` (${d.appeal.categoryName})` : ''} (%)`,
			['Rating', '%'],
			[
				['Like A Lot', a.likeALot],
				['Like', a.like],
				['Like Somewhat', a.likeSomewhat],
				['Dislike Somewhat', a.dislikeSomewhat],
				['Dislike', a.dislike],
				['Dislike A Lot', a.dislikeALot],
			],
		)
	}

	return rows.map(r => r.map(esc).join(',')).join('\n')
}

export function downloadCsv(fileBase: string, csv: string) {
	const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
	const a = document.createElement('a')
	a.href = url
	a.download = `${fileBase}.csv`
	a.click()
	URL.revokeObjectURL(url)
}

export const fileBase = (name: string, filter: { fieldingDate: string; gender: string; ageBand: string }) =>
	[name, filter.fieldingDate, filter.gender, filter.ageBand]
		.join(' ')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
