<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { fetchSpaceWeather, fetchSpaceWeatherAlerts, getSpaceWeatherColor } from '$lib/api';
	import type { SolarActivity, SpaceWeatherAlert } from '$lib/api';
	import { onMount } from 'svelte';

	let solarActivity = $state<SolarActivity | null>(null);
	let alerts = $state<SpaceWeatherAlert[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastUpdated = $state<Date | null>(null);

	const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

	async function fetchData() {
		loading = true;
		error = null;

		try {
			const [activityData, alertsData] = await Promise.all([
				fetchSpaceWeather(),
				fetchSpaceWeatherAlerts()
			]);

			solarActivity = activityData;
			alerts = alertsData;
			lastUpdated = new Date();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch space weather';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchData();
		const interval = setInterval(fetchData, REFRESH_INTERVAL);
		return () => clearInterval(interval);
	});

	function getKpColor(kp: number): string {
		return getSpaceWeatherColor(kp);
	}

	function getKpLevel(kp: number): string {
		if (kp >= 8) return 'EXTREME';
		if (kp >= 7) return 'SEVERE';
		if (kp >= 6) return 'STRONG';
		if (kp >= 5) return 'MODERATE';
		if (kp >= 4) return 'ACTIVE';
		return 'QUIET';
	}

	function formatSeverity(severity: string): string {
		return severity.charAt(0).toUpperCase() + severity.slice(1);
	}
</script>

<Panel id="space-weather" title="Space Weather" count={alerts.length > 0 ? alerts.length : null} {loading} {error}>
	{#if solarActivity}
		<div class="space-weather-content">
			<!-- Main Kp Index Display -->
			<div class="kp-display" style="--kp-color: {getKpColor(solarActivity.kpIndex)}">
				<div class="kp-value">{solarActivity.kpIndex}</div>
				<div class="kp-details">
					<div class="kp-label">Kp Index</div>
					<div class="kp-status">{getKpLevel(solarActivity.kpIndex)}</div>
					<div class="kp-desc">{solarActivity.kpDescription}</div>
				</div>
			</div>

			<!-- Conditions Grid -->
			<div class="conditions-grid">
				{#if solarActivity.xrayFlux}
					<div class="condition-item">
						<span class="condition-label">X-Ray Flux</span>
						<span class="condition-value xray" class:active={solarActivity.radioBlackout}>
							{solarActivity.xrayFlux}
						</span>
					</div>
				{/if}

				{#if solarActivity.solarWindSpeed}
					<div class="condition-item">
						<span class="condition-label">Solar Wind</span>
						<span class="condition-value">
							{Math.round(solarActivity.solarWindSpeed)} km/s
						</span>
					</div>
				{/if}

				{#if solarActivity.solarWindDensity}
					<div class="condition-item">
						<span class="condition-label">Particle Density</span>
						<span class="condition-value">
							{solarActivity.solarWindDensity.toFixed(1)} p/cm³
						</span>
					</div>
				{/if}
			</div>

			<!-- Active Conditions Indicators -->
			<div class="active-conditions">
				{#if solarActivity.geomagneticStorm}
					<div class="condition-badge geomagnetic">
						🌍 Geomagnetic Storm Active
					</div>
				{/if}
				{#if solarActivity.radioBlackout}
					<div class="condition-badge radio">
						📡 Radio Blackout Possible
					</div>
				{/if}
				{#if solarActivity.solarRadiationStorm}
					<div class="condition-badge radiation">
						☢️ Solar Radiation Storm
					</div>
				{/if}
			</div>

			<!-- Alerts Section -->
			{#if alerts.length > 0}
				<div class="alerts-section">
					<div class="alerts-header">Active Alerts</div>
					<div class="alerts-list">
						{#each alerts.slice(0, 3) as alert (alert.id)}
							<div class="alert-item severity-{alert.severity}">
								<span class="alert-type">
									{#if alert.type === 'geomagnetic_storm'}🌍
									{:else if alert.type === 'radio_blackout'}📡
									{:else}☀️{/if}
								</span>
								<span class="alert-severity">{formatSeverity(alert.severity)}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Last Updated -->
			{#if lastUpdated}
				<div class="last-updated">
					Updated {lastUpdated.toLocaleTimeString()}
				</div>
			{/if}
		</div>
	{:else if !loading}
		<div class="empty-state">
			<div class="empty-icon">☀️</div>
			<div class="empty-text">Space weather data unavailable</div>
		</div>
	{/if}
</Panel>

<style>
	.space-weather-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Kp Index Display */
	.kp-display {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem;
		background: rgb(15 23 42 / 0.6);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-left: 3px solid var(--kp-color);
		border-radius: 2px;
	}

	.kp-value {
		font-size: 2rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--kp-color);
		line-height: 1;
		min-width: 3rem;
		text-align: center;
	}

	.kp-details {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.kp-label {
		font-size: var(--fs-2xs);
		color: rgb(100 116 139);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.kp-status {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--kp-color);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.kp-desc {
		font-size: var(--fs-xs);
		color: rgb(148 163 184);
	}

	/* Conditions Grid */
	.conditions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 0.5rem;
	}

	.condition-item {
		display: flex;
		flex-direction: column;
		padding: 0.375rem 0.5rem;
		background: rgb(30 41 59 / 0.5);
		border: 1px solid rgb(51 65 85 / 0.3);
		border-radius: 2px;
	}

	.condition-label {
		font-size: var(--fs-2xs);
		color: rgb(100 116 139);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.condition-value {
		font-size: var(--fs-sm);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(226 232 240);
	}

	.condition-value.xray {
		color: rgb(34 211 238);
	}

	.condition-value.xray.active {
		color: rgb(248 113 113);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	/* Active Conditions */
	.active-conditions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.condition-badge {
		padding: 0.25rem 0.5rem;
		font-size: var(--fs-2xs);
		font-weight: 600;
		border-radius: 2px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.condition-badge.geomagnetic {
		background: rgb(239 68 68 / 0.2);
		border: 1px solid rgb(239 68 68 / 0.5);
		color: rgb(248 113 113);
	}

	.condition-badge.radio {
		background: rgb(245 158 11 / 0.2);
		border: 1px solid rgb(245 158 11 / 0.5);
		color: rgb(251 191 36);
	}

	.condition-badge.radiation {
		background: rgb(217 70 239 / 0.2);
		border: 1px solid rgb(217 70 239 / 0.5);
		color: rgb(232 121 249);
	}

	/* Alerts Section */
	.alerts-section {
		border-top: 1px solid rgb(51 65 85 / 0.5);
		padding-top: 0.5rem;
	}

	.alerts-header {
		font-size: var(--fs-2xs);
		color: rgb(100 116 139);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.375rem;
	}

	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.alert-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.375rem;
		background: rgb(30 41 59 / 0.3);
		border-radius: 2px;
		font-size: var(--fs-xs);
	}

	.alert-item.severity-extreme {
		border-left: 2px solid rgb(217 70 239);
	}

	.alert-item.severity-severe {
		border-left: 2px solid rgb(239 68 68);
	}

	.alert-item.severity-strong {
		border-left: 2px solid rgb(249 115 22);
	}

	.alert-item.severity-moderate {
		border-left: 2px solid rgb(245 158 11);
	}

	.alert-item.severity-minor {
		border-left: 2px solid rgb(234 179 8);
	}

	.alert-type {
		font-size: var(--fs-sm);
	}

	.alert-severity {
		color: rgb(148 163 184);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		font-weight: 600;
	}

	/* Last Updated */
	.last-updated {
		font-size: var(--fs-2xs);
		color: rgb(71 85 105);
		text-align: right;
		padding-top: 0.25rem;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1.5rem;
		text-align: center;
		gap: 0.5rem;
	}

	.empty-icon {
		font-size: 2rem;
		opacity: 0.5;
	}

	.empty-text {
		font-size: var(--fs-xs);
		color: rgb(100 116 139);
	}
</style>
