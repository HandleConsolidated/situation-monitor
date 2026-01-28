<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { weather, activeAlerts, alertCount, severeAlertCount, weatherLoading } from '$lib/stores/weather';
	import { ALERT_SEVERITY_COLORS, WINTER_WEATHER_EVENTS } from '$lib/config/weather';
	import { AIR_QUALITY_COLORS, AIR_QUALITY_DESCRIPTIONS } from '$lib/api';
	import { analyzeAlertTrends, getTrendDisplay, getTimeSinceFirstSeen, getRecentEscalations, type AlertWithTrend } from '$lib/utils';
	import type { WeatherAlert, AlertSeverity, AirQualityReading, AirQualityLevel } from '$lib/types';

	interface Props {
		onAlertClick?: (alert: WeatherAlert) => void;
		onOpenCommandCenter?: () => void;
		airQualityData?: AirQualityReading[];
	}

	let { onAlertClick, onOpenCommandCenter, airQualityData = [] }: Props = $props();

	// Air quality summary derived from data
	const airQualitySummary = $derived(() => {
		if (airQualityData.length === 0) return null;
		
		// Find worst air quality in the set
		const levelOrder: Record<AirQualityLevel, number> = {
			'good': 0,
			'moderate': 1,
			'unhealthy_sensitive': 2,
			'unhealthy': 3,
			'very_unhealthy': 4,
			'hazardous': 5
		};
		
		let worstReading: AirQualityReading | null = null;
		let worstLevel = -1;
		
		for (const reading of airQualityData) {
			const level = levelOrder[reading.level] ?? 0;
			if (level > worstLevel) {
				worstLevel = level;
				worstReading = reading;
			}
		}
		
		if (!worstReading) return null;
		
		return {
			level: worstReading.level,
			location: worstReading.city || worstReading.location,
			aqi: worstReading.aqi,
			count: airQualityData.length,
			hasUnhealthy: worstLevel >= 3
		};
	});

	// Derive data from store
	const rawAlerts = $derived($activeAlerts);
	const count = $derived($alertCount);
	const severeCount = $derived($severeAlertCount);
	const loading = $derived($weatherLoading);
	const forecasts = $derived($weather.forecasts);
	const zones = $derived($weather.zones);
	const error = $derived($weather.alertsError);
	
	// Apply trend analysis to alerts
	const alerts = $derived(analyzeAlertTrends(rawAlerts));
	
	// Check for recent escalations (last 30 minutes)
	const recentEscalations = $derived(getRecentEscalations(alerts, 30));
	const hasEscalations = $derived(recentEscalations.length > 0);

	// Display limits
	const MAX_ALERTS_DISPLAY = 8;
	const MAX_FORECASTS_DISPLAY = 3;

	// Whether to show empty state
	const hasZones = $derived(zones.length > 0);
	const hasData = $derived(alerts.length > 0 || forecasts.length > 0);

	// Alerts to display (up to 8)
	const displayAlerts = $derived(alerts.slice(0, MAX_ALERTS_DISPLAY));
	const hasMoreAlerts = $derived(alerts.length > MAX_ALERTS_DISPLAY);

	// Forecasts to display (up to 3)
	const displayForecasts = $derived(forecasts.slice(0, MAX_FORECASTS_DISPLAY));

	// Check if there are Extreme or Severe alerts
	const hasSevereAlerts = $derived(severeCount > 0);

	/**
	 * Get color classes for a severity level
	 */
	function getSeverityColors(severity: AlertSeverity): { bg: string; border: string; text: string; hex: string } {
		return ALERT_SEVERITY_COLORS[severity] ?? ALERT_SEVERITY_COLORS.Unknown;
	}

	/**
	 * Check if an event type is winter weather
	 */
	function isWinterWeather(event: string): boolean {
		return (WINTER_WEATHER_EVENTS as readonly string[]).includes(event);
	}

	/**
	 * Format time remaining until expiry
	 * Returns "2d 3h", "5h 30m", "45m", or "Expired"
	 */
	function formatTimeRemaining(expires: string): string {
		const expiresDate = new Date(expires);
		const now = Date.now();
		const diffMs = expiresDate.getTime() - now;

		if (diffMs <= 0) {
			return 'Expired';
		}

		const minutes = Math.floor(diffMs / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			const remainingHours = hours % 24;
			return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
		}

		if (hours > 0) {
			const remainingMinutes = minutes % 60;
			return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
		}

		return `${minutes}m`;
	}

	/**
	 * Get emoji icon for an event type
	 */
	function getEventIcon(event: string): string {
		const eventLower = event.toLowerCase();

		// Tornado
		if (eventLower.includes('tornado')) return '🌪️';

		// Hurricane/Tropical
		if (eventLower.includes('hurricane') || eventLower.includes('tropical')) return '🌀';

		// Thunderstorm
		if (eventLower.includes('thunderstorm')) return '⛈️';

		// Flood
		if (eventLower.includes('flood')) return '🌊';

		// Winter weather
		if (eventLower.includes('blizzard')) return '🌨️';
		if (eventLower.includes('winter') || eventLower.includes('snow')) return '❄️';
		if (eventLower.includes('ice') || eventLower.includes('freez')) return '🧊';
		if (eventLower.includes('wind chill') || eventLower.includes('frost')) return '🥶';

		// Heat
		if (eventLower.includes('heat') || eventLower.includes('excessive')) return '🔥';

		// Fire
		if (eventLower.includes('fire') || eventLower.includes('red flag')) return '🔥';

		// Wind
		if (eventLower.includes('wind') && !eventLower.includes('chill')) return '💨';

		// Dust
		if (eventLower.includes('dust')) return '🏜️';

		// Default weather
		return '⚠️';
	}

	/**
	 * Handle alert click
	 */
	function handleAlertClick(alert: AlertWithTrend) {
		if (onAlertClick) {
			// Pass as WeatherAlert (base type) to callback
			onAlertClick(alert as WeatherAlert);
		}
		weather.selectAlert(alert.id);
	}

	/**
	 * Open the command center modal
	 */
	function handleOpenCommandCenter() {
		if (onOpenCommandCenter) {
			onOpenCommandCenter();
		}
		weather.openCommandModal();
	}
</script>

<Panel id="weather" title="Weather Alerts" count={count > 0 ? count : null} {loading} {error}>
	{#snippet actions()}
		<button
			class="command-btn"
			onclick={handleOpenCommandCenter}
			title="Weather Command Center"
			aria-label="Open Weather Command Center"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</button>
	{/snippet}

	{#if !hasZones && !loading}
		<!-- Empty state: no zones configured -->
		<div class="empty-state">
			<div class="empty-icon">🛰️</div>
			<div class="empty-title">No Watch Zones</div>
			<div class="empty-desc">Configure zones to monitor weather alerts</div>
			<button class="configure-btn" onclick={handleOpenCommandCenter}>
				Configure Watch Zones
			</button>
		</div>
	{:else if !hasData && !loading && hasZones}
		<!-- No alerts/forecasts but zones exist -->
		<div class="empty-state">
			<div class="empty-icon">✓</div>
			<div class="empty-title">All Clear</div>
			<div class="empty-desc">No active weather alerts in your zones</div>
		</div>
	{:else}
		<div class="weather-content">
			<!-- Escalation Banner (takes priority) -->
			{#if hasEscalations}
				<div class="escalation-banner">
					<span class="escalation-icon">⬆️</span>
					<span class="escalation-text">{recentEscalations.length} Alert{recentEscalations.length > 1 ? 's' : ''} Escalated</span>
				</div>
			{:else if hasSevereAlerts}
				<!-- Severe Alert Banner -->
				<div class="severe-banner">
					<span class="severe-icon">⚠️</span>
					<span class="severe-text">{severeCount} Extreme/Severe Alert{severeCount > 1 ? 's' : ''}</span>
				</div>
			{/if}

			<!-- Alerts List -->
			{#if displayAlerts.length > 0}
				<div class="alerts-list">
					{#each displayAlerts as alert (alert.id)}
						{@const colors = getSeverityColors(alert.severity)}
						{@const trendInfo = getTrendDisplay(alert.trend)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="alert-item"
							class:escalated={alert.trend === 'escalated'}
							class:new-alert={alert.trend === 'new'}
							onclick={() => handleAlertClick(alert)}
							style="--alert-bg: {colors.hex}20; --alert-border: {colors.hex}80; --alert-text: {colors.hex};"
						>
							<div class="alert-icon">{getEventIcon(alert.event)}</div>
							<div class="alert-content">
								<div class="alert-header">
									<span class="alert-event {colors.text}">{alert.event}</span>
									<div class="alert-meta">
										{#if trendInfo.label}
											<span class="trend-badge {trendInfo.color} {trendInfo.bgColor}">
												{trendInfo.icon} {trendInfo.label}
											</span>
										{/if}
										<span class="alert-expiry">
											{formatTimeRemaining(alert.expires)}
										</span>
									</div>
								</div>
								<div class="alert-area">{alert.areaDesc}</div>
								{#if alert.trend === 'escalated' && alert.previousSeverity}
									<div class="escalation-detail">
										Upgraded from {alert.previousSeverity}
									</div>
								{/if}
								{#if alert.headline}
									<div class="alert-headline">{alert.headline}</div>
								{/if}
								{#if alert.firstSeen}
									<div class="alert-tracking">
										Tracking for {getTimeSinceFirstSeen(alert.firstSeen)}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				{#if hasMoreAlerts}
					<button class="view-more-btn" onclick={handleOpenCommandCenter}>
						View {alerts.length - MAX_ALERTS_DISPLAY} more alerts
					</button>
				{/if}
			{/if}

			<!-- Forecast Highlights -->
			{#if displayForecasts.length > 0}
				<div class="forecasts-section">
					<div class="section-title">Forecast Highlights</div>
					<div class="forecasts-list">
						{#each displayForecasts as forecast (forecast.zoneId)}
							<div class="forecast-item">
								<div class="forecast-header">
									<span class="forecast-location">{forecast.location}</span>
									<span class="forecast-timing">{forecast.timing}</span>
								</div>
								<div class="forecast-summary">{forecast.summary}</div>
								{#if forecast.precipitation.accumulation}
									<div class="forecast-accumulation">
										{isWinterWeather(forecast.precipitation.type ?? '') ? '❄️' : '💧'}
										{forecast.precipitation.accumulation}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Air Quality Summary -->
			{#if airQualitySummary()}
				{@const aq = airQualitySummary()}
				{#if aq}
					<div class="air-quality-section" class:unhealthy={aq.hasUnhealthy}>
						<div class="section-title">Air Quality</div>
						<div class="air-quality-summary">
							<span class="aq-icon">
								{#if aq.level === 'good'}🟢
								{:else if aq.level === 'moderate'}🟡
								{:else if aq.level === 'unhealthy_sensitive'}🟠
								{:else if aq.level === 'unhealthy'}🔴
								{:else if aq.level === 'very_unhealthy'}🟣
								{:else}⚫{/if}
							</span>
							<span class="aq-level">{AIR_QUALITY_DESCRIPTIONS[aq.level]}</span>
							{#if aq.aqi}
								<span class="aq-value">AQI {aq.aqi}</span>
							{/if}
						</div>
						<div class="aq-location">
							Worst: {aq.location} ({aq.count} stations monitored)
						</div>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</Panel>

<style>
	/* Command Center Button */
	.command-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		background: rgb(15 23 42 / 0.8);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.command-btn:hover {
		color: rgb(34 211 238);
		border-color: rgb(34 211 238 / 0.5);
		background: rgb(34 211 238 / 0.1);
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 1rem;
		text-align: center;
		gap: 0.5rem;
	}

	.empty-icon {
		font-size: 2rem;
		opacity: 0.6;
	}

	.empty-title {
		font-size: var(--fs-sm);
		font-weight: 600;
		color: rgb(226 232 240);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.empty-desc {
		font-size: var(--fs-xs);
		color: rgb(148 163 184);
	}

	.configure-btn {
		margin-top: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: rgb(34 211 238 / 0.1);
		border: 1px solid rgb(34 211 238 / 0.3);
		border-radius: 2px;
		color: rgb(34 211 238);
		font-size: var(--fs-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.configure-btn:hover {
		background: rgb(34 211 238 / 0.2);
		border-color: rgb(34 211 238 / 0.5);
	}

	/* Weather Content */
	.weather-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Severe Alert Banner */
	.severe-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: rgb(127 29 29 / 0.5);
		border: 1px solid rgb(239 68 68 / 0.5);
		border-radius: 2px;
		animation: pulse-subtle 2s ease-in-out infinite;
	}

	@keyframes pulse-subtle {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.8; }
	}

	.severe-icon {
		font-size: var(--fs-sm);
	}

	.severe-text {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: rgb(248 113 113);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Alerts List */
	.alerts-list {
		display: flex;
		flex-direction: column;
	}

	.alert-item {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem 0.25rem;
		border-bottom: 1px solid rgb(30 41 59);
		cursor: pointer;
		transition: background-color 0.15s ease;
		background: var(--alert-bg, transparent);
		border-left: 2px solid var(--alert-border, transparent);
		padding-left: calc(0.25rem + 2px);
		margin-left: -2px;
	}

	.alert-item:last-child {
		border-bottom: none;
	}

	.alert-item:hover {
		background: rgb(6 182 212 / 0.1);
	}

	.alert-icon {
		font-size: var(--fs-base);
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.alert-content {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
		flex: 1;
	}

	.alert-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.alert-event {
		font-size: var(--fs-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		line-height: var(--lh-tight);
	}

	/* Severity text colors via Tailwind classes */
	.alert-event.text-fuchsia-400 { color: rgb(232 121 249); }
	.alert-event.text-red-400 { color: rgb(248 113 113); }
	.alert-event.text-amber-400 { color: rgb(251 191 36); }
	.alert-event.text-yellow-400 { color: rgb(250 204 21); }
	.alert-event.text-slate-400 { color: rgb(148 163 184); }

	.alert-expiry {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.alert-area {
		font-size: var(--fs-2xs);
		color: rgb(148 163 184);
		line-height: var(--lh-snug);
		display: -webkit-box;
		-webkit-line-clamp: 1;
		line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.alert-headline {
		font-size: var(--fs-xs);
		color: rgb(203 213 225);
		line-height: var(--lh-snug);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Alert Meta (trend + expiry) */
	.alert-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	/* Trend Badge */
	.trend-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		padding: 0.0625rem 0.25rem;
		font-size: var(--fs-2xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-radius: 2px;
	}

	.trend-badge.text-red-400 { color: rgb(248 113 113); }
	.trend-badge.text-green-400 { color: rgb(74 222 128); }
	.trend-badge.text-yellow-400 { color: rgb(250 204 21); }
	.trend-badge.text-slate-400 { color: rgb(148 163 184); }
	
	.trend-badge.bg-red-500\/20 { background: rgb(239 68 68 / 0.2); }
	.trend-badge.bg-green-500\/20 { background: rgb(34 197 94 / 0.2); }
	.trend-badge.bg-yellow-500\/20 { background: rgb(234 179 8 / 0.2); }

	/* Escalation Detail */
	.escalation-detail {
		font-size: var(--fs-2xs);
		color: rgb(248 113 113);
		font-style: italic;
	}

	/* Alert Tracking */
	.alert-tracking {
		font-size: var(--fs-2xs);
		color: rgb(100 116 139);
		font-family: 'SF Mono', Monaco, monospace;
	}

	/* Escalated Alert Styling */
	.alert-item.escalated {
		background: rgb(127 29 29 / 0.15) !important;
		border-left-color: rgb(239 68 68) !important;
		animation: escalation-pulse 2s ease-in-out 3;
	}

	.alert-item.new-alert {
		border-left-color: rgb(234 179 8) !important;
	}

	@keyframes escalation-pulse {
		0%, 100% { background: rgb(127 29 29 / 0.15); }
		50% { background: rgb(127 29 29 / 0.3); }
	}

	/* Escalation Banner */
	.escalation-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: rgb(127 29 29 / 0.6);
		border: 1px solid rgb(239 68 68 / 0.7);
		border-radius: 2px;
		animation: escalation-banner-pulse 1.5s ease-in-out infinite;
	}

	@keyframes escalation-banner-pulse {
		0%, 100% { 
			opacity: 1;
			box-shadow: 0 0 0 0 rgb(239 68 68 / 0.4);
		}
		50% { 
			opacity: 0.9;
			box-shadow: 0 0 8px 2px rgb(239 68 68 / 0.3);
		}
	}

	.escalation-icon {
		font-size: var(--fs-sm);
	}

	.escalation-text {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: rgb(248 113 113);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* View More Button */
	.view-more-btn {
		width: 100%;
		padding: 0.5rem;
		background: rgb(30 41 59 / 0.5);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		font-size: var(--fs-xs);
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.view-more-btn:hover {
		background: rgb(34 211 238 / 0.1);
		border-color: rgb(34 211 238 / 0.3);
		color: rgb(34 211 238);
	}

	/* Forecasts Section */
	.forecasts-section {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgb(51 65 85 / 0.5);
	}

	.section-title {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: rgb(148 163 184);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.5rem;
	}

	.forecasts-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.forecast-item {
		padding: 0.375rem 0.5rem;
		background: rgb(30 41 59 / 0.3);
		border: 1px solid rgb(51 65 85 / 0.3);
		border-radius: 2px;
	}

	.forecast-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.forecast-location {
		font-size: var(--fs-xs);
		font-weight: 600;
		color: rgb(226 232 240);
	}

	.forecast-timing {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
	}

	.forecast-summary {
		font-size: var(--fs-xs);
		color: rgb(148 163 184);
		line-height: var(--lh-snug);
	}

	.forecast-accumulation {
		margin-top: 0.25rem;
		font-size: var(--fs-xs);
		font-weight: 600;
		color: rgb(34 211 238);
	}

	/* Air Quality Section */
	.air-quality-section {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgb(51 65 85 / 0.5);
	}

	.air-quality-section.unhealthy {
		border-color: rgb(239 68 68 / 0.3);
	}

	.air-quality-summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		background: rgb(30 41 59 / 0.3);
		border: 1px solid rgb(51 65 85 / 0.3);
		border-radius: 2px;
	}

	.air-quality-section.unhealthy .air-quality-summary {
		background: rgb(127 29 29 / 0.2);
		border-color: rgb(239 68 68 / 0.3);
	}

	.aq-icon {
		font-size: var(--fs-sm);
	}

	.aq-level {
		font-size: var(--fs-xs);
		font-weight: 600;
		color: rgb(226 232 240);
		flex: 1;
	}

	.air-quality-section.unhealthy .aq-level {
		color: rgb(248 113 113);
	}

	.aq-value {
		font-size: var(--fs-2xs);
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184);
		background: rgb(15 23 42 / 0.5);
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
	}

	.aq-location {
		margin-top: 0.25rem;
		font-size: var(--fs-2xs);
		color: rgb(100 116 139);
	}
</style>
