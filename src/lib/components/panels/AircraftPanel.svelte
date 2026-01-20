<script lang="ts">
	import { Panel } from '$lib/components/common';
	import type { Aircraft } from '$lib/types';

	interface AircraftSnapshot {
		timestamp: number;
		aircraft: Aircraft[];
		region: string;
	}

	// Predefined ADS-B regions for filtering
	const AIRCRAFT_REGIONS: Record<string, { name: string; bounds: [number, number, number, number] }> = {
		'north-america': { name: 'North America', bounds: [-170, 15, -50, 72] },
		'europe': { name: 'Europe', bounds: [-25, 35, 45, 72] },
		'middle-east': { name: 'Middle East', bounds: [25, 12, 65, 45] },
		'east-asia': { name: 'East Asia', bounds: [95, 15, 150, 55] },
		'southeast-asia': { name: 'SE Asia', bounds: [90, -15, 155, 28] },
		'australia': { name: 'Oceania', bounds: [110, -50, 180, 0] },
		'south-america': { name: 'S. America', bounds: [-85, -60, -30, 15] },
		'africa': { name: 'Africa', bounds: [-20, -40, 55, 40] },
		'viewport': { name: 'Viewport', bounds: [0, 0, 0, 0] } // Dynamic - uses map bounds
	};

	interface Props {
		aircraft?: Aircraft[];
		history?: AircraftSnapshot[];
		loading?: boolean;
		error?: string | null;
		adsbEnabled?: boolean;
		selectedRegions?: Set<string>;
		onSelectAircraft?: (aircraft: Aircraft, trackHistory: Array<{ lat: number; lon: number; timestamp: number; altitude: number | null }>) => void;
		onRegionsChange?: (regions: Set<string>) => void;
		onAdsbToggle?: (enabled: boolean) => void;
	}

	let {
		aircraft = [],
		history = [],
		loading = false,
		error = null,
		adsbEnabled = false,
		selectedRegions = new Set(['viewport']),
		onSelectAircraft,
		onRegionsChange,
		onAdsbToggle
	}: Props = $props();

	// Search/filter state
	let searchQuery = $state('');
	let selectedIcao = $state<string | null>(null);
	let sortBy = $state<'callsign' | 'altitude' | 'speed' | 'country'>('callsign');

	// Filter and sort aircraft based on search
	const filteredAircraft = $derived(() => {
		let filtered = aircraft;

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim();
			filtered = aircraft.filter(a =>
				a.callsign?.toLowerCase().includes(query) ||
				a.icao24.toLowerCase().includes(query) ||
				a.originCountry.toLowerCase().includes(query) ||
				a.squawk?.includes(query)
			);
		}

		// Sort
		return [...filtered].sort((a, b) => {
			switch (sortBy) {
				case 'callsign':
					return (a.callsign || a.icao24).localeCompare(b.callsign || b.icao24);
				case 'altitude':
					const altA = a.geoAltitude ?? a.baroAltitude ?? 0;
					const altB = b.geoAltitude ?? b.baroAltitude ?? 0;
					return altB - altA;
				case 'speed':
					return (b.velocity ?? 0) - (a.velocity ?? 0);
				case 'country':
					return a.originCountry.localeCompare(b.originCountry);
				default:
					return 0;
			}
		});
	});

	const count = $derived(filteredAircraft().length);

	// Get track history for a specific aircraft
	function getTrackHistory(icao24: string): Array<{ lat: number; lon: number; timestamp: number; altitude: number | null }> {
		const positions: Array<{ lat: number; lon: number; timestamp: number; altitude: number | null }> = [];

		for (const snapshot of history) {
			const ac = snapshot.aircraft.find(a => a.icao24 === icao24);
			if (ac && ac.latitude !== null && ac.longitude !== null) {
				positions.push({
					lat: ac.latitude,
					lon: ac.longitude,
					timestamp: snapshot.timestamp,
					altitude: ac.geoAltitude ?? ac.baroAltitude
				});
			}
		}

		return positions;
	}

	// Handle aircraft selection
	function handleSelect(ac: Aircraft) {
		selectedIcao = ac.icao24;
		const trackHistory = getTrackHistory(ac.icao24);
		onSelectAircraft?.(ac, trackHistory);
	}

	// Format altitude for display
	function formatAltitude(meters: number | null): string {
		if (meters === null) return 'GND';
		const feet = Math.round(meters * 3.28084);
		if (feet < 1000) return `${feet} ft`;
		return `FL${Math.round(feet / 100)}`;
	}

	// Format speed for display
	function formatSpeed(ms: number | null): string {
		if (ms === null) return '-';
		const knots = Math.round(ms * 1.94384);
		return `${knots} kts`;
	}

	// Format heading for display
	function formatHeading(deg: number | null): string {
		if (deg === null) return '-';
		const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
		const index = Math.round(deg / 45) % 8;
		return `${Math.round(deg)}° ${directions[index]}`;
	}

	// Get altitude color class
	function getAltitudeColor(meters: number | null, onGround: boolean): string {
		if (onGround || meters === null) return 'alt-ground';
		const feet = meters * 3.28084;
		if (feet < 10000) return 'alt-low';
		if (feet < 20000) return 'alt-medium';
		if (feet < 35000) return 'alt-high';
		return 'alt-cruise';
	}

	// Get time ago string
	function timeAgo(timestamp: number): string {
		const seconds = Math.floor((Date.now() / 1000) - timestamp);
		if (seconds < 60) return `${seconds}s ago`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		return `${Math.floor(seconds / 3600)}h ago`;
	}

	// Toggle region selection
	function toggleRegion(regionId: string) {
		const newSet = new Set(selectedRegions);
		if (newSet.has(regionId)) {
			newSet.delete(regionId);
		} else {
			newSet.add(regionId);
		}
		onRegionsChange?.(newSet);
	}

	// Toggle ADS-B tracking
	function toggleAdsb() {
		onAdsbToggle?.(!adsbEnabled);
	}
</script>

<Panel id="aircraft" title="Aircraft Tracker" {count} {loading} {error} skeletonType="generic" skeletonCount={5}>
	{#snippet actions()}
		<div class="aircraft-controls">
			<button
				class="adsb-toggle"
				class:active={adsbEnabled}
				onclick={toggleAdsb}
				title={adsbEnabled ? 'Disable ADS-B tracking' : 'Enable ADS-B tracking'}
			>
				{adsbEnabled ? 'ON' : 'OFF'}
			</button>
			<select class="sort-select" bind:value={sortBy}>
				<option value="callsign">Callsign</option>
				<option value="altitude">Altitude</option>
				<option value="speed">Speed</option>
				<option value="country">Country</option>
			</select>
		</div>
	{/snippet}

	<div class="aircraft-panel">
		<!-- ADS-B Region Selection -->
		<div class="region-section">
			<span class="region-title">REGIONS</span>
			<div class="region-grid">
				{#each Object.entries(AIRCRAFT_REGIONS) as [regionId, region]}
					<button
						class="region-btn"
						class:active={selectedRegions.has(regionId)}
						onclick={() => toggleRegion(regionId)}
						title={region.name}
						disabled={!adsbEnabled}
					>
						{region.name.length > 10 ? region.name.split(' ')[0] : region.name}
					</button>
				{/each}
			</div>
		</div>

		<!-- Search bar -->
		<div class="search-bar">
			<input
				type="text"
				class="search-input"
				placeholder="Search callsign, ICAO, country..."
				bind:value={searchQuery}
				disabled={!adsbEnabled}
			/>
			{#if searchQuery}
				<button class="clear-btn" onclick={() => searchQuery = ''}>×</button>
			{/if}
		</div>

		<!-- Results info -->
		{#if searchQuery && aircraft.length > 0}
			<div class="results-info">
				Showing {count} of {aircraft.length} aircraft
			</div>
		{/if}

		<!-- Aircraft list -->
		{#if filteredAircraft().length === 0 && !loading && !error}
			<div class="aircraft-empty">
				{#if !adsbEnabled}
					Enable ADS-B tracking above
				{:else if aircraft.length === 0}
					Select regions to track aircraft
				{:else}
					No aircraft match "{searchQuery}"
				{/if}
			</div>
		{:else}
			<div class="aircraft-list">
				{#each filteredAircraft() as ac (ac.icao24)}
					{@const trackCount = getTrackHistory(ac.icao24).length}
					<button
						class="aircraft-item"
						class:selected={selectedIcao === ac.icao24}
						onclick={() => handleSelect(ac)}
					>
						<div class="aircraft-main">
							<div class="aircraft-id">
								<span class="callsign">{ac.callsign || ac.icao24.toUpperCase()}</span>
								{#if ac.squawk}
									<span class="squawk" class:squawk-emergency={ac.squawk === '7500' || ac.squawk === '7600' || ac.squawk === '7700'}>
										{ac.squawk}
									</span>
								{/if}
							</div>
							<div class="aircraft-altitude {getAltitudeColor(ac.geoAltitude ?? ac.baroAltitude, ac.onGround)}">
								{formatAltitude(ac.geoAltitude ?? ac.baroAltitude)}
							</div>
						</div>
						<div class="aircraft-details">
							<span class="detail-item">
								<span class="detail-label">SPD</span>
								<span class="detail-value">{formatSpeed(ac.velocity)}</span>
							</span>
							<span class="detail-item">
								<span class="detail-label">HDG</span>
								<span class="detail-value">{formatHeading(ac.trueTrack)}</span>
							</span>
							<span class="detail-item">
								<span class="detail-label">REG</span>
								<span class="detail-value country">{ac.originCountry.substring(0, 3).toUpperCase()}</span>
							</span>
							{#if trackCount > 1}
								<span class="track-badge" title="{trackCount} positions in history">
									{trackCount} pts
								</span>
							{/if}
						</div>
						<div class="aircraft-meta">
							<span class="icao">{ac.icao24.toUpperCase()}</span>
							<span class="last-seen">{timeAgo(ac.lastContact)}</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}

		<!-- History info -->
		{#if history.length > 0}
			<div class="history-footer">
				<span class="history-label">History:</span>
				<span class="history-value">{history.length} snapshots</span>
			</div>
		{/if}
	</div>
</Panel>

<style>
	.aircraft-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.aircraft-controls {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}

	.adsb-toggle {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		background: rgb(51 65 85 / 0.5);
		border: 1px solid rgb(51 65 85);
		border-radius: 2px;
		color: rgb(148 163 184);
		padding: 0.125rem 0.375rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.adsb-toggle:hover {
		background: rgb(51 65 85);
	}

	.adsb-toggle.active {
		background: rgb(34 211 238 / 0.2);
		border-color: rgb(34 211 238);
		color: rgb(34 211 238);
	}

	.region-section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgb(30 41 59);
	}

	.region-title {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		color: rgb(100 116 139);
		letter-spacing: 0.05em;
	}

	.region-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.region-btn {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		background: rgb(30 41 59 / 0.5);
		border: 1px solid rgb(51 65 85);
		border-radius: 2px;
		color: rgb(148 163 184);
		padding: 0.125rem 0.375rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.region-btn:hover:not(:disabled) {
		background: rgb(51 65 85);
		color: rgb(203 213 225);
	}

	.region-btn.active {
		background: rgb(34 211 238 / 0.15);
		border-color: rgb(34 211 238 / 0.5);
		color: rgb(34 211 238);
	}

	.region-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.sort-select {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		background: rgb(30 41 59);
		border: 1px solid rgb(51 65 85);
		border-radius: 2px;
		color: rgb(203 213 225);
		padding: 0.125rem 0.25rem;
		cursor: pointer;
	}

	.search-bar {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-input {
		width: 100%;
		font-size: var(--fs-xs);
		font-family: 'SF Mono', Monaco, monospace;
		background: rgb(15 23 42);
		border: 1px solid rgb(51 65 85);
		border-radius: 2px;
		color: rgb(226 232 240);
		padding: 0.375rem 0.5rem;
		padding-right: 1.5rem;
	}

	.search-input::placeholder {
		color: rgb(100 116 139);
	}

	.search-input:focus {
		outline: none;
		border-color: rgb(34 211 238);
	}

	.clear-btn {
		position: absolute;
		right: 0.375rem;
		background: none;
		border: none;
		color: rgb(100 116 139);
		cursor: pointer;
		font-size: var(--fs-sm);
		padding: 0 0.25rem;
	}

	.clear-btn:hover {
		color: rgb(203 213 225);
	}

	.results-info {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
		padding: 0.125rem 0;
	}

	.aircraft-empty {
		text-align: center;
		color: rgb(148 163 184);
		font-size: var(--fs-sm);
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.aircraft-list {
		display: flex;
		flex-direction: column;
		max-height: 300px;
		overflow-y: auto;
	}

	.aircraft-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		border: none;
		border-bottom: 1px solid rgb(30 41 59);
		background: transparent;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s;
		width: 100%;
	}

	.aircraft-item:last-child {
		border-bottom: none;
	}

	.aircraft-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.aircraft-item.selected {
		background: rgb(34 211 238 / 0.1);
		border-left: 2px solid rgb(34 211 238);
		margin-left: -2px;
	}

	.aircraft-main {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.aircraft-id {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.callsign {
		font-size: var(--fs-sm);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		color: white;
	}

	.squawk {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184);
		background: rgb(51 65 85 / 0.5);
		padding: 0.0625rem 0.25rem;
		border-radius: 2px;
	}

	.squawk-emergency {
		color: rgb(239 68 68);
		background: rgb(239 68 68 / 0.2);
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.aircraft-altitude {
		font-size: var(--fs-xs);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
	}

	.alt-ground {
		color: rgb(34 197 94);
		background: rgb(34 197 94 / 0.15);
	}

	.alt-low {
		color: rgb(59 130 246);
		background: rgb(59 130 246 / 0.15);
	}

	.alt-medium {
		color: rgb(34 211 238);
		background: rgb(34 211 238 / 0.15);
	}

	.alt-high {
		color: rgb(251 191 36);
		background: rgb(251 191 36 / 0.15);
	}

	.alt-cruise {
		color: rgb(249 115 22);
		background: rgb(249 115 22 / 0.15);
	}

	.aircraft-details {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.detail-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.detail-label {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
	}

	.detail-value {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(203 213 225);
	}

	.detail-value.country {
		color: rgb(251 191 36);
	}

	.track-badge {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(168 85 247);
		background: rgb(168 85 247 / 0.15);
		padding: 0.0625rem 0.25rem;
		border-radius: 2px;
		margin-left: auto;
	}

	.aircraft-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.icao {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(71 85 105);
	}

	.last-seen {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(71 85 105);
	}

	.history-footer {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0;
		border-top: 1px solid rgb(30 41 59);
		margin-top: 0.25rem;
	}

	.history-label {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
	}

	.history-value {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(168 85 247);
	}
</style>
