<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { onMount } from 'svelte';

	interface MaritimeIncident {
		id: string;
		type: 'piracy' | 'naval-activity' | 'blockade' | 'collision' | 'interdiction' | 'exercise';
		title: string;
		description: string;
		location: string;
		chokepoint?: string; // Associated maritime chokepoint
		lat?: number;
		lon?: number;
		severity: 'critical' | 'high' | 'medium' | 'low';
		vessels: string[];
		actors: string[];
		timestamp: string;
		status: 'active' | 'resolved' | 'monitoring';
	}

	let incidents = $state<MaritimeIncident[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastUpdated = $state<Date | null>(null);

	const REFRESH_INTERVAL = 20 * 60 * 1000; // 20 minutes

	async function fetchIncidents() {
		loading = true;
		error = null;

		try {
			// TODO: Integrate with maritime security feeds
			// Sources: IMB Piracy Center, naval activity feeds, shipping news
			incidents = generateMockIncidents();
			lastUpdated = new Date();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch maritime security data';
		} finally {
			loading = false;
		}
	}

	function generateMockIncidents(): MaritimeIncident[] {
		return [
			{
				id: 'mar-001',
				type: 'piracy',
				title: 'Cargo Ship Hijacking Attempt',
				description: 'Armed attackers boarded container vessel, crew repelled',
				location: 'Gulf of Aden',
				chokepoint: 'Bab el-Mandeb',
				lat: 12.6,
				lon: 43.4,
				severity: 'high',
				vessels: ['MV Ocean Glory'],
				actors: ['Unknown Pirates'],
				timestamp: new Date().toISOString(),
				status: 'resolved'
			},
			{
				id: 'mar-002',
				type: 'naval-activity',
				title: 'Naval Standoff',
				description: 'Multiple naval vessels in close proximity, heightened tensions',
				location: 'South China Sea',
				chokepoint: 'Malacca Strait',
				lat: 7.0,
				lon: 110.0,
				severity: 'critical',
				vessels: ['USS Ronald Reagan', 'Chinese Type 055 DDG', 'HMS Queen Elizabeth'],
				actors: ['US Navy', 'PLAN', 'Royal Navy'],
				timestamp: new Date().toISOString(),
				status: 'active'
			},
			{
				id: 'mar-003',
				type: 'blockade',
				title: 'Grain Export Disruption',
				description: 'Naval blockade preventing commercial shipping',
				location: 'Black Sea',
				lat: 44.0,
				lon: 33.0,
				severity: 'critical',
				vessels: ['Multiple Commercial Vessels'],
				actors: ['Russian Navy'],
				timestamp: new Date(Date.now() - 86400000).toISOString(),
				status: 'active'
			}
		];
	}

	onMount(() => {
		fetchIncidents();
		const interval = setInterval(fetchIncidents, REFRESH_INTERVAL);
		return () => clearInterval(interval);
	});

	const activeIncidents = $derived(incidents.filter(i => i.status === 'active'));
	const criticalCount = $derived(incidents.filter(i => i.severity === 'critical' && i.status === 'active').length);

	function getTypeIcon(type: string): string {
		switch (type) {
			case 'piracy': return '🏴‍☠️';
			case 'naval-activity': return '⚓';
			case 'blockade': return '🚧';
			case 'collision': return '💥';
			case 'interdiction': return '🛑';
			case 'exercise': return '🎯';
			default: return '🚢';
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

	function formatType(type: string): string {
		return type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
	}

	function formatTime(timestamp: string): string {
		try {
			const date = new Date(timestamp);
			const now = new Date();
			const diffMs = now.getTime() - date.getTime();
			const diffHours = Math.floor(diffMs / 3600000);
			
			if (diffHours < 1) return 'Just now';
			if (diffHours < 24) return `${diffHours}h ago`;
			return `${Math.floor(diffHours / 24)}d ago`;
		} catch {
			return '--';
		}
	}
</script>

<Panel 
	id="maritime-security" 
	title="Maritime Security" 
	count={criticalCount > 0 ? criticalCount : null}
	{loading} 
	{error}
>
	{#if incidents.length === 0 && !loading}
		<div class="no-incidents">
			<div class="icon">🌊</div>
			<div class="message">No maritime security incidents</div>
		</div>
	{:else}
		<div class="incidents-content">
			<!-- Active Incidents Banner -->
			{#if activeIncidents.length > 0}
				<div class="active-banner">
					<span class="banner-icon">⚠️</span>
					<span class="banner-text">
						{activeIncidents.length} active incident{activeIncidents.length > 1 ? 's' : ''}
					</span>
				</div>
			{/if}

			<!-- Incidents List -->
			<div class="incidents-list">
				{#each incidents.slice(0, 10) as incident}
					<button
						class="incident-item {incident.severity} {incident.status}"
						style="border-left-color: {getSeverityColor(incident.severity)}"
					>
						<div class="incident-header">
							<span class="incident-icon">{getTypeIcon(incident.type)}</span>
							<div class="incident-info">
								<div class="incident-title">{incident.title}</div>
								<div class="incident-type">{formatType(incident.type)}</div>
							</div>
							<div class="incident-status {incident.status}">
								{incident.status.toUpperCase()}
							</div>
						</div>
						
						<div class="incident-description">{incident.description}</div>
						
						<div class="incident-details">
							<div class="detail-item">
								<span class="detail-label">📍</span>
								<span class="detail-value">{incident.location}</span>
							</div>
							{#if incident.chokepoint}
								<div class="detail-item">
									<span class="detail-label">🔴</span>
									<span class="detail-value">{incident.chokepoint}</span>
								</div>
							{/if}
							<div class="detail-item">
								<span class="detail-label">⏰</span>
								<span class="detail-value">{formatTime(incident.timestamp)}</span>
							</div>
						</div>

						{#if incident.vessels.length > 0}
							<div class="vessels">
								<span class="vessels-label">Vessels:</span>
								{#each incident.vessels as vessel}
									<span class="vessel-tag">{vessel}</span>
								{/each}
							</div>
						{/if}

						{#if incident.actors.length > 0}
							<div class="actors">
								<span class="actors-label">Actors:</span>
								{#each incident.actors as actor}
									<span class="actor-tag">{actor}</span>
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
	.no-incidents {
		padding: 3rem 1rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.no-incidents .icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.no-incidents .message {
		font-size: 0.875rem;
	}

	.incidents-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.active-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: rgba(220, 38, 38, 0.15);
		border: 1px solid rgba(220, 38, 38, 0.3);
		border-radius: 4px;
	}

	.banner-icon {
		font-size: 1.25rem;
	}

	.banner-text {
		font-size: 0.875rem;
		font-weight: 600;
		color: #fca5a5;
	}

	.incidents-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.incident-item {
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

	.incident-item:hover {
		background: rgba(255, 255, 255, 0.05);
		transform: translateX(2px);
	}

	.incident-item.active {
		background: rgba(220, 38, 38, 0.05);
	}

	.incident-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.incident-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.incident-info {
		flex: 1;
		min-width: 0;
	}

	.incident-title {
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 0.125rem;
	}

	.incident-type {
		font-size: 0.75rem;
		opacity: 0.7;
		text-transform: uppercase;
	}

	.incident-status {
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.incident-status.active {
		background: rgba(220, 38, 38, 0.2);
		border: 1px solid rgba(220, 38, 38, 0.4);
		color: #fca5a5;
	}

	.incident-status.monitoring {
		background: rgba(234, 179, 8, 0.2);
		border: 1px solid rgba(234, 179, 8, 0.4);
		color: #fde047;
	}

	.incident-status.resolved {
		background: rgba(16, 185, 129, 0.2);
		border: 1px solid rgba(16, 185, 129, 0.4);
		color: #34d399;
	}

	.incident-description {
		font-size: 0.75rem;
		opacity: 0.8;
		line-height: 1.4;
	}

	.incident-details {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
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

	.vessels, .actors {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
	}

	.vessels-label, .actors-label {
		font-size: 0.7rem;
		font-weight: 600;
		opacity: 0.7;
	}

	.vessel-tag {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		background: rgba(6, 182, 212, 0.15);
		border: 1px solid rgba(6, 182, 212, 0.3);
		border-radius: 3px;
		font-size: 0.7rem;
		color: #22d3ee;
	}

	.actor-tag {
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
