<script lang="ts">
	import { Panel, MarketItem } from '$lib/components/common';
	import { indices } from '$lib/stores';

	const items = $derived($indices.items);
	const loading = $derived($indices.loading);
	const error = $derived($indices.error);
	const count = $derived(items.length);
</script>

<Panel id="markets" title="Markets" {count} {loading} {error} skeletonType="market" skeletonCount={4}>
	{#if items.length === 0 && !loading && !error}
		<div class="markets-empty">No market data available</div>
	{:else}
		<div class="markets-list">
			{#each items as item (item.symbol)}
				<MarketItem {item} />
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.markets-empty {
		text-align: center;
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		color: rgb(148 163 184); /* slate-400 */
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.markets-list {
		display: flex;
		flex-direction: column;
	}
</style>
