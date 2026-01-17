<script lang="ts">
	import { Panel } from '$lib/components/common';
	import type { DiseaseOutbreak, DiseaseOutbreakSeverity, DiseaseOutbreakStatus } from '$lib/types';

	interface Props {
		outbreaks?: DiseaseOutbreak[];
		loading?: boolean;
		error?: string | null;
		onOutbreakClick?: (lat: number, lon: number, disease: string) => void;
	}

	let { outbreaks = [], loading = false, error = null, onOutbreakClick }: Props = $props();

	function handleOutbreakClick(outbreak: DiseaseOutbreak) {
		if (onOutbreakClick) {
			onOutbreakClick(outbreak.lat, outbreak.lon, outbreak.disease);
		}
	}

	const count = $derived(outbreaks.length);

	/**
	 * Get the severity color class
	 */
	function getSeverityColor(severity: DiseaseOutbreakSeverity): string {
		switch (severity) {
			case 'critical':
				return 'severity-critical';
			case 'high':
				return 'severity-high';
			case 'moderate':
				return 'severity-moderate';
			default:
				return 'severity-low';
		}
	}

	/**
	 * Get human-readable severity label
	 */
	function getSeverityLabel(severity: DiseaseOutbreakSeverity): string {
		switch (severity) {
			case 'critical':
				return 'CRITICAL';
			case 'high':
				return 'HIGH';
			case 'moderate':
				return 'MODERATE';
			default:
				return 'LOW';
		}
	}

	/**
	 * Get status color class
	 */
	function getStatusColor(status: DiseaseOutbreakStatus): string {
		switch (status) {
			case 'active':
				return 'status-active';
			case 'contained':
				return 'status-contained';
			default:
				return 'status-monitoring';
		}
	}

	/**
	 * Get human-readable status label
	 */
	function getStatusLabel(status: DiseaseOutbreakStatus): string {
		switch (status) {
			case 'active':
				return 'ACTIVE';
			case 'contained':
				return 'CONTAINED';
			default:
				return 'MONITORING';
		}
	}

	/**
	 * Format number with K/M suffix
	 */
	function formatNumber(num: number | undefined): string {
		if (num === undefined) return '-';
		if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
		if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
		return num.toString();
	}

	/**
	 * Format date for display
	 */
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<Panel id="outbreaks" title="Disease Outbreaks" {count} {loading} {error}>
	{#if outbreaks.length === 0 && !loading && !error}
		<div class="outbreak-empty">No disease outbreaks detected</div>
	{:else}
		<div class="outbreak-list">
			{#each outbreaks as outbreak (outbreak.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="outbreak-item"
					class:clickable={!!onOutbreakClick}
					onclick={() => handleOutbreakClick(outbreak)}
				>
					<div class="outbreak-header">
						<div class="outbreak-disease">
							<span class="disease-name">{outbreak.disease}</span>
							<span class="severity-badge {getSeverityColor(outbreak.severity)}">
								{getSeverityLabel(outbreak.severity)}
							</span>
						</div>
						<div class="status-badge {getStatusColor(outbreak.status)}">
							{getStatusLabel(outbreak.status)}
						</div>
					</div>
					<div class="outbreak-location">
						<span class="country">{outbreak.country}</span>
						{#if outbreak.region}
							<span class="region">({outbreak.region})</span>
						{/if}
					</div>
					<div class="outbreak-stats">
						{#if outbreak.cases !== undefined}
							<div class="stat">
								<span class="stat-label">Cases</span>
								<span class="stat-value">{formatNumber(outbreak.cases)}</span>
							</div>
						{/if}
						{#if outbreak.deaths !== undefined}
							<div class="stat stat-deaths">
								<span class="stat-label">Deaths</span>
								<span class="stat-value">{formatNumber(outbreak.deaths)}</span>
							</div>
						{/if}
						<div class="stat stat-date">
							<span class="stat-label">Updated</span>
							<span class="stat-value">{formatDate(outbreak.lastUpdate)}</span>
						</div>
					</div>
					<div class="outbreak-source">
						{#if outbreak.url}
							<a href={outbreak.url} target="_blank" rel="noopener noreferrer" class="source-link" onclick={(e) => e.stopPropagation()}>
								{outbreak.source}
							</a>
						{:else}
							<span class="source-text">{outbreak.source}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.outbreak-empty {
		text-align: center;
		color: rgb(148 163 184); /* slate-400 */
		font-size: var(--fs-sm); /* 10px -> 12px responsive */
		padding: 1rem;
		line-height: var(--lh-normal);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.outbreak-list {
		display: flex;
		flex-direction: column;
	}

	.outbreak-item {
		padding: 0.5rem 0.25rem;
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
		transition: background-color 0.15s;
	}

	.outbreak-item:last-child {
		border-bottom: none;
	}

	.outbreak-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.outbreak-item.clickable {
		cursor: pointer;
	}

	.outbreak-item.clickable:hover {
		background: rgb(6 182 212 / 0.1);
		border-left: 2px solid rgb(6 182 212 / 0.5);
		padding-left: calc(0.25rem - 2px);
	}

	.outbreak-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.outbreak-disease {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
		min-width: 0;
		flex: 1;
	}

	.disease-name {
		font-size: var(--fs-sm); /* 10px -> 12px responsive */
		font-weight: 700;
		color: white;
		line-height: var(--lh-tight);
	}

	.severity-badge,
	.status-badge {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		padding: 0.0625rem 0.25rem;
		border-radius: 2px;
		white-space: nowrap;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
	}

	/* Severity colors */
	.severity-critical {
		background: rgb(127 29 29 / 0.5); /* red-900/50 */
		color: rgb(248 113 113); /* red-400 */
		border: 1px solid rgb(153 27 27 / 0.5); /* red-800/50 */
	}

	.severity-high {
		background: rgb(124 45 18 / 0.5); /* orange-900/50 */
		color: rgb(251 146 60); /* orange-400 */
		border: 1px solid rgb(154 52 18 / 0.5); /* orange-800/50 */
	}

	.severity-moderate {
		background: rgb(113 63 18 / 0.5); /* yellow-900/50 */
		color: rgb(250 204 21); /* yellow-400 */
		border: 1px solid rgb(133 77 14 / 0.5); /* yellow-800/50 */
	}

	.severity-low {
		background: rgb(6 78 59 / 0.5); /* emerald-900/50 */
		color: rgb(52 211 153); /* emerald-400 */
		border: 1px solid rgb(6 95 70 / 0.5); /* emerald-800/50 */
	}

	/* Status colors */
	.status-active {
		background: rgb(127 29 29 / 0.3); /* red-900/30 */
		color: rgb(248 113 113); /* red-400 */
		border: 1px solid rgb(153 27 27 / 0.3); /* red-800/30 */
	}

	.status-contained {
		background: rgb(6 78 59 / 0.3); /* emerald-900/30 */
		color: rgb(52 211 153); /* emerald-400 */
		border: 1px solid rgb(6 95 70 / 0.3); /* emerald-800/30 */
	}

	.status-monitoring {
		background: rgb(113 63 18 / 0.3); /* yellow-900/30 */
		color: rgb(250 204 21); /* yellow-400 */
		border: 1px solid rgb(133 77 14 / 0.3); /* yellow-800/30 */
	}

	.outbreak-location {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		color: rgb(148 163 184); /* slate-400 */
		line-height: var(--lh-tight);
		margin-bottom: 0.375rem;
	}

	.country {
		color: rgb(203 213 225); /* slate-300 */
	}

	.region {
		color: rgb(100 116 139); /* slate-500 */
		margin-left: 0.25rem;
	}

	.outbreak-stats {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 0.25rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}

	.stat-label {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
	}

	.stat-value {
		font-size: var(--fs-sm); /* 10px -> 12px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		color: rgb(226 232 240); /* slate-200 */
		font-variant-numeric: tabular-nums;
		line-height: var(--lh-tight);
	}

	.stat-deaths .stat-value {
		color: rgb(248 113 113); /* red-400 */
	}

	.stat-date .stat-value {
		color: rgb(148 163 184); /* slate-400 */
	}

	.outbreak-source {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		line-height: var(--lh-tight);
	}

	.source-link {
		color: rgb(6 182 212); /* cyan-500 */
		text-decoration: none;
	}

	.source-link:hover {
		text-decoration: underline;
	}

	.source-text {
		color: rgb(100 116 139); /* slate-500 */
	}
</style>
