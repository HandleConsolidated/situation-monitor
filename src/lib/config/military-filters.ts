/**
 * Military Base Filtering Configuration
 * Provides utilities for filtering and categorizing the 346+ military bases
 */

import type { MilitaryBase } from './map';

/**
 * Country/Alliance groupings for quick filtering
 */
export const MILITARY_ALLIANCES = {
	NATO: ['US', 'GB', 'FR', 'DE', 'IT', 'ES', 'PL', 'CA', 'NL', 'BE', 'TR', 'NO', 'DK', 'PT', 'CZ', 'HU', 'RO', 'BG', 'GR', 'SK', 'SI', 'LV', 'LT', 'EE', 'HR', 'AL', 'ME', 'MK', 'FI', 'SE'],
	CSTO: ['RU', 'BY', 'KZ', 'AM', 'KG', 'TJ'],
	FIVE_EYES: ['US', 'GB', 'CA', 'AU', 'NZ'],
	QUAD: ['US', 'IN', 'JP', 'AU'],
	SCO: ['CN', 'RU', 'IN', 'PK', 'KZ', 'UZ', 'KG', 'TJ'],
	ASEAN: ['SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'MM', 'LA', 'KH', 'BN']
} as const;

export type AllianceName = keyof typeof MILITARY_ALLIANCES;

/**
 * Regional groupings for geographic filtering
 */
export const MILITARY_REGIONS = {
	'North America': ['US', 'CA', 'MX'],
	'Europe': ['GB', 'FR', 'DE', 'IT', 'ES', 'PL', 'NL', 'BE', 'NO', 'DK', 'SE', 'FI', 'PT', 'CZ', 'HU', 'RO', 'BG', 'GR', 'SK', 'SI', 'LV', 'LT', 'EE', 'HR', 'AT', 'CH', 'IE'],
	'Middle East': ['TR', 'IL', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'IR', 'IQ', 'SY', 'JO', 'LB', 'YE'],
	'East Asia': ['CN', 'JP', 'KR', 'KP', 'TW', 'MN'],
	'South Asia': ['IN', 'PK', 'BD', 'LK', 'NP'],
	'Southeast Asia': ['SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'MM'],
	'Central Asia': ['KZ', 'UZ', 'TM', 'KG', 'TJ', 'AF'],
	'Oceania': ['AU', 'NZ'],
	'Africa': ['EG', 'ZA', 'NG', 'KE', 'ET', 'MA', 'DZ', 'LY', 'DJ', 'SD'],
	'South America': ['BR', 'AR', 'CL', 'CO', 'PE', 'VE'],
	'Caribbean': ['CU', 'DO', 'JM'],
	'Russia': ['RU']
} as const;

export type RegionName = keyof typeof MILITARY_REGIONS;

/**
 * Infer country code from military base description
 * Uses pattern matching on the description text
 */
export function inferCountryFromBase(base: MilitaryBase): string {
	const desc = base.desc.toLowerCase();
	
	// Direct country mentions in description
	if (desc.includes('us ') || desc.includes('u.s.') || desc.includes('american') || desc.includes('usaf') || desc.includes('usmc') || desc.includes('centcom') || desc.includes('indopacom')) return 'US';
	if (desc.includes('russian') || desc.includes('russia')) return 'RU';
	if (desc.includes('chinese') || desc.includes('china') || desc.includes('pla ')) return 'CN';
	if (desc.includes('british') || desc.includes('uk ') || desc.includes('royal navy') || desc.includes('royal air force') || desc.includes('raf ') || desc.includes('rnz')) return 'GB';
	if (desc.includes('french') || desc.includes('france')) return 'FR';
	if (desc.includes('german') || desc.includes('germany') || desc.includes('bundeswehr')) return 'DE';
	if (desc.includes('indian ') || desc.includes('india')) return 'IN';
	if (desc.includes('pakistan')) return 'PK';
	if (desc.includes('japan') || desc.includes('jmsdf') || desc.includes('jasdf') || desc.includes('jsdf')) return 'JP';
	if (desc.includes('south korea') || desc.includes('rok ')) return 'KR';
	if (desc.includes('north korea') || desc.includes('kpa') || desc.includes('kpn') || desc.includes('kpaf') || desc.includes('dprk')) return 'KP';
	if (desc.includes('israel') || desc.includes('israeli')) return 'IL';
	if (desc.includes('turk') || desc.includes('turkey')) return 'TR';
	if (desc.includes('iran') || desc.includes('iriaf')) return 'IR';
	if (desc.includes('saudi')) return 'SA';
	if (desc.includes('uae') || desc.includes('emirates')) return 'AE';
	if (desc.includes('egypt')) return 'EG';
	if (desc.includes('australia') || desc.includes('raaf') || desc.includes('ran ')) return 'AU';
	if (desc.includes('new zealand') || desc.includes('rnzn') || desc.includes('rnzaf')) return 'NZ';
	if (desc.includes('brazil')) return 'BR';
	if (desc.includes('argentin')) return 'AR';
	if (desc.includes('chile')) return 'CL';
	if (desc.includes('colombia')) return 'CO';
	if (desc.includes('peru')) return 'PE';
	if (desc.includes('venezuel')) return 'VE';
	if (desc.includes('canada') || desc.includes('rcn') || desc.includes('rcaf')) return 'CA';
	if (desc.includes('mexico') || desc.includes('mexican')) return 'MX';
	if (desc.includes('south africa')) return 'ZA';
	if (desc.includes('morocco')) return 'MA';
	if (desc.includes('algeria')) return 'DZ';
	if (desc.includes('libya')) return 'LY';
	if (desc.includes('nigeria')) return 'NG';
	if (desc.includes('kenya')) return 'KE';
	if (desc.includes('ethiopia')) return 'ET';
	if (desc.includes('djibouti')) return 'DJ';
	if (desc.includes('singapore')) return 'SG';
	if (desc.includes('indonesia')) return 'ID';
	if (desc.includes('malaysia')) return 'MY';
	if (desc.includes('thailand') || desc.includes('thai')) return 'TH';
	if (desc.includes('vietnam')) return 'VN';
	if (desc.includes('philippine')) return 'PH';
	if (desc.includes('taiwan') || desc.includes('roc ')) return 'TW';
	if (desc.includes('cuba')) return 'CU';
	if (desc.includes('polish') || desc.includes('poland')) return 'PL';
	if (desc.includes('spanish') || desc.includes('spain')) return 'ES';
	if (desc.includes('italian') || desc.includes('italy')) return 'IT';
	if (desc.includes('greek') || desc.includes('greece') || desc.includes('hellenic')) return 'GR';
	if (desc.includes('dutch') || desc.includes('netherlands')) return 'NL';
	if (desc.includes('belgian') || desc.includes('belgium')) return 'BE';
	if (desc.includes('norwegian') || desc.includes('norway')) return 'NO';
	if (desc.includes('danish') || desc.includes('denmark')) return 'DK';
	if (desc.includes('swedish') || desc.includes('sweden')) return 'SE';
	if (desc.includes('finnish') || desc.includes('finland')) return 'FI';
	if (desc.includes('czech')) return 'CZ';
	if (desc.includes('hungar')) return 'HU';
	if (desc.includes('romania')) return 'RO';
	if (desc.includes('bulgaria')) return 'BG';
	if (desc.includes('portugal')) return 'PT';
	if (desc.includes('estonia')) return 'EE';
	if (desc.includes('latvia')) return 'LV';
	if (desc.includes('lithuania')) return 'LT';
	
	// Default to unknown
	return 'XX';
}

/**
 * Infer base type from description
 */
export function inferBaseType(base: MilitaryBase): 'naval' | 'air' | 'army' | 'joint' | 'strategic' | 'other' {
	const desc = base.desc.toLowerCase();
	
	// Check for multiple indicators (joint)
	const hasNaval = desc.includes('navy') || desc.includes('naval') || desc.includes('fleet') || desc.includes('submarine') || desc.includes('carrier') || desc.includes('port');
	const hasAir = desc.includes('air force') || desc.includes('air base') || desc.includes('afb') || desc.includes('fighter') || desc.includes('bomber') || desc.includes('airlift');
	const hasArmy = desc.includes('army') || desc.includes('infantry') || desc.includes('armored') || desc.includes('division') || desc.includes('brigade');
	
	if ((hasNaval && hasAir) || (hasNaval && hasArmy) || (hasAir && hasArmy)) return 'joint';
	
	// Strategic installations
	if (desc.includes('nuclear') || desc.includes('missile') || desc.includes('strategic') || desc.includes('icbm') || desc.includes('ssbn') || desc.includes('trident')) return 'strategic';
	
	// Single type
	if (hasNaval) return 'naval';
	if (hasAir) return 'air';
	if (hasArmy) return 'army';
	
	// Marines/Special forces
	if (desc.includes('marine') || desc.includes('special ops') || desc.includes('special forces') || desc.includes('seal')) return 'joint';
	
	return 'other';
}

/**
 * Get country flag emoji from ISO country code
 */
export function getCountryFlag(countryCode: string): string {
	if (!countryCode || countryCode === 'XX') return '🏳️';
	
	// Convert country code to flag emoji
	const codePoints = countryCode
		.toUpperCase()
		.split('')
		.map(char => 127397 + char.charCodeAt(0));
	
	return String.fromCodePoint(...codePoints);
}

/**
 * Get color for base type
 */
export function getBaseTypeColor(type: string): string {
	switch (type) {
		case 'naval': return '#0ea5e9'; // Sky blue
		case 'air': return '#8b5cf6'; // Purple
		case 'army': return '#22c55e'; // Green
		case 'joint': return '#f59e0b'; // Amber
		case 'strategic': return '#ef4444'; // Red
		default: return '#3b82f6'; // Blue
	}
}

/**
 * Get icon for base type
 */
export function getBaseTypeIcon(type: string): string {
	switch (type) {
		case 'naval': return '⚓';
		case 'air': return '✈️';
		case 'army': return '🪖';
		case 'joint': return '⭐';
		case 'strategic': return '☢️';
		default: return '🏛️';
	}
}

/**
 * Precomputed base metadata for all bases
 * Call this once to enrich base data
 */
export function enrichMilitaryBases(bases: MilitaryBase[]): (MilitaryBase & { 
	inferredCountry: string; 
	inferredType: string;
	flag: string;
})[] {
	return bases.map(base => ({
		...base,
		inferredCountry: base.country || inferCountryFromBase(base),
		inferredType: base.type || inferBaseType(base),
		flag: getCountryFlag(base.country || inferCountryFromBase(base))
	}));
}

// ============================================================================
// Distance/Proximity Analysis
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
	lat1: number, lon1: number, 
	lat2: number, lon2: number
): number {
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

function toRad(deg: number): number {
	return deg * (Math.PI / 180);
}

/**
 * Find military bases within a certain distance of a point
 */
export function findBasesNearPoint(
	bases: MilitaryBase[],
	lat: number,
	lon: number,
	radiusKm: number
): (MilitaryBase & { distance: number })[] {
	return bases
		.map(base => ({
			...base,
			distance: calculateDistance(lat, lon, base.lat, base.lon)
		}))
		.filter(base => base.distance <= radiusKm)
		.sort((a, b) => a.distance - b.distance);
}

/**
 * Find bases near multiple hotspots
 */
export function findBasesNearHotspots(
	bases: MilitaryBase[],
	hotspots: Array<{ name: string; lat: number; lon: number }>,
	radiusKm: number
): Map<string, (MilitaryBase & { distance: number })[]> {
	const result = new Map<string, (MilitaryBase & { distance: number })[]>();
	
	for (const hotspot of hotspots) {
		const nearbyBases = findBasesNearPoint(bases, hotspot.lat, hotspot.lon, radiusKm);
		if (nearbyBases.length > 0) {
			result.set(hotspot.name, nearbyBases);
		}
	}
	
	return result;
}

/**
 * Base with proximity info for UI display
 */
export interface BaseProximityInfo {
	base: MilitaryBase;
	nearestHotspot: string;
	distanceKm: number;
	bearing: number;
}

/**
 * Calculate bearing between two points
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(
	lat1: number, lon1: number,
	lat2: number, lon2: number
): number {
	const dLon = toRad(lon2 - lon1);
	const y = Math.sin(dLon) * Math.cos(toRad(lat2));
	const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
		Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
	const bearing = Math.atan2(y, x);
	return (toDeg(bearing) + 360) % 360;
}

function toDeg(rad: number): number {
	return rad * (180 / Math.PI);
}

/**
 * Get compass direction from bearing
 */
export function bearingToCompass(bearing: number): string {
	const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
		'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
	const index = Math.round(bearing / 22.5) % 16;
	return directions[index];
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
	if (km < 1) {
		return `${Math.round(km * 1000)}m`;
	} else if (km < 10) {
		return `${km.toFixed(1)}km`;
	} else if (km < 100) {
		return `${Math.round(km)}km`;
	} else {
		return `${Math.round(km / 10) * 10}km`;
	}
}

/**
 * Generate proximity analysis for all bases relative to hotspots
 */
export function analyzeBaseProximity(
	bases: MilitaryBase[],
	hotspots: Array<{ name: string; lat: number; lon: number }>
): BaseProximityInfo[] {
	return bases.map(base => {
		let nearestHotspot = '';
		let minDistance = Infinity;
		let bearing = 0;
		
		for (const hotspot of hotspots) {
			const dist = calculateDistance(base.lat, base.lon, hotspot.lat, hotspot.lon);
			if (dist < minDistance) {
				minDistance = dist;
				nearestHotspot = hotspot.name;
				bearing = calculateBearing(base.lat, base.lon, hotspot.lat, hotspot.lon);
			}
		}
		
		return {
			base,
			nearestHotspot,
			distanceKm: minDistance,
			bearing
		};
	}).sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Connection line data for visualization
 */
export interface ConnectionLine {
	fromName: string;
	fromLat: number;
	fromLon: number;
	toName: string;
	toLat: number;
	toLon: number;
	distance: number;
	type: 'base-hotspot' | 'base-base' | 'hotspot-hotspot';
}

/**
 * Generate connection lines between bases and nearby hotspots
 */
export function generateConnectionLines(
	bases: MilitaryBase[],
	hotspots: Array<{ name: string; lat: number; lon: number; level?: string }>,
	maxDistanceKm: number = 500
): ConnectionLine[] {
	const lines: ConnectionLine[] = [];
	
	// Filter to critical/high hotspots for less visual clutter
	const significantHotspots = hotspots.filter(h => 
		!h.level || h.level === 'critical' || h.level === 'high'
	);
	
	for (const base of bases) {
		for (const hotspot of significantHotspots) {
			const distance = calculateDistance(base.lat, base.lon, hotspot.lat, hotspot.lon);
			
			if (distance <= maxDistanceKm) {
				lines.push({
					fromName: base.name,
					fromLat: base.lat,
					fromLon: base.lon,
					toName: hotspot.name,
					toLat: hotspot.lat,
					toLon: hotspot.lon,
					distance,
					type: 'base-hotspot'
				});
			}
		}
	}
	
	// Sort by distance (shortest first)
	return lines.sort((a, b) => a.distance - b.distance);
}

/**
 * Filter strategies for quick filtering
 */
export type FilterStrategy = 
	| { type: 'all' }
	| { type: 'country'; codes: string[] }
	| { type: 'alliance'; name: AllianceName }
	| { type: 'region'; name: RegionName }
	| { type: 'baseType'; types: string[] }
	| { type: 'proximity'; lat: number; lon: number; radiusKm: number }
	| { type: 'nearHotspot'; hotspotName: string; radiusKm: number };

/**
 * Apply a filter strategy to bases
 */
export function applyFilterStrategy(
	bases: MilitaryBase[],
	strategy: FilterStrategy,
	hotspots?: Array<{ name: string; lat: number; lon: number }>
): MilitaryBase[] {
	switch (strategy.type) {
		case 'all':
			return bases;
			
		case 'country':
			return bases.filter(base => {
				const country = base.country || inferCountryFromBase(base);
				return strategy.codes.includes(country);
			});
			
		case 'alliance':
			const allianceCountries = MILITARY_ALLIANCES[strategy.name];
			return bases.filter(base => {
				const country = base.country || inferCountryFromBase(base);
				return allianceCountries.includes(country as never);
			});
			
		case 'region':
			const regionCountries = MILITARY_REGIONS[strategy.name];
			return bases.filter(base => {
				const country = base.country || inferCountryFromBase(base);
				return regionCountries.includes(country as never);
			});
			
		case 'baseType':
			return bases.filter(base => {
				const type = base.type || inferBaseType(base);
				return strategy.types.includes(type);
			});
			
		case 'proximity':
			return findBasesNearPoint(bases, strategy.lat, strategy.lon, strategy.radiusKm);
			
		case 'nearHotspot':
			if (!hotspots) return bases;
			const hotspot = hotspots.find(h => h.name === strategy.hotspotName);
			if (!hotspot) return bases;
			return findBasesNearPoint(bases, hotspot.lat, hotspot.lon, strategy.radiusKm);
			
		default:
			return bases;
	}
}
