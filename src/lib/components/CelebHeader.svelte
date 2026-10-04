<section class="header-card">
	<div class="badge">E-SCORE<br />CELEBRITY</div>
	<img class="celeb-photo" src="/images/brad-pitt.jpg" alt="Brad Pitt" />
	<h1 class="celeb-name">Brad Pitt</h1>
	<div class="header-controls">
		<div class="control-group">
			<label for="fielding-date">Fielding date:</label>
			<select id="fielding-date">
				<option>July 25, 2025</option>
			</select>
		</div>
		<div class="control-group">
			<label for="filter-by">Filter by:</label>
			<select id="filter-by">
				<option>Total</option>
			</select>
		</div>
		<button class="btn-export">Export</button>
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
