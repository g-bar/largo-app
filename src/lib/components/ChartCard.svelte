<script lang="ts">
	import * as echarts from 'echarts'
	import type { EChartsOption } from 'echarts'
	import { registerChartImage } from '#lib/chartRegistry.ts'

	let {
		title,
		subtitle,
		option,
		exportId,
	}: { title: string; subtitle?: string; option: EChartsOption; exportId?: string } = $props()

	let el: HTMLDivElement
	let headEl: HTMLDivElement
	let menuEl: HTMLDivElement
	let dialog: HTMLDialogElement
	let menuOpen = $state(false)
	let showTable = $state(false)
	let expanded = $state(false)

	// Used for both the card chart and the expanded one. setOption lives in a child effect
	// so a new option (e.g. the %/# toggle) updates the chart instead of re-creating it.
	// ResizeObserver also covers the chart being re-shown after the table view.
	function echart(node: HTMLDivElement) {
		const chart = echarts.init(node)
		$effect(() => {
			chart.setOption(option, true)
		})
		const observer = new ResizeObserver(() => {
			// Skip while hidden behind the table view, so PNG export keeps the real size.
			if (node.offsetWidth) chart.resize()
		})
		observer.observe(node)
		// Only the card chart (not the modal) feeds the one-sheet PDF.
		const unregister =
			exportId && node === el
				? registerChartImage(exportId, () => chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' }))
				: undefined
		return () => {
			observer.disconnect()
			unregister?.()
			chart.dispose()
		}
	}

	type Cell = string | number
	type Datum = number | { name?: string; value: number }
	const value = (d: Datum | undefined) => (typeof d === 'object' ? d.value : (d ?? ''))

	// Rows of the chart's data, read back from the option: bar charts are categories x
	// series, the pie is one row per slice.
	const table = $derived.by(() => {
		const series = option.series as { type: string; name?: string; data: Datum[] }[]
		if (series[0].type === 'pie') {
			return {
				head: ['', title],
				rows: series[0].data.map(d => [(d as { name: string }).name, value(d)] as Cell[]),
			}
		}
		const cats = (option.xAxis as { data: string[] }).data
		return {
			head: ['', ...series.map(s => s.name ?? title)],
			rows: cats.map((c, i) => [c.replaceAll('\n', ' '), ...series.map(s => value(s.data[i]))]),
		}
	})

	const fileName = $derived(
		[title, subtitle]
			.filter(Boolean)
			.join(' ')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, ''),
	)

	function download(href: string, ext: string) {
		const a = document.createElement('a')
		a.href = href
		a.download = `${fileName}.${ext}`
		a.click()
	}

	// The title and subtitle are HTML, not part of the ECharts canvas, so they are redrawn
	// above the chart image with the same computed fonts and colors as on screen.
	async function downloadPng() {
		const scale = 2
		const pad = 20
		const img = new Image()
		img.src = echarts.getInstanceByDom(el)!.getDataURL({ type: 'png', pixelRatio: scale, backgroundColor: '#fff' })
		await img.decode()

		const headTop = headEl.getBoundingClientRect().top
		const headHeight = headEl.offsetHeight + 8 // .chart-head margin-bottom
		const canvas = document.createElement('canvas')
		canvas.width = img.width + 2 * pad * scale
		canvas.height = img.height + (headHeight + 2 * pad) * scale
		const ctx = canvas.getContext('2d')!
		ctx.scale(scale, scale)
		ctx.fillStyle = '#fff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)
		ctx.textBaseline = 'middle'
		for (const line of headEl.children) {
			const style = getComputedStyle(line)
			const rect = line.getBoundingClientRect()
			ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
			ctx.fillStyle = style.color
			ctx.fillText(line.textContent!, pad, pad + rect.top - headTop + rect.height / 2)
		}
		ctx.drawImage(img, pad, pad + headHeight, img.width / scale, img.height / scale)
		download(canvas.toDataURL('image/png'), 'png')
	}

	function downloadCsv() {
		const esc = (v: Cell) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v))
		const csv = [table.head, ...table.rows].map(row => row.map(esc).join(',')).join('\n')
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
		download(url, 'csv')
		URL.revokeObjectURL(url)
	}

	function expand() {
		expanded = true
		dialog.showModal()
	}
</script>

<svelte:window
	onclick={e => {
		if (menuOpen && !menuEl.contains(e.target as Node)) menuOpen = false
	}}
	onkeydown={e => {
		if (e.key === 'Escape') menuOpen = false
	}}
/>

<div class="card chart-card">
	<div class="chart-head">
		<div bind:this={headEl}>
			<div class="chart-title">{title}</div>
			{#if subtitle}
				<div class="chart-subtitle">{subtitle}</div>
			{/if}
		</div>
		<div class="chart-actions">
			<div class="menu-wrap" bind:this={menuEl}>
				<button
					class="icon-btn"
					aria-label="Chart options"
					aria-haspopup="true"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen = !menuOpen)}
				>
					<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
						<circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" />
					</svg>
				</button>
				{#if menuOpen}
					<div class="menu">
						<button onclick={() => ((showTable = !showTable), (menuOpen = false))}>
							{showTable ? 'View as chart' : 'View as table'}
						</button>
						<button onclick={() => (downloadPng(), (menuOpen = false))}>Download PNG</button>
						<button onclick={() => (downloadCsv(), (menuOpen = false))}>Download CSV</button>
					</div>
				{/if}
			</div>
			<button class="icon-btn" aria-label="Expand chart" onclick={expand}>
				<svg
					viewBox="0 0 16 16"
					width="14"
					height="14"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					aria-hidden="true"
				>
					<path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9" />
				</svg>
			</button>
		</div>
	</div>
	<!-- Hidden rather than removed so the ECharts instance survives the table view. -->
	<div class="chart" hidden={showTable} bind:this={el} {@attach echart}></div>
	{#if showTable}
		<div class="chart table-wrap">
			<table>
				<thead>
					<tr
						>{#each table.head as h, i (i)}<th>{h}</th>{/each}</tr
					>
				</thead>
				<tbody>
					{#each table.rows as row, i (i)}
						<tr
							>{#each row as cell, j (j)}<td>{cell}</td>{/each}</tr
						>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<dialog
	bind:this={dialog}
	aria-label={title}
	onclose={() => (expanded = false)}
	onclick={e => {
		if (e.target === dialog) dialog.close()
	}}
>
	<div class="chart-head">
		<div>
			<div class="chart-title">{title}</div>
			{#if subtitle}
				<div class="chart-subtitle">{subtitle}</div>
			{/if}
		</div>
		<div class="chart-actions">
			<button class="icon-btn" aria-label="Close" onclick={() => dialog.close()}>&times;</button>
		</div>
	</div>
	{#if expanded}
		<div class="chart big" {@attach echart}></div>
	{/if}
</dialog>

<style>
	.chart-card {
		padding: 16px 20px;
		min-width: 0;
	}
	.chart-head {
		display: flex;
		align-items: flex-start;
		margin-bottom: 8px;
	}
	.chart-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--heading-text);
	}
	.chart-subtitle {
		font-size: 12px;
		color: var(--muted-text);
		margin-top: 2px;
	}
	.chart-actions {
		margin-left: auto;
		display: flex;
		gap: 4px;
	}
	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: 4px;
		background: none;
		color: var(--muted-text-2);
		fill: currentColor;
		font-size: 20px;
		cursor: pointer;
	}
	.icon-btn:hover,
	.icon-btn[aria-expanded='true'] {
		background: var(--page-bg);
		color: var(--heading-text);
	}
	.menu-wrap {
		position: relative;
	}
	.menu {
		position: absolute;
		right: 0;
		top: 32px;
		z-index: 10;
		display: flex;
		flex-direction: column;
		min-width: 160px;
		padding: 4px 0;
		background: var(--card-bg);
		border: 1px solid var(--control-border);
		border-radius: 6px;
		box-shadow: var(--shadow);
	}
	.menu button {
		padding: 8px 14px;
		border: none;
		background: none;
		text-align: left;
		font: inherit;
		font-size: 13px;
		color: var(--body-text);
		cursor: pointer;
	}
	.menu button:hover {
		background: var(--page-bg);
	}
	.chart {
		width: 100%;
		height: 300px;
		min-width: 0;
	}
	.table-wrap {
		overflow: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}
	th,
	td {
		padding: 6px 8px;
		border-bottom: 1px solid #eef0f2;
		text-align: right;
	}
	th:first-child,
	td:first-child {
		text-align: left;
	}
	th {
		position: sticky;
		top: 0;
		background: var(--card-bg);
		color: var(--heading-text);
	}
	dialog {
		margin: auto;
		width: min(1100px, 92vw);
		padding: 16px 20px;
		border: none;
		border-radius: 8px;
		box-shadow: var(--shadow);
	}
	dialog::backdrop {
		background: rgba(0, 0, 0, 0.4);
	}
	.big {
		height: 70vh;
	}
</style>
