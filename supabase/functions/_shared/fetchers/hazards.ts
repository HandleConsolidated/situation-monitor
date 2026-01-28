/**
 * Hazards Fetcher - Earthquake, Grid Stress, and Outage data for Supabase Edge Functions
 *
 * Ported from src/lib/api/misc.ts
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EarthquakeData {
	id: string;
	magnitude: number;
	place: string;
	time: number;
	lat: number;
	lon: number;
	depth: number;
	url: string;
}

export interface GridStressData {
	id: string;
	region: string;
	country: string;
	countryCode: string;
	lat: number;
	lon: number;
	moer: number;
	frequency: number;
	percent: number;
	signal_type: string;
	stressLevel: 'normal' | 'elevated' | 'high' | 'critical';
	description: string;
	timestamp: string;
	boundaryCoords?: [number, number][][];
	areaKm2?: number;
}

export interface OutageData {
	id: string;
	country: string;
	countryCode: string;
	type: 'internet' | 'power';
	severity: 'major' | 'partial' | 'minor';
	lat: number;
	lon: number;
	description: string;
	source: string;
	active: boolean;
	radiusKm?: number;
}

interface USGSEarthquakeFeature {
	id: string;
	properties: {
		mag: number | null;
		place: string | null;
		time: number;
		url: string;
	};
	geometry: {
		coordinates: [number, number, number];
	};
}

interface USGSEarthquakeResponse {
	type: string;
	features: USGSEarthquakeFeature[];
}

// ============================================================================
// GRID REGIONS CONFIG
// ============================================================================

interface GridRegion {
	name: string;
	lat: number;
	lon: number;
	country: string;
	countryCode: string;
	boundaryCoords?: [number, number][][];
	areaKm2?: number;
}

const GRID_REGIONS: GridRegion[] = [
	// US Major ISOs
	{
		name: 'CAISO',
		lat: 36.7783,
		lon: -119.4179,
		country: 'United States',
		countryCode: 'US',
		areaKm2: 380000
	},
	{
		name: 'ERCOT Texas',
		lat: 31.0,
		lon: -100.0,
		country: 'United States',
		countryCode: 'US',
		areaKm2: 695000
	},
	{
		name: 'PJM',
		lat: 40.0,
		lon: -77.0,
		country: 'United States',
		countryCode: 'US',
		areaKm2: 500000
	},
	{
		name: 'MISO',
		lat: 41.5,
		lon: -93.0,
		country: 'United States',
		countryCode: 'US',
		areaKm2: 920000
	},
	{
		name: 'ISO-NE',
		lat: 42.4072,
		lon: -71.3824,
		country: 'United States',
		countryCode: 'US',
		areaKm2: 165000
	},
	{
		name: 'NYISO',
		lat: 42.1657,
		lon: -74.9481,
		country: 'United States',
		countryCode: 'US',
		areaKm2: 140000
	},
	{
		name: 'SPP',
		lat: 36.0,
		lon: -97.5,
		country: 'United States',
		countryCode: 'US',
		areaKm2: 650000
	},
	// Europe
	{
		name: 'Germany',
		lat: 51.1657,
		lon: 10.4515,
		country: 'Germany',
		countryCode: 'DE',
		areaKm2: 357000
	},
	{
		name: 'UK',
		lat: 53.5,
		lon: -2.0,
		country: 'United Kingdom',
		countryCode: 'GB',
		areaKm2: 243000
	},
	{
		name: 'France',
		lat: 46.2276,
		lon: 2.2137,
		country: 'France',
		countryCode: 'FR',
		areaKm2: 640000
	},
	// Asia-Pacific
	{
		name: 'Japan (Tokyo)',
		lat: 35.6762,
		lon: 139.6503,
		country: 'Japan',
		countryCode: 'JP',
		areaKm2: 378000
	},
	{
		name: 'Australia NEM',
		lat: -33.8688,
		lon: 151.2093,
		country: 'Australia',
		countryCode: 'AU',
		areaKm2: 4500000
	}
];

// ============================================================================
// HELPERS
// ============================================================================

function getGridStressLevel(percent: number): 'normal' | 'elevated' | 'high' | 'critical' {
	if (percent >= 98) return 'critical';
	if (percent >= 95) return 'high';
	if (percent >= 85) return 'elevated';
	return 'normal';
}

function getGridStressDescription(stressLevel: string, percent: number): string {
	const percentile = Math.round(percent);
	switch (stressLevel) {
		case 'critical':
			return `${percentile}th percentile - Extreme fossil fuel reliance`;
		case 'high':
			return `${percentile}th percentile - Very high fossil fuel reliance`;
		case 'elevated':
			return `${percentile}th percentile - Above-average emissions`;
		default:
			return `${percentile}th percentile - Normal emissions`;
	}
}

export function getEarthquakeSeverity(magnitude: number): 'critical' | 'high' | 'moderate' | 'low' {
	if (magnitude >= 7.0) return 'critical';
	if (magnitude >= 6.0) return 'high';
	if (magnitude >= 5.0) return 'moderate';
	return 'low';
}

export function getEarthquakeColor(magnitude: number): string {
	if (magnitude >= 7.0) return '#ef4444';
	if (magnitude >= 6.0) return '#f97316';
	if (magnitude >= 5.0) return '#eab308';
	return '#22c55e';
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Fetch earthquake data from USGS
 */
export async function fetchEarthquakes(minMagnitude: number = 4.0): Promise<EarthquakeData[]> {
	const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${minMagnitude}&limit=50&orderby=time`;

	try {
		console.log(`Fetching earthquakes with minMagnitude=${minMagnitude}...`);

		const response = await fetch(usgsUrl, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`USGS API returned status ${response.status}`);
		}

		const data: USGSEarthquakeResponse = await response.json();

		if (!data.features || !Array.isArray(data.features)) {
			console.warn('Invalid response format - no features array');
			return [];
		}

		console.log(`Received ${data.features.length} earthquakes`);

		return data.features
			.filter((f) => f.properties.mag !== null && f.properties.mag >= minMagnitude)
			.map((feature) => ({
				id: feature.id,
				magnitude: feature.properties.mag ?? 0,
				place: feature.properties.place ?? 'Unknown location',
				time: feature.properties.time,
				lat: feature.geometry.coordinates[1],
				lon: feature.geometry.coordinates[0],
				depth: feature.geometry.coordinates[2],
				url: feature.properties.url
			}));
	} catch (error) {
		console.error('Failed to fetch earthquakes:', error);
		return [];
	}
}

/**
 * Fetch grid carbon intensity data from WattTime API
 * Requires WATTTIME_USERNAME and WATTTIME_PASSWORD environment variables
 */
export async function fetchAllGridStress(
	username?: string,
	password?: string
): Promise<GridStressData[]> {
	const watttimeUsername = username || Deno.env.get('WATTTIME_USERNAME');
	const watttimePassword = password || Deno.env.get('WATTTIME_PASSWORD');

	if (!watttimeUsername || !watttimePassword) {
		console.warn('WattTime credentials not configured');
		return [];
	}

	try {
		// Get auth token
		const credentials = btoa(`${watttimeUsername}:${watttimePassword}`);
		const loginResponse = await fetch('https://api.watttime.org/login', {
			headers: {
				Authorization: `Basic ${credentials}`,
				Accept: 'application/json'
			},
			signal: AbortSignal.timeout(10000)
		});

		if (!loginResponse.ok) {
			console.warn(`WattTime login failed with status ${loginResponse.status}`);
			return [];
		}

		const loginData = await loginResponse.json();
		const token = loginData.token;

		if (!token) {
			console.warn('No token received from WattTime');
			return [];
		}

		const stressData: GridStressData[] = [];

		// Fetch data for each region
		for (const region of GRID_REGIONS) {
			try {
				// Get region ID
				const regionResponse = await fetch(
					`https://api.watttime.org/v3/region-from-loc?latitude=${region.lat}&longitude=${region.lon}&signal_type=co2_moer`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: 'application/json'
						},
						signal: AbortSignal.timeout(8000)
					}
				);

				if (!regionResponse.ok) continue;

				const regionData = await regionResponse.json();
				const regionId = regionData.region;
				if (!regionId) continue;

				// Get signal data
				const signalResponse = await fetch(
					`https://api.watttime.org/v3/signal-index?region=${regionId}&signal_type=co2_moer`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: 'application/json'
						},
						signal: AbortSignal.timeout(10000)
					}
				);

				if (!signalResponse.ok) continue;

				const signalData = await signalResponse.json();
				const dataPoint = signalData.data?.[0];
				if (!dataPoint) continue;

				const percent = dataPoint.value ?? 50;
				const stressLevel = getGridStressLevel(percent);

				stressData.push({
					id: `watttime-${region.countryCode}-${region.name.toLowerCase().replace(/\s+/g, '-')}`,
					region: region.name,
					country: region.country,
					countryCode: region.countryCode,
					lat: region.lat,
					lon: region.lon,
					moer: percent,
					frequency: 0,
					percent,
					signal_type: signalData.meta?.signal_type ?? 'co2_moer',
					stressLevel,
					description: getGridStressDescription(stressLevel, percent),
					timestamp: dataPoint.point_time ?? new Date().toISOString(),
					boundaryCoords: region.boundaryCoords,
					areaKm2: region.areaKm2
				});
			} catch (error) {
				console.warn(`Error fetching ${region.name}:`, error);
			}
		}

		// Sort by intensity level
		const intensityOrder = { critical: 0, high: 1, elevated: 2, normal: 3 };
		stressData.sort((a, b) => {
			const orderDiff = intensityOrder[a.stressLevel] - intensityOrder[b.stressLevel];
			if (orderDiff !== 0) return orderDiff;
			return b.percent - a.percent;
		});

		console.log(`Fetched ${stressData.length} grid regions`);
		return stressData;
	} catch (error) {
		console.error('Error fetching grid stress:', error);
		return [];
	}
}

/**
 * Fetch internet/power outage data
 * Uses IODA API from Georgia Tech
 */
export async function fetchOutageData(): Promise<OutageData[]> {
	try {
		// IODA API for internet outages
		const now = Math.floor(Date.now() / 1000);
		const oneDayAgo = now - 86400;

		const iodaUrl = `https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/country?from=${oneDayAgo}&until=${now}`;

		console.log('Fetching outage data from IODA...');

		const response = await fetch(iodaUrl, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			console.warn(`IODA API returned ${response.status}`);
			return [];
		}

		const data = await response.json();

		// Process IODA data into OutageData format
		const outages: OutageData[] = [];

		if (data.data && Array.isArray(data.data)) {
			for (const entry of data.data) {
				// IODA provides country-level outage signals
				if (entry.entity && entry.datasource === 'bgp') {
					const countryCode = entry.entity.code;
					const countryName = entry.entity.name || countryCode;

					// Check for significant drops (below 80% of normal)
					if (entry.value < 0.8) {
						outages.push({
							id: `ioda-${countryCode}-${entry.from}`,
							country: countryName,
							countryCode,
							type: 'internet',
							severity: entry.value < 0.5 ? 'major' : 'partial',
							lat: entry.entity.latitude || 0,
							lon: entry.entity.longitude || 0,
							description: `Internet connectivity at ${Math.round(entry.value * 100)}% of normal`,
							source: 'IODA (Georgia Tech)',
							active: true
						});
					}
				}
			}
		}

		console.log(`Processed ${outages.length} outages`);
		return outages;
	} catch (error) {
		console.error('Error fetching outage data:', error);
		return [];
	}
}
