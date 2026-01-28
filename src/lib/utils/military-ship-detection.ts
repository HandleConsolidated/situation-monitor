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
	previousLocations?: ShipPosition[]; // Movement history
	velocity?: number; // km/h if calculable
	heading?: number; // degrees 0-360
}

export interface ShipPosition {
	lat: number;
	lon: number;
	location?: string;
	timestamp: string;
	source: string;
}

export interface ProximityAlert {
	shipId: string;
	shipName: string;
	shipCountry: string;
	hotspot: string;
	distance: number; // km
	severity: 'critical' | 'warning' | 'watch';
	timestamp: string;
}

export interface ThreatAssessment {
	shipId: string;
	shipName: string;
	threatLevel: 'extreme' | 'high' | 'medium' | 'low';
	threatScore: number; // 0-100
	factors: {
		shipType: number;
		location: number;
		proximity: number;
		velocity: number;
		formation: number;
	};
	reasoning: string[];
	timestamp: string;
}

export interface ShipFormation {
	id: string;
	name: string;
	ships: string[]; // ship IDs
	country: string;
	formationType: 'carrier_group' | 'convoy' | 'patrol' | 'task_force' | 'unknown';
	centerLat: number;
	centerLon: number;
	radius: number; // km
	heading?: number;
	velocity?: number;
	detectedAt: string;
}

export interface PredictedPosition {
	lat: number;
	lon: number;
	timestamp: string; // When ship is predicted to be at this position
	confidence: number; // 0-1
}

export interface ShipCapabilities {
	displacement: number; // tons
	length: number; // meters
	beam: number; // meters
	speed: number; // knots
	range: number; // nautical miles
	crew: number;
	armament: string[];
	sensors: string[];
	aircraft?: {
		fixed: number;
		rotary: number;
	};
	commissioned?: string;
}

export interface ShipDatabase {
	[shipName: string]: ShipCapabilities;
}

// Ship tracking history (in-memory store, could be persisted)
const shipTrackingHistory = new Map<string, ShipPosition[]>();

// Proximity alert thresholds (km)
const PROXIMITY_THRESHOLDS = {
	critical: 50,  // Within 50km of hotspot
	warning: 150,  // Within 150km
	watch: 300     // Within 300km
};

// Ship capabilities database (major warships)
const SHIP_DATABASE: ShipDatabase = {
	// US Navy Carriers
	'USS Gerald R. Ford': {
		displacement: 100000,
		length: 337,
		beam: 78,
		speed: 30,
		range: 9999,
		crew: 4539,
		armament: ['RIM-162 ESSM', 'RIM-116 RAM', 'Phalanx CIWS'],
		sensors: ['AN/SPY-3', 'AN/SPY-4', 'AN/SLQ-32'],
		aircraft: { fixed: 75, rotary: 0 },
		commissioned: '2017-07-22'
	},
	'USS Ronald Reagan': {
		displacement: 97000,
		length: 333,
		beam: 77,
		speed: 30,
		range: 9999,
		crew: 5680,
		armament: ['RIM-162 ESSM', 'RIM-116 RAM'],
		sensors: ['AN/SPS-48', 'AN/SPS-49'],
		aircraft: { fixed: 90, rotary: 0 },
		commissioned: '2003-07-12'
	},
	'USS Nimitz': {
		displacement: 97000,
		length: 333,
		beam: 77,
		speed: 30,
		range: 9999,
		crew: 5680,
		armament: ['RIM-162 ESSM', 'RIM-116 RAM'],
		sensors: ['AN/SPS-48', 'AN/SPS-49'],
		aircraft: { fixed: 90, rotary: 0 },
		commissioned: '1975-05-03'
	},
	
	// US Navy Destroyers
	'USS Arleigh Burke': {
		displacement: 9200,
		length: 155,
		beam: 20,
		speed: 30,
		range: 4400,
		crew: 380,
		armament: ['Mk 41 VLS (90-96 cells)', 'Tomahawk', 'SM-2', 'ESSM', 'ASROC', '5-inch gun', 'Harpoon'],
		sensors: ['AN/SPY-1D', 'AN/SQS-53C'],
		commissioned: '1991-07-04'
	},
	
	// Chinese Navy
	'Liaoning': {
		displacement: 60000,
		length: 305,
		beam: 75,
		speed: 29,
		range: 3850,
		crew: 2626,
		armament: ['HHQ-10', 'Type 1130 CIWS'],
		sensors: ['Type 346 AESA', 'Type 382'],
		aircraft: { fixed: 24, rotary: 2 },
		commissioned: '2012-09-25'
	},
	'Shandong': {
		displacement: 70000,
		length: 315,
		beam: 75,
		speed: 28,
		range: 3850,
		crew: 2626,
		armament: ['HHQ-10', 'Type 1130 CIWS'],
		sensors: ['Type 346A AESA'],
		aircraft: { fixed: 36, rotary: 2 },
		commissioned: '2019-12-17'
	},
	
	// Royal Navy
	'HMS Queen Elizabeth': {
		displacement: 65000,
		length: 284,
		beam: 73,
		speed: 25,
		range: 10000,
		crew: 1600,
		armament: ['Phalanx CIWS', '30mm DS30M'],
		sensors: ['Type 997 Artisan', 'Type 1046'],
		aircraft: { fixed: 40, rotary: 0 },
		commissioned: '2017-12-07'
	},
	'HMS Prince of Wales': {
		displacement: 65000,
		length: 284,
		beam: 73,
		speed: 25,
		range: 10000,
		crew: 1600,
		armament: ['Phalanx CIWS', '30mm DS30M'],
		sensors: ['Type 997 Artisan'],
		aircraft: { fixed: 40, rotary: 0 },
		commissioned: '2019-12-10'
	},
	
	// Russian Navy
	'Admiral Kuznetsov': {
		displacement: 58500,
		length: 305,
		beam: 72,
		speed: 29,
		range: 3850,
		crew: 1960,
		armament: ['Granit AShM', 'Kinzhal SAM', 'AK-630 CIWS', '30mm AK-630'],
		sensors: ['Polyment', 'Fregat-M2EM'],
		aircraft: { fixed: 18, rotary: 17 },
		commissioned: '1990-12-25'
	},
	'Pyotr Velikiy': {
		displacement: 25860,
		length: 252,
		beam: 29,
		speed: 32,
		range: 5000,
		crew: 727,
		armament: ['Granit AShM', 'S-300F SAM', 'RBU-6000', '130mm gun'],
		sensors: ['S-300F Fort', 'Polynom'],
		commissioned: '1998-04-18'
	},
	
	// French Navy
	'Charles de Gaulle': {
		displacement: 42000,
		length: 262,
		beam: 64,
		speed: 27,
		range: 9999,
		crew: 1950,
		armament: ['Aster 15 SAM', 'Mistral', 'Sadral'],
		sensors: ['DRBJ 11B', 'ARABEL'],
		aircraft: { fixed: 30, rotary: 2 },
		commissioned: '2001-05-18'
	},
	
	// Indian Navy
	'INS Vikramaditya': {
		displacement: 45400,
		length: 284,
		beam: 60,
		speed: 32,
		range: 7000,
		crew: 1400,
		armament: ['Barak SAM', 'AK-630 CIWS'],
		sensors: ['MR-710 Fregat-M2EM'],
		aircraft: { fixed: 26, rotary: 10 },
		commissioned: '2013-11-16'
	},
	
	// Japanese MSDF
	'JS Izumo': {
		displacement: 27000,
		length: 248,
		beam: 38,
		speed: 30,
		range: 9999,
		crew: 520,
		armament: ['Phalanx CIWS', 'SeaRAM'],
		sensors: ['FCS-3', 'OPS-50'],
		aircraft: { fixed: 14, rotary: 7 },
		commissioned: '2015-03-25'
	},
	'JS Kaga': {
		displacement: 27000,
		length: 248,
		beam: 38,
		speed: 30,
		range: 9999,
		crew: 520,
		armament: ['Phalanx CIWS', 'SeaRAM'],
		sensors: ['FCS-3', 'OPS-50'],
		aircraft: { fixed: 14, rotary: 7 },
		commissioned: '2017-03-22'
	}
};

// Military ship name patterns (common prefixes and ship classes)
const SHIP_PATTERNS = {
	// US Navy
	US: /\b(USS|CVN|DDG|CG|LCS|LHD|LHA|SSN|SSBN)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Royal Navy (UK)
	UK: /\b(HMS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Chinese Navy (PLAN)
	CN: /\b(CNS|PLAN)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)|Type\s+\d{3}\s+(destroyer|frigate|carrier)|Liaoning|Shandong/gi,
	// Russian Navy
	RU: /\b(RFS|Admiral|Pyotr\s+Velikiy|Kirov|Slava)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// French Navy
	FR: /\b(FS|FNS|Charles\s+de\s+Gaulle)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Indian Navy
	IN: /\b(INS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Japanese Maritime Self-Defense Force
	JP: /\b(JS|JMSDF)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// South Korean Navy (ROKN)
	KR: /\b(ROKS|ROKN)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Australian Navy (RAN)
	AU: /\b(HMAS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Canadian Navy (RCN)
	CA: /\b(HMCS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// German Navy
	DE: /\b(FGS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Italian Navy
	IT: /\b(ITS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)|Cavour|Garibaldi/gi,
	// Spanish Navy
	ES: /\b(SPS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)|Juan\s+Carlos\s+I/gi,
	// Turkish Navy
	TR: /\b(TCG)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Israeli Navy
	IL: /\b(INS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Iranian Navy
	IR: /\b(IRIS|Sahand|Damavand|Jamaran)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi,
	// North Korean Navy
	KP: /North\s+Korean\s+(warship|vessel|submarine|patrol\s+boat)/gi,
	// Brazilian Navy
	BR: /\b(NAe|NAsM)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)|São\s+Paulo/gi,
	// Pakistani Navy
	PK: /\b(PNS)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
	// Saudi Navy
	SA: /\b(RSNF)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g
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

// Location patterns (maritime locations in news) - EXPANDED
const LOCATION_PATTERNS = [
	// Asia-Pacific Critical Waters
	{ name: 'South China Sea', lat: 12.0, lon: 114.0, radius: 500 },
	{ name: 'Taiwan Strait', lat: 25.0, lon: 120.0, radius: 100 },
	{ name: 'East China Sea', lat: 28.0, lon: 125.0, radius: 400 },
	{ name: 'Philippine Sea', lat: 20.0, lon: 130.0, radius: 600 },
	{ name: 'Sea of Japan', lat: 40.0, lon: 135.0, radius: 400 },
	{ name: 'Yellow Sea', lat: 36.0, lon: 123.0, radius: 300 },
	{ name: 'Luzon Strait', lat: 20.5, lon: 121.0, radius: 100 },
	{ name: 'Miyako Strait', lat: 25.0, lon: 125.5, radius: 50 },
	
	// Middle East & Arabian Waters
	{ name: 'Persian Gulf', lat: 26.0, lon: 52.0, radius: 400 },
	{ name: 'Gulf of Oman', lat: 24.5, lon: 58.5, radius: 300 },
	{ name: 'Arabian Sea', lat: 16.0, lon: 65.0, radius: 800 },
	{ name: 'Gulf of Aden', lat: 12.0, lon: 48.0, radius: 400 },
	{ name: 'Red Sea', lat: 20.0, lon: 38.0, radius: 600 },
	{ name: 'Strait of Hormuz', lat: 26.6, lon: 56.3, radius: 50 },
	{ name: 'Bab el-Mandeb', lat: 12.6, lon: 43.4, radius: 50 },
	
	// Mediterranean & Black Sea
	{ name: 'Mediterranean Sea', lat: 35.0, lon: 18.0, radius: 800 },
	{ name: 'Black Sea', lat: 43.0, lon: 34.0, radius: 400 },
	{ name: 'Aegean Sea', lat: 38.5, lon: 25.0, radius: 300 },
	{ name: 'Adriatic Sea', lat: 43.0, lon: 15.0, radius: 300 },
	{ name: 'Sea of Azov', lat: 46.0, lon: 36.0, radius: 150 },
	{ name: 'Strait of Gibraltar', lat: 36.0, lon: -5.5, radius: 30 },
	{ name: 'Bosphorus', lat: 41.0, lon: 29.0, radius: 30 },
	
	// European Waters
	{ name: 'Baltic Sea', lat: 58.0, lon: 20.0, radius: 500 },
	{ name: 'North Sea', lat: 56.0, lon: 3.0, radius: 500 },
	{ name: 'Norwegian Sea', lat: 68.0, lon: 5.0, radius: 600 },
	{ name: 'Barents Sea', lat: 74.0, lon: 40.0, radius: 600 },
	{ name: 'English Channel', lat: 50.0, lon: -1.0, radius: 100 },
	
	// Indian Ocean
	{ name: 'Bay of Bengal', lat: 15.0, lon: 88.0, radius: 600 },
	{ name: 'Andaman Sea', lat: 10.0, lon: 96.0, radius: 300 },
	{ name: 'Mozambique Channel', lat: -18.0, lon: 41.0, radius: 400 },
	
	// Atlantic
	{ name: 'Caribbean Sea', lat: 15.0, lon: -75.0, radius: 800 },
	{ name: 'Gulf of Mexico', lat: 25.0, lon: -90.0, radius: 600 },
	{ name: 'North Atlantic', lat: 45.0, lon: -30.0, radius: 1000 },
	{ name: 'South Atlantic', lat: -30.0, lon: -20.0, radius: 1000 },
	
	// Pacific
	{ name: 'Coral Sea', lat: -15.0, lon: 155.0, radius: 600 },
	{ name: 'Tasman Sea', lat: -35.0, lon: 160.0, radius: 600 },
	{ name: 'Sea of Okhotsk', lat: 55.0, lon: 150.0, radius: 500 },
	{ name: 'Bering Sea', lat: 58.0, lon: -175.0, radius: 600 },
	
	// Critical Straits & Chokepoints
	{ name: 'Malacca Strait', lat: 2.5, lon: 101.0, radius: 400 },
	{ name: 'Sunda Strait', lat: -6.0, lon: 105.5, radius: 50 },
	{ name: 'Lombok Strait', lat: -8.5, lon: 115.5, radius: 50 },
	{ name: 'Suez Canal', lat: 30.5, lon: 32.3, radius: 100 },
	{ name: 'Panama Canal', lat: 9.0, lon: -79.5, radius: 50 },
	{ name: 'Danish Straits', lat: 55.5, lon: 12.0, radius: 100 },
	{ name: 'Dardanelles', lat: 40.2, lon: 26.4, radius: 50 },
	
	// Strategic Ports & Bases
	{ name: 'Pearl Harbor', lat: 21.35, lon: -157.95, radius: 20 },
	{ name: 'Guam', lat: 13.45, lon: 144.75, radius: 50 },
	{ name: 'Diego Garcia', lat: -7.3, lon: 72.4, radius: 30 },
	{ name: 'Yokosuka', lat: 35.3, lon: 139.7, radius: 20 },
	{ name: 'Norfolk', lat: 36.95, lon: -76.3, radius: 30 },
	{ name: 'Portsmouth', lat: 50.8, lon: -1.1, radius: 20 },
	{ name: 'Severomorsk', lat: 69.1, lon: 33.4, radius: 30 },
	{ name: 'Qingdao', lat: 36.1, lon: 120.4, radius: 30 },
	{ name: 'Hainan', lat: 18.3, lon: 109.5, radius: 50 }
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

/**
 * Update ship tracking history with new position
 */
export function updateShipTracking(ship: DetectedMilitaryShip): void {
	if (!ship.lat || !ship.lon) return;

	const history = shipTrackingHistory.get(ship.id) || [];
	
	const newPosition: ShipPosition = {
		lat: ship.lat,
		lon: ship.lon,
		location: ship.location,
		timestamp: ship.timestamp,
		source: ship.source
	};

	// Add to history (keep last 50 positions)
	history.push(newPosition);
	if (history.length > 50) {
		history.shift();
	}

	shipTrackingHistory.set(ship.id, history);

	// Update ship with tracking data
	ship.previousLocations = history;
	
	// Calculate velocity and heading if we have previous position
	if (history.length >= 2) {
		const prev = history[history.length - 2];
		const curr = history[history.length - 1];
		
		const distance = calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
		const timeDiff = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 3600000; // hours
		
		if (timeDiff > 0) {
			ship.velocity = distance / timeDiff; // km/h
		}
		
		ship.heading = calculateHeading(prev.lat, prev.lon, curr.lat, curr.lon);
	}
}

/**
 * Get tracking history for a ship
 */
export function getShipTrackingHistory(shipId: string): ShipPosition[] {
	return shipTrackingHistory.get(shipId) || [];
}

/**
 * Clear old tracking history (older than 30 days)
 */
export function cleanupTrackingHistory(): void {
	const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
	
	for (const [shipId, history] of shipTrackingHistory.entries()) {
		const filtered = history.filter(pos => 
			new Date(pos.timestamp).getTime() > thirtyDaysAgo
		);
		
		if (filtered.length === 0) {
			shipTrackingHistory.delete(shipId);
		} else {
			shipTrackingHistory.set(shipId, filtered);
		}
	}
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371; // Earth's radius in km
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	
	const a = 
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
		Math.sin(dLon / 2) * Math.sin(dLon / 2);
	
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * Calculate heading between two points (in degrees, 0-360)
 */
function calculateHeading(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const dLon = toRad(lon2 - lon1);
	const y = Math.sin(dLon) * Math.cos(toRad(lat2));
	const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
		Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
	
	const heading = toDeg(Math.atan2(y, x));
	return (heading + 360) % 360; // Normalize to 0-360
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
	return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDeg(radians: number): number {
	return radians * (180 / Math.PI);
}

/**
 * Check for proximity alerts between ships and hotspots
 * @param ships - Detected military ships
 * @param hotspots - Array of hotspot coordinates with names
 */
export function checkProximityAlerts(
	ships: DetectedMilitaryShip[],
	hotspots: Array<{ name: string; lat: number; lon: number }>
): ProximityAlert[] {
	const alerts: ProximityAlert[] = [];

	for (const ship of ships) {
		if (!ship.lat || !ship.lon) continue;

		for (const hotspot of hotspots) {
			const distance = calculateDistance(ship.lat, ship.lon, hotspot.lat, hotspot.lon);

			let severity: ProximityAlert['severity'] | null = null;

			if (distance <= PROXIMITY_THRESHOLDS.critical) {
				severity = 'critical';
			} else if (distance <= PROXIMITY_THRESHOLDS.warning) {
				severity = 'warning';
			} else if (distance <= PROXIMITY_THRESHOLDS.watch) {
				severity = 'watch';
			}

			if (severity) {
				alerts.push({
					shipId: ship.id,
					shipName: ship.name,
					shipCountry: ship.country,
					hotspot: hotspot.name,
					distance: Math.round(distance),
					severity,
					timestamp: ship.timestamp
				});
			}
		}
	}

	// Sort by severity (critical first) then distance
	alerts.sort((a, b) => {
		const severityOrder = { critical: 0, warning: 1, watch: 2 };
		const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
		if (severityDiff !== 0) return severityDiff;
		return a.distance - b.distance;
	});

	return alerts;
}

/**
 * Get proximity alert color
 */
export function getProximityAlertColor(severity: ProximityAlert['severity']): string {
	switch (severity) {
		case 'critical':
			return '#dc2626';
		case 'warning':
			return '#f97316';
		case 'watch':
			return '#eab308';
		default:
			return '#6b7280';
	}
}

/**
 * Format proximity alert message
 */
export function formatProximityAlert(alert: ProximityAlert): string {
	const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : '👁️';
	return `${emoji} ${alert.shipName} (${alert.shipCountry}) is ${alert.distance}km from ${alert.hotspot}`;
}

/**
 * Detect ships with enhanced tracking
 * Updates tracking history and calculates movement
 */
export function detectMilitaryShipsWithTracking(newsItems: NewsItem[]): DetectedMilitaryShip[] {
	const ships = detectMilitaryShips(newsItems);
	
	// Update tracking for each detected ship
	ships.forEach(ship => updateShipTracking(ship));
	
	// Load persisted history from localStorage
	loadTrackingHistory();
	
	// Save updated history
	saveTrackingHistory();
	
	return ships;
}

/**
 * Calculate threat level for a ship based on multiple factors
 */
export function assessThreat(
	ship: DetectedMilitaryShip,
	hotspots: Array<{ name: string; lat: number; lon: number }>
): ThreatAssessment {
	const factors = {
		shipType: 0,
		location: 0,
		proximity: 0,
		velocity: 0,
		formation: 0
	};
	const reasoning: string[] = [];

	// Ship type scoring (0-30 points)
	switch (ship.type) {
		case 'carrier':
			factors.shipType = 30;
			reasoning.push('Aircraft carrier - strategic asset');
			break;
		case 'submarine':
			factors.shipType = 28;
			reasoning.push('Submarine - stealth threat');
			break;
		case 'cruiser':
			factors.shipType = 22;
			reasoning.push('Cruiser - major combatant');
			break;
		case 'destroyer':
			factors.shipType = 20;
			reasoning.push('Destroyer - surface combatant');
			break;
		case 'frigate':
			factors.shipType = 15;
			reasoning.push('Frigate - patrol vessel');
			break;
		case 'amphibious':
			factors.shipType = 18;
			reasoning.push('Amphibious - potential landing force');
			break;
		default:
			factors.shipType = 10;
	}

	// Location scoring (0-25 points) - Critical areas
	if (ship.location) {
		const criticalAreas = [
			'Taiwan Strait', 'South China Sea', 'Korean Peninsula',
			'Persian Gulf', 'Strait of Hormuz', 'Black Sea',
			'Baltic Sea', 'Eastern Mediterranean'
		];
		
		if (criticalAreas.some(area => ship.location?.includes(area))) {
			factors.location = 25;
			reasoning.push(`Operating in high-tension area: ${ship.location}`);
		} else {
			factors.location = 10;
			reasoning.push(`Active in: ${ship.location}`);
		}
	}

	// Proximity scoring (0-25 points)
	if (ship.lat && ship.lon && hotspots.length > 0) {
		let minDistance = Infinity;
		let nearestHotspot = '';

		for (const hotspot of hotspots) {
			const distance = calculateDistance(ship.lat, ship.lon, hotspot.lat, hotspot.lon);
			if (distance < minDistance) {
				minDistance = distance;
				nearestHotspot = hotspot.name;
			}
		}

		if (minDistance < 50) {
			factors.proximity = 25;
			reasoning.push(`Critical proximity: ${Math.round(minDistance)}km from ${nearestHotspot}`);
		} else if (minDistance < 150) {
			factors.proximity = 18;
			reasoning.push(`Close proximity: ${Math.round(minDistance)}km from ${nearestHotspot}`);
		} else if (minDistance < 300) {
			factors.proximity = 10;
			reasoning.push(`Nearby: ${Math.round(minDistance)}km from ${nearestHotspot}`);
		} else {
			factors.proximity = 5;
		}
	}

	// Velocity scoring (0-10 points) - Fast movement = higher alert
	if (ship.velocity) {
		if (ship.velocity > 30) {
			factors.velocity = 10;
			reasoning.push(`High speed: ${Math.round(ship.velocity)} km/h`);
		} else if (ship.velocity > 20) {
			factors.velocity = 7;
			reasoning.push(`Moderate speed: ${Math.round(ship.velocity)} km/h`);
		} else if (ship.velocity > 10) {
			factors.velocity = 4;
			reasoning.push(`Moving: ${Math.round(ship.velocity)} km/h`);
		} else {
			factors.velocity = 2;
			reasoning.push('Slow or stationary');
		}
	}

	// Formation bonus (0-10 points) - Will be calculated externally
	factors.formation = 0;

	// Calculate total threat score (0-100)
	const threatScore = Object.values(factors).reduce((sum, val) => sum + val, 0);

	// Determine threat level
	let threatLevel: ThreatAssessment['threatLevel'];
	if (threatScore >= 75) {
		threatLevel = 'extreme';
	} else if (threatScore >= 50) {
		threatLevel = 'high';
	} else if (threatScore >= 25) {
		threatLevel = 'medium';
	} else {
		threatLevel = 'low';
	}

	return {
		shipId: ship.id,
		shipName: ship.name,
		threatLevel,
		threatScore,
		factors,
		reasoning,
		timestamp: new Date().toISOString()
	};
}

/**
 * Detect ship formations (groups of ships traveling together)
 */
export function detectFormations(ships: DetectedMilitaryShip[]): ShipFormation[] {
	const formations: ShipFormation[] = [];
	const processedShips = new Set<string>();

	// Group ships by country and proximity
	for (const ship of ships) {
		if (processedShips.has(ship.id) || !ship.lat || !ship.lon) continue;

		const group: DetectedMilitaryShip[] = [ship];
		processedShips.add(ship.id);

		// Find nearby ships from same country
		for (const otherShip of ships) {
			if (
				otherShip.id !== ship.id &&
				!processedShips.has(otherShip.id) &&
				otherShip.country === ship.country &&
				otherShip.lat &&
				otherShip.lon
			) {
				const distance = calculateDistance(ship.lat, ship.lon, otherShip.lat, otherShip.lon);
				
				// Ships within 100km are considered a formation
				if (distance <= 100) {
					group.push(otherShip);
					processedShips.add(otherShip.id);
				}
			}
		}

		// Only create formation if 2+ ships
		if (group.length >= 2) {
			// Calculate center point
			const centerLat = group.reduce((sum, s) => sum + (s.lat || 0), 0) / group.length;
			const centerLon = group.reduce((sum, s) => sum + (s.lon || 0), 0) / group.length;

			// Calculate radius (max distance from center)
			const radius = Math.max(
				...group.map(s =>
					calculateDistance(centerLat, centerLon, s.lat || 0, s.lon || 0)
				)
			);

			// Determine formation type
			const hasCarrier = group.some(s => s.type === 'carrier');
			const hasAmphibious = group.some(s => s.type === 'amphibious');
			const shipCount = group.length;

			let formationType: ShipFormation['formationType'];
			let name: string;

			if (hasCarrier && shipCount >= 3) {
				formationType = 'carrier_group';
				name = `${ship.country} Carrier Strike Group`;
			} else if (hasAmphibious && shipCount >= 3) {
				formationType = 'task_force';
				name = `${ship.country} Amphibious Task Force`;
			} else if (shipCount >= 5) {
				formationType = 'task_force';
				name = `${ship.country} Naval Task Force`;
			} else if (shipCount >= 3) {
				formationType = 'patrol';
				name = `${ship.country} Patrol Group`;
			} else {
				formationType = 'convoy';
				name = `${ship.country} Naval Convoy`;
			}

			// Calculate average heading and velocity
			const shipsWithHeading = group.filter(s => s.heading !== undefined);
			const shipsWithVelocity = group.filter(s => s.velocity !== undefined);

			const heading =
				shipsWithHeading.length > 0
					? shipsWithHeading.reduce((sum, s) => sum + (s.heading || 0), 0) / shipsWithHeading.length
					: undefined;

			const velocity =
				shipsWithVelocity.length > 0
					? shipsWithVelocity.reduce((sum, s) => sum + (s.velocity || 0), 0) / shipsWithVelocity.length
					: undefined;

			formations.push({
				id: `formation-${ship.country}-${Date.now()}-${formations.length}`,
				name,
				ships: group.map(s => s.id),
				country: ship.country,
				formationType,
				centerLat,
				centerLon,
				radius,
				heading,
				velocity,
				detectedAt: new Date().toISOString()
			});
		}
	}

	return formations;
}

/**
 * Predict future position of a ship based on current trajectory
 */
export function predictPosition(
	ship: DetectedMilitaryShip,
	hoursAhead: number
): PredictedPosition | null {
	if (!ship.lat || !ship.lon || !ship.heading || !ship.velocity) {
		return null;
	}

	// Convert velocity from km/h to km
	const distanceKm = ship.velocity * hoursAhead;

	// Convert heading to radians
	const headingRad = toRad(ship.heading);

	// Calculate new position using great circle navigation
	const R = 6371; // Earth's radius in km
	const lat1 = toRad(ship.lat);
	const lon1 = toRad(ship.lon);

	const lat2 = Math.asin(
		Math.sin(lat1) * Math.cos(distanceKm / R) +
		Math.cos(lat1) * Math.sin(distanceKm / R) * Math.cos(headingRad)
	);

	const lon2 = lon1 + Math.atan2(
		Math.sin(headingRad) * Math.sin(distanceKm / R) * Math.cos(lat1),
		Math.cos(distanceKm / R) - Math.sin(lat1) * Math.sin(lat2)
	);

	// Calculate confidence based on data quality
	const confidence = calculatePredictionConfidence(ship);

	const futureTime = new Date();
	futureTime.setHours(futureTime.getHours() + hoursAhead);

	return {
		lat: toDeg(lat2),
		lon: toDeg(lon2),
		timestamp: futureTime.toISOString(),
		confidence
	};
}

/**
 * Calculate confidence in position prediction
 */
function calculatePredictionConfidence(ship: DetectedMilitaryShip): number {
	let confidence = 0.5; // Base confidence

	// More history = better confidence
	const historyLength = ship.previousLocations?.length || 0;
	if (historyLength >= 5) confidence += 0.2;
	else if (historyLength >= 3) confidence += 0.1;

	// Recent velocity data improves confidence
	if (ship.velocity) confidence += 0.15;

	// Recent heading data improves confidence
	if (ship.heading) confidence += 0.15;

	return Math.min(confidence, 1.0);
}

/**
 * Get ship capabilities from database
 */
export function getShipCapabilities(shipName: string): ShipCapabilities | null {
	// Try exact match first
	if (SHIP_DATABASE[shipName]) {
		return SHIP_DATABASE[shipName];
	}

	// Try partial match (e.g., "USS Ronald Reagan" contains "Ronald Reagan")
	for (const [dbShipName, capabilities] of Object.entries(SHIP_DATABASE)) {
		if (shipName.includes(dbShipName) || dbShipName.includes(shipName)) {
			return capabilities;
		}
	}

	return null;
}

/**
 * Save tracking history to localStorage
 */
export function saveTrackingHistory(): void {
	if (typeof window === 'undefined') return;

	try {
		const data: Record<string, ShipPosition[]> = {};
		shipTrackingHistory.forEach((value, key) => {
			data[key] = value;
		});

		localStorage.setItem('shipTrackingHistory', JSON.stringify(data));
	} catch (error) {
		console.error('Failed to save tracking history:', error);
	}
}

/**
 * Load tracking history from localStorage
 */
export function loadTrackingHistory(): void {
	if (typeof window === 'undefined') return;

	try {
		const data = localStorage.getItem('shipTrackingHistory');
		if (data) {
			const parsed = JSON.parse(data);
			for (const [key, value] of Object.entries(parsed)) {
				shipTrackingHistory.set(key, value as ShipPosition[]);
			}
		}
	} catch (error) {
		console.error('Failed to load tracking history:', error);
	}
}

/**
 * Get threat level color
 */
export function getThreatLevelColor(level: ThreatAssessment['threatLevel']): string {
	switch (level) {
		case 'extreme':
			return '#991b1b'; // Dark red
		case 'high':
			return '#dc2626'; // Red
		case 'medium':
			return '#f97316'; // Orange
		case 'low':
			return '#10b981'; // Green
		default:
			return '#6b7280'; // Gray
	}
}

/**
 * Get threat level emoji
 */
export function getThreatLevelEmoji(level: ThreatAssessment['threatLevel']): string {
	switch (level) {
		case 'extreme':
			return '🚨';
		case 'high':
			return '⚠️';
		case 'medium':
			return '👁️';
		case 'low':
			return '✅';
		default:
			return '❓';
	}
}

/**
 * Get formation type emoji
 */
export function getFormationTypeEmoji(type: ShipFormation['formationType']): string {
	switch (type) {
		case 'carrier_group':
			return '🛫';
		case 'task_force':
			return '⚓';
		case 'patrol':
			return '👁️';
		case 'convoy':
			return '🚢';
		default:
			return '⚓';
	}
}
