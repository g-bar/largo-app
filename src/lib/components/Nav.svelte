<script lang="ts">
	import { page } from '$app/state'

	let open = $state(false)
	const onList = $derived(page.url.pathname === '/')
</script>

<nav class="nav">
	<div class="nav-inner">
		<img class="logo" src="/images/largo-logo-2026.png" alt="Largo" />
		<button class="nav-toggle" aria-label="Toggle menu" aria-expanded={open} onclick={() => (open = !open)}
			>&#9776;</button
		>
		<ul class="nav-links" class:open>
			<!-- svelte-ignore a11y_invalid_attribute -->
			<li><a href="#">DASHBOARD</a></li>
			<!-- svelte-ignore a11y_invalid_attribute -->
			<li><a href="#" class:active={!onList}>SMART SEARCH</a></li>
			<li><a href="/" class:active={onList}>LIST VIEW</a></li>
		</ul>
		<div class="nav-avatar">A</div>
	</div>
</nav>

<style>
	.nav {
		background: var(--card-bg);
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.nav-inner {
		width: 1256px;
		max-width: 100%;
		margin: 0 auto;
		padding: 16px 24px;
		display: flex;
		align-items: center;
		gap: 40px;
	}
	.logo {
		height: 28px;
		width: auto;
		display: block;
		flex-shrink: 0;
	}
	.nav-links {
		display: flex;
		gap: 32px;
		list-style: none;
	}
	.nav-links a {
		text-decoration: none;
		color: var(--muted-text);
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.5px;
		padding-bottom: 4px;
	}
	.nav-links a.active {
		color: var(--heading-text);
		border-bottom: 2px solid var(--brand-red);
	}
	.nav-avatar {
		margin-left: auto;
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--brand-red);
		color: #fff;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.nav-toggle {
		display: none;
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border: 1px solid var(--control-border);
		border-radius: 4px;
		background: #fff;
		color: var(--heading-text);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
	}

	@media (max-width: 768px) {
		.nav-inner {
			gap: 16px;
			flex-wrap: wrap;
		}
		.nav-toggle {
			display: block;
			margin-left: auto;
			order: 1;
		}
		.nav-avatar {
			order: 2;
			margin-left: 0;
		}
		.nav-links {
			order: 3;
			flex-basis: 100%;
			flex-direction: column;
			gap: 0;
			display: none;
		}
		.nav-links.open {
			display: flex;
		}
		.nav-links li {
			padding: 10px 0;
			border-top: 1px solid var(--page-bg);
		}
		.nav-links a {
			padding-bottom: 0;
		}
	}
</style>
