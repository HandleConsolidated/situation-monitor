<script lang="ts">
	import Modal from './Modal.svelte';
	import { Badge } from '$lib/components/common';
	import { timeAgo } from '$lib/utils';
	import type { CustomMonitor } from '$lib/types';
	import type { MonitorMatch } from '$lib/stores/monitors';

	interface Props {
		open: boolean;
		onClose: () => void;
		monitor: CustomMonitor | null;
		matches: MonitorMatch[];
		onEdit?: (monitor: CustomMonitor) => void;
	}

	let { open = false, onClose, monitor, matches = [], onEdit }: Props = $props();

	// Filter matches to only show those for this monitor
	const monitorMatches = $derived(
		monitor ? matches.filter((m) => m.monitor.id === monitor.id) : []
	);

	// Sort matches by timestamp (newest first)
	const sortedMatches = $derived(
		[...monitorMatches].sort((a, b) => b.item.timestamp - a.item.timestamp)
	);

	// Format creation date
	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<Modal {open} title={monitor?.name || 'Monitor Details'} {onClose} size="large">
	{#if monitor}
		<div class="monitor-info">
			<div class="monitor-header-row">
				<div class="monitor-header-info">
					{#if monitor.color}
						<span
							class="monitor-color"
							style="background: {monitor.color}; box-shadow: 0 0 12px {monitor.color}"
						></span>
					{/if}
					<span class="monitor-name">{monitor.name}</span>
					{#if monitorMatches.length > 0}
						<Badge text="{monitorMatches.length} MATCHES" variant="info" />
					{/if}
					<Badge text={monitor.enabled ? 'ACTIVE' : 'DISABLED'} variant={monitor.enabled ? 'success' : 'default'} />
				</div>
				{#if onEdit}
					<button class="edit-btn" onclick={() => { onClose(); onEdit(monitor); }}>
						EDIT
					</button>
				{/if}
			</div>

			<div class="monitor-details">
				<div class="detail-row">
					<span class="detail-label">KEYWORDS</span>
					<div class="monitor-keywords">
						{#each monitor.keywords as keyword}
							<span class="keyword">{keyword}</span>
						{/each}
					</div>
				</div>

				{#if monitor.location}
					<div class="detail-row">
						<span class="detail-label">LOCATION</span>
						<div class="location-info">
							<span class="location-name">📍 {monitor.location.name}</span>
							<span class="location-coords">{monitor.location.lat.toFixed(4)}, {monitor.location.lon.toFixed(4)}</span>
						</div>
					</div>
				{/if}

				<div class="detail-row">
					<span class="detail-label">CREATED</span>
					<span class="detail-value">{formatDate(monitor.createdAt)}</span>
				</div>
			</div>
		</div>

		{#if sortedMatches.length === 0}
			<div class="empty-state">
				<p>No matches found for this monitor</p>
				<p class="hint">Try adjusting your keywords or wait for new news items</p>
			</div>
		{:else}
			<div class="matches-list">
				{#each sortedMatches as match (match.item.id)}
					<div class="match-item">
						<div class="match-header">
							<span class="match-source">{match.item.source}</span>
							<span class="match-time">{timeAgo(match.item.timestamp)}</span>
						</div>
						<a
							href={match.item.link}
							target="_blank"
							rel="noopener noreferrer"
							class="match-title"
						>
							{match.item.title}
						</a>
						{#if match.item.description}
							<p class="match-description">
								{match.item.description.length > 200
									? match.item.description.substring(0, 200) + '...'
									: match.item.description}
							</p>
						{/if}
						<div class="match-meta">
							<div class="matched-keywords">
								<span class="meta-label">Matched:</span>
								{#each match.matchedKeywords as kw}
									<span class="matched-keyword">{kw}</span>
								{/each}
							</div>
							<Badge text={match.item.category.toUpperCase()} variant="default" />
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</Modal>

<style>
	.monitor-info {
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-divider, rgb(30 41 59));
	}

	.monitor-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.monitor-header-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.monitor-color {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.monitor-name {
		font-size: var(--fs-lg, 14px);
		font-weight: 700;
		color: var(--text-primary, white);
	}

	.edit-btn {
		font-size: var(--fs-2xs, 9px);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		letter-spacing: 0.05em;
		padding: 0.375rem 0.75rem;
		background: transparent;
		border: 1px solid var(--border, rgb(51 65 85));
		border-radius: 2px;
		color: var(--text-secondary, rgb(148 163 184));
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.edit-btn:hover {
		background: var(--surface-hover, rgb(30 41 59 / 0.5));
		border-color: var(--accent, rgb(34 211 238));
		color: var(--accent, rgb(34 211 238));
	}

	.monitor-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.detail-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.detail-label {
		font-size: var(--fs-2xs, 9px);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		letter-spacing: 0.05em;
		color: var(--text-muted, rgb(71 85 105));
		min-width: 70px;
		flex-shrink: 0;
	}

	.detail-value {
		font-size: var(--fs-xs, 10px);
		color: var(--text-secondary, rgb(148 163 184));
	}

	.location-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.location-name {
		font-size: var(--fs-xs, 10px);
		color: var(--text-secondary, rgb(148 163 184));
	}

	.location-coords {
		font-size: var(--fs-2xs, 9px);
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted, rgb(71 85 105));
	}

	.monitor-keywords {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.keyword {
		font-size: var(--fs-2xs, 9px);
		font-family: 'SF Mono', Monaco, monospace;
		padding: 0.125rem 0.375rem;
		background: var(--interactive-bg, rgb(30 41 59 / 0.5));
		border: 1px solid var(--border, rgb(51 65 85));
		border-radius: 2px;
		color: var(--text-secondary, rgb(148 163 184));
	}

	.empty-state {
		text-align: center;
		padding: 2rem;
		color: var(--text-dim, rgb(100 116 139));
	}

	.empty-state p {
		margin: 0.25rem 0;
	}

	.empty-state .hint {
		font-size: var(--fs-xs, 10px);
		color: var(--text-muted, rgb(71 85 105));
	}

	.matches-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.match-item {
		padding: 0.75rem;
		background: var(--card-bg, rgb(15 23 42 / 0.5));
		border: 1px solid var(--border, rgb(51 65 85 / 0.5));
		border-radius: 2px;
		transition: border-color 0.15s;
	}

	.match-item:hover {
		border-color: var(--accent-border, rgb(34 211 238 / 0.5));
	}

	.match-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.375rem;
	}

	.match-source {
		font-size: var(--fs-2xs, 9px);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		color: var(--text-dim, rgb(100 116 139));
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.match-time {
		font-size: var(--fs-2xs, 9px);
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted, rgb(71 85 105));
	}

	.match-title {
		display: block;
		font-size: var(--fs-sm, 12px);
		font-weight: 600;
		color: var(--text, rgb(226 232 240));
		text-decoration: none;
		line-height: var(--lh-snug, 1.375);
		margin-bottom: 0.375rem;
		transition: color 0.15s;
	}

	.match-title:hover {
		color: var(--accent, rgb(34 211 238));
	}

	.match-description {
		font-size: var(--fs-xs, 10px);
		color: var(--text-secondary, rgb(148 163 184));
		line-height: var(--lh-normal, 1.5);
		margin: 0 0 0.5rem 0;
	}

	.match-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.matched-keywords {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.meta-label {
		font-size: var(--fs-2xs, 9px);
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted, rgb(71 85 105));
	}

	.matched-keyword {
		font-size: var(--fs-2xs, 9px);
		font-family: 'SF Mono', Monaco, monospace;
		padding: 0.0625rem 0.25rem;
		background: var(--warning-bg, rgb(251 191 36 / 0.1));
		border: 1px solid var(--warning-border, rgb(251 191 36 / 0.3));
		border-radius: 2px;
		color: var(--warning, rgb(251 191 36));
	}
</style>
