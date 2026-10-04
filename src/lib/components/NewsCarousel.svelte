<script lang="ts">
	import NEWS from '#lib/data/news.json'

	const GAP = 12
	const CARD_TARGET = 150

	let start = $state(0)
	let viewportWidth = $state(0)
	let animate = $state(false)

	// Number shown is however many target-width cards fit in the current viewport
	// (floored), clamped to [1, NEWS.length]. Matches the original's smooth adapt.
	const visible = $derived.by(() => {
		if (!viewportWidth) return 1
		const fit = Math.floor((viewportWidth + GAP) / (CARD_TARGET + GAP))
		return Math.min(NEWS.length, Math.max(1, fit))
	})
	const maxStart = $derived(Math.max(0, NEWS.length - visible))
	const cardWidth = $derived(viewportWidth ? (viewportWidth - GAP * (visible - 1)) / visible : 0)
	const step = $derived(cardWidth + GAP)

	// Any viewport change resets the flag so resizes never animate; clicks re-enable it.
	$effect(() => {
		viewportWidth
		animate = false
	})

	// Clamp start into range when the viewport shrinks the number of pages.
	$effect(() => {
		if (start > maxStart) start = maxStart
	})

	function prev() {
		animate = true
		start = Math.max(0, start - visible)
	}
	function next() {
		animate = true
		start = Math.min(maxStart, start + visible)
	}
</script>

<div class="news-carousel">
	<div class="news-controls">
		<button class="news-arrow" aria-label="Previous news" disabled={start === 0} onclick={prev}>&#8249;</button>
		<button class="news-arrow" aria-label="Next news" disabled={start >= maxStart} onclick={next}>&#8250;</button>
	</div>
	<div class="news-viewport" bind:clientWidth={viewportWidth}>
		<div class="news-track" style:transform="translateX({-start * step}px)" style:transition={animate ? '' : 'none'}>
			{#if viewportWidth}
				{#each NEWS as item (item.title)}
					<!-- svelte-ignore a11y_invalid_attribute -->
					<a class="card news-card" href="#" style:width="{cardWidth}px">
						<div class="news-img" style:background={item.image}>
							<span class="news-date">{item.date}</span>
						</div>
						<div class="news-body"><div class="news-title">{item.title}</div></div>
					</a>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.news-carousel {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.news-controls {
		display: flex;
		justify-content: flex-end;
		gap: 4px;
	}
	.news-arrow {
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		border: 1px solid var(--control-border);
		border-radius: 4px;
		background: #fff;
		color: var(--body-text);
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
	}
	.news-arrow:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.news-viewport {
		flex: 1;
		overflow: hidden;
		min-width: 0;
	}
	.news-track {
		display: flex;
		gap: 12px;
		height: 100%;
		transition: transform 0.25s ease;
	}
	.news-track .news-card {
		flex-shrink: 0;
	}
	.news-card {
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.news-img {
		height: 90px;
		position: relative;
		background-size: cover;
		background-position: center;
	}
	.news-date {
		position: absolute;
		bottom: 8px;
		left: 8px;
		background: var(--brand-red);
		color: #fff;
		font-size: 10px;
		font-weight: 500;
		padding: 3px 6px;
		border-radius: 2px;
	}
	.news-body {
		padding: 10px 12px;
		flex: 1;
	}
	.news-title {
		font-size: 13px;
		font-weight: 500;
		color: var(--heading-text);
		line-height: 1.35;
	}
</style>
