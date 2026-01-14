<script lang="ts">
	import { Panel } from '$lib/components/common';

	interface WhaleTransaction {
		coin: string;
		amount: number;
		usd: number;
		hash: string;
		direction: 'buy' | 'sell' | 'transfer';
		timestamp?: number;
	}

	interface Props {
		whales?: WhaleTransaction[];
		loading?: boolean;
		error?: string | null;
	}

	let { whales = [], loading = false, error = null }: Props = $props();

	const count = $derived(whales.length);

	function formatAmount(amt: number): string {
		return amt >= 1000 ? (amt / 1000).toFixed(1) + 'K' : amt.toFixed(2);
	}

	function formatUSD(usd: number): string {
		if (usd >= 1e9) return '$' + (usd / 1e9).toFixed(1) + 'B';
		if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(1) + 'M';
		return '$' + (usd / 1e3).toFixed(0) + 'K';
	}

	function getDirectionStyle(direction: 'buy' | 'sell' | 'transfer'): string {
		switch (direction) {
			case 'buy':
				return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
			case 'sell':
				return 'text-red-400 bg-red-500/10 border-red-500/30';
			default:
				return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
		}
	}

	function getDirectionLabel(direction: 'buy' | 'sell' | 'transfer'): string {
		switch (direction) {
			case 'buy':
				return 'BUY';
			case 'sell':
				return 'SELL';
			default:
				return 'XFER';
		}
	}
</script>

<Panel id="whales" title="Whale Watch" {count} {loading} {error} skeletonType="whale" skeletonCount={4}>
	{#if whales.length === 0 && !loading && !error}
		<div class="whale-empty">No whale transactions detected</div>
	{:else}
		<div class="whale-list">
			{#each whales as whale, i (whale.hash + i)}
				<div class="whale-item">
					<div class="whale-header">
						<div class="whale-info">
							<span class="whale-coin">{whale.coin}</span>
							<span class="whale-direction {getDirectionStyle(whale.direction)}">{getDirectionLabel(whale.direction)}</span>
						</div>
						<span class="whale-amount">{formatAmount(whale.amount)} {whale.coin}</span>
					</div>
					<div class="whale-meta">
						<span class="whale-usd" class:whale-usd--sell={whale.direction === 'sell'}>{formatUSD(whale.usd)}</span>
						<span class="whale-separator">•</span>
						<span class="whale-hash">{whale.hash}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.whale-empty {
		text-align: center;
		color: rgb(148 163 184); /* slate-400 */
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.whale-list {
		display: flex;
		flex-direction: column;
	}

	.whale-item {
		padding: 0.5rem 0;
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
		transition: background-color 0.15s;
	}

	.whale-item:last-child {
		border-bottom: none;
	}

	.whale-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.whale-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.whale-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.whale-coin {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		color: white;
		line-height: var(--lh-tight);
	}

	.whale-direction {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		border-width: 1px;
		line-height: var(--lh-tight);
	}

	.whale-amount {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(226 232 240); /* slate-200 */
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}

	.whale-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.whale-usd {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(52 211 153); /* emerald-400 */
		line-height: var(--lh-tight);
	}

	.whale-usd--sell {
		color: rgb(248 113 113); /* red-400 */
	}

	.whale-separator {
		color: rgb(71 85 105); /* slate-600 */
		font-size: var(--fs-xs);
	}

	.whale-hash {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		line-height: var(--lh-tight);
	}
</style>
