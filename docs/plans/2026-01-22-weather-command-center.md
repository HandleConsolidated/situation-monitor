# Weather Command Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive US severe weather command center with a dashboard panel for at-a-glance alerts and a full modal for deep analysis, briefing generation, and interactive zone monitoring.

**Architecture:** Panel + Modal pattern with shared weather store. NWS API (free, no key) for alerts and forecasts. State/county-based watch zones with custom point support. Globe integration via alert polygons and panel-to-map navigation.

**Tech Stack:** Svelte 5 runes, TypeScript, NWS API (api.weather.gov), Mapbox GL layers, localStorage persistence

---

## Task 1: Weather Types and Configuration

**Files:**
- Create: `src/lib/types/weather.ts`
- Modify: `src/lib/types/index.ts`
- Create: `src/lib/config/weather.ts`
- Modify: `src/lib/config/index.ts`

**Step 1: Create weather type definitions**

```typescript
// src/lib/types/weather.ts

/**
 * NWS Alert severity levels
 */
export type AlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';

/**
 * NWS Alert urgency levels
 */
export type AlertUrgency = 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';

/**
 * NWS Alert certainty levels
 */
export type AlertCertainty = 'Observed' | 'Likely' | 'Possible' | 'Unlikely' | 'Unknown';

/**
 * NWS Alert categories
 */
export type AlertCategory = 'Met' | 'Geo' | 'Safety' | 'Security' | 'Rescue' | 'Fire' | 'Health' | 'Env' | 'Transport' | 'Infra' | 'CBRNE' | 'Other';

/**
 * NWS Weather Alert from api.weather.gov/alerts
 */
export interface WeatherAlert {
	id: string;
	areaDesc: string; // Human-readable affected area
	geocode: {
		SAME: string[]; // FIPS codes
		UGC: string[]; // NWS zone codes
	};
	affectedZones: string[]; // URLs to zone resources
	references: Array<{
		id: string;
		identifier: string;
		sender: string;
		sent: string;
	}>;
	sent: string; // ISO timestamp
	effective: string; // ISO timestamp
	onset: string | null; // ISO timestamp - when hazard begins
	expires: string; // ISO timestamp
	ends: string | null; // ISO timestamp - when hazard ends
	status: 'Actual' | 'Exercise' | 'System' | 'Test' | 'Draft';
	messageType: 'Alert' | 'Update' | 'Cancel' | 'Ack' | 'Error';
	category: AlertCategory;
	severity: AlertSeverity;
	certainty: AlertCertainty;
	urgency: AlertUrgency;
	event: string; // e.g., "Winter Storm Warning", "Tornado Watch"
	sender: string;
	senderName: string;
	headline: string | null;
	description: string;
	instruction: string | null;
	response: 'Shelter' | 'Evacuate' | 'Prepare' | 'Execute' | 'Avoid' | 'Monitor' | 'Assess' | 'AllClear' | 'None';
	parameters: Record<string, string[]>;
	// Geometry for map display (GeoJSON)
	geometry: GeoJSON.Geometry | null;
}

/**
 * NWS Forecast Period
 */
export interface ForecastPeriod {
	number: number;
	name: string; // e.g., "Tonight", "Wednesday"
	startTime: string;
	endTime: string;
	isDaytime: boolean;
	temperature: number;
	temperatureUnit: 'F' | 'C';
	temperatureTrend: 'rising' | 'falling' | null;
	probabilityOfPrecipitation: {
		unitCode: string;
		value: number | null;
	};
	dewpoint: {
		unitCode: string;
		value: number | null;
	};
	relativeHumidity: {
		unitCode: string;
		value: number | null;
	};
	windSpeed: string;
	windDirection: string;
	icon: string;
	shortForecast: string;
	detailedForecast: string;
}

/**
 * Monitored weather zone (state, county, or custom point)
 */
export interface WeatherZone {
	id: string;
	name: string;
	type: 'state' | 'county' | 'zone' | 'point';
	// For state/county/zone
	code?: string; // e.g., "KS" for state, "KSC091" for county
	// For custom points
	lat?: number;
	lon?: number;
	// Metadata
	enabled: boolean;
	createdAt: number;
}

/**
 * Weather forecast highlight for panel display
 */
export interface ForecastHighlight {
	location: string;
	zoneId: string;
	summary: string;
	temperature: {
		high: number | null;
		low: number | null;
	};
	precipitation: {
		chance: number | null;
		type: string | null; // "snow", "rain", "ice"
		accumulation: string | null; // "6-10 inches"
	};
	wind: {
		speed: string;
		gusts: string | null;
	};
	timing: string; // "Tonight through Thursday"
	severity: 'extreme' | 'high' | 'moderate' | 'low';
}

/**
 * Weather briefing report
 */
export interface WeatherBriefing {
	id: string;
	generatedAt: number;
	zones: string[]; // Zone IDs included
	alerts: WeatherAlert[];
	forecasts: ForecastHighlight[];
	format: 'text' | 'markdown' | 'json';
	content: string;
}

/**
 * Weather command center state
 */
export interface WeatherState {
	// Active alerts
	alerts: WeatherAlert[];
	alertsLoading: boolean;
	alertsError: string | null;
	alertsLastUpdated: number | null;

	// Monitored zones
	zones: WeatherZone[];

	// Forecast highlights for monitored zones
	forecasts: ForecastHighlight[];
	forecastsLoading: boolean;
	forecastsError: string | null;

	// Briefing history
	briefings: WeatherBriefing[];

	// UI state
	selectedAlertId: string | null;
	commandModalOpen: boolean;

	initialized: boolean;
}
```

**Step 2: Export weather types from index**

Add to `src/lib/types/index.ts`:

```typescript
// Weather command center types
export type {
	AlertSeverity,
	AlertUrgency,
	AlertCertainty,
	AlertCategory,
	WeatherAlert,
	ForecastPeriod,
	WeatherZone,
	ForecastHighlight,
	WeatherBriefing,
	WeatherState
} from './weather';
```

**Step 3: Create weather configuration**

```typescript
// src/lib/config/weather.ts

/**
 * Weather Command Center configuration
 */

/**
 * US State codes for zone selection
 */
export const US_STATES: Record<string, string> = {
	AL: 'Alabama',
	AK: 'Alaska',
	AZ: 'Arizona',
	AR: 'Arkansas',
	CA: 'California',
	CO: 'Colorado',
	CT: 'Connecticut',
	DE: 'Delaware',
	FL: 'Florida',
	GA: 'Georgia',
	HI: 'Hawaii',
	ID: 'Idaho',
	IL: 'Illinois',
	IN: 'Indiana',
	IA: 'Iowa',
	KS: 'Kansas',
	KY: 'Kentucky',
	LA: 'Louisiana',
	ME: 'Maine',
	MD: 'Maryland',
	MA: 'Massachusetts',
	MI: 'Michigan',
	MN: 'Minnesota',
	MS: 'Mississippi',
	MO: 'Missouri',
	MT: 'Montana',
	NE: 'Nebraska',
	NV: 'Nevada',
	NH: 'New Hampshire',
	NJ: 'New Jersey',
	NM: 'New Mexico',
	NY: 'New York',
	NC: 'North Carolina',
	ND: 'North Dakota',
	OH: 'Ohio',
	OK: 'Oklahoma',
	OR: 'Oregon',
	PA: 'Pennsylvania',
	RI: 'Rhode Island',
	SC: 'South Carolina',
	SD: 'South Dakota',
	TN: 'Tennessee',
	TX: 'Texas',
	UT: 'Utah',
	VT: 'Vermont',
	VA: 'Virginia',
	WA: 'Washington',
	WV: 'West Virginia',
	WI: 'Wisconsin',
	WY: 'Wyoming',
	DC: 'District of Columbia',
	PR: 'Puerto Rico',
	VI: 'Virgin Islands',
	GU: 'Guam',
	AS: 'American Samoa',
	MP: 'Northern Mariana Islands'
};

/**
 * Predefined regional watch zones
 */
export const PREDEFINED_REGIONS: Record<string, { name: string; states: string[] }> = {
	central_us: {
		name: 'Central US',
		states: ['KS', 'NE', 'OK', 'TX', 'MO', 'IA', 'AR', 'LA']
	},
	midwest: {
		name: 'Midwest',
		states: ['IL', 'IN', 'MI', 'OH', 'WI', 'MN']
	},
	northeast: {
		name: 'Northeast',
		states: ['NY', 'PA', 'NJ', 'CT', 'MA', 'RI', 'VT', 'NH', 'ME']
	},
	southeast: {
		name: 'Southeast',
		states: ['FL', 'GA', 'SC', 'NC', 'VA', 'TN', 'AL', 'MS']
	},
	west_coast: {
		name: 'West Coast',
		states: ['CA', 'OR', 'WA']
	},
	mountain: {
		name: 'Mountain',
		states: ['CO', 'UT', 'WY', 'MT', 'ID', 'NV', 'AZ', 'NM']
	}
};

/**
 * Alert severity colors (matching Aegis design system)
 */
export const ALERT_SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
	Extreme: { bg: 'rgb(127 29 29 / 0.5)', border: 'rgb(153 27 27 / 0.5)', text: 'rgb(248 113 113)' },
	Severe: { bg: 'rgb(124 45 18 / 0.5)', border: 'rgb(154 52 18 / 0.5)', text: 'rgb(251 146 60)' },
	Moderate: { bg: 'rgb(113 63 18 / 0.5)', border: 'rgb(133 77 14 / 0.5)', text: 'rgb(251 191 36)' },
	Minor: { bg: 'rgb(6 78 59 / 0.5)', border: 'rgb(4 120 87 / 0.5)', text: 'rgb(52 211 153)' },
	Unknown: { bg: 'rgb(30 41 59 / 0.5)', border: 'rgb(51 65 85 / 0.5)', text: 'rgb(148 163 184)' }
};

/**
 * Winter weather event types (for filtering/highlighting)
 */
export const WINTER_WEATHER_EVENTS = [
	'Blizzard Warning',
	'Blizzard Watch',
	'Winter Storm Warning',
	'Winter Storm Watch',
	'Winter Weather Advisory',
	'Ice Storm Warning',
	'Freeze Warning',
	'Freeze Watch',
	'Frost Advisory',
	'Hard Freeze Warning',
	'Hard Freeze Watch',
	'Wind Chill Warning',
	'Wind Chill Watch',
	'Wind Chill Advisory',
	'Heavy Snow Warning',
	'Lake Effect Snow Warning',
	'Lake Effect Snow Watch',
	'Lake Effect Snow Advisory'
];

/**
 * Severe weather event types
 */
export const SEVERE_WEATHER_EVENTS = [
	'Tornado Warning',
	'Tornado Watch',
	'Severe Thunderstorm Warning',
	'Severe Thunderstorm Watch',
	'Flash Flood Warning',
	'Flash Flood Watch',
	'Flood Warning',
	'Flood Watch',
	'Hurricane Warning',
	'Hurricane Watch',
	'Tropical Storm Warning',
	'Tropical Storm Watch',
	'Storm Surge Warning',
	'Storm Surge Watch',
	'Extreme Wind Warning',
	'High Wind Warning',
	'High Wind Watch'
];

/**
 * NWS API configuration
 */
export const NWS_API = {
	baseUrl: 'https://api.weather.gov',
	endpoints: {
		alerts: '/alerts',
		activeAlerts: '/alerts/active',
		alertsByArea: '/alerts/active/area',
		alertsByZone: '/alerts/active/zone',
		points: '/points',
		zones: '/zones',
		zonesForecast: '/zones/forecast'
	},
	// User-Agent required by NWS API
	userAgent: '(AegisSituationMonitor, contact@example.com)',
	// Cache TTL in milliseconds
	cacheTtl: 5 * 60 * 1000 // 5 minutes
};

/**
 * Map layer colors for alert polygons
 */
export const ALERT_MAP_COLORS: Record<string, string> = {
	// Extreme
	'Tornado Warning': '#ff0000',
	'Extreme Wind Warning': '#ff0000',
	// Severe
	'Severe Thunderstorm Warning': '#ff8c00',
	'Flash Flood Warning': '#ff4444',
	'Hurricane Warning': '#ff00ff',
	// Winter
	'Blizzard Warning': '#ff69b4',
	'Winter Storm Warning': '#ff69b4',
	'Ice Storm Warning': '#8b008b',
	// Watches (lighter)
	'Tornado Watch': '#ffff00',
	'Severe Thunderstorm Watch': '#ffcc00',
	'Winter Storm Watch': '#4169e1',
	'Blizzard Watch': '#4169e1',
	// Default
	default: '#06b6d4'
};
```

**Step 4: Export weather config from index**

Add to `src/lib/config/index.ts`:

```typescript
// Weather command center configuration
export {
	US_STATES,
	PREDEFINED_REGIONS,
	ALERT_SEVERITY_COLORS,
	WINTER_WEATHER_EVENTS,
	SEVERE_WEATHER_EVENTS,
	NWS_API,
	ALERT_MAP_COLORS
} from './weather';
```

**Step 5: Commit**

```bash
git add src/lib/types/weather.ts src/lib/types/index.ts src/lib/config/weather.ts src/lib/config/index.ts
git commit -m "feat(weather): add types and configuration for weather command center

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Weather API Integration

**Files:**
- Create: `src/lib/api/weather.ts`
- Modify: `src/lib/api/index.ts`

**Step 1: Create NWS API integration**

```typescript
// src/lib/api/weather.ts

/**
 * National Weather Service API integration
 * Free API, no key required
 * Docs: https://www.weather.gov/documentation/services-web-api
 */

import { NWS_API } from '$lib/config/weather';
import type { WeatherAlert, ForecastPeriod, ForecastHighlight } from '$lib/types';

/**
 * Custom fetch with NWS required headers
 */
async function nwsFetch(endpoint: string): Promise<Response> {
	const url = `${NWS_API.baseUrl}${endpoint}`;

	const response = await fetch(url, {
		headers: {
			'User-Agent': NWS_API.userAgent,
			'Accept': 'application/geo+json'
		}
	});

	if (!response.ok) {
		throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
	}

	return response;
}

/**
 * Fetch active weather alerts for a US state
 */
export async function fetchAlertsByState(stateCode: string): Promise<WeatherAlert[]> {
	try {
		const response = await nwsFetch(`${NWS_API.endpoints.alertsByArea}/${stateCode}`);
		const data = await response.json();

		return parseAlertFeatures(data.features || []);
	} catch (error) {
		console.warn(`Failed to fetch alerts for state ${stateCode}:`, error);
		return [];
	}
}

/**
 * Fetch active weather alerts for a NWS zone
 */
export async function fetchAlertsByZone(zoneCode: string): Promise<WeatherAlert[]> {
	try {
		const response = await nwsFetch(`${NWS_API.endpoints.alertsByZone}/${zoneCode}`);
		const data = await response.json();

		return parseAlertFeatures(data.features || []);
	} catch (error) {
		console.warn(`Failed to fetch alerts for zone ${zoneCode}:`, error);
		return [];
	}
}

/**
 * Fetch all active alerts (nationwide)
 */
export async function fetchAllActiveAlerts(): Promise<WeatherAlert[]> {
	try {
		const response = await nwsFetch(NWS_API.endpoints.activeAlerts);
		const data = await response.json();

		return parseAlertFeatures(data.features || []);
	} catch (error) {
		console.warn('Failed to fetch active alerts:', error);
		return [];
	}
}

/**
 * Fetch alerts for multiple states
 */
export async function fetchAlertsForStates(stateCodes: string[]): Promise<WeatherAlert[]> {
	const alertPromises = stateCodes.map(code => fetchAlertsByState(code));
	const results = await Promise.all(alertPromises);

	// Flatten and deduplicate by alert ID
	const alertMap = new Map<string, WeatherAlert>();
	for (const alerts of results) {
		for (const alert of alerts) {
			alertMap.set(alert.id, alert);
		}
	}

	return Array.from(alertMap.values());
}

/**
 * Get grid point data for a coordinate (needed for forecasts)
 */
export async function fetchGridPoint(lat: number, lon: number): Promise<{
	gridId: string;
	gridX: number;
	gridY: number;
	forecastUrl: string;
	forecastHourlyUrl: string;
} | null> {
	try {
		const response = await nwsFetch(`${NWS_API.endpoints.points}/${lat.toFixed(4)},${lon.toFixed(4)}`);
		const data = await response.json();

		return {
			gridId: data.properties.gridId,
			gridX: data.properties.gridX,
			gridY: data.properties.gridY,
			forecastUrl: data.properties.forecast,
			forecastHourlyUrl: data.properties.forecastHourly
		};
	} catch (error) {
		console.warn(`Failed to fetch grid point for ${lat},${lon}:`, error);
		return null;
	}
}

/**
 * Fetch forecast for a coordinate
 */
export async function fetchForecast(lat: number, lon: number): Promise<ForecastPeriod[]> {
	try {
		const gridPoint = await fetchGridPoint(lat, lon);
		if (!gridPoint) return [];

		const response = await fetch(gridPoint.forecastUrl, {
			headers: {
				'User-Agent': NWS_API.userAgent,
				'Accept': 'application/geo+json'
			}
		});

		if (!response.ok) return [];

		const data = await response.json();
		return data.properties.periods || [];
	} catch (error) {
		console.warn(`Failed to fetch forecast for ${lat},${lon}:`, error);
		return [];
	}
}

/**
 * Fetch forecast zone info
 */
export async function fetchZoneInfo(zoneCode: string): Promise<{
	name: string;
	state: string;
	lat: number;
	lon: number;
} | null> {
	try {
		const response = await nwsFetch(`${NWS_API.endpoints.zones}/forecast/${zoneCode}`);
		const data = await response.json();

		// Get centroid from geometry
		let lat = 0, lon = 0;
		if (data.geometry?.type === 'Polygon' && data.geometry.coordinates?.[0]) {
			const coords = data.geometry.coordinates[0];
			lat = coords.reduce((sum: number, c: number[]) => sum + c[1], 0) / coords.length;
			lon = coords.reduce((sum: number, c: number[]) => sum + c[0], 0) / coords.length;
		}

		return {
			name: data.properties.name,
			state: data.properties.state,
			lat,
			lon
		};
	} catch (error) {
		console.warn(`Failed to fetch zone info for ${zoneCode}:`, error);
		return null;
	}
}

/**
 * Parse NWS GeoJSON alert features into WeatherAlert objects
 */
function parseAlertFeatures(features: any[]): WeatherAlert[] {
	return features.map((feature) => {
		const props = feature.properties;

		return {
			id: props.id || props['@id'],
			areaDesc: props.areaDesc,
			geocode: props.geocode || { SAME: [], UGC: [] },
			affectedZones: props.affectedZones || [],
			references: props.references || [],
			sent: props.sent,
			effective: props.effective,
			onset: props.onset,
			expires: props.expires,
			ends: props.ends,
			status: props.status,
			messageType: props.messageType,
			category: props.category,
			severity: props.severity,
			certainty: props.certainty,
			urgency: props.urgency,
			event: props.event,
			sender: props.sender,
			senderName: props.senderName,
			headline: props.headline,
			description: props.description,
			instruction: props.instruction,
			response: props.response,
			parameters: props.parameters || {},
			geometry: feature.geometry
		};
	});
}

/**
 * Extract forecast highlights from forecast periods
 */
export function extractForecastHighlights(
	location: string,
	zoneId: string,
	periods: ForecastPeriod[]
): ForecastHighlight | null {
	if (!periods.length) return null;

	// Find temperature extremes
	let high: number | null = null;
	let low: number | null = null;

	for (const period of periods.slice(0, 4)) {
		if (period.isDaytime && (high === null || period.temperature > high)) {
			high = period.temperature;
		}
		if (!period.isDaytime && (low === null || period.temperature < low)) {
			low = period.temperature;
		}
	}

	// Extract precipitation info
	const precipChance = periods[0].probabilityOfPrecipitation?.value;
	let precipType: string | null = null;
	let accumulation: string | null = null;

	const forecast = periods[0].detailedForecast.toLowerCase();
	if (forecast.includes('snow')) precipType = 'snow';
	else if (forecast.includes('ice') || forecast.includes('sleet') || forecast.includes('freezing rain')) precipType = 'ice';
	else if (forecast.includes('rain')) precipType = 'rain';

	// Try to extract accumulation
	const accumMatch = forecast.match(/(\d+(?:\s*(?:to|-)\s*\d+)?)\s*inch(?:es)?/);
	if (accumMatch) accumulation = accumMatch[1] + ' inches';

	// Determine severity based on content
	let severity: ForecastHighlight['severity'] = 'low';
	if (forecast.includes('dangerous') || forecast.includes('life-threatening')) severity = 'extreme';
	else if (forecast.includes('significant') || forecast.includes('heavy')) severity = 'high';
	else if (precipChance && precipChance > 50) severity = 'moderate';

	// Wind info
	const gustMatch = forecast.match(/gusts?\s+(?:up\s+to\s+)?(\d+)\s*mph/i);

	return {
		location,
		zoneId,
		summary: periods[0].shortForecast,
		temperature: { high, low },
		precipitation: {
			chance: precipChance,
			type: precipType,
			accumulation
		},
		wind: {
			speed: periods[0].windSpeed,
			gusts: gustMatch ? `${gustMatch[1]} mph` : null
		},
		timing: `${periods[0].name} through ${periods[Math.min(3, periods.length - 1)].name}`,
		severity
	};
}

/**
 * Generate a text briefing from alerts and forecasts
 */
export function generateBriefingText(
	alerts: WeatherAlert[],
	forecasts: ForecastHighlight[]
): string {
	const lines: string[] = [];
	const timestamp = new Date().toLocaleString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short'
	});

	lines.push(`WEATHER SITUATION BRIEFING`);
	lines.push(`Generated: ${timestamp}`);
	lines.push('');

	// Active Alerts Section
	lines.push('=== ACTIVE ALERTS ===');
	if (alerts.length === 0) {
		lines.push('No active alerts for monitored zones.');
	} else {
		const byEvent = new Map<string, WeatherAlert[]>();
		for (const alert of alerts) {
			const existing = byEvent.get(alert.event) || [];
			existing.push(alert);
			byEvent.set(alert.event, existing);
		}

		for (const [event, eventAlerts] of byEvent) {
			lines.push('');
			lines.push(`** ${event} (${eventAlerts.length}) **`);
			for (const alert of eventAlerts) {
				lines.push(`- ${alert.areaDesc}`);
				if (alert.headline) lines.push(`  ${alert.headline}`);
			}
		}
	}

	lines.push('');
	lines.push('=== FORECAST HIGHLIGHTS ===');
	if (forecasts.length === 0) {
		lines.push('No forecast data available.');
	} else {
		for (const fc of forecasts) {
			lines.push('');
			lines.push(`** ${fc.location} **`);
			lines.push(`${fc.summary}`);
			if (fc.temperature.high !== null || fc.temperature.low !== null) {
				const temps = [];
				if (fc.temperature.high !== null) temps.push(`High: ${fc.temperature.high}F`);
				if (fc.temperature.low !== null) temps.push(`Low: ${fc.temperature.low}F`);
				lines.push(temps.join(' / '));
			}
			if (fc.precipitation.chance) {
				let precip = `Precipitation: ${fc.precipitation.chance}%`;
				if (fc.precipitation.type) precip += ` ${fc.precipitation.type}`;
				if (fc.precipitation.accumulation) precip += ` (${fc.precipitation.accumulation})`;
				lines.push(precip);
			}
			lines.push(`Wind: ${fc.wind.speed}${fc.wind.gusts ? `, gusts to ${fc.wind.gusts}` : ''}`);
			lines.push(`Timing: ${fc.timing}`);
		}
	}

	lines.push('');
	lines.push('---');
	lines.push('Source: National Weather Service (api.weather.gov)');

	return lines.join('\n');
}

/**
 * Generate a markdown briefing from alerts and forecasts
 */
export function generateBriefingMarkdown(
	alerts: WeatherAlert[],
	forecasts: ForecastHighlight[]
): string {
	const lines: string[] = [];
	const timestamp = new Date().toISOString();

	lines.push('# Weather Situation Briefing');
	lines.push('');
	lines.push(`*Generated: ${new Date(timestamp).toLocaleString()}*`);
	lines.push('');

	// Active Alerts Section
	lines.push('## Active Alerts');
	if (alerts.length === 0) {
		lines.push('');
		lines.push('No active alerts for monitored zones.');
	} else {
		const byEvent = new Map<string, WeatherAlert[]>();
		for (const alert of alerts) {
			const existing = byEvent.get(alert.event) || [];
			existing.push(alert);
			byEvent.set(alert.event, existing);
		}

		for (const [event, eventAlerts] of byEvent) {
			lines.push('');
			lines.push(`### ${event} (${eventAlerts.length})`);
			lines.push('');
			for (const alert of eventAlerts) {
				lines.push(`- **${alert.areaDesc}**`);
				if (alert.headline) lines.push(`  - ${alert.headline}`);
				lines.push(`  - Severity: ${alert.severity} | Urgency: ${alert.urgency}`);
				lines.push(`  - Expires: ${new Date(alert.expires).toLocaleString()}`);
			}
		}
	}

	lines.push('');
	lines.push('## Forecast Highlights');
	if (forecasts.length === 0) {
		lines.push('');
		lines.push('No forecast data available.');
	} else {
		for (const fc of forecasts) {
			lines.push('');
			lines.push(`### ${fc.location}`);
			lines.push('');
			lines.push(`**${fc.summary}**`);
			lines.push('');
			lines.push('| Metric | Value |');
			lines.push('|--------|-------|');
			if (fc.temperature.high !== null) lines.push(`| High | ${fc.temperature.high}°F |`);
			if (fc.temperature.low !== null) lines.push(`| Low | ${fc.temperature.low}°F |`);
			if (fc.precipitation.chance) {
				let precip = `${fc.precipitation.chance}%`;
				if (fc.precipitation.type) precip += ` ${fc.precipitation.type}`;
				lines.push(`| Precipitation | ${precip} |`);
			}
			if (fc.precipitation.accumulation) lines.push(`| Accumulation | ${fc.precipitation.accumulation} |`);
			lines.push(`| Wind | ${fc.wind.speed} |`);
			if (fc.wind.gusts) lines.push(`| Gusts | ${fc.wind.gusts} |`);
			lines.push(`| Timing | ${fc.timing} |`);
		}
	}

	lines.push('');
	lines.push('---');
	lines.push('');
	lines.push('*Source: [National Weather Service](https://api.weather.gov)*');

	return lines.join('\n');
}
```

**Step 2: Export weather API from index**

Add to `src/lib/api/index.ts`:

```typescript
// Weather API
export {
	fetchAlertsByState,
	fetchAlertsByZone,
	fetchAllActiveAlerts,
	fetchAlertsForStates,
	fetchGridPoint,
	fetchForecast,
	fetchZoneInfo,
	extractForecastHighlights,
	generateBriefingText,
	generateBriefingMarkdown
} from './weather';
```

**Step 3: Commit**

```bash
git add src/lib/api/weather.ts src/lib/api/index.ts
git commit -m "feat(weather): add NWS API integration with alerts and forecasts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Weather Store

**Files:**
- Create: `src/lib/stores/weather.ts`
- Modify: `src/lib/stores/index.ts`

**Step 1: Create weather store**

```typescript
// src/lib/stores/weather.ts

/**
 * Weather store - alerts, zones, forecasts, and briefings
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { WeatherAlert, WeatherZone, ForecastHighlight, WeatherBriefing, WeatherState } from '$lib/types';
import {
	fetchAlertsForStates,
	fetchForecast,
	extractForecastHighlights,
	generateBriefingText,
	generateBriefingMarkdown
} from '$lib/api/weather';
import { PREDEFINED_REGIONS } from '$lib/config/weather';

const STORAGE_KEY = 'weatherZones';
const BRIEFING_STORAGE_KEY = 'weatherBriefings';
const MAX_BRIEFINGS = 10;

/**
 * Load zones from localStorage
 */
function loadZones(): WeatherZone[] {
	if (!browser) return [];

	try {
		const data = localStorage.getItem(STORAGE_KEY);
		return data ? JSON.parse(data) : [];
	} catch (e) {
		console.warn('Failed to load weather zones from localStorage:', e);
		return [];
	}
}

/**
 * Save zones to localStorage
 */
function saveZones(zones: WeatherZone[]): void {
	if (!browser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
	} catch (e) {
		console.warn('Failed to save weather zones to localStorage:', e);
	}
}

/**
 * Load briefings from localStorage
 */
function loadBriefings(): WeatherBriefing[] {
	if (!browser) return [];

	try {
		const data = localStorage.getItem(BRIEFING_STORAGE_KEY);
		return data ? JSON.parse(data) : [];
	} catch (e) {
		console.warn('Failed to load briefings from localStorage:', e);
		return [];
	}
}

/**
 * Save briefings to localStorage
 */
function saveBriefings(briefings: WeatherBriefing[]): void {
	if (!browser) return;

	try {
		localStorage.setItem(BRIEFING_STORAGE_KEY, JSON.stringify(briefings.slice(-MAX_BRIEFINGS)));
	} catch (e) {
		console.warn('Failed to save briefings to localStorage:', e);
	}
}

/**
 * Generate unique ID
 */
function generateId(): string {
	return `wz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create the weather store
 */
function createWeatherStore() {
	const initialState: WeatherState = {
		alerts: [],
		alertsLoading: false,
		alertsError: null,
		alertsLastUpdated: null,
		zones: loadZones(),
		forecasts: [],
		forecastsLoading: false,
		forecastsError: null,
		briefings: loadBriefings(),
		selectedAlertId: null,
		commandModalOpen: false,
		initialized: false
	};

	const { subscribe, set, update } = writable<WeatherState>(initialState);

	return {
		subscribe,

		/**
		 * Initialize store
		 */
		init() {
			update((state) => ({ ...state, initialized: true }));
		},

		/**
		 * Add a state zone
		 */
		addStateZone(stateCode: string, stateName: string): WeatherZone | null {
			const state = get({ subscribe });

			// Check if already exists
			if (state.zones.some(z => z.type === 'state' && z.code === stateCode)) {
				return null;
			}

			const zone: WeatherZone = {
				id: generateId(),
				name: stateName,
				type: 'state',
				code: stateCode,
				enabled: true,
				createdAt: Date.now()
			};

			update((s) => {
				const newZones = [...s.zones, zone];
				saveZones(newZones);
				return { ...s, zones: newZones };
			});

			return zone;
		},

		/**
		 * Add a custom point zone
		 */
		addPointZone(name: string, lat: number, lon: number): WeatherZone | null {
			const zone: WeatherZone = {
				id: generateId(),
				name,
				type: 'point',
				lat,
				lon,
				enabled: true,
				createdAt: Date.now()
			};

			update((s) => {
				const newZones = [...s.zones, zone];
				saveZones(newZones);
				return { ...s, zones: newZones };
			});

			return zone;
		},

		/**
		 * Add a predefined region (multiple states)
		 */
		addRegion(regionKey: string): WeatherZone[] {
			const region = PREDEFINED_REGIONS[regionKey];
			if (!region) return [];

			const addedZones: WeatherZone[] = [];
			const state = get({ subscribe });

			for (const stateCode of region.states) {
				// Skip if already exists
				if (state.zones.some(z => z.type === 'state' && z.code === stateCode)) {
					continue;
				}

				const zone: WeatherZone = {
					id: generateId(),
					name: stateCode,
					type: 'state',
					code: stateCode,
					enabled: true,
					createdAt: Date.now()
				};

				addedZones.push(zone);
			}

			if (addedZones.length > 0) {
				update((s) => {
					const newZones = [...s.zones, ...addedZones];
					saveZones(newZones);
					return { ...s, zones: newZones };
				});
			}

			return addedZones;
		},

		/**
		 * Remove a zone
		 */
		removeZone(id: string): boolean {
			let found = false;

			update((state) => {
				const index = state.zones.findIndex(z => z.id === id);
				if (index === -1) return state;

				found = true;
				const newZones = state.zones.filter(z => z.id !== id);
				saveZones(newZones);
				return { ...state, zones: newZones };
			});

			return found;
		},

		/**
		 * Toggle zone enabled state
		 */
		toggleZone(id: string): void {
			update((state) => {
				const index = state.zones.findIndex(z => z.id === id);
				if (index === -1) return state;

				const newZones = [...state.zones];
				newZones[index] = { ...newZones[index], enabled: !newZones[index].enabled };
				saveZones(newZones);
				return { ...state, zones: newZones };
			});
		},

		/**
		 * Fetch alerts for all enabled zones
		 */
		async fetchAlerts(): Promise<WeatherAlert[]> {
			const state = get({ subscribe });
			const enabledZones = state.zones.filter(z => z.enabled);

			// Get unique state codes from zones
			const stateCodes = new Set<string>();
			for (const zone of enabledZones) {
				if (zone.type === 'state' && zone.code) {
					stateCodes.add(zone.code);
				}
			}

			if (stateCodes.size === 0) {
				update((s) => ({ ...s, alerts: [], alertsLastUpdated: Date.now() }));
				return [];
			}

			update((s) => ({ ...s, alertsLoading: true, alertsError: null }));

			try {
				const alerts = await fetchAlertsForStates(Array.from(stateCodes));

				// Sort by severity
				const severityOrder = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
				alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

				update((s) => ({
					...s,
					alerts,
					alertsLoading: false,
					alertsLastUpdated: Date.now()
				}));

				return alerts;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to fetch alerts';
				update((s) => ({
					...s,
					alertsLoading: false,
					alertsError: errorMessage
				}));
				return [];
			}
		},

		/**
		 * Fetch forecasts for all enabled point zones
		 */
		async fetchForecasts(): Promise<ForecastHighlight[]> {
			const state = get({ subscribe });
			const pointZones = state.zones.filter(z => z.enabled && z.type === 'point' && z.lat && z.lon);

			if (pointZones.length === 0) {
				update((s) => ({ ...s, forecasts: [] }));
				return [];
			}

			update((s) => ({ ...s, forecastsLoading: true, forecastsError: null }));

			try {
				const forecasts: ForecastHighlight[] = [];

				for (const zone of pointZones) {
					const periods = await fetchForecast(zone.lat!, zone.lon!);
					const highlight = extractForecastHighlights(zone.name, zone.id, periods);
					if (highlight) {
						forecasts.push(highlight);
					}
				}

				update((s) => ({
					...s,
					forecasts,
					forecastsLoading: false
				}));

				return forecasts;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to fetch forecasts';
				update((s) => ({
					...s,
					forecastsLoading: false,
					forecastsError: errorMessage
				}));
				return [];
			}
		},

		/**
		 * Refresh all weather data
		 */
		async refresh(): Promise<void> {
			await Promise.all([
				this.fetchAlerts(),
				this.fetchForecasts()
			]);
		},

		/**
		 * Generate a briefing
		 */
		generateBriefing(format: 'text' | 'markdown' | 'json'): WeatherBriefing {
			const state = get({ subscribe });

			let content: string;
			if (format === 'json') {
				content = JSON.stringify({
					timestamp: new Date().toISOString(),
					alerts: state.alerts,
					forecasts: state.forecasts
				}, null, 2);
			} else if (format === 'markdown') {
				content = generateBriefingMarkdown(state.alerts, state.forecasts);
			} else {
				content = generateBriefingText(state.alerts, state.forecasts);
			}

			const briefing: WeatherBriefing = {
				id: generateId(),
				generatedAt: Date.now(),
				zones: state.zones.filter(z => z.enabled).map(z => z.id),
				alerts: state.alerts,
				forecasts: state.forecasts,
				format,
				content
			};

			update((s) => {
				const newBriefings = [...s.briefings, briefing].slice(-MAX_BRIEFINGS);
				saveBriefings(newBriefings);
				return { ...s, briefings: newBriefings };
			});

			return briefing;
		},

		/**
		 * Select an alert (for map navigation)
		 */
		selectAlert(alertId: string | null): void {
			update((s) => ({ ...s, selectedAlertId: alertId }));
		},

		/**
		 * Open command modal
		 */
		openCommandModal(): void {
			update((s) => ({ ...s, commandModalOpen: true }));
		},

		/**
		 * Close command modal
		 */
		closeCommandModal(): void {
			update((s) => ({ ...s, commandModalOpen: false }));
		},

		/**
		 * Get alert by ID
		 */
		getAlert(id: string): WeatherAlert | undefined {
			return get({ subscribe }).alerts.find(a => a.id === id);
		},

		/**
		 * Reset all weather data
		 */
		reset(): void {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
				localStorage.removeItem(BRIEFING_STORAGE_KEY);
			}
			set({
				alerts: [],
				alertsLoading: false,
				alertsError: null,
				alertsLastUpdated: null,
				zones: [],
				forecasts: [],
				forecastsLoading: false,
				forecastsError: null,
				briefings: [],
				selectedAlertId: null,
				commandModalOpen: false,
				initialized: true
			});
		}
	};
}

// Export singleton store
export const weather = createWeatherStore();

// Derived stores
export const activeAlerts = derived(weather, ($weather) => $weather.alerts);

export const alertCount = derived(weather, ($weather) => $weather.alerts.length);

export const severeAlertCount = derived(weather, ($weather) =>
	$weather.alerts.filter(a => a.severity === 'Extreme' || a.severity === 'Severe').length
);

export const enabledZones = derived(weather, ($weather) =>
	$weather.zones.filter(z => z.enabled)
);

export const zoneCount = derived(weather, ($weather) => $weather.zones.length);

export const weatherLoading = derived(weather, ($weather) =>
	$weather.alertsLoading || $weather.forecastsLoading
);

export const selectedAlert = derived(weather, ($weather) =>
	$weather.selectedAlertId ? $weather.alerts.find(a => a.id === $weather.selectedAlertId) : null
);
```

**Step 2: Export weather store from index**

Add to `src/lib/stores/index.ts`:

```typescript
// Weather store
export {
	weather,
	activeAlerts,
	alertCount,
	severeAlertCount,
	enabledZones,
	zoneCount,
	weatherLoading,
	selectedAlert
} from './weather';
```

**Step 3: Commit**

```bash
git add src/lib/stores/weather.ts src/lib/stores/index.ts
git commit -m "feat(weather): add weather store with zone management and briefing generation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Weather Panel Component

**Files:**
- Create: `src/lib/components/panels/WeatherPanel.svelte`
- Modify: `src/lib/config/panels.ts`

**Step 1: Create WeatherPanel component**

```svelte
<!-- src/lib/components/panels/WeatherPanel.svelte -->
<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { weather, alertCount, severeAlertCount, weatherLoading } from '$lib/stores';
	import { ALERT_SEVERITY_COLORS, WINTER_WEATHER_EVENTS } from '$lib/config/weather';
	import type { WeatherAlert, ForecastHighlight } from '$lib/types';

	interface Props {
		onAlertClick?: (alert: WeatherAlert) => void;
		onOpenCommandCenter?: () => void;
	}

	let { onAlertClick, onOpenCommandCenter }: Props = $props();

	// Local derived state
	const alerts = $derived($weather.alerts);
	const forecasts = $derived($weather.forecasts);
	const loading = $derived($weatherLoading);
	const error = $derived($weather.alertsError);
	const count = $derived($alertCount);
	const severeCount = $derived($severeAlertCount);

	function handleAlertClick(alert: WeatherAlert) {
		weather.selectAlert(alert.id);
		onAlertClick?.(alert);
	}

	function handleOpenCommandCenter() {
		weather.openCommandModal();
		onOpenCommandCenter?.();
	}

	function getSeverityColors(severity: string) {
		return ALERT_SEVERITY_COLORS[severity] || ALERT_SEVERITY_COLORS.Unknown;
	}

	function isWinterWeather(event: string): boolean {
		return WINTER_WEATHER_EVENTS.includes(event);
	}

	function formatTimeRemaining(expires: string): string {
		const now = Date.now();
		const expireTime = new Date(expires).getTime();
		const diff = expireTime - now;

		if (diff < 0) return 'Expired';

		const hours = Math.floor(diff / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

		if (hours > 24) {
			const days = Math.floor(hours / 24);
			return `${days}d ${hours % 24}h`;
		}
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	}

	function getEventIcon(event: string): string {
		if (event.includes('Tornado')) return '🌪️';
		if (event.includes('Blizzard') || event.includes('Snow')) return '❄️';
		if (event.includes('Ice') || event.includes('Freeze')) return '🧊';
		if (event.includes('Flood')) return '🌊';
		if (event.includes('Wind')) return '💨';
		if (event.includes('Thunder')) return '⛈️';
		if (event.includes('Hurricane') || event.includes('Tropical')) return '🌀';
		return '⚠️';
	}
</script>

<Panel id="weather" title="Weather Alerts" count={count} {loading} {error}>
	{#snippet header()}
		<button class="command-center-btn" onclick={handleOpenCommandCenter} title="Open Weather Command Center">
			<span class="btn-icon">📡</span>
		</button>
	{/snippet}

	{#if alerts.length === 0 && forecasts.length === 0 && !loading && !error}
		<div class="weather-empty">
			<p>No active alerts</p>
			<button class="setup-btn" onclick={handleOpenCommandCenter}>
				Configure Watch Zones
			</button>
		</div>
	{:else}
		<!-- Severe Alert Summary -->
		{#if severeCount > 0}
			<div class="severe-banner">
				<span class="severe-icon">⚠️</span>
				<span class="severe-text">{severeCount} severe/extreme alert{severeCount > 1 ? 's' : ''} active</span>
			</div>
		{/if}

		<!-- Alert List -->
		<div class="alert-list">
			{#each alerts.slice(0, 8) as alert (alert.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="alert-item"
					class:clickable={!!onAlertClick}
					onclick={() => handleAlertClick(alert)}
					style="--alert-bg: {getSeverityColors(alert.severity).bg}; --alert-border: {getSeverityColors(alert.severity).border}; --alert-text: {getSeverityColors(alert.severity).text};"
				>
					<div class="alert-header">
						<span class="alert-icon">{getEventIcon(alert.event)}</span>
						<span class="alert-event">{alert.event}</span>
						<span class="alert-expires">{formatTimeRemaining(alert.expires)}</span>
					</div>
					<div class="alert-area">{alert.areaDesc}</div>
					{#if alert.headline}
						<div class="alert-headline">{alert.headline}</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Forecast Highlights -->
		{#if forecasts.length > 0}
			<div class="forecast-section">
				<div class="forecast-header">FORECAST HIGHLIGHTS</div>
				{#each forecasts.slice(0, 3) as forecast (forecast.zoneId)}
					<div class="forecast-item" class:severity-high={forecast.severity === 'high' || forecast.severity === 'extreme'}>
						<div class="forecast-location">{forecast.location}</div>
						<div class="forecast-summary">{forecast.summary}</div>
						{#if forecast.precipitation.accumulation}
							<div class="forecast-precip">
								<span class="precip-icon">{forecast.precipitation.type === 'snow' ? '❄️' : '🌧️'}</span>
								{forecast.precipitation.accumulation}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- View More -->
		{#if alerts.length > 8}
			<button class="view-more-btn" onclick={handleOpenCommandCenter}>
				View all {alerts.length} alerts
			</button>
		{/if}
	{/if}
</Panel>

<style>
	.command-center-btn {
		background: rgb(30 41 59 / 0.5);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.command-center-btn:hover {
		background: rgb(51 65 85 / 0.5);
		border-color: rgb(6 182 212 / 0.5);
	}

	.btn-icon {
		font-size: 0.75rem;
	}

	.weather-empty {
		padding: 1rem;
		text-align: center;
		color: rgb(148 163 184);
	}

	.weather-empty p {
		margin-bottom: 0.75rem;
		font-size: 0.75rem;
	}

	.setup-btn {
		background: rgb(30 41 59);
		border: 1px solid rgb(6 182 212 / 0.5);
		color: rgb(34 211 238);
		padding: 0.375rem 0.75rem;
		font-size: 0.6875rem;
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.setup-btn:hover {
		background: rgb(6 182 212 / 0.2);
	}

	.severe-banner {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgb(127 29 29 / 0.3);
		border: 1px solid rgb(153 27 27 / 0.5);
		border-radius: 2px;
		margin-bottom: 0.5rem;
	}

	.severe-icon {
		font-size: 0.875rem;
	}

	.severe-text {
		font-size: 0.6875rem;
		font-weight: 600;
		color: rgb(248 113 113);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.alert-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.alert-item {
		background: var(--alert-bg);
		border: 1px solid var(--alert-border);
		border-radius: 2px;
		padding: 0.5rem;
		transition: all 0.15s;
	}

	.alert-item.clickable {
		cursor: pointer;
	}

	.alert-item.clickable:hover {
		background: rgb(51 65 85 / 0.5);
		border-color: rgb(6 182 212 / 0.5);
	}

	.alert-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.25rem;
	}

	.alert-icon {
		font-size: 0.75rem;
	}

	.alert-event {
		flex: 1;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--alert-text);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.alert-expires {
		font-size: 0.625rem;
		color: rgb(148 163 184);
		font-family: monospace;
	}

	.alert-area {
		font-size: 0.625rem;
		color: rgb(203 213 225);
		line-height: 1.3;
	}

	.alert-headline {
		font-size: 0.5625rem;
		color: rgb(148 163 184);
		margin-top: 0.25rem;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.forecast-section {
		margin-top: 0.75rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgb(51 65 85 / 0.5);
	}

	.forecast-header {
		font-size: 0.5625rem;
		font-weight: 600;
		color: rgb(148 163 184);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.5rem;
	}

	.forecast-item {
		padding: 0.375rem;
		background: rgb(30 41 59 / 0.3);
		border: 1px solid rgb(51 65 85 / 0.3);
		border-radius: 2px;
		margin-bottom: 0.25rem;
	}

	.forecast-item.severity-high {
		background: rgb(113 63 18 / 0.3);
		border-color: rgb(133 77 14 / 0.5);
	}

	.forecast-location {
		font-size: 0.625rem;
		font-weight: 600;
		color: rgb(203 213 225);
		margin-bottom: 0.125rem;
	}

	.forecast-summary {
		font-size: 0.5625rem;
		color: rgb(148 163 184);
	}

	.forecast-precip {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.25rem;
		font-size: 0.625rem;
		font-weight: 600;
		color: rgb(147 197 253);
	}

	.precip-icon {
		font-size: 0.625rem;
	}

	.view-more-btn {
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.375rem;
		background: rgb(30 41 59 / 0.5);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		font-size: 0.625rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.view-more-btn:hover {
		background: rgb(51 65 85 / 0.5);
		border-color: rgb(6 182 212 / 0.5);
		color: rgb(34 211 238);
	}
</style>
```

**Step 2: Register panel in config**

Modify `src/lib/config/panels.ts`:

Add `'weather'` to the `PanelId` type union:

```typescript
export type PanelId =
	| 'map'
	// ... existing panels ...
	| 'aircraft'
	| 'weather';
```

Add to `PANELS` record:

```typescript
export const PANELS: Record<PanelId, PanelConfig> = {
	// ... existing panels ...
	aircraft: { name: 'Aircraft Tracker', priority: 2 },
	weather: { name: 'Weather Alerts', priority: 1 }
};
```

**Step 3: Commit**

```bash
git add src/lib/components/panels/WeatherPanel.svelte src/lib/config/panels.ts
git commit -m "feat(weather): add WeatherPanel component with alerts and forecast display

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Weather Command Modal

**Files:**
- Create: `src/lib/components/modals/WeatherCommandModal.svelte`

**Step 1: Create the command center modal**

```svelte
<!-- src/lib/components/modals/WeatherCommandModal.svelte -->
<script lang="ts">
	import Modal from './Modal.svelte';
	import { weather, alertCount, enabledZones } from '$lib/stores';
	import { US_STATES, PREDEFINED_REGIONS, ALERT_SEVERITY_COLORS } from '$lib/config/weather';
	import type { WeatherAlert, WeatherZone } from '$lib/types';

	interface Props {
		open: boolean;
		onClose: () => void;
		onAlertSelect?: (alert: WeatherAlert) => void;
	}

	let { open, onClose, onAlertSelect }: Props = $props();

	// Tab state
	let activeTab = $state<'alerts' | 'zones' | 'briefing'>('alerts');

	// Zone management state
	let showStateSelector = $state(false);
	let newPointName = $state('');
	let newPointLat = $state('');
	let newPointLon = $state('');

	// Briefing state
	let briefingFormat = $state<'text' | 'markdown' | 'json'>('text');
	let generatedBriefing = $state<string | null>(null);
	let copySuccess = $state(false);

	// Derived state
	const alerts = $derived($weather.alerts);
	const zones = $derived($weather.zones);
	const forecasts = $derived($weather.forecasts);
	const loading = $derived($weather.alertsLoading);
	const count = $derived($alertCount);
	const enabledZonesList = $derived($enabledZones);

	function handleAlertClick(alert: WeatherAlert) {
		weather.selectAlert(alert.id);
		onAlertSelect?.(alert);
		onClose();
	}

	function getSeverityColors(severity: string) {
		return ALERT_SEVERITY_COLORS[severity] || ALERT_SEVERITY_COLORS.Unknown;
	}

	function addState(code: string) {
		const name = US_STATES[code];
		if (name) {
			weather.addStateZone(code, name);
		}
		showStateSelector = false;
	}

	function addRegion(key: string) {
		weather.addRegion(key);
		showStateSelector = false;
	}

	function addCustomPoint() {
		const lat = parseFloat(newPointLat);
		const lon = parseFloat(newPointLon);

		if (newPointName && !isNaN(lat) && !isNaN(lon)) {
			weather.addPointZone(newPointName, lat, lon);
			newPointName = '';
			newPointLat = '';
			newPointLon = '';
		}
	}

	function removeZone(id: string) {
		weather.removeZone(id);
	}

	function toggleZone(id: string) {
		weather.toggleZone(id);
	}

	async function refreshData() {
		await weather.refresh();
	}

	function generateBriefing() {
		const briefing = weather.generateBriefing(briefingFormat);
		generatedBriefing = briefing.content;
	}

	async function copyBriefing() {
		if (generatedBriefing) {
			await navigator.clipboard.writeText(generatedBriefing);
			copySuccess = true;
			setTimeout(() => (copySuccess = false), 2000);
		}
	}

	function formatTimestamp(ts: string): string {
		return new Date(ts).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<Modal {open} title="Weather Command Center" {onClose} size="large">
	<!-- Tab Navigation -->
	<div class="tabs">
		<button class="tab" class:active={activeTab === 'alerts'} onclick={() => (activeTab = 'alerts')}>
			Alerts ({count})
		</button>
		<button class="tab" class:active={activeTab === 'zones'} onclick={() => (activeTab = 'zones')}>
			Watch Zones ({zones.length})
		</button>
		<button class="tab" class:active={activeTab === 'briefing'} onclick={() => (activeTab = 'briefing')}>
			Briefing
		</button>
		<button class="refresh-btn" onclick={refreshData} disabled={loading}>
			{loading ? '...' : '↻'} Refresh
		</button>
	</div>

	<!-- Alerts Tab -->
	{#if activeTab === 'alerts'}
		<div class="tab-content">
			{#if alerts.length === 0}
				<div class="empty-state">
					<p>No active alerts for your watch zones.</p>
					<button class="action-btn" onclick={() => (activeTab = 'zones')}>
						Configure Watch Zones
					</button>
				</div>
			{:else}
				<div class="alert-grid">
					{#each alerts as alert (alert.id)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="alert-card"
							onclick={() => handleAlertClick(alert)}
							style="--alert-bg: {getSeverityColors(alert.severity).bg}; --alert-border: {getSeverityColors(alert.severity).border}; --alert-text: {getSeverityColors(alert.severity).text};"
						>
							<div class="alert-card-header">
								<span class="alert-severity">{alert.severity}</span>
								<span class="alert-urgency">{alert.urgency}</span>
							</div>
							<div class="alert-card-event">{alert.event}</div>
							<div class="alert-card-area">{alert.areaDesc}</div>
							{#if alert.headline}
								<div class="alert-card-headline">{alert.headline}</div>
							{/if}
							<div class="alert-card-meta">
								<span>Effective: {formatTimestamp(alert.effective)}</span>
								<span>Expires: {formatTimestamp(alert.expires)}</span>
							</div>
							{#if alert.instruction}
								<div class="alert-card-instruction">
									<strong>Instructions:</strong> {alert.instruction}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Zones Tab -->
	{#if activeTab === 'zones'}
		<div class="tab-content">
			<!-- Add Zone Controls -->
			<div class="zone-controls">
				<button class="action-btn" onclick={() => (showStateSelector = !showStateSelector)}>
					+ Add State/Region
				</button>
			</div>

			{#if showStateSelector}
				<div class="state-selector">
					<div class="selector-section">
						<div class="selector-label">Quick Regions</div>
						<div class="region-grid">
							{#each Object.entries(PREDEFINED_REGIONS) as [key, region]}
								<button class="region-btn" onclick={() => addRegion(key)}>
									{region.name}
								</button>
							{/each}
						</div>
					</div>
					<div class="selector-section">
						<div class="selector-label">Individual States</div>
						<div class="state-grid">
							{#each Object.entries(US_STATES) as [code, name]}
								<button
									class="state-btn"
									class:active={zones.some((z) => z.code === code)}
									onclick={() => addState(code)}
									disabled={zones.some((z) => z.code === code)}
								>
									{code}
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Custom Point -->
			<div class="custom-point-form">
				<div class="form-label">Add Custom Point</div>
				<div class="form-row">
					<input
						type="text"
						placeholder="Location name"
						bind:value={newPointName}
						class="form-input"
					/>
					<input
						type="text"
						placeholder="Lat"
						bind:value={newPointLat}
						class="form-input small"
					/>
					<input
						type="text"
						placeholder="Lon"
						bind:value={newPointLon}
						class="form-input small"
					/>
					<button class="action-btn" onclick={addCustomPoint}>Add</button>
				</div>
			</div>

			<!-- Zone List -->
			<div class="zone-list">
				<div class="zone-list-header">Active Watch Zones</div>
				{#if zones.length === 0}
					<div class="empty-state small">No watch zones configured</div>
				{:else}
					{#each zones as zone (zone.id)}
						<div class="zone-item">
							<button
								class="zone-toggle"
								class:enabled={zone.enabled}
								onclick={() => toggleZone(zone.id)}
							>
								{zone.enabled ? '●' : '○'}
							</button>
							<div class="zone-info">
								<span class="zone-name">{zone.name}</span>
								<span class="zone-type">{zone.type}</span>
								{#if zone.lat && zone.lon}
									<span class="zone-coords">{zone.lat.toFixed(2)}, {zone.lon.toFixed(2)}</span>
								{/if}
							</div>
							<button class="zone-remove" onclick={() => removeZone(zone.id)}>×</button>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Briefing Tab -->
	{#if activeTab === 'briefing'}
		<div class="tab-content">
			<div class="briefing-controls">
				<div class="format-selector">
					<label class="format-option">
						<input type="radio" bind:group={briefingFormat} value="text" />
						<span>Plain Text</span>
					</label>
					<label class="format-option">
						<input type="radio" bind:group={briefingFormat} value="markdown" />
						<span>Markdown</span>
					</label>
					<label class="format-option">
						<input type="radio" bind:group={briefingFormat} value="json" />
						<span>JSON</span>
					</label>
				</div>
				<div class="briefing-actions">
					<button class="action-btn primary" onclick={generateBriefing}>
						Generate Briefing
					</button>
					{#if generatedBriefing}
						<button class="action-btn" onclick={copyBriefing}>
							{copySuccess ? '✓ Copied!' : 'Copy to Clipboard'}
						</button>
					{/if}
				</div>
			</div>

			{#if generatedBriefing}
				<div class="briefing-output">
					<pre>{generatedBriefing}</pre>
				</div>
			{:else}
				<div class="empty-state">
					<p>Generate a briefing to share weather intelligence.</p>
					<p class="empty-hint">
						Includes {alerts.length} alert{alerts.length !== 1 ? 's' : ''} and {forecasts.length} forecast
						highlight{forecasts.length !== 1 ? 's' : ''}.
					</p>
				</div>
			{/if}
		</div>
	{/if}
</Modal>

<style>
	.tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0.5rem;
		background: rgb(15 23 42);
		border-bottom: 1px solid rgb(30 41 59);
		margin: -1rem -1rem 1rem -1rem;
	}

	.tab {
		padding: 0.5rem 1rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		color: rgb(148 163 184);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tab:hover {
		background: rgb(30 41 59);
	}

	.tab.active {
		background: rgb(30 41 59);
		border-color: rgb(6 182 212 / 0.5);
		color: rgb(34 211 238);
	}

	.refresh-btn {
		margin-left: auto;
		padding: 0.5rem 0.75rem;
		background: rgb(30 41 59);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.refresh-btn:hover:not(:disabled) {
		border-color: rgb(6 182 212 / 0.5);
		color: rgb(34 211 238);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.tab-content {
		min-height: 300px;
	}

	.empty-state {
		text-align: center;
		padding: 2rem;
		color: rgb(148 163 184);
	}

	.empty-state p {
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.empty-state.small {
		padding: 1rem;
	}

	.empty-state.small p {
		font-size: 0.75rem;
	}

	.empty-hint {
		font-size: 0.6875rem !important;
		color: rgb(100 116 139);
	}

	.action-btn {
		padding: 0.5rem 1rem;
		background: rgb(30 41 59);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.action-btn:hover {
		border-color: rgb(6 182 212 / 0.5);
		color: rgb(34 211 238);
	}

	.action-btn.primary {
		background: rgb(6 182 212 / 0.2);
		border-color: rgb(6 182 212 / 0.5);
		color: rgb(34 211 238);
	}

	.action-btn.primary:hover {
		background: rgb(6 182 212 / 0.3);
	}

	/* Alert Grid */
	.alert-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.alert-card {
		background: var(--alert-bg);
		border: 1px solid var(--alert-border);
		border-radius: 2px;
		padding: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.alert-card:hover {
		background: rgb(51 65 85 / 0.5);
		border-color: rgb(6 182 212 / 0.5);
	}

	.alert-card-header {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
	}

	.alert-severity,
	.alert-urgency {
		font-size: 0.5625rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.125rem 0.375rem;
		background: rgb(0 0 0 / 0.3);
		border-radius: 2px;
	}

	.alert-severity {
		color: var(--alert-text);
	}

	.alert-urgency {
		color: rgb(148 163 184);
	}

	.alert-card-event {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--alert-text);
		margin-bottom: 0.25rem;
	}

	.alert-card-area {
		font-size: 0.75rem;
		color: rgb(203 213 225);
		margin-bottom: 0.375rem;
	}

	.alert-card-headline {
		font-size: 0.6875rem;
		color: rgb(148 163 184);
		margin-bottom: 0.375rem;
		line-height: 1.4;
	}

	.alert-card-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.625rem;
		color: rgb(100 116 139);
		font-family: monospace;
	}

	.alert-card-instruction {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgb(51 65 85 / 0.5);
		font-size: 0.6875rem;
		color: rgb(148 163 184);
		line-height: 1.4;
	}

	/* Zone Controls */
	.zone-controls {
		margin-bottom: 1rem;
	}

	.state-selector {
		background: rgb(15 23 42);
		border: 1px solid rgb(30 41 59);
		border-radius: 2px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.selector-section {
		margin-bottom: 1rem;
	}

	.selector-section:last-child {
		margin-bottom: 0;
	}

	.selector-label {
		font-size: 0.625rem;
		font-weight: 600;
		color: rgb(148 163 184);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.5rem;
	}

	.region-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.region-btn {
		padding: 0.375rem 0.75rem;
		background: rgb(30 41 59);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		font-size: 0.6875rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.region-btn:hover {
		border-color: rgb(6 182 212 / 0.5);
		color: rgb(34 211 238);
	}

	.state-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.state-btn {
		width: 2.5rem;
		padding: 0.25rem;
		background: rgb(30 41 59);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		font-size: 0.625rem;
		font-family: monospace;
		cursor: pointer;
		transition: all 0.15s;
	}

	.state-btn:hover:not(:disabled) {
		border-color: rgb(6 182 212 / 0.5);
		color: rgb(34 211 238);
	}

	.state-btn.active,
	.state-btn:disabled {
		background: rgb(6 182 212 / 0.2);
		border-color: rgb(6 182 212 / 0.5);
		color: rgb(34 211 238);
		cursor: default;
	}

	/* Custom Point Form */
	.custom-point-form {
		background: rgb(15 23 42);
		border: 1px solid rgb(30 41 59);
		border-radius: 2px;
		padding: 0.75rem;
		margin-bottom: 1rem;
	}

	.form-label {
		font-size: 0.625rem;
		font-weight: 600;
		color: rgb(148 163 184);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 0.5rem;
	}

	.form-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.form-input {
		flex: 1;
		padding: 0.375rem 0.5rem;
		background: rgb(30 41 59);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(203 213 225);
		font-size: 0.75rem;
	}

	.form-input.small {
		flex: 0 0 4rem;
	}

	.form-input:focus {
		outline: none;
		border-color: rgb(6 182 212 / 0.5);
	}

	/* Zone List */
	.zone-list {
		background: rgb(15 23 42);
		border: 1px solid rgb(30 41 59);
		border-radius: 2px;
	}

	.zone-list-header {
		padding: 0.5rem 0.75rem;
		background: rgb(30 41 59);
		font-size: 0.625rem;
		font-weight: 600;
		color: rgb(148 163 184);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.zone-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid rgb(30 41 59);
	}

	.zone-item:last-child {
		border-bottom: none;
	}

	.zone-toggle {
		background: none;
		border: none;
		color: rgb(100 116 139);
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0.25rem;
	}

	.zone-toggle.enabled {
		color: rgb(52 211 153);
	}

	.zone-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.zone-name {
		font-size: 0.75rem;
		color: rgb(203 213 225);
	}

	.zone-type {
		font-size: 0.5625rem;
		color: rgb(100 116 139);
		text-transform: uppercase;
		padding: 0.125rem 0.25rem;
		background: rgb(30 41 59);
		border-radius: 2px;
	}

	.zone-coords {
		font-size: 0.625rem;
		color: rgb(100 116 139);
		font-family: monospace;
	}

	.zone-remove {
		background: none;
		border: 1px solid transparent;
		color: rgb(100 116 139);
		font-size: 1rem;
		cursor: pointer;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		transition: all 0.15s;
	}

	.zone-remove:hover {
		border-color: rgb(239 68 68 / 0.5);
		color: rgb(248 113 113);
	}

	/* Briefing Tab */
	.briefing-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.format-selector {
		display: flex;
		gap: 1rem;
	}

	.format-option {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		color: rgb(148 163 184);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.format-option input {
		accent-color: rgb(6 182 212);
	}

	.briefing-actions {
		display: flex;
		gap: 0.5rem;
	}

	.briefing-output {
		background: rgb(15 23 42);
		border: 1px solid rgb(30 41 59);
		border-radius: 2px;
		padding: 1rem;
		max-height: 350px;
		overflow-y: auto;
	}

	.briefing-output pre {
		margin: 0;
		font-size: 0.6875rem;
		color: rgb(203 213 225);
		white-space: pre-wrap;
		word-break: break-word;
		font-family: monospace;
		line-height: 1.5;
	}
</style>
```

**Step 2: Commit**

```bash
git add src/lib/components/modals/WeatherCommandModal.svelte
git commit -m "feat(weather): add WeatherCommandModal with zones, alerts, and briefing generation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Globe Integration - Alert Layers

**Files:**
- Modify: `src/lib/components/panels/MapboxGlobePanel.svelte`

**Step 1: Add weather alert layer to globe**

Add to imports section:

```typescript
import { weather, selectedAlert } from '$lib/stores';
import { ALERT_MAP_COLORS } from '$lib/config/weather';
import type { WeatherAlert } from '$lib/types';
```

Add state variables near other layer states:

```typescript
// Weather alert overlay state
let weatherAlertsVisible = $state(false);
let weatherAlertsLoading = $state(false);
```

Add function to build alert GeoJSON:

```typescript
// Build GeoJSON from weather alerts with geometry
function buildAlertGeoJSON(alerts: WeatherAlert[]): GeoJSON.FeatureCollection {
	const features: GeoJSON.Feature[] = [];

	for (const alert of alerts) {
		if (!alert.geometry) continue;

		const color = ALERT_MAP_COLORS[alert.event] || ALERT_MAP_COLORS.default;

		features.push({
			type: 'Feature',
			properties: {
				id: alert.id,
				event: alert.event,
				severity: alert.severity,
				areaDesc: alert.areaDesc,
				color
			},
			geometry: alert.geometry
		});
	}

	return {
		type: 'FeatureCollection',
		features
	};
}
```

Add function to update alert layer:

```typescript
// Update weather alert layer
function updateWeatherAlertLayer() {
	if (!map || !isInitialized) return;

	const alerts = $weather.alerts.filter(a => a.geometry);
	const geojson = buildAlertGeoJSON(alerts);

	// Add or update source
	const source = map.getSource('weather-alerts') as mapboxgl.GeoJSONSource;
	if (source) {
		source.setData(geojson);
	} else {
		map.addSource('weather-alerts', {
			type: 'geojson',
			data: geojson
		});

		// Add fill layer for alert polygons
		map.addLayer({
			id: 'weather-alerts-fill',
			type: 'fill',
			source: 'weather-alerts',
			paint: {
				'fill-color': ['get', 'color'],
				'fill-opacity': 0.3
			}
		}, 'weather-radar-layer'); // Insert below radar if present

		// Add outline layer
		map.addLayer({
			id: 'weather-alerts-line',
			type: 'line',
			source: 'weather-alerts',
			paint: {
				'line-color': ['get', 'color'],
				'line-width': 2,
				'line-opacity': 0.8
			}
		}, 'weather-radar-layer');
	}

	// Set visibility
	const visibility = weatherAlertsVisible ? 'visible' : 'none';
	if (map.getLayer('weather-alerts-fill')) {
		map.setLayoutProperty('weather-alerts-fill', 'visibility', visibility);
	}
	if (map.getLayer('weather-alerts-line')) {
		map.setLayoutProperty('weather-alerts-line', 'visibility', visibility);
	}
}
```

Add toggle function:

```typescript
// Toggle weather alerts visibility
function toggleWeatherAlerts() {
	weatherAlertsVisible = !weatherAlertsVisible;

	if (weatherAlertsVisible && $weather.alerts.length === 0) {
		weatherAlertsLoading = true;
		weather.fetchAlerts().then(() => {
			weatherAlertsLoading = false;
			updateWeatherAlertLayer();
		});
	} else {
		updateWeatherAlertLayer();
	}
}
```

Add fly-to function for selected alert:

```typescript
// Fly to selected weather alert
function flyToAlert(alert: WeatherAlert) {
	if (!map || !alert.geometry) return;

	// Calculate bounds from geometry
	let bounds: mapboxgl.LngLatBounds | null = null;

	if (alert.geometry.type === 'Polygon') {
		bounds = new mapboxgl.LngLatBounds();
		for (const coord of alert.geometry.coordinates[0]) {
			bounds.extend(coord as [number, number]);
		}
	} else if (alert.geometry.type === 'MultiPolygon') {
		bounds = new mapboxgl.LngLatBounds();
		for (const polygon of alert.geometry.coordinates) {
			for (const coord of polygon[0]) {
				bounds.extend(coord as [number, number]);
			}
		}
	}

	if (bounds) {
		map.fitBounds(bounds, {
			padding: 50,
			maxZoom: 8,
			duration: 1500
		});
	}
}
```

Add effect to watch selected alert:

```typescript
// Watch for selected alert changes
$effect(() => {
	const alert = $selectedAlert;
	if (alert && map && isInitialized) {
		// Ensure alerts are visible
		if (!weatherAlertsVisible) {
			weatherAlertsVisible = true;
			updateWeatherAlertLayer();
		}
		flyToAlert(alert);
	}
});
```

Add button to controls section (near weather radar button):

```svelte
<button
	class="control-btn weather-alerts-btn"
	class:active={weatherAlertsVisible}
	class:loading={weatherAlertsLoading}
	onclick={toggleWeatherAlerts}
	title={weatherAlertsVisible ? 'Hide weather alerts' : 'Show weather alerts'}
>
	<span class="control-icon">{weatherAlertsLoading ? '...' : '⚠'}</span>
</button>
```

Add styles:

```css
/* Weather Alerts Button */
.weather-alerts-btn.active {
	background: rgb(127 29 29 / 0.6);
	border-color: rgb(248 113 113 / 0.6);
	color: rgb(248 113 113);
}

.weather-alerts-btn:hover {
	border-color: rgb(248 113 113 / 0.5);
	color: rgb(248 113 113);
}

.weather-alerts-btn.loading {
	opacity: 0.7;
	cursor: wait;
}

.weather-alerts-btn.loading .control-icon {
	animation: pulse 1s ease-in-out infinite;
}
```

**Step 2: Commit**

```bash
git add src/lib/components/panels/MapboxGlobePanel.svelte
git commit -m "feat(weather): add weather alert polygon layers to globe with fly-to navigation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Dashboard Integration

**Files:**
- Modify: `src/routes/+page.svelte` (or main dashboard component)

**Step 1: Import and add WeatherPanel and WeatherCommandModal**

Add imports:

```typescript
import WeatherPanel from '$lib/components/panels/WeatherPanel.svelte';
import WeatherCommandModal from '$lib/components/modals/WeatherCommandModal.svelte';
import { weather } from '$lib/stores';
```

Add modal state (if not using store-driven approach):

```typescript
// Weather command modal is controlled by weather store
const weatherModalOpen = $derived($weather.commandModalOpen);
```

Add WeatherPanel to panel grid (in appropriate position based on priority):

```svelte
{#if $settings.enabled.weather}
	<WeatherPanel
		onAlertClick={(alert) => {
			// Globe will auto-fly to alert via selectedAlert effect
		}}
		onOpenCommandCenter={() => weather.openCommandModal()}
	/>
{/if}
```

Add WeatherCommandModal at end of component:

```svelte
<WeatherCommandModal
	open={weatherModalOpen}
	onClose={() => weather.closeCommandModal()}
	onAlertSelect={(alert) => {
		// Globe will auto-fly via selectedAlert effect
	}}
/>
```

**Step 2: Add weather to refresh cycle**

In the refresh function, add weather refresh to secondary stage:

```typescript
// In REFRESH_STAGES or refresh function
// Add 'weather' to secondary stage categories
```

**Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(weather): integrate WeatherPanel and WeatherCommandModal into dashboard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Testing and Verification

**Files:**
- Create: `src/lib/api/weather.test.ts`
- Create: `src/lib/stores/weather.test.ts`

**Step 1: Create API tests**

```typescript
// src/lib/api/weather.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	fetchAlertsByState,
	fetchAllActiveAlerts,
	extractForecastHighlights,
	generateBriefingText
} from './weather';
import type { ForecastPeriod, WeatherAlert } from '$lib/types';

describe('Weather API', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('extractForecastHighlights', () => {
		it('should extract temperature extremes', () => {
			const periods: ForecastPeriod[] = [
				{
					number: 1,
					name: 'Tonight',
					startTime: '2024-01-22T18:00:00',
					endTime: '2024-01-23T06:00:00',
					isDaytime: false,
					temperature: 15,
					temperatureUnit: 'F',
					temperatureTrend: null,
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 80 },
					dewpoint: { unitCode: 'wmoUnit:degC', value: -5 },
					relativeHumidity: { unitCode: 'wmoUnit:percent', value: 85 },
					windSpeed: '15 to 25 mph',
					windDirection: 'N',
					icon: 'https://api.weather.gov/icons/land/night/snow',
					shortForecast: 'Heavy Snow',
					detailedForecast: 'Heavy snow expected. 6 to 10 inches of snow accumulation.'
				},
				{
					number: 2,
					name: 'Wednesday',
					startTime: '2024-01-23T06:00:00',
					endTime: '2024-01-23T18:00:00',
					isDaytime: true,
					temperature: 22,
					temperatureUnit: 'F',
					temperatureTrend: null,
					probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 40 },
					dewpoint: { unitCode: 'wmoUnit:degC', value: -8 },
					relativeHumidity: { unitCode: 'wmoUnit:percent', value: 70 },
					windSpeed: '10 to 15 mph',
					windDirection: 'NW',
					icon: 'https://api.weather.gov/icons/land/day/snow',
					shortForecast: 'Snow Likely',
					detailedForecast: 'Snow likely in the morning.'
				}
			];

			const result = extractForecastHighlights('Kansas City', 'zone1', periods);

			expect(result).not.toBeNull();
			expect(result!.temperature.low).toBe(15);
			expect(result!.temperature.high).toBe(22);
			expect(result!.precipitation.type).toBe('snow');
			expect(result!.precipitation.accumulation).toBe('6 to 10 inches');
		});

		it('should return null for empty periods', () => {
			const result = extractForecastHighlights('Test', 'zone1', []);
			expect(result).toBeNull();
		});
	});

	describe('generateBriefingText', () => {
		it('should generate briefing with alerts and forecasts', () => {
			const alerts: WeatherAlert[] = [
				{
					id: 'test-1',
					event: 'Winter Storm Warning',
					severity: 'Severe',
					areaDesc: 'Johnson County',
					headline: 'Winter Storm Warning in effect'
				} as WeatherAlert
			];

			const forecasts = [
				{
					location: 'Kansas City',
					zoneId: 'zone1',
					summary: 'Heavy Snow',
					temperature: { high: 22, low: 15 },
					precipitation: { chance: 80, type: 'snow', accumulation: '6-10 inches' },
					wind: { speed: '15-25 mph', gusts: '35 mph' },
					timing: 'Tonight through Wednesday',
					severity: 'high' as const
				}
			];

			const result = generateBriefingText(alerts, forecasts);

			expect(result).toContain('WEATHER SITUATION BRIEFING');
			expect(result).toContain('Winter Storm Warning');
			expect(result).toContain('Johnson County');
			expect(result).toContain('Kansas City');
			expect(result).toContain('6-10 inches');
		});
	});
});
```

**Step 2: Create store tests**

```typescript
// src/lib/stores/weather.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { weather, alertCount, enabledZones } from './weather';

// Mock localStorage
const localStorageMock = {
	store: {} as Record<string, string>,
	getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
	setItem: vi.fn((key: string, value: string) => {
		localStorageMock.store[key] = value;
	}),
	removeItem: vi.fn((key: string) => {
		delete localStorageMock.store[key];
	}),
	clear: vi.fn(() => {
		localStorageMock.store = {};
	})
};

vi.stubGlobal('localStorage', localStorageMock);

describe('Weather Store', () => {
	beforeEach(() => {
		localStorageMock.clear();
		weather.reset();
	});

	describe('zone management', () => {
		it('should add a state zone', () => {
			const zone = weather.addStateZone('KS', 'Kansas');

			expect(zone).not.toBeNull();
			expect(zone!.type).toBe('state');
			expect(zone!.code).toBe('KS');
			expect(zone!.name).toBe('Kansas');

			const state = get(weather);
			expect(state.zones).toHaveLength(1);
		});

		it('should not add duplicate state zones', () => {
			weather.addStateZone('KS', 'Kansas');
			const duplicate = weather.addStateZone('KS', 'Kansas');

			expect(duplicate).toBeNull();

			const state = get(weather);
			expect(state.zones).toHaveLength(1);
		});

		it('should add a custom point zone', () => {
			const zone = weather.addPointZone('My Location', 39.0997, -94.5786);

			expect(zone).not.toBeNull();
			expect(zone!.type).toBe('point');
			expect(zone!.lat).toBe(39.0997);
			expect(zone!.lon).toBe(-94.5786);
		});

		it('should remove a zone', () => {
			const zone = weather.addStateZone('KS', 'Kansas');
			expect(get(weather).zones).toHaveLength(1);

			const removed = weather.removeZone(zone!.id);
			expect(removed).toBe(true);
			expect(get(weather).zones).toHaveLength(0);
		});

		it('should toggle zone enabled state', () => {
			const zone = weather.addStateZone('KS', 'Kansas');
			expect(zone!.enabled).toBe(true);

			weather.toggleZone(zone!.id);
			const state = get(weather);
			expect(state.zones[0].enabled).toBe(false);
		});
	});

	describe('derived stores', () => {
		it('should count alerts', () => {
			expect(get(alertCount)).toBe(0);
		});

		it('should filter enabled zones', () => {
			weather.addStateZone('KS', 'Kansas');
			weather.addStateZone('MO', 'Missouri');

			const zones = get(weather).zones;
			weather.toggleZone(zones[0].id);

			const enabled = get(enabledZones);
			expect(enabled).toHaveLength(1);
			expect(enabled[0].code).toBe('MO');
		});
	});

	describe('briefing generation', () => {
		it('should generate text briefing', () => {
			const briefing = weather.generateBriefing('text');

			expect(briefing.format).toBe('text');
			expect(briefing.content).toContain('WEATHER SITUATION BRIEFING');

			const state = get(weather);
			expect(state.briefings).toHaveLength(1);
		});

		it('should generate markdown briefing', () => {
			const briefing = weather.generateBriefing('markdown');

			expect(briefing.format).toBe('markdown');
			expect(briefing.content).toContain('# Weather Situation Briefing');
		});

		it('should generate JSON briefing', () => {
			const briefing = weather.generateBriefing('json');

			expect(briefing.format).toBe('json');
			const parsed = JSON.parse(briefing.content);
			expect(parsed).toHaveProperty('timestamp');
			expect(parsed).toHaveProperty('alerts');
		});
	});
});
```

**Step 3: Run tests**

```bash
npm run test:unit
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/lib/api/weather.test.ts src/lib/stores/weather.test.ts
git commit -m "test(weather): add unit tests for weather API and store

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

This plan creates a comprehensive weather command center with:

1. **Types & Config** - TypeScript interfaces and NWS configuration
2. **API Layer** - NWS API integration for alerts, forecasts, and briefings
3. **Store** - Reactive state management with zone persistence
4. **Panel** - At-a-glance weather alerts and forecast highlights
5. **Modal** - Full command center with zone management and briefing export
6. **Globe Integration** - Alert polygons and fly-to navigation
7. **Dashboard Integration** - Panel and modal wired into main app
8. **Testing** - Unit tests for API and store functionality

All using free NWS APIs with no keys required.
