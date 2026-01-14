<script lang="ts">
	import { Panel, HeatmapCell } from '$lib/components/common';
	import { sectors } from '$lib/stores';

	const items = $derived($sectors.items);
	const loading = $derived($sectors.loading);
	const error = $derived($sectors.error);
</script>

<Panel id="heatmap" title="Sector Heatmap" {loading} {error}>
	{#if items.length === 0 && !loading && !error}
		<div class="heatmap-empty">No sector data available</div>
	{:else}
		<div class="heatmap-grid">
			{#each items as sector (sector.symbol)}
				<HeatmapCell {sector} />
			{/each}
		</div>
	{/if}
</Panel>

<style>
	.heatmap-empty {
		text-align: center;
		font-size: var(--fs-sm); /* 10px → 12px responsive */
		color: rgb(148 163 184); /* slate-400 */
		padding: 1rem;
		line-height: var(--lh-normal);
	}

	.heatmap-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
	}

	@media (max-width: 400px) {
		.heatmap-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
