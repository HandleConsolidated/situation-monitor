/**
 * LLM Preferences Store - manages user preferences for LLM analysis
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type {
	LLMPreferences,
	ContextCategory,
	AnalysisDepth,
	LLMProvider
} from '$lib/types/llm';
import { DEFAULT_LLM_PREFERENCES } from '$lib/types/llm';
import type { NewsCategory } from '$lib/types';

// Storage key
const STORAGE_KEY = 'aegis_llm_preferences';

/**
 * Load preferences from localStorage
 */
function loadFromStorage(): LLMPreferences | null {
	if (!browser) return null;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (e) {
		console.warn('Failed to load LLM preferences from localStorage:', e);
	}
	return null;
}

/**
 * Save preferences to localStorage
 */
function saveToStorage(preferences: LLMPreferences): void {
	if (!browser) return;

	try {
		// Don't store API key in plain text with other preferences
		const toStore = { ...preferences };
		delete toStore.apiKey; // API key stored separately in llm.ts
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
	} catch (e) {
		console.warn('Failed to save LLM preferences to localStorage:', e);
	}
}

/**
 * Merge stored preferences with defaults
 */
function mergeWithDefaults(stored: LLMPreferences | null): LLMPreferences {
	if (!stored) return { ...DEFAULT_LLM_PREFERENCES };

	return {
		...DEFAULT_LLM_PREFERENCES,
		...stored,
		enabledCategories: {
			...DEFAULT_LLM_PREFERENCES.enabledCategories,
			...stored.enabledCategories
		},
		newsFilters: {
			...DEFAULT_LLM_PREFERENCES.newsFilters,
			...stored.newsFilters
		}
	};
}

/**
 * Create the LLM preferences store
 */
function createLLMPreferencesStore() {
	const savedPreferences = loadFromStorage();
	const initialState = mergeWithDefaults(savedPreferences);

	const { subscribe, set, update } = writable<LLMPreferences>(initialState);

	return {
		subscribe,

		/**
		 * Toggle a context category
		 */
		toggleCategory(category: ContextCategory): void {
			update((state) => {
				const newState = {
					...state,
					enabledCategories: {
						...state.enabledCategories,
						[category]: !state.enabledCategories[category]
					}
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Enable a context category
		 */
		enableCategory(category: ContextCategory): void {
			update((state) => {
				const newState = {
					...state,
					enabledCategories: {
						...state.enabledCategories,
						[category]: true
					}
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Disable a context category
		 */
		disableCategory(category: ContextCategory): void {
			update((state) => {
				const newState = {
					...state,
					enabledCategories: {
						...state.enabledCategories,
						[category]: false
					}
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Set all enabled categories at once
		 */
		setEnabledCategories(
			categories: Record<ContextCategory, boolean>
		): void {
			update((state) => {
				const newState = {
					...state,
					enabledCategories: categories
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Update news filters
		 */
		updateNewsFilters(
			filters: Partial<LLMPreferences['newsFilters']>
		): void {
			update((state) => {
				const newState = {
					...state,
					newsFilters: {
						...state.newsFilters,
						...filters
					}
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Toggle a news category filter
		 */
		toggleNewsCategory(category: NewsCategory): void {
			update((state) => {
				const currentCategories = state.newsFilters.categories;
				const newCategories = currentCategories.includes(category)
					? currentCategories.filter((c) => c !== category)
					: [...currentCategories, category];

				const newState = {
					...state,
					newsFilters: {
						...state.newsFilters,
						categories: newCategories
					}
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Set analysis depth
		 */
		setAnalysisDepth(depth: AnalysisDepth): void {
			update((state) => {
				const newState = {
					...state,
					analysisDepth: depth
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Set max context tokens
		 */
		setMaxContextTokens(tokens: number): void {
			update((state) => {
				const newState = {
					...state,
					maxContextTokens: Math.max(1000, Math.min(200000, tokens))
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Set LLM provider
		 */
		setProvider(provider: LLMProvider): void {
			update((state) => {
				const newState = {
					...state,
					provider
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Set custom endpoint (for custom provider)
		 */
		setCustomEndpoint(endpoint: string): void {
			update((state) => {
				const newState = {
					...state,
					customEndpoint: endpoint
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Set model
		 */
		setModel(model: string): void {
			update((state) => {
				const newState = {
					...state,
					model
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Set custom system prompt
		 */
		setSystemPrompt(prompt: string | undefined): void {
			update((state) => {
				const newState = {
					...state,
					systemPrompt: prompt
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Set focus areas
		 */
		setFocusAreas(areas: string[]): void {
			update((state) => {
				const newState = {
					...state,
					focusAreas: areas
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Get current preferences
		 */
		getPreferences(): LLMPreferences {
			return get({ subscribe });
		},

		/**
		 * Reset to default preferences
		 */
		reset(): void {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
			set({ ...DEFAULT_LLM_PREFERENCES });
		},

		/**
		 * Apply a preset configuration
		 */
		applyPreset(
			preset: 'all' | 'minimal' | 'markets' | 'intel' | 'news'
		): void {
			update((state) => {
				let newCategories: Record<ContextCategory, boolean>;

				switch (preset) {
					case 'all':
						newCategories = {
							geopolitical: true,
							news: true,
							markets: true,
							crypto: true,
							infrastructure: true,
							analysis: true,
							monitors: true,
							environmental: true,
							alternative: true
						};
						break;
					case 'minimal':
						newCategories = {
							geopolitical: true,
							news: true,
							markets: false,
							crypto: false,
							infrastructure: false,
							analysis: true,
							monitors: false,
							environmental: false,
							alternative: false
						};
						break;
					case 'markets':
						newCategories = {
							geopolitical: false,
							news: true,
							markets: true,
							crypto: true,
							infrastructure: false,
							analysis: false,
							monitors: false,
							environmental: false,
							alternative: true
						};
						break;
					case 'intel':
						newCategories = {
							geopolitical: true,
							news: true,
							markets: false,
							crypto: false,
							infrastructure: true,
							analysis: true,
							monitors: true,
							environmental: true,
							alternative: false
						};
						break;
					case 'news':
						newCategories = {
							geopolitical: true,
							news: true,
							markets: false,
							crypto: false,
							infrastructure: false,
							analysis: true,
							monitors: true,
							environmental: false,
							alternative: false
						};
						break;
					default:
						newCategories = state.enabledCategories;
				}

				const newState = {
					...state,
					enabledCategories: newCategories
				};
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Export preferences as JSON
		 */
		exportPreferences(): string {
			const state = get({ subscribe });
			return JSON.stringify(state, null, 2);
		},

		/**
		 * Import preferences from JSON
		 */
		importPreferences(json: string): boolean {
			try {
				const imported = JSON.parse(json);
				const merged = mergeWithDefaults(imported);
				saveToStorage(merged);
				set(merged);
				return true;
			} catch (e) {
				console.error('Failed to import preferences:', e);
				return false;
			}
		}
	};
}

// Export singleton store
export const llmPreferences = createLLMPreferencesStore();

// Derived stores
export const enabledCategories = derived(
	llmPreferences,
	($prefs) => $prefs.enabledCategories
);

export const enabledCategoryList = derived(llmPreferences, ($prefs) =>
	Object.entries($prefs.enabledCategories)
		.filter(([, enabled]) => enabled)
		.map(([cat]) => cat as ContextCategory)
);

export const analysisDepth = derived(
	llmPreferences,
	($prefs) => $prefs.analysisDepth
);

export const currentProvider = derived(
	llmPreferences,
	($prefs) => $prefs.provider
);

export const newsFilterCategories = derived(
	llmPreferences,
	($prefs) => $prefs.newsFilters.categories
);

// Re-export types
export type { LLMPreferences };
