/**
 * Military Ship Detection
 * Extracts military vessel mentions from news feeds and adds them to the map
 */

import type { NewsItem } from '$lib/types';

export interface DetectedMilitaryShip {
	id: string;
	name: string;
	type: 'carrier' | 'destroyer' | 'submarine' | 'frigate' | 'cruiser' | 'amphibious' | 'unknown';
	country: string;
	lat?: number;
	lon?: number;
	location?: string;
	source: string; // News article that mentioned it
	timestamp: string;
	context: string; // Surrounding text from the article
}

// Military ship name patterns (common prefixes and ship classes)
const SHIP_PATTERNS = {
	// US Navy
	US: /\b(USS|CVN|DDG|LCS|LHD)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Royal Navy
	UK: /\b(HMS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Chinese Navy
	CN: /\b(CNS|PLAN)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)|Type\s+\d{3}\s+destroyer/gi,
	// Russian Navy
	RU: /\b(RFS|Admiral)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// French Navy
	FR: /\b(FS|FNS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Indian Navy
	IN: /\b(INS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Japanese Navy
	JP: /\b(JS|JMSDF)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g
};

// Ship type keywords
const TYPE_KEYWORDS: Record<string, string[]> = {
	carrier: ['carrier', 'CVN', 'aircraft carrier', 'supercarrier'],
	destroyer: ['destroyer', 'DDG', 'Type 055', 'Type 052', 'Arleigh Burke'],
	submarine: ['submarine', 'sub', 'SSN', 'SSBN', 'attack sub'],
	frigate: ['frigate', 'FFG', 'Type 054'],
	cruiser: ['cruiser', 'CG', 'Ticonderoga', 'Slava'],
	amphibious: ['amphibious', 'LHD', 'LHA', 'landing ship']
};

// Location patterns (maritime locations in news)
const LOCATION_PATTERNS = [
	{ name: 'South China Sea', lat: 12.0, lon: 114.0 },
	{ name: 'Taiwan Strait', lat: 25.0, lon: 120.0 },
	{ name: 'Persian Gulf', lat: 26.0, lon: 52.0 },
	{ name: 'Gulf of Aden', lat: 12.0, lon: 48.0 },
	{ name: 'Mediterranean Sea', lat: 35.0, lon: 18.0 },
	{ name: 'Black Sea', lat: 43.0, lon: 34.0 },
	{ name: 'Arabian Sea', lat: 16.0, lon: 65.0 },
	{ name: 'East China Sea', lat: 28.0, lon: 125.0 },
	{ name: 'Baltic Sea', lat: 58.0, lon: 20.0 },
	{ name: 'Barents Sea', lat: 74.0, lon: 40.0 },
	{ name: 'Philippine Sea', lat: 20.0, lon: 130.0 }
];

/**
 * Detect military ships mentioned in news articles
 */
export function detectMilitaryShips(newsItems: NewsItem[]): DetectedMilitaryShip[] {
	const detectedShips: DetectedMilitaryShip[] = [];
	const seenShips = new Set<string>(); // Prevent duplicates

	for (const item of newsItems) {
		const text = `${item.title} ${item.description}`.toLowerCase();

		// Check for military ship patterns
		for (const [country, pattern] of Object.entries(SHIP_PATTERNS)) {
			const fullText = `${item.title} ${item.description}`;
			const matches = fullText.matchAll(pattern);

			for (const match of matches) {
				const shipName = match[0];
				const shipId = `${country}-${shipName.replace(/\s+/g, '-')}`;

				// Skip if already seen
				if (seenShips.has(shipId)) continue;
				seenShips.add(shipId);

				// Determine ship type
				const shipType = determineShipType(fullText);

				// Try to extract location
				const location = extractLocation(fullText);

				detectedShips.push({
					id: shipId,
					name: shipName,
					type: shipType,
					country,
					lat: location?.lat,
					lon: location?.lon,
					location: location?.name,
					source: item.url,
					timestamp: item.timestamp,
					context: extractContext(fullText, shipName)
				});
			}
		}
	}

	return detectedShips;
}

/**
 * Determine ship type from text context
 */
function determineShipType(text: string): DetectedMilitaryShip['type'] {
	const lowerText = text.toLowerCase();

	for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
		for (const keyword of keywords) {
			if (lowerText.includes(keyword.toLowerCase())) {
				return type as DetectedMilitaryShip['type'];
			}
		}
	}

	return 'unknown';
}

/**
 * Extract location from text
 */
function extractLocation(text: string): { name: string; lat: number; lon: number } | null {
	const lowerText = text.toLowerCase();

	for (const loc of LOCATION_PATTERNS) {
		if (lowerText.includes(loc.name.toLowerCase())) {
			return loc;
		}
	}

	return null;
}

/**
 * Extract context around ship mention (50 chars before and after)
 */
function extractContext(text: string, shipName: string, contextLength = 50): string {
	const index = text.indexOf(shipName);
	if (index === -1) return '';

	const start = Math.max(0, index - contextLength);
	const end = Math.min(text.length, index + shipName.length + contextLength);

	let context = text.substring(start, end);
	if (start > 0) context = '...' + context;
	if (end < text.length) context = context + '...';

	return context.trim();
}

/**
 * Get ship type color for map visualization
 */
export function getShipTypeColor(type: DetectedMilitaryShip['type']): string {
	switch (type) {
		case 'carrier':
			return '#dc2626'; // Red - high value target
		case 'destroyer':
			return '#f97316'; // Orange - major combatant
		case 'submarine':
			return '#7c3aed'; // Purple - stealth threat
		case 'frigate':
			return '#eab308'; // Yellow - medium combatant
		case 'cruiser':
			return '#f97316'; // Orange - major combatant
		case 'amphibious':
			return '#10b981'; // Green - support vessel
		default:
			return '#6b7280'; // Gray - unknown
	}
}

/**
 * Get ship type icon
 */
export function getShipTypeIcon(type: DetectedMilitaryShip['type']): string {
	switch (type) {
		case 'carrier':
			return '🛫';
		case 'destroyer':
			return '⚓';
		case 'submarine':
			return '🔱';
		case 'frigate':
			return '⛵';
		case 'cruiser':
			return '⚓';
		case 'amphibious':
			return '🚢';
		default:
			return '🚢';
	}
}
