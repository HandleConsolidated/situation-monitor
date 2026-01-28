/**
 * Storms Fetcher - Tropical Cyclones and Severe Weather data for Supabase Edge Functions
 *
 * Ported from src/lib/api/storms.ts
 */

// ============================================================================
// TYPES
// ============================================================================

export type CycloneCategory =
	| 'TD'
	| 'TS'
	| 'C1'
	| 'C2'
	| 'C3'
	| 'C4'
	| 'C5'
	| 'TY'
	| 'STY'
	| 'HU'
	| 'MH'
	| 'TC';
export type CycloneBasin = 'AL' | 'EP' | 'CP' | 'WP' | 'IO' | 'SH' | 'SP' | 'SI';

export interface TropicalCyclone {
	id: string;
	name: string;
	basin: CycloneBasin;
	category: CycloneCategory;
	maxWind: number; // knots
	minPressure: number | null; // mb
	lat: number;
	lon: number;
	movement: {
		direction: number; // degrees
		speed: number; // knots
	};
	timestamp: string;
	source: string;
	advisory?: string;
	forecast?: CycloneForecastPoint[];
}

export interface CycloneForecastPoint {
	hour: number;
	lat: number;
	lon: number;
	maxWind: number;
	category: CycloneCategory;
}

export type OutlookRisk = 'TSTM' | 'MRGL' | 'SLGT' | 'ENH' | 'MDT' | 'HIGH';
export type HazardType = 'tornado' | 'wind' | 'hail' | 'categorical';

export interface Day1Outlook {
	id: string;
	type: HazardType;
	risk: OutlookRisk;
	validTime: string;
	expirationTime: string;
	geometry: GeoJSON.Geometry | null;
	properties: {
		label: string;
		label2?: string;
		stroke?: string;
		fill?: string;
	};
}

interface NHCActiveStorm {
	id: string;
	binNumber: string;
	name: string;
	classification: string;
	intensity: number;
	pressure: number | null;
	latitude: number;
	longitude: number;
	lastUpdate: string;
	movementDir: number;
	movementSpeed: number;
	publicAdvisory?: {
		advNum: string;
	};
}

interface NHCResponse {
	activeStorms: NHCActiveStorm[];
}

// ============================================================================
// CONFIG
// ============================================================================

// Map NHC classification to our category
const CLASSIFICATION_MAP: Record<string, CycloneCategory> = {
	TD: 'TD',
	TS: 'TS',
	HU: 'HU',
	MH: 'MH',
	TY: 'TY',
	STY: 'STY',
	TC: 'TC',
	SD: 'TD', // Subtropical Depression
	SS: 'TS', // Subtropical Storm
	PTC: 'TD', // Potential Tropical Cyclone
	PC: 'TD' // Post-Tropical Cyclone
};

// Map basin codes
const BASIN_MAP: Record<string, CycloneBasin> = {
	AL: 'AL', // Atlantic
	EP: 'EP', // Eastern Pacific
	CP: 'CP', // Central Pacific
	WP: 'WP', // Western Pacific
	IO: 'IO', // Indian Ocean
	SH: 'SH', // Southern Hemisphere
	SP: 'SP', // South Pacific
	SI: 'SI' // South Indian
};

// Risk level colors
export const OUTLOOK_RISK_COLORS: Record<OutlookRisk, string> = {
	TSTM: '#c0e8c0', // General thunderstorm - light green
	MRGL: '#7fc57f', // Marginal - green
	SLGT: '#f6f67f', // Slight - yellow
	ENH: '#e6c27f', // Enhanced - orange
	MDT: '#e67f7f', // Moderate - red
	HIGH: '#ff7fff' // High - magenta
};

export const OUTLOOK_RISK_DESCRIPTIONS: Record<OutlookRisk, string> = {
	TSTM: 'General Thunderstorms',
	MRGL: 'Marginal Risk (1/5)',
	SLGT: 'Slight Risk (2/5)',
	ENH: 'Enhanced Risk (3/5)',
	MDT: 'Moderate Risk (4/5)',
	HIGH: 'High Risk (5/5)'
};

// ============================================================================
// HELPERS
// ============================================================================

function getCategoryFromWind(windKnots: number): CycloneCategory {
	if (windKnots >= 157) return 'C5';
	if (windKnots >= 130) return 'C4';
	if (windKnots >= 111) return 'C3';
	if (windKnots >= 96) return 'C2';
	if (windKnots >= 74) return 'C1';
	if (windKnots >= 39) return 'TS';
	return 'TD';
}

function parseRiskLevel(label: string): OutlookRisk {
	const upperLabel = label.toUpperCase();
	if (upperLabel.includes('HIGH')) return 'HIGH';
	if (upperLabel.includes('MDT') || upperLabel.includes('MODERATE')) return 'MDT';
	if (upperLabel.includes('ENH') || upperLabel.includes('ENHANCED')) return 'ENH';
	if (upperLabel.includes('SLGT') || upperLabel.includes('SLIGHT')) return 'SLGT';
	if (upperLabel.includes('MRGL') || upperLabel.includes('MARGINAL')) return 'MRGL';
	return 'TSTM';
}

function determineHazardType(label: string, productType?: string): HazardType {
	const lowerLabel = label.toLowerCase();
	if (productType?.includes('torn') || lowerLabel.includes('torn')) return 'tornado';
	if (productType?.includes('wind') || lowerLabel.includes('wind')) return 'wind';
	if (productType?.includes('hail') || lowerLabel.includes('hail')) return 'hail';
	return 'categorical';
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Fetch active tropical cyclones from NHC API
 */
export async function fetchActiveTropicalCyclones(): Promise<TropicalCyclone[]> {
	try {
		console.log('Fetching active tropical cyclones from NHC...');

		const response = await fetch('https://www.nhc.noaa.gov/CurrentStorms.json', {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'SituationMonitor/1.0'
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`NHC API returned ${response.status}`);
		}

		const data: NHCResponse = await response.json();

		if (!data.activeStorms || !Array.isArray(data.activeStorms)) {
			console.log('No active storms in NHC response');
			return [];
		}

		const cyclones: TropicalCyclone[] = data.activeStorms.map((storm) => {
			// Determine basin from bin number (first 2 chars)
			const basinCode = storm.binNumber?.substring(0, 2)?.toUpperCase() || 'AL';
			const basin = BASIN_MAP[basinCode] || 'AL';

			// Determine category from classification and intensity
			let category = CLASSIFICATION_MAP[storm.classification] || 'TD';
			if (category === 'HU' || category === 'MH') {
				category = getCategoryFromWind(storm.intensity);
			}

			return {
				id: storm.id || `nhc-${storm.binNumber}`,
				name: storm.name || 'Unnamed',
				basin,
				category,
				maxWind: storm.intensity || 0,
				minPressure: storm.pressure,
				lat: storm.latitude,
				lon: storm.longitude,
				movement: {
					direction: storm.movementDir || 0,
					speed: storm.movementSpeed || 0
				},
				timestamp: storm.lastUpdate || new Date().toISOString(),
				source: 'NHC',
				advisory: storm.publicAdvisory?.advNum
			};
		});

		console.log(`Processed ${cyclones.length} active tropical cyclones`);
		return cyclones;
	} catch (error) {
		console.error('Error fetching tropical cyclones:', error);
		return [];
	}
}

/**
 * Fetch SPC Day 1 Convective Outlook
 */
export async function fetchAllDay1Outlooks(): Promise<Day1Outlook[]> {
	try {
		console.log('Fetching SPC Day 1 outlooks...');

		// SPC provides GeoJSON for convective outlooks
		const categoricalUrl =
			'https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson';

		const response = await fetch(categoricalUrl, {
			headers: {
				Accept: 'application/json',
				'User-Agent': 'SituationMonitor/1.0'
			},
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`SPC API returned ${response.status}`);
		}

		const data = await response.json();

		if (!data.features || !Array.isArray(data.features)) {
			console.log('No outlook features in SPC response');
			return [];
		}

		const outlooks: Day1Outlook[] = data.features.map(
			(
				feature: {
					id?: string;
					properties?: {
						LABEL?: string;
						LABEL2?: string;
						stroke?: string;
						fill?: string;
						valid?: string;
						expire?: string;
						PRODUCT_TYPE?: string;
					};
					geometry?: GeoJSON.Geometry;
				},
				index: number
			) => {
				const props = feature.properties || {};
				const label = props.LABEL || props.LABEL2 || 'TSTM';
				const risk = parseRiskLevel(label);
				const hazardType = determineHazardType(label, props.PRODUCT_TYPE);

				return {
					id: feature.id || `spc-day1-${index}`,
					type: hazardType,
					risk,
					validTime: props.valid || new Date().toISOString(),
					expirationTime: props.expire || new Date().toISOString(),
					geometry: feature.geometry || null,
					properties: {
						label,
						label2: props.LABEL2,
						stroke: props.stroke,
						fill: props.fill
					}
				};
			}
		);

		// Sort by risk level (highest first)
		const riskOrder: Record<OutlookRisk, number> = {
			HIGH: 5,
			MDT: 4,
			ENH: 3,
			SLGT: 2,
			MRGL: 1,
			TSTM: 0
		};

		outlooks.sort((a, b) => riskOrder[b.risk] - riskOrder[a.risk]);

		console.log(`Processed ${outlooks.length} Day 1 outlooks`);
		return outlooks;
	} catch (error) {
		console.error('Error fetching SPC outlooks:', error);
		return [];
	}
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: CycloneCategory): {
	name: string;
	color: string;
	description: string;
} {
	const info: Record<
		CycloneCategory,
		{ name: string; color: string; description: string }
	> = {
		TD: {
			name: 'Tropical Depression',
			color: '#6ee7b7',
			description: 'Max winds < 39 mph'
		},
		TS: {
			name: 'Tropical Storm',
			color: '#fcd34d',
			description: 'Max winds 39-73 mph'
		},
		C1: {
			name: 'Category 1 Hurricane',
			color: '#fb923c',
			description: 'Max winds 74-95 mph'
		},
		C2: {
			name: 'Category 2 Hurricane',
			color: '#f87171',
			description: 'Max winds 96-110 mph'
		},
		C3: {
			name: 'Major Hurricane (Cat 3)',
			color: '#ef4444',
			description: 'Max winds 111-129 mph'
		},
		C4: {
			name: 'Major Hurricane (Cat 4)',
			color: '#dc2626',
			description: 'Max winds 130-156 mph'
		},
		C5: {
			name: 'Major Hurricane (Cat 5)',
			color: '#b91c1c',
			description: 'Max winds 157+ mph'
		},
		TY: { name: 'Typhoon', color: '#f87171', description: 'Western Pacific cyclone' },
		STY: {
			name: 'Super Typhoon',
			color: '#dc2626',
			description: 'Max winds 150+ mph'
		},
		HU: { name: 'Hurricane', color: '#f87171', description: 'Atlantic/EP cyclone' },
		MH: {
			name: 'Major Hurricane',
			color: '#dc2626',
			description: 'Category 3-5 hurricane'
		},
		TC: {
			name: 'Tropical Cyclone',
			color: '#fcd34d',
			description: 'Generic tropical cyclone'
		}
	};

	return info[category] || info.TC;
}

/**
 * Get basin display info
 */
export function getBasinInfo(basin: CycloneBasin): { name: string; fullName: string } {
	const info: Record<CycloneBasin, { name: string; fullName: string }> = {
		AL: { name: 'Atlantic', fullName: 'North Atlantic Basin' },
		EP: { name: 'E. Pacific', fullName: 'Eastern North Pacific Basin' },
		CP: { name: 'C. Pacific', fullName: 'Central North Pacific Basin' },
		WP: { name: 'W. Pacific', fullName: 'Western North Pacific Basin' },
		IO: { name: 'Indian', fullName: 'North Indian Ocean Basin' },
		SH: { name: 'S. Hemisphere', fullName: 'Southern Hemisphere' },
		SP: { name: 'S. Pacific', fullName: 'South Pacific Basin' },
		SI: { name: 'S. Indian', fullName: 'South Indian Ocean Basin' }
	};

	return info[basin] || info.AL;
}
