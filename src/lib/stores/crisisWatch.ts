/**
 * Crisis Watch store - configurable crisis monitoring panels
 * Persists configuration to localStorage
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'crisisWatchConfig';

/**
 * Crisis watch panel configuration
 */
export interface CrisisWatchConfig {
	id: 'crisis-1' | 'crisis-2' | 'crisis-3';
	countryCode: string; // ISO 2-letter code
	title: string;
	subtitle: string;
	keywords: string[]; // For filtering news
	enabled: boolean;
}

export interface CrisisWatchState {
	configs: CrisisWatchConfig[];
	initialized: boolean;
}

/**
 * Default crisis watch configurations
 */
const DEFAULT_CONFIGS: CrisisWatchConfig[] = [
	{
		id: 'crisis-1',
		countryCode: 'VE',
		title: 'Venezuela Watch',
		subtitle: 'Humanitarian crisis monitoring',
		keywords: ['venezuela', 'maduro', 'caracas', 'guaido'],
		enabled: true
	},
	{
		id: 'crisis-2',
		countryCode: 'IR',
		title: 'Iran Crisis',
		subtitle: 'Revolution protests, regime instability & nuclear program',
		keywords: [
			'iran',
			'tehran',
			'irgc',
			'protest',
			'uprising',
			'revolution',
			'crackdown',
			'killed',
			'nuclear',
			'strike',
			'attack',
			'khamenei'
		],
		enabled: true
	},
	{
		id: 'crisis-3',
		countryCode: 'GL',
		title: 'Greenland Watch',
		subtitle: 'Arctic geopolitics monitoring',
		keywords: ['greenland', 'arctic', 'nuuk', 'denmark'],
		enabled: true
	}
];

/**
 * Load configs from localStorage
 */
function loadConfigs(): CrisisWatchConfig[] {
	if (!browser) return DEFAULT_CONFIGS;

	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (data) {
			const parsed = JSON.parse(data);
			// Validate structure
			if (Array.isArray(parsed) && parsed.length === 3) {
				return parsed;
			}
		}
		return DEFAULT_CONFIGS;
	} catch (e) {
		console.warn('Failed to load crisis watch config from localStorage:', e);
		return DEFAULT_CONFIGS;
	}
}

/**
 * Save configs to localStorage
 */
function saveConfigs(configs: CrisisWatchConfig[]): void {
	if (!browser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
	} catch (e) {
		console.warn('Failed to save crisis watch config to localStorage:', e);
	}
}

/**
 * Create the crisis watch store
 */
function createCrisisWatchStore() {
	const initialState: CrisisWatchState = {
		configs: loadConfigs(),
		initialized: false
	};

	const { subscribe, update } = writable<CrisisWatchState>(initialState);

	return {
		subscribe,

		/**
		 * Initialize store (call after hydration)
		 */
		init() {
			update((state) => ({ ...state, initialized: true }));
		},

		/**
		 * Get all crisis watch configurations
		 */
		getConfigs(): CrisisWatchConfig[] {
			return get({ subscribe }).configs;
		},

		/**
		 * Get a specific crisis watch configuration by ID
		 */
		getConfig(id: CrisisWatchConfig['id']): CrisisWatchConfig | undefined {
			return get({ subscribe }).configs.find((c) => c.id === id);
		},

		/**
		 * Update a crisis watch configuration
		 */
		updateConfig(
			id: CrisisWatchConfig['id'],
			updates: Partial<Omit<CrisisWatchConfig, 'id'>>
		): boolean {
			let found = false;

			update((state) => {
				const index = state.configs.findIndex((c) => c.id === id);
				if (index === -1) return state;

				found = true;
				const newConfigs = [...state.configs];
				newConfigs[index] = { ...newConfigs[index], ...updates };
				saveConfigs(newConfigs);
				return { ...state, configs: newConfigs };
			});

			return found;
		},

		/**
		 * Reset all configurations to defaults
		 */
		resetToDefaults(): void {
			update((state) => {
				saveConfigs(DEFAULT_CONFIGS);
				return { ...state, configs: [...DEFAULT_CONFIGS] };
			});
		},

		/**
		 * Reset a single configuration to its default
		 */
		resetConfigToDefault(id: CrisisWatchConfig['id']): boolean {
			const defaultConfig = DEFAULT_CONFIGS.find((c) => c.id === id);
			if (!defaultConfig) return false;

			return this.updateConfig(id, {
				countryCode: defaultConfig.countryCode,
				title: defaultConfig.title,
				subtitle: defaultConfig.subtitle,
				keywords: [...defaultConfig.keywords],
				enabled: defaultConfig.enabled
			});
		},

		/**
		 * Toggle enabled state for a crisis watch
		 */
		toggleEnabled(id: CrisisWatchConfig['id']): void {
			update((state) => {
				const index = state.configs.findIndex((c) => c.id === id);
				if (index === -1) return state;

				const newConfigs = [...state.configs];
				newConfigs[index] = {
					...newConfigs[index],
					enabled: !newConfigs[index].enabled
				};
				saveConfigs(newConfigs);
				return { ...state, configs: newConfigs };
			});
		}
	};
}

// Export singleton store
export const crisisWatch = createCrisisWatchStore();

// Derived stores
export const crisisWatchConfigs = derived(crisisWatch, ($store) => $store.configs);

export const enabledCrisisWatches = derived(crisisWatch, ($store) =>
	$store.configs.filter((c) => c.enabled)
);

/**
 * Get the default configuration for a crisis watch ID
 */
export function getDefaultConfig(id: CrisisWatchConfig['id']): CrisisWatchConfig | undefined {
	return DEFAULT_CONFIGS.find((c) => c.id === id);
}

/**
 * Helper to get config by panel ID mapping
 * venezuela -> crisis-1, iran -> crisis-2, greenland -> crisis-3
 */
export function getConfigByPanelId(
	panelId: 'venezuela' | 'iran' | 'greenland'
): CrisisWatchConfig['id'] {
	const mapping: Record<string, CrisisWatchConfig['id']> = {
		venezuela: 'crisis-1',
		iran: 'crisis-2',
		greenland: 'crisis-3'
	};
	return mapping[panelId];
}
