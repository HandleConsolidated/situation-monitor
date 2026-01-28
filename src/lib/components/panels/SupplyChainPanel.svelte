<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { onMount } from 'svelte';

	interface SupplyChainDisruption {
		id: string;
		type: 'port-congestion' | 'shipping-delay' | 'factory-closure' | 'shortage' | 'logistics';
		location: string;
		country: string;
		description: string;
		severity: 'critical' | 'high' | 'medium' | 'low';
		affectedSectors: string[];
		timestamp: string;
		estimatedDuration?: string;
		impactScore?: number; // 1-10
	}

	let disruptions = $state<SupplyChainDisruption[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastUpdated = $state<Date | null>(null);

	const REFRESH_INTERVAL = 20 * 60 * 1000; // 20 minutes

	async function fetchDisruptions() {
		loading = true;
		error = null;

		try {
			// TODO: Integrate with supply chain data APIs
			// Potential sources: MarineTraffic, Project44, Flexport, customs data
			disruptions = generateMockDisruptions();
			lastUpdated = new Date();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch supply chain data';
		} finally {
			loading = false;
		}
	}

	function generateMockDisruptions(): SupplyChainDisruption[] {
		return [
			{
				id: 'sc-001',
				type: 'port-congestion',
				location: 'Port of Los Angeles',
				country: 'United States',
				description: 'Container backlog due to labor shortage',
				severity: 'high',
				affectedSectors: ['Electronics', 'Automotive', 'Consumer Goods'],
				timestamp: new Date().toISOString(),
				estimatedDuration: '2-3 weeks',
				impactScore: 8
			},
			{
				id: 'sc-002',
				type: 'shortage',
				location: 'Taiwan',
				country: 'Taiwan',
				description: 'Semiconductor chip shortage affecting global supply',
				severity: 'critical',
				affectedSectors: ['Tech', 'Automotive', 'Healthcare'],
				timestamp: new Date().toISOString(),
				estimatedDuration: '6+ months',
				impactScore: 10
			}
		];
	}

	onMount(() => {
		fetchDisruptions();
		const interval = setInterval(fetchDisruptions, REFRESH_INTERVAL);
		return () => clearInterval(interval);
	});

	const criticalCount = $derived(disruptions.filter(d => d.severity === 'critical').length);
	const highImpact = $derived(disruptions.filter(d => (d.impactScore ?? 0) >= 8));

	function getSeverityColor(severity: string): string {
		switch (severity) {
			case 'critical': return '#dc2626';
			case 'high': return '#f97316';
			case 'medium': return '#eab308';
			case 'low': return '#10b981';
			default: return '#6b7280';
		}
	}

	function getTypeIcon(type: string): string {
		switch (type) {
			case 'port-congestion': return '🚢';
			case 'shipping-delay': return '📦';
			case 'factory-closure': return '🏭';
			case 'shortage': return '⚠️';
			case 'logistics': return '🚛';
			default: return '🔄';
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
			const diffMins = Math.floor(diffMs / 60000);
			
			if (diffMins < 60) return `${diffMins}m ago`;
			const diffHours = Math.floor(diffMins / 60);
			if (diffHours < 24) return `${diffHours}h ago`;
			return `${Math.floor(diffHours / 24)}d ago`;
		} catch {
			return '--';
		}
	}
</script>

<Panel 
	id="supply-chain" 
	title="Supply Chain" 
	count={criticalCount > 0 ? criticalCount : null}
	{loading} 
	{error}
>
	{#if disruptions.length === 0 && !loading}
		<div class="no-disruptions">
			<div class="icon">✅</div>
			<div class="message">No major supply chain disruptions detected</div>
		</div>
	{:else}
		<div class="disruptions-content">
			<!-- Impact Summary -->
			{#if highImpact.length > 0}
				<div class="impact-banner">
					<span class="banner-icon">⚠️</span>
					<span class="banner-text">
						{highImpact.length} high-impact disruption{highImpact.length > 1 ? 's' : ''}
					</span>
				</div>
			{/if}

			<!-- Disruptions List -->
			<div class="disruptions-list">
				{#each disruptions.slice(0, 8) as disruption}
					<button
						class="disruption-item {disruption.severity}"
						style="border-left-color: {getSeverityColor(disruption.severity)}"
					>
						<div class="disruption-header">
							<span class="disruption-icon">{getTypeIcon(disruption.type)}</span>
							<div class="disruption-info">
								<div class="disruption-location">{disruption.location}</div>
								<div class="disruption-type">{formatType(disruption.type)}</div>
							</div>
							{#if disruption.impactScore}
								<div class="impact-score" class:high={disruption.impactScore >= 8}>
									{disruption.impactScore}/10
								</div>
							{/if}
						</div>
						
						<div class="disruption-description">{disruption.description}</div>
						
						<div class="disruption-details">
							{#if disruption.estimatedDuration}
								<div class="detail-item">
									<span class="detail-label">Duration:</span>
									<span class="detail-value">{disruption.estimatedDuration}</span>
								</div>
							{/if}
							<div class="detail-item">
								<span class="detail-label">Updated:</span>
								<span class="detail-value">{formatTime(disruption.timestamp)}</span>
							</div>
						</div>

						{#if disruption.affectedSectors.length > 0}
							<div class="affected-sectors">
								{#each disruption.affectedSectors as sector}
									<span class="sector-tag">{sector}</span>
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
	.no-disruptions {
		padding: 3rem 1rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.no-disruptions .icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.no-disruptions .message {
		font-size: 0.875rem;
	}

	.disruptions-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.impact-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: rgba(249, 115, 22, 0.15);
		border: 1px solid rgba(249, 115, 22, 0.3);
		border-radius: 4px;
	}

	.banner-icon {
		font-size: 1.25rem;
	}

	.banner-text {
		font-size: 0.875rem;
		font-weight: 600;
		color: #fb923c;
	}

	.disruptions-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.disruption-item {
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

	.disruption-item:hover {
		background: rgba(255, 255, 255, 0.05);
		transform: translateX(2px);
	}

	.disruption-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.disruption-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.disruption-info {
		flex: 1;
		min-width: 0;
	}

	.disruption-location {
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 0.125rem;
	}

	.disruption-type {
		font-size: 0.75rem;
		opacity: 0.7;
		text-transform: uppercase;
	}

	.impact-score {
		padding: 0.25rem 0.5rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		font-size: 0.75rem;
		font-family: var(--font-mono);
		font-weight: 600;
	}

	.impact-score.high {
		background: rgba(249, 115, 22, 0.2);
		border: 1px solid rgba(249, 115, 22, 0.4);
		color: #fb923c;
	}

	.disruption-description {
		font-size: 0.75rem;
		opacity: 0.8;
		line-height: 1.4;
	}

	.disruption-details {
		display: flex;
		gap: 1rem;
		font-size: 0.7rem;
		opacity: 0.7;
	}

	.detail-item {
		display: flex;
		gap: 0.375rem;
	}

	.detail-label {
		font-weight: 600;
	}

	.detail-value {
		font-family: var(--font-mono);
	}

	.affected-sectors {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.sector-tag {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		background: rgba(6, 182, 212, 0.15);
		border: 1px solid rgba(6, 182, 212, 0.3);
		border-radius: 3px;
		font-size: 0.7rem;
		color: #22d3ee;
	}

	.footer-info {
		padding-top: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		opacity: 0.5;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
