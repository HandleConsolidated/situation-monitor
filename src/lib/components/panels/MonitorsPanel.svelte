<script lang="ts">
	import { Panel, Badge } from '$lib/components/common';
	import { timeAgo } from '$lib/utils';
	import type { CustomMonitor } from '$lib/types';
	import type { MonitorMatch } from '$lib/stores/monitors';

	interface Props {
		monitors?: CustomMonitor[];
		matches?: MonitorMatch[];
		loading?: boolean;
		error?: string | null;
		onCreateMonitor?: () => void;
		onEditMonitor?: (monitor: CustomMonitor) => void;
		onDeleteMonitor?: (id: string) => void;
		onToggleMonitor?: (id: string) => void;
		onViewMatches?: (monitor: CustomMonitor) => void;
	}

	let {
		monitors = [],
		matches = [],
		loading = false,
		error = null,
		onCreateMonitor,
		onEditMonitor,
		onDeleteMonitor,
		onToggleMonitor,
		onViewMatches
	}: Props = $props();

	const activeMonitors = $derived(monitors.filter((m) => m.enabled));
	const count = $derived(matches.length);

	function getMatchesForMonitor(monitorId: string): MonitorMatch[] {
		return matches.filter((m) => m.monitor.id === monitorId).slice(0, 3);
	}
</script>

<Panel id="monitors" title="Custom Monitors" {count} {loading} {error} skeletonType="monitor" skeletonCount={3}>
	<div class="monitors-content">
		{#if monitors.length === 0 && !loading && !error}
			<div class="empty-state">
				<p class="text-[10px] sm:text-xs">No monitors configured</p>
				{#if onCreateMonitor}
					<button class="create-btn text-[10px] sm:text-xs" onclick={onCreateMonitor}> + CREATE MONITOR </button>
				{/if}
			</div>
		{:else}
			<div class="monitors-header">
				<span class="active-count text-[10px] sm:text-xs">{activeMonitors.length} ACTIVE</span>
				{#if onCreateMonitor}
					<button class="add-btn text-xs sm:text-sm" onclick={onCreateMonitor}>+</button>
				{/if}
			</div>

			<div class="monitors-list">
				{#each monitors as monitor (monitor.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
					<div
						class="monitor-item clickable"
						class:disabled={!monitor.enabled}
						onclick={() => onViewMatches?.(monitor)}
					>
						<div class="monitor-header">
								<div class="monitor-info">
								{#if monitor.color}
									<span
										class="monitor-color"
										style="background: {monitor.color}; box-shadow: 0 0 8px {monitor.color}"
									></span>
								{/if}
								<span class="monitor-name text-[10px] sm:text-xs">{monitor.name}</span>
								{#if monitor.matchCount > 0}
									<Badge text={String(monitor.matchCount)} variant="info" />
								{/if}
							</div>
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="monitor-actions" onclick={(e) => e.stopPropagation()}>
								{#if onToggleMonitor}
									<button
										class="action-btn text-[10px] sm:text-xs"
										class:active={monitor.enabled}
										onclick={() => onToggleMonitor?.(monitor.id)}
										title={monitor.enabled ? 'Disable' : 'Enable'}
									>
										{monitor.enabled ? '●' : '○'}
									</button>
								{/if}
								{#if onEditMonitor}
									<button class="action-btn text-[10px] sm:text-xs" onclick={() => onEditMonitor?.(monitor)} title="Edit">
										✎
									</button>
								{/if}
								{#if onDeleteMonitor}
									<button
										class="action-btn delete text-[10px] sm:text-xs"
										onclick={() => onDeleteMonitor?.(monitor.id)}
										title="Delete"
									>
										×
									</button>
								{/if}
							</div>
						</div>

						<div class="monitor-keywords">
							{#each monitor.keywords.slice(0, 5) as keyword}
								<span class="keyword">{keyword}</span>
							{/each}
							{#if monitor.keywords.length > 5}
								<span class="keyword more">+{monitor.keywords.length - 5}</span>
							{/if}
						</div>

						{#if monitor.location}
							<div class="monitor-location">
								📍 {monitor.location.name}
							</div>
						{/if}

						{#if getMatchesForMonitor(monitor.id).length > 0}
							<div class="monitor-matches">
								{#each getMatchesForMonitor(monitor.id) as match}
									<div class="match-item">
										<a
											href={match.item.link}
											target="_blank"
											rel="noopener noreferrer"
											class="match-title"
										>
											{match.item.title.length > 80
												? match.item.title.substring(0, 80) + '...'
												: match.item.title}
										</a>
										<div class="match-meta">
											<span class="match-keyword">"{match.matchedKeywords.join(', ')}"</span>
											<span class="match-time">{timeAgo(match.item.timestamp)}</span>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Panel>

<style>
	.monitors-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.monitors-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--border-divider);
	}

	.active-count {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
		letter-spacing: 0.1em;
		line-height: var(--lh-tight);
	}

	.add-btn {
		width: 1.2rem;
		height: 1.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-dim);
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	.monitors-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.monitor-item {
		padding: 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		transition: all 0.15s ease;
	}

	.monitor-item.clickable {
		cursor: pointer;
	}

	.monitor-item.clickable:hover {
		border-color: var(--accent-border);
		background: var(--surface-hover);
		box-shadow: 0 0 8px rgba(6, 182, 212, 0.15);
	}

	.monitor-item.disabled {
		opacity: 0.5;
	}

	.monitor-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.3rem;
	}

	.monitor-info {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex: 1;
		min-width: 0;
	}

	.monitor-color {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.monitor-name {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		color: var(--text-primary);
		line-height: var(--lh-snug);
	}

	.monitor-actions {
		display: flex;
		gap: 0.2rem;
	}

	.action-btn {
		width: 1rem;
		height: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		cursor: pointer;
		border-radius: 2px;
		transition: all 0.15s;
	}

	.action-btn:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
	}

	.action-btn.active {
		color: var(--success);
	}

	.action-btn.delete:hover {
		color: var(--danger);
	}

	.monitor-keywords {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		margin-bottom: 0.3rem;
	}

	.keyword {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		padding: 0.1rem 0.3rem;
		background: var(--interactive-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-secondary);
		line-height: var(--lh-tight);
	}

	.keyword.more {
		color: var(--text-muted);
	}

	.monitor-location {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		margin-bottom: 0.3rem;
		line-height: var(--lh-tight);
	}

	.monitor-matches {
		border-top: 1px solid var(--border-divider);
		padding-top: 0.3rem;
		margin-top: 0.2rem;
	}

	.match-item {
		padding: 0.2rem 0;
	}

	.match-title {
		display: block;
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		color: var(--text);
		text-decoration: none;
		line-height: var(--lh-snug);
		transition: color 0.15s;
	}

	.match-title:hover {
		color: var(--accent);
	}

	.match-meta {
		display: flex;
		justify-content: space-between;
		margin-top: 0.1rem;
	}

	.match-keyword {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--warning);
		line-height: var(--lh-tight);
	}

	.match-time {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		line-height: var(--lh-tight);
	}

	.empty-state {
		text-align: center;
		padding: 1rem;
	}

	.empty-state p {
		color: var(--text-dim);
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		line-height: var(--lh-normal);
	}

	.create-btn {
		padding: 0.4rem 0.8rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-dim);
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s;
		line-height: var(--lh-tight);
	}

	.create-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
