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
	}

	let { panelId, config, news = [], loading = false, error = null }: Props = $props();

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
	<div class="flex flex-col gap-2">
		<div class="text-center pb-2 border-b border-[var(--border)]">
			<div class="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">{config.title}</div>
			<div class="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5">{config.subtitle}</div>
		</div>

		{#if news.length === 0 && !loading && !error}
			<div class="text-center text-[10px] sm:text-xs text-[var(--text-secondary)] p-4">No recent news</div>
		{:else}
			<div class="flex flex-col">
				{#each news.slice(0, 8) as item (item.id)}
					<div class="py-1.5 border-b border-[var(--border)] last:border-b-0">
						<a href={item.link} target="_blank" rel="noopener noreferrer" class="block text-[10px] sm:text-xs text-[var(--text-primary)] no-underline leading-snug hover:text-[var(--accent)]">
							{item.title}
						</a>
						<div class="text-[9px] sm:text-[10px] text-[var(--text-muted)] mt-0.5">{item.source} · {timeAgo(item.timestamp)}</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Panel>

<!-- Styles moved to Tailwind classes for responsive text sizing -->
