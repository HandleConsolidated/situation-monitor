<script lang="ts">
	import { Panel, Badge } from '$lib/components/common';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { analyzeNarratives } from '$lib/analysis/narrative';
	import type { NewsItem } from '$lib/types';
	import type { NarrativeData, EmergingFringe, FringeToMainstream } from '$lib/analysis/narrative';

	interface Props {
		news?: NewsItem[];
		loading?: boolean;
		error?: string | null;
	}

	let { news = [], loading = false, error = null }: Props = $props();

	const analysis = $derived(analyzeNarratives(news));

	// Selected narrative for detail view
	let selectedNarrative = $state<NarrativeData | EmergingFringe | FringeToMainstream | null>(null);
	let selectedType = $state<'emerging' | 'crossover' | 'watch' | 'disinfo' | null>(null);

	function openNarrativeDetail(
		narrative: NarrativeData | EmergingFringe | FringeToMainstream,
		type: 'emerging' | 'crossover' | 'watch' | 'disinfo'
	) {
		selectedNarrative = narrative;
		selectedType = type;
	}

	function closeNarrativeDetail() {
		selectedNarrative = null;
		selectedType = null;
	}

	function getStatusVariant(status: string): 'default' | 'warning' | 'danger' | 'success' | 'info' {
		switch (status) {
			case 'viral':
				return 'danger';
			case 'spreading':
				return 'warning';
			case 'emerging':
				return 'info';
			case 'crossing':
				return 'warning';
			default:
				return 'default';
		}
	}

	function getSeverityVariant(
		severity: string
	): 'default' | 'warning' | 'danger' | 'success' | 'info' {
		switch (severity) {
			case 'high':
				return 'danger';
			case 'medium':
				return 'warning';
			default:
				return 'default';
		}
	}

	function getTypeLabel(type: 'emerging' | 'crossover' | 'watch' | 'disinfo' | null): string {
		switch (type) {
			case 'emerging':
				return 'Emerging Fringe';
			case 'crossover':
				return 'Fringe to Mainstream';
			case 'watch':
				return 'Narrative Watch';
			case 'disinfo':
				return 'Disinfo Signal';
			default:
				return 'Narrative';
		}
	}

	function getTypeColor(type: 'emerging' | 'crossover' | 'watch' | 'disinfo' | null): string {
		switch (type) {
			case 'emerging':
				return 'text-cyan-400';
			case 'crossover':
				return 'text-amber-400';
			case 'watch':
				return 'text-slate-400';
			case 'disinfo':
				return 'text-red-400';
			default:
				return 'text-slate-400';
		}
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<Panel id="narrative" title="Narrative Tracker" {loading} {error}>
	{#if news.length === 0 && !loading && !error}
		<div class="empty-state">Insufficient data for narrative analysis</div>
	{:else if analysis}
		<div class="narrative-content">
			{#if analysis.emergingFringe.length > 0}
				<div class="section">
					<div class="section-title">Emerging Fringe</div>
					{#each analysis.emergingFringe.slice(0, 4) as narrative}
						<button
							class="narrative-item clickable"
							onclick={() => openNarrativeDetail(narrative, 'emerging')}
							type="button"
						>
							<div class="narrative-header">
								<span class="narrative-name">{narrative.name}</span>
								<Badge
									text={narrative.status.toUpperCase()}
									variant={getStatusVariant(narrative.status)}
								/>
							</div>
							<div class="narrative-meta">
								<span class="mention-count">{narrative.count} mentions</span>
							</div>
							{#if narrative.sources.length > 0}
								<div class="narrative-sources">
									{narrative.sources.slice(0, 3).join(' · ')}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/if}

			{#if analysis.fringeToMainstream.length > 0}
				<div class="section">
					<div class="section-title">Fringe to Mainstream Crossovers</div>
					{#each analysis.fringeToMainstream.slice(0, 3) as crossover}
						<button
							class="crossover-item clickable"
							onclick={() => openNarrativeDetail(crossover, 'crossover')}
							type="button"
						>
							<div class="crossover-narrative">{crossover.name}</div>
							<div class="crossover-path">
								<span class="from">Fringe ({crossover.fringeCount})</span>
								<span class="arrow">-></span>
								<span class="to">Mainstream ({crossover.mainstreamCount})</span>
							</div>
							<div class="crossover-level">
								Crossover level: {Math.round(crossover.crossoverLevel * 100)}%
							</div>
						</button>
					{/each}
				</div>
			{/if}

			{#if analysis.narrativeWatch.length > 0}
				<div class="section">
					<div class="section-title">Narrative Watch</div>
					<div class="themes-grid">
						{#each analysis.narrativeWatch.slice(0, 6) as narrative}
							<button
								class="theme-tag clickable"
								onclick={() => openNarrativeDetail(narrative, 'watch')}
								type="button"
							>
								{narrative.name}
								<span class="theme-count">{narrative.count}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if analysis.disinfoSignals.length > 0}
				<div class="section">
					<div class="section-title">Disinfo Signals</div>
					{#each analysis.disinfoSignals.slice(0, 3) as signal}
						<button
							class="disinfo-item clickable"
							onclick={() => openNarrativeDetail(signal, 'disinfo')}
							type="button"
						>
							<div class="disinfo-header">
								<span class="disinfo-name">{signal.name}</span>
								<Badge
									text={signal.severity.toUpperCase()}
									variant={getSeverityVariant(signal.severity)}
								/>
							</div>
							<div class="disinfo-meta">{signal.count} mentions</div>
						</button>
					{/each}
				</div>
			{/if}

			{#if analysis.emergingFringe.length === 0 && analysis.fringeToMainstream.length === 0}
				<div class="empty-state">No significant narratives detected</div>
			{/if}
		</div>
	{:else}
		<div class="empty-state">No significant narratives detected</div>
	{/if}
</Panel>

<!-- Narrative Detail Modal -->
<Modal
	open={selectedNarrative !== null}
	title={selectedNarrative?.name ?? 'Narrative Details'}
	onClose={closeNarrativeDetail}
	size="half-page"
>
	{#if selectedNarrative}
		<div class="detail-content">
			<!-- Narrative Type Badge -->
			<div class="detail-type">
				<span class="type-label {getTypeColor(selectedType)}">
					{getTypeLabel(selectedType)}
				</span>
				{#if 'status' in selectedNarrative}
					<Badge
						text={selectedNarrative.status.toUpperCase()}
						variant={getStatusVariant(selectedNarrative.status)}
					/>
				{/if}
			</div>

			<!-- Statistics -->
			<div class="detail-stats">
				<div class="stat-item">
					<span class="stat-value">{selectedNarrative.count}</span>
					<span class="stat-label">Total Mentions</span>
				</div>
				{#if selectedNarrative.fringeCount > 0}
					<div class="stat-item">
						<span class="stat-value fringe">{selectedNarrative.fringeCount}</span>
						<span class="stat-label">Fringe Sources</span>
					</div>
				{/if}
				{#if selectedNarrative.mainstreamCount > 0}
					<div class="stat-item">
						<span class="stat-value mainstream">{selectedNarrative.mainstreamCount}</span>
						<span class="stat-label">Mainstream</span>
					</div>
				{/if}
				{#if 'crossoverLevel' in selectedNarrative}
					<div class="stat-item">
						<span class="stat-value crossover"
							>{Math.round(selectedNarrative.crossoverLevel * 100)}%</span
						>
						<span class="stat-label">Crossover</span>
					</div>
				{/if}
			</div>

			<!-- Keywords -->
			{#if selectedNarrative.keywords.length > 0}
				<div class="detail-section">
					<div class="detail-section-title">Detection Keywords</div>
					<div class="keywords-list">
						{#each selectedNarrative.keywords as keyword}
							<span class="keyword-tag">{keyword}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Sources -->
			{#if selectedNarrative.sources.length > 0}
				<div class="detail-section">
					<div class="detail-section-title">Sources ({selectedNarrative.sources.length})</div>
					<div class="sources-list">
						{#each selectedNarrative.sources as source}
							<span class="source-tag">{source}</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Matching News Items -->
			<div class="detail-section">
				<div class="detail-section-title">
					Matching Headlines ({selectedNarrative.headlines.length})
				</div>
				{#if selectedNarrative.headlines.length > 0}
					<div class="news-list">
						{#each selectedNarrative.headlines as item}
							<a
								href={item.link}
								target="_blank"
								rel="noopener noreferrer"
								class="news-item-link"
							>
								<div class="news-item-content">
									<div class="news-item-title">{item.title}</div>
									<div class="news-item-meta">
										<span class="news-source">{item.source}</span>
										{#if item.timestamp}
											<span class="news-time">{formatTimestamp(item.timestamp)}</span>
										{/if}
									</div>
								</div>
								<div class="news-item-arrow">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<line x1="7" y1="17" x2="17" y2="7"></line>
										<polyline points="7 7 17 7 17 17"></polyline>
									</svg>
								</div>
							</a>
						{/each}
					</div>
				{:else}
					<div class="no-headlines">No headlines captured for this narrative</div>
				{/if}
			</div>
		</div>
	{/if}
</Modal>

<style>
	.narrative-content {
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
		font-size: 0.5625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--accent);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		margin-bottom: 0.4rem;
	}

	.narrative-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border-divider);
		background: none;
		border-left: none;
		border-right: none;
		border-top: none;
	}

	.narrative-item:last-child {
		border-bottom: none;
	}

	.clickable {
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.clickable:hover {
		background: rgba(6, 182, 212, 0.05);
	}

	.clickable:focus {
		outline: 1px solid rgba(6, 182, 212, 0.3);
		outline-offset: 2px;
	}

	.narrative-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.2rem;
	}

	.narrative-name {
		font-size: 0.65rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.narrative-meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.15rem;
	}

	.mention-count {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-secondary);
	}

	.narrative-sources {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
	}

	.crossover-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.35rem 0.5rem;
		border-left: 2px solid var(--warning);
		border-top: none;
		border-right: none;
		border-bottom: none;
		margin: 0.25rem 0;
		background: var(--warning-bg);
		border-radius: 2px;
	}

	.crossover-narrative {
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.crossover-path {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		margin: 0.15rem 0;
	}

	.crossover-path .from {
		color: var(--text-secondary);
	}

	.crossover-path .arrow {
		color: var(--warning);
	}

	.crossover-path .to {
		color: var(--success);
	}

	.crossover-level {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
	}

	.themes-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.theme-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.4rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-secondary);
	}

	.theme-tag:hover {
		border-color: rgba(6, 182, 212, 0.5);
	}

	.theme-count {
		font-size: 0.5rem;
		color: var(--accent);
		background: rgba(34, 211, 238, 0.1);
		padding: 0.1rem 0.2rem;
		border-radius: 2px;
	}

	.disinfo-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.3rem 0;
		background: none;
		border: none;
	}

	.disinfo-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.disinfo-name {
		font-size: 0.625rem;
		color: var(--text-primary);
	}

	.disinfo-meta {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		margin-top: 0.1rem;
	}

	.empty-state {
		text-align: center;
		color: var(--text-dim);
		font-size: 0.65rem;
		padding: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	/* Modal Detail Styles */
	.detail-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.detail-type {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.type-label {
		font-size: 0.6875rem;
		font-weight: 600;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.detail-stats {
		display: flex;
		gap: 1rem;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(51, 65, 85, 0.5);
		border-radius: 2px;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(6, 182, 212);
	}

	.stat-value.fringe {
		color: rgb(148, 163, 184);
	}

	.stat-value.mainstream {
		color: rgb(16, 185, 129);
	}

	.stat-value.crossover {
		color: rgb(251, 191, 36);
	}

	.stat-label {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148, 163, 184);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 0.25rem;
	}

	.detail-section {
		border-top: 1px solid rgba(51, 65, 85, 0.5);
		padding-top: 0.75rem;
	}

	.detail-section-title {
		font-size: 0.5625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(6, 182, 212);
		text-transform: uppercase;
		letter-spacing: 0.15em;
		margin-bottom: 0.5rem;
	}

	.keywords-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.keyword-tag {
		padding: 0.25rem 0.5rem;
		background: rgba(6, 182, 212, 0.1);
		border: 1px solid rgba(6, 182, 212, 0.3);
		border-radius: 2px;
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(34, 211, 238);
	}

	.sources-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.source-tag {
		padding: 0.25rem 0.5rem;
		background: rgba(51, 65, 85, 0.3);
		border: 1px solid rgba(51, 65, 85, 0.5);
		border-radius: 2px;
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148, 163, 184);
	}

	.news-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.news-item-link {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.625rem;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(51, 65, 85, 0.5);
		border-radius: 2px;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.news-item-link:hover {
		background: rgba(15, 23, 42, 0.8);
		border-color: rgba(6, 182, 212, 0.5);
	}

	.news-item-content {
		flex: 1;
		min-width: 0;
	}

	.news-item-title {
		font-size: 0.6875rem;
		font-weight: 500;
		color: rgb(226, 232, 240);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.news-item-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.375rem;
	}

	.news-source {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(6, 182, 212);
	}

	.news-time {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100, 116, 139);
	}

	.news-item-arrow {
		flex-shrink: 0;
		color: rgb(100, 116, 139);
		transition: color 0.15s ease;
	}

	.news-item-link:hover .news-item-arrow {
		color: rgb(6, 182, 212);
	}

	.no-headlines {
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100, 116, 139);
		text-align: center;
		padding: 1rem;
		background: rgba(15, 23, 42, 0.3);
		border-radius: 2px;
	}
</style>
