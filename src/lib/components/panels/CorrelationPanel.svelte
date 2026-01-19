<script lang="ts">
	import { Panel, Badge } from '$lib/components/common';
	import { analyzeCorrelations } from '$lib/analysis/correlation';
	import { analysisResults } from '$lib/stores';
	import { timeAgo } from '$lib/utils';
	import type { NewsItem, CorrelationResult } from '$lib/types';

	interface Props {
		news?: NewsItem[];
		loading?: boolean;
		error?: string | null;
	}

	let { news = [], loading = false, error = null }: Props = $props();

	const analysis = $derived(analyzeCorrelations(news));

	// Track which sections are expanded to show sources
	let expandedPatterns = $state<Set<string>>(new Set());
	let expandedMomentum = $state<Set<string>>(new Set());
	let expandedCorrelations = $state<Set<string>>(new Set());
	let expandedPredictive = $state<Set<string>>(new Set());

	function togglePatternExpanded(id: string) {
		const newSet = new Set(expandedPatterns);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedPatterns = newSet;
	}

	function toggleMomentumExpanded(id: string) {
		const newSet = new Set(expandedMomentum);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedMomentum = newSet;
	}

	function toggleCorrelationExpanded(id: string) {
		const newSet = new Set(expandedCorrelations);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedCorrelations = newSet;
	}

	function togglePredictiveExpanded(id: string) {
		const newSet = new Set(expandedPredictive);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		expandedPredictive = newSet;
	}

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

	function formatHeadlineTime(timestamp: number | undefined): string {
		if (!timestamp) return '';
		return timeAgo(timestamp);
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
							<button
								class="pattern-header clickable"
								onclick={() => togglePatternExpanded(pattern.id)}
								aria-expanded={expandedPatterns.has(pattern.id)}
							>
								<span class="pattern-topic">{pattern.name}</span>
								<div class="pattern-header-right">
									<Badge
										text={pattern.level.toUpperCase()}
										variant={getLevelVariant(pattern.level)}
									/>
									<span class="expand-indicator" class:expanded={expandedPatterns.has(pattern.id)}>
										{expandedPatterns.has(pattern.id) ? '−' : '+'}
									</span>
								</div>
							</button>
							<div class="pattern-meta">
								{pattern.sources.slice(0, 3).join(' · ')} ({pattern.count} items)
							</div>
							{#if expandedPatterns.has(pattern.id) && pattern.headlines.length > 0}
								<div class="source-list">
									{#each pattern.headlines.slice(0, 5) as headline}
										<div class="source-item">
											<span class="source-name">{headline.source}</span>
											<a
												href={headline.link}
												target="_blank"
												rel="noopener noreferrer"
												class="source-link"
												title={headline.title}
											>
												{headline.title}
											</a>
											{#if headline.timestamp}
												<span class="source-time">{formatHeadlineTime(headline.timestamp)}</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if analysis.momentumSignals.length > 0}
				<div class="section">
					<div class="section-title">Momentum Signals</div>
					{#each analysis.momentumSignals.slice(0, 3) as signal}
						<div class="momentum-container">
							<button
								class="signal-item {getMomentumClass(signal.momentum)} clickable"
								onclick={() => toggleMomentumExpanded(signal.id)}
								aria-expanded={expandedMomentum.has(signal.id)}
							>
								<span class="signal-topic">{signal.name}</span>
								<div class="signal-right">
									<span
										class="signal-direction"
										class:up={signal.delta > 0}
										class:down={signal.delta < 0}
									>
										{getDirectionArrow(signal.delta)}
										{signal.current}
									</span>
									<span class="expand-indicator-small" class:expanded={expandedMomentum.has(signal.id)}>
										{expandedMomentum.has(signal.id) ? '−' : '+'}
									</span>
								</div>
							</button>
							{#if expandedMomentum.has(signal.id) && signal.headlines.length > 0}
								<div class="source-list">
									{#each signal.headlines.slice(0, 4) as headline}
										<div class="source-item">
											<span class="source-name">{headline.source}</span>
											<a
												href={headline.link}
												target="_blank"
												rel="noopener noreferrer"
												class="source-link"
												title={headline.title}
											>
												{headline.title}
											</a>
											{#if headline.timestamp}
												<span class="source-time">{formatHeadlineTime(headline.timestamp)}</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if analysis.crossSourceCorrelations.length > 0}
				<div class="section">
					<div class="section-title">Cross-Source Links</div>
					{#each analysis.crossSourceCorrelations.slice(0, 3) as corr}
						<div class="correlation-container">
							<button
								class="correlation-item clickable"
								onclick={() => toggleCorrelationExpanded(corr.id)}
								aria-expanded={expandedCorrelations.has(corr.id)}
							>
								<div class="correlation-info">
									<div class="correlation-sources-display">
										{corr.sources.slice(0, 2).join(' ↔ ')}
									</div>
									<div class="correlation-topic">{corr.name} ({corr.sourceCount} sources)</div>
								</div>
								<span class="expand-indicator-small" class:expanded={expandedCorrelations.has(corr.id)}>
									{expandedCorrelations.has(corr.id) ? '−' : '+'}
								</span>
							</button>
							{#if expandedCorrelations.has(corr.id) && corr.headlines.length > 0}
								<div class="source-list">
									{#each corr.headlines.slice(0, 5) as headline}
										<div class="source-item">
											<span class="source-name">{headline.source}</span>
											<a
												href={headline.link}
												target="_blank"
												rel="noopener noreferrer"
												class="source-link"
												title={headline.title}
											>
												{headline.title}
											</a>
											{#if headline.timestamp}
												<span class="source-time">{formatHeadlineTime(headline.timestamp)}</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if analysis.predictiveSignals.length > 0}
				<div class="section">
					<div class="section-title">Predictive Signals</div>
					{#each analysis.predictiveSignals.slice(0, 2) as signal}
						<div class="predictive-container">
							<button
								class="predictive-item clickable"
								onclick={() => togglePredictiveExpanded(signal.id)}
								aria-expanded={expandedPredictive.has(signal.id)}
							>
								<div class="predictive-info">
									<div class="predictive-pattern">{signal.prediction}</div>
									<div class="predictive-confidence">
										Confidence: {Math.round(signal.confidence)}%
									</div>
								</div>
								<span class="expand-indicator-small" class:expanded={expandedPredictive.has(signal.id)}>
									{expandedPredictive.has(signal.id) ? '−' : '+'}
								</span>
							</button>
							{#if expandedPredictive.has(signal.id) && signal.headlines.length > 0}
								<div class="source-list">
									{#each signal.headlines.slice(0, 4) as headline}
										<div class="source-item">
											<span class="source-name">{headline.source}</span>
											<a
												href={headline.link}
												target="_blank"
												rel="noopener noreferrer"
												class="source-link"
												title={headline.title}
											>
												{headline.title}
											</a>
											{#if headline.timestamp}
												<span class="source-time">{formatHeadlineTime(headline.timestamp)}</span>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
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

	/* Pattern items */
	.pattern-item {
		padding: 0.3rem 0;
	}

	.pattern-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.2rem;
		width: 100%;
		background: transparent;
		border: none;
		padding: 0;
		text-align: left;
	}

	.pattern-header.clickable {
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.pattern-header.clickable:hover {
		opacity: 0.8;
	}

	.pattern-header-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pattern-topic {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		color: var(--text-primary);
		line-height: var(--lh-snug);
	}

	.pattern-meta {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		line-height: var(--lh-tight);
	}

	/* Expand indicators */
	.expand-indicator {
		font-size: var(--fs-sm);
		font-weight: 700;
		color: var(--accent);
		width: 1rem;
		text-align: center;
		transition: transform 0.2s;
	}

	.expand-indicator-small {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--accent);
		width: 0.8rem;
		text-align: center;
		transition: transform 0.2s;
	}

	/* Momentum signals */
	.momentum-container {
		margin: 0.2rem 0;
	}

	.signal-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.25rem 0.4rem;
		border-radius: 2px;
		background: var(--card-bg);
		border-left: 2px solid transparent;
		width: 100%;
		border-top: none;
		border-right: none;
		border-bottom: none;
	}

	.signal-item.clickable {
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.signal-item.clickable:hover {
		opacity: 0.85;
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
		text-align: left;
	}

	.signal-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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

	/* Correlation items */
	.correlation-container {
		padding: 0.25rem 0;
	}

	.correlation-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		background: transparent;
		border: none;
		padding: 0;
		text-align: left;
	}

	.correlation-item.clickable {
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.correlation-item.clickable:hover {
		opacity: 0.8;
	}

	.correlation-info {
		flex: 1;
	}

	.correlation-sources-display {
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

	/* Predictive items */
	.predictive-container {
		padding: 0.3rem 0;
	}

	.predictive-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		width: 100%;
		background: transparent;
		border: none;
		padding: 0;
		text-align: left;
	}

	.predictive-item.clickable {
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.predictive-item.clickable:hover {
		opacity: 0.8;
	}

	.predictive-info {
		flex: 1;
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

	/* Source list (expandable section) */
	.source-list {
		margin-top: 0.5rem;
		padding-left: 0.5rem;
		border-left: 2px solid var(--border-divider);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.source-item {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.25rem 0;
		border-bottom: 1px solid var(--border-divider);
	}

	.source-item:last-child {
		border-bottom: none;
	}

	.source-name {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
	}

	.source-link {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-weight: 500;
		color: var(--text-secondary);
		text-decoration: none;
		line-height: var(--lh-snug);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		transition: color 0.15s;
	}

	.source-link:hover {
		color: var(--accent);
		text-decoration: underline;
	}

	.source-time {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
		line-height: var(--lh-tight);
	}

	/* Empty state */
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
