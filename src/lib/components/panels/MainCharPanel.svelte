<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { allNewsItems } from '$lib/stores';
	import { calculateMainCharacter, type MainCharacterResults } from '$lib/analysis';

	// Calculate main character from all news (reactive via derived store)
	const results: MainCharacterResults = $derived(calculateMainCharacter($allNewsItems));
	const topChar = $derived(results.topCharacter);
	const rankings = $derived(results.characters);
</script>

<Panel id="mainchar" title="Main Character">
	{#if !topChar}
		<div class="empty-state">No data yet</div>
	{:else}
		<div class="main-char-display">
			<div class="main-char-label">Today's Main Character</div>
			<div class="main-char-name">{topChar.name}</div>
			<div class="main-char-count">{topChar.count} mentions in headlines</div>

			{#if rankings.length > 1}
				<div class="main-char-list">
					{#each rankings.slice(1, 8) as char, i (char.name)}
						<div class="char-row">
							<span class="rank">{i + 2}.</span>
							<span class="name">{char.name}</span>
							<span class="mentions">{char.count}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</Panel>

<style>
	.main-char-display {
		text-align: center;
		padding: var(--sp-md);
	}

	.main-char-label {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		margin-bottom: var(--sp-md);
		line-height: var(--lh-tight);
	}

	.main-char-name {
		font-size: var(--fs-xl); /* 14px → 16px responsive */
		font-weight: 700;
		color: var(--accent);
		margin-bottom: var(--sp-sm);
		text-shadow: 0 0 20px var(--accent-glow);
		line-height: var(--lh-tight);
	}

	.main-char-count {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
		margin-bottom: var(--sp-lg);
		line-height: var(--lh-tight);
	}

	.main-char-list {
		border-top: 1px solid var(--border-divider);
		padding-top: var(--sp-md);
	}

	.char-row {
		display: flex;
		align-items: center;
		padding: var(--sp-sm) 0;
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		line-height: var(--lh-snug);
	}

	.rank {
		width: 1.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
	}

	.name {
		flex: 1;
		color: var(--text);
	}

	.mentions {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
		font-variant-numeric: tabular-nums;
	}

	.empty-state {
		text-align: center;
		color: var(--text-dim);
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		padding: var(--sp-lg);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		line-height: var(--lh-normal);
	}
</style>
