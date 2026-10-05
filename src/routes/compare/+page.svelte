<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { untrack } from 'svelte'
	import { flip } from 'svelte/animate'
	import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action'
	import ComparisonChart from '#lib/components/ComparisonChart.svelte'
	import { paletteColor } from '#lib/chart.ts'
	import type { CompareMetric } from '#lib/server/types.ts'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	// Keep in sync with COMPARE_MAX_SUBJECTS in #lib/server/types.ts (server-only, can't import here).
	const MAX = 6

	const genderOptions = [
		{ value: 'total', label: 'Total' },
		{ value: 'male', label: 'Male' },
		{ value: 'female', label: 'Female' },
	]
	const ageOptions = [
		{ value: 'total', label: 'All ages' },
		{ value: '13-20', label: '13-20' },
		{ value: '21-34', label: '21-34' },
		{ value: '35-54', label: '35-54' },
		{ value: '55+', label: '55+' },
	]
	// Chart grid: one comparison chart per question except E-Score, plus awareness.
	const chartMetrics: CompareMetric[] = ['awareness', 'appeal', 'attributes', 'power_factors']
	const dateLabel = (iso: string) =>
		new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

	// Subject search state. Results and selection mix celebrities and categories.
	let searchQuery = $state('')
	let searchResults = $state<{ id: string; name: string; kind: 'celebrity' | 'category' }[]>([])
	let searchPending = $state(false)

	// Which badge's small-screen actions menu is open (null = none).
	let openMenuId = $state<string | null>(null)

	const selectedIds = $derived(data.selectedIds)
	const selectedSet = $derived(new Set(selectedIds))
	const selectedCount = $derived(selectedIds.length)
	const atCap = $derived(selectedCount >= MAX)

	// Draggable badge list (the array svelte-dnd-action owns and reorders). Reset to the
	// server order only when the id set changes (add/remove). When the slice changes
	// (same ids, new E-Score), refresh each item's data in place but keep the drag order.
	type Badge = PageData['badges'][number]
	let badgeItems = $state<Badge[]>([])
	let lastBadgeKey = ''
	$effect(() => {
		const serverIds = data.badges.map(b => b.id)
		const key = serverIds.join('|')
		untrack(() => {
			if (key !== lastBadgeKey) {
				lastBadgeKey = key
				badgeItems = data.badges
			} else {
				const byId = new Map(data.badges.map(b => [b.id, b]))
				badgeItems = badgeItems.map(b => byId.get(b.id) ?? b)
			}
		})
	})
	const orderedIds = $derived(badgeItems.map(b => b.id))

	// Palette color per subject by the ORIGINAL selection order (first is always largo
	// red). Anchored to the subject, so dragging reorders the badges/bars but each keeps
	// its own color. Shared by the badges and the chart series.
	const colorOf = $derived(new Map(selectedIds.map((id, i) => [id, paletteColor(i)])))
	const chartSubjects = $derived(
		Object.fromEntries(
			chartMetrics.map(m => {
				const byId = new Map(data.charts[m].map(s => [s.id, s]))
				const ordered = orderedIds.map(id => byId.get(id)).filter(s => s !== undefined)
				return [m, ordered.map(s => ({ ...s, color: colorOf.get(s.id) }))]
			}),
		) as Record<CompareMetric, (PageData['charts'][CompareMetric][number] & { color?: string })[]>,
	)

	function handleBadgeConsider(e: CustomEvent<{ items: Badge[] }>) {
		badgeItems = e.detail.items
	}
	function handleBadgeFinalize(e: CustomEvent<{ items: Badge[] }>) {
		badgeItems = e.detail.items
		// Persist the new order to the URL without rerunning load (shallow update), so the
		// arrangement survives a later add/remove (which does rerun load and reads it).
		const params = new URLSearchParams(page.url.search)
		params.set('subjects', badgeItems.map(b => b.id).join(','))
		goto(`/compare?${params}`, { shallow: true, replace: true })
	}

	// Snappy reorder animation; matched by the per-item `animate:flip`.
	const FLIP_MS = 120
	// Dim the element that follows the cursor instead of outlining the drop zone.
	function dimDragged(el?: HTMLElement) {
		if (el) {
			el.style.opacity = '0.5'
			el.style.outline = 'none'
		}
	}
	// The library tags the gap-filling placeholder item with this marker at runtime.
	const isShadow = (b: Badge) => (b as Record<string, unknown>)[SHADOW_ITEM_MARKER_PROPERTY_NAME] === true

	// Already-selected subjects are shown as tags, so drop them from search results.
	const visibleResults = $derived(searchResults.filter(r => !selectedSet.has(r.id)))

	function navigate(params: URLSearchParams) {
		goto(`/compare?${params}`, { reset: false })
	}

	function setParam(key: string, value: string) {
		const params = new URLSearchParams(page.url.search)
		params.set(key, value)
		navigate(params)
	}

	function updateSubjects(ids: string[]) {
		const params = new URLSearchParams(page.url.search)
		params.set('subjects', ids.join(','))
		navigate(params)
	}

	// Toggle a subject (celebrity or category) in/out of selection. Operates on the
	// current drag order (orderedIds), so removing one keeps the rest arranged as the
	// user left them; adding appends to the end.
	function toggleSubject(id: string) {
		if (selectedSet.has(id)) {
			updateSubjects(orderedIds.filter(s => s !== id))
		} else if (!atCap) {
			updateSubjects([...orderedIds, id])
			searchQuery = ''
		}
	}

	// Search subjects, celebrities and categories.
	async function searchSubjects(q: string) {
		if (!q.trim()) {
			searchResults = []
			return
		}
		searchPending = true
		try {
			const res = await fetch(`/api/celebrities/search?q=${encodeURIComponent(q)}&includeCategories=1`)
			if (res.ok) {
				searchResults = await res.json()
			}
		} finally {
			searchPending = false
		}
	}

	// Debounced search on input.
	$effect(() => {
		const q = searchQuery
		if (!q.trim()) {
			searchResults = []
			return
		}
		const t = setTimeout(() => searchSubjects(q), 200)
		return () => clearTimeout(t)
	})
</script>

<svelte:head>
	<title>Largo E-Score: Compare</title>
</svelte:head>

<main class="content page">
	<section class="filter-bar card">
		<div class="control-group">
			<label for="fielding-date">Fielding date</label>
			<select id="fielding-date" value={data.filter.fieldingDate} onchange={e => setParam('fieldingDate', e.currentTarget.value)}>
				{#each data.fieldingDates as d (d)}
					<option value={d}>{dateLabel(d)}</option>
				{/each}
			</select>
		</div>
		<div class="control-group">
			<label for="gender">Gender</label>
			<select id="gender" value={data.filter.gender} onchange={e => setParam('gender', e.currentTarget.value)}>
				{#each genderOptions as g (g.value)}
					<option value={g.value}>{g.label}</option>
				{/each}
			</select>
		</div>
		<div class="control-group">
			<label for="age">Age</label>
			<select id="age" value={data.filter.ageBand} onchange={e => setParam('ageBand', e.currentTarget.value)}>
				{#each ageOptions as a (a.value)}
					<option value={a.value}>{a.label}</option>
				{/each}
			</select>
		</div>
		<div class="control-group search-group">
			<label for="subject-search">Subjects <span class="count">({selectedCount}/{MAX})</span></label>
			<input
				id="subject-search"
				type="text"
				placeholder="Search celebrities and categories..."
				bind:value={searchQuery}
			/>
			{#if searchQuery && visibleResults.length > 0}
				<ul class="search-results">
					{#each visibleResults as r (r.id)}
						<li>
							<button
								class="search-result-item"
								class:disabled={atCap}
								disabled={atCap}
								onclick={() => toggleSubject(r.id)}
							>
								<span>
									{r.name}
									{#if r.kind === 'category'}<span class="kind-badge">Category</span>{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else if searchQuery && !searchPending && visibleResults.length === 0}
				<ul class="search-results">
					<li class="search-empty">No results found.</li>
				</ul>
			{/if}
		</div>
	</section>

	{#if badgeItems.length > 0}
		<section
			class="badge-row"
			class:draggable={badgeItems.length > 1}
			use:dndzone={{ items: badgeItems, flipDurationMs: FLIP_MS, dropTargetStyle: {}, transformDraggedElement: dimDragged, dragDisabled: badgeItems.length < 2 }}
			onconsider={handleBadgeConsider}
			onfinalize={handleBadgeFinalize}
		>
			{#each badgeItems as b (b.id)}
				<div class="badge-slot" animate:flip={{ duration: FLIP_MS }}>
					{#if isShadow(b)}
						<div class="badge-placeholder"></div>
					{:else}
						<div class="celeb-badge" class:category-badge={b.kind === 'category'} style="background: {colorOf.get(b.id)}">
							<button class="badge-remove" aria-label="Remove" onclick={() => toggleSubject(b.id)}>×</button>

							{#if b.kind === 'celebrity'}
								<div class="badge-menu">
									<button
										class="badge-menu-toggle"
										aria-label="Actions"
										onclick={() => (openMenuId = openMenuId === b.id ? null : b.id)}
									>
										⋯
									</button>
									{#if openMenuId === b.id}
										<div class="badge-menu-items">
											<button class="badge-menu-item" onclick={() => (openMenuId = null)}>
												&#8595; Download Celebrity One-Sheet
											</button>
											<a
												class="badge-menu-item"
												href={b.imdbUrl}
												target="_blank"
												rel="noopener"
												onclick={() => (openMenuId = null)}
											>
												Link to Celebrity's IMDb page
											</a>
										</div>
									{/if}
								</div>
								<img class="badge-photo" src={b.photoUrl} alt={b.name} />
								<div class="badge-name">{b.name}</div>
								<div class="badge-label">E-SCORE</div>
								<div class="badge-value">{b.eScore ?? '—'}</div>
								<button class="btn-onesheet" style="color: {colorOf.get(b.id)}">&#8595; Download Celebrity One-Sheet</button>
								<a class="imdb-link" href={b.imdbUrl} target="_blank" rel="noopener">Link to Celebrity's IMDb page</a>
							{:else}
								<div class="badge-label">CATEGORY</div>
								<div class="badge-name category-name">{b.name}</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</section>
	{/if}

	<section class="chart-grid">
		{#each chartMetrics as metric (metric)}
			<ComparisonChart {metric} subjects={chartSubjects[metric]} />
		{/each}
	</section>
</main>

<style>
	.filter-bar {
		display: flex;
		align-items: flex-end;
		gap: 16px;
		padding: 16px 20px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}
	.control-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.control-group label {
		font-size: 12px;
		color: var(--muted-text);
	}
	.control-group label .count {
		color: var(--muted-text);
	}
	.control-group select,
	.control-group input {
		font-family: inherit;
		font-size: 13px;
		color: var(--heading-text);
		padding: 8px 12px;
		border: 1px solid var(--control-border);
		border-radius: 4px;
		background: #fff;
	}
	.search-group {
		position: relative;
		flex: 1 1 260px;
		min-width: 220px;
	}
	.search-group input {
		width: 100%;
		box-sizing: border-box;
	}

	.search-results {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 10;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 4px 0 0;
		padding: 4px;
		background: #fff;
		border: 1px solid var(--control-border);
		border-radius: 4px;
		box-shadow: var(--shadow);
		max-height: 260px;
		overflow-y: auto;
	}
	.search-result-item {
		width: 100%;
		text-align: left;
		font-size: 13px;
		padding: 6px 8px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.search-result-item:hover {
		background: var(--page-bg);
	}
	.search-result-item.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.search-empty {
		font-size: 12px;
		color: var(--muted-text);
		padding: 6px 8px;
	}
	.kind-badge {
		margin-left: 6px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--muted-text);
		border: 1px solid var(--control-border);
		border-radius: 3px;
		padding: 1px 4px;
	}

	.badge-row {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 12px;
		margin-bottom: 12px;
	}
	.badge-row:focus,
	.badge-slot:focus,
	.celeb-badge:focus {
		outline: none;
	}
	.badge-slot {
		display: flex;
	}
	.badge-slot > * {
		flex: 1;
	}
	.badge-placeholder {
		min-height: 220px;
		border: 2px dashed var(--control-border);
		border-radius: 8px;
		background: transparent;
	}
	.celeb-badge {
		position: relative;
		min-height: 220px;
		background: var(--brand-red);
		color: #fff;
		border-radius: 8px;
		box-shadow: var(--shadow);
		padding: 14px 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.draggable .celeb-badge {
		cursor: grab;
	}
	.draggable .celeb-badge:active {
		cursor: grabbing;
	}
	.category-badge {
		justify-content: center;
	}
	.badge-remove {
		position: absolute;
		top: 6px;
		left: 6px;
		font-size: 16px;
		line-height: 1;
		color: #fff;
		background: transparent;
		border: none;
		padding: 2px 6px;
		cursor: pointer;
		opacity: 0.8;
	}
	.badge-remove:hover {
		opacity: 1;
	}
	.category-name {
		font-size: 15px;
		margin-top: 8px;
		margin-bottom: 0;
	}
	.badge-menu {
		display: none;
		position: absolute;
		top: 6px;
		right: 6px;
	}
	.badge-menu-toggle {
		font-family: inherit;
		font-size: 18px;
		line-height: 1;
		color: #fff;
		background: transparent;
		border: none;
		padding: 2px 6px;
		cursor: pointer;
	}
	.badge-menu-items {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		min-width: 200px;
		background: #fff;
		border: 1px solid var(--control-border);
		border-radius: 4px;
		box-shadow: var(--shadow);
		overflow: hidden;
	}
	.badge-menu-item {
		font-family: inherit;
		font-size: 12px;
		text-align: left;
		color: var(--heading-text);
		background: transparent;
		border: none;
		padding: 8px 12px;
		cursor: pointer;
		text-decoration: none;
	}
	.badge-menu-item:hover {
		background: var(--page-bg);
	}
	.badge-photo {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		object-fit: cover;
		object-position: center top;
		margin-bottom: 8px;
		border: 2px solid #fff;
	}
	.badge-name {
		font-size: 13px;
		font-weight: 700;
		margin-bottom: 8px;
	}
	.badge-label {
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 1px;
	}
	.badge-value {
		font-size: 36px;
		font-weight: 700;
		line-height: 1.1;
		margin: 2px 0 12px;
	}
	.btn-onesheet {
		font-family: inherit;
		font-size: 11px;
		color: var(--brand-red);
		background: #fff;
		border: none;
		border-radius: 4px;
		padding: 7px 8px;
		cursor: pointer;
		width: 100%;
	}
	.imdb-link {
		color: #fff;
		font-size: 11px;
		margin-top: 10px;
		text-decoration: underline;
	}

	.chart-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	@media (max-width: 1000px) {
		.badge-row {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 768px) {
		.chart-grid {
			grid-template-columns: 1fr;
		}
		.badge-row {
			grid-template-columns: repeat(2, 1fr);
		}
		/* On small screens the actions move into the top-right menu. */
		.badge-menu {
			display: block;
		}
		.btn-onesheet,
		.imdb-link {
			display: none;
		}
		.badge-value {
			margin-bottom: 0;
		}
		/* With the actions hidden, the card can be shorter. */
		.celeb-badge,
		.badge-placeholder {
			min-height: 150px;
		}
	}
</style>
