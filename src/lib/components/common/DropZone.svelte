<script lang="ts">
	import type { Snippet } from 'svelte';
	import { panelLayout, isDragging, currentDropTarget, type PanelZone } from '$lib/stores';
	import type { PanelId } from '$lib/config';

	interface Props {
		zone: PanelZone;
		panels: PanelId[];
		class?: string;
		children: Snippet;
	}

	// @ts-expect-error - panels prop used for reactivity trigger
	let { zone, panels, class: className = '', children }: Props = $props();

	// Track if this zone is the current drop target
	let isOver = $state(false);
	let dropIndex = $state(0);
	let indicatorPosition = $state(0); // Pixel position for the indicator

	const isTargeted = $derived($currentDropTarget?.zone === zone && $isDragging);
	const isHorizontal = $derived(zone === 'bottom');

	// Calculate drop index based on actual panel positions in the DOM
	function calculateDropPosition(event: DragEvent, container: HTMLElement): { index: number; position: number } {
		const panelElements = container.querySelectorAll('[data-panel-id]');
		const mousePos = isHorizontal ? event.clientX : event.clientY;
		const containerRect = container.getBoundingClientRect();
		const containerStart = isHorizontal ? containerRect.left : containerRect.top;

		// If no panels, drop at start
		if (panelElements.length === 0) {
			return { index: 0, position: 0 };
		}

		// Find the insertion point by checking panel boundaries
		let insertIndex = 0;
		let insertPosition = 0;

		for (let i = 0; i < panelElements.length; i++) {
			const panel = panelElements[i] as HTMLElement;
			const rect = panel.getBoundingClientRect();
			const panelStart = isHorizontal ? rect.left : rect.top;
			const panelEnd = isHorizontal ? rect.right : rect.bottom;
			const panelMid = (panelStart + panelEnd) / 2;

			if (mousePos < panelMid) {
				// Insert before this panel
				insertIndex = i;
				insertPosition = panelStart - containerStart;
				break;
			} else {
				// Potentially insert after this panel
				insertIndex = i + 1;
				insertPosition = panelEnd - containerStart;
			}
		}

		// Clamp position to container bounds
		const maxPosition = isHorizontal
			? containerRect.width
			: containerRect.height;
		insertPosition = Math.max(0, Math.min(insertPosition, maxPosition));

		return { index: insertIndex, position: insertPosition };
	}

	function handleDragOver(event: DragEvent) {
		if (!$isDragging) return;

		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}

		isOver = true;

		const container = event.currentTarget as HTMLElement;
		const { index, position } = calculateDropPosition(event, container);

		dropIndex = index;
		indicatorPosition = position;

		panelLayout.setDropTarget(zone, dropIndex);
	}

	function handleDragLeave(event: DragEvent) {
		// Only handle if leaving the container (not a child)
		const relatedTarget = event.relatedTarget as Node | null;
		const currentTarget = event.currentTarget as HTMLElement;

		if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
			isOver = false;
			panelLayout.clearDropTarget();
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isOver = false;

		// The endDrag will handle the actual move
		panelLayout.endDrag();
	}
</script>

<div
	class="drop-zone {className}"
	class:is-over={isOver && $isDragging}
	class:is-targeted={isTargeted}
	class:is-dragging={$isDragging}
	class:horizontal={isHorizontal}
	data-zone={zone}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	role="list"
	aria-label="{zone} panel zone"
>
	{@render children()}

	<!-- Drop indicator - shows exact position where panel will be inserted -->
	{#if isOver && $isDragging}
		<div
			class="drop-indicator"
			class:horizontal={isHorizontal}
			style={isHorizontal
				? `left: ${indicatorPosition}px`
				: `top: ${indicatorPosition}px`}
		>
			<div class="drop-indicator-line"></div>
			<div class="drop-indicator-label">
				<span class="drop-indicator-icon">▼</span>
				<span class="drop-indicator-text">INSERT HERE</span>
				<span class="drop-indicator-icon">▼</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.drop-zone {
		position: relative;
		min-height: 100px;
		transition: all 0.2s ease;
	}

	.drop-zone.is-dragging {
		/* Subtle highlight when any drag is in progress */
		opacity: 1;
	}

	.drop-zone.is-over {
		background: rgba(34, 211, 238, 0.03);
		border-radius: 4px;
	}

	.drop-zone.is-targeted {
		outline: 2px dashed rgba(34, 211, 238, 0.4);
		outline-offset: 4px;
	}

	/* Drop indicator - positioned at exact insertion point */
	.drop-indicator {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		pointer-events: none;
		z-index: 1000;
		transition: left 0.1s ease, top 0.1s ease;
	}

	/* Vertical zones (left/right) - horizontal line indicator */
	.drop-indicator:not(.horizontal) {
		left: 0;
		right: 0;
		transform: translateY(-50%);
	}

	/* Horizontal zone (bottom) - vertical line indicator */
	.drop-indicator.horizontal {
		top: 0;
		bottom: 0;
		transform: translateX(-50%);
		flex-direction: column;
		justify-content: center;
	}

	/* The visible line */
	.drop-indicator-line {
		background: rgb(34 211 238);
		box-shadow: 0 0 12px rgb(34 211 238 / 0.8), 0 0 24px rgb(34 211 238 / 0.4);
		border-radius: 2px;
	}

	.drop-indicator:not(.horizontal) .drop-indicator-line {
		width: 100%;
		height: 3px;
	}

	.drop-indicator.horizontal .drop-indicator-line {
		width: 3px;
		height: 100%;
		min-height: 60px;
	}

	/* Label container */
	.drop-indicator-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgb(15 23 42 / 0.95);
		border: 1px solid rgb(34 211 238);
		padding: 0.25rem 0.75rem;
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 8px rgb(34 211 238 / 0.3);
		margin-top: 0.25rem;
	}

	.drop-indicator.horizontal .drop-indicator-label {
		margin-top: 0;
		margin-left: 0.25rem;
		flex-direction: column;
		padding: 0.5rem 0.375rem;
	}

	.drop-indicator.horizontal .drop-indicator-label .drop-indicator-text {
		writing-mode: vertical-rl;
		text-orientation: mixed;
	}

	.drop-indicator.horizontal .drop-indicator-label .drop-indicator-icon {
		transform: rotate(-90deg);
	}

	.drop-indicator-icon {
		color: rgb(34 211 238);
		font-size: 0.625rem;
		animation: bounce 0.6s ease-in-out infinite;
	}

	.drop-indicator-icon:last-child {
		animation-delay: 0.1s;
	}

	@keyframes bounce {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(2px); }
	}

	.drop-indicator.horizontal .drop-indicator-icon {
		animation: bounce-horizontal 0.6s ease-in-out infinite;
	}

	@keyframes bounce-horizontal {
		0%, 100% { transform: rotate(-90deg) translateY(0); }
		50% { transform: rotate(-90deg) translateY(2px); }
	}

	.drop-indicator-text {
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		color: rgb(34 211 238);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		white-space: nowrap;
	}
</style>
