<div class="tabs" role="tablist">
	<button class="tab active" role="tab" aria-selected="true">Scorecard</button>
	<button class="tab" role="tab">Awareness</button>
	<button class="tab" role="tab">Appeal</button>
	<button class="tab" role="tab">Attributes</button>
	<button class="tab" role="tab">Trends</button>
	<button class="tab" role="tab">Endorsement</button>
	<button class="tab" role="tab">Fandom</button>
	<button class="tab" role="tab">Social Media</button>
	<button class="tab" role="tab">Consumer comments</button>
</div>

<style>
	.tabs {
		display: flex;
		gap: 2px;
		margin: 20px 0;
		overflow-x: auto;
	}
	.tab {
		font-family: inherit;
		font-size: 14px;
		color: var(--body-text);
		background: #fff;
		border: 1px solid var(--control-border);
		padding: 9px 16px;
		cursor: pointer;
		white-space: nowrap;
	}
	.tab:first-child {
		border-radius: 4px 0 0 4px;
	}
	.tab:last-child {
		border-radius: 0 4px 4px 0;
	}
	.tab + .tab {
		border-left: none;
	}
	.tab.active {
		color: var(--brand-red);
		font-weight: 700;
		border-color: var(--brand-red);
	}
</style>
