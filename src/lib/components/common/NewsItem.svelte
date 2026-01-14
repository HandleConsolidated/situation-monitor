<script lang="ts">
	import type { NewsItem } from '$lib/types';
	import { timeAgo } from '$lib/utils';

	interface Props {
		item: NewsItem;
		showSource?: boolean;
		showAlert?: boolean;
		showDescription?: boolean;
		compact?: boolean;
	}

	let {
		item,
		showSource = true,
		showAlert = true,
		showDescription = false,
		compact = false
	}: Props = $props();

	const isAlertItem = $derived(showAlert && item.isAlert);

	// Check if item is "new" (fetched within the last 60 seconds)
	const isNewItem = $derived(() => {
		if (!item.isNew) return false;
		if (!item.fetchedAt) return item.isNew;
		// Item stays "new" for 60 seconds after fetch
		return Date.now() - item.fetchedAt < 60000;
	});
</script>

<div
	class="news-item cursor-pointer transition-all hover:bg-white/5 {compact
		? 'py-1.5'
		: 'py-2'} {isAlertItem
		? 'bg-red-950/50 border-l-2 border-red-500 -mx-2 px-2 rounded-sm'
		: isNewItem()
			? 'bg-cyan-950/30 border-l-2 border-cyan-400 -mx-2 px-2 rounded-sm animate-fade-in'
			: 'border-b border-slate-800 last:border-b-0'}"
>
	{#if showSource}
		<div class="news-source">
			{item.source}
			{#if isAlertItem}
				<span class="news-badge news-badge--alert">ALERT</span>
			{:else if isNewItem()}
				<span class="news-badge news-badge--new animate-pulse">NEW</span>
			{/if}
		</div>
	{/if}

	<a
		class="news-title {compact ? 'news-title--compact' : ''}"
		href={item.link}
		target="_blank"
		rel="noopener noreferrer"
	>
		{item.title}
	</a>

	{#if showDescription && item.description}
		<p class="news-description">{item.description}</p>
	{/if}

	<div class="news-meta">
		<span class="news-timestamp">{timeAgo(item.timestamp)}</span>
		{#if item.region}
			<span class="news-region">{item.region}</span>
		{/if}
	</div>
</div>

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	:global(.animate-fade-in) {
		animation: fade-in 0.3s ease-out;
	}

	/* Responsive NewsItem styles using CSS custom properties */
	.news-source {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184); /* slate-400 */
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--sp-xs);
		display: flex;
		align-items: center;
		gap: var(--sp-sm);
		line-height: var(--lh-tight);
	}

	.news-badge {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: 2px;
		font-weight: 700;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
	}

	.news-badge--alert {
		background: rgb(220 38 38); /* red-600 */
		color: white;
	}

	.news-badge--new {
		background: rgb(8 145 178); /* cyan-600 */
		color: white;
	}

	.news-title {
		display: block;
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		line-height: var(--lh-snug);
		color: rgb(226 232 240); /* slate-200 */
		text-decoration: none;
		transition: color 0.15s;
	}

	.news-title:hover {
		color: rgb(34 211 238); /* cyan-400 */
	}

	.news-title--compact {
		font-size: var(--fs-md); /* 11px → 13px responsive */
	}

	.news-description {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		color: rgb(148 163 184); /* slate-400 */
		margin-top: var(--sp-sm);
		line-height: var(--lh-relaxed);
		border-left: 2px solid rgb(51 65 85); /* slate-700 */
		padding-left: var(--sp-md);
	}

	.news-meta {
		display: flex;
		align-items: center;
		gap: var(--sp-md);
		margin-top: var(--sp-xs);
	}

	.news-timestamp {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		line-height: var(--lh-tight);
	}

	.news-region {
		font-size: var(--fs-2xs); /* 8px → 9px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(34 211 238); /* cyan-400 */
		background: rgb(34 211 238 / 0.1);
		padding: var(--sp-xs) var(--sp-sm);
		border-radius: 2px;
		border: 1px solid rgb(34 211 238 / 0.3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: var(--lh-tight);
	}
</style>
