/**
 * Supabase API Functions
 *
 * All fetch functions for retrieving cached data from Supabase.
 * These functions map Supabase database columns back to the expected TypeScript interfaces.
 */

import { supabase, isSupabaseEnabled } from '$lib/supabase';
import type {
	CryptoItem,
	MarketItem,
	SectorPerformance,
	NewsItem,
	NewsCategory,
	EarthquakeData,
	GovContract,
	LayoffData,
	WorldLeader,
	LeaderNews,
	WeatherAlert,
	DiseaseOutbreak,
	RadiationReading
} from '$lib/types';
import type { TropicalCyclone, ConvectiveOutlook } from '$lib/types/storms';
import type {
	Prediction,
	WhaleTransaction,
	OutageData,
	GridStressData,
	FedBalanceData
} from './misc';

// =============================================================================
// Types for Supabase responses (database schema)
// =============================================================================

interface SupabaseCryptoRow {
	id: string;
	symbol: string;
	name: string;
	current_price: number;
	price_change_24h: number;
	price_change_percentage_24h: number;
	market_cap?: number;
	volume_24h?: number;
	fetched_at: string;
}

interface SupabaseIndexRow {
	symbol: string;
	name: string;
	price: number;
	change: number;
	change_percent: number;
	fetched_at: string;
}

interface SupabaseSectorRow {
	symbol: string;
	name: string;
	price: number;
	change: number;
	change_percent: number;
	fetched_at: string;
}

interface SupabaseCommodityRow {
	symbol: string;
	name: string;
	price: number;
	change: number;
	change_percent: number;
	fetched_at: string;
}

interface SupabaseNewsRow {
	id: string;
	title: string;
	link: string;
	pub_date?: string;
	timestamp: number;
	description?: string;
	content?: string;
	source: string;
	category: string;
	is_alert?: boolean;
	alert_keyword?: string;
	region?: string;
	topics?: string[];
	fetched_at: string;
}

interface SupabasePolymarketRow {
	id: string;
	question: string;
	yes: number;
	volume: string;
	volume_num: number;
	category: string;
	uncertainty: number;
	fetched_at: string;
}

interface SupabaseWhaleRow {
	coin: string;
	amount: number;
	usd: number;
	hash: string;
	direction: string;
	timestamp?: number;
	fetched_at: string;
}

interface SupabaseWeatherAlertRow {
	id: string;
	area_desc: string;
	geocode: {
		SAME: string[];
		UGC: string[];
	};
	affected_zones: string[];
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
	status: string;
	message_type: string;
	category: string;
	severity: string;
	certainty: string;
	urgency: string;
	event: string;
	sender: string;
	sender_name: string;
	headline: string | null;
	description: string;
	instruction: string | null;
	response: string;
	parameters: Record<string, string[]>;
	geometry: GeoJSON.Geometry | null;
	fetched_at: string;
}

interface SupabaseEarthquakeRow {
	id: string;
	magnitude: number;
	place: string;
	time: number;
	lat: number;
	lon: number;
	depth: number;
	url: string;
	fetched_at: string;
}

interface SupabaseGridStressRow {
	id: string;
	region: string;
	country: string;
	country_code: string;
	lat: number;
	lon: number;
	moer: number;
	frequency: number;
	percent: number;
	signal_type: string;
	stress_level: string;
	description: string;
	timestamp: string;
	boundary_coords?: [number, number][][];
	area_km2?: number;
	fetched_at: string;
}

interface SupabaseOutageRow {
	id: string;
	country: string;
	country_code: string;
	type: string;
	severity: string;
	lat: number;
	lon: number;
	description: string;
	affected_population?: number;
	start_time?: string;
	source: string;
	active: boolean;
	radius_km?: number;
	boundary_coords?: [number, number][][];
	area_km2?: number;
	grid_stress_percent?: number;
	grid_stress_level?: string;
	fetched_at: string;
}

interface SupabaseRadiationRow {
	id: string;
	lat: number;
	lon: number;
	value: number;
	unit: string;
	captured_at: string;
	device_id?: string;
	location?: string;
	level: string;
	fetched_at: string;
}

interface SupabaseDiseaseOutbreakRow {
	id: string;
	disease: string;
	country: string;
	region?: string;
	lat: number;
	lon: number;
	cases?: number;
	deaths?: number;
	status: string;
	severity: string;
	start_date: string;
	last_update: string;
	source: string;
	url?: string;
	fetched_at: string;
}

interface SupabaseGovContractRow {
	id: string;
	title: string;
	agency: string;
	value: number;
	vendor: string;
	date: string;
	url: string;
	fetched_at: string;
}

interface SupabaseLayoffRow {
	company: string;
	count: number;
	percentage?: number;
	date: string;
	source: string;
	url: string;
	fetched_at: string;
}

interface SupabaseWorldLeaderRow {
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
	fetched_at: string;
}

interface SupabaseFedBalanceRow {
	value: number;
	change: number;
	change_percent: number;
	percent_of_max: number;
	fetched_at: string;
}

interface SupabaseTropicalCycloneRow {
	id: string;
	name: string;
	basin: string;
	storm_number: number;
	current_position: {
		lat: number;
		lon: number;
		validTime: string;
	};
	current_intensity: {
		maxWind: number;
		gusts: number | null;
		pressure: number | null;
		category: string;
		movement: {
			direction: string;
			speed: number;
		};
	};
	forecast_track: Array<{
		lat: number;
		lon: number;
		forecastHour: number;
		maxWind: number;
		gusts: number | null;
		category: string;
		pressure: number | null;
		validTime: string;
	}>;
	forecast_cone: GeoJSON.Geometry | null;
	wind_radii: {
		'34kt': GeoJSON.Geometry | null;
		'50kt': GeoJSON.Geometry | null;
		'64kt': GeoJSON.Geometry | null;
	};
	last_update: string;
	fetched_at: string;
}

interface SupabaseConvectiveOutlookRow {
	day: number;
	type: string;
	risk: string;
	geometry: GeoJSON.Geometry;
	valid_time: string;
	is_significant: boolean;
	fetched_at: string;
}

interface SupabaseConflictRow {
	id: string;
	name: string;
	lat: number;
	lon: number;
	intensity: string;
	fatalities_prediction?: number;
	confidence?: number;
	country_code: string;
	country_name: string;
	region?: string;
	conflict_type?: string;
	fetched_at: string;
}

interface SupabaseSyncStatusRow {
	data_type: string;
	last_sync: string;
	record_count: number;
	status: string;
	error?: string;
}

// =============================================================================
// Helper function to check Supabase availability
// =============================================================================

function ensureSupabase() {
	if (!isSupabaseEnabled() || !supabase) {
		throw new Error('Supabase is not enabled or configured');
	}
	return supabase;
}

// =============================================================================
// Market Data Functions
// =============================================================================

/**
 * Fetch all market data from Supabase
 */
export async function fetchMarketDataFromSupabase(): Promise<{
	crypto: CryptoItem[];
	indices: MarketItem[];
	sectors: SectorPerformance[];
	commodities: MarketItem[];
}> {
	const [crypto, indices, sectors, commodities] = await Promise.all([
		fetchCryptoPricesFromSupabase(),
		fetchIndicesFromSupabase(),
		fetchSectorPerformanceFromSupabase(),
		fetchCommoditiesFromSupabase()
	]);

	return { crypto, indices, sectors, commodities };
}

/**
 * Fetch cryptocurrency prices from Supabase
 */
export async function fetchCryptoPricesFromSupabase(): Promise<CryptoItem[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('market_data')
		.select('*')
		.eq('type', 'crypto')
		.order('updated_at', { ascending: false });

	if (error) {
		console.error('Error fetching crypto prices from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown>;
		return {
			id: d.id as string || row.symbol,
			symbol: row.symbol,
			name: d.name as string || row.symbol,
			current_price: d.current_price as number || 0,
			price_change_24h: d.price_change_24h as number || 0,
			price_change_percentage_24h: d.price_change_percentage_24h as number || 0
		};
	});
}

/**
 * Fetch market indices from Supabase
 */
export async function fetchIndicesFromSupabase(): Promise<MarketItem[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('market_data')
		.select('*')
		.eq('type', 'index');

	if (error) {
		console.error('Error fetching indices from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown>;
		return {
			symbol: row.symbol,
			name: d.name as string || row.symbol,
			price: d.price as number || 0,
			change: d.change as number || 0,
			changePercent: d.changePercent as number || 0,
			type: 'index' as const
		};
	});
}

/**
 * Fetch sector performance from Supabase
 */
export async function fetchSectorPerformanceFromSupabase(): Promise<SectorPerformance[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('market_data')
		.select('*')
		.eq('type', 'sector');

	if (error) {
		console.error('Error fetching sector performance from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown>;
		return {
			symbol: row.symbol,
			name: d.name as string || row.symbol,
			price: d.price as number || 0,
			change: d.change as number || 0,
			changePercent: d.changePercent as number || 0
		};
	});
}

/**
 * Fetch commodities from Supabase
 */
export async function fetchCommoditiesFromSupabase(): Promise<MarketItem[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('market_data')
		.select('*')
		.eq('type', 'commodity');

	if (error) {
		console.error('Error fetching commodities from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown>;
		return {
			symbol: row.symbol,
			name: d.name as string || row.symbol,
			price: d.price as number || 0,
			change: d.change as number || 0,
			changePercent: d.changePercent as number || 0,
			type: 'commodity' as const
		};
	});
}

// =============================================================================
// News Functions
// =============================================================================

/**
 * Fetch news for a specific category from Supabase
 */
export async function fetchNewsFromSupabase(category?: NewsCategory): Promise<NewsItem[]> {
	const client = ensureSupabase();

	let query = client
		.from('news_items')
		.select('*')
		.order('published_at', { ascending: false })
		.limit(50);

	if (category) {
		query = query.eq('category', category);
	}

	const { data, error } = await query;

	if (error) {
		console.error('Error fetching news from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => ({
		id: row.id,
		title: row.title,
		link: row.link,
		pubDate: row.published_at,
		timestamp: new Date(row.published_at || row.created_at).getTime(),
		description: row.summary,
		content: row.summary,
		source: row.source,
		category: row.category as NewsCategory,
		isAlert: false,
		alertKeyword: undefined,
		region: undefined,
		topics: undefined,
		fetchedAt: new Date(row.updated_at).getTime()
	}));
}

/**
 * Fetch all news from Supabase, grouped by category
 */
export async function fetchAllNewsFromSupabase(): Promise<Record<NewsCategory, NewsItem[]>> {
	const allNews = await fetchNewsFromSupabase();

	const result: Record<NewsCategory, NewsItem[]> = {
		politics: [],
		tech: [],
		finance: [],
		gov: [],
		ai: [],
		intel: []
	};

	for (const item of allNews) {
		if (result[item.category]) {
			result[item.category].push(item);
		}
	}

	return result;
}

// =============================================================================
// Polymarket and Whale Transactions
// =============================================================================

/**
 * Fetch Polymarket predictions from Supabase
 */
export async function fetchPolymarketFromSupabase(): Promise<Prediction[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('predictions')
		.select('*')
		.order('volume', { ascending: false })
		.limit(50);

	if (error) {
		console.error('Error fetching Polymarket from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown>;
		return {
			id: row.external_id || row.id,
			question: row.title,
			yes: row.probability || 0.5,
			volume: String(row.volume || 0),
			volumeNum: row.volume || 0,
			category: row.category as Prediction['category'],
			uncertainty: 1 - Math.abs(2 * (row.probability || 0.5) - 1),
			slug: d?.slug as string
		};
	});
}

/**
 * Fetch whale transactions from Supabase
 */
export async function fetchWhaleTransactionsFromSupabase(): Promise<WhaleTransaction[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('whale_transactions')
		.select('*')
		.order('usd_value', { ascending: false })
		.limit(10);

	if (error) {
		console.error('Error fetching whale transactions from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => ({
		coin: row.token,
		amount: row.amount,
		usd: row.usd_value,
		hash: row.tx_hash,
		direction: row.transaction_type as WhaleTransaction['direction'],
		timestamp: row.timestamp ? new Date(row.timestamp).getTime() / 1000 : undefined
	}));
}

// =============================================================================
// Weather Alerts
// =============================================================================

/**
 * Fetch weather alerts from Supabase
 */
export async function fetchWeatherAlertsFromSupabase(): Promise<WeatherAlert[]> {
	const client = ensureSupabase();

	const now = new Date().toISOString();
	const { data, error } = await client
		.from('weather_alerts')
		.select('*')
		.gt('expires', now)
		.order('severity', { ascending: true });

	if (error) {
		console.error('Error fetching weather alerts from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		return {
			id: row.external_id || row.id,
			areaDesc: row.area_desc,
			geocode: d.geocode as { SAME: string[]; UGC: string[] },
			affectedZones: d.affectedZones as string[] || [],
			references: [],
			sent: d.sent as string,
			effective: d.effective as string,
			onset: row.onset,
			expires: row.expires,
			ends: d.ends as string,
			status: d.status as WeatherAlert['status'] || 'Actual',
			messageType: d.messageType as WeatherAlert['messageType'] || 'Alert',
			category: d.category as WeatherAlert['category'] || 'Met',
			severity: row.severity as WeatherAlert['severity'],
			certainty: row.certainty as WeatherAlert['certainty'],
			urgency: row.urgency as WeatherAlert['urgency'],
			event: row.event,
			sender: d.sender as string,
			senderName: d.senderName as string,
			headline: row.headline,
			description: row.description,
			instruction: row.instruction,
			response: d.response as WeatherAlert['response'] || 'Monitor',
			parameters: d.parameters as Record<string, string[]>,
			geometry: row.geometry
		};
	});
}

// =============================================================================
// Natural Events
// =============================================================================

/**
 * Fetch earthquakes from Supabase
 */
export async function fetchEarthquakesFromSupabase(minMagnitude: number = 4.0): Promise<EarthquakeData[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('earthquakes')
		.select('*')
		.gte('magnitude', minMagnitude)
		.order('timestamp', { ascending: false })
		.limit(100);

	if (error) {
		console.error('Error fetching earthquakes from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		return {
			id: row.external_id || row.id,
			magnitude: row.magnitude,
			place: row.place,
			time: new Date(row.timestamp).getTime(),
			lat: row.lat,
			lon: row.lon,
			depth: row.depth,
			url: d.url as string || ''
		};
	});
}

/**
 * Fetch grid stress data from Supabase
 */
export async function fetchGridStressFromSupabase(): Promise<GridStressData[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('grid_stress')
		.select('*')
		.neq('status', 'normal');

	if (error) {
		console.error('Error fetching grid stress from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		return {
			id: row.id,
			region: row.region,
			country: d.country as string || '',
			countryCode: d.countryCode as string || '',
			lat: d.lat as number || 0,
			lon: d.lon as number || 0,
			moer: d.moer as number || row.stress_level,
			frequency: d.frequency as number || 0,
			percent: row.stress_level as number || 0,
			signal_type: d.signal_type as string || 'co2_moer',
			stressLevel: row.status as GridStressData['stressLevel'],
			description: d.description as string || '',
			timestamp: d.timestamp as string || row.updated_at,
			boundaryCoords: d.boundaryCoords as [number, number][][],
			areaKm2: d.areaKm2 as number
		};
	});
}

/**
 * Fetch outage data from Supabase
 */
export async function fetchOutagesFromSupabase(): Promise<OutageData[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('outages')
		.select('*');

	if (error) {
		console.error('Error fetching outages from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		return {
			id: row.external_id || row.id,
			country: row.location,
			countryCode: d.countryCode as string || '',
			type: row.type as OutageData['type'],
			severity: row.severity as OutageData['severity'],
			lat: row.lat,
			lon: row.lon,
			description: d.description as string || '',
			affectedPopulation: undefined,
			startTime: row.detected_at,
			source: d.source as string || 'IODA',
			active: d.active as boolean !== false,
			radiusKm: d.radiusKm as number,
			boundaryCoords: undefined,
			areaKm2: undefined,
			gridStressPercent: undefined,
			gridStressLevel: undefined
		};
	});
}

/**
 * Fetch radiation data from Supabase
 */
export async function fetchRadiationFromSupabase(): Promise<RadiationReading[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('radiation_readings')
		.select('*')
		.order('value', { ascending: false })
		.limit(100);

	if (error) {
		console.error('Error fetching radiation data from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		return {
			id: row.id,
			lat: row.lat,
			lon: row.lon,
			value: row.value,
			unit: row.unit as RadiationReading['unit'],
			capturedAt: d.capturedAt as string || row.measured_at,
			deviceId: row.station_id,
			location: row.location,
			level: d.level as RadiationReading['level'] || 'normal'
		};
	});
}

/**
 * Fetch disease outbreaks from Supabase
 */
export async function fetchDiseaseOutbreaksFromSupabase(): Promise<DiseaseOutbreak[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('disease_outbreaks')
		.select('*')
		.eq('status', 'active');

	if (error) {
		console.error('Error fetching disease outbreaks from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		return {
			id: row.external_id || row.id,
			disease: row.disease,
			country: row.country,
			region: row.location,
			lat: d.lat as number || 0,
			lon: d.lon as number || 0,
			cases: row.cases,
			deaths: row.deaths,
			status: row.status as DiseaseOutbreak['status'],
			severity: d.severity as DiseaseOutbreak['severity'] || 'moderate',
			startDate: d.startDate as string || row.reported_at,
			lastUpdate: row.updated_at,
			source: d.source as string || 'ReliefWeb',
			url: d.url as string
		};
	});
}

// =============================================================================
// Government and Economic Data
// =============================================================================

/**
 * Fetch government contracts from Supabase
 */
export async function fetchGovContractsFromSupabase(): Promise<GovContract[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('gov_contracts')
		.select('*')
		.order('amount', { ascending: false })
		.limit(10);

	if (error) {
		console.error('Error fetching gov contracts from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => ({
		id: row.external_id || row.id,
		title: row.description,
		agency: row.agency,
		value: row.amount,
		vendor: row.recipient,
		date: row.award_date,
		url: ''
	}));
}

/**
 * Fetch layoffs from Supabase
 */
export async function fetchLayoffsFromSupabase(): Promise<LayoffData[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('layoffs')
		.select('*')
		.order('announced_at', { ascending: false })
		.limit(20);

	if (error) {
		console.error('Error fetching layoffs from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		return {
			company: row.company,
			count: row.count,
			percentage: row.percentage,
			date: row.announced_at,
			source: 'HN',
			url: '',
			title: d.title as string
		};
	});
}

/**
 * Fetch world leaders from Supabase
 */
export async function fetchWorldLeadersFromSupabase(): Promise<WorldLeader[]> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('world_leaders')
		.select('*')
		.order('leader_name', { ascending: true });

	if (error) {
		console.error('Error fetching world leaders from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		return {
			id: d.id as string || row.country.toLowerCase().replace(/\s+/g, '-'),
			name: row.leader_name,
			title: row.title,
			country: row.country,
			flag: d.flag as string || '',
			keywords: d.keywords as string[] || [],
			since: row.took_office || '',
			party: row.party,
			focus: d.focus as string[],
			news: d.news as LeaderNews[]
		};
	});
}

/**
 * Fetch Fed balance data from Supabase
 */
export async function fetchFedBalanceFromSupabase(): Promise<FedBalanceData | null> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('fed_balance')
		.select('*')
		.order('date', { ascending: false })
		.limit(1)
		.single();

	if (error) {
		console.error('Error fetching Fed balance from Supabase:', error);
		return null;
	}

	if (!data) return null;

	const d = data.data as Record<string, unknown> || {};
	return {
		value: data.total_assets,
		change: d.change_weekly as number || 0,
		changePercent: d.change_percent as number || 0,
		percentOfMax: 0 // Would need historical max to calculate
	};
}

// =============================================================================
// Storm Data
// =============================================================================

/**
 * Fetch tropical cyclones from Supabase
 */
export async function fetchTropicalCyclonesFromSupabase(): Promise<TropicalCyclone[]> {
	const client = ensureSupabase();

	const { data, error } = await client.from('tropical_cyclones').select('*');

	if (error) {
		console.error('Error fetching tropical cyclones from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		const movement = d.movement as { direction: number; speed: number } || { direction: 0, speed: 0 };
		return {
			id: row.storm_id,
			name: row.name,
			basin: row.basin as TropicalCyclone['basin'],
			stormNumber: 0,
			currentPosition: {
				lat: row.lat,
				lon: row.lon,
				validTime: d.timestamp as string || row.updated_at
			},
			currentIntensity: {
				maxWind: row.max_wind,
				gusts: null,
				pressure: row.pressure,
				category: row.category as TropicalCyclone['currentIntensity']['category'],
				movement: {
					direction: String(movement.direction),
					speed: movement.speed
				}
			},
			forecastTrack: (row.forecast_track || []).map((pt: { lat: number; lon: number; forecastHour?: number; hour?: number; maxWind: number; gusts?: number; category: string; pressure?: number; validTime?: string }) => ({
				lat: pt.lat,
				lon: pt.lon,
				forecastHour: pt.forecastHour || pt.hour || 0,
				maxWind: pt.maxWind,
				gusts: pt.gusts || null,
				category: pt.category as TropicalCyclone['currentIntensity']['category'],
				pressure: pt.pressure || null,
				validTime: pt.validTime || ''
			})),
			forecastCone: row.forecast_cone,
			windRadii: { '34kt': null, '50kt': null, '64kt': null },
			lastUpdate: d.timestamp as string || row.updated_at
		};
	});
}

/**
 * Fetch convective outlooks from Supabase
 */
export async function fetchConvectiveOutlooksFromSupabase(): Promise<ConvectiveOutlook[]> {
	const client = ensureSupabase();

	const { data, error } = await client.from('convective_outlooks').select('*');

	if (error) {
		console.error('Error fetching convective outlooks from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		const props = d.properties as Record<string, unknown> || {};
		return {
			day: row.day as ConvectiveOutlook['day'],
			type: row.outlook_type as ConvectiveOutlook['type'],
			risk: row.risk as ConvectiveOutlook['risk'],
			geometry: row.geometry,
			validTime: row.valid_time,
			isSignificant: row.risk !== 'TSTM' && row.risk !== 'MRGL',
			label: props.label as string,
			fill: props.fill as string,
			stroke: props.stroke as string
		};
	});
}

// =============================================================================
// Conflict Data
// =============================================================================

/**
 * Fetch conflicts from Supabase
 */
export async function fetchConflictsFromSupabase(): Promise<{
	hotspots: Array<{
		id: string;
		name: string;
		lat: number;
		lon: number;
		intensity: string;
		fatalitiesPrediction?: number;
		confidence?: number;
		countryCode: string;
		countryName: string;
		region?: string;
		conflictType?: string;
	}>;
}> {
	const client = ensureSupabase();

	const { data, error } = await client.from('conflicts').select('*');

	if (error) {
		console.error('Error fetching conflicts from Supabase:', error);
		return { hotspots: [] };
	}

	const hotspots = (data || []).map((row) => {
		const d = row.data as Record<string, unknown> || {};
		return {
			id: row.external_id || row.id,
			name: row.name,
			lat: row.lat,
			lon: row.lon,
			intensity: row.intensity,
			fatalitiesPrediction: row.fatalities,
			confidence: d.fatalityProbability as number,
			countryCode: row.region,
			countryName: row.country,
			region: d.forecastMonth as string,
			conflictType: row.type
		};
	});

	return { hotspots };
}

// =============================================================================
// Sync Status
// =============================================================================

/**
 * Fetch sync status for monitoring data freshness
 */
export async function fetchSyncStatus(): Promise<
	Array<{
		dataType: string;
		lastSync: string;
		recordCount: number;
		status: string;
		error?: string;
	}>
> {
	const client = ensureSupabase();

	const { data, error } = await client
		.from('sync_status')
		.select('*')
		.order('last_run', { ascending: false });

	if (error) {
		console.error('Error fetching sync status from Supabase:', error);
		return [];
	}

	return (data || []).map((row) => ({
		dataType: row.function_name,
		lastSync: row.last_run,
		recordCount: row.run_count,
		status: row.last_error ? 'error' : 'success',
		error: row.last_error
	}));
}
