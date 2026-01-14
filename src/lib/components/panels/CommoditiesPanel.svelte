<script lang="ts">
	import { Panel, MarketItem } from '$lib/components/common';
	import { commodities, vix } from '$lib/stores';

	const items = $derived($commodities.items);
	const loading = $derived($commodities.loading);
	const error = $derived($commodities.error);

	// VIX status for panel header
	const vixStatus = $derived(getVixStatus($vix?.price));
	const vixClass = $derived(getVixClass($vix?.price));

	function getVixStatus(level: number | undefined): string {
		if (level === undefined) return '';
		if (level >= 30) return 'HIGH FEAR';
		if (level >= 20) return 'ELEVATED';
		return 'LOW';
	}

	function getVixClass(level: number | undefined): string {
		if (level === undefined) return '';
		if (level >= 30) return 'critical';
		if (level >= 20) return 'elevated';
		return 'monitoring';
	}
</script>

<Panel
	id="commodities"
	title="Commodities / VIX"
	status={vixStatus}
	statusClass={vixClass}
	{loading}
	{error}
>
	{#if items.length === 0 && !loading && !error}
		<div class="commodities-empty">No commodity data available</div>
	{:else}
		<div class="commodities-list">
			{#each items as item (item.symbol)}
				<MarketItem {item} currencySymbol={item.symbol === '^VIX' ? '' : '$'} />
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.commodities-empty {
		text-align: center;
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.commodities-list {
		display: flex;
		flex-direction: column;
	}
</style>
