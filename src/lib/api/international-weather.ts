/**
 * International Weather Alerts API
 * Aggregates weather alerts from multiple national meteorological services
 * 
 * Sources:
 * - Environment Canada (ECCC) - CAP-XML via ATOM feeds
 * - MeteoAlarm (Europe) - RSS/JSON feeds for 37 countries
 * - Japan Meteorological Agency (JMA) - JSON API
 * - Australia Bureau of Meteorology (BOM) - CAP feeds
 */

import { logger } from '$lib/config/api';
import type { WeatherAlert, AlertSeverity } from '$lib/types';

// ============================================================================
// API Endpoints
// ============================================================================

/** Environment Canada Weather Alerts - ATOM feed index */
const ECCC_ATOM_URL = 'https://dd.weather.gc.ca/alerts/cap/atom.xml';

/** MeteoAlarm RSS feed base URL (per country) */
const METEOALARM_RSS_BASE = 'https://feeds.meteoalarm.org/api/v1';

/** Japan Meteorological Agency */
const JMA_API = 'https://www.jma.go.jp/bosai';

/** Australia Bureau of Meteorology CAP feed */
const BOM_CAP_URL = 'http://www.bom.gov.au/fwo/IDZ00023.warnings.xml';

// ============================================================================
// Types
// ============================================================================

/**
 * International alert with source tracking
 */
export interface InternationalAlert extends WeatherAlert {
	source: 'NWS' | 'MeteoAlarm' | 'ECCC' | 'MetOffice' | 'JMA' | 'BOM' | 'Other';
	country: string;
	countryCode: string;
}

// CAP Alert structures defined inline where needed

// ============================================================================
// Severity Mappings
// ============================================================================

const SEVERITY_MAP: Record<string, AlertSeverity> = {
	// Standard CAP values
	'Extreme': 'Extreme',
	'Severe': 'Severe',
	'Moderate': 'Moderate',
	'Minor': 'Minor',
	'Unknown': 'Unknown',
	// MeteoAlarm colors
	'Red': 'Extreme',
	'Orange': 'Severe',
	'Yellow': 'Moderate',
	'Green': 'Minor',
	'White': 'Unknown',
	// Numeric (JMA)
	'1': 'Minor',
	'2': 'Moderate',
	'3': 'Severe',
	'4': 'Extreme'
};

// Urgency and Certainty use standard CAP values directly

// ============================================================================
// Canada (Environment and Climate Change Canada)
// ============================================================================

/** Canadian province codes */
const CANADA_PROVINCES: Record<string, string> = {
	'AB': 'Alberta',
	'BC': 'British Columbia',
	'MB': 'Manitoba',
	'NB': 'New Brunswick',
	'NL': 'Newfoundland and Labrador',
	'NS': 'Nova Scotia',
	'NT': 'Northwest Territories',
	'NU': 'Nunavut',
	'ON': 'Ontario',
	'PE': 'Prince Edward Island',
	'QC': 'Quebec',
	'SK': 'Saskatchewan',
	'YT': 'Yukon'
};

/**
 * Fetch alerts from Environment Canada
 * Uses CAP (Common Alerting Protocol) via ATOM feed
 */
export async function fetchCanadaAlerts(provinces?: string[]): Promise<InternationalAlert[]> {
	try {
		// Fetch the ATOM feed which lists all current alerts
		const response = await fetch(ECCC_ATOM_URL, {
			signal: AbortSignal.timeout(20000),
			headers: {
				'Accept': 'application/atom+xml, application/xml, text/xml'
			}
		});

		if (!response.ok) {
			logger.warn('Weather', `ECCC ATOM feed returned ${response.status}`);
			return [];
		}

		const xmlText = await response.text();
		return parseCanadaATOM(xmlText, provinces);
	} catch (error) {
		logger.warn('Weather', 'Failed to fetch Canada alerts:', error);
		return [];
	}
}

/**
 * Parse ECCC ATOM feed
 */
function parseCanadaATOM(xmlText: string, filterProvinces?: string[]): InternationalAlert[] {
	const alerts: InternationalAlert[] = [];
	
	try {
		// Parse XML using DOMParser (browser) or regex fallback
		if (typeof DOMParser !== 'undefined') {
			const parser = new DOMParser();
			const doc = parser.parseFromString(xmlText, 'application/xml');
			const entries = doc.querySelectorAll('entry');
			
			for (const entry of entries) {
				const title = entry.querySelector('title')?.textContent || '';
				const summary = entry.querySelector('summary')?.textContent || '';
				const link = entry.querySelector('link')?.getAttribute('href') || '';
				const updated = entry.querySelector('updated')?.textContent || '';
				const id = entry.querySelector('id')?.textContent || '';
				
				// Extract province from the link/id (format: .../CAPS-CWAO/province/...)
				const provinceMatch = link.match(/\/alerts\/cap\/(\d{8})\/(\w{2})\//);
				const province = provinceMatch?.[2]?.toUpperCase();
				
				// Filter by province if specified
				if (filterProvinces && province && !filterProvinces.includes(province)) {
					continue;
				}
				
				// Determine severity from title
				let severity: AlertSeverity = 'Unknown';
				const titleLower = title.toLowerCase();
				if (titleLower.includes('warning') || titleLower.includes('tornado') || titleLower.includes('hurricane')) {
					severity = 'Severe';
				} else if (titleLower.includes('watch')) {
					severity = 'Moderate';
				} else if (titleLower.includes('advisory') || titleLower.includes('statement')) {
					severity = 'Minor';
				}
				
				// Check for extreme conditions
				if (titleLower.includes('extreme') || titleLower.includes('emergency')) {
					severity = 'Extreme';
				}
				
				const alert: InternationalAlert = {
					id: id || `eccc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
					source: 'ECCC',
					country: 'Canada',
					countryCode: 'CA',
					areaDesc: province ? CANADA_PROVINCES[province] || province : 'Canada',
					geocode: { SAME: [], UGC: [] },
					affectedZones: [],
					references: [],
					sent: updated,
					effective: updated,
					onset: null,
					expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default 24h
					ends: null,
					status: 'Actual',
					messageType: 'Alert',
					category: 'Met',
					severity,
					certainty: 'Likely',
					urgency: 'Expected',
					event: title.split(' - ')[0] || title,
					sender: 'Environment Canada',
					senderName: 'Environment and Climate Change Canada',
					headline: title,
					description: summary,
					instruction: null,
					response: 'Monitor',
					parameters: {},
					geometry: null
				};
				
				alerts.push(alert);
			}
		}
	} catch (error) {
		logger.warn('Weather', 'Failed to parse ECCC ATOM:', error);
	}
	
	return alerts;
}

// ============================================================================
// MeteoAlarm (Europe)
// ============================================================================

/** European countries in MeteoAlarm */
const METEOALARM_COUNTRIES: Record<string, string> = {
	'AT': 'Austria', 'BE': 'Belgium', 'BA': 'Bosnia and Herzegovina',
	'BG': 'Bulgaria', 'HR': 'Croatia', 'CY': 'Cyprus', 'CZ': 'Czechia',
	'DK': 'Denmark', 'EE': 'Estonia', 'FI': 'Finland', 'FR': 'France',
	'DE': 'Germany', 'GR': 'Greece', 'HU': 'Hungary', 'IS': 'Iceland',
	'IE': 'Ireland', 'IT': 'Italy', 'LV': 'Latvia', 'LT': 'Lithuania',
	'LU': 'Luxembourg', 'MT': 'Malta', 'ME': 'Montenegro', 'NL': 'Netherlands',
	'MK': 'North Macedonia', 'NO': 'Norway', 'PL': 'Poland', 'PT': 'Portugal',
	'RO': 'Romania', 'RS': 'Serbia', 'SK': 'Slovakia', 'SI': 'Slovenia',
	'ES': 'Spain', 'SE': 'Sweden', 'CH': 'Switzerland', 'UK': 'United Kingdom'
};

/** MeteoAlarm event types */
const METEOALARM_EVENTS: Record<string, string> = {
	'1': 'Wind',
	'2': 'Snow/Ice',
	'3': 'Thunderstorms',
	'4': 'Fog',
	'5': 'Extreme High Temperature',
	'6': 'Extreme Low Temperature',
	'7': 'Coastal Event',
	'8': 'Forest Fire',
	'9': 'Avalanches',
	'10': 'Rain',
	'11': 'Flooding',
	'12': 'Rain-Flood'
};

/**
 * Fetch alerts from MeteoAlarm (Europe)
 * Note: The public API has rate limits; consider caching
 */
export async function fetchMeteoAlarmAlerts(countryCodes?: string[]): Promise<InternationalAlert[]> {
	const alerts: InternationalAlert[] = [];
	const countries = countryCodes || Object.keys(METEOALARM_COUNTRIES);
	
	// Fetch in batches to avoid rate limits
	const batchSize = 5;
	for (let i = 0; i < countries.length; i += batchSize) {
		const batch = countries.slice(i, i + batchSize);
		const batchPromises = batch.map(code => fetchMeteoAlarmCountry(code));
		
		try {
			const results = await Promise.allSettled(batchPromises);
			for (const result of results) {
				if (result.status === 'fulfilled') {
					alerts.push(...result.value);
				}
			}
		} catch (error) {
			logger.warn('Weather', 'MeteoAlarm batch failed:', error);
		}
		
		// Small delay between batches
		if (i + batchSize < countries.length) {
			await new Promise(resolve => setTimeout(resolve, 200));
		}
	}
	
	return alerts;
}

/**
 * Fetch alerts for a single MeteoAlarm country
 */
async function fetchMeteoAlarmCountry(countryCode: string): Promise<InternationalAlert[]> {
	try {
		// MeteoAlarm provides RSS feeds per country
		const rssUrl = `${METEOALARM_RSS_BASE}/feeds/meteoalarm-legacy-rss-${countryCode.toLowerCase()}`;
		
		const response = await fetch(rssUrl, {
			signal: AbortSignal.timeout(10000),
			headers: { 'Accept': 'application/rss+xml, application/xml' }
		});
		
		if (!response.ok) {
			return [];
		}
		
		const xmlText = await response.text();
		return parseMeteoAlarmRSS(xmlText, countryCode);
	} catch (error) {
		// Silently fail for individual countries
		return [];
	}
}

/**
 * Parse MeteoAlarm RSS feed
 */
function parseMeteoAlarmRSS(xmlText: string, countryCode: string): InternationalAlert[] {
	const alerts: InternationalAlert[] = [];
	
	try {
		if (typeof DOMParser !== 'undefined') {
			const parser = new DOMParser();
			const doc = parser.parseFromString(xmlText, 'application/xml');
			const items = doc.querySelectorAll('item');
			
			for (const item of items) {
				const title = item.querySelector('title')?.textContent || '';
				const description = item.querySelector('description')?.textContent || '';
				const pubDate = item.querySelector('pubDate')?.textContent || '';
				const guid = item.querySelector('guid')?.textContent || '';
				
				// Extract awareness level (color) and type from title
				// Format typically: "Country - Region: Awareness Level (Color) for Event Type"
				let severity: AlertSeverity = 'Unknown';
				const colorMatch = title.match(/\b(Red|Orange|Yellow|Green)\b/i);
				if (colorMatch) {
					severity = SEVERITY_MAP[colorMatch[1]] || 'Unknown';
				}
				
				// Extract event type
				let eventType = 'Weather Alert';
				for (const [, name] of Object.entries(METEOALARM_EVENTS)) {
					if (title.toLowerCase().includes(name.toLowerCase())) {
						eventType = name;
						break;
					}
				}
				
				const alert: InternationalAlert = {
					id: guid || `meteoalarm-${countryCode}-${Date.now()}`,
					source: 'MeteoAlarm',
					country: METEOALARM_COUNTRIES[countryCode] || countryCode,
					countryCode: countryCode,
					areaDesc: title.split(':')[0] || METEOALARM_COUNTRIES[countryCode] || countryCode,
					geocode: { SAME: [], UGC: [] },
					affectedZones: [],
					references: [],
					sent: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
					effective: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
					onset: null,
					expires: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
					ends: null,
					status: 'Actual',
					messageType: 'Alert',
					category: 'Met',
					severity,
					certainty: 'Likely',
					urgency: 'Expected',
					event: eventType,
					sender: 'MeteoAlarm',
					senderName: `MeteoAlarm - ${METEOALARM_COUNTRIES[countryCode] || countryCode}`,
					headline: title,
					description: description.replace(/<[^>]*>/g, ''), // Strip HTML
					instruction: null,
					response: 'Monitor',
					parameters: {},
					geometry: null
				};
				
				alerts.push(alert);
			}
		}
	} catch (error) {
		logger.warn('Weather', `Failed to parse MeteoAlarm RSS for ${countryCode}:`, error);
	}
	
	return alerts;
}

// ============================================================================
// Japan Meteorological Agency (JMA)
// ============================================================================

/** JMA Prefecture codes to names */
const JMA_PREFECTURES: Record<string, string> = {
	'011000': 'Hokkaido (Sapporo)', '012000': 'Hokkaido (Asahikawa)',
	'013000': 'Hokkaido (Hakodate)', '014030': 'Hokkaido (Kushiro)',
	'020000': 'Aomori', '030000': 'Iwate', '040000': 'Miyagi',
	'050000': 'Akita', '060000': 'Yamagata', '070000': 'Fukushima',
	'080000': 'Ibaraki', '090000': 'Tochigi', '100000': 'Gunma',
	'110000': 'Saitama', '120000': 'Chiba', '130000': 'Tokyo',
	'140000': 'Kanagawa', '150000': 'Niigata', '160000': 'Toyama',
	'170000': 'Ishikawa', '180000': 'Fukui', '190000': 'Yamanashi',
	'200000': 'Nagano', '210000': 'Gifu', '220000': 'Shizuoka',
	'230000': 'Aichi', '240000': 'Mie', '250000': 'Shiga',
	'260000': 'Kyoto', '270000': 'Osaka', '280000': 'Hyogo',
	'290000': 'Nara', '300000': 'Wakayama', '310000': 'Tottori',
	'320000': 'Shimane', '330000': 'Okayama', '340000': 'Hiroshima',
	'350000': 'Yamaguchi', '360000': 'Tokushima', '370000': 'Kagawa',
	'380000': 'Ehime', '390000': 'Kochi', '400000': 'Fukuoka',
	'410000': 'Saga', '420000': 'Nagasaki', '430000': 'Kumamoto',
	'440000': 'Oita', '450000': 'Miyazaki', '460100': 'Kagoshima',
	'471000': 'Okinawa (Main)', '472000': 'Okinawa (Miyako)',
	'473000': 'Okinawa (Yaeyama)'
};

/** JMA Warning types */
const JMA_WARNING_TYPES: Record<string, { event: string; severity: AlertSeverity }> = {
	'33': { event: 'Heavy Rain Warning', severity: 'Severe' },
	'03': { event: 'Heavy Rain Advisory', severity: 'Moderate' },
	'35': { event: 'Flood Warning', severity: 'Severe' },
	'05': { event: 'Flood Advisory', severity: 'Moderate' },
	'32': { event: 'Heavy Snow Warning', severity: 'Severe' },
	'02': { event: 'Heavy Snow Advisory', severity: 'Moderate' },
	'36': { event: 'Storm Warning', severity: 'Severe' },
	'06': { event: 'Wind Advisory', severity: 'Moderate' },
	'37': { event: 'Storm Surge Warning', severity: 'Severe' },
	'07': { event: 'Storm Surge Advisory', severity: 'Moderate' },
	'10': { event: 'Thunderstorm Advisory', severity: 'Moderate' },
	'04': { event: 'Dense Fog Advisory', severity: 'Minor' },
	'50': { event: 'Tornado Warning', severity: 'Extreme' },
	'60': { event: 'Tsunami Warning', severity: 'Extreme' },
	'70': { event: 'Earthquake Warning', severity: 'Extreme' }
};

/**
 * Fetch alerts from Japan Meteorological Agency
 */
export async function fetchJMAAlerts(): Promise<InternationalAlert[]> {
	try {
		// JMA provides a warning status JSON
		const response = await fetch(`${JMA_API}/warning/data/warning/map.json`, {
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			logger.warn('Weather', `JMA API returned ${response.status}`);
			return [];
		}

		const data = await response.json();
		return parseJMAData(data);
	} catch (error) {
		logger.warn('Weather', 'Failed to fetch JMA alerts:', error);
		return [];
	}
}

/**
 * Parse JMA warning data
 */
function parseJMAData(data: unknown): InternationalAlert[] {
	const alerts: InternationalAlert[] = [];
	
	try {
		if (typeof data !== 'object' || data === null) return alerts;
		
		// JMA data structure: { prefectures: { [code]: { warnings: [...] } } }
		const prefectures = (data as Record<string, unknown>);
		
		for (const [prefCode, prefData] of Object.entries(prefectures)) {
			if (typeof prefData !== 'object' || prefData === null) continue;
			
			const warnings = (prefData as Record<string, unknown>).warnings;
			if (!Array.isArray(warnings)) continue;
			
			for (const warning of warnings) {
				if (typeof warning !== 'object' || warning === null) continue;
				
				const code = String((warning as Record<string, unknown>).code || '');
				const warningInfo = JMA_WARNING_TYPES[code];
				if (!warningInfo) continue;
				
				const prefName = JMA_PREFECTURES[prefCode] || `Prefecture ${prefCode}`;
				
				const alert: InternationalAlert = {
					id: `jma-${prefCode}-${code}-${Date.now()}`,
					source: 'JMA',
					country: 'Japan',
					countryCode: 'JP',
					areaDesc: prefName,
					geocode: { SAME: [], UGC: [] },
					affectedZones: [],
					references: [],
					sent: new Date().toISOString(),
					effective: new Date().toISOString(),
					onset: null,
					expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
					ends: null,
					status: 'Actual',
					messageType: 'Alert',
					category: 'Met',
					severity: warningInfo.severity,
					certainty: 'Observed',
					urgency: 'Immediate',
					event: warningInfo.event,
					sender: 'JMA',
					senderName: 'Japan Meteorological Agency',
					headline: `${warningInfo.event} for ${prefName}`,
					description: `${warningInfo.event} has been issued for ${prefName}, Japan.`,
					instruction: 'Follow local authority guidance.',
					response: 'Monitor',
					parameters: {},
					geometry: null
				};
				
				alerts.push(alert);
			}
		}
	} catch (error) {
		logger.warn('Weather', 'Failed to parse JMA data:', error);
	}
	
	return alerts;
}

// ============================================================================
// Australia Bureau of Meteorology
// ============================================================================

/**
 * Fetch alerts from Australia Bureau of Meteorology
 */
export async function fetchBOMAlerts(): Promise<InternationalAlert[]> {
	try {
		// BOM provides CAP-XML warnings
		const response = await fetch(BOM_CAP_URL, {
			signal: AbortSignal.timeout(15000),
			headers: { 'Accept': 'application/xml' }
		});

		if (!response.ok) {
			logger.warn('Weather', `BOM API returned ${response.status}`);
			return [];
		}

		const xmlText = await response.text();
		return parseBOMCAP(xmlText);
	} catch (error) {
		logger.warn('Weather', 'Failed to fetch BOM alerts:', error);
		return [];
	}
}

/**
 * Parse BOM CAP-XML
 */
function parseBOMCAP(xmlText: string): InternationalAlert[] {
	const alerts: InternationalAlert[] = [];
	
	try {
		if (typeof DOMParser !== 'undefined') {
			const parser = new DOMParser();
			const doc = parser.parseFromString(xmlText, 'application/xml');
			const alertElements = doc.querySelectorAll('alert');
			
			for (const alertEl of alertElements) {
				const identifier = alertEl.querySelector('identifier')?.textContent || '';
				const sent = alertEl.querySelector('sent')?.textContent || '';
				const info = alertEl.querySelector('info');
				
				if (!info) continue;
				
				const event = info.querySelector('event')?.textContent || 'Weather Alert';
				const severity = info.querySelector('severity')?.textContent || 'Unknown';
				const headline = info.querySelector('headline')?.textContent || '';
				const description = info.querySelector('description')?.textContent || '';
				const expires = info.querySelector('expires')?.textContent || '';
				const areaDesc = info.querySelector('area areaDesc')?.textContent || 'Australia';
				
				const alert: InternationalAlert = {
					id: identifier || `bom-${Date.now()}`,
					source: 'BOM',
					country: 'Australia',
					countryCode: 'AU',
					areaDesc,
					geocode: { SAME: [], UGC: [] },
					affectedZones: [],
					references: [],
					sent: sent || new Date().toISOString(),
					effective: sent || new Date().toISOString(),
					onset: null,
					expires: expires || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
					ends: null,
					status: 'Actual',
					messageType: 'Alert',
					category: 'Met',
					severity: SEVERITY_MAP[severity] || 'Unknown',
					certainty: 'Likely',
					urgency: 'Expected',
					event,
					sender: 'BOM',
					senderName: 'Australian Bureau of Meteorology',
					headline,
					description,
					instruction: null,
					response: 'Monitor',
					parameters: {},
					geometry: null
				};
				
				alerts.push(alert);
			}
		}
	} catch (error) {
		logger.warn('Weather', 'Failed to parse BOM CAP:', error);
	}
	
	return alerts;
}

// ============================================================================
// Aggregation
// ============================================================================

/**
 * Get severity color for international alerts
 */
export function getInternationalAlertColor(severity: AlertSeverity): string {
	switch (severity) {
		case 'Extreme': return '#d946ef'; // Fuchsia
		case 'Severe': return '#ef4444'; // Red
		case 'Moderate': return '#f59e0b'; // Amber
		case 'Minor': return '#eab308'; // Yellow
		default: return '#64748b'; // Slate
	}
}

/**
 * Get flag emoji for country code
 */
export function getCountryFlag(countryCode: string): string {
	// Convert country code to flag emoji
	const codePoints = countryCode
		.toUpperCase()
		.split('')
		.map(char => 127397 + char.charCodeAt(0));
	return String.fromCodePoint(...codePoints);
}

/**
 * Combined fetch for all available international alerts
 * Returns merged and deduplicated alerts from all sources
 */
export async function fetchAllInternationalAlerts(options?: {
	canada?: boolean | string[];
	europe?: boolean | string[];
	japan?: boolean;
	australia?: boolean;
}): Promise<InternationalAlert[]> {
	const opts = {
		canada: true,
		europe: true,
		japan: true,
		australia: true,
		...options
	};
	
	const promises: Promise<InternationalAlert[]>[] = [];
	
	if (opts.canada) {
		const provinces = Array.isArray(opts.canada) ? opts.canada : undefined;
		promises.push(fetchCanadaAlerts(provinces));
	}
	
	if (opts.europe) {
		const countries = Array.isArray(opts.europe) ? opts.europe : undefined;
		promises.push(fetchMeteoAlarmAlerts(countries));
	}
	
	if (opts.japan) {
		promises.push(fetchJMAAlerts());
	}
	
	if (opts.australia) {
		promises.push(fetchBOMAlerts());
	}
	
	const results = await Promise.allSettled(promises);

	const allAlerts: InternationalAlert[] = [];
	const seenIds = new Set<string>();

	for (const result of results) {
		if (result.status === 'fulfilled') {
			for (const alert of result.value) {
				if (!seenIds.has(alert.id)) {
					seenIds.add(alert.id);
					allAlerts.push(alert);
				}
			}
		}
	}

	// Sort by severity (Extreme first)
	const severityOrder: Record<AlertSeverity, number> = {
		'Extreme': 0,
		'Severe': 1,
		'Moderate': 2,
		'Minor': 3,
		'Unknown': 4
	};

	return allAlerts.sort((a, b) => 
		(severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
	);
}

/**
 * Get stats about international alerts
 */
export function getInternationalAlertStats(alerts: InternationalAlert[]): {
	total: number;
	bySource: Record<string, number>;
	byCountry: Record<string, number>;
	bySeverity: Record<AlertSeverity, number>;
} {
	const stats = {
		total: alerts.length,
		bySource: {} as Record<string, number>,
		byCountry: {} as Record<string, number>,
		bySeverity: {
			Extreme: 0,
			Severe: 0,
			Moderate: 0,
			Minor: 0,
			Unknown: 0
		} as Record<AlertSeverity, number>
	};
	
	for (const alert of alerts) {
		stats.bySource[alert.source] = (stats.bySource[alert.source] || 0) + 1;
		stats.byCountry[alert.countryCode] = (stats.byCountry[alert.countryCode] || 0) + 1;
		stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
	}
	
	return stats;
}
