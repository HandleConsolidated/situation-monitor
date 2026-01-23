// Weather Command Center configuration

/**
 * US State abbreviations and names for NWS zone selection
 */
export interface USState {
	code: string;
	name: string;
}

export const US_STATES: USState[] = [
	{ code: 'AL', name: 'Alabama' },
	{ code: 'AK', name: 'Alaska' },
	{ code: 'AZ', name: 'Arizona' },
	{ code: 'AR', name: 'Arkansas' },
	{ code: 'CA', name: 'California' },
	{ code: 'CO', name: 'Colorado' },
	{ code: 'CT', name: 'Connecticut' },
	{ code: 'DE', name: 'Delaware' },
	{ code: 'DC', name: 'District of Columbia' },
	{ code: 'FL', name: 'Florida' },
	{ code: 'GA', name: 'Georgia' },
	{ code: 'HI', name: 'Hawaii' },
	{ code: 'ID', name: 'Idaho' },
	{ code: 'IL', name: 'Illinois' },
	{ code: 'IN', name: 'Indiana' },
	{ code: 'IA', name: 'Iowa' },
	{ code: 'KS', name: 'Kansas' },
	{ code: 'KY', name: 'Kentucky' },
	{ code: 'LA', name: 'Louisiana' },
	{ code: 'ME', name: 'Maine' },
	{ code: 'MD', name: 'Maryland' },
	{ code: 'MA', name: 'Massachusetts' },
	{ code: 'MI', name: 'Michigan' },
	{ code: 'MN', name: 'Minnesota' },
	{ code: 'MS', name: 'Mississippi' },
	{ code: 'MO', name: 'Missouri' },
	{ code: 'MT', name: 'Montana' },
	{ code: 'NE', name: 'Nebraska' },
	{ code: 'NV', name: 'Nevada' },
	{ code: 'NH', name: 'New Hampshire' },
	{ code: 'NJ', name: 'New Jersey' },
	{ code: 'NM', name: 'New Mexico' },
	{ code: 'NY', name: 'New York' },
	{ code: 'NC', name: 'North Carolina' },
	{ code: 'ND', name: 'North Dakota' },
	{ code: 'OH', name: 'Ohio' },
	{ code: 'OK', name: 'Oklahoma' },
	{ code: 'OR', name: 'Oregon' },
	{ code: 'PA', name: 'Pennsylvania' },
	{ code: 'RI', name: 'Rhode Island' },
	{ code: 'SC', name: 'South Carolina' },
	{ code: 'SD', name: 'South Dakota' },
	{ code: 'TN', name: 'Tennessee' },
	{ code: 'TX', name: 'Texas' },
	{ code: 'UT', name: 'Utah' },
	{ code: 'VT', name: 'Vermont' },
	{ code: 'VA', name: 'Virginia' },
	{ code: 'WA', name: 'Washington' },
	{ code: 'WV', name: 'West Virginia' },
	{ code: 'WI', name: 'Wisconsin' },
	{ code: 'WY', name: 'Wyoming' },
	// US Territories
	{ code: 'AS', name: 'American Samoa' },
	{ code: 'GU', name: 'Guam' },
	{ code: 'MP', name: 'Northern Mariana Islands' },
	{ code: 'PR', name: 'Puerto Rico' },
	{ code: 'VI', name: 'U.S. Virgin Islands' }
];

/**
 * Predefined regional groupings for quick zone selection
 */
export interface PredefinedRegion {
	id: string;
	name: string;
	description: string;
	states: string[];
}

export const PREDEFINED_REGIONS: PredefinedRegion[] = [
	{
		id: 'central_us',
		name: 'Central US',
		description: 'Tornado Alley and surrounding states',
		states: ['TX', 'OK', 'KS', 'NE', 'SD', 'ND', 'MN', 'IA', 'MO', 'AR', 'LA']
	},
	{
		id: 'midwest',
		name: 'Midwest',
		description: 'Great Lakes and corn belt region',
		states: ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO']
	},
	{
		id: 'northeast',
		name: 'Northeast',
		description: 'New England and Mid-Atlantic states',
		states: ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC']
	},
	{
		id: 'southeast',
		name: 'Southeast',
		description: 'Atlantic coast and Gulf states',
		states: ['VA', 'NC', 'SC', 'GA', 'FL', 'AL', 'MS', 'TN', 'KY', 'WV']
	},
	{
		id: 'west_coast',
		name: 'West Coast',
		description: 'Pacific coast states',
		states: ['WA', 'OR', 'CA']
	},
	{
		id: 'mountain',
		name: 'Mountain West',
		description: 'Rocky Mountain region',
		states: ['MT', 'ID', 'WY', 'NV', 'UT', 'CO', 'AZ', 'NM']
	}
];

/**
 * Alert severity color mapping for UI display
 */
export const ALERT_SEVERITY_COLORS = {
	Extreme: {
		bg: 'bg-fuchsia-950/50',
		border: 'border-fuchsia-500/50',
		text: 'text-fuchsia-400',
		hex: '#d946ef'
	},
	Severe: {
		bg: 'bg-red-950/50',
		border: 'border-red-500/50',
		text: 'text-red-400',
		hex: '#ef4444'
	},
	Moderate: {
		bg: 'bg-amber-950/50',
		border: 'border-amber-500/50',
		text: 'text-amber-400',
		hex: '#f59e0b'
	},
	Minor: {
		bg: 'bg-yellow-950/50',
		border: 'border-yellow-500/50',
		text: 'text-yellow-400',
		hex: '#eab308'
	},
	Unknown: {
		bg: 'bg-slate-800/50',
		border: 'border-slate-500/50',
		text: 'text-slate-400',
		hex: '#64748b'
	}
} as const;

/**
 * Winter weather event types for filtering/categorization
 */
export const WINTER_WEATHER_EVENTS = [
	'Blizzard Warning',
	'Blizzard Watch',
	'Winter Storm Warning',
	'Winter Storm Watch',
	'Winter Weather Advisory',
	'Ice Storm Warning',
	'Freezing Rain Advisory',
	'Freeze Warning',
	'Freeze Watch',
	'Frost Advisory',
	'Wind Chill Warning',
	'Wind Chill Watch',
	'Wind Chill Advisory',
	'Heavy Snow Warning',
	'Lake Effect Snow Warning',
	'Lake Effect Snow Watch',
	'Lake Effect Snow Advisory'
] as const;

/**
 * Severe weather event types for filtering/categorization
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
	'Flood Advisory',
	'Hurricane Warning',
	'Hurricane Watch',
	'Tropical Storm Warning',
	'Tropical Storm Watch',
	'Storm Surge Warning',
	'Storm Surge Watch',
	'Extreme Wind Warning',
	'High Wind Warning',
	'High Wind Watch',
	'Wind Advisory',
	'Dust Storm Warning',
	'Excessive Heat Warning',
	'Excessive Heat Watch',
	'Heat Advisory',
	'Fire Weather Watch',
	'Red Flag Warning'
] as const;

/**
 * NWS API configuration
 */
export const NWS_API = {
	baseUrl: 'https://api.weather.gov',
	userAgent: 'AegisSituationMonitor/1.0 (situation-monitor@github.io)',
	endpoints: {
		alerts: '/alerts',
		alertsActive: '/alerts/active',
		alertsArea: '/alerts/active/area',
		zones: '/zones',
		points: '/points',
		gridpoints: '/gridpoints',
		stations: '/stations'
	},
	// Rate limiting: NWS allows reasonable use, no strict limits documented
	// But we should be good citizens and cache appropriately
	cacheTtl: 60000, // 1 minute cache for alerts
	forecastCacheTtl: 300000, // 5 minutes for forecasts
	maxRetries: 3,
	retryDelay: 1000
} as const;

/**
 * Map colors for alert polygons on the globe
 * Using similar pattern to THREAT_COLORS from map.ts
 */
export const ALERT_MAP_COLORS = {
	// Extreme - Magenta/Fuchsia for maximum visibility
	Extreme: {
		fill: 'rgba(217, 70, 239, 0.3)',
		stroke: '#d946ef',
		strokeWidth: 2
	},
	// Severe - Red
	Severe: {
		fill: 'rgba(239, 68, 68, 0.25)',
		stroke: '#ef4444',
		strokeWidth: 2
	},
	// Moderate - Amber/Orange
	Moderate: {
		fill: 'rgba(245, 158, 11, 0.2)',
		stroke: '#f59e0b',
		strokeWidth: 1.5
	},
	// Minor - Yellow
	Minor: {
		fill: 'rgba(234, 179, 8, 0.15)',
		stroke: '#eab308',
		strokeWidth: 1
	},
	// Unknown - Gray
	Unknown: {
		fill: 'rgba(100, 116, 139, 0.1)',
		stroke: '#64748b',
		strokeWidth: 1
	}
} as const;

/**
 * Event type to icon mapping for weather alerts
 */
export const WEATHER_EVENT_ICONS: Record<string, string> = {
	// Tornado
	'Tornado Warning': 'tornado',
	'Tornado Watch': 'tornado',
	// Thunderstorm
	'Severe Thunderstorm Warning': 'thunderstorm',
	'Severe Thunderstorm Watch': 'thunderstorm',
	// Flood
	'Flash Flood Warning': 'flood',
	'Flash Flood Watch': 'flood',
	'Flood Warning': 'flood',
	'Flood Watch': 'flood',
	'Flood Advisory': 'flood',
	// Hurricane/Tropical
	'Hurricane Warning': 'hurricane',
	'Hurricane Watch': 'hurricane',
	'Tropical Storm Warning': 'tropical',
	'Tropical Storm Watch': 'tropical',
	// Winter
	'Blizzard Warning': 'blizzard',
	'Blizzard Watch': 'blizzard',
	'Winter Storm Warning': 'winter',
	'Winter Storm Watch': 'winter',
	'Winter Weather Advisory': 'winter',
	'Ice Storm Warning': 'ice',
	// Heat
	'Excessive Heat Warning': 'heat',
	'Excessive Heat Watch': 'heat',
	'Heat Advisory': 'heat',
	// Fire
	'Red Flag Warning': 'fire',
	'Fire Weather Watch': 'fire',
	// Wind
	'High Wind Warning': 'wind',
	'High Wind Watch': 'wind',
	'Wind Advisory': 'wind',
	'Extreme Wind Warning': 'wind'
};

/**
 * Default export for weather module config
 */
export type WeatherConfig = typeof NWS_API;
