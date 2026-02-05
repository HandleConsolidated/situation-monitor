<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { timeAgo } from '$lib/utils';
	import type { PanelId } from '$lib/config';
	import type { NewsItem } from '$lib/types';

	interface SituationConfig {
		title: string;
		subtitle: string;
		criticalKeywords?: string[];
	}

	interface Props {
		panelId: PanelId;
		config: SituationConfig;
		news?: NewsItem[];
		loading?: boolean;
		error?: string | null;
		onEdit?: () => void;
	}

	let { panelId, config, news = [], loading = false, error = null, onEdit }: Props = $props();

	// Calculate threat level based on news
	const threatLevel = $derived(calculateThreatLevel(news, config.criticalKeywords));

	function calculateThreatLevel(
		newsItems: NewsItem[],
		criticalKeywords: string[] = []
	): { level: string; text: string } {
		if (newsItems.length === 0) {
			return { level: 'monitoring', text: 'MONITORING' };
		}

		const now = Date.now();
		const recentNews = newsItems.filter((n) => {
			const hoursSince = (now - n.timestamp) / (1000 * 60 * 60);
			return hoursSince < 24;
		});

		const hasCritical = newsItems.some((n) =>
			criticalKeywords.some((k) => n.title.toLowerCase().includes(k))
		);

		if (hasCritical || recentNews.length >= 3) {
			return { level: 'critical', text: 'CRITICAL' };
		}
		if (recentNews.length >= 1) {
			return { level: 'elevated', text: 'ELEVATED' };
		}
		return { level: 'monitoring', text: 'MONITORING' };
	}
</script>

<Panel
	id={panelId}
	title={config.title}
	status={threatLevel.text}
	statusClass={threatLevel.level}
	{loading}
	{error}
>
	{#snippet actions()}
		{#if onEdit}
			<button class="edit-btn" onclick={onEdit} aria-label="Configure crisis watch" title="Configure">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		{/if}
	{/snippet}
	<div class="situation-container">
		<div class="situation-header">
			<div class="situation-title">{config.title}</div>
			<div class="situation-subtitle">{config.subtitle}</div>
		</div>

		{#if news.length === 0 && !loading && !error}
			<div class="situation-empty">No recent news</div>
		{:else}
			<div class="situation-list">
				{#each news.slice(0, 8) as item (item.id)}
					<div class="situation-item">
						<a href={item.link} target="_blank" rel="noopener noreferrer" class="situation-link">
							{item.title}
						</a>
						<div class="situation-meta">{item.source} · {timeAgo(item.timestamp)}</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Panel>

<style>
	.situation-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.situation-header {
		text-align: center;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
	}

	.situation-title {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 600;
		color: var(--text-primary);
		line-height: var(--lh-snug);
	}

	.situation-subtitle {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		color: var(--text-secondary);
		margin-top: 0.125rem;
		line-height: var(--lh-snug);
	}

	.situation-empty {
		text-align: center;
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		color: var(--text-secondary);
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.situation-list {
		display: flex;
		flex-direction: column;
	}

	.situation-item {
		padding: 0.375rem 0;
		border-bottom: 1px solid var(--border);
	}

	.situation-item:last-child {
		border-bottom: none;
	}

	.situation-link {
		display: block;
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		color: var(--text-primary);
		text-decoration: none;
		line-height: var(--lh-snug);
		transition: color 0.15s;
	}

	.situation-link:hover {
		color: var(--accent);
	}

	.situation-meta {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		color: var(--text-muted);
		margin-top: 0.125rem;
		line-height: var(--lh-tight);
	}

	.edit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		background: rgb(15 23 42 / 0.8);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		cursor: pointer;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.edit-btn:hover {
		color: rgb(34 211 238);
		border-color: rgb(34 211 238 / 0.5);
		background: rgb(34 211 238 / 0.1);
	}
</style>
