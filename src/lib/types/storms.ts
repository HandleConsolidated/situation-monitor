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

/**
 * SPC Convective Outlook risk levels
 */
export type ConvectiveRisk =
	| 'TSTM' // General thunderstorms
	| 'MRGL' // Marginal risk
	| 'SLGT' // Slight risk
	| 'ENH' // Enhanced risk
	| 'MDT' // Moderate risk
	| 'HIGH'; // High risk

/**
 * Convective outlook polygon
 */
export interface ConvectiveOutlook {
	day: 1 | 2 | 3;
	type: 'categorical' | 'tornado' | 'hail' | 'wind';
	risk: ConvectiveRisk;
	geometry: GeoJSON.Geometry;
	validTime: string;
	isSignificant: boolean;
}

/**
 * Color mapping for convective risks
 */
export const CONVECTIVE_COLORS: Record<ConvectiveRisk, string> = {
	TSTM: '#c0e8c0', // Light green
	MRGL: '#66c57c', // Dark green
	SLGT: '#f6f67f', // Yellow
	ENH: '#e6c27c', // Orange
	MDT: '#e67c7c', // Red
	HIGH: '#ff66ff' // Magenta
};

/**
 * Watch types from SPC
 */
export type WatchType = 'tornado' | 'severe_thunderstorm';

/**
 * SPC Watch Box (Tornado Watch or Severe Thunderstorm Watch)
 */
export interface SPCWatch {
	id: string;
	type: WatchType;
	number: number;
	issued: string;
	expires: string;
	geometry: GeoJSON.Geometry;
	counties: string[];
	maxHailSize: number | null; // inches
	maxWindGust: number | null; // mph
	tornadoThreat: 'low' | 'moderate' | 'high' | null;
	replacesWatch: number | null;
}

/**
 * SPC Mesoscale Discussion
 */
export interface MesoscaleDiscussion {
	id: string;
	number: number;
	issued: string;
	expires: string;
	geometry: GeoJSON.Geometry;
	concernType: 'severe' | 'winter' | 'fire' | 'other';
	watchLikelihood: 'unlikely' | 'possible' | 'likely' | null;
	summary: string;
	affectedAreas: string;
}

/**
 * Storm Report type from SPC
 */
export type StormReportType = 'tornado' | 'hail' | 'wind';

/**
 * Individual storm report from SPC
 */
export interface StormReport {
	id: string;
	type: StormReportType;
	lat: number;
	lon: number;
	time: string;
	magnitude: number | null; // Tornado: EF scale, Hail: inches, Wind: mph
	location: string;
	county: string;
	state: string;
	source: string;
	comments: string;
}

/**
 * Color mapping for watch types
 */
export const WATCH_COLORS: Record<WatchType, string> = {
	tornado: '#ff0000', // Red
	severe_thunderstorm: '#ffaa00' // Orange
};

/**
 * Color mapping for storm report types
 */
export const STORM_REPORT_COLORS: Record<StormReportType, string> = {
	tornado: '#ff0000', // Red
	hail: '#00ff00', // Green
	wind: '#0088ff' // Blue
};
