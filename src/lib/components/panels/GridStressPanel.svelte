<script lang="ts">
	import { Panel } from '$lib/components/common';
	import type { GridStressData } from '$lib/api';

	interface Props {
		gridData?: GridStressData[];
		loading?: boolean;
		error?: string | null;
	}

	let { gridData = [], loading = false, error = null }: Props = $props();

	const count = $derived(gridData.length);

	/**
	 * Get the status color class based on stress level
	 */
	function getStatusColor(level: GridStressData['stressLevel']): string {
		switch (level) {
			case 'critical':
				return 'status-critical';
			case 'high':
				return 'status-high';
			case 'elevated':
				return 'status-elevated';
			default:
				return 'status-normal';
		}
	}

	/**
	 * Get human-readable status label
	 */
	function getStatusLabel(level: GridStressData['stressLevel']): string {
		switch (level) {
			case 'critical':
				return 'CRITICAL';
			case 'high':
				return 'HIGH';
			case 'elevated':
				return 'ELEVATED';
			default:
				return 'NORMAL';
		}
	}

	/**
	 * Format the percentage with proper precision
	 */
	function formatPercent(value: number): string {
		return Math.round(value).toString();
	}

	/**
	 * Get the progress bar color based on stress level
	 */
	function getBarColor(level: GridStressData['stressLevel']): string {
		switch (level) {
			case 'critical':
				return 'rgb(239 68 68)'; // red-500
			case 'high':
				return 'rgb(249 115 22)'; // orange-500
			case 'elevated':
				return 'rgb(234 179 8)'; // yellow-500
			default:
				return 'rgb(16 185 129)'; // emerald-500
		}
	}
</script>

<Panel id="gridstress" title="Grid Carbon Intensity" {count} {loading} {error}>
	{#if gridData.length === 0 && !loading && !error}
		<div class="grid-empty">No grid data available</div>
	{:else}
		<div class="grid-list">
			{#each gridData as region (region.id)}
				<div class="grid-item">
					<div class="grid-header">
						<div class="grid-info">
							<div class="grid-region">{region.region}</div>
							<div class="grid-country">{region.country}</div>
						</div>
						<div class="grid-status {getStatusColor(region.stressLevel)}">
							{getStatusLabel(region.stressLevel)}
						</div>
					</div>
					<div class="grid-metrics">
						<div class="grid-percent">
							<span class="percent-value">{formatPercent(region.percent)}</span>
							<span class="percent-label">%</span>
						</div>
						<div class="grid-bar-container">
							<div
								class="grid-bar"
								style="width: {region.percent}%; background-color: {getBarColor(region.stressLevel)};"
							></div>
						</div>
					</div>
					<div class="grid-desc">{region.description}</div>
				</div>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.grid-empty {
		text-align: center;
		color: rgb(148 163 184); /* slate-400 */
		font-size: var(--fs-sm); /* 10px -> 12px responsive */
		padding: 1rem;
		line-height: var(--lh-normal);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.grid-list {
		display: flex;
		flex-direction: column;
	}

	.grid-item {
		padding: 0.5rem 0.25rem;
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
		transition: background-color 0.15s;
	}

	.grid-item:last-child {
		border-bottom: none;
	}

	.grid-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.grid-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
	}

	.grid-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
		flex: 1;
	}

	.grid-region {
		font-size: var(--fs-sm); /* 10px -> 12px responsive */
		font-weight: 700;
		color: white;
		line-height: var(--lh-tight);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.grid-country {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184); /* slate-400 */
		line-height: var(--lh-tight);
	}

	.grid-status {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		white-space: nowrap;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
	}

	.status-critical {
		background: rgb(127 29 29 / 0.5); /* red-900/50 */
		color: rgb(248 113 113); /* red-400 */
		border: 1px solid rgb(153 27 27 / 0.5); /* red-800/50 */
	}

	.status-high {
		background: rgb(124 45 18 / 0.5); /* orange-900/50 */
		color: rgb(251 146 60); /* orange-400 */
		border: 1px solid rgb(154 52 18 / 0.5); /* orange-800/50 */
	}

	.status-elevated {
		background: rgb(113 63 18 / 0.5); /* yellow-900/50 */
		color: rgb(250 204 21); /* yellow-400 */
		border: 1px solid rgb(133 77 14 / 0.5); /* yellow-800/50 */
	}

	.status-normal {
		background: rgb(6 78 59 / 0.5); /* emerald-900/50 */
		color: rgb(52 211 153); /* emerald-400 */
		border: 1px solid rgb(6 95 70 / 0.5); /* emerald-800/50 */
	}

	.grid-metrics {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.grid-percent {
		display: flex;
		align-items: baseline;
		gap: 0.125rem;
		min-width: 2.5rem;
	}

	.percent-value {
		font-size: var(--fs-base); /* 12px -> 14px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		color: rgb(226 232 240); /* slate-200 */
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}

	.percent-label {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		line-height: var(--lh-tight);
	}

	.grid-bar-container {
		flex: 1;
		height: 4px;
		background: rgb(30 41 59); /* slate-800 */
		border-radius: 2px;
		overflow: hidden;
	}

	.grid-bar {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease-out;
	}

	.grid-desc {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		color: rgb(100 116 139); /* slate-500 */
		line-height: var(--lh-snug);
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
</style>
