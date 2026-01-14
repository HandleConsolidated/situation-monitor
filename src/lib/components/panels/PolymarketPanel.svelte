<script lang="ts">
	import { Panel } from '$lib/components/common';
	import type { Prediction, PredictionCategory } from '$lib/api';

	interface Props {
		predictions?: Prediction[];
		loading?: boolean;
		error?: string | null;
	}

	let { predictions = [], loading = false, error = null }: Props = $props();

	// Filter state - 'all' shows everything, or filter by category
	type FilterOption = 'all' | PredictionCategory;
	let activeFilter = $state<FilterOption>('all');

	// Filter configuration
	const FILTERS: { key: FilterOption; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'politics', label: 'Political' },
		{ key: 'finance', label: 'Financial' },
		{ key: 'ai', label: 'AI' },
		{ key: 'crypto', label: 'Crypto' }
	];

	// Filter predictions based on active filter
	const filteredPredictions = $derived(
		activeFilter === 'all'
			? predictions
			: predictions.filter((p) => p.category === activeFilter)
	);

	const count = $derived(filteredPredictions.length);

	function formatVolume(v: number | string): string {
		if (typeof v === 'string') return '$' + v;
		if (!v) return '$0';
		if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
		if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
		return '$' + v.toFixed(0);
	}

	function setFilter(filter: FilterOption) {
		activeFilter = filter;
	}
</script>

<Panel id="polymarket" title="Polymarket" {count} {loading} {error} skeletonType="prediction" skeletonCount={4}>
	{#snippet actions()}
		<div class="filter-buttons">
			{#each FILTERS as filter (filter.key)}
				<button
					class="filter-btn"
					class:active={activeFilter === filter.key}
					onclick={() => setFilter(filter.key)}
				>
					{filter.label}
				</button>
			{/each}
		</div>
	{/snippet}

	{#if filteredPredictions.length === 0 && !loading && !error}
		<div class="poly-empty">
			{#if predictions.length === 0}
				No predictions available
			{:else}
				No {activeFilter} predictions
			{/if}
		</div>
	{:else}
		<div class="poly-list">
			{#each filteredPredictions as pred (pred.id)}
				<div class="poly-item">
					<div class="poly-content">
						<div class="poly-question">{pred.question}</div>
						<div class="poly-volume">Vol: {formatVolume(pred.volume)}</div>
					</div>
					<div class="poly-value">
						<span class="poly-percent">{pred.yes}%</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	/* Filter Buttons */
	.filter-buttons {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.filter-btn {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		border: 1px solid rgb(51 65 85 / 0.5); /* slate-700/50 */
		background: transparent;
		color: rgb(148 163 184); /* slate-400 */
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.filter-btn:hover {
		border-color: rgb(34 211 238 / 0.5); /* cyan-400/50 */
		color: rgb(34 211 238); /* cyan-400 */
	}

	.filter-btn.active {
		background: rgb(34 211 238 / 0.15); /* cyan-400/15 */
		border-color: rgb(34 211 238 / 0.5); /* cyan-400/50 */
		color: rgb(34 211 238); /* cyan-400 */
	}

	.poly-empty {
		text-align: center;
		color: rgb(148 163 184); /* slate-400 */
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.poly-list {
		display: flex;
		flex-direction: column;
	}

	.poly-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
		transition: background-color 0.15s;
	}

	.poly-item:last-child {
		border-bottom: none;
	}

	.poly-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.poly-content {
		flex: 1;
		min-width: 0;
		margin-right: 0.5rem;
	}

	.poly-question {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		color: white;
		line-height: var(--lh-tight);
		margin-bottom: 0.125rem;
	}

	.poly-volume {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		line-height: var(--lh-tight);
	}

	.poly-value {
		margin-left: 0.5rem;
	}

	.poly-percent {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(16 185 129); /* emerald-500 */
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}
</style>
