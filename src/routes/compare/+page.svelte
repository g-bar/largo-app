<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import ComparisonChart from '#lib/components/ComparisonChart.svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	const MAX = 5

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
	const metricOptions = [
		{ value: 'awareness', label: 'Awareness' },
		{ value: 'e_score', label: 'E-Score' },
		{ value: 'appeal', label: 'Appeal' },
		{ value: 'attributes', label: 'Attributes' },
		{ value: 'power_factors', label: 'Power Factors' },
	]
	const dateLabel = (iso: string) =>
		new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

	// Categories can't be compared on E-Score.
	const categoriesAllowed = $derived(data.metric !== 'e_score')

	// Celebrity search state.
	let searchQuery = $state('')
	let searchResults = $state<{ id: string; name: string }[]>([])
	let searchPending = $state(false)
	const selectedCelebIds = $derived(new Set(data.selectedIds.filter(id => data.celebrityIds.has(id))))

	// Category filter state.
	const selectedCategoryId = $derived(
		categoriesAllowed ? (data.selectedIds.find(id => data.categoryIds.has(id)) ?? null) : null,
	)

	// Total selected count (celebrities + optional category).
	const selectedCount = $derived(selectedCelebIds.size + (selectedCategoryId ? 1 : 0))
	const atCap = $derived(selectedCount >= MAX)

	function navigate(params: URLSearchParams) {
		goto(`/compare?${params}`, { reset: false })
	}

	function setParam(key: string, value: string) {
		const params = new URLSearchParams(page.url.search)
		params.set(key, value)
		// Switching to E-Score drops any selected category.
		if (key === 'metric' && value === 'e_score' && selectedCategoryId) {
			const kept = data.selectedIds.filter(id => !data.categoryIds.has(id))
			params.set('subjects', kept.join(','))
		}
		navigate(params)
	}

	// Rebuild URL subjects param from current selection.
	function updateSubjects(celebIds: Set<string>, categoryId: string | null) {
		const ids = [...celebIds]
		if (categoryId) ids.push(categoryId)
		const params = new URLSearchParams(page.url.search)
		params.set('subjects', ids.join(','))
		navigate(params)
	}

	// Toggle celebrity in/out of selection.
	function toggleCelebrity(id: string) {
		const next = new Set(selectedCelebIds)
		if (next.has(id)) {
			next.delete(id)
		} else if (!atCap) {
			next.add(id)
		}
		updateSubjects(next, selectedCategoryId)
	}

	// Set category filter (replaces any previous category).
	function setCategory(id: string | null) {
		updateSubjects(selectedCelebIds, id)
	}

	// Remove a selected celebrity (from tag click).
	function removeCelebrity(id: string) {
		const next = new Set(selectedCelebIds)
		next.delete(id)
		updateSubjects(next, selectedCategoryId)
	}

	// Search celebrities with optional category constraint.
	async function searchCelebrities(q: string) {
		if (!q.trim()) {
			searchResults = []
			return
		}
		searchPending = true
		try {
			const catParam = selectedCategoryId ? `&category=${selectedCategoryId}` : ''
			const res = await fetch(`/api/celebrities/search?q=${encodeURIComponent(q)}${catParam}`)
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
		const t = setTimeout(() => searchCelebrities(q), 200)
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
		<div class="control-group">
			<label for="metric">Metric</label>
			<select id="metric" value={data.metric} onchange={e => setParam('metric', e.currentTarget.value)}>
				{#each metricOptions as m (m.value)}
					<option value={m.value}>{m.label}</option>
				{/each}
			</select>
		</div>
	</section>

	<div class="compare-grid">
		<section class="picker card">
			<div class="picker-head">
				Subjects <span class="count">({selectedCount}/{MAX})</span>
			</div>

			{#if categoriesAllowed}
				<div class="control-group" style="margin-bottom: 12px">
					<label for="category">Category</label>
					<select id="category" value={selectedCategoryId ?? ''} onchange={e => setCategory(e.currentTarget.value || null)}>
						<option value="">None</option>
						{#each data.categories as c (c.id)}
							<option value={c.id}>{c.name}</option>
						{/each}
					</select>
				</div>
			{:else}
				<div class="picker-note" style="margin-bottom: 12px">Categories have no E-Score.</div>
			{/if}

			<div class="control-group" style="margin-bottom: 8px">
				<label for="celebrity-search">Celebrity Search</label>
				<input
					id="celebrity-search"
					type="text"
					placeholder="Type to search..."
					bind:value={searchQuery}
				/>
			</div>

			{#if selectedCelebIds.size > 0}
				<div class="selected-tags">
					{#each [...selectedCelebIds] as id (id)}
						{@const celeb = data.celebrityLookup.get(id)}
						{#if celeb}
							<button class="tag" onclick={() => removeCelebrity(id)}>
								{celeb.name}
								<span class="tag-remove">×</span>
							</button>
						{/if}
					{/each}
				</div>
			{/if}

			{#if searchQuery && searchResults.length > 0}
				<ul class="search-results">
					{#each searchResults as r (r.id)}
						{@const isSelected = selectedCelebIds.has(r.id)}
						<li>
							<button
								class="search-result-item"
								class:selected={isSelected}
								class:disabled={!isSelected && atCap}
								disabled={!isSelected && atCap}
								onclick={() => toggleCelebrity(r.id)}
							>
								{r.name}
								{#if isSelected}<span class="check">✓</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
			{:else if searchQuery && !searchPending && searchResults.length === 0}
				<div class="picker-note">No celebrities found.</div>
			{/if}
		</section>

		<section class="chart-area">
			<ComparisonChart metric={data.metric} subjects={data.subjects} />
		</section>
	</div>
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
	.control-group input {
		width: 100%;
		box-sizing: border-box;
	}

	.compare-grid {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 12px;
	}
	.picker {
		padding: 16px;
		align-self: start;
		max-height: 70vh;
		overflow-y: auto;
	}
	.picker-head {
		font-size: 15px;
		font-weight: 700;
		color: var(--heading-text);
		margin-bottom: 12px;
	}
	.picker-head .count {
		font-weight: 500;
		color: var(--muted-text);
	}
	.picker-note {
		font-size: 12px;
		color: var(--muted-text);
	}

	.selected-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 8px;
	}
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		padding: 4px 8px;
		background: var(--page-bg);
		border: 1px solid var(--control-border);
		border-radius: 4px;
		cursor: pointer;
	}
	.tag:hover {
		background: #e5e7eb;
	}
	.tag-remove {
		font-size: 14px;
		color: var(--muted-text);
	}

	.search-results {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
		padding: 0;
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
	.search-result-item.selected {
		background: #fef3c7;
	}
	.search-result-item.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.search-result-item .check {
		color: var(--muted-text);
	}

	@media (max-width: 768px) {
		.compare-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
