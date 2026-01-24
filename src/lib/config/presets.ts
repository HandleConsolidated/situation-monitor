/**
 * Onboarding presets for first-time users
 *
 * Each preset defines which panels are enabled by default.
 * Users can customize their setup after selecting a preset.
 */

import type { PanelId } from './panels';

export interface Preset {
	id: string;
	name: string;
	icon: string;
	description: string;
	panels: PanelId[];
}

export const PRESETS: Record<string, Preset> = {
	/**
	 * Default/Balanced preset - Good starting point for most users
	 * Includes core news feeds, market data, and analysis tools
	 */
	balanced: {
		id: 'balanced',
		name: 'Balanced',
		icon: '🎯',
		description: 'Recommended starting point with news, markets, and situational awareness',
		panels: [
			'map',
			'analysis',
			'politics',
			'tech',
			'finance',
			'markets',
			'heatmap',
			'mainchar',
			'correlation',
			'monitors'
		]
	},

	/**
	 * Geopolitical Focus preset - For tracking global conflicts and political situations
	 * Emphasizes intel feeds, world leaders, and regional situation panels
	 */
	geopolitics: {
		id: 'geopolitics',
		name: 'Geopolitical Focus',
		icon: '🌍',
		description: 'Global conflicts, intel feeds, world leaders, and regional hotspots',
		panels: [
			'map',
			'analysis',
			'intel',
			'leaders',
			'politics',
			'gov',
			'venezuela',
			'greenland',
			'iran',
			'correlation',
			'narrative',
			'mainchar',
			'monitors'
		]
	},

	/**
	 * Financial/Markets preset - For traders and market watchers
	 * Comprehensive market data including crypto, commodities, and whale activity
	 */
	markets: {
		id: 'markets',
		name: 'Financial Markets',
		icon: '📈',
		description: 'Stocks, crypto, commodities, whale tracking, and market predictions',
		panels: [
			'map',
			'analysis',
			'markets',
			'heatmap',
			'commodities',
			'crypto',
			'polymarket',
			'whales',
			'printer',
			'finance',
			'contracts',
			'monitors'
		]
	},

	/**
	 * Infrastructure & Hazards preset - For monitoring natural disasters and infrastructure
	 * Includes weather alerts, earthquakes, radiation, disease outbreaks, and grid stress
	 */
	hazards: {
		id: 'hazards',
		name: 'Infrastructure & Hazards',
		icon: '⚠️',
		description: 'Weather alerts, earthquakes, radiation, disease outbreaks, and grid stress',
		panels: [
			'map',
			'analysis',
			'weather',
			'gridstress',
			'earthquakes',
			'radiation',
			'outbreaks',
			'politics',
			'monitors'
		]
	},

	/**
	 * Aviation & Maritime preset - For tracking aircraft and weather conditions
	 * Features aircraft tracking panel and weather alerts
	 */
	aviation: {
		id: 'aviation',
		name: 'Aviation & Weather',
		icon: '✈️',
		description: 'Aircraft tracking, weather radar, alerts, and atmospheric conditions',
		panels: [
			'map',
			'analysis',
			'aircraft',
			'weather',
			'politics',
			'monitors'
		]
	},

	/**
	 * Intelligence Analyst preset - Deep dive into patterns and narrative tracking
	 * For users who want to analyze trends and emerging stories
	 */
	intel: {
		id: 'intel',
		name: 'Intelligence Analyst',
		icon: '🔍',
		description: 'Pattern detection, narrative tracking, and trend analysis',
		panels: [
			'map',
			'analysis',
			'intel',
			'leaders',
			'correlation',
			'narrative',
			'mainchar',
			'politics',
			'gov',
			'monitors'
		]
	},

	/**
	 * Tech & AI preset - For tracking technology and AI developments
	 * Focuses on tech news, AI race, and related layoffs
	 */
	techwatch: {
		id: 'techwatch',
		name: 'Tech & AI Watch',
		icon: '🤖',
		description: 'AI developments, tech news, industry layoffs, and contracts',
		panels: [
			'map',
			'analysis',
			'tech',
			'ai',
			'layoffs',
			'contracts',
			'finance',
			'mainchar',
			'monitors'
		]
	},

	/**
	 * Minimal preset - Clean, distraction-free view
	 * Just the essential panels for quick overview
	 */
	minimal: {
		id: 'minimal',
		name: 'Minimal',
		icon: '⚡',
		description: 'Clean and focused - just the map, news, and markets',
		panels: ['map', 'politics', 'markets', 'monitors']
	},

	/**
	 * Everything preset - All panels enabled
	 * Maximum data visibility for power users
	 */
	everything: {
		id: 'everything',
		name: 'Everything',
		icon: '🎛️',
		description: 'All panels enabled - maximum situational awareness',
		panels: [
			'map',
			'analysis',
			'monitors',
			'politics',
			'tech',
			'finance',
			'gov',
			'ai',
			'intel',
			'markets',
			'heatmap',
			'commodities',
			'crypto',
			'polymarket',
			'whales',
			'printer',
			'correlation',
			'narrative',
			'mainchar',
			'contracts',
			'layoffs',
			'leaders',
			'venezuela',
			'greenland',
			'iran',
			'gridstress',
			'earthquakes',
			'radiation',
			'outbreaks',
			'aircraft',
			'weather'
		]
	}
};

/**
 * Order in which presets appear in the onboarding modal
 * Balanced is first as the recommended default
 */
export const PRESET_ORDER = [
	'balanced',
	'geopolitics',
	'markets',
	'hazards',
	'aviation',
	'intel',
	'techwatch',
	'minimal',
	'everything'
];

// Storage keys
export const ONBOARDING_STORAGE_KEY = 'onboardingComplete';
export const PRESET_STORAGE_KEY = 'selectedPreset';
