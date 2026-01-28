/**
 * Environmental Fetcher - Radiation and Disease Outbreak data for Supabase Edge Functions
 *
 * Ported from src/lib/api/misc.ts
 */

// ============================================================================
// TYPES
// ============================================================================

export type RadiationLevel = 'normal' | 'elevated' | 'high' | 'dangerous';

export interface RadiationReading {
	id: string;
	lat: number;
	lon: number;
	value: number;
	unit: 'cpm' | 'usv';
	capturedAt: string;
	deviceId?: string;
	location?: string;
	level: RadiationLevel;
}

export type DiseaseOutbreakSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type DiseaseOutbreakStatus = 'active' | 'monitoring' | 'contained';

export interface DiseaseOutbreak {
	id: string;
	disease: string;
	country: string;
	lat: number;
	lon: number;
	status: DiseaseOutbreakStatus;
	severity: DiseaseOutbreakSeverity;
	cases?: number;
	deaths?: number;
	startDate?: string;
	lastUpdate: string;
	source: string;
	url?: string;
}

interface SafecastMeasurement {
	id: number;
	value: number;
	unit: string;
	latitude: number | string;
	longitude: number | string;
	captured_at: string;
	device_id?: number;
	location_name?: string;
}

// ============================================================================
// RADIATION LEVEL CONFIG
// ============================================================================

export const RADIATION_LEVEL_COLORS: Record<RadiationLevel, string> = {
	dangerous: '#ef4444',
	high: '#f97316',
	elevated: '#eab308',
	normal: '#22c55e'
};

export const RADIATION_LEVEL_DESCRIPTIONS: Record<RadiationLevel, string> = {
	normal: 'Normal background radiation',
	elevated: 'Elevated - Above normal background',
	high: 'High - Action may be needed',
	dangerous: 'Dangerous - Immediate concern'
};

// ============================================================================
// COUNTRY COORDINATES FOR GEOCODING
// ============================================================================

const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
	Afghanistan: { lat: 33.93, lon: 67.71 },
	Algeria: { lat: 28.03, lon: 1.66 },
	Angola: { lat: -11.2, lon: 17.87 },
	Argentina: { lat: -38.42, lon: -63.62 },
	Australia: { lat: -25.27, lon: 133.78 },
	Bangladesh: { lat: 23.68, lon: 90.36 },
	Brazil: { lat: -14.24, lon: -51.93 },
	'Burkina Faso': { lat: 12.24, lon: -1.56 },
	Burundi: { lat: -3.37, lon: 29.92 },
	Cambodia: { lat: 12.57, lon: 104.99 },
	Cameroon: { lat: 7.37, lon: 12.35 },
	Canada: { lat: 56.13, lon: -106.35 },
	Chad: { lat: 15.45, lon: 18.73 },
	Chile: { lat: -35.68, lon: -71.54 },
	China: { lat: 35.86, lon: 104.2 },
	Colombia: { lat: 4.57, lon: -74.3 },
	'Democratic Republic of the Congo': { lat: -4.04, lon: 21.76 },
	DRC: { lat: -4.04, lon: 21.76 },
	'DR Congo': { lat: -4.04, lon: 21.76 },
	Ecuador: { lat: -1.83, lon: -78.18 },
	Egypt: { lat: 26.82, lon: 30.8 },
	Ethiopia: { lat: 9.15, lon: 40.49 },
	France: { lat: 46.23, lon: 2.21 },
	Germany: { lat: 51.17, lon: 10.45 },
	Ghana: { lat: 7.95, lon: -1.02 },
	Guinea: { lat: 9.95, lon: -9.7 },
	Haiti: { lat: 18.97, lon: -72.29 },
	India: { lat: 20.59, lon: 78.96 },
	Indonesia: { lat: -0.79, lon: 113.92 },
	Iran: { lat: 32.43, lon: 53.69 },
	Iraq: { lat: 33.22, lon: 43.68 },
	Israel: { lat: 31.05, lon: 34.85 },
	Italy: { lat: 41.87, lon: 12.57 },
	Japan: { lat: 36.2, lon: 138.25 },
	Kenya: { lat: -0.02, lon: 37.91 },
	Lebanon: { lat: 33.85, lon: 35.86 },
	Liberia: { lat: 6.43, lon: -9.43 },
	Libya: { lat: 26.34, lon: 17.23 },
	Madagascar: { lat: -18.77, lon: 46.87 },
	Malawi: { lat: -13.25, lon: 34.3 },
	Malaysia: { lat: 4.21, lon: 101.98 },
	Mali: { lat: 17.57, lon: -4.0 },
	Mexico: { lat: 23.63, lon: -102.55 },
	Morocco: { lat: 31.79, lon: -7.09 },
	Mozambique: { lat: -18.67, lon: 35.53 },
	Myanmar: { lat: 21.91, lon: 95.96 },
	Nepal: { lat: 28.39, lon: 84.12 },
	Niger: { lat: 17.61, lon: 8.08 },
	Nigeria: { lat: 9.08, lon: 8.68 },
	Pakistan: { lat: 30.38, lon: 69.35 },
	Peru: { lat: -9.19, lon: -75.02 },
	Philippines: { lat: 12.88, lon: 121.77 },
	Poland: { lat: 51.92, lon: 19.15 },
	Russia: { lat: 61.52, lon: 105.32 },
	Rwanda: { lat: -1.94, lon: 29.87 },
	'Saudi Arabia': { lat: 23.89, lon: 45.08 },
	Senegal: { lat: 14.5, lon: -14.45 },
	'Sierra Leone': { lat: 8.46, lon: -11.78 },
	Somalia: { lat: 5.15, lon: 46.2 },
	'South Africa': { lat: -30.56, lon: 22.94 },
	'South Sudan': { lat: 6.88, lon: 31.31 },
	Spain: { lat: 40.46, lon: -3.75 },
	'Sri Lanka': { lat: 7.87, lon: 80.77 },
	Sudan: { lat: 12.86, lon: 30.22 },
	Syria: { lat: 34.8, lon: 39.0 },
	Taiwan: { lat: 23.7, lon: 120.96 },
	Tanzania: { lat: -6.37, lon: 34.89 },
	Thailand: { lat: 15.87, lon: 100.99 },
	Tunisia: { lat: 33.89, lon: 9.54 },
	Turkey: { lat: 38.96, lon: 35.24 },
	Uganda: { lat: 1.37, lon: 32.29 },
	Ukraine: { lat: 48.38, lon: 31.17 },
	'United Kingdom': { lat: 55.38, lon: -3.44 },
	'United States': { lat: 37.09, lon: -95.71 },
	USA: { lat: 37.09, lon: -95.71 },
	Venezuela: { lat: 6.42, lon: -66.59 },
	Vietnam: { lat: 14.06, lon: 108.28 },
	Yemen: { lat: 15.55, lon: 48.52 },
	Zambia: { lat: -13.13, lon: 27.85 },
	Zimbabwe: { lat: -19.02, lon: 29.15 }
};

// ============================================================================
// HELPERS
// ============================================================================

function classifyRadiationLevel(value: number, unit: 'cpm' | 'usv'): RadiationLevel {
	const cpm = unit === 'usv' ? value * 350 : value;

	if (cpm >= 350) return 'dangerous';
	if (cpm >= 100) return 'high';
	if (cpm >= 50) return 'elevated';
	return 'normal';
}

function getCountryCoords(country: string): { lat: number; lon: number } | null {
	if (COUNTRY_COORDS[country]) return COUNTRY_COORDS[country];

	const lowerCountry = country.toLowerCase();
	for (const [name, coords] of Object.entries(COUNTRY_COORDS)) {
		if (name.toLowerCase() === lowerCountry) return coords;
	}
	for (const [name, coords] of Object.entries(COUNTRY_COORDS)) {
		if (lowerCountry.includes(name.toLowerCase()) || name.toLowerCase().includes(lowerCountry)) {
			return coords;
		}
	}
	return null;
}

function determineOutbreakSeverity(
	cases?: number,
	deaths?: number,
	diseaseName?: string
): DiseaseOutbreakSeverity {
	const highFatalityDiseases = ['ebola', 'marburg', 'mpox', 'avian flu', 'h5n1', 'nipah', 'plague'];
	const diseaseLC = diseaseName?.toLowerCase() || '';
	const isHighFatality = highFatalityDiseases.some((d) => diseaseLC.includes(d));

	if (isHighFatality) {
		if (deaths && deaths >= 100) return 'critical';
		if (deaths && deaths >= 10) return 'high';
		return 'moderate';
	}

	if (cases && cases >= 10000) return 'critical';
	if (cases && cases >= 1000) return 'high';
	if (cases && cases >= 100) return 'moderate';
	if (deaths && deaths >= 10) return 'high';
	if (deaths && deaths >= 1) return 'moderate';
	return 'low';
}

function determineOutbreakStatus(lastUpdate: string): DiseaseOutbreakStatus {
	const updateDate = new Date(lastUpdate);
	const daysSinceUpdate = (Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24);

	if (daysSinceUpdate > 60) return 'contained';
	if (daysSinceUpdate > 30) return 'monitoring';
	return 'active';
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Fetch radiation readings from Safecast API
 */
export async function fetchRadiationData(): Promise<RadiationReading[]> {
	try {
		// Get measurements from last 14 days
		const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
		const sinceDate = fourteenDaysAgo.toISOString().split('T')[0];
		const cacheBuster = Math.floor(Date.now() / 60000);

		const apiUrl = `https://api.safecast.org/measurements.json?since=${sinceDate}&limit=2000&_cb=${cacheBuster}`;

		console.log(`Fetching radiation data since ${sinceDate}...`);

		const response = await fetch(apiUrl, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(20000)
		});

		if (!response.ok) {
			throw new Error(`Safecast API returned status ${response.status}`);
		}

		const data = (await response.json()) as SafecastMeasurement[];
		console.log(`Received ${data.length} measurements`);

		if (!Array.isArray(data)) {
			throw new Error('Invalid response format from Safecast API');
		}

		const readings: RadiationReading[] = [];

		for (const item of data) {
			if (!item.value || !item.latitude || !item.longitude) continue;

			const itemUnit = item.unit?.toLowerCase() || '';
			if (!itemUnit || !['cpm', 'usv'].includes(itemUnit)) continue;

			if (!item.captured_at) continue;
			const capturedDate = new Date(item.captured_at);
			if (isNaN(capturedDate.getTime()) || capturedDate.getFullYear() < 2020) continue;

			const lat =
				typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude;
			const lon =
				typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude;

			if (isNaN(lat) || isNaN(lon)) continue;

			const unit: 'cpm' | 'usv' = itemUnit === 'usv' ? 'usv' : 'cpm';

			readings.push({
				id: `safecast-${item.id}`,
				lat,
				lon,
				value: item.value,
				unit,
				capturedAt: item.captured_at,
				deviceId: item.device_id ? `Device ${item.device_id}` : undefined,
				location: item.location_name || undefined,
				level: classifyRadiationLevel(item.value, unit)
			});
		}

		// Deduplicate by location
		const locationMap = new Map<string, RadiationReading>();
		for (const reading of readings) {
			const locationKey = `${reading.lat.toFixed(2)},${reading.lon.toFixed(2)}`;
			const existing = locationMap.get(locationKey);
			if (!existing || reading.value > existing.value) {
				locationMap.set(locationKey, reading);
			}
		}

		const uniqueReadings = Array.from(locationMap.values());

		// Sort by value descending
		uniqueReadings.sort((a, b) => {
			const aValue = a.unit === 'usv' ? a.value * 350 : a.value;
			const bValue = b.unit === 'usv' ? b.value * 350 : b.value;
			return bValue - aValue;
		});

		console.log(`Processed ${uniqueReadings.length} unique radiation readings`);
		return uniqueReadings;
	} catch (error) {
		console.error('Failed to fetch radiation data:', error);
		return [];
	}
}

/**
 * Get fallback disease outbreak data
 */
function getFallbackDiseaseOutbreaks(): DiseaseOutbreak[] {
	return [
		{
			id: 'fallback-mpox-drc',
			disease: 'Mpox (Clade I)',
			country: 'DR Congo',
			lat: -4.04,
			lon: 21.76,
			status: 'active',
			severity: 'critical',
			cases: 90713,
			deaths: 1633,
			startDate: '2023-01-01',
			lastUpdate: '2025-03-26',
			source: 'WHO (fallback data)',
			url: 'https://www.who.int/emergencies/situations/mpox-outbreak'
		},
		{
			id: 'fallback-cholera-haiti',
			disease: 'Cholera',
			country: 'Haiti',
			lat: 18.97,
			lon: -72.29,
			status: 'active',
			severity: 'high',
			cases: 82885,
			deaths: 1270,
			startDate: '2022-10-01',
			lastUpdate: '2024-04-11',
			source: 'PAHO (fallback data)',
			url: 'https://www.paho.org/en/cholera-outbreak-haiti-2022-situation-report'
		},
		{
			id: 'fallback-marburg-tanzania',
			disease: 'Marburg Virus',
			country: 'Tanzania',
			lat: -2.5,
			lon: 32.9,
			status: 'contained',
			severity: 'critical',
			cases: 10,
			deaths: 10,
			startDate: '2024-12-09',
			lastUpdate: '2025-03-13',
			source: 'WHO AFRO (fallback data)',
			url: 'https://www.who.int/emergencies/disease-outbreak-news/item/2025-DON559'
		}
	];
}

/**
 * Fetch disease outbreak data from ReliefWeb API
 */
export async function fetchDiseaseOutbreaks(): Promise<DiseaseOutbreak[]> {
	try {
		console.log('Fetching disease outbreaks from ReliefWeb...');

		const apiUrl = 'https://api.reliefweb.int/v1/disasters';

		const requestBody = {
			appname: 'situation-monitor-edge',
			filter: {
				field: 'type',
				value: 'Epidemic'
			},
			limit: 50,
			fields: {
				include: ['name', 'description', 'date', 'country', 'url', 'status']
			},
			sort: ['date:desc']
		};

		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(requestBody),
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			console.warn(`ReliefWeb API returned ${response.status}, using fallback data`);
			return getFallbackDiseaseOutbreaks();
		}

		const data = await response.json();
		const outbreaks: DiseaseOutbreak[] = [];

		if (data.data && Array.isArray(data.data)) {
			for (const item of data.data) {
				const fields = item.fields;
				if (!fields) continue;

				const name = fields.name || '';
				let disease = name.split(' - ')[0] || name.split(':')[0] || name;
				disease = disease.trim();

				const countries = fields.country || [];
				const countryObj = countries[0];
				const country = countryObj?.name || 'Unknown';

				const coords = getCountryCoords(country);
				if (!coords) continue;

				const dateCreated = fields.date?.created;
				const lastUpdate = dateCreated || new Date().toISOString();

				outbreaks.push({
					id: `reliefweb-${item.id}`,
					disease,
					country,
					lat: coords.lat,
					lon: coords.lon,
					status: determineOutbreakStatus(lastUpdate),
					severity: determineOutbreakSeverity(undefined, undefined, disease),
					lastUpdate,
					source: 'ReliefWeb',
					url: fields.url?.includes('http') ? fields.url : `https://reliefweb.int/disaster/${item.id}`
				});
			}
		}

		if (outbreaks.length === 0) {
			console.warn('No outbreaks from ReliefWeb, using fallback');
			return getFallbackDiseaseOutbreaks();
		}

		console.log(`Processed ${outbreaks.length} disease outbreaks`);
		return outbreaks;
	} catch (error) {
		console.error('Error fetching disease outbreaks:', error);
		return getFallbackDiseaseOutbreaks();
	}
}
