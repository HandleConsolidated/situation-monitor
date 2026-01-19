<script lang="ts">
	import { Panel, Badge } from '$lib/components/common';
	import { analyzeCorrelations } from '$lib/analysis/correlation';
	import { analysisResults } from '$lib/stores';
	import type { NewsItem, CorrelationResult } from '$lib/types';

	interface Props {
		news?: NewsItem[];
		loading?: boolean;
		error?: string | null;
	}

	let { news = [], loading = false, error = null }: Props = $props();

	const analysis = $derived(analyzeCorrelations(news));

	// Convert analysis results to CorrelationResult format and update store
	$effect(() => {
		if (!analysis) {
			analysisResults.setCorrelations([]);
			return;
		}

		// Convert emerging patterns and momentum signals to CorrelationResult format
		const correlations: CorrelationResult[] = [];

		// Add emerging patterns
		for (const pattern of analysis.emergingPatterns) {
			correlations.push({
				topic: pattern.name,
				count: pattern.count,
				sources: pattern.sources,
				momentum: pattern.level === 'high' ? 'rising' : 'stable'
			});
		}

		// Add momentum signals
		for (const signal of analysis.momentumSignals) {
			// Avoid duplicates
			if (!correlations.some(c => c.topic === signal.name)) {
				correlations.push({
					topic: signal.name,
					count: signal.current,
					sources: [],
					momentum: signal.momentum === 'surging' || signal.momentum === 'rising' ? 'rising' : 'stable'
				});
			}
		}

		// Add cross-source correlations
		for (const corr of analysis.crossSourceCorrelations) {
			if (!correlations.some(c => c.topic === corr.name)) {
				correlations.push({
					topic: corr.name,
					count: corr.sourceCount,
					sources: corr.sources,
					momentum: corr.level === 'high' ? 'rising' : 'stable'
				});
			}
		}

		analysisResults.setCorrelations(correlations);
	});

	function getLevelVariant(level: string): 'default' | 'warning' | 'danger' | 'success' | 'info' {
		switch (level) {
			case 'high':
				return 'danger';
			case 'elevated':
				return 'warning';
			case 'surging':
				return 'danger';
			case 'rising':
				return 'warning';
			default:
				return 'default';
		}
	}

	function getMomentumClass(momentum: string): string {
		switch (momentum) {
			case 'surging':
				return 'signal-strong';
			case 'rising':
				return 'signal-medium';
			default:
				return 'signal-weak';
		}
	}

	function getDirectionArrow(delta: number): string {
		if (delta > 0) return '↑';
		if (delta < 0) return '↓';
		return '→';
	}
</script>

<Panel id="correlation" title="Pattern Analysis" {loading} {error}>
	{#if news.length === 0 && !loading && !error}
		<div class="empty-state">Insufficient data for analysis</div>
	{:else if analysis}
		<div class="correlation-content">
			{#if analysis.emergingPatterns.length > 0}
				<div class="section">
					<div class="section-title">Emerging Patterns</div>
					{#each analysis.emergingPatterns.slice(0, 3) as pattern}
						<div class="pattern-item">
							<div class="pattern-header">
								<span class="pattern-topic">{pattern.name}</span>
								<Badge
									text={pattern.level.toUpperCase()}
									variant={getLevelVariant(pattern.level)}
								/>
							</div>
							<div class="pattern-sources">
								{pattern.sources.slice(0, 3).join(' · ')} ({pattern.count} items)
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if analysis.momentumSignals.length > 0}
				<div class="section">
					<div class="section-title">Momentum Signals</div>
					{#each analysis.momentumSignals.slice(0, 3) as signal}
						<div class="signal-item {getMomentumClass(signal.momentum)}">
							<span class="signal-topic">{signal.name}</span>
							<span
								class="signal-direction"
								class:up={signal.delta > 0}
								class:down={signal.delta < 0}
							>
								{getDirectionArrow(signal.delta)}
								{signal.current}
							</span>
						</div>
					{/each}
				</div>
			{/if}

			{#if analysis.crossSourceCorrelations.length > 0}
				<div class="section">
					<div class="section-title">Cross-Source Links</div>
					{#each analysis.crossSourceCorrelations.slice(0, 3) as corr}
						<div class="correlation-item">
							<div class="correlation-sources">
								{corr.sources.slice(0, 2).join(' ↔ ')}
							</div>
							<div class="correlation-topic">{corr.name} ({corr.sourceCount} sources)</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if analysis.predictiveSignals.length > 0}
				<div class="section">
					<div class="section-title">Predictive Signals</div>
					{#each analysis.predictiveSignals.slice(0, 2) as signal}
						<div class="predictive-item">
							<div class="predictive-pattern">{signal.prediction}</div>
							<div class="predictive-confidence">
								Confidence: {Math.round(signal.confidence * 100)}%
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if analysis.emergingPatterns.length === 0 && analysis.momentumSignals.length === 0}
				<div class="empty-state">No significant patterns detected</div>
			{/if}
		</div>
	{:else}
		<div class="empty-state">No significant patterns detected</div>
	{/if}
</Panel>

<style>
	.correlation-content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section {
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border-divider);
	}

	.section:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.section-title {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		margin-bottom: 0.4rem;
		line-height: var(--lh-tight);
	}

	.pattern-item {
		padding: 0.3rem 0;
	}

	.pattern-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.2rem;
	}

	.pattern-topic {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		color: var(--text-primary);
		line-height: var(--lh-snug);
	}

	.pattern-sources {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		line-height: var(--lh-tight);
	}

	.signal-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 0.4rem;
		margin: 0.2rem 0;
		border-radius: 2px;
		background: var(--card-bg);
		border-left: 2px solid transparent;
	}

	.signal-item.signal-strong {
		background: var(--warning-bg);
		border-left-color: var(--warning);
	}

	.signal-item.signal-medium {
		background: var(--success-bg);
		border-left-color: var(--success);
	}

	.signal-topic {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		color: var(--text-primary);
		line-height: var(--lh-snug);
	}

	.signal-direction {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		line-height: var(--lh-tight);
	}

	.signal-direction.up {
		color: var(--success);
	}

	.signal-direction.down {
		color: var(--danger);
	}

	.correlation-item {
		padding: 0.25rem 0;
	}

	.correlation-sources {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		color: var(--text-secondary);
		line-height: var(--lh-snug);
	}

	.correlation-topic {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		line-height: var(--lh-tight);
	}

	.predictive-item {
		padding: 0.3rem 0;
	}

	.predictive-pattern {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		color: var(--text-primary);
		line-height: var(--lh-snug);
	}

	.predictive-confidence {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		line-height: var(--lh-tight);
	}

	.empty-state {
		text-align: center;
		color: var(--text-dim);
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		padding: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		line-height: var(--lh-normal);
	}
</style>
