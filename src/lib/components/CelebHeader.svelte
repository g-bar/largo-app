<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'

	let {
		name,
		photoUrl,
		filter,
		fieldingDates,
		onExport,
	}: {
		name: string
		photoUrl: string
		filter: { fieldingDate: string; gender: string; ageBand: string }
		fieldingDates: string[]
		onExport: () => void
	} = $props()

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
	const dateLabel = (iso: string) =>
		new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

	// Change one filter: rewrite that query param on the current celebrity route and
	// navigate, keeping the others. The load reruns and re-slices the whole page.
	function setParam(key: string, value: string) {
		const params = new URLSearchParams(page.url.search)
		params.set(key, value)
		goto(`${page.url.pathname}?${params}`, { reset: false })
	}
</script>

<section class="header-card">
	<div class="badge">E-SCORE<br />CELEBRITY</div>
	<img class="celeb-photo" src={photoUrl} alt={name} />
	<h1 class="celeb-name">{name}</h1>
	<div class="header-controls">
		<div class="control-group">
			<label for="fielding-date">Fielding date:</label>
			<select
				id="fielding-date"
				value={filter.fieldingDate}
				onchange={e => setParam('fieldingDate', e.currentTarget.value)}
			>
				{#each fieldingDates as d (d)}
					<option value={d}>{dateLabel(d)}</option>
				{/each}
			</select>
		</div>
		<div class="control-group">
			<label for="gender">Gender:</label>
			<select id="gender" value={filter.gender} onchange={e => setParam('gender', e.currentTarget.value)}>
				{#each genderOptions as g (g.value)}
					<option value={g.value}>{g.label}</option>
				{/each}
			</select>
		</div>
		<div class="control-group">
			<label for="age">Age:</label>
			<select id="age" value={filter.ageBand} onchange={e => setParam('ageBand', e.currentTarget.value)}>
				{#each ageOptions as a (a.value)}
					<option value={a.value}>{a.label}</option>
				{/each}
			</select>
		</div>
		<button class="btn-export" onclick={onExport}>Export</button>
	</div>
</section>

<style>
	.header-card {
		background: var(--card-bg);
		border-radius: 8px;
		box-shadow: var(--shadow);
		padding: 16px 20px;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16px;
	}
	.badge {
		background: var(--brand-red);
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0.5px;
		padding: 8px 12px;
		border-radius: 4px;
		text-align: center;
	}
	.celeb-photo {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
		object-position: center top;
		flex-shrink: 0;
	}
	.celeb-name {
		font-size: 22px;
		font-weight: 700;
		color: var(--heading-text);
		margin-right: auto;
	}
	.header-controls {
		display: flex;
		align-items: flex-end;
		gap: 16px;
	}
	.control-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1 1 200px;
	}
	.control-group label {
		font-size: 12px;
		color: var(--muted-text);
	}
	.control-group select {
		font-family: inherit;
		font-size: 12px;
		color: var(--heading-text);
		padding: 8px 12px;
		border: 1px solid var(--control-border);
		border-radius: 4px;
		background: #fff;
		min-width: 0;
	}
	.btn-export {
		font-family: inherit;
		font-size: 14px;
		font-weight: 500;
		color: #fff;
		background: var(--brand-red);
		border: none;
		border-radius: 4px;
		padding: 9px 20px;
		cursor: pointer;
	}

	@media (max-width: 500px) {
		.header-controls {
			flex-wrap: wrap;
		}
	}
</style>
