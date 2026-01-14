<script lang="ts">
	/**
	 * Skeleton - Animated placeholder for loading states
	 *
	 * Provides visual feedback while content is loading with a shimmer animation.
	 * Supports various shapes and sizes to match different content types.
	 */

	interface Props {
		/** Skeleton variant type */
		variant?: 'line' | 'text' | 'circle' | 'rect' | 'badge';
		/** Width - can be px, %, or 'full' */
		width?: string;
		/** Height - can be px or predefined sizes */
		height?: string;
		/** Number of lines for 'text' variant */
		lines?: number;
		/** Add slight random width variation to lines */
		randomWidth?: boolean;
		/** Custom CSS classes */
		class?: string;
	}

	let {
		variant = 'line',
		width = '100%',
		height,
		lines = 3,
		randomWidth = true,
		class: className = ''
	}: Props = $props();

	// Compute actual dimensions based on variant
	const computedHeight = $derived(() => {
		if (height) return height;
		switch (variant) {
			case 'line': return '12px';
			case 'text': return 'auto';
			case 'circle': return width; // Square for circle
			case 'rect': return '60px';
			case 'badge': return '20px';
			default: return '12px';
		}
	});

	const computedWidth = $derived(() => {
		if (width === 'full') return '100%';
		return width;
	});

	// Generate pseudo-random widths for text lines based on line index
	function getLineWidth(index: number, total: number): string {
		if (!randomWidth) return '100%';
		// Last line is typically shorter
		if (index === total - 1) return '60%';
		// Vary other lines between 85-100%
		const widths = ['100%', '95%', '88%', '92%', '85%'];
		return widths[index % widths.length];
	}
</script>

{#if variant === 'text'}
	<div class="skeleton-text {className}" style="width: {computedWidth()}">
		{#each Array(lines) as _, i}
			<div
				class="skeleton-line"
				style="width: {getLineWidth(i, lines)}; height: 10px;"
			></div>
		{/each}
	</div>
{:else if variant === 'circle'}
	<div
		class="skeleton-base skeleton-circle {className}"
		style="width: {computedWidth()}; height: {computedWidth()};"
	></div>
{:else if variant === 'badge'}
	<div
		class="skeleton-base skeleton-badge {className}"
		style="width: {computedWidth()}; height: {computedHeight()};"
	></div>
{:else}
	<div
		class="skeleton-base skeleton-{variant} {className}"
		style="width: {computedWidth()}; height: {computedHeight()};"
	></div>
{/if}

<style>
	/* Base skeleton with shimmer animation */
	.skeleton-base {
		background: linear-gradient(
			90deg,
			rgb(30 41 59 / 0.5) 0%,
			rgb(51 65 85 / 0.6) 50%,
			rgb(30 41 59 / 0.5) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
		border-radius: 2px;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Line variant - single horizontal bar */
	.skeleton-line {
		border-radius: 2px;
	}

	/* Text variant - multiple lines container */
	.skeleton-text {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-text .skeleton-line {
		background: linear-gradient(
			90deg,
			rgb(30 41 59 / 0.5) 0%,
			rgb(51 65 85 / 0.6) 50%,
			rgb(30 41 59 / 0.5) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s ease-in-out infinite;
		border-radius: 2px;
	}

	/* Circle variant */
	.skeleton-circle {
		border-radius: 50%;
	}

	/* Rectangle variant - for cards/images */
	.skeleton-rect {
		border-radius: 4px;
	}

	/* Badge variant - small pill shape */
	.skeleton-badge {
		border-radius: 10px;
	}
</style>
