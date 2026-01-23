// src/lib/api/storms.ts

/**
 * Tropical Cyclone and Convective Outlook API functions
 * Fetches from NOAA NCEP ArcGIS REST services and SPC MapServer
 */

import type {
	TropicalCyclone,
	CycloneCategory,
	CycloneForecastPoint,
	ConvectiveOutlook,
	ConvectiveRisk
} from '$lib/types/storms';

// =====================================
// Tropical Cyclone API (NHC)
// =====================================

const NHC_BASE_URL =
	'https://idpgis.ncep.noaa.gov/arcgis/rest/services/NWS_Forecasts_Guidance_Warnings';

// Active storm endpoints for each basin
const CYCLONE_ENDPOINTS = {
	atlantic: `${NHC_BASE_URL}/NHC_Atl_trop_cyclones_active/MapServer`,
	eastPacific: `${NHC_BASE_URL}/NHC_E_Pac_trop_cyclones_active/MapServer`
};

// Layer IDs in the MapServer
const CYCLONE_LAYERS = {
	forecastPoints: 0,
	forecastTrack: 1,
	forecastCone: 2,
	currentWindExtent: 3
};

/**
 * Convert NHC storm type code to our category
 */
function parseCategory(stormType: string, dvlbl: string): CycloneCategory {
	if (stormType === 'TD' || dvlbl === 'TD') return 'TD';
	if (stormType === 'TS' || dvlbl === 'TS') return 'TS';
	if (dvlbl === 'H1') return 'H1';
	if (dvlbl === 'H2') return 'H2';
	if (dvlbl === 'H3') return 'H3';
	if (dvlbl === 'H4') return 'H4';
	if (dvlbl === 'H5') return 'H5';
	if (stormType === 'EX') return 'EX';
	if (stormType === 'SD') return 'SD';
	if (stormType === 'SS') return 'SS';
	if (stormType === 'PT') return 'PTC';
	return 'TS'; // Default
}

/**
 * Fetch active tropical cyclones from all basins
 */
export async function fetchActiveTropicalCyclones(): Promise<TropicalCyclone[]> {
	const cyclones: TropicalCyclone[] = [];

	// Fetch from both Atlantic and East Pacific
	for (const [basin, baseUrl] of Object.entries(CYCLONE_ENDPOINTS)) {
		try {
			// Query forecast points layer for current positions
			const pointsUrl = `${baseUrl}/${CYCLONE_LAYERS.forecastPoints}/query?where=1=1&outFields=*&f=geojson`;

			const response = await fetch(pointsUrl, {
				signal: AbortSignal.timeout(15000)
			});

			if (!response.ok) continue;

			const data = await response.json();

			if (!data.features || data.features.length === 0) continue;

			// Group points by storm
			const stormMap = new Map<string, typeof data.features>();

			for (const feature of data.features) {
				const props = feature.properties;
				const stormId = `${props.BASIN}${props.STORMNUM}`;

				if (!stormMap.has(stormId)) {
					stormMap.set(stormId, []);
				}
				stormMap.get(stormId)!.push(feature);
			}

			// Build cyclone objects
			for (const [stormId, features] of stormMap.entries()) {
				// Find current position (forecast hour 0)
				const currentFeature =
					features.find(
						(f: { properties: { FHOUR?: number } }) =>
							f.properties.FHOUR === 0 || f.properties.FHOUR === undefined
					) || features[0];

				const props = currentFeature.properties;

				const forecastTrack: CycloneForecastPoint[] = features
					.map((f: { properties: Record<string, unknown> }) => ({
						lat: f.properties.LAT as number,
						lon: f.properties.LON as number,
						forecastHour: (f.properties.FHOUR as number) || 0,
						maxWind: f.properties.MAXWIND as number,
						gusts: f.properties.GUST as number | null,
						category: parseCategory(
							f.properties.STORMTYPE as string,
							f.properties.DVLBL as string
						),
						pressure: f.properties.MSLP as number | null,
						validTime: f.properties.VALIDTIME as string
					}))
					.sort(
						(a: CycloneForecastPoint, b: CycloneForecastPoint) =>
							a.forecastHour - b.forecastHour
					);

				const cyclone: TropicalCyclone = {
					id: stormId,
					name: props.STORMNAME || `Storm ${props.STORMNUM}`,
					basin: props.BASIN as 'AL' | 'EP' | 'CP',
					stormNumber: props.STORMNUM,
					currentPosition: {
						lat: props.LAT,
						lon: props.LON,
						validTime: props.VALIDTIME
					},
					currentIntensity: {
						maxWind: props.MAXWIND,
						gusts: props.GUST,
						pressure: props.MSLP,
						category: parseCategory(props.STORMTYPE, props.DVLBL),
						movement: {
							direction: props.DESSION || 'N',
							speed: props.SSNUM || 0
						}
					},
					forecastTrack,
					forecastCone: null, // Fetched separately if needed
					windRadii: {
						'34kt': null,
						'50kt': null,
						'64kt': null
					},
					lastUpdate: props.VALIDTIME
				};

				cyclones.push(cyclone);
			}
		} catch (error) {
			console.warn(`Failed to fetch tropical cyclones for ${basin}:`, error);
		}
	}

	return cyclones;
}

/**
 * Fetch forecast cone geometry for a specific cyclone
 */
export async function fetchCycloneForecastCone(
	basin: 'AL' | 'EP' | 'CP',
	stormNumber: number
): Promise<GeoJSON.Geometry | null> {
	const baseUrl =
		basin === 'AL' ? CYCLONE_ENDPOINTS.atlantic : CYCLONE_ENDPOINTS.eastPacific;

	try {
		const coneUrl = `${baseUrl}/${CYCLONE_LAYERS.forecastCone}/query?where=STORMNUM=${stormNumber}&outFields=*&f=geojson`;

		const response = await fetch(coneUrl, {
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) return null;

		const data = await response.json();

		if (!data.features || data.features.length === 0) return null;

		// Return the first cone geometry
		return data.features[0].geometry;
	} catch (error) {
		console.warn('Failed to fetch cyclone forecast cone:', error);
		return null;
	}
}

// =====================================
// SPC Convective Outlook API
// =====================================

const SPC_BASE_URL =
	'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer';

// Layer IDs for SPC convective outlooks
const SPC_LAYERS = {
	day1: {
		categorical: 1,
		tornado: 3,
		hail: 5,
		wind: 7,
		sigTornado: 2,
		sigHail: 4,
		sigWind: 6
	},
	day2: {
		categorical: 9,
		tornado: 11,
		hail: 13,
		wind: 15,
		sigTornado: 10,
		sigHail: 12,
		sigWind: 14
	},
	day3: {
		categorical: 17,
		probabilistic: 19,
		significant: 18
	}
};

/**
 * Parse SPC risk label to our type
 */
function parseConvectiveRisk(label: string): ConvectiveRisk {
	const upper = label.toUpperCase();
	if (upper.includes('HIGH')) return 'HIGH';
	if (upper.includes('MDT') || upper.includes('MODERATE')) return 'MDT';
	if (upper.includes('ENH') || upper.includes('ENHANCED')) return 'ENH';
	if (upper.includes('SLGT') || upper.includes('SLIGHT')) return 'SLGT';
	if (upper.includes('MRGL') || upper.includes('MARGINAL')) return 'MRGL';
	return 'TSTM';
}

/**
 * Fetch SPC convective outlooks for a given day and type
 */
export async function fetchConvectiveOutlooks(
	day: 1 | 2 | 3,
	type: 'categorical' | 'tornado' | 'hail' | 'wind' = 'categorical'
): Promise<ConvectiveOutlook[]> {
	const outlooks: ConvectiveOutlook[] = [];

	// Get layer ID
	let layerId: number;
	if (day === 3) {
		layerId =
			type === 'categorical'
				? SPC_LAYERS.day3.categorical
				: SPC_LAYERS.day3.probabilistic;
	} else {
		const dayLayers = day === 1 ? SPC_LAYERS.day1 : SPC_LAYERS.day2;
		layerId = dayLayers[type as keyof typeof dayLayers] as number;
	}

	try {
		const url = `${SPC_BASE_URL}/${layerId}/query?where=1=1&outFields=*&f=geojson`;

		const response = await fetch(url, {
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) return [];

		const data = await response.json();

		if (!data.features) return [];

		for (const feature of data.features) {
			const props = feature.properties;

			outlooks.push({
				day,
				type,
				risk: parseConvectiveRisk(props.LABEL || props.LABEL2 || 'TSTM'),
				geometry: feature.geometry,
				validTime: props.VALID || props.ISSUE || '',
				isSignificant: (props.LABEL || '').toUpperCase().includes('SIG')
			});
		}
	} catch (error) {
		console.warn(`Failed to fetch SPC ${type} outlook for day ${day}:`, error);
	}

	return outlooks;
}

/**
 * Fetch all Day 1 convective outlooks (categorical + hazards)
 */
export async function fetchAllDay1Outlooks(): Promise<ConvectiveOutlook[]> {
	const [categorical, tornado, hail, wind] = await Promise.all([
		fetchConvectiveOutlooks(1, 'categorical'),
		fetchConvectiveOutlooks(1, 'tornado'),
		fetchConvectiveOutlooks(1, 'hail'),
		fetchConvectiveOutlooks(1, 'wind')
	]);

	return [...categorical, ...tornado, ...hail, ...wind];
}
