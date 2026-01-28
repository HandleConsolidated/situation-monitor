<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { 
		fetchAllInternationalAlerts, 
		getInternationalAlertColor, 
		getCountryFlag,
		getInternationalAlertStats 
	} from '$lib/api';
	import type { InternationalAlert } from '$lib/api';
	import { onMount } from 'svelte';

	interface Props {
		onAlertClick?: (alert: InternationalAlert) => void;
	}

	let { onAlertClick }: Props = $props();

	let alerts = $state<InternationalAlert[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastUpdated = $state<Date | null>(null);

	const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

	async function fetchData() {
		loading = true;
		error = null;

		try {
			const data = await fetchAllInternationalAlerts();
			alerts = data;
			lastUpdated = new Date();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch international weather alerts';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchData();
		const interval = setInterval(fetchData, REFRESH_INTERVAL);
		return () => clearInterval(interval);
	});

	// Group alerts by country
	const alertsByCountry = $derived(() => {
		const grouped = new Map<string, InternationalAlert[]>();
		
		for (const alert of alerts) {
			const country = alert.country;
			if (!grouped.has(country)) {
				grouped.set(country, []);
			}
			grouped.get(country)!.push(alert);
		}
		
		// Sort countries by severity (most severe first)
		return Array.from(grouped.entries())
			.sort((a, b) => {
				const maxSeverityA = Math.max(...a[1].map(getSeverityLevel));
				const maxSeverityB = Math.max(...b[1].map(getSeverityLevel));
				return maxSeverityB - maxSeverityA;
			});
	});

	const stats = $derived(getInternationalAlertStats(alerts));
	const displayCount = $derived(stats.extreme + stats.severe + stats.moderate);

	function getSeverityLevel(alert: InternationalAlert): number {
		const map = { 'Extreme': 4, 'Severe': 3, 'Moderate': 2, 'Minor': 1, 'Unknown': 0 };
		return map[alert.severity] || 0;
	}

	function formatSource(source: string): string {
		const names: Record<string, string> = {
			'NWS': 'US NWS',
			'ECCC': 'Canada',
			'MeteoAlarm': 'MeteoAlarm',
			'MetOffice': 'UK Met',
			'JMA': 'Japan',
			'BOM': 'Australia',
			'Other': 'Other'
		};
		return names[source] || source;
	}

	function handleAlertClick(alert: InternationalAlert) {
		if (onAlertClick) {
			onAlertClick(alert);
		}
	}

	function formatTime(dateStr: string): string {
		try {
			const date = new Date(dateStr);
			return date.toLocaleTimeString('en-US', { 
				hour: 'numeric', 
				minute: '2-digit',
				hour12: true 
			});
		} catch {
			return '--:--';
		}
	}
</script>

<Panel 
	id="international-weather" 
	title="International Weather" 
	count={displayCount > 0 ? displayCount : null}
	{loading} 
	{error}
>
	{#if alerts.length === 0 && !loading}
		<div class="no-alerts">
			<div class="icon">🌍</div>
			<div class="message">No international weather alerts</div>
		</div>
	{:else}
		<div class="international-weather-content">
			<!-- Summary Stats -->
			{#if stats.extreme > 0 || stats.severe > 0}
				<div class="alert-summary">
					{#if stats.extreme > 0}
						<div class="stat extreme">
							<span class="count">{stats.extreme}</span>
							<span class="label">Extreme</span>
						</div>
					{/if}
					{#if stats.severe > 0}
						<div class="stat severe">
							<span class="count">{stats.severe}</span>
							<span class="label">Severe</span>
						</div>
					{/if}
					{#if stats.moderate > 0}
						<div class="stat moderate">
							<span class="count">{stats.moderate}</span>
							<span class="label">Moderate</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Alerts by Country -->
			<div class="country-alerts-list">
				{#each alertsByCountry() as [country, countryAlerts]}
					{@const flag = getCountryFlag(countryAlerts[0].countryCode)}
					{@const maxSeverity = Math.max(...countryAlerts.map(getSeverityLevel))}
					{@const severityClass = countryAlerts[0].severity.toLowerCase()}
					
					<div class="country-section" class:high-severity={maxSeverity >= 3}>
						<div class="country-header">
							<span class="flag">{flag}</span>
							<span class="country-name">{country}</span>
							<span class="alert-count">{countryAlerts.length}</span>
						</div>

						<div class="alerts-grid">
							{#each countryAlerts.slice(0, 3) as alert}
								<button
									class="alert-item {severityClass}"
									onclick={() => handleAlertClick(alert)}
									style="border-left-color: {getInternationalAlertColor(alert.severity)}"
								>
									<div class="alert-header">
										<span class="alert-event">{alert.event}</span>
										<span class="alert-source">{formatSource(alert.source)}</span>
									</div>
									<div class="alert-info">
										<span class="alert-time">{formatTime(alert.effective)}</span>
										{#if alert.expires}
											<span class="alert-expires">→ {formatTime(alert.expires)}</span>
										{/if}
									</div>
								</button>
							{/each}
						</div>

						{#if countryAlerts.length > 3}
							<div class="more-alerts">
								+{countryAlerts.length - 3} more alerts
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if lastUpdated}
				<div class="footer-info">
					Updated {lastUpdated.toLocaleTimeString()}
				</div>
			{/if}
		</div>
	{/if}
</Panel>

<style>
	.no-alerts {
		padding: 3rem 1rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.no-alerts .icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.no-alerts .message {
		font-size: 0.875rem;
	}

	.international-weather-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.alert-summary {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		flex: 1;
	}

	.stat.extreme {
		background: rgba(220, 38, 38, 0.15);
		border: 1px solid rgba(220, 38, 38, 0.3);
	}

	.stat.severe {
		background: rgba(249, 115, 22, 0.15);
		border: 1px solid rgba(249, 115, 22, 0.3);
	}

	.stat.moderate {
		background: rgba(234, 179, 8, 0.15);
		border: 1px solid rgba(234, 179, 8, 0.3);
	}

	.stat .count {
		font-size: 1.5rem;
		font-weight: bold;
		font-family: var(--font-mono);
	}

	.stat .label {
		font-size: 0.75rem;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.country-alerts-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.country-section {
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		overflow: hidden;
	}

	.country-section.high-severity {
		border-color: rgba(249, 115, 22, 0.3);
	}

	.country-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.flag {
		font-size: 1.25rem;
	}

	.country-name {
		flex: 1;
		font-weight: 600;
		font-size: 0.875rem;
	}

	.alert-count {
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 12px;
		font-family: var(--font-mono);
	}

	.alerts-grid {
		display: flex;
		flex-direction: column;
	}

	.alert-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
		border: none;
		border-left: 3px solid;
		background: rgba(0, 0, 0, 0.2);
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		cursor: pointer;
		transition: background 0.15s ease;
		text-align: left;
		color: inherit;
		font-family: inherit;
	}

	.alert-item:last-child {
		border-bottom: none;
	}

	.alert-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.alert-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: space-between;
	}

	.alert-event {
		font-size: 0.875rem;
		font-weight: 500;
		flex: 1;
	}

	.alert-source {
		font-size: 0.75rem;
		opacity: 0.6;
		text-transform: uppercase;
	}

	.alert-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		opacity: 0.7;
		font-family: var(--font-mono);
	}

	.more-alerts {
		padding: 0.5rem 0.75rem;
		text-align: center;
		font-size: 0.75rem;
		opacity: 0.6;
		background: rgba(0, 0, 0, 0.2);
	}

	.footer-info {
		padding-top: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		opacity: 0.5;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
