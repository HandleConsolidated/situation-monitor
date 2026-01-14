<script lang="ts">
	import { Panel } from '$lib/components/common';

	interface Contract {
		agency: string;
		description: string;
		vendor: string;
		amount: number;
		url?: string;
	}

	interface Props {
		contracts?: Contract[];
		loading?: boolean;
		error?: string | null;
	}

	let { contracts = [], loading = false, error = null }: Props = $props();

	const count = $derived(contracts.length);

	function formatValue(v: number): string {
		if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
		if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
		if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
		return '$' + v.toFixed(0);
	}
</script>

<Panel id="contracts" title="Gov Contracts" {count} {loading} {error} skeletonType="contract" skeletonCount={3}>
	{#if contracts.length === 0 && !loading && !error}
		<div class="contracts-empty">No contracts available</div>
	{:else}
		<div class="contracts-list">
			{#each contracts as contract, i (contract.vendor + i)}
				<a
					href={contract.url || 'https://www.usaspending.gov'}
					target="_blank"
					rel="noopener noreferrer"
					class="contract-item"
				>
					<div class="contract-agency">{contract.agency}</div>
					<div class="contract-description">
						{contract.description.length > 100
							? contract.description.substring(0, 100) + '...'
							: contract.description}
					</div>
					<div class="contract-footer">
						<span class="contract-vendor">{contract.vendor}</span>
						<span class="contract-amount">{formatValue(contract.amount)}</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.contracts-empty {
		text-align: center;
		color: rgb(148 163 184); /* slate-400 */
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.contracts-list {
		display: flex;
		flex-direction: column;
	}

	.contract-item {
		display: block;
		padding: 0.5rem 0;
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.contract-item:last-child {
		border-bottom: none;
	}

	.contract-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.contract-agency {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184); /* slate-400 */
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
		line-height: var(--lh-tight);
	}

	.contract-description {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		color: white;
		line-height: var(--lh-snug);
		margin-bottom: 0.375rem;
		transition: color 0.15s;
	}

	.contract-item:hover .contract-description {
		color: rgb(34 211 238); /* cyan-400 */
	}

	.contract-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.contract-vendor {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		line-height: var(--lh-tight);
	}

	.contract-amount {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(16 185 129); /* emerald-500 */
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}
</style>
