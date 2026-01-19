/**
 * Onboarding presets for first-time users
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
	'news-junkie': {
		id: 'news-junkie',
		name: 'News Junkie',
		icon: '📰',
		description: 'Stay on top of breaking news across politics, tech, and finance',
		panels: ['map', 'analysis', 'politics', 'tech', 'finance', 'gov', 'ai', 'mainchar', 'monitors']
	},
	trader: {
		id: 'trader',
		name: 'Trader',
		icon: '📈',
		description: 'Market-focused dashboard with stocks, crypto, and commodities',
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
			'monitors'
		]
	},
	geopolitics: {
		id: 'geopolitics',
		name: 'Geopolitics Watcher',
		icon: '🌍',
		description: 'Global situation awareness and regional hotspots',
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
			'monitors'
		]
	},
	intel: {
		id: 'intel',
		name: 'Intelligence Analyst',
		icon: '🔍',
		description: 'Deep analysis, pattern detection, and narrative tracking',
		panels: [
			'map',
			'analysis',
			'intel',
			'leaders',
			'correlation',
			'narrative',
			'mainchar',
			'politics',
			'monitors'
		]
	},
	hazards: {
		id: 'hazards',
		name: 'Infrastructure & Hazards',
		icon: '⚠️',
		description: 'Monitor grid stress, earthquakes, radiation, and disease outbreaks',
		panels: [
			'map',
			'analysis',
			'gridstress',
			'earthquakes',
			'radiation',
			'outbreaks',
			'politics',
			'monitors'
		]
	},
	minimal: {
		id: 'minimal',
		name: 'Minimal',
		icon: '⚡',
		description: 'Just the essentials - map, news, and markets',
		panels: ['map', 'politics', 'markets', 'monitors']
	},
	everything: {
		id: 'everything',
		name: 'Everything',
		icon: '🎛️',
		description: 'Kitchen sink - all panels enabled',
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
			'outbreaks'
		]
	}
};

export const PRESET_ORDER = [
	'news-junkie',
	'trader',
	'geopolitics',
	'intel',
	'hazards',
	'minimal',
	'everything'
];

// Storage keys
export const ONBOARDING_STORAGE_KEY = 'onboardingComplete';
export const PRESET_STORAGE_KEY = 'selectedPreset';
