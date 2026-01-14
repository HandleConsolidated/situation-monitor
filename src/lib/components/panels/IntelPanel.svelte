<script lang="ts">
	import { Panel, Badge } from '$lib/components/common';
	import { getRelativeTime } from '$lib/utils';
	import { intelNews } from '$lib/stores';
	import type { NewsItem } from '$lib/types';

	type SourceType = 'osint' | 'govt' | 'think-tank' | 'defense' | 'regional' | 'cyber';

	interface IntelItem {
		id: string;
		title: string;
		link: string;
		source: string;
		sourceType: SourceType;
		regions: string[];
		topics: string[];
		pubDate?: string;
		isPriority?: boolean;
	}

	// Destructure store state for cleaner access
	const { items: storeItems, loading, error } = $derived($intelNews);

	// Infer source type from source name
	function inferSourceType(source: string): SourceType {
		const s = source.toLowerCase();
		if (s.includes('cisa') || s.includes('krebs') || s.includes('cyber')) return 'cyber';
		if (s.includes('bellingcat')) return 'osint';
		if (s.includes('defense') || s.includes('war') || s.includes('military')) return 'defense';
		if (s.includes('diplomat') || s.includes('monitor')) return 'regional';
		if (s.includes('white house') || s.includes('fed') || s.includes('sec') || s.includes('dod'))
			return 'govt';
		return 'think-tank';
	}

	// Transform NewsItem to IntelItem
	function transformToIntelItem(item: NewsItem): IntelItem {
		return {
			id: item.id,
			title: item.title,
			link: item.link,
			source: item.source,
			sourceType: inferSourceType(item.source),
			regions: item.region ? [item.region] : [],
			topics: item.topics || [],
			// Use numeric timestamp for reliable time display (already parsed correctly)
			pubDate: item.timestamp ? String(item.timestamp) : item.pubDate,
			isPriority: item.isAlert
		};
	}

	const items = $derived(storeItems.map(transformToIntelItem));
	const count = $derived(items.length);

	type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

	const SOURCE_BADGE_VARIANTS: Record<string, BadgeVariant> = {
		osint: 'info',
		govt: 'warning',
		cyber: 'danger'
	};

	function getSourceBadgeVariant(type: string): BadgeVariant {
		return SOURCE_BADGE_VARIANTS[type] ?? 'default';
	}
</script>

<Panel id="intel" title="Intel Feed" {count} {loading} {error}>
	{#if items.length === 0 && !loading && !error}
		<div class="empty-state">No intel available</div>
	{:else}
		<div class="intel-list">
			{#each items as item (item.id)}
				<div class="intel-item" class:priority={item.isPriority}>
					<div class="intel-header">
						<span class="intel-source">{item.source}</span>
						<div class="intel-tags">
							<Badge
								text={item.sourceType.toUpperCase()}
								variant={getSourceBadgeVariant(item.sourceType)}
							/>
							{#each item.regions.slice(0, 2) as region}
								<Badge text={region} variant="info" />
							{/each}
							{#each item.topics.slice(0, 2) as topic}
								<Badge text={topic} />
							{/each}
						</div>
					</div>
					<a href={item.link} target="_blank" rel="noopener noreferrer" class="intel-title">
						{item.title}
					</a>
					{#if item.pubDate && getRelativeTime(item.pubDate)}
						<div class="intel-meta">
							<span>{getRelativeTime(item.pubDate)}</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.intel-list {
		display: flex;
		flex-direction: column;
		overflow: hidden; /* Prevent horizontal overflow */
	}

	.intel-item {
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-divider);
		transition: background-color 0.15s;
		min-width: 0; /* Allow shrinking in flex context */
	}

	.intel-item:last-child {
		border-bottom: none;
	}

	.intel-item.priority {
		background: var(--warning-bg);
		margin: 0 -0.5rem;
		padding: 0.5rem;
		border-radius: 2px;
		border: 1px solid var(--warning-border);
	}

	.intel-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.3rem;
		gap: 0.5rem;
		min-width: 0; /* Allow shrinking */
	}

	.intel-source {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
		flex-shrink: 0; /* Don't shrink the source name */
		max-width: 40%; /* But limit its width */
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.intel-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		justify-content: flex-end;
		min-width: 0; /* Allow shrinking */
		flex-shrink: 1;
	}

	.intel-title {
		display: block;
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		color: var(--text);
		text-decoration: none;
		line-height: var(--lh-snug);
		transition: color 0.15s;
		overflow-wrap: break-word;
		word-break: break-word;
	}

	.intel-title:hover {
		color: var(--accent);
	}

	.intel-meta {
		margin-top: 0.25rem;
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
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
