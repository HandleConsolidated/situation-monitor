// src/lib/types/storms.ts

/**
 * Tropical cyclone intensity category
 */
export type CycloneCategory =
	| 'TD' // Tropical Depression
	| 'TS' // Tropical Storm
	| 'H1' // Category 1 Hurricane
	| 'H2' // Category 2 Hurricane
	| 'H3' // Category 3 Hurricane (Major)
	| 'H4' // Category 4 Hurricane (Major)
	| 'H5' // Category 5 Hurricane (Major)
	| 'EX' // Extratropical
	| 'SD' // Subtropical Depression
	| 'SS' // Subtropical Storm
	| 'PTC'; // Post-Tropical Cyclone

/**
 * Single forecast point for a tropical cyclone
 */
export interface CycloneForecastPoint {
	lat: number;
	lon: number;
	forecastHour: number; // 0, 12, 24, 36, 48, 72, 96, 120
	maxWind: number; // knots
	gusts: number | null;
	category: CycloneCategory;
	pressure: number | null; // mb
	validTime: string;
}

/**
 * Tropical cyclone track data
 */
export interface TropicalCyclone {
	id: string;
	name: string;
	basin: 'AL' | 'EP' | 'CP'; // Atlantic, East Pacific, Central Pacific
	stormNumber: number;
	currentPosition: {
		lat: number;
		lon: number;
		validTime: string;
	};
	currentIntensity: {
		maxWind: number;
		gusts: number | null;
		pressure: number | null;
		category: CycloneCategory;
		movement: {
			direction: string;
			speed: number; // mph
		};
	};
	forecastTrack: CycloneForecastPoint[];
	forecastCone: GeoJSON.Geometry | null;
	windRadii: {
		'34kt': GeoJSON.Geometry | null;
		'50kt': GeoJSON.Geometry | null;
		'64kt': GeoJSON.Geometry | null;
	};
	lastUpdate: string;
}

/**
 * Color mapping for cyclone categories
 */
export const CYCLONE_COLORS: Record<CycloneCategory, string> = {
	TD: '#5ebaff', // Light blue
	TS: '#00faf4', // Cyan
	H1: '#ffffcc', // Pale yellow
	H2: '#ffe775', // Yellow
	H3: '#ffc140', // Orange
	H4: '#ff8f20', // Dark orange
	H5: '#ff6060', // Red
	EX: '#cccccc', // Gray
	SD: '#8888ff', // Purple-blue
	SS: '#aa88ff', // Purple
	PTC: '#888888' // Dark gray
};
