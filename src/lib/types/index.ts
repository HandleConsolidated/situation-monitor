// Core data types for Situation Monitor

/**
 * News feed category
 */
export type NewsCategory = 'politics' | 'tech' | 'finance' | 'gov' | 'ai' | 'intel';

/**
 * A news item from any source (RSS, GDELT, etc.)
 */
export interface NewsItem {
	id: string;
	title: string;
	link: string;
	pubDate?: string;
	timestamp: number;
	description?: string;
	content?: string;
	source: string;
	category: NewsCategory;
	isAlert?: boolean;
	alertKeyword?: string;
	region?: string;
	topics?: string[];
	isNew?: boolean; // Flag for newly-fetched items (not in previous refresh)
	fetchedAt?: number; // When this item was fetched from API
}

/**
 * RSS feed configuration
 */
export interface FeedConfig {
	name: string;
	url: string;
	category: NewsCategory;
}

/**
 * Market data for stocks/crypto
 */
export interface MarketItem {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
	type?: 'stock' | 'crypto' | 'commodity' | 'index';
}

/**
 * Sector performance data (ETFs like XLK, XLF, etc.)
 */
export interface SectorPerformance {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
}

/**
 * Cryptocurrency data from CoinGecko
 */
export interface CryptoItem {
	id: string;
	symbol: string;
	name: string;
	current_price: number;
	price_change_24h: number;
	price_change_percentage_24h: number;
	market_cap?: number;
	volume_24h?: number;
}

/**
 * Sector heatmap data
 */
export interface SectorData {
	symbol: string;
	name: string;
	change: number;
	color: string;
}

/**
 * Commodity data
 */
export interface CommodityData {
	name: string;
	price: number;
	change: number;
	unit: string;
}

/**
 * Federal Reserve balance sheet data
 */
export interface FedBalanceData {
	value: number;
	change: number;
	changePercent: number;
	percentOfMax: number;
}

/**
 * Earthquake data from USGS
 */
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

/**
 * Polymarket prediction data
 */
export interface PredictionData {
	id: string;
	title: string;
	probability: number;
	volume: number;
	url: string;
}

/**
 * Whale transaction data
 */
export interface WhaleTransaction {
	coin: string;
	amount: number;
	usd: number;
	hash: string;
	direction: 'buy' | 'sell' | 'transfer';
	timestamp?: number;
}

/**
 * Government contract data
 */
export interface GovContract {
	id: string;
	title: string;
	agency: string;
	value: number;
	vendor: string;
	date: string;
	url: string;
}

/**
 * Layoff announcement data
 */
export interface LayoffData {
	company: string;
	count: number;
	percentage?: number;
	date: string;
	source: string;
	url: string;
}

/**
 * Map hotspot configuration
 */
export interface Hotspot {
	id: string;
	name: string;
	location: string;
	lat: number;
	lon: number;
	level: 'low' | 'medium' | 'high' | 'critical';
	category: string;
	description?: string;
	keywords?: string[];
}

/**
 * Custom monitor created by user
 */
export interface CustomMonitor {
	id: string;
	name: string;
	keywords: string[];
	enabled: boolean;
	color?: string;
	location?: {
		name: string;
		lat: number;
		lon: number;
	};
	createdAt: number;
	updatedAt?: number;
	matchCount: number;
}

/**
 * Panel configuration
 */
export interface PanelConfig {
	id: string;
	title: string;
	category: string;
	enabled: boolean;
	order: number;
}

/**
 * Correlation analysis result
 */
export interface CorrelationResult {
	topic: string;
	count: number;
	sources: string[];
	momentum: 'rising' | 'stable' | 'falling';
	sentiment?: 'positive' | 'neutral' | 'negative';
}

/**
 * Narrative tracking result
 */
export interface NarrativeResult {
	narrative: string;
	mentions: number;
	firstSeen: number;
	lastSeen: number;
	trend: 'emerging' | 'established' | 'fading';
	relatedTopics: string[];
}

/**
 * Main character ranking result
 */
export interface MainCharacterResult {
	name: string;
	mentions: number;
	sources: string[];
	sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

/**
 * Service client configuration
 */
export interface ServiceConfig {
	name: string;
	baseUrl: string;
	timeout: number;
	retries: number;
	cacheTtl: number;
	circuitBreaker: {
		failureThreshold: number;
		resetTimeout: number;
	};
}

/**
 * Cache entry
 */
export interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
	data: T;
	status: 'ok' | 'error';
	error?: string;
	cached?: boolean;
	timestamp: number;
}

/**
 * Refresh state
 */
export interface RefreshState {
	isRefreshing: boolean;
	stage: 0 | 1 | 2 | 3;
	lastUpdated: Date | null;
	error: string | null;
}

/**
 * Settings state
 */
export interface SettingsState {
	panels: Record<string, boolean>;
	panelOrder: string[];
	theme: 'dark' | 'light';
}

/**
 * News item for a world leader
 */
export interface LeaderNews {
	source: string;
	title: string;
	link: string;
	pubDate: string;
}

/**
 * World leader tracking data
 */
export interface WorldLeader {
	id: string;
	name: string;
	title: string;
	country: string;
	flag: string;
	keywords: string[];
	since: string;
	party: string;
	focus?: string[];
	news?: LeaderNews[];
}

/**
 * Aircraft position data from ADS-B (OpenSky Network)
 */
export interface Aircraft {
	icao24: string; // ICAO24 transponder address (hex)
	callsign: string | null; // Callsign (8 chars max)
	originCountry: string; // Country of registration
	timePosition: number | null; // Unix timestamp of last position update
	lastContact: number; // Unix timestamp of last contact
	longitude: number | null; // WGS-84 longitude
	latitude: number | null; // WGS-84 latitude
	baroAltitude: number | null; // Barometric altitude in meters
	onGround: boolean; // Whether aircraft is on ground
	velocity: number | null; // Ground speed in m/s
	trueTrack: number | null; // True track (heading) in degrees clockwise from north
	verticalRate: number | null; // Vertical rate in m/s
	geoAltitude: number | null; // Geometric altitude in meters
	squawk: string | null; // Transponder squawk code
}

/**
 * Radiation reading from Safecast API
 */
export type RadiationLevel = 'normal' | 'elevated' | 'high' | 'dangerous';

export interface RadiationReading {
	id: string;
	lat: number;
	lon: number;
	value: number; // CPM (counts per minute) or uSv/h
	unit: 'cpm' | 'usv';
	capturedAt: string;
	deviceId?: string;
	location?: string;
	level: RadiationLevel;
}

/**
 * Vessel/ship tracking data from AIS
 */
export interface Vessel {
	mmsi: string; // Maritime Mobile Service Identity (unique ship identifier)
	name?: string; // Ship name (may not always be available)
	imo?: string; // IMO number
	lat: number;
	lon: number;
	course: number; // Course over ground (degrees, 0-360)
	speed: number; // Speed over ground (knots)
	heading?: number; // True heading (degrees, 0-360)
	shipType?: number; // AIS ship type code
	shipTypeName?: string; // Human-readable ship type
	flag?: string; // Country flag code (ISO 3166-1)
	destination?: string; // Reported destination
	eta?: string; // Estimated time of arrival
	draught?: number; // Ship draught in meters
	length?: number; // Ship length in meters
	width?: number; // Ship width in meters
	callsign?: string; // Radio callsign
	lastUpdate: number; // Timestamp of position update
}

/**
 * USGS Volcano alert levels
 * NORMAL: Normal background activity (GREEN)
 * ADVISORY: Elevated unrest above known background levels (YELLOW)
 * WATCH: Heightened or escalating unrest with increased potential for eruption (ORANGE)
 * WARNING: Hazardous eruption imminent or underway (RED)
 */
export type VolcanoAlertLevel = 'NORMAL' | 'ADVISORY' | 'WATCH' | 'WARNING';

/**
 * USGS Volcano color codes
 */
export type VolcanoColorCode = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

/**
 * USGS Volcano data from the Volcano Hazards Program API
 */
export interface VolcanoData {
	id: string;
	name: string;
	lat: number;
	lon: number;
	elevation: number; // meters
	country: string;
	region?: string;
	alertLevel: VolcanoAlertLevel;
	colorCode: VolcanoColorCode;
	lastUpdate?: string;
	notice?: string;
	description?: string;
}

/**
 * Disease outbreak severity levels
 */
export type DiseaseOutbreakSeverity = 'low' | 'moderate' | 'high' | 'critical';

/**
 * Disease outbreak status
 */
export type DiseaseOutbreakStatus = 'active' | 'contained' | 'monitoring';

/**
 * Disease outbreak data from WHO, ReliefWeb, or other public health sources
 */
export interface DiseaseOutbreak {
	id: string;
	disease: string;
	country: string;
	region?: string;
	lat: number;
	lon: number;
	cases?: number;
	deaths?: number;
	status: DiseaseOutbreakStatus;
	severity: DiseaseOutbreakSeverity;
	startDate: string;
	lastUpdate: string;
	source: string;
	url?: string;
}

/**
 * Air Quality Index level based on PM2.5 concentration
 * US EPA AQI breakpoints:
 * Good: 0-12 ug/m3
 * Moderate: 12.1-35.4 ug/m3
 * Unhealthy for Sensitive Groups: 35.5-55.4 ug/m3
 * Unhealthy: 55.5-150.4 ug/m3
 * Very Unhealthy: 150.5-250.4 ug/m3
 * Hazardous: 250.5+ ug/m3
 */
export type AirQualityLevel =
	| 'good'
	| 'moderate'
	| 'unhealthy_sensitive'
	| 'unhealthy'
	| 'very_unhealthy'
	| 'hazardous';

/**
 * Air quality reading from OpenAQ API
 */
export interface AirQualityReading {
	id: string;
	locationId: number;
	location: string;
	city?: string;
	country: string;
	lat: number;
	lon: number;
	parameter: string; // pm25, pm10, no2, o3, so2, co
	value: number;
	unit: string;
	lastUpdated: string;
	aqi?: number; // Calculated AQI if PM2.5
	level: AirQualityLevel;
}

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
