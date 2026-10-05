// Builds the Celebrity One-Sheet PDF client-side. Header text is drawn natively; the
// four charts are pulled as PNGs from the live ECharts instances via chartRegistry.
// jsPDF is imported dynamically so it stays out of the initial bundle.
import { chartImage } from '#lib/chartRegistry.ts'

type Head = {
	name: string
	eScore: number | null
	awareness: number
	filter: { fieldingDate: string; gender: string; ageBand: string }
	categories: { label: string; pct: number | null }[]
}

const RED: [number, number, number] = [190, 30, 45]
const INK: [number, number, number] = [31, 41, 55]
const MUTED: [number, number, number] = [122, 128, 141]

const CHARTS = [
	{ id: 'total-appeal', title: 'Total Appeal' },
	{ id: 'attributes', title: 'Attributes' },
	{ id: 'appeal', title: 'Appeal' },
	{ id: 'power-factors', title: 'Power Factors' },
]

const genderLabel: Record<string, string> = { total: 'Total', male: 'Male', female: 'Female' }

export async function buildOneSheet(head: Head, fileBase: string) {
	const { jsPDF } = await import('jspdf')
	const doc = new jsPDF({ unit: 'pt', format: 'a4' })
	const pageW = doc.internal.pageSize.getWidth()
	const margin = 40
	const contentW = pageW - 2 * margin
	let y = margin

	// Title row: celebrity name + E-Score badge.
	doc
		.setFont('helvetica', 'bold')
		.setFontSize(22)
		.setTextColor(...INK)
	doc.text(head.name, margin, y + 18)
	doc.setFillColor(...RED).roundedRect(pageW - margin - 110, y, 110, 48, 4, 4, 'F')
	doc.setTextColor(255, 255, 255).setFontSize(8)
	doc.text('E-SCORE', pageW - margin - 55, y + 16, { align: 'center' })
	doc.setFontSize(26).text(String(head.eScore ?? '-'), pageW - margin - 55, y + 40, { align: 'center' })
	y += 64

	// Filter line + awareness.
	doc
		.setFont('helvetica', 'normal')
		.setFontSize(10)
		.setTextColor(...MUTED)
	const date = new Date(head.filter.fieldingDate).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	})
	doc.text(`${date}  •  ${genderLabel[head.filter.gender] ?? head.filter.gender}  •  ${head.filter.ageBand}`, margin, y)
	y += 16
	doc
		.setTextColor(...INK)
		.setFontSize(12)
		.setFont('helvetica', 'bold')
	doc.text(`Awareness: ${head.awareness}%`, margin, y)
	y += 18

	// Category averages.
	doc
		.setFont('helvetica', 'normal')
		.setFontSize(9)
		.setTextColor(...MUTED)
	for (const c of head.categories) {
		doc.text(`${c.label}: ${c.pct ?? '-'}%`, margin, y)
		y += 13
	}
	y += 8

	// Charts, two per row, keeping each image's aspect ratio.
	const gap = 16
	const cellW = (contentW - gap) / 2
	let col = 0
	for (const c of CHARTS) {
		const img = chartImage(c.id)
		if (!img) continue
		const props = doc.getImageProperties(img)
		const imgH = (props.height / props.width) * cellW
		const x = margin + col * (cellW + gap)
		doc
			.setFont('helvetica', 'bold')
			.setFontSize(11)
			.setTextColor(...INK)
		doc.text(c.title, x, y + 10)
		doc.addImage(img, 'PNG', x, y + 16, cellW, imgH)
		if (col === 1) y += imgH + 32
		col = col === 0 ? 1 : 0
	}

	doc.save(`${fileBase}.pdf`)
}
