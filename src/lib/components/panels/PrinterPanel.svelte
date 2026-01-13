<script lang="ts">
	import { Panel } from '$lib/components/common';

	interface Props {
		data?: {
			value: number;
			change: number;
			changePercent: number;
			percentOfMax: number;
		} | null;
		loading?: boolean;
		error?: string | null;
	}

	let { data = null, loading = false, error = null }: Props = $props();

	const isExpanding = $derived(data && data.change > 0);
	const status = $derived(isExpanding ? 'PRINTER ON' : 'PRINTER OFF');
	const statusClass = $derived(isExpanding ? 'critical' : 'monitoring');
</script>

<Panel id="printer" title="Money Printer" {status} {statusClass} {loading} {error}>
	{#if !data && !loading && !error}
		<div class="text-center text-[10px] sm:text-xs text-[var(--text-secondary)] p-4">No Fed data available</div>
	{:else if data}
		<div class="text-center p-2">
			<div class="text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Federal Reserve Balance Sheet</div>
			<div class="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tabular-nums">
				{data.value.toFixed(2)}<span class="text-[10px] sm:text-xs font-normal text-[var(--text-secondary)] ml-1">T USD</span>
			</div>
			<div class="text-[10px] sm:text-xs font-medium my-1 mb-3 {isExpanding ? 'text-[var(--success)]' : 'text-[var(--danger)]'}">
				{data.change >= 0 ? '+' : ''}{(data.change * 1000).toFixed(0)}B ({data.changePercent >= 0
					? '+'
					: ''}{data.changePercent.toFixed(2)}%) WoW
			</div>
			<div class="printer-bar">
				<div class="printer-fill" style="width: {Math.min(data.percentOfMax, 100)}%"></div>
			</div>
			<div class="flex items-center justify-center gap-2 text-[10px] sm:text-xs font-semibold text-[var(--text-secondary)]">
				<span class="printer-indicator" class:on={isExpanding} class:off={!isExpanding}></span>
				{status}
			</div>
		</div>
	{/if}
</Panel>

<style>
	.printer-bar {
		height: 8px;
		background: var(--border);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 0.75rem;
	}

	.printer-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--success), var(--accent));
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.printer-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.printer-indicator.on {
		background: var(--success);
		box-shadow: 0 0 8px var(--success);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.printer-indicator.off {
		background: var(--danger);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
