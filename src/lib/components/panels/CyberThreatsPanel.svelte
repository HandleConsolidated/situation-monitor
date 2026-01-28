<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { onMount } from 'svelte';

	interface CyberThreat {
		id: string;
		type: 'breach' | 'vulnerability' | 'ransomware' | 'ddos' | 'supply-chain';
		title: string;
		description: string;
		severity: 'critical' | 'high' | 'medium' | 'low';
		target: string; // Company, country, or sector
		timestamp: string;
		source: string;
		cve?: string; // CVE identifier if applicable
		affectedSystems?: string[];
	}

	let threats = $state<CyberThreat[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let lastUpdated = $state<Date | null>(null);

	const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

	async function fetchThreats() {
		loading = true;
		error = null;

		try {
			// TODO: Integrate with real threat intelligence feeds
			// For now, generate mock data based on recent patterns
			threats = generateMockThreats();
			lastUpdated = new Date();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch cyber threats';
		} finally {
			loading = false;
		}
	}

	function generateMockThreats(): CyberThreat[] {
		// Placeholder - would be replaced with real API integration
		const mockThreats: CyberThreat[] = [
			{
				id: 'ct-001',
				type: 'ransomware',
				title: 'LockBit 3.0 Campaign',
				description: 'Widespread ransomware targeting healthcare sector',
				severity: 'critical',
				target: 'Healthcare',
				timestamp: new Date().toISOString(),
				source: 'CISA',
				affectedSystems: ['Windows', 'Linux']
			},
			{
				id: 'ct-002',
				type: 'vulnerability',
				title: 'Log4j RCE Exploit',
				description: 'Critical remote code execution vulnerability in Log4j',
				severity: 'critical',
				target: 'Global',
				timestamp: new Date().toISOString(),
				source: 'NVD',
				cve: 'CVE-2021-44228'
			}
		];

		return mockThreats;
	}

	onMount(() => {
		fetchThreats();
		const interval = setInterval(fetchThreats, REFRESH_INTERVAL);
		return () => clearInterval(interval);
	});

	const criticalCount = $derived(threats.filter(t => t.severity === 'critical').length);
	const highCount = $derived(threats.filter(t => t.severity === 'high').length);

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
			case 'breach': return '🔓';
			case 'vulnerability': return '🛡️';
			case 'ransomware': return '🔒';
			case 'ddos': return '💥';
			case 'supply-chain': return '🔗';
			default: return '⚠️';
		}
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
	id="cyber-threats" 
	title="Cyber Threats" 
	count={criticalCount > 0 ? criticalCount : null}
	{loading} 
	{error}
>
	{#if threats.length === 0 && !loading}
		<div class="no-threats">
			<div class="icon">🔐</div>
			<div class="message">No active cyber threats detected</div>
		</div>
	{:else}
		<div class="threats-content">
			<!-- Severity Summary -->
			{#if criticalCount > 0 || highCount > 0}
				<div class="threat-summary">
					{#if criticalCount > 0}
						<div class="stat critical">
							<span class="count">{criticalCount}</span>
							<span class="label">Critical</span>
						</div>
					{/if}
					{#if highCount > 0}
						<div class="stat high">
							<span class="count">{highCount}</span>
							<span class="label">High</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Threats List -->
			<div class="threats-list">
				{#each threats.slice(0, 10) as threat}
					<button
						class="threat-item {threat.severity}"
						style="border-left-color: {getSeverityColor(threat.severity)}"
					>
						<div class="threat-header">
							<span class="threat-icon">{getTypeIcon(threat.type)}</span>
							<div class="threat-info">
								<div class="threat-title">{threat.title}</div>
								<div class="threat-meta">
									<span class="threat-target">{threat.target}</span>
									<span class="threat-time">{formatTime(threat.timestamp)}</span>
								</div>
							</div>
						</div>
						<div class="threat-description">{threat.description}</div>
						{#if threat.cve}
							<div class="threat-cve">
								<span class="cve-badge">{threat.cve}</span>
							</div>
						{/if}
						{#if threat.affectedSystems && threat.affectedSystems.length > 0}
							<div class="affected-systems">
								{#each threat.affectedSystems as system}
									<span class="system-tag">{system}</span>
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
	.no-threats {
		padding: 3rem 1rem;
		text-align: center;
		color: var(--text-secondary);
	}

	.no-threats .icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.no-threats .message {
		font-size: 0.875rem;
	}

	.threats-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.threat-summary {
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

	.stat.critical {
		background: rgba(220, 38, 38, 0.15);
		border: 1px solid rgba(220, 38, 38, 0.3);
	}

	.stat.high {
		background: rgba(249, 115, 22, 0.15);
		border: 1px solid rgba(249, 115, 22, 0.3);
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

	.threats-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.threat-item {
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

	.threat-item:hover {
		background: rgba(255, 255, 255, 0.05);
		transform: translateX(2px);
	}

	.threat-item.critical {
		border-color: #dc2626;
	}

	.threat-item.high {
		border-color: #f97316;
	}

	.threat-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.threat-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.threat-info {
		flex: 1;
		min-width: 0;
	}

	.threat-title {
		font-weight: 600;
		font-size: 0.875rem;
		margin-bottom: 0.25rem;
	}

	.threat-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.threat-target {
		color: #06b6d4;
	}

	.threat-time {
		font-family: var(--font-mono);
	}

	.threat-description {
		font-size: 0.75rem;
		opacity: 0.8;
		line-height: 1.4;
	}

	.threat-cve {
		display: flex;
		gap: 0.5rem;
	}

	.cve-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background: rgba(220, 38, 38, 0.2);
		border: 1px solid rgba(220, 38, 38, 0.4);
		border-radius: 3px;
		font-size: 0.7rem;
		font-family: var(--font-mono);
		color: #fca5a5;
	}

	.affected-systems {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.system-tag {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		font-size: 0.7rem;
		opacity: 0.7;
	}

	.footer-info {
		padding-top: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		opacity: 0.5;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
