<script lang="ts">
	import { Panel } from '$lib/components/common';
	import type { EarthquakeData } from '$lib/types';

	interface Props {
		earthquakes?: EarthquakeData[];
		loading?: boolean;
		error?: string | null;
		onEarthquakeClick?: (lat: number, lon: number, place: string) => void;
	}

	let { earthquakes = [], loading = false, error = null, onEarthquakeClick }: Props = $props();

	function handleEarthquakeClick(earthquake: EarthquakeData) {
		if (onEarthquakeClick) {
			onEarthquakeClick(earthquake.lat, earthquake.lon, earthquake.place);
		}
	}

	// Sort earthquakes by magnitude (highest first)
	const sortedEarthquakes = $derived(
		[...earthquakes].sort((a, b) => b.magnitude - a.magnitude)
	);

	const count = $derived(earthquakes.length);

	/**
	 * Get severity level based on magnitude
	 * 7+ = critical, 6-7 = high, 5-6 = moderate, 4-5 = low
	 */
	function getSeverityClass(magnitude: number): string {
		if (magnitude >= 7.0) return 'severity-critical';
		if (magnitude >= 6.0) return 'severity-high';
		if (magnitude >= 5.0) return 'severity-moderate';
		return 'severity-low';
	}

	/**
	 * Get magnitude label
	 */
	function getSeverityLabel(magnitude: number): string {
		if (magnitude >= 7.0) return 'MAJOR';
		if (magnitude >= 6.0) return 'STRONG';
		if (magnitude >= 5.0) return 'MODERATE';
		return 'LIGHT';
	}

	/**
	 * Format time as relative (e.g., "2h ago", "15m ago")
	 */
	function formatTimeAgo(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'just now';
	}

	/**
	 * Format depth with units
	 */
	function formatDepth(depth: number): string {
		return `${depth.toFixed(1)} km`;
	}

	/**
	 * Get magnitude color for visual indicator
	 */
	function getMagnitudeColor(magnitude: number): string {
		if (magnitude >= 7.0) return 'rgb(239 68 68)'; // red-500
		if (magnitude >= 6.0) return 'rgb(249 115 22)'; // orange-500
		if (magnitude >= 5.0) return 'rgb(234 179 8)'; // yellow-500
		return 'rgb(34 197 94)'; // green-500
	}
</script>

<Panel id="earthquakes" title="Earthquakes" {count} {loading} {error}>
	{#if sortedEarthquakes.length === 0 && !loading && !error}
		<div class="quake-empty">No recent earthquakes detected</div>
	{:else}
		<div class="quake-list">
			{#each sortedEarthquakes as earthquake (earthquake.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="quake-item"
					class:clickable={!!onEarthquakeClick}
					onclick={() => handleEarthquakeClick(earthquake)}
				>
					<div class="quake-header">
						<div class="quake-mag-container">
							<div
								class="quake-mag"
								style="background-color: {getMagnitudeColor(earthquake.magnitude)}20; border-color: {getMagnitudeColor(earthquake.magnitude)};"
							>
								<span class="mag-value">{earthquake.magnitude.toFixed(1)}</span>
							</div>
						</div>
						<div class="quake-info">
							<div class="quake-place">{earthquake.place}</div>
							<div class="quake-meta">
								<span class="quake-time">{formatTimeAgo(earthquake.time)}</span>
								<span class="quake-separator">|</span>
								<span class="quake-depth">Depth: {formatDepth(earthquake.depth)}</span>
							</div>
						</div>
						<div class="quake-severity {getSeverityClass(earthquake.magnitude)}">
							{getSeverityLabel(earthquake.magnitude)}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.quake-empty {
		text-align: center;
		color: rgb(148 163 184); /* slate-400 */
		font-size: var(--fs-sm); /* 10px -> 12px responsive */
		padding: 1rem;
		line-height: var(--lh-normal);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.quake-list {
		display: flex;
		flex-direction: column;
	}

	.quake-item {
		padding: 0.5rem 0.25rem;
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
		transition: background-color 0.15s;
	}

	.quake-item:last-child {
		border-bottom: none;
	}

	.quake-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.quake-item.clickable {
		cursor: pointer;
	}

	.quake-item.clickable:hover {
		background: rgb(6 182 212 / 0.1);
		border-left: 2px solid rgb(6 182 212 / 0.5);
		padding-left: calc(0.25rem - 2px);
	}

	.quake-header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.quake-mag-container {
		flex-shrink: 0;
	}

	.quake-mag {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 4px;
		border: 1px solid;
	}

	.mag-value {
		font-size: var(--fs-base); /* 12px -> 14px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		color: rgb(226 232 240); /* slate-200 */
		line-height: var(--lh-tight);
	}

	.quake-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
	}

	.quake-place {
		font-size: var(--fs-sm); /* 10px -> 12px responsive */
		font-weight: 600;
		color: white;
		line-height: var(--lh-snug);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.quake-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184); /* slate-400 */
		line-height: var(--lh-tight);
	}

	.quake-separator {
		color: rgb(71 85 105); /* slate-600 */
	}

	.quake-severity {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		white-space: nowrap;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
		flex-shrink: 0;
	}

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
</style>
