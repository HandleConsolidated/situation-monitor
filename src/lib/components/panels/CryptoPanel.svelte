<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { crypto } from '$lib/stores';
	import { formatCurrency, formatPercentChange } from '$lib/utils';

	const items = $derived($crypto.items);
	const loading = $derived($crypto.loading);
	const error = $derived($crypto.error);
	const count = $derived(items.length);
</script>

<Panel id="crypto" title="Crypto" {count} {loading} {error} skeletonType="crypto" skeletonCount={3}>
	{#if items.length === 0 && !loading && !error}
		<div class="crypto-empty">No crypto data available</div>
	{:else}
		<div class="crypto-list">
			{#each items as coin, i (coin.id)}
				{@const isPositive = coin.price_change_percentage_24h >= 0}
				<div class="crypto-item" class:crypto-item--border={i < items.length - 1}>
					<div class="crypto-info">
						<div class="crypto-name">{coin.name}</div>
						<div class="crypto-symbol">{coin.symbol.toUpperCase()}</div>
					</div>
					<div class="crypto-values">
						<div class="crypto-price">{formatCurrency(coin.current_price)}</div>
						<div class="crypto-change" class:crypto-change--positive={isPositive} class:crypto-change--negative={!isPositive}>
							{formatPercentChange(coin.price_change_percentage_24h)}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.crypto-empty {
		text-align: center;
		color: rgb(100 116 139); /* slate-500 */
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.crypto-list {
		display: flex;
		flex-direction: column;
	}

	.crypto-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.25rem;
		transition: background-color 0.15s;
	}

	.crypto-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.crypto-item--border {
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
	}

	.crypto-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.crypto-name {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		color: white;
		line-height: var(--lh-tight);
	}

	.crypto-symbol {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184); /* slate-400 */
		line-height: var(--lh-tight);
	}

	.crypto-values {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.125rem;
	}

	.crypto-price {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(226 232 240); /* slate-200 */
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}

	.crypto-change {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}

	.crypto-change--positive {
		color: rgb(16 185 129); /* emerald-500 */
	}

	.crypto-change--negative {
		color: rgb(239 68 68); /* red-500 */
	}
</style>
