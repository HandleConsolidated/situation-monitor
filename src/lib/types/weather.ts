// Weather Command Center types for NWS alerts and forecast integration

/**
 * NWS Alert severity levels
 */
export type AlertSeverity = 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';

export type AlertUrgency = 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';

export type AlertCertainty = 'Observed' | 'Likely' | 'Possible' | 'Unlikely' | 'Unknown';

export type AlertCategory =
	| 'Met'
	| 'Geo'
	| 'Safety'
	| 'Security'
	| 'Rescue'
	| 'Fire'
	| 'Health'
	| 'Env'
	| 'Transport'
	| 'Infra'
	| 'CBRNE'
	| 'Other';

/**
 * NWS Weather Alert from the CAP (Common Alerting Protocol) format
 */
export interface WeatherAlert {
	id: string;
	areaDesc: string;
	geocode: {
		SAME: string[];
		UGC: string[];
	};
	affectedZones: string[];
	references: Array<{
		id: string;
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
	category: AlertCategory;
	severity: AlertSeverity;
	certainty: AlertCertainty;
	urgency: AlertUrgency;
	event: string;
	sender: string;
	senderName: string;
	headline: string | null;
	description: string;
	instruction: string | null;
	response:
		| 'Shelter'
		| 'Evacuate'
		| 'Prepare'
		| 'Execute'
		| 'Avoid'
		| 'Monitor'
		| 'Assess'
		| 'AllClear'
		| 'None';
	parameters: Record<string, string[]>;
	geometry: GeoJSON.Geometry | null;
}

/**
 * NWS Forecast period (typically 12-hour segments)
 */
export interface ForecastPeriod {
	number: number;
	name: string;
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
 * User-defined weather monitoring zone
 */
export interface WeatherZone {
	id: string;
	name: string;
	type: 'state' | 'county' | 'zone' | 'point';
	code?: string;
	lat?: number;
	lon?: number;
	enabled: boolean;
	createdAt: number;
}

/**
 * Summarized forecast highlight for a location
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
		type: string | null;
		accumulation: string | null;
	};
	wind: {
		speed: string;
		gusts: string | null;
	};
	timing: string;
	severity: 'extreme' | 'high' | 'moderate' | 'low';
}

/**
 * Generated weather briefing document
 */
export interface WeatherBriefing {
	id: string;
	generatedAt: number;
	zones: string[];
	alerts: WeatherAlert[];
	forecasts: ForecastHighlight[];
	format: 'text' | 'markdown' | 'json';
	content: string;
}

/**
 * Weather command center application state
 */
export interface WeatherState {
	alerts: WeatherAlert[];
	alertsLoading: boolean;
	alertsError: string | null;
	alertsLastUpdated: number | null;
	zones: WeatherZone[];
	forecasts: ForecastHighlight[];
	forecastsLoading: boolean;
	forecastsError: string | null;
	briefings: WeatherBriefing[];
	selectedAlertId: string | null;
	commandModalOpen: boolean;
	initialized: boolean;
}
