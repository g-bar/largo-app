<script lang="ts">
	import { getScorecard, DATE } from '#lib/scorecard.ts'

	const eScore = getScorecard('brad-pitt', 'total', DATE).eScore
</script>

<div class="card escore-card">
	<div class="escore-label">E-SCORE</div>
	<div class="escore-value">{eScore}</div>
	<button class="btn-onesheet">&#8595; Download Celebrity One-Sheet</button>
	<a class="imdb-link" href="https://www.imdb.com/fr/name/nm0000093/" target="_blank" rel="noopener"
		>Link to Celebrity's IMDb page</a
	>
</div>

<style>
	.escore-card {
		background: var(--brand-red);
		color: #fff;
		padding: 24px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
	}
	.escore-label {
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 1px;
	}
	.escore-value {
		font-size: 64px;
		font-weight: 700;
		line-height: 1.1;
		margin: 8px 0 20px;
	}
	.btn-onesheet {
		font-family: inherit;
		font-size: 12px;
		color: var(--brand-red);
		background: #fff;
		border: none;
		border-radius: 4px;
		padding: 8px 12px;
		cursor: pointer;
		width: 100%;
	}
	.imdb-link {
		color: #fff;
		font-size: 12px;
		margin-top: 12px;
		text-decoration: underline;
	}
</style>
