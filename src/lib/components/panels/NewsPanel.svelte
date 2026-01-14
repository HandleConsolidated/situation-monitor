<script lang="ts">
	import { Panel, NewsItem } from '$lib/components/common';
	import type { NewsCategory } from '$lib/types';
	import type { PanelId } from '$lib/config';
	import { politicsNews, techNews, financeNews, govNews, aiNews, intelNews } from '$lib/stores';

	interface Props {
		category: NewsCategory;
		panelId: PanelId;
		title: string;
	}

	let { category, panelId, title }: Props = $props();

	// Get the appropriate derived store based on category
	const categoryStores = {
		politics: politicsNews,
		tech: techNews,
		finance: financeNews,
		gov: govNews,
		ai: aiNews,
		intel: intelNews
	};

	const categoryStore = $derived(categoryStores[category]);
	const items = $derived($categoryStore.items);
	const loading = $derived($categoryStore.loading);
	const error = $derived($categoryStore.error);
	const count = $derived(items.length);
</script>

<Panel id={panelId} {title} {count} {loading} {error} skeletonType="news" skeletonCount={5}>
	{#if items.length === 0 && !loading && !error}
		<div class="news-empty">No news available</div>
	{:else}
		<div class="news-list">
			{#each items.slice(0, 15) as item (item.id)}
				<NewsItem {item} />
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.news-empty {
		text-align: center;
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		color: var(--text-secondary);
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.news-list {
		display: flex;
		flex-direction: column;
	}
</style>
