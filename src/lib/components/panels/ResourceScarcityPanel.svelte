<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { onMount } from 'svelte';

	interface ResourceAlert {
		id: string;
		resource: 'water' | 'food' | 'energy' | 'critical-minerals' | 'medical';
		region: string;
		country: string;
		severity: 'critical' | 'high' | 'medium' | 'low';
		scarcityLevel: number; // 0-100 percentage
		description: string;
		affectedPopulation?: number;
		estimatedDuration?: string;
		causes: string[];
		timestamp: string;
	}

	let alerts = $state<ResourceAlert[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastUpdated = $state<Date | null>(null);

	const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

	async function fetchAlerts() {
		loading = true;
		error = null;

		try {
			// TODO: Integrate with resource monitoring APIs
			// Sources: FAO (food), WHO (medical), IEA (energy), water stress indices
			alerts = generateMockAlerts();
			lastUpdated = new Date();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch resource data';
		} finally {
			loading = false;
		}
	}

	function generateMockAlerts(): ResourceAlert[] {
		return [
			{
				id: 'res-001',
				resource: 'water',
				region: 'Cape Town',
				country: 'South Africa',
				severity: 'high',
				scarcityLevel: 75,
				description: 'Severe drought conditions, reservoir levels at 25%',
				affectedPopulation: 4000000,
				estimatedDuration: '6 months',
				causes: ['Drought', 'Climate Change', 'Population Growth'],
				timestamp: new Date().toISOString()
			},
			{
				id: 'res-002',
				resource: 'food',
				region: 'Horn of Africa',
				country: 'Somalia',
				severity: 'critical',
				scarcityLevel: 90,
				description: 'Famine conditions affecting millions, crop failures',
				affectedPopulation: 7000000,
				estimatedDuration: '12+ months',
				causes: ['Drought', 'Conflict', 'Locust Swarms'],
				timestamp: new Date().toISOString()
			},
			{
				id: 'res-003',
				resource: 'energy',
				region: 'Ukraine',
				country: 'Ukraine',
				severity: 'high',
				scarcityLevel: 65,
				description: 'Power grid damage, rolling blackouts',
				affectedPopulation: 10000000,
				estimatedDuration: '3-6 months',
				causes: ['Infrastructure Damage', 'Conflict'],
				timestamp: new Date().toISOString()
			}
		];
	}

	onMount(() => {
		fetchAlerts();
		const interval = setInterval(fetchAlerts, REFRESH_INTERVAL);
		return () => clearInterval(interval);
	});

	const criticalAlerts = $derived(alerts.filter(a => a.severity === 'critical'));
	const totalAffected = $derived(alerts.reduce((sum, a) => sum + (a.affectedPopulation ?? 0), 0));

	function getResourceIcon(resource: string): string {
		switch (resource) {
			case 'water': return '💧';
			case 'food': return '🌾';
			case 'energy': return '⚡';
			case 'critical-minerals': return '⛏️';
			case 'medical': return '💊';
			default: return '📦';
		}
	}

	function getSeverityColor(severity: string): string {
		switch (severity) {
			case 'critical': return '#dc2626';
			case 'high': return '#f97316';
			case 'medium': return '#eab308';
			case 'low': return '#10b981';
			default: return '#6b7280';
		}
	}

	function formatPopulation(pop: number): string {
		if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`;
		if (pop >= 1000) return `${(pop / 1000).toFixed(0)}K`;
		return pop.toString();
	}

	function formatResource(resource: string): string {
		return resource.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
	}
</script>

<Panel 
	id="resource-scarcity" 
	title="Resource Scarcity" 
	count={criticalAlerts.length > 0 ? criticalAlerts.length : null}
	{loading} 
	{error}
>
	{#if alerts.length === 0 && !loading}
		<div class="no-alerts">
			<div class="icon">✅</div>
			<div class="message">No critical resource shortages detected</div>
		</div>
	{:else}
		<div class="scarcity-content">
			<!-- Impact Summary -->
			{#if totalAffected > 0}
				<div class="impact-summary">
					<div class="summary-stat">
						<div class="stat-value">{formatPopulation(totalAffected)}</div>
						<div class="stat-label">People Affected</div>
					</div>
					<div class="summary-stat">
						<div class="stat-value">{alerts.length}</div>
						<div class="stat-label">Active Alerts</div>
					</div>
				</div>
			{/if}

			<!-- Alerts List -->
			<div class="alerts-list">
				{#each alerts.slice(0, 10) as alert}
					<button
						class="alert-item {alert.severity}"
						style="border-left-color: {getSeverityColor(alert.severity)}"
					>
						<div class="alert-header">
							<span class="resource-icon">{getResourceIcon(alert.resource)}</span>
							<div class="alert-info">
								<div class="alert-region">{alert.region}</div>
								<div class="alert-resource">{formatResource(alert.resource)}</div>
							</div>
							<div class="scarcity-level" class:critical={alert.scarcityLevel >= 80}>
								{alert.scarcityLevel}%
							</div>
						</div>
						
						<div class="alert-description">{alert.description}</div>
						
						<div class="scarcity-bar-container">
							<div 
								class="scarcity-bar"
								style="width: {alert.scarcityLevel}%; 
									   background: {getSeverityColor(alert.severity)}"
							></div>
						</div>

						<div class="alert-details">
							{#if alert.affectedPopulation}
								<div class="detail-item">
									<span class="detail-label">👥</span>
									<span class="detail-value">{formatPopulation(alert.affectedPopulation)} affected</span>
								</div>
							{/if}
							{#if alert.estimatedDuration}
								<div class="detail-item">
									<span class="detail-label">⏱️</span>
									<span class="detail-value">{alert.estimatedDuration}</span>
								</div>
							{/if}
						</div>

						{#if alert.causes.length > 0}
							<div class="causes">
								<span class="causes-label">Causes:</span>
								{#each alert.causes as cause}
									<span class="cause-tag">{cause}</span>
								{/each}
							</div>
						{/if}
					</button>
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

	.scarcity-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.impact-summary {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: rgba(220, 38, 38, 0.1);
		border: 1px solid rgba(220, 38, 38, 0.2);
		border-radius: 4px;
	}

	.summary-stat {
		flex: 1;
		text-align: center;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: bold;
		font-family: var(--font-mono);
		color: #fca5a5;
	}

	.stat-label {
		font-size: 0.75rem;
		opacity: 0.8;
		margin-top: 0.25rem;
	}

	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.alert-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-left: 3px solid;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.2);
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
		color: inherit;
		font-family: inherit;
	}

	.alert-item:hover {
		background: rgba(255, 255, 255, 0.05);
		transform: translateX(2px);
	}

	.alert-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.resource-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.alert-info {
		flex: 1;
		min-width: 0;
	}

	.alert-region {
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 0.125rem;
	}

	.alert-resource {
		font-size: 0.75rem;
		opacity: 0.7;
		text-transform: uppercase;
	}

	.scarcity-level {
		padding: 0.25rem 0.5rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		font-size: 0.875rem;
		font-family: var(--font-mono);
		font-weight: 600;
	}

	.scarcity-level.critical {
		background: rgba(220, 38, 38, 0.2);
		border: 1px solid rgba(220, 38, 38, 0.4);
		color: #fca5a5;
	}

	.alert-description {
		font-size: 0.75rem;
		opacity: 0.8;
		line-height: 1.4;
	}

	.scarcity-bar-container {
		height: 8px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
		overflow: hidden;
	}

	.scarcity-bar {
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.alert-details {
		display: flex;
		gap: 1rem;
		font-size: 0.7rem;
		opacity: 0.7;
	}

	.detail-item {
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}

	.detail-value {
		font-family: var(--font-mono);
	}

	.causes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
	}

	.causes-label {
		font-size: 0.7rem;
		font-weight: 600;
		opacity: 0.7;
	}

	.cause-tag {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 3px;
		font-size: 0.7rem;
		color: #f87171;
	}

	.footer-info {
		padding-top: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		opacity: 0.5;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
