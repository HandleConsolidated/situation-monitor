/**
 * Weather API functions for NWS (National Weather Service) integration
 * Fetches alerts, forecasts, and zone information for the Weather Command Center
 */

import { logger } from '$lib/config/api';
import { NWS_API } from '$lib/config/weather';
import type {
	WeatherAlert,
	AlertSeverity,
	AlertUrgency,
	AlertCertainty,
	AlertCategory,
	ForecastPeriod,
	ForecastHighlight
} from '$lib/types';

/**
 * Internal helper for NWS API requests with proper headers
 */
async function nwsFetch(endpoint: string): Promise<Response> {
	const url = `${NWS_API.baseUrl}${endpoint}`;

	const response = await fetch(url, {
		headers: {
			'User-Agent': NWS_API.userAgent,
			Accept: 'application/geo+json'
		},
		signal: AbortSignal.timeout(15000)
	});

	if (!response.ok) {
		throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
	}

	return response;
}

/**
 * Fetch active alerts for a US state
 * @param stateCode - Two-letter state code (e.g., 'TX', 'CA')
 */
export async function fetchAlertsByState(stateCode: string): Promise<WeatherAlert[]> {
	try {
		const response = await nwsFetch(`${NWS_API.endpoints.alertsArea}/${stateCode}`);
		const data = await response.json();

		if (!data.features || !Array.isArray(data.features)) {
			logger.warn('Weather', `No alert features found for state ${stateCode}`);
			return [];
		}

		return parseAlertFeatures(data.features);
	} catch (error) {
		logger.warn('Weather', `Failed to fetch alerts for state ${stateCode}:`, error);
		return [];
	}
}

/**
 * Fetch active alerts for a specific NWS zone
 * @param zoneCode - NWS zone code (e.g., 'TXZ001')
 */
export async function fetchAlertsByZone(zoneCode: string): Promise<WeatherAlert[]> {
	try {
		const response = await nwsFetch(`${NWS_API.endpoints.alertsActive}?zone=${zoneCode}`);
		const data = await response.json();

		if (!data.features || !Array.isArray(data.features)) {
			logger.warn('Weather', `No alert features found for zone ${zoneCode}`);
			return [];
		}

		return parseAlertFeatures(data.features);
	} catch (error) {
		logger.warn('Weather', `Failed to fetch alerts for zone ${zoneCode}:`, error);
		return [];
	}
}

/**
 * Fetch all active alerts nationwide
 */
export async function fetchAllActiveAlerts(): Promise<WeatherAlert[]> {
	try {
		const response = await nwsFetch(NWS_API.endpoints.alertsActive);
		const data = await response.json();

		if (!data.features || !Array.isArray(data.features)) {
			logger.warn('Weather', 'No alert features found in nationwide fetch');
			return [];
		}

		return parseAlertFeatures(data.features);
	} catch (error) {
		logger.warn('Weather', 'Failed to fetch all active alerts:', error);
		return [];
	}
}

/**
 * Fetch alerts for multiple states, deduplicating by alert ID
 * @param stateCodes - Array of two-letter state codes
 */
export async function fetchAlertsForStates(stateCodes: string[]): Promise<WeatherAlert[]> {
	const alertsMap = new Map<string, WeatherAlert>();

	// Fetch alerts for each state in parallel
	const results = await Promise.allSettled(stateCodes.map((code) => fetchAlertsByState(code)));

	for (const result of results) {
		if (result.status === 'fulfilled') {
			for (const alert of result.value) {
				// Deduplicate by alert ID
				if (!alertsMap.has(alert.id)) {
					alertsMap.set(alert.id, alert);
				}
			}
		}
	}

	return Array.from(alertsMap.values());
}

/**
 * NWS grid point response shape
 */
interface GridPointProperties {
	gridId: string;
	gridX: number;
	gridY: number;
	forecast: string;
	forecastHourly: string;
	forecastGridData: string;
	observationStations: string;
	relativeLocation: {
		properties: {
			city: string;
			state: string;
		};
	};
	timeZone: string;
}

interface GridPointResponse {
	properties: GridPointProperties;
}

/**
 * Get NWS grid point info for a coordinate
 * This is required to get forecast URLs for a specific location
 * @param lat - Latitude
 * @param lon - Longitude
 */
export async function fetchGridPoint(
	lat: number,
	lon: number
): Promise<GridPointProperties | null> {
	try {
		// NWS expects coordinates rounded to 4 decimal places
		const roundedLat = Math.round(lat * 10000) / 10000;
		const roundedLon = Math.round(lon * 10000) / 10000;

		const response = await nwsFetch(`${NWS_API.endpoints.points}/${roundedLat},${roundedLon}`);
		const data: GridPointResponse = await response.json();

		return data.properties;
	} catch (error) {
		logger.warn('Weather', `Failed to fetch grid point for ${lat},${lon}:`, error);
		return null;
	}
}

/**
 * NWS forecast response shape
 */
interface ForecastResponse {
	properties: {
		updated: string;
		generatedAt: string;
		periods: ForecastPeriod[];
	};
}

/**
 * Fetch forecast periods for a coordinate
 * @param lat - Latitude
 * @param lon - Longitude
 */
export async function fetchForecast(lat: number, lon: number): Promise<ForecastPeriod[]> {
	try {
		const gridPoint = await fetchGridPoint(lat, lon);
		if (!gridPoint) {
			logger.warn('Weather', `Could not get grid point for ${lat},${lon}`);
			return [];
		}

		// Fetch the forecast using the forecast URL from grid point
		const forecastUrl = gridPoint.forecast.replace(NWS_API.baseUrl, '');
		const response = await nwsFetch(forecastUrl);
		const data: ForecastResponse = await response.json();

		if (!data.properties?.periods) {
			logger.warn('Weather', `No forecast periods found for ${lat},${lon}`);
			return [];
		}

		return data.properties.periods;
	} catch (error) {
		logger.warn('Weather', `Failed to fetch forecast for ${lat},${lon}:`, error);
		return [];
	}
}

/**
 * NWS zone info response shape
 */
interface ZoneInfoResponse {
	properties: {
		id: string;
		name: string;
		type: string;
		state: string;
		cwa: string[];
		geometry: GeoJSON.Geometry | null;
	};
	geometry: GeoJSON.Geometry | null;
}

/**
 * Get zone metadata including centroid
 * @param zoneCode - NWS zone code
 */
export async function fetchZoneInfo(
	zoneCode: string
): Promise<{ name: string; centroid: { lat: number; lon: number } | null } | null> {
	try {
		const response = await nwsFetch(`${NWS_API.endpoints.zones}/forecast/${zoneCode}`);
		const data: ZoneInfoResponse = await response.json();

		const name = data.properties?.name || zoneCode;

		// Try to extract centroid from geometry
		let centroid: { lat: number; lon: number } | null = null;
		const geometry = data.geometry || data.properties?.geometry;

		if (geometry) {
			centroid = calculateCentroid(geometry);
		}

		return { name, centroid };
	} catch (error) {
		logger.warn('Weather', `Failed to fetch zone info for ${zoneCode}:`, error);
		return null;
	}
}

/**
 * Calculate centroid from GeoJSON geometry
 */
function calculateCentroid(geometry: GeoJSON.Geometry): { lat: number; lon: number } | null {
	try {
		let coords: number[][] = [];

		if (geometry.type === 'Polygon') {
			coords = geometry.coordinates[0] as number[][];
		} else if (geometry.type === 'MultiPolygon') {
			// Use the first polygon
			coords = geometry.coordinates[0][0] as number[][];
		} else if (geometry.type === 'Point') {
			const [lon, lat] = geometry.coordinates as number[];
			return { lat, lon };
		} else {
			return null;
		}

		if (coords.length === 0) return null;

		// Simple centroid calculation
		let sumLat = 0;
		let sumLon = 0;
		for (const coord of coords) {
			sumLon += coord[0];
			sumLat += coord[1];
		}

		return {
			lat: sumLat / coords.length,
			lon: sumLon / coords.length
		};
	} catch {
		return null;
	}
}

/**
 * NWS alert feature from GeoJSON response
 */
interface NWSAlertFeature {
	id: string;
	properties: {
		id: string;
		areaDesc: string;
		geocode: {
			SAME: string[];
			UGC: string[];
		};
		affectedZones: string[];
		references: Array<{
			'@id': string;
			identifier: string;
			sender: string;
			sent: string;
		}>;
		sent: string;
		effective: string;
		onset: string | null;
		expires: string;
		ends: string | null;
		status: 'Actual' | 'Exercise' | 'System' | 'Test' | 'Draft';
		messageType: 'Alert' | 'Update' | 'Cancel' | 'Ack' | 'Error';
		category: string;
		severity: string;
		certainty: string;
		urgency: string;
		event: string;
		sender: string;
		senderName: string;
		headline: string | null;
		description: string;
		instruction: string | null;
		response: string;
		parameters: Record<string, string[]>;
	};
	geometry: GeoJSON.Geometry | null;
}

/**
 * Parse NWS GeoJSON alert features to WeatherAlert[]
 */
export function parseAlertFeatures(features: NWSAlertFeature[]): WeatherAlert[] {
	return features.map((feature) => {
		const props = feature.properties;

		return {
			id: props.id,
			areaDesc: props.areaDesc || '',
			geocode: {
				SAME: props.geocode?.SAME || [],
				UGC: props.geocode?.UGC || []
			},
			affectedZones: props.affectedZones || [],
			references: (props.references || []).map((ref) => ({
				id: ref['@id'] || '',
				identifier: ref.identifier || '',
				sender: ref.sender || '',
				sent: ref.sent || ''
			})),
			sent: props.sent || '',
			effective: props.effective || '',
			onset: props.onset,
			expires: props.expires || '',
			ends: props.ends,
			status: props.status || 'Actual',
			messageType: props.messageType || 'Alert',
			category: (props.category as AlertCategory) || 'Met',
			severity: (props.severity as AlertSeverity) || 'Unknown',
			certainty: (props.certainty as AlertCertainty) || 'Unknown',
			urgency: (props.urgency as AlertUrgency) || 'Unknown',
			event: props.event || '',
			sender: props.sender || '',
			senderName: props.senderName || '',
			headline: props.headline,
			description: props.description || '',
			instruction: props.instruction,
			response: (props.response as WeatherAlert['response']) || 'None',
			parameters: props.parameters || {},
			geometry: feature.geometry
		};
	});
}

/**
 * Extract key information from forecast periods for a location
 */
export function extractForecastHighlights(
	location: string,
	zoneId: string,
	periods: ForecastPeriod[]
): ForecastHighlight {
	// Default highlight structure
	const highlight: ForecastHighlight = {
		location,
		zoneId,
		summary: '',
		temperature: { high: null, low: null },
		precipitation: { chance: null, type: null, accumulation: null },
		wind: { speed: '', gusts: null },
		timing: '',
		severity: 'low'
	};

	if (!periods || periods.length === 0) {
		highlight.summary = 'No forecast data available';
		return highlight;
	}

	// Get temperature extremes from first 4 periods (48 hours)
	const relevantPeriods = periods.slice(0, 4);

	for (const period of relevantPeriods) {
		if (period.isDaytime) {
			if (highlight.temperature.high === null || period.temperature > highlight.temperature.high) {
				highlight.temperature.high = period.temperature;
			}
		} else {
			if (highlight.temperature.low === null || period.temperature < highlight.temperature.low) {
				highlight.temperature.low = period.temperature;
			}
		}
	}

	// Find precipitation info from first period with precipitation
	for (const period of relevantPeriods) {
		const pop = period.probabilityOfPrecipitation?.value;
		if (pop !== null && pop !== undefined && pop > 0) {
			if (highlight.precipitation.chance === null || pop > highlight.precipitation.chance) {
				highlight.precipitation.chance = pop;
				highlight.timing = period.name;
			}

			// Detect precipitation type from shortForecast
			const forecast = period.shortForecast.toLowerCase();
			const detailedForecast = period.detailedForecast.toLowerCase();

			if (forecast.includes('snow') || detailedForecast.includes('snow')) {
				highlight.precipitation.type = 'snow';
				// Look for accumulation in detailed forecast
				const accumMatch = detailedForecast.match(
					/(\d+(?:\.\d+)?)\s*(?:to\s*)?(\d+(?:\.\d+)?)?\s*inch(?:es)?/i
				);
				if (accumMatch) {
					highlight.precipitation.accumulation = accumMatch[2]
						? `${accumMatch[1]}-${accumMatch[2]} inches`
						: `${accumMatch[1]} inches`;
				}
			} else if (
				forecast.includes('ice') ||
				forecast.includes('freezing') ||
				detailedForecast.includes('ice') ||
				detailedForecast.includes('freezing')
			) {
				highlight.precipitation.type = 'ice';
			} else if (
				forecast.includes('rain') ||
				forecast.includes('shower') ||
				detailedForecast.includes('rain')
			) {
				highlight.precipitation.type = 'rain';
			} else if (
				forecast.includes('thunderstorm') ||
				detailedForecast.includes('thunderstorm')
			) {
				highlight.precipitation.type = 'thunderstorm';
			}
		}
	}

	// Get wind info from first period
	const firstPeriod = periods[0];
	highlight.wind.speed = firstPeriod.windSpeed || '';

	// Check for wind gusts in detailed forecast
	const gustMatch = firstPeriod.detailedForecast.match(/gusts?\s*(?:up\s*to\s*)?(\d+)\s*mph/i);
	if (gustMatch) {
		highlight.wind.gusts = `${gustMatch[1]} mph`;
	}

	// Build summary
	const summaryParts: string[] = [];
	if (firstPeriod.shortForecast) {
		summaryParts.push(firstPeriod.shortForecast);
	}
	if (highlight.temperature.high !== null) {
		summaryParts.push(`High ${highlight.temperature.high}F`);
	}
	if (highlight.precipitation.chance && highlight.precipitation.chance > 20) {
		summaryParts.push(`${highlight.precipitation.chance}% chance of precipitation`);
	}
	highlight.summary = summaryParts.join('. ');

	// Determine severity based on conditions
	highlight.severity = determineForecastSeverity(highlight, relevantPeriods);

	return highlight;
}

/**
 * Determine forecast severity level based on conditions
 */
function determineForecastSeverity(
	highlight: ForecastHighlight,
	periods: ForecastPeriod[]
): 'extreme' | 'high' | 'moderate' | 'low' {
	// Check for extreme conditions
	const hasExtremeHeat =
		highlight.temperature.high !== null && highlight.temperature.high >= 105;
	const hasExtremeCold = highlight.temperature.low !== null && highlight.temperature.low <= -10;
	const hasIce = highlight.precipitation.type === 'ice';

	if (hasExtremeHeat || hasExtremeCold || hasIce) {
		return 'extreme';
	}

	// Check for high severity
	const hasHeavySnow =
		highlight.precipitation.type === 'snow' && highlight.precipitation.accumulation !== null;
	const hasHighPrecip =
		highlight.precipitation.chance !== null && highlight.precipitation.chance >= 70;
	const hasHighWinds = periods.some((p) => {
		const windMatch = p.windSpeed.match(/(\d+)/);
		return windMatch && parseInt(windMatch[1]) >= 30;
	});

	if (hasHeavySnow || (hasHighPrecip && hasHighWinds)) {
		return 'high';
	}

	// Check for moderate severity
	const hasModerateConditions =
		(highlight.precipitation.chance !== null && highlight.precipitation.chance >= 50) ||
		highlight.precipitation.type === 'thunderstorm' ||
		(highlight.temperature.high !== null && highlight.temperature.high >= 95) ||
		(highlight.temperature.low !== null && highlight.temperature.low <= 20);

	if (hasModerateConditions) {
		return 'moderate';
	}

	return 'low';
}

/**
 * Generate plain text weather briefing from alerts and forecasts
 */
export function generateBriefingText(
	alerts: WeatherAlert[],
	forecasts: ForecastHighlight[]
): string {
	const lines: string[] = [];
	const now = new Date();

	lines.push('WEATHER BRIEFING');
	lines.push(`Generated: ${now.toLocaleString()}`);
	lines.push('='.repeat(50));
	lines.push('');

	// Group alerts by event type
	if (alerts.length > 0) {
		lines.push('ACTIVE ALERTS');
		lines.push('-'.repeat(30));

		const alertsByEvent = groupAlertsByEvent(alerts);

		for (const [event, eventAlerts] of Object.entries(alertsByEvent)) {
			lines.push('');
			lines.push(`${event} (${eventAlerts.length})`);

			for (const alert of eventAlerts) {
				lines.push(`  - ${alert.areaDesc}`);
				lines.push(`    Severity: ${alert.severity} | Expires: ${formatExpires(alert.expires)}`);
				if (alert.headline) {
					lines.push(`    ${alert.headline}`);
				}
			}
		}
	} else {
		lines.push('NO ACTIVE ALERTS');
	}

	lines.push('');
	lines.push('='.repeat(50));
	lines.push('');

	// Add forecast highlights
	if (forecasts.length > 0) {
		lines.push('FORECAST HIGHLIGHTS');
		lines.push('-'.repeat(30));

		for (const forecast of forecasts) {
			lines.push('');
			lines.push(`${forecast.location}`);
			lines.push(`  ${forecast.summary}`);
			if (forecast.temperature.high !== null || forecast.temperature.low !== null) {
				const temps: string[] = [];
				if (forecast.temperature.high !== null) temps.push(`High: ${forecast.temperature.high}F`);
				if (forecast.temperature.low !== null) temps.push(`Low: ${forecast.temperature.low}F`);
				lines.push(`  Temperature: ${temps.join(' / ')}`);
			}
			if (forecast.precipitation.chance && forecast.precipitation.chance > 0) {
				let precipLine = `  Precipitation: ${forecast.precipitation.chance}%`;
				if (forecast.precipitation.type) precipLine += ` (${forecast.precipitation.type})`;
				if (forecast.precipitation.accumulation)
					precipLine += ` - ${forecast.precipitation.accumulation}`;
				lines.push(precipLine);
			}
			if (forecast.wind.speed) {
				let windLine = `  Wind: ${forecast.wind.speed}`;
				if (forecast.wind.gusts) windLine += `, gusts to ${forecast.wind.gusts}`;
				lines.push(windLine);
			}
		}
	}

	lines.push('');
	lines.push('='.repeat(50));
	lines.push('END BRIEFING');

	return lines.join('\n');
}

/**
 * Generate markdown weather briefing from alerts and forecasts
 */
export function generateBriefingMarkdown(
	alerts: WeatherAlert[],
	forecasts: ForecastHighlight[]
): string {
	const lines: string[] = [];
	const now = new Date();

	lines.push('# Weather Briefing');
	lines.push('');
	lines.push(`*Generated: ${now.toLocaleString()}*`);
	lines.push('');
	lines.push('---');
	lines.push('');

	// Group alerts by event type
	if (alerts.length > 0) {
		lines.push('## Active Alerts');
		lines.push('');

		const alertsByEvent = groupAlertsByEvent(alerts);

		for (const [event, eventAlerts] of Object.entries(alertsByEvent)) {
			lines.push(`### ${event} (${eventAlerts.length})`);
			lines.push('');

			for (const alert of eventAlerts) {
				const severityBadge = getSeverityBadge(alert.severity);
				lines.push(`**${alert.areaDesc}** ${severityBadge}`);
				lines.push('');
				if (alert.headline) {
					lines.push(`> ${alert.headline}`);
					lines.push('');
				}
				lines.push(`- **Expires:** ${formatExpires(alert.expires)}`);
				lines.push(`- **Certainty:** ${alert.certainty}`);
				lines.push(`- **Urgency:** ${alert.urgency}`);
				lines.push('');
			}
		}
	} else {
		lines.push('## Active Alerts');
		lines.push('');
		lines.push('*No active alerts at this time.*');
		lines.push('');
	}

	lines.push('---');
	lines.push('');

	// Add forecast highlights
	if (forecasts.length > 0) {
		lines.push('## Forecast Highlights');
		lines.push('');

		for (const forecast of forecasts) {
			const severityEmoji = getSeverityEmoji(forecast.severity);
			lines.push(`### ${forecast.location} ${severityEmoji}`);
			lines.push('');
			lines.push(`**${forecast.summary}**`);
			lines.push('');

			lines.push('| Metric | Value |');
			lines.push('|--------|-------|');

			if (forecast.temperature.high !== null || forecast.temperature.low !== null) {
				const temps: string[] = [];
				if (forecast.temperature.high !== null) temps.push(`High: ${forecast.temperature.high}F`);
				if (forecast.temperature.low !== null) temps.push(`Low: ${forecast.temperature.low}F`);
				lines.push(`| Temperature | ${temps.join(' / ')} |`);
			}

			if (forecast.precipitation.chance && forecast.precipitation.chance > 0) {
				let precipValue = `${forecast.precipitation.chance}%`;
				if (forecast.precipitation.type) precipValue += ` (${forecast.precipitation.type})`;
				if (forecast.precipitation.accumulation)
					precipValue += ` - ${forecast.precipitation.accumulation}`;
				lines.push(`| Precipitation | ${precipValue} |`);
			}

			if (forecast.wind.speed) {
				let windValue = forecast.wind.speed;
				if (forecast.wind.gusts) windValue += `, gusts ${forecast.wind.gusts}`;
				lines.push(`| Wind | ${windValue} |`);
			}

			lines.push('');
		}
	}

	lines.push('---');
	lines.push('');
	lines.push('*End of briefing*');

	return lines.join('\n');
}

/**
 * Group alerts by event type
 */
function groupAlertsByEvent(alerts: WeatherAlert[]): Record<string, WeatherAlert[]> {
	const grouped: Record<string, WeatherAlert[]> = {};

	for (const alert of alerts) {
		const event = alert.event || 'Unknown';
		if (!grouped[event]) {
			grouped[event] = [];
		}
		grouped[event].push(alert);
	}

	// Sort each group by severity
	const severityOrder: Record<string, number> = {
		Extreme: 0,
		Severe: 1,
		Moderate: 2,
		Minor: 3,
		Unknown: 4
	};

	for (const event of Object.keys(grouped)) {
		grouped[event].sort((a, b) => {
			const aOrder = severityOrder[a.severity] ?? 4;
			const bOrder = severityOrder[b.severity] ?? 4;
			return aOrder - bOrder;
		});
	}

	return grouped;
}

/**
 * Format expires date for display
 */
function formatExpires(expires: string): string {
	try {
		const date = new Date(expires);
		return date.toLocaleString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZoneName: 'short'
		});
	} catch {
		return expires;
	}
}

/**
 * Get markdown severity badge
 */
function getSeverityBadge(severity: AlertSeverity): string {
	switch (severity) {
		case 'Extreme':
			return '`EXTREME`';
		case 'Severe':
			return '`SEVERE`';
		case 'Moderate':
			return '`MODERATE`';
		case 'Minor':
			return '`MINOR`';
		default:
			return '';
	}
}

/**
 * Get severity emoji for forecast
 */
function getSeverityEmoji(severity: 'extreme' | 'high' | 'moderate' | 'low'): string {
	switch (severity) {
		case 'extreme':
			return '[!]';
		case 'high':
			return '[!]';
		case 'moderate':
			return '[*]';
		default:
			return '';
	}
}
