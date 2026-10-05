// Lets the one-sheet PDF pull a PNG of each live chart. ChartCard registers a getter
// keyed by exportId while mounted; the PDF builder reads them at click time. Keeping
// the live ECharts instance as the source avoids re-rendering charts off-screen.
const charts = new Map<string, () => string>()

export function registerChartImage(id: string, getImage: () => string) {
	charts.set(id, getImage)
	return () => charts.delete(id)
}

export function chartImage(id: string): string | undefined {
	return charts.get(id)?.()
}
