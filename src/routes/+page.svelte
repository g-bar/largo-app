<script lang="ts">
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Largo E-Score: Celebrities</title>
</svelte:head>

<main class="content page">
	<ul class="celeb-list">
		{#each data.celebrities as c (c.id)}
			<li>
				<a class="celeb-row card" href="/celebrity/{c.id}">
					<img class="celeb-photo" src={c.photoUrl} alt={c.name} />
					<span class="celeb-name">{c.name}</span>
				</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	.celeb-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.celeb-row {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 16px;
		text-decoration: none;
		color: inherit;
	}
	.celeb-row:hover {
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
	}
	.celeb-photo {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		object-fit: cover;
		object-position: center top;
		flex-shrink: 0;
	}
	.celeb-name {
		font-size: 16px;
		font-weight: 600;
		color: var(--heading-text);
	}
</style>
