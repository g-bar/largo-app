<script lang="ts">
	import type { Mode } from '#lib/scorecard.ts'

	let { mode = $bindable() }: { mode: Mode } = $props()
</script>

<div class="toolbar">
	<button class="btn-subscription">Subscription details</button>
	<button class="btn-icon" title="Table view" aria-label="Table view">
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" stroke-width="1.3" />
			<line x1="8" y1="1.5" x2="8" y2="14.5" stroke="currentColor" stroke-width="1.3" />
			<line x1="1.5" y1="8" x2="14.5" y2="8" stroke="currentColor" stroke-width="1.3" />
		</svg>
	</button>
	<div class="toggle-group">
		<button
			class="btn-icon"
			class:active={mode === 'pct'}
			title="Percent"
			aria-pressed={mode === 'pct'}
			onclick={() => (mode = 'pct')}>%</button
		>
		<button
			class="btn-icon"
			class:active={mode === 'count'}
			title="Count"
			aria-pressed={mode === 'count'}
			onclick={() => (mode = 'count')}>#</button
		>
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}
	.btn-subscription {
		font-family: inherit;
		font-size: 13px;
		color: var(--body-text);
		background: #fff;
		border: 1px solid var(--control-border);
		border-radius: 4px;
		padding: 8px 14px;
		cursor: pointer;
	}
	.btn-icon {
		font-family: inherit;
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #fff;
		border: 1px solid var(--control-border);
		border-radius: 4px;
		cursor: pointer;
		color: var(--body-text);
	}
	.toggle-group {
		display: flex;
	}
	.toggle-group .btn-icon:first-child {
		border-radius: 4px 0 0 4px;
	}
	.toggle-group .btn-icon:last-child {
		border-radius: 0 4px 4px 0;
		border-left: none;
	}
	.btn-icon.active {
		background: var(--brand-red);
		color: #fff;
		border-color: var(--brand-red);
	}
</style>
