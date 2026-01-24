/**
 * Weather Command Center store
 * Manages weather zones, alerts, forecasts, and briefings
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type {
	WeatherState,
	WeatherZone,
	WeatherAlert,
	WeatherBriefing,
	AlertSeverity
} from '$lib/types';
import {
	fetchAlertsForStates,
	fetchForecast,
	extractForecastHighlights,
	generateBriefingText,
	generateBriefingMarkdown
} from '$lib/api/weather';
import { PREDEFINED_REGIONS, US_STATES } from '$lib/config/weather';

const ZONES_STORAGE_KEY = 'weatherZones';
const BRIEFINGS_STORAGE_KEY = 'weatherBriefings';
const MAX_BRIEFINGS = 10;

/**
 * Severity order for sorting alerts (Extreme first)
 */
const SEVERITY_ORDER: Record<AlertSeverity, number> = {
	Extreme: 0,
	Severe: 1,
	Moderate: 2,
	Minor: 3,
	Unknown: 4
};

/**
 * Load zones from localStorage
 */
function loadZones(): WeatherZone[] {
	if (!browser) return [];

	try {
		const data = localStorage.getItem(ZONES_STORAGE_KEY);
		return data ? JSON.parse(data) : [];
	} catch (e) {
		console.warn('Failed to load weather zones from localStorage:', e);
		return [];
	}
}

/**
 * Save zones to localStorage
 */
function saveZones(zones: WeatherZone[]): void {
	if (!browser) return;

	try {
		localStorage.setItem(ZONES_STORAGE_KEY, JSON.stringify(zones));
	} catch (e) {
		console.warn('Failed to save weather zones to localStorage:', e);
	}
}

/**
 * Load briefings from localStorage
 */
function loadBriefings(): WeatherBriefing[] {
	if (!browser) return [];

	try {
		const data = localStorage.getItem(BRIEFINGS_STORAGE_KEY);
		return data ? JSON.parse(data) : [];
	} catch (e) {
		console.warn('Failed to load weather briefings from localStorage:', e);
		return [];
	}
}

/**
 * Save briefings to localStorage (max 10)
 */
function saveBriefings(briefings: WeatherBriefing[]): void {
	if (!browser) return;

	try {
		// Keep only the most recent briefings
		const trimmed = briefings.slice(0, MAX_BRIEFINGS);
		localStorage.setItem(BRIEFINGS_STORAGE_KEY, JSON.stringify(trimmed));
	} catch (e) {
		console.warn('Failed to save weather briefings to localStorage:', e);
	}
}

/**
 * Generate a unique zone ID
 */
function generateZoneId(): string {
	return `wz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique briefing ID
 */
function generateBriefingId(): string {
	return `wb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sort alerts by severity (Extreme first, then Severe, etc.)
 */
function sortAlertsBySeverity(alerts: WeatherAlert[]): WeatherAlert[] {
	return [...alerts].sort((a, b) => {
		const aOrder = SEVERITY_ORDER[a.severity] ?? 4;
		const bOrder = SEVERITY_ORDER[b.severity] ?? 4;
		return aOrder - bOrder;
	});
}

/**
 * Create the weather store
 */
function createWeatherStore() {
	const initialState: WeatherState = {
		alerts: [],
		alertsLoading: false,
		alertsError: null,
		alertsLastUpdated: null,
		zones: loadZones(),
		forecasts: [],
		forecastsLoading: false,
		forecastsError: null,
		briefings: loadBriefings(),
		selectedAlertId: null,
		commandModalOpen: false,
		initialized: false,
		mapPickerMode: false,
		pendingPointName: null
	};

	const { subscribe, set, update } = writable<WeatherState>(initialState);

	return {
		subscribe,

		/**
		 * Initialize the store
		 */
		init(): void {
			update((state) => ({
				...state,
				zones: loadZones(),
				briefings: loadBriefings(),
				initialized: true
			}));
		},

		/**
		 * Add a state zone for monitoring
		 * @param stateCode - Two-letter state code (e.g., 'TX', 'CA')
		 * @param stateName - Full state name
		 * @returns The created zone or null if state already exists
		 */
		addStateZone(stateCode: string, stateName: string): WeatherZone | null {
			const state = get({ subscribe });

			// Check if this state is already being monitored
			const exists = state.zones.some(
				(z) => z.type === 'state' && z.code?.toUpperCase() === stateCode.toUpperCase()
			);

			if (exists) {
				console.warn(`State ${stateCode} is already being monitored`);
				return null;
			}

			const newZone: WeatherZone = {
				id: generateZoneId(),
				name: stateName,
				type: 'state',
				code: stateCode.toUpperCase(),
				enabled: true,
				createdAt: Date.now()
			};

			update((s) => {
				const newZones = [...s.zones, newZone];
				saveZones(newZones);
				return { ...s, zones: newZones };
			});

			return newZone;
		},

		/**
		 * Add a custom point zone for forecast monitoring
		 * @param name - Display name for the location
		 * @param lat - Latitude
		 * @param lon - Longitude
		 * @returns The created zone or null if point already exists
		 */
		addPointZone(name: string, lat: number, lon: number): WeatherZone | null {
			const state = get({ subscribe });

			// Check if a point with similar coordinates already exists (within ~0.01 degrees)
			const exists = state.zones.some(
				(z) =>
					z.type === 'point' &&
					z.lat !== undefined &&
					z.lon !== undefined &&
					Math.abs(z.lat - lat) < 0.01 &&
					Math.abs(z.lon - lon) < 0.01
			);

			if (exists) {
				console.warn(`A point near ${lat}, ${lon} is already being monitored`);
				return null;
			}

			const newZone: WeatherZone = {
				id: generateZoneId(),
				name,
				type: 'point',
				lat,
				lon,
				enabled: true,
				createdAt: Date.now()
			};

			update((s) => {
				const newZones = [...s.zones, newZone];
				saveZones(newZones);
				return { ...s, zones: newZones };
			});

			return newZone;
		},

		/**
		 * Add all states from a predefined region
		 * @param regionKey - Region ID (e.g., 'central_us', 'midwest')
		 * @returns Array of created zones
		 */
		addRegion(regionKey: string): WeatherZone[] {
			const region = PREDEFINED_REGIONS.find((r) => r.id === regionKey);

			if (!region) {
				console.warn(`Region ${regionKey} not found`);
				return [];
			}

			const state = get({ subscribe });
			const createdZones: WeatherZone[] = [];

			for (const stateCode of region.states) {
				// Skip if already exists
				const exists = state.zones.some(
					(z) => z.type === 'state' && z.code?.toUpperCase() === stateCode.toUpperCase()
				);

				if (exists) continue;

				// Find state name from US_STATES
				const stateInfo = US_STATES.find((s) => s.code === stateCode);
				const stateName = stateInfo?.name ?? stateCode;

				const newZone: WeatherZone = {
					id: generateZoneId(),
					name: stateName,
					type: 'state',
					code: stateCode.toUpperCase(),
					enabled: true,
					createdAt: Date.now()
				};

				createdZones.push(newZone);
			}

			if (createdZones.length > 0) {
				update((s) => {
					const newZones = [...s.zones, ...createdZones];
					saveZones(newZones);
					return { ...s, zones: newZones };
				});
			}

			return createdZones;
		},

		/**
		 * Remove a zone by ID
		 * @param id - Zone ID
		 * @returns true if zone was found and removed
		 */
		removeZone(id: string): boolean {
			let found = false;

			update((state) => {
				const index = state.zones.findIndex((z) => z.id === id);
				if (index === -1) return state;

				found = true;
				const newZones = state.zones.filter((z) => z.id !== id);
				saveZones(newZones);

				// Also remove forecasts for this zone
				const newForecasts = state.forecasts.filter((f) => f.zoneId !== id);

				return { ...state, zones: newZones, forecasts: newForecasts };
			});

			return found;
		},

		/**
		 * Toggle zone enabled state
		 * @param id - Zone ID
		 */
		toggleZone(id: string): void {
			update((state) => {
				const index = state.zones.findIndex((z) => z.id === id);
				if (index === -1) return state;

				const newZones = [...state.zones];
				newZones[index] = {
					...newZones[index],
					enabled: !newZones[index].enabled
				};
				saveZones(newZones);
				return { ...state, zones: newZones };
			});
		},

		/**
		 * Fetch alerts for all enabled state zones
		 */
		async fetchAlerts(): Promise<void> {
			const state = get({ subscribe });

			// Get enabled state zones
			const stateZones = state.zones.filter((z) => z.type === 'state' && z.enabled && z.code);

			if (stateZones.length === 0) {
				update((s) => ({
					...s,
					alerts: [],
					alertsLoading: false,
					alertsError: null,
					alertsLastUpdated: Date.now()
				}));
				return;
			}

			update((s) => ({ ...s, alertsLoading: true, alertsError: null }));

			try {
				const stateCodes = stateZones.map((z) => z.code!);
				const alerts = await fetchAlertsForStates(stateCodes);
				const sortedAlerts = sortAlertsBySeverity(alerts);

				update((s) => ({
					...s,
					alerts: sortedAlerts,
					alertsLoading: false,
					alertsError: null,
					alertsLastUpdated: Date.now()
				}));
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to fetch alerts';
				update((s) => ({
					...s,
					alertsLoading: false,
					alertsError: message
				}));
			}
		},

		/**
		 * Fetch forecasts for all enabled point zones
		 */
		async fetchForecasts(): Promise<void> {
			const state = get({ subscribe });

			// Get enabled point zones
			const pointZones = state.zones.filter(
				(z) => z.type === 'point' && z.enabled && z.lat !== undefined && z.lon !== undefined
			);

			if (pointZones.length === 0) {
				update((s) => ({
					...s,
					forecasts: [],
					forecastsLoading: false,
					forecastsError: null
				}));
				return;
			}

			update((s) => ({ ...s, forecastsLoading: true, forecastsError: null }));

			try {
				const forecastPromises = pointZones.map(async (zone) => {
					const periods = await fetchForecast(zone.lat!, zone.lon!);
					return extractForecastHighlights(zone.name, zone.id, periods);
				});

				const forecasts = await Promise.all(forecastPromises);

				update((s) => ({
					...s,
					forecasts,
					forecastsLoading: false,
					forecastsError: null
				}));
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to fetch forecasts';
				update((s) => ({
					...s,
					forecastsLoading: false,
					forecastsError: message
				}));
			}
		},

		/**
		 * Refresh both alerts and forecasts
		 */
		async refresh(): Promise<void> {
			await Promise.all([this.fetchAlerts(), this.fetchForecasts()]);
		},

		/**
		 * Generate a weather briefing
		 * @param format - Output format (text, markdown, json)
		 * @returns The generated briefing
		 */
		generateBriefing(format: 'text' | 'markdown' | 'json'): WeatherBriefing {
			const state = get({ subscribe });

			let content: string;

			switch (format) {
				case 'text':
					content = generateBriefingText(state.alerts, state.forecasts);
					break;
				case 'markdown':
					content = generateBriefingMarkdown(state.alerts, state.forecasts);
					break;
				case 'json':
					content = JSON.stringify(
						{
							generatedAt: new Date().toISOString(),
							alerts: state.alerts,
							forecasts: state.forecasts,
							zones: state.zones.filter((z) => z.enabled).map((z) => z.name)
						},
						null,
						2
					);
					break;
			}

			const briefing: WeatherBriefing = {
				id: generateBriefingId(),
				generatedAt: Date.now(),
				zones: state.zones.filter((z) => z.enabled).map((z) => z.name),
				alerts: state.alerts,
				forecasts: state.forecasts,
				format,
				content
			};

			// Add to briefings and save
			update((s) => {
				const newBriefings = [briefing, ...s.briefings].slice(0, MAX_BRIEFINGS);
				saveBriefings(newBriefings);
				return { ...s, briefings: newBriefings };
			});

			return briefing;
		},

		/**
		 * Select an alert for map navigation
		 * @param alertId - Alert ID to select, or null to deselect
		 */
		selectAlert(alertId: string | null): void {
			update((state) => ({ ...state, selectedAlertId: alertId }));
		},

		/**
		 * Open the command center modal
		 */
		openCommandModal(): void {
			update((state) => ({ ...state, commandModalOpen: true }));
		},

		/**
		 * Close the command center modal
		 */
		closeCommandModal(): void {
			update((state) => ({ ...state, commandModalOpen: false }));
		},

		/**
		 * Get an alert by ID
		 * @param id - Alert ID
		 * @returns The alert or undefined if not found
		 */
		getAlert(id: string): WeatherAlert | undefined {
			const state = get({ subscribe });
			return state.alerts.find((a) => a.id === id);
		},

		/**
		 * Reset all weather data
		 */
		reset(): void {
			if (browser) {
				localStorage.removeItem(ZONES_STORAGE_KEY);
				localStorage.removeItem(BRIEFINGS_STORAGE_KEY);
			}

			set({
				alerts: [],
				alertsLoading: false,
				alertsError: null,
				alertsLastUpdated: null,
				zones: [],
				forecasts: [],
				forecastsLoading: false,
				forecastsError: null,
				briefings: [],
				selectedAlertId: null,
				commandModalOpen: false,
				initialized: true,
				mapPickerMode: false,
				pendingPointName: null
			});
		},

		/**
		 * Enter map picker mode for selecting a location
		 * @param pointName - Optional name for the point to be created
		 */
		enterMapPickerMode(pointName?: string): void {
			update((state) => ({
				...state,
				mapPickerMode: true,
				pendingPointName: pointName || null,
				commandModalOpen: false // Close modal while picking
			}));
		},

		/**
		 * Cancel map picker mode
		 */
		cancelMapPickerMode(): void {
			update((state) => ({
				...state,
				mapPickerMode: false,
				pendingPointName: null
			}));
		},

		/**
		 * Handle location picked from map
		 * @param lat - Latitude
		 * @param lon - Longitude
		 * @returns The created zone or null
		 */
		handleMapPick(lat: number, lon: number): WeatherZone | null {
			const state = get({ subscribe });
			const name = state.pendingPointName || `Point ${lat.toFixed(2)}, ${lon.toFixed(2)}`;

			// Exit picker mode
			update((s) => ({
				...s,
				mapPickerMode: false,
				pendingPointName: null,
				commandModalOpen: true // Re-open modal after picking
			}));

			// Add the point zone
			return this.addPointZone(name, lat, lon);
		}
	};
}

// Export singleton store
export const weather = createWeatherStore();

// Derived stores

/**
 * Current alerts array
 */
export const activeAlerts = derived(weather, ($weather) => $weather.alerts);

/**
 * Number of active alerts
 */
export const alertCount = derived(weather, ($weather) => $weather.alerts.length);

/**
 * Number of Extreme or Severe alerts
 */
export const severeAlertCount = derived(
	weather,
	($weather) =>
		$weather.alerts.filter((a) => a.severity === 'Extreme' || a.severity === 'Severe').length
);

/**
 * Zones where enabled=true
 */
export const enabledZones = derived(weather, ($weather) => $weather.zones.filter((z) => z.enabled));

/**
 * Total zone count
 */
export const zoneCount = derived(weather, ($weather) => $weather.zones.length);

/**
 * True if alertsLoading OR forecastsLoading
 */
export const weatherLoading = derived(
	weather,
	($weather) => $weather.alertsLoading || $weather.forecastsLoading
);

/**
 * Current selected alert object or null
 */
export const selectedAlert = derived(weather, ($weather) => {
	if (!$weather.selectedAlertId) return null;
	return $weather.alerts.find((a) => a.id === $weather.selectedAlertId) ?? null;
});

/**
 * Map picker mode state
 */
export const mapPickerMode = derived(weather, ($weather) => $weather.mapPickerMode);

/**
 * Pending point name for map picker
 */
export const pendingPointName = derived(weather, ($weather) => $weather.pendingPointName);
