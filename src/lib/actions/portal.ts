/**
 * Svelte action to portal an element to the document body
 * This ensures modals and overlays escape any CSS containment issues
 * caused by parent elements with transform, filter, or backdrop-filter
 */
export function portal(node: HTMLElement, target: HTMLElement = document.body) {
	// Move the node to the target
	target.appendChild(node);

	return {
		destroy() {
			// Clean up when component is destroyed
			if (node.parentNode) {
				node.parentNode.removeChild(node);
			}
		}
	};
}
