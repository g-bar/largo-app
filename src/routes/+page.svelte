<script lang="ts">
	import CelebHeader from '#lib/components/CelebHeader.svelte'
	import Tabs from '#lib/components/Tabs.svelte'
	import Toolbar from '#lib/components/Toolbar.svelte'
	import EScoreCard from '#lib/components/EScoreCard.svelte'
	import AwarenessCard from '#lib/components/AwarenessCard.svelte'
	import NewsCarousel from '#lib/components/NewsCarousel.svelte'
	import ChartCard from '#lib/components/ChartCard.svelte'
	import {
		getScorecard,
		DATE,
		totalAppealOption,
		attributesOption,
		appealOption,
		powerFactorsOption,
		type Mode,
	} from '#lib/scorecard.ts'

	// base is Brad Pitt's total base: the whole page's reference base in # mode.
	const base = getScorecard('brad-pitt', 'total', DATE).base!

	let mode = $state<Mode>('pct')
</script>

<svelte:head>
	<title>Largo E-Score: Brad Pitt</title>
</svelte:head>

<main class="content page">
	<CelebHeader />

	<Tabs />

	<Toolbar bind:mode />

	<section class="top-row">
		<EScoreCard />
		<AwarenessCard {mode} {base} />
		<NewsCarousel />
	</section>

	<section class="chart-grid">
		<ChartCard title="Total Appeal" option={totalAppealOption(mode, base)} />
		<ChartCard title="Attributes" option={attributesOption(mode, base)} />
		<ChartCard title="Appeal" subtitle="Film Personality - Actor" option={appealOption(mode, base)} />
		<ChartCard title="Power Factors™" option={powerFactorsOption(mode, base)} />
	</section>
</main>

<style>
	.top-row {
		display: grid;
		grid-template-columns: 196px 371px 1fr;
		gap: 12px;
		margin-bottom: 12px;
	}
	.chart-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	@media (max-width: 1000px) {
		.top-row {
			grid-template-columns: 196px 1fr;
		}
		.top-row :global(.news-carousel) {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 768px) {
		.top-row {
			grid-template-columns: 1fr;
		}
		.chart-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
