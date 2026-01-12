/**
 * Panel Layout Store - manages panel positions across zones
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { NON_DRAGGABLE_PANELS, type PanelId } from '$lib/config';

// Storage key
const STORAGE_KEY = 'panelLayoutPositions';

// Zone types
export type PanelZone = 'left' | 'right' | 'bottom';

// Panel position in a zone
export interface PanelPosition {
	zone: PanelZone;
	index: number;
}

// Layout state
export interface PanelLayoutState {
	positions: Record<PanelId, PanelPosition>;
	draggedPanel: PanelId | null;
	dropTarget: { zone: PanelZone; index: number } | null;
}

// Default panel positions - matching the current hardcoded layout
const DEFAULT_POSITIONS: Record<PanelId, PanelPosition> = {
	// Left column - News feeds
	politics: { zone: 'left', index: 0 },
	tech: { zone: 'left', index: 1 },
	finance: { zone: 'left', index: 2 },
	intel: { zone: 'left', index: 3 },
	correlation: { zone: 'left', index: 4 },
	narrative: { zone: 'left', index: 5 },

	// Right column - Analysis and situational panels
	gov: { zone: 'right', index: 0 },
	ai: { zone: 'right', index: 1 },
	polymarket: { zone: 'right', index: 2 },
	contracts: { zone: 'right', index: 3 },
	layoffs: { zone: 'right', index: 4 },
	leaders: { zone: 'right', index: 5 },

	// Bottom row - Financial panels (Money Printer, Whale Watch, Markets, Sector Heatmap, Crypto, Commodities)
	printer: { zone: 'bottom', index: 0 },
	whales: { zone: 'bottom', index: 1 },
	markets: { zone: 'bottom', index: 2 },
	heatmap: { zone: 'bottom', index: 3 },
	crypto: { zone: 'bottom', index: 4 },
	commodities: { zone: 'bottom', index: 5 },
	venezuela: { zone: 'bottom', index: 6 },
	greenland: { zone: 'bottom', index: 7 },
	iran: { zone: 'bottom', index: 8 },
	monitors: { zone: 'bottom', index: 9 },

	// Special panels (not in the drag-drop system)
	map: { zone: 'left', index: -1 },
	mainchar: { zone: 'left', index: -1 }
};

// Load from localStorage
function loadFromStorage(): Record<PanelId, PanelPosition> | null {
	if (!browser) return null;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (e) {
		console.warn('Failed to load panel layout from localStorage:', e);
	}
	return null;
}

// Save to localStorage
function saveToStorage(positions: Record<PanelId, PanelPosition>): void {
	if (!browser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
	} catch (e) {
		console.warn('Failed to save panel layout to localStorage:', e);
	}
}

// Create the store
function createPanelLayoutStore() {
	const savedPositions = loadFromStorage();

	const initialState: PanelLayoutState = {
		positions: savedPositions ?? { ...DEFAULT_POSITIONS },
		draggedPanel: null,
		dropTarget: null
	};

	const { subscribe, set, update } = writable<PanelLayoutState>(initialState);

	return {
		subscribe,

		/**
		 * Start dragging a panel
		 */
		startDrag(panelId: PanelId) {
			if (NON_DRAGGABLE_PANELS.includes(panelId)) return;

			update((state) => ({
				...state,
				draggedPanel: panelId
			}));
		},

		/**
		 * Update drop target during drag
		 */
		setDropTarget(zone: PanelZone, index: number) {
			update((state) => ({
				...state,
				dropTarget: { zone, index }
			}));
		},

		/**
		 * Clear drop target
		 */
		clearDropTarget() {
			update((state) => ({
				...state,
				dropTarget: null
			}));
		},

		/**
		 * End drag and drop panel at target
		 */
		endDrag() {
			update((state) => {
				if (!state.draggedPanel || !state.dropTarget) {
					return { ...state, draggedPanel: null, dropTarget: null };
				}

				const { zone: targetZone, index: targetIndex } = state.dropTarget;
				const draggedPanelId = state.draggedPanel;
				const currentPosition = state.positions[draggedPanelId];

				// Create new positions
				const newPositions = { ...state.positions };

				// Get all panels in the target zone, sorted by index
				const panelsInTargetZone = Object.entries(newPositions)
					.filter(([id, pos]) => pos.zone === targetZone && id !== draggedPanelId)
					.sort((a, b) => a[1].index - b[1].index)
					.map(([id]) => id as PanelId);

				// If moving within the same zone, just reorder
				if (currentPosition.zone === targetZone) {
					// Remove from current position and insert at target
					panelsInTargetZone.splice(targetIndex, 0, draggedPanelId);

					// Update indices
					panelsInTargetZone.forEach((id, idx) => {
						newPositions[id] = { zone: targetZone, index: idx };
					});
				} else {
					// Moving to a different zone
					// Update the source zone - re-index panels
					const panelsInSourceZone = Object.entries(newPositions)
						.filter(([id, pos]) => pos.zone === currentPosition.zone && id !== draggedPanelId)
						.sort((a, b) => a[1].index - b[1].index)
						.map(([id]) => id as PanelId);

					panelsInSourceZone.forEach((id, idx) => {
						newPositions[id] = { zone: currentPosition.zone, index: idx };
					});

					// Insert into target zone at the specified index
					panelsInTargetZone.splice(targetIndex, 0, draggedPanelId);

					// Update indices in target zone
					panelsInTargetZone.forEach((id, idx) => {
						newPositions[id] = { zone: targetZone, index: idx };
					});
				}

				// Save to storage
				saveToStorage(newPositions);

				return {
					...state,
					positions: newPositions,
					draggedPanel: null,
					dropTarget: null
				};
			});
		},

		/**
		 * Cancel drag
		 */
		cancelDrag() {
			update((state) => ({
				...state,
				draggedPanel: null,
				dropTarget: null
			}));
		},

		/**
		 * Move a panel to a specific zone and index
		 */
		movePanel(panelId: PanelId, targetZone: PanelZone, targetIndex: number) {
			if (NON_DRAGGABLE_PANELS.includes(panelId)) return;

			update((state) => {
				const newPositions = { ...state.positions };
				const currentPosition = newPositions[panelId];

				// Get panels in source zone (excluding the moving panel)
				const panelsInSourceZone = Object.entries(newPositions)
					.filter(([id, pos]) => pos.zone === currentPosition.zone && id !== panelId)
					.sort((a, b) => a[1].index - b[1].index)
					.map(([id]) => id as PanelId);

				// Re-index source zone
				panelsInSourceZone.forEach((id, idx) => {
					newPositions[id] = { zone: currentPosition.zone, index: idx };
				});

				// Get panels in target zone
				const panelsInTargetZone = Object.entries(newPositions)
					.filter(([id, pos]) => pos.zone === targetZone && id !== panelId)
					.sort((a, b) => a[1].index - b[1].index)
					.map(([id]) => id as PanelId);

				// Insert at target index
				panelsInTargetZone.splice(targetIndex, 0, panelId);

				// Re-index target zone
				panelsInTargetZone.forEach((id, idx) => {
					newPositions[id] = { zone: targetZone, index: idx };
				});

				saveToStorage(newPositions);
				return { ...state, positions: newPositions };
			});
		},

		/**
		 * Get panels in a specific zone, sorted by index
		 */
		getPanelsInZone(zone: PanelZone): PanelId[] {
			const state = get({ subscribe });
			return Object.entries(state.positions)
				.filter(([, pos]) => pos.zone === zone && pos.index >= 0)
				.sort((a, b) => a[1].index - b[1].index)
				.map(([id]) => id as PanelId);
		},

		/**
		 * Reset to default layout
		 */
		reset() {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
			set({
				positions: { ...DEFAULT_POSITIONS },
				draggedPanel: null,
				dropTarget: null
			});
		}
	};
}

// Export singleton store
export const panelLayout = createPanelLayoutStore();

// Derived stores for each zone
export const leftPanels = derived(panelLayout, ($layout) =>
	Object.entries($layout.positions)
		.filter(([, pos]) => pos.zone === 'left' && pos.index >= 0)
		.sort((a, b) => a[1].index - b[1].index)
		.map(([id]) => id as PanelId)
);

export const rightPanels = derived(panelLayout, ($layout) =>
	Object.entries($layout.positions)
		.filter(([, pos]) => pos.zone === 'right' && pos.index >= 0)
		.sort((a, b) => a[1].index - b[1].index)
		.map(([id]) => id as PanelId)
);

export const bottomPanels = derived(panelLayout, ($layout) =>
	Object.entries($layout.positions)
		.filter(([, pos]) => pos.zone === 'bottom' && pos.index >= 0)
		.sort((a, b) => a[1].index - b[1].index)
		.map(([id]) => id as PanelId)
);

export const isDragging = derived(panelLayout, ($layout) => $layout.draggedPanel !== null);
export const draggedPanelId = derived(panelLayout, ($layout) => $layout.draggedPanel);
export const currentDropTarget = derived(panelLayout, ($layout) => $layout.dropTarget);
