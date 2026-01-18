/**
 * Vessel Fallback Service
 *
 * Provides simulated vessel data for visualization when AIS Stream is unavailable.
 * Vessels are positioned at strategic chokepoints and major shipping lanes
 * that align with the situation monitor's focus areas.
 *
 * For real AIS data, consider:
 * - AISHub (free, requires own AIS receiver): https://www.aishub.net/
 * - VesselFinder API (paid): https://api.vesselfinder.com/
 * - Data Docked (paid): https://datadocked.com/
 */

import type { Vessel } from './vessel-stream';

// Strategic maritime chokepoints with vessel traffic
const CHOKEPOINT_VESSELS: Vessel[] = [
	// Strait of Hormuz - Heavy tanker traffic
	{
		mmsi: '212345001',
		name: 'CRUDE VOYAGER',
		lat: 26.5667,
		lon: 56.25,
		course: 135,
		speed: 12.5,
		heading: 138,
		shipType: 80,
		shipTypeName: 'Tanker',
		destination: 'SINGAPORE',
		length: 333,
		width: 60,
		lastUpdate: Date.now()
	},
	{
		mmsi: '212345002',
		name: 'PERSIAN GULF STAR',
		lat: 26.45,
		lon: 56.35,
		course: 310,
		speed: 11.2,
		heading: 312,
		shipType: 80,
		shipTypeName: 'Tanker',
		destination: 'RAS TANURA',
		length: 274,
		width: 48,
		lastUpdate: Date.now()
	},

	// Suez Canal - Mixed traffic
	{
		mmsi: '212345003',
		name: 'EVER FORTUNE',
		lat: 30.45,
		lon: 32.35,
		course: 350,
		speed: 8.5,
		heading: 352,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'ROTTERDAM',
		length: 400,
		width: 59,
		lastUpdate: Date.now()
	},
	{
		mmsi: '212345004',
		name: 'MAERSK TITAN',
		lat: 30.25,
		lon: 32.34,
		course: 170,
		speed: 7.8,
		heading: 172,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'JEDDAH',
		length: 366,
		width: 51,
		lastUpdate: Date.now()
	},

	// Strait of Malacca - Busiest shipping lane
	{
		mmsi: '212345005',
		name: 'PACIFIC TRADER',
		lat: 1.35,
		lon: 103.8,
		course: 290,
		speed: 14.2,
		heading: 288,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'MUMBAI',
		length: 294,
		width: 32,
		lastUpdate: Date.now()
	},
	{
		mmsi: '212345006',
		name: 'ENERGY PIONEER',
		lat: 1.25,
		lon: 103.65,
		course: 110,
		speed: 13.1,
		heading: 112,
		shipType: 81,
		shipTypeName: 'Tanker Hazardous A',
		destination: 'YOKOHAMA',
		length: 250,
		width: 44,
		lastUpdate: Date.now()
	},

	// Taiwan Strait - Strategic waterway
	{
		mmsi: '212345007',
		name: 'GLOBAL UNITY',
		lat: 24.5,
		lon: 119.5,
		course: 25,
		speed: 15.5,
		heading: 28,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'SHANGHAI',
		length: 336,
		width: 46,
		lastUpdate: Date.now()
	},
	{
		mmsi: '212345008',
		name: 'ORIENTAL SPIRIT',
		lat: 24.8,
		lon: 119.8,
		course: 205,
		speed: 14.8,
		heading: 202,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'KAOHSIUNG',
		length: 280,
		width: 40,
		lastUpdate: Date.now()
	},

	// Bab el-Mandeb - Red Sea entrance
	{
		mmsi: '212345009',
		name: 'RED SEA CARRIER',
		lat: 12.65,
		lon: 43.45,
		course: 340,
		speed: 11.8,
		heading: 342,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'SUEZ',
		length: 225,
		width: 32,
		lastUpdate: Date.now()
	},
	{
		mmsi: '212345010',
		name: 'ARABIAN VOYAGER',
		lat: 12.55,
		lon: 43.35,
		course: 160,
		speed: 10.5,
		heading: 158,
		shipType: 80,
		shipTypeName: 'Tanker',
		destination: 'DJIBOUTI',
		length: 183,
		width: 32,
		lastUpdate: Date.now()
	},

	// Panama Canal approaches
	{
		mmsi: '212345011',
		name: 'ATLANTIC EXPRESS',
		lat: 9.38,
		lon: -79.92,
		course: 315,
		speed: 6.5,
		heading: 318,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'BALBOA',
		length: 294,
		width: 32,
		lastUpdate: Date.now()
	},
	{
		mmsi: '212345012',
		name: 'PACIFIC BRIDGE',
		lat: 8.95,
		lon: -79.55,
		course: 135,
		speed: 7.2,
		heading: 132,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'COLON',
		length: 260,
		width: 32,
		lastUpdate: Date.now()
	},

	// South China Sea - Spratly Islands area
	{
		mmsi: '212345013',
		name: 'DRAGON FORTUNE',
		lat: 10.5,
		lon: 114.2,
		course: 45,
		speed: 16.2,
		heading: 48,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'HONG KONG',
		length: 366,
		width: 51,
		lastUpdate: Date.now()
	},

	// Black Sea - Near Ukraine
	{
		mmsi: '212345014',
		name: 'BLACK SEA GRAIN',
		lat: 44.15,
		lon: 33.45,
		course: 250,
		speed: 10.8,
		heading: 248,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'ISTANBUL',
		length: 190,
		width: 28,
		lastUpdate: Date.now()
	},

	// Persian Gulf - Near Iran
	{
		mmsi: '212345015',
		name: 'GULF ENTERPRISE',
		lat: 27.15,
		lon: 52.55,
		course: 180,
		speed: 9.5,
		heading: 178,
		shipType: 80,
		shipTypeName: 'Tanker',
		destination: 'BANDAR ABBAS',
		length: 228,
		width: 42,
		lastUpdate: Date.now()
	},

	// East China Sea - Near Senkaku
	{
		mmsi: '212345016',
		name: 'EAST WIND',
		lat: 25.75,
		lon: 123.5,
		course: 280,
		speed: 13.5,
		heading: 282,
		shipType: 30,
		shipTypeName: 'Fishing',
		destination: 'NAHA',
		length: 45,
		width: 8,
		lastUpdate: Date.now()
	},

	// Korean Peninsula waters
	{
		mmsi: '212345017',
		name: 'KOREA STAR',
		lat: 35.1,
		lon: 129.5,
		course: 90,
		speed: 14.2,
		heading: 88,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'BUSAN',
		length: 320,
		width: 45,
		lastUpdate: Date.now()
	},

	// Gibraltar Strait
	{
		mmsi: '212345018',
		name: 'MEDITERRANEAN PRIDE',
		lat: 35.95,
		lon: -5.6,
		course: 85,
		speed: 15.8,
		heading: 82,
		shipType: 80,
		shipTypeName: 'Tanker',
		destination: 'ALGECIRAS',
		length: 274,
		width: 48,
		lastUpdate: Date.now()
	},

	// English Channel
	{
		mmsi: '212345019',
		name: 'CHANNEL TRADER',
		lat: 50.85,
		lon: 1.25,
		course: 225,
		speed: 12.5,
		heading: 222,
		shipType: 70,
		shipTypeName: 'Cargo',
		destination: 'LE HAVRE',
		length: 185,
		width: 28,
		lastUpdate: Date.now()
	},

	// Cape of Good Hope
	{
		mmsi: '212345020',
		name: 'CAPE NAVIGATOR',
		lat: -34.35,
		lon: 18.45,
		course: 75,
		speed: 14.5,
		heading: 72,
		shipType: 80,
		shipTypeName: 'Tanker',
		destination: 'DURBAN',
		length: 333,
		width: 60,
		lastUpdate: Date.now()
	}
];

// Add slight position variation to simulate movement
function addMovementVariation(vessels: Vessel[]): Vessel[] {
	const now = Date.now();
	return vessels.map((vessel) => {
		// Calculate slight position drift based on course and speed
		const timeFactor = (now % 60000) / 60000; // 0-1 over 60 seconds
		const speedFactor = (vessel.speed || 10) / 3600; // Convert knots to degrees per second (rough)
		const courseRad = ((vessel.course || 0) * Math.PI) / 180;

		// Small drift to simulate movement
		const latDrift = Math.cos(courseRad) * speedFactor * timeFactor * 0.01;
		const lonDrift = Math.sin(courseRad) * speedFactor * timeFactor * 0.01;

		return {
			...vessel,
			lat: vessel.lat + latDrift,
			lon: vessel.lon + lonDrift,
			lastUpdate: now
		};
	});
}

/**
 * Get simulated vessel positions
 * Returns vessels at strategic chokepoints with slight movement variation
 */
export function getFallbackVessels(): Vessel[] {
	return addMovementVariation(CHOKEPOINT_VESSELS);
}

/**
 * Get vessel count
 */
export function getFallbackVesselCount(): number {
	return CHOKEPOINT_VESSELS.length;
}
