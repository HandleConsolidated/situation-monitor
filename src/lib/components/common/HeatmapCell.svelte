<script lang="ts">
	import type { SectorPerformance } from '$lib/types';
	import { formatPercentChange } from '$lib/utils';

	interface Props {
		sector: SectorPerformance;
		showSymbol?: boolean;
	}

	let { sector, showSymbol = false }: Props = $props();

	const colorClass = $derived(getColorClass(sector.changePercent));

	function getColorClass(change: number): string {
		// Green gradient for positive values
		if (change >= 2) return 'bg-emerald-600';
		if (change >= 1) return 'bg-emerald-500';
		if (change >= 0.5) return 'bg-emerald-400';
		if (change >= 0) return 'bg-emerald-300';
		// Red gradient for negative values
		if (change >= -0.5) return 'bg-red-300';
		if (change >= -1) return 'bg-red-400';
		if (change >= -2) return 'bg-red-500';
		return 'bg-red-600';
	}

	const changeText = $derived(formatPercentChange(sector.changePercent));
</script>

<div class="heatmap-cell {colorClass}">
	<div class="heatmap-name">{sector.name}</div>
	{#if showSymbol}
		<div class="heatmap-symbol">{sector.symbol}</div>
	{/if}
	<div class="heatmap-change">{changeText}</div>
</div>

<style>
	.heatmap-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		border-radius: 2px;
		border: 1px solid rgb(51 65 85); /* slate-700 */
		text-align: center;
		min-height: 3rem;
		transition: filter 0.15s;
	}

	.heatmap-cell:hover {
		filter: brightness(1.25);
	}

	.heatmap-name {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-weight: 700;
		color: white;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
		line-height: var(--lh-tight);
	}

	.heatmap-symbol {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(255 255 255 / 0.7);
		text-transform: uppercase;
		margin-top: 0.125rem;
		line-height: var(--lh-tight);
	}

	.heatmap-change {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		color: white;
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
		margin-top: 0.125rem;
		line-height: var(--lh-tight);
	}
</style>
