<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { timeAgo } from '$lib/utils';

	interface Layoff {
		company: string;
		count?: string | number;
		title: string;
		date: string;
	}

	interface Props {
		layoffs?: Layoff[];
		loading?: boolean;
		error?: string | null;
	}

	let { layoffs = [], loading = false, error = null }: Props = $props();

	const count = $derived(layoffs.length);
</script>

<Panel id="layoffs" title="Layoffs Tracker" {count} {loading} {error} skeletonType="layoff" skeletonCount={4}>
	{#if layoffs.length === 0 && !loading && !error}
		<div class="layoffs-empty">No recent layoffs data</div>
	{:else}
		<div class="layoffs-list">
			{#each layoffs as layoff, i (layoff.company + i)}
				<div class="layoff-item">
					<div class="layoff-company">{layoff.company}</div>
					{#if layoff.count}
						<div class="layoff-count">
							{typeof layoff.count === 'string'
								? parseInt(layoff.count).toLocaleString()
								: layoff.count.toLocaleString()} jobs
						</div>
					{/if}
					<div class="layoff-footer">
						<span class="layoff-title">{layoff.title}</span>
						<span class="layoff-date">{timeAgo(layoff.date)}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.layoffs-empty {
		text-align: center;
		color: rgb(148 163 184); /* slate-400 */
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.layoffs-list {
		display: flex;
		flex-direction: column;
	}

	.layoff-item {
		padding: 0.5rem 0;
		border-bottom: 1px solid rgb(30 41 59); /* slate-800 */
		transition: background-color 0.15s;
	}

	.layoff-item:last-child {
		border-bottom: none;
	}

	.layoff-item:hover {
		background: rgb(255 255 255 / 0.05);
	}

	.layoff-company {
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		font-weight: 700;
		color: white;
		margin-bottom: 0.125rem;
		line-height: var(--lh-tight);
	}

	.layoff-count {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(239 68 68); /* red-500 */
		font-variant-numeric: tabular-nums;
		margin-bottom: 0.25rem;
		line-height: var(--lh-tight);
	}

	.layoff-footer {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.layoff-title {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		color: rgb(148 163 184); /* slate-400 */
		line-height: var(--lh-snug);
		flex: 1;
	}

	.layoff-date {
		font-size: var(--fs-xs); /* 9px → 10px responsive */
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139); /* slate-500 */
		white-space: nowrap;
		line-height: var(--lh-tight);
	}
</style>
