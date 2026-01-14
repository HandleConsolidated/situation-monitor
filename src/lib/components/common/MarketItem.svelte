<script lang="ts">
	import type { MarketItem as MarketItemType } from '$lib/types';
	import { formatPercentChange } from '$lib/utils';

	interface Props {
		item: MarketItemType;
		showSymbol?: boolean;
		showPrice?: boolean;
		compact?: boolean;
		currencySymbol?: string;
	}

	let {
		item,
		showSymbol = true,
		showPrice = true,
		compact = false,
		currencySymbol = '$'
	}: Props = $props();

	const isDataAvailable = $derived(!isNaN(item.price) && item.price !== null);
	const isPositive = $derived(item.changePercent >= 0);
	const priceDisplay = $derived(
		!isDataAvailable
			? '—'
			: item.price > 100
				? item.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
				: item.price.toFixed(2)
	);
	const changeText = $derived(isDataAvailable ? formatPercentChange(item.changePercent) : '—');
</script>

<div
	class="market-item"
	class:market-item--compact={compact}
>
	<div class="market-item__info">
		<div class="market-item__name" class:market-item__name--compact={compact}>{item.name}</div>
		{#if showSymbol}
			<div class="market-item__symbol">{item.symbol}</div>
		{/if}
	</div>

	<div class="market-item__values">
		{#if showPrice}
			<div
				class="market-item__price"
				class:market-item__price--compact={compact}
				class:market-item__price--unavailable={!isDataAvailable}
			>
				{isDataAvailable ? `${currencySymbol}${priceDisplay}` : priceDisplay}
			</div>
		{/if}
		<div
			class="market-item__change"
			class:market-item__change--positive={isDataAvailable && isPositive}
			class:market-item__change--negative={isDataAvailable && !isPositive}
			class:market-item__change--unavailable={!isDataAvailable}
		>
			{changeText}
		</div>
	</div>
</div>

<style>
	.market-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--sp-md) 0;
		border-bottom: 1px solid rgb(255 255 255 / 0.1);
		transition: background-color 0.15s;
	}

	.market-item:last-child {
		border-bottom: none;
	}

	.market-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.market-item--compact {
		padding: var(--sp-sm) 0;
	}

	.market-item__info {
		display: flex;
		flex-direction: column;
		gap: var(--sp-xs);
	}

	.market-item__name {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		color: white;
		line-height: var(--lh-tight);
	}

	.market-item__name--compact {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
	}

	.market-item__symbol {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
	}

	.market-item__values {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--sp-xs);
	}

	.market-item__price {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(226 232 240); /* slate-200 */
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}

	.market-item__price--compact {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
	}

	.market-item__price--unavailable {
		color: rgb(100 116 139); /* slate-500 */
		opacity: 0.5;
	}

	.market-item__change {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}

	.market-item__change--positive {
		color: rgb(16 185 129); /* emerald-500 */
	}

	.market-item__change--negative {
		color: rgb(239 68 68); /* red-500 */
	}

	.market-item__change--unavailable {
		color: rgb(100 116 139); /* slate-500 */
		opacity: 0.5;
	}
</style>
