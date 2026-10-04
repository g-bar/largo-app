<script lang="ts">
	import CelebHeader from '#lib/components/CelebHeader.svelte'
	import Tabs from '#lib/components/Tabs.svelte'
	import Toolbar from '#lib/components/Toolbar.svelte'
	import EScoreCard from '#lib/components/EScoreCard.svelte'
	import AwarenessCard from '#lib/components/AwarenessCard.svelte'
	import NewsCarousel from '#lib/components/NewsCarousel.svelte'
	import TotalAppealChart from '#lib/components/TotalAppealChart.svelte'
	import AttributesChart from '#lib/components/AttributesChart.svelte'
	import AppealChart from '#lib/components/AppealChart.svelte'
	import PowerFactorsChart from '#lib/components/PowerFactorsChart.svelte'
	import type { Mode } from '#lib/chart.ts'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	let mode = $state<Mode>('pct')
</script>

<svelte:head>
	<title>Largo E-Score: {data.celebrity.name}</title>
</svelte:head>

<main class="content page">
	<CelebHeader name={data.celebrity.name} photoUrl={data.celebrity.photoUrl} />

	<Tabs />

	<Toolbar bind:mode />

	<section class="top-row">
		<EScoreCard eScore={data.eScore} imdbUrl={data.celebrity.imdbUrl} />
		<AwarenessCard
			{mode}
			sampleBase={data.sampleBase}
			awareness={data.awareness}
			categories={data.awarenessCategories}
		/>
		<NewsCarousel />
	</section>

	<section class="chart-grid">
		<TotalAppealChart {mode} slices={data.totalAppeal} />
		<AttributesChart {mode} slices={data.attributes} />
		<AppealChart
			{mode}
			categoryName={data.appeal.categoryName}
			appeal={data.appeal.data}
			base={data.appeal.base}
		/>
		<PowerFactorsChart
			{mode}
			celebName={data.celebrity.name}
			categoryName={data.powerFactors.categoryName}
			slices={{ celeb: data.powerFactors.celeb, category: data.powerFactors.category }}
		/>
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
