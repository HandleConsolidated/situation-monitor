/**
 * Space Weather API - NOAA Space Weather Prediction Center (SWPC)
 * Fetches solar activity data for situational awareness
 */

import { logger } from '$lib/config/api';

const SWPC_BASE_URL = 'https://services.swpc.noaa.gov';

export interface SolarActivity {
	timestamp: string;
	kpIndex: number; // Geomagnetic activity (0-9)
	kpDescription: string;
	solarWindSpeed: number | null; // km/s
	solarWindDensity: number | null; // particles/cm³
	xrayFlux: string | null; // X-ray flux class
	protonFlux: number | null; // Proton flux
	geomagneticStorm: boolean;
	radioBlackout: boolean;
	solarRadiationStorm: boolean;
}

export interface SpaceWeatherAlert {
	id: string;
	type: 'geomagnetic_storm' | 'solar_radiation' | 'radio_blackout';
	severity: 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme';
	message: string;
	issuedAt: string;
	validUntil?: string;
}

// Kp index descriptions
const KP_DESCRIPTIONS: Record<number, string> = {
	0: 'Quiet',
	1: 'Quiet',
	2: 'Unsettled',
	3: 'Unsettled',
	4: 'Active',
	5: 'Minor Storm (G1)',
	6: 'Moderate Storm (G2)',
	7: 'Strong Storm (G3)',
	8: 'Severe Storm (G4)',
	9: 'Extreme Storm (G5)'
};

/**
 * Fetch current space weather conditions from NOAA SWPC
 */
export async function fetchSpaceWeather(): Promise<SolarActivity | null> {
	try {
		// Fetch planetary K-index (geomagnetic activity)
		const kpResponse = await fetch(`${SWPC_BASE_URL}/products/noaa-planetary-k-index.json`, {
			signal: AbortSignal.timeout(10000)
		});

		if (!kpResponse.ok) {
			throw new Error(`SWPC API error: ${kpResponse.status}`);
		}

		const kpData = await kpResponse.json();

		// Get most recent Kp value (last row in array)
		// Format: [timestamp, Kp, Kp_fraction, estimated, ...]
		const latestKp = kpData[kpData.length - 1];
		const kpIndex = parseInt(latestKp[1], 10) || 0;

		// Fetch real-time solar wind data
		let solarWindSpeed: number | null = null;
		let solarWindDensity: number | null = null;

		try {
			const solarWindResponse = await fetch(
				`${SWPC_BASE_URL}/products/solar-wind/plasma-7-day.json`,
				{ signal: AbortSignal.timeout(10000) }
			);

			if (solarWindResponse.ok) {
				const solarWindData = await solarWindResponse.json();
				if (solarWindData.length > 1) {
					const latest = solarWindData[solarWindData.length - 1];
					// Format: [timestamp, density, speed, temperature]
					solarWindDensity = parseFloat(latest[1]) || null;
					solarWindSpeed = parseFloat(latest[2]) || null;
				}
			}
		} catch (e) {
			logger.warn('SpaceWeather', 'Failed to fetch solar wind data');
		}

		// Fetch X-ray flux (solar flares)
		let xrayFlux: string | null = null;

		try {
			const xrayResponse = await fetch(`${SWPC_BASE_URL}/products/goes-primary/xrays-7-day.json`, {
				signal: AbortSignal.timeout(10000)
			});

			if (xrayResponse.ok) {
				const xrayData = await xrayResponse.json();
				if (xrayData.length > 1) {
					const latest = xrayData[xrayData.length - 1];
					// Format: [timestamp, short, long]
					const longWave = parseFloat(latest[2]);
					if (longWave) {
						xrayFlux = classifyXrayFlux(longWave);
					}
				}
			}
		} catch (e) {
			logger.warn('SpaceWeather', 'Failed to fetch X-ray flux data');
		}

		return {
			timestamp: latestKp[0],
			kpIndex,
			kpDescription: KP_DESCRIPTIONS[Math.min(kpIndex, 9)] || 'Unknown',
			solarWindSpeed,
			solarWindDensity,
			xrayFlux,
			protonFlux: null, // Could add proton flux endpoint
			geomagneticStorm: kpIndex >= 5,
			radioBlackout: xrayFlux !== null && ['M', 'X'].includes(xrayFlux[0]),
			solarRadiationStorm: false // Would need separate endpoint
		};
	} catch (error) {
		logger.warn('SpaceWeather', 'Failed to fetch space weather:', error);
		return null;
	}
}

/**
 * Fetch active space weather alerts/warnings
 */
export async function fetchSpaceWeatherAlerts(): Promise<SpaceWeatherAlert[]> {
	try {
		const response = await fetch(`${SWPC_BASE_URL}/products/alerts.json`, {
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			throw new Error(`SWPC alerts API error: ${response.status}`);
		}

		const data = await response.json();
		const alerts: SpaceWeatherAlert[] = [];

		// Parse SWPC alerts
		for (const alert of data) {
			if (!alert.product_id || !alert.message) continue;

			const type = classifyAlertType(alert.product_id);
			if (!type) continue;

			alerts.push({
				id: alert.product_id,
				type,
				severity: classifyAlertSeverity(alert.message),
				message: alert.message,
				issuedAt: alert.issue_datetime || new Date().toISOString()
			});
		}

		return alerts;
	} catch (error) {
		logger.warn('SpaceWeather', 'Failed to fetch space weather alerts:', error);
		return [];
	}
}

/**
 * Classify X-ray flux into solar flare class
 */
function classifyXrayFlux(flux: number): string {
	if (flux >= 1e-4) return 'X' + Math.floor(flux / 1e-4);
	if (flux >= 1e-5) return 'M' + Math.floor(flux / 1e-5);
	if (flux >= 1e-6) return 'C' + Math.floor(flux / 1e-6);
	if (flux >= 1e-7) return 'B' + Math.floor(flux / 1e-7);
	return 'A';
}

/**
 * Classify alert type from product ID
 */
function classifyAlertType(
	productId: string
): 'geomagnetic_storm' | 'solar_radiation' | 'radio_blackout' | null {
	const id = productId.toLowerCase();
	if (id.includes('wata') || id.includes('watch') || id.includes('altk')) return 'geomagnetic_storm';
	if (id.includes('sum') || id.includes('prot')) return 'solar_radiation';
	if (id.includes('xray') || id.includes('flare')) return 'radio_blackout';
	return null;
}

/**
 * Classify alert severity from message content
 */
function classifyAlertSeverity(
	message: string
): 'minor' | 'moderate' | 'strong' | 'severe' | 'extreme' {
	const msg = message.toLowerCase();
	if (msg.includes('extreme') || msg.includes('g5') || msg.includes('s5') || msg.includes('r5'))
		return 'extreme';
	if (msg.includes('severe') || msg.includes('g4') || msg.includes('s4') || msg.includes('r4'))
		return 'severe';
	if (msg.includes('strong') || msg.includes('g3') || msg.includes('s3') || msg.includes('r3'))
		return 'strong';
	if (msg.includes('moderate') || msg.includes('g2') || msg.includes('s2') || msg.includes('r2'))
		return 'moderate';
	return 'minor';
}

/**
 * Get severity color for space weather
 */
export function getSpaceWeatherColor(kpIndex: number): string {
	if (kpIndex >= 8) return '#d946ef'; // Extreme - Fuchsia
	if (kpIndex >= 7) return '#ef4444'; // Severe - Red
	if (kpIndex >= 6) return '#f97316'; // Strong - Orange
	if (kpIndex >= 5) return '#f59e0b'; // Moderate - Amber
	if (kpIndex >= 4) return '#eab308'; // Active - Yellow
	return '#22c55e'; // Quiet - Green
}
