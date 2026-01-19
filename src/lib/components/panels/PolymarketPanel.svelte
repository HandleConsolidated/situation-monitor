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

	// Get probability color based on value
	function getProbabilityColor(yes: number): string {
		if (yes >= 70) return 'high-yes'; // Likely yes
		if (yes <= 30) return 'high-no'; // Likely no
		return 'uncertain'; // Toss-up
	}

	// Get the prediction sentiment label
	function getSentimentLabel(yes: number): string {
		if (yes >= 80) return 'Very Likely';
		if (yes >= 60) return 'Likely';
		if (yes >= 40) return 'Uncertain';
		if (yes >= 20) return 'Unlikely';
		return 'Very Unlikely';
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
						<div class="poly-meta">
							<span class="poly-volume">Vol: {formatVolume(pred.volume)}</span>
							<span class="poly-sentiment {getProbabilityColor(pred.yes)}">{getSentimentLabel(pred.yes)}</span>
						</div>
					</div>
					<div class="poly-value">
						<div class="poly-percent-wrapper {getProbabilityColor(pred.yes)}">
							<span class="poly-percent">{pred.yes}%</span>
							<span class="poly-label">Yes</span>
						</div>
						<div class="poly-bar">
							<div class="poly-bar-fill {getProbabilityColor(pred.yes)}" style="width: {pred.yes}%"></div>
						</div>
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
		align-items: flex-start;
		padding: 0.5rem 0;
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
		transition: background-color 0.15s;
		gap: 0.75rem;
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
	}

	.poly-question {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		color: white;
		line-height: var(--lh-tight);
		margin-bottom: 0.25rem;
	}

	.poly-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.poly-volume {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		line-height: var(--lh-tight);
	}

	.poly-sentiment {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.0625rem 0.25rem;
		border-radius: 2px;
	}

	.poly-sentiment.high-yes {
		background: rgb(16 185 129 / 0.15); /* emerald-500/15 */
		color: rgb(16 185 129); /* emerald-500 */
	}

	.poly-sentiment.high-no {
		background: rgb(239 68 68 / 0.15); /* red-500/15 */
		color: rgb(239 68 68); /* red-500 */
	}

	.poly-sentiment.uncertain {
		background: rgb(245 158 11 / 0.15); /* amber-500/15 */
		color: rgb(245 158 11); /* amber-500 */
	}

	.poly-value {
		flex-shrink: 0;
		min-width: 4.5rem;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.25rem;
	}

	.poly-percent-wrapper {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.poly-percent {
		font-size: var(--fs-base); /* 11px → 14px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}

	.poly-percent-wrapper.high-yes .poly-percent {
		color: rgb(16 185 129); /* emerald-500 */
	}

	.poly-percent-wrapper.high-no .poly-percent {
		color: rgb(239 68 68); /* red-500 */
	}

	.poly-percent-wrapper.uncertain .poly-percent {
		color: rgb(245 158 11); /* amber-500 */
	}

	.poly-label {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.poly-bar {
		width: 100%;
		height: 3px;
		background: rgb(30 41 59); /* slate-800 */
		border-radius: 1.5px;
		overflow: hidden;
	}

	.poly-bar-fill {
		height: 100%;
		border-radius: 1.5px;
		transition: width 0.3s ease;
	}

	.poly-bar-fill.high-yes {
		background: rgb(16 185 129); /* emerald-500 */
	}

	.poly-bar-fill.high-no {
		background: rgb(239 68 68); /* red-500 */
	}

	.poly-bar-fill.uncertain {
		background: rgb(245 158 11); /* amber-500 */
	}
</style>
