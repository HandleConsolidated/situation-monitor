<script lang="ts">
	import { Panel } from '$lib/components/common';
	import type { RadiationReading } from '$lib/api';

	interface Props {
		readings?: RadiationReading[];
		loading?: boolean;
		error?: string | null;
		onReadingClick?: (lat: number, lon: number, location: string) => void;
	}

	let { readings = [], loading = false, error = null, onReadingClick }: Props = $props();

	// Show all readings sorted by level (elevated+ first)
	const sortedReadings = $derived(() => {
		const levelOrder: Record<string, number> = { dangerous: 0, high: 1, elevated: 2, normal: 3 };
		return [...readings]
			.sort((a, b) => (levelOrder[a.level] ?? 3) - (levelOrder[b.level] ?? 3))
			.slice(0, 50);
	});

	// Count only elevated+ readings for the badge
	const count = $derived(readings.filter((r) => r.level !== 'normal').length);

	function handleReadingClick(reading: RadiationReading) {
		if (onReadingClick) {
			const locationName = reading.location || `${reading.lat.toFixed(2)}, ${reading.lon.toFixed(2)}`;
			onReadingClick(reading.lat, reading.lon, locationName);
		}
	}

	/**
	 * Get the status color class based on radiation level
	 */
	function getStatusColor(level: RadiationReading['level']): string {
		switch (level) {
			case 'dangerous':
				return 'status-dangerous';
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
	function getStatusLabel(level: RadiationReading['level']): string {
		switch (level) {
			case 'dangerous':
				return 'DANGER';
			case 'high':
				return 'HIGH';
			case 'elevated':
				return 'ELEVATED';
			default:
				return 'NORMAL';
		}
	}

	/**
	 * Format the radiation value with unit
	 */
	function formatValue(reading: RadiationReading): string {
		if (reading.unit === 'usv') {
			return `${reading.value.toFixed(2)} uSv/h`;
		}
		return `${Math.round(reading.value)} CPM`;
	}

	/**
	 * Format timestamp to relative time
	 */
	function formatTime(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}

	/**
	 * Get location display text
	 */
	function getLocationText(reading: RadiationReading): string {
		if (reading.location) return reading.location;
		return `${reading.lat.toFixed(3)}, ${reading.lon.toFixed(3)}`;
	}
</script>

<Panel id="radiation" title="Radiation Monitor" {count} {loading} {error}>
	{#if sortedReadings().length === 0 && !loading && !error}
		<div class="radiation-empty">
			<span class="radiation-symbol">&#x2622;</span>
			<span>No radiation readings available</span>
		</div>
	{:else}
		<div class="radiation-list">
			{#each sortedReadings() as reading (reading.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="radiation-item"
					class:clickable={!!onReadingClick}
					onclick={() => handleReadingClick(reading)}
				>
					<div class="radiation-header">
						<div class="radiation-info">
							<div class="radiation-value">
								<span class="radiation-symbol-small">&#x2622;</span>
								<span class="value-text">{formatValue(reading)}</span>
							</div>
							<div class="radiation-location">{getLocationText(reading)}</div>
						</div>
						<div class="radiation-status {getStatusColor(reading.level)}">
							{getStatusLabel(reading.level)}
						</div>
					</div>
					<div class="radiation-meta">
						<span class="radiation-time">{formatTime(reading.capturedAt)}</span>
						{#if reading.deviceId}
							<span class="radiation-device">{reading.deviceId}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.radiation-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
		color: rgb(34 197 94); /* green-500 */
		font-size: var(--fs-sm); /* 10px -> 12px responsive */
		padding: 1rem;
		line-height: var(--lh-normal);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.radiation-symbol {
		font-size: 1.5rem;
		opacity: 0.6;
	}

	.radiation-symbol-small {
		font-size: var(--fs-sm);
		margin-right: 0.25rem;
		opacity: 0.8;
	}

	.radiation-list {
		display: flex;
		flex-direction: column;
	}

	.radiation-item {
		padding: 0.5rem 0.25rem;
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
		transition: background-color 0.15s;
	}

	.radiation-item:last-child {
		border-bottom: none;
	}

	.radiation-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.radiation-item.clickable {
		cursor: pointer;
	}

	.radiation-item.clickable:hover {
		background: rgb(6 182 212 / 0.1);
		border-left: 2px solid rgb(6 182 212 / 0.5);
		padding-left: calc(0.25rem - 2px);
	}

	.radiation-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.radiation-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
		flex: 1;
	}

	.radiation-value {
		display: flex;
		align-items: center;
		font-size: var(--fs-sm); /* 10px -> 12px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		color: white;
		line-height: var(--lh-tight);
	}

	.value-text {
		font-variant-numeric: tabular-nums;
	}

	.radiation-location {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		color: rgb(148 163 184); /* slate-400 */
		line-height: var(--lh-tight);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.radiation-status {
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		white-space: nowrap;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
	}

	.status-dangerous {
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

	.radiation-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: var(--fs-xs); /* 9px -> 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		line-height: var(--lh-tight);
	}

	.radiation-time {
		opacity: 0.8;
	}

	.radiation-device {
		opacity: 0.6;
	}

	.radiation-device::before {
		content: '|';
		margin-right: 0.5rem;
		opacity: 0.4;
	}
</style>
