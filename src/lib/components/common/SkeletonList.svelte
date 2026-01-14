<script lang="ts">
	/**
	 * SkeletonList - Pre-built skeleton patterns for common panel content
	 *
	 * Provides ready-to-use skeleton layouts that match the actual content
	 * structure of various panel types in the application.
	 */

	import Skeleton from './Skeleton.svelte';

	interface Props {
		/** Type of skeleton pattern to display */
		type?: 'news' | 'market' | 'crypto' | 'contract' | 'prediction' | 'monitor' | 'whale' | 'layoff' | 'grid' | 'generic';
		/** Number of skeleton items to show */
		count?: number;
		/** Custom CSS class */
		class?: string;
	}

	let {
		type = 'generic',
		count = 4,
		class: className = ''
	}: Props = $props();

	// Create array for iteration
	const items = $derived(Array(count).fill(null));
</script>

<div class="skeleton-list {className}">
	{#if type === 'news'}
		<!-- News item skeleton: title + source/time + category badge -->
		{#each items as _, i}
			<div class="skeleton-news-item" style="animation-delay: {i * 0.1}s">
				<div class="skeleton-news-header">
					<Skeleton variant="badge" width="50px" height="16px" />
					<Skeleton variant="line" width="80px" height="10px" />
				</div>
				<Skeleton variant="text" lines={2} randomWidth={true} />
				<div class="skeleton-news-meta">
					<Skeleton variant="line" width="100px" height="9px" />
				</div>
			</div>
		{/each}

	{:else if type === 'market'}
		<!-- Market/Index item: symbol + name + price + change -->
		{#each items as _, i}
			<div class="skeleton-market-item" style="animation-delay: {i * 0.1}s">
				<div class="skeleton-market-info">
					<Skeleton variant="line" width="45px" height="14px" />
					<Skeleton variant="line" width="90px" height="10px" />
				</div>
				<div class="skeleton-market-data">
					<Skeleton variant="line" width="70px" height="14px" />
					<Skeleton variant="badge" width="55px" height="18px" />
				</div>
			</div>
		{/each}

	{:else if type === 'crypto'}
		<!-- Crypto item: icon + name + price + change -->
		{#each items as _, i}
			<div class="skeleton-crypto-item" style="animation-delay: {i * 0.1}s">
				<div class="skeleton-crypto-left">
					<Skeleton variant="circle" width="28px" />
					<div class="skeleton-crypto-name">
						<Skeleton variant="line" width="50px" height="12px" />
						<Skeleton variant="line" width="30px" height="9px" />
					</div>
				</div>
				<div class="skeleton-crypto-right">
					<Skeleton variant="line" width="75px" height="14px" />
					<Skeleton variant="badge" width="50px" height="16px" />
				</div>
			</div>
		{/each}

	{:else if type === 'contract'}
		<!-- Contract item: agency + title + amount -->
		{#each items as _, i}
			<div class="skeleton-contract-item" style="animation-delay: {i * 0.1}s">
				<div class="skeleton-contract-header">
					<Skeleton variant="badge" width="65px" height="16px" />
					<Skeleton variant="line" width="85px" height="12px" />
				</div>
				<Skeleton variant="text" lines={2} randomWidth={true} />
				<Skeleton variant="line" width="95px" height="14px" />
			</div>
		{/each}

	{:else if type === 'prediction'}
		<!-- Prediction item: title + probability bar + odds -->
		{#each items as _, i}
			<div class="skeleton-prediction-item" style="animation-delay: {i * 0.1}s">
				<Skeleton variant="text" lines={2} randomWidth={true} />
				<div class="skeleton-prediction-bar">
					<Skeleton variant="rect" width="100%" height="6px" />
				</div>
				<div class="skeleton-prediction-odds">
					<Skeleton variant="badge" width="45px" height="18px" />
					<Skeleton variant="badge" width="45px" height="18px" />
				</div>
			</div>
		{/each}

	{:else if type === 'monitor'}
		<!-- Monitor item: status dot + name + description -->
		{#each items as _, i}
			<div class="skeleton-monitor-item" style="animation-delay: {i * 0.1}s">
				<Skeleton variant="circle" width="10px" />
				<div class="skeleton-monitor-content">
					<Skeleton variant="line" width="120px" height="12px" />
					<Skeleton variant="line" width="180px" height="9px" />
				</div>
				<Skeleton variant="badge" width="55px" height="16px" />
			</div>
		{/each}

	{:else if type === 'whale'}
		<!-- Whale transaction: type + amount + time -->
		{#each items as _, i}
			<div class="skeleton-whale-item" style="animation-delay: {i * 0.1}s">
				<Skeleton variant="circle" width="24px" />
				<div class="skeleton-whale-content">
					<Skeleton variant="line" width="100px" height="12px" />
					<Skeleton variant="line" width="70px" height="9px" />
				</div>
				<Skeleton variant="line" width="65px" height="14px" />
			</div>
		{/each}

	{:else if type === 'layoff'}
		<!-- Layoff item: company + count + date -->
		{#each items as _, i}
			<div class="skeleton-layoff-item" style="animation-delay: {i * 0.1}s">
				<div class="skeleton-layoff-info">
					<Skeleton variant="line" width="110px" height="13px" />
					<Skeleton variant="line" width="80px" height="9px" />
				</div>
				<Skeleton variant="badge" width="60px" height="20px" />
			</div>
		{/each}

	{:else if type === 'grid'}
		<!-- Grid stress item: region + country + percentage + status -->
		{#each items as _, i}
			<div class="skeleton-grid-item" style="animation-delay: {i * 0.1}s">
				<div class="skeleton-grid-info">
					<Skeleton variant="line" width="100px" height="12px" />
					<Skeleton variant="line" width="70px" height="9px" />
				</div>
				<div class="skeleton-grid-data">
					<Skeleton variant="line" width="45px" height="16px" />
					<Skeleton variant="badge" width="55px" height="16px" />
				</div>
			</div>
		{/each}

	{:else}
		<!-- Generic skeleton: simple text blocks -->
		{#each items as _, i}
			<div class="skeleton-generic-item" style="animation-delay: {i * 0.1}s">
				<Skeleton variant="text" lines={2} randomWidth={true} />
			</div>
		{/each}
	{/if}
</div>

<style>
	.skeleton-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 0;
	}

	/* News skeleton */
	.skeleton-news-item {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
		border-left: 2px solid rgb(51 65 85 / 0.5);
	}

	.skeleton-news-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.skeleton-news-meta {
		margin-top: 2px;
	}

	/* Market skeleton */
	.skeleton-market-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
	}

	.skeleton-market-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.skeleton-market-data {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	/* Crypto skeleton */
	.skeleton-crypto-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
	}

	.skeleton-crypto-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.skeleton-crypto-name {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.skeleton-crypto-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	/* Contract skeleton */
	.skeleton-contract-item {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
		border-left: 2px solid rgb(51 65 85 / 0.5);
	}

	.skeleton-contract-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* Prediction skeleton */
	.skeleton-prediction-item {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
	}

	.skeleton-prediction-bar {
		margin: 4px 0;
	}

	.skeleton-prediction-odds {
		display: flex;
		justify-content: space-between;
	}

	/* Monitor skeleton */
	.skeleton-monitor-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
	}

	.skeleton-monitor-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	/* Whale skeleton */
	.skeleton-whale-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
	}

	.skeleton-whale-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	/* Layoff skeleton */
	.skeleton-layoff-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
	}

	.skeleton-layoff-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	/* Grid stress skeleton */
	.skeleton-grid-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
	}

	.skeleton-grid-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.skeleton-grid-data {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* Generic skeleton */
	.skeleton-generic-item {
		padding: 8px;
		background: rgb(15 23 42 / 0.3);
		border-radius: 4px;
	}

	/* Staggered animation entrance */
	.skeleton-list > * {
		opacity: 0;
		animation: fadeIn 0.3s ease-out forwards;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
