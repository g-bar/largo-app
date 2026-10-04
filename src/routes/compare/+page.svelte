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

	// Categories can't be compared on E-Score, so they drop out of the picker there.
	const categoriesAllowed = $derived(data.metric !== 'e_score')
	const selected = $derived(new Set(data.selectedIds))

	function navigate(params: URLSearchParams) {
		goto(`/compare?${params}`, { reset: false })
	}

	function setParam(key: string, value: string) {
		const params = new URLSearchParams(page.url.search)
		params.set(key, value)
		// Switching to E-Score drops any selected categories from the URL.
		if (key === 'metric' && value === 'e_score') {
			const kept = data.selectedIds.filter(id => data.pickers.celebrities.some(c => c.id === id))
			params.set('subjects', kept.join(','))
		}
		navigate(params)
	}

	// Toggle a subject in/out of the comparison, capped at MAX.
	function toggleSubject(id: string) {
		const next = new Set(selected)
		if (next.has(id)) next.delete(id)
		else if (next.size < MAX) next.add(id)
		const params = new URLSearchParams(page.url.search)
		params.set('subjects', [...next].join(','))
		navigate(params)
	}

	const atCap = $derived(selected.size >= MAX)
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
				Subjects <span class="count">({selected.size}/{MAX})</span>
			</div>

			<div class="picker-group-label">Celebrities</div>
			<ul class="picker-list">
				{#each data.pickers.celebrities as c (c.id)}
					{@const isOn = selected.has(c.id)}
					<li>
						<label class="picker-item" class:disabled={!isOn && atCap}>
							<input type="checkbox" checked={isOn} disabled={!isOn && atCap} onchange={() => toggleSubject(c.id)} />
							<span>{c.name}</span>
						</label>
					</li>
				{/each}
			</ul>

			{#if categoriesAllowed}
				<div class="picker-group-label">Categories</div>
				<ul class="picker-list">
					{#each data.pickers.categories as c (c.id)}
						{@const isOn = selected.has(c.id)}
						<li>
							<label class="picker-item" class:disabled={!isOn && atCap}>
								<input type="checkbox" checked={isOn} disabled={!isOn && atCap} onchange={() => toggleSubject(c.id)} />
								<span>{c.name}</span>
							</label>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="picker-note">Categories have no E-Score.</div>
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
	.control-group select {
		font-family: inherit;
		font-size: 13px;
		color: var(--heading-text);
		padding: 8px 12px;
		border: 1px solid var(--control-border);
		border-radius: 4px;
		background: #fff;
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
	.picker-group-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--muted-text);
		margin: 10px 0 6px;
	}
	.picker-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.picker-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--body-text);
		padding: 5px 4px;
		border-radius: 4px;
		cursor: pointer;
	}
	.picker-item:hover {
		background: var(--page-bg);
	}
	.picker-item.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.picker-note {
		font-size: 12px;
		color: var(--muted-text);
		margin-top: 6px;
	}

	@media (max-width: 768px) {
		.compare-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
