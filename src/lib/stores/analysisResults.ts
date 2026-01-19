/**
 * Analysis Results Store
 * Shared stores for computed analysis results from various panels
 * These are used to provide context to AI analysis
 */

import { writable, derived } from 'svelte/store';
import type {
	CorrelationResult,
	NarrativeResult,
	MainCharacterResult
} from '$lib/types';

// ============================================================================
// Types
// ============================================================================

export interface AnalysisResultsState {
	correlations: CorrelationResult[];
	narratives: NarrativeResult[];
	mainCharacters: MainCharacterResult[];
	lastUpdated: {
		correlations: number | null;
		narratives: number | null;
		mainCharacters: number | null;
	};
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: AnalysisResultsState = {
	correlations: [],
	narratives: [],
	mainCharacters: [],
	lastUpdated: {
		correlations: null,
		narratives: null,
		mainCharacters: null
	}
};

// ============================================================================
// Store
// ============================================================================

function createAnalysisResultsStore() {
	const { subscribe, set, update } = writable<AnalysisResultsState>(initialState);

	return {
		subscribe,

		/**
		 * Set correlation results from CorrelationPanel
		 */
		setCorrelations(correlations: CorrelationResult[]): void {
			update((state) => ({
				...state,
				correlations,
				lastUpdated: {
					...state.lastUpdated,
					correlations: Date.now()
				}
			}));
		},

		/**
		 * Set narrative results from NarrativePanel
		 */
		setNarratives(narratives: NarrativeResult[]): void {
			update((state) => ({
				...state,
				narratives,
				lastUpdated: {
					...state.lastUpdated,
					narratives: Date.now()
				}
			}));
		},

		/**
		 * Set main character results from MainCharPanel
		 */
		setMainCharacters(mainCharacters: MainCharacterResult[]): void {
			update((state) => ({
				...state,
				mainCharacters,
				lastUpdated: {
					...state.lastUpdated,
					mainCharacters: Date.now()
				}
			}));
		},

		/**
		 * Clear all analysis results
		 */
		clear(): void {
			set(initialState);
		},

		/**
		 * Reset store to initial state
		 */
		reset(): void {
			set(initialState);
		}
	};
}

// ============================================================================
// Export Store and Derived Values
// ============================================================================

export const analysisResults = createAnalysisResultsStore();

// Derived stores for individual result types
export const correlationResults = derived(
	analysisResults,
	($state) => $state.correlations
);

export const narrativeResults = derived(
	analysisResults,
	($state) => $state.narratives
);

export const mainCharacterResults = derived(
	analysisResults,
	($state) => $state.mainCharacters
);

// Derived store for checking if any results are available
export const hasAnalysisResults = derived(
	analysisResults,
	($state) =>
		$state.correlations.length > 0 ||
		$state.narratives.length > 0 ||
		$state.mainCharacters.length > 0
);

// Derived store for getting emerging topics from narratives
export const emergingTopics = derived(
	analysisResults,
	($state) =>
		$state.narratives
			.filter((n) => n.trend === 'emerging')
			.map((n) => n.narrative)
			.slice(0, 5)
);

// Derived store for getting rising correlations
export const risingCorrelations = derived(
	analysisResults,
	($state) =>
		$state.correlations
			.filter((c) => c.momentum === 'rising')
			.slice(0, 5)
);

// Derived store for top mentioned characters
export const topCharacters = derived(
	analysisResults,
	($state) =>
		[...$state.mainCharacters]
			.sort((a, b) => b.mentions - a.mentions)
			.slice(0, 5)
);
