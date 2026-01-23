/**
 * Tests for Weather Command Center store
 * Tests zone management, alert handling, briefing generation, and derived stores
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock $app/environment before importing the store
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock the weather API functions
vi.mock('$lib/api/weather', () => ({
	fetchAlertsForStates: vi.fn().mockResolvedValue([]),
	fetchForecast: vi.fn().mockResolvedValue([]),
	extractForecastHighlights: vi.fn().mockReturnValue({
		location: 'Test',
		zoneId: 'zone1',
		summary: 'Clear',
		temperature: { high: 70, low: 50 },
		precipitation: { chance: 0, type: null, accumulation: null },
		wind: { speed: '5 mph', gusts: null },
		timing: 'Today',
		severity: 'low'
	}),
	generateBriefingText: vi.fn().mockReturnValue('WEATHER BRIEFING\n=====\nTest briefing content'),
	generateBriefingMarkdown: vi
		.fn()
		.mockReturnValue('# Weather Briefing\n\nTest briefing content in markdown')
}));

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		}),
		clear: vi.fn(() => {
			store = {};
		})
	};
})();

Object.defineProperty(globalThis, 'localStorage', {
	value: localStorageMock
});

describe('Weather Store', () => {
	beforeEach(async () => {
		localStorageMock.clear();
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe('initial state', () => {
		it('should start with empty alerts and zones', async () => {
			const { weather } = await import('./weather');

			const state = get(weather);
			expect(state.alerts).toEqual([]);
			expect(state.zones).toEqual([]);
			expect(state.forecasts).toEqual([]);
			expect(state.briefings).toEqual([]);
		});

		it('should have loading states set to false initially', async () => {
			const { weather } = await import('./weather');

			const state = get(weather);
			expect(state.alertsLoading).toBe(false);
			expect(state.forecastsLoading).toBe(false);
		});

		it('should have error states as null initially', async () => {
			const { weather } = await import('./weather');

			const state = get(weather);
			expect(state.alertsError).toBeNull();
			expect(state.forecastsError).toBeNull();
		});
	});

	describe('zone management', () => {
		it('should add a state zone', async () => {
			const { weather } = await import('./weather');

			const zone = weather.addStateZone('KS', 'Kansas');

			expect(zone).not.toBeNull();
			expect(zone!.type).toBe('state');
			expect(zone!.code).toBe('KS');
			expect(zone!.name).toBe('Kansas');
			expect(zone!.enabled).toBe(true);
			expect(zone!.id).toMatch(/^wz_/);

			const state = get(weather);
			expect(state.zones).toHaveLength(1);
		});

		it('should not add duplicate state zones', async () => {
			const { weather } = await import('./weather');

			weather.addStateZone('KS', 'Kansas');
			const duplicate = weather.addStateZone('KS', 'Kansas');

			expect(duplicate).toBeNull();

			const state = get(weather);
			expect(state.zones).toHaveLength(1);
		});

		it('should handle case-insensitive state code comparison', async () => {
			const { weather } = await import('./weather');

			weather.addStateZone('KS', 'Kansas');
			const duplicate = weather.addStateZone('ks', 'Kansas');

			expect(duplicate).toBeNull();

			const state = get(weather);
			expect(state.zones).toHaveLength(1);
		});

		it('should add a custom point zone', async () => {
			const { weather } = await import('./weather');

			const zone = weather.addPointZone('My Location', 39.0997, -94.5786);

			expect(zone).not.toBeNull();
			expect(zone!.type).toBe('point');
			expect(zone!.name).toBe('My Location');
			expect(zone!.lat).toBe(39.0997);
			expect(zone!.lon).toBe(-94.5786);
			expect(zone!.enabled).toBe(true);
		});

		it('should not add duplicate point zones within proximity', async () => {
			const { weather } = await import('./weather');

			weather.addPointZone('Location A', 39.0997, -94.5786);
			// Try to add a point within 0.01 degrees
			const duplicate = weather.addPointZone('Location B', 39.1, -94.58);

			expect(duplicate).toBeNull();

			const state = get(weather);
			expect(state.zones).toHaveLength(1);
		});

		it('should allow point zones far enough apart', async () => {
			const { weather } = await import('./weather');

			weather.addPointZone('Location A', 39.0997, -94.5786);
			// Add a point more than 0.01 degrees away
			const zone = weather.addPointZone('Location B', 39.2, -94.7);

			expect(zone).not.toBeNull();

			const state = get(weather);
			expect(state.zones).toHaveLength(2);
		});

		it('should remove a zone', async () => {
			const { weather } = await import('./weather');

			const zone = weather.addStateZone('KS', 'Kansas');
			expect(get(weather).zones).toHaveLength(1);

			const removed = weather.removeZone(zone!.id);
			expect(removed).toBe(true);
			expect(get(weather).zones).toHaveLength(0);
		});

		it('should return false when removing non-existent zone', async () => {
			const { weather } = await import('./weather');

			const removed = weather.removeZone('non-existent-id');
			expect(removed).toBe(false);
		});

		it('should toggle zone enabled state', async () => {
			const { weather } = await import('./weather');

			const zone = weather.addStateZone('KS', 'Kansas');
			expect(zone!.enabled).toBe(true);

			weather.toggleZone(zone!.id);
			const state = get(weather);
			expect(state.zones[0].enabled).toBe(false);

			weather.toggleZone(zone!.id);
			const state2 = get(weather);
			expect(state2.zones[0].enabled).toBe(true);
		});

		it('should persist zones to localStorage', async () => {
			const { weather } = await import('./weather');

			weather.addStateZone('KS', 'Kansas');

			expect(localStorageMock.setItem).toHaveBeenCalledWith('weatherZones', expect.any(String));
		});
	});

	describe('region management', () => {
		it('should add multiple states from a region', async () => {
			const { weather } = await import('./weather');

			const zones = weather.addRegion('central_us');

			// Central US region includes multiple states
			expect(zones.length).toBeGreaterThan(0);

			const state = get(weather);
			expect(state.zones.length).toBeGreaterThan(0);
			expect(state.zones.every((z) => z.type === 'state')).toBe(true);
		});

		it('should not add duplicate states when adding region', async () => {
			const { weather } = await import('./weather');

			// First add Kansas individually
			weather.addStateZone('KS', 'Kansas');

			// Then add central_us region which includes Kansas
			const addedZones = weather.addRegion('central_us');

			// Kansas should not be in the added zones (already exists)
			const kansasAdded = addedZones.find((z) => z.code === 'KS');
			expect(kansasAdded).toBeUndefined();
		});

		it('should return empty array for non-existent region', async () => {
			const { weather } = await import('./weather');

			const zones = weather.addRegion('non_existent_region');

			expect(zones).toEqual([]);
		});
	});

	describe('derived stores', () => {
		it('should count alerts correctly', async () => {
			const { alertCount } = await import('./weather');

			// Initially should be 0
			expect(get(alertCount)).toBe(0);
		});

		it('should filter enabled zones correctly', async () => {
			const { weather, enabledZones } = await import('./weather');

			weather.addStateZone('KS', 'Kansas');
			weather.addStateZone('MO', 'Missouri');

			const zones = get(weather).zones;
			weather.toggleZone(zones[0].id); // Disable Kansas

			const enabled = get(enabledZones);
			expect(enabled).toHaveLength(1);
			expect(enabled[0].code).toBe('MO');
		});

		it('should count zones correctly', async () => {
			const { weather, zoneCount } = await import('./weather');

			expect(get(zoneCount)).toBe(0);

			weather.addStateZone('KS', 'Kansas');
			expect(get(zoneCount)).toBe(1);

			weather.addStateZone('MO', 'Missouri');
			expect(get(zoneCount)).toBe(2);
		});

		it('should track loading state correctly', async () => {
			const { weatherLoading } = await import('./weather');

			// Initially not loading
			expect(get(weatherLoading)).toBe(false);
		});

		it('should track severe alert count', async () => {
			const { severeAlertCount } = await import('./weather');

			expect(get(severeAlertCount)).toBe(0);
		});

		it('should return null for selected alert when none selected', async () => {
			const { selectedAlert } = await import('./weather');

			expect(get(selectedAlert)).toBeNull();
		});
	});

	describe('briefing generation', () => {
		it('should generate text briefing', async () => {
			const { weather } = await import('./weather');

			const briefing = weather.generateBriefing('text');

			expect(briefing.format).toBe('text');
			expect(briefing.content).toContain('WEATHER BRIEFING');
			expect(briefing.id).toMatch(/^wb_/);

			const state = get(weather);
			expect(state.briefings).toHaveLength(1);
		});

		it('should generate markdown briefing', async () => {
			const { weather } = await import('./weather');

			const briefing = weather.generateBriefing('markdown');

			expect(briefing.format).toBe('markdown');
			expect(briefing.content).toContain('# Weather Briefing');
		});

		it('should generate JSON briefing', async () => {
			const { weather } = await import('./weather');

			const briefing = weather.generateBriefing('json');

			expect(briefing.format).toBe('json');
			const parsed = JSON.parse(briefing.content);
			expect(parsed).toHaveProperty('generatedAt');
			expect(parsed).toHaveProperty('alerts');
			expect(parsed).toHaveProperty('forecasts');
			expect(parsed).toHaveProperty('zones');
		});

		it('should limit stored briefings to maximum', async () => {
			const { weather } = await import('./weather');

			// Generate more briefings than max (10)
			for (let i = 0; i < 15; i++) {
				weather.generateBriefing('text');
			}

			const state = get(weather);
			expect(state.briefings.length).toBeLessThanOrEqual(10);
		});

		it('should persist briefings to localStorage', async () => {
			const { weather } = await import('./weather');

			weather.generateBriefing('text');

			expect(localStorageMock.setItem).toHaveBeenCalledWith('weatherBriefings', expect.any(String));
		});

		it('should include enabled zone names in briefing', async () => {
			const { weather } = await import('./weather');

			weather.addStateZone('KS', 'Kansas');
			weather.addStateZone('MO', 'Missouri');

			const briefing = weather.generateBriefing('json');
			const parsed = JSON.parse(briefing.content);

			expect(parsed.zones).toContain('Kansas');
			expect(parsed.zones).toContain('Missouri');
		});
	});

	describe('alert selection', () => {
		it('should select an alert', async () => {
			const { weather } = await import('./weather');

			weather.selectAlert('test-alert-id');

			const state = get(weather);
			expect(state.selectedAlertId).toBe('test-alert-id');
		});

		it('should deselect alert when null passed', async () => {
			const { weather } = await import('./weather');

			weather.selectAlert('test-alert-id');
			weather.selectAlert(null);

			const state = get(weather);
			expect(state.selectedAlertId).toBeNull();
		});
	});

	describe('command modal', () => {
		it('should open command modal', async () => {
			const { weather } = await import('./weather');

			weather.openCommandModal();

			const state = get(weather);
			expect(state.commandModalOpen).toBe(true);
		});

		it('should close command modal', async () => {
			const { weather } = await import('./weather');

			weather.openCommandModal();
			weather.closeCommandModal();

			const state = get(weather);
			expect(state.commandModalOpen).toBe(false);
		});
	});

	describe('reset', () => {
		it('should reset all state', async () => {
			const { weather } = await import('./weather');

			// Add some data
			weather.addStateZone('KS', 'Kansas');
			weather.addPointZone('Test', 39.0, -94.0);
			weather.generateBriefing('text');
			weather.selectAlert('test-id');
			weather.openCommandModal();

			// Reset
			weather.reset();

			const state = get(weather);
			expect(state.zones).toEqual([]);
			expect(state.alerts).toEqual([]);
			expect(state.forecasts).toEqual([]);
			expect(state.briefings).toEqual([]);
			expect(state.selectedAlertId).toBeNull();
			expect(state.commandModalOpen).toBe(false);
		});

		it('should clear localStorage on reset', async () => {
			const { weather } = await import('./weather');

			weather.addStateZone('KS', 'Kansas');
			weather.reset();

			expect(localStorageMock.removeItem).toHaveBeenCalledWith('weatherZones');
			expect(localStorageMock.removeItem).toHaveBeenCalledWith('weatherBriefings');
		});
	});

	describe('initialization', () => {
		it('should set initialized flag on init', async () => {
			const { weather } = await import('./weather');

			weather.init();

			const state = get(weather);
			expect(state.initialized).toBe(true);
		});
	});

	describe('getAlert', () => {
		it('should return undefined for non-existent alert', async () => {
			const { weather } = await import('./weather');

			const alert = weather.getAlert('non-existent');
			expect(alert).toBeUndefined();
		});
	});
});
