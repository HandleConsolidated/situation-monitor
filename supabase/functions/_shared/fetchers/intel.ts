/**
 * Intel Fetcher - Polymarket, Whale Transactions, Conflicts data for Supabase Edge Functions
 *
 * Ported from src/lib/api/misc.ts
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PolymarketPrediction {
	id: string;
	question: string;
	probability: number;
	volume: number;
	category: string;
	slug: string;
	endDate?: string;
}

export interface WhaleTransaction {
	id: string;
	blockchain: string;
	symbol: string;
	amount: number;
	amountUsd: number;
	from: string;
	to: string;
	timestamp: number;
	hash: string;
}

export interface ConflictHotspot {
	id: string;
	name: string;
	lat: number;
	lon: number;
	country: string;
	isoCode: string;
	intensity: 'low' | 'elevated' | 'high' | 'critical';
	forecastedFatalities: number;
	fatalityProbability: number;
	forecastMonth: string;
	forecastYear: number;
	label: string;
	riskDescription: string;
	reasoning: string;
	dataSource: string;
}

export interface ConflictArc {
	id: string;
	from: { name: string; lat: number; lon: number };
	to: { name: string; lat: number; lon: number };
	color: string;
	intensity: 'low' | 'elevated' | 'high' | 'critical';
	description: string;
}

export interface ConflictData {
	hotspots: ConflictHotspot[];
	arcs: ConflictArc[];
	lastUpdated: number;
	forecastRun: string;
}

interface PolymarketAPIMarket {
	id: string;
	question: string;
	slug: string;
	outcomePrices: string;
	volume: string;
	category: string;
	endDate?: string;
}

interface PolymarketAPIResponse {
	data: PolymarketAPIMarket[];
}

interface VIEWSPrediction {
	country_id: number;
	month_id: number;
	name: string;
	isoab: string;
	year: number;
	month: number;
	main_mean: number;
	main_dich: number;
}

interface VIEWSResponse {
	data: VIEWSPrediction[];
	start_date: number;
}

// ============================================================================
// CONFIG
// ============================================================================

// Country centroids for conflict mapping
const COUNTRY_CENTROIDS: Record<string, { lat: number; lon: number; name: string }> = {
	UKR: { lat: 48.38, lon: 31.17, name: 'Ukraine' },
	ISR: { lat: 31.05, lon: 34.85, name: 'Israel' },
	PSE: { lat: 31.95, lon: 35.23, name: 'Palestine' },
	ETH: { lat: 9.15, lon: 40.49, name: 'Ethiopia' },
	SOM: { lat: 5.15, lon: 46.2, name: 'Somalia' },
	AFG: { lat: 33.94, lon: 67.71, name: 'Afghanistan' },
	YEM: { lat: 15.55, lon: 48.52, name: 'Yemen' },
	SYR: { lat: 34.8, lon: 39.0, name: 'Syria' },
	MMR: { lat: 21.91, lon: 95.96, name: 'Myanmar' },
	PAK: { lat: 30.38, lon: 69.35, name: 'Pakistan' },
	NGA: { lat: 9.08, lon: 8.68, name: 'Nigeria' },
	COD: { lat: -4.04, lon: 21.76, name: 'DR Congo' },
	MLI: { lat: 17.57, lon: -4.0, name: 'Mali' },
	BFA: { lat: 12.24, lon: -1.56, name: 'Burkina Faso' },
	SDN: { lat: 12.86, lon: 30.22, name: 'Sudan' },
	SSD: { lat: 6.88, lon: 31.31, name: 'South Sudan' },
	RUS: { lat: 61.52, lon: 105.32, name: 'Russia' },
	IRN: { lat: 32.43, lon: 53.69, name: 'Iran' },
	IRQ: { lat: 33.22, lon: 43.68, name: 'Iraq' },
	LBN: { lat: 33.85, lon: 35.86, name: 'Lebanon' },
	CHN: { lat: 35.86, lon: 104.2, name: 'China' },
	TWN: { lat: 23.7, lon: 121.0, name: 'Taiwan' },
	KOR: { lat: 35.91, lon: 127.77, name: 'South Korea' },
	PRK: { lat: 40.34, lon: 127.51, name: 'North Korea' },
	IND: { lat: 20.59, lon: 78.96, name: 'India' },
	ERI: { lat: 15.18, lon: 39.78, name: 'Eritrea' }
};

// Known conflict arcs
const CONFLICT_ARCS = [
	{ from: 'RUS', to: 'UKR', description: 'Russia-Ukraine War' },
	{ from: 'ISR', to: 'LBN', description: 'Israel-Lebanon Tensions' },
	{ from: 'ISR', to: 'SYR', description: 'Israel-Syria Tensions' },
	{ from: 'IRN', to: 'ISR', description: 'Iran-Israel Proxy Conflict' },
	{ from: 'CHN', to: 'TWN', description: 'Cross-Strait Tensions' },
	{ from: 'PRK', to: 'KOR', description: 'Korean Peninsula' },
	{ from: 'IND', to: 'PAK', description: 'India-Pakistan Tensions' },
	{ from: 'ETH', to: 'ERI', description: 'Ethiopia-Eritrea Tensions' },
	{ from: 'SDN', to: 'SSD', description: 'Sudan-South Sudan Conflict' }
];

// ============================================================================
// HELPERS
// ============================================================================

function getVIEWSIntensity(
	fatalities: number,
	probability: number
): 'low' | 'elevated' | 'high' | 'critical' {
	if (fatalities >= 100 || probability >= 0.99) return 'critical';
	if (fatalities >= 25 || probability >= 0.75) return 'high';
	if (fatalities >= 5 || probability >= 0.25) return 'elevated';
	if (fatalities >= 1 || probability >= 0.01) return 'low';
	return 'low';
}

function getVIEWSIntensityColor(intensity: 'low' | 'elevated' | 'high' | 'critical'): string {
	switch (intensity) {
		case 'critical':
			return '#dc2626';
		case 'high':
			return '#ef4444';
		case 'elevated':
			return '#f97316';
		case 'low':
			return '#fbbf24';
	}
}

function formatForecastMonth(year: number, month: number): string {
	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	return `${months[month - 1]} ${year}`;
}

function getVIEWSRiskDescription(
	intensity: 'low' | 'elevated' | 'high' | 'critical',
	fatalities: number,
	probability: number
): string {
	const probPercent = Math.round(probability * 100);
	switch (intensity) {
		case 'critical':
			return `CRITICAL: ${probPercent}% probability of armed conflict. Forecast predicts ~${Math.round(fatalities)} fatalities.`;
		case 'high':
			return `HIGH RISK: ${probPercent}% probability of conflict fatalities. Model predicts ~${Math.round(fatalities)} deaths.`;
		case 'elevated':
			return `ELEVATED: ${probPercent}% probability of some violence. ~${fatalities.toFixed(1)} predicted fatalities.`;
		case 'low':
			return `LOW RISK: ${probPercent}% probability of conflict. Minimal fatalities expected (~${fatalities.toFixed(1)}).`;
	}
}

function getVIEWSLabel(countryName: string, intensity: 'low' | 'elevated' | 'high' | 'critical'): string {
	const intensityLabels = {
		critical: 'Critical Conflict Risk',
		high: 'High Conflict Risk',
		elevated: 'Elevated Risk',
		low: 'Monitored Region'
	};
	return `${countryName} - ${intensityLabels[intensity]}`;
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Fetch predictions from Polymarket
 */
export async function fetchPolymarket(): Promise<PolymarketPrediction[]> {
	try {
		// Polymarket CLOB API
		const url =
			'https://clob.polymarket.com/markets?active=true&closed=false&order=volume&ascending=false&limit=50';

		console.log('Fetching Polymarket predictions...');

		const response = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`Polymarket API returned ${response.status}`);
		}

		const data: PolymarketAPIResponse = await response.json();

		if (!data.data || !Array.isArray(data.data)) {
			console.warn('Invalid Polymarket response');
			return [];
		}

		// Transform and filter for geopolitical/relevant predictions
		const predictions: PolymarketPrediction[] = [];

		for (const market of data.data) {
			// Parse outcome prices
			let probability = 0.5;
			try {
				const prices = JSON.parse(market.outcomePrices || '[]');
				if (prices.length > 0) {
					probability = parseFloat(prices[0]) || 0.5;
				}
			} catch {
				// Use default
			}

			const volume = parseFloat(market.volume) || 0;

			// Only include markets with significant volume
			if (volume < 1000) continue;

			predictions.push({
				id: market.id,
				question: market.question,
				probability,
				volume,
				category: market.category || 'general',
				slug: market.slug,
				endDate: market.endDate
			});
		}

		console.log(`Processed ${predictions.length} Polymarket predictions`);

		// Sort by volume
		return predictions.sort((a, b) => b.volume - a.volume).slice(0, 20);
	} catch (error) {
		console.error('Error fetching Polymarket:', error);
		return [];
	}
}

/**
 * Fetch whale transactions from Whale Alert API
 * Requires WHALE_ALERT_API_KEY environment variable
 */
export async function fetchWhaleTransactions(apiKey?: string): Promise<WhaleTransaction[]> {
	const whaleAlertKey = apiKey || Deno.env.get('WHALE_ALERT_API_KEY');

	if (!whaleAlertKey) {
		console.warn('Whale Alert API key not configured');
		return [];
	}

	try {
		// Get transactions from last hour
		const now = Math.floor(Date.now() / 1000);
		const oneHourAgo = now - 3600;

		const url = `https://api.whale-alert.io/v1/transactions?api_key=${whaleAlertKey}&min_value=1000000&start=${oneHourAgo}&cursor=`;

		console.log('Fetching whale transactions...');

		const response = await fetch(url, {
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`Whale Alert API returned ${response.status}`);
		}

		const data = await response.json();

		if (!data.transactions || !Array.isArray(data.transactions)) {
			return [];
		}

		const transactions: WhaleTransaction[] = data.transactions.map(
			(tx: {
				id: string;
				blockchain: string;
				symbol: string;
				amount: number;
				amount_usd: number;
				from: { owner: string };
				to: { owner: string };
				timestamp: number;
				hash: string;
			}) => ({
				id: tx.id,
				blockchain: tx.blockchain,
				symbol: tx.symbol,
				amount: tx.amount,
				amountUsd: tx.amount_usd,
				from: tx.from?.owner || 'unknown',
				to: tx.to?.owner || 'unknown',
				timestamp: tx.timestamp,
				hash: tx.hash
			})
		);

		console.log(`Processed ${transactions.length} whale transactions`);

		return transactions.sort((a, b) => b.amountUsd - a.amountUsd).slice(0, 20);
	} catch (error) {
		console.error('Error fetching whale transactions:', error);
		return [];
	}
}

/**
 * Fetch conflict forecast data from VIEWS API
 * VIEWS provides forward-looking fatality forecasts
 */
export async function fetchConflicts(): Promise<ConflictData> {
	try {
		// Get the latest forecast run
		let runId = 'fatalities003_2025_11_t01'; // Fallback

		try {
			const runsResponse = await fetch('https://api.viewsforecasting.org/', {
				headers: { Accept: 'application/json' },
				signal: AbortSignal.timeout(5000)
			});

			if (runsResponse.ok) {
				const runsData = await runsResponse.json();
				const runs: string[] = runsData.runs || [];
				const fatalityRuns = runs.filter((r: string) => r.startsWith('fatalities'));
				if (fatalityRuns.length > 0) {
					fatalityRuns.sort((a: string, b: string) => b.localeCompare(a));
					runId = fatalityRuns[0];
				}
			}
		} catch {
			// Use fallback run ID
		}

		console.log(`Fetching VIEWS conflict forecasts (run: ${runId})...`);

		const url = `https://api.viewsforecasting.org/${runId}/cm/sb?pagesize=250`;

		const response = await fetch(url, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`VIEWS API returned ${response.status}`);
		}

		const data: VIEWSResponse = await response.json();
		console.log(`Received ${data.data?.length || 0} country predictions`);

		const firstMonthId = data.start_date;
		const firstMonthData = data.data.filter((p) => p.month_id === firstMonthId);

		// Process into hotspots
		const hotspots: ConflictHotspot[] = [];

		for (const prediction of firstMonthData) {
			// Skip countries with negligible risk
			if (prediction.main_mean < 0.1 && prediction.main_dich < 0.01) continue;

			const coords = COUNTRY_CENTROIDS[prediction.isoab];
			if (!coords) continue;

			const intensity = getVIEWSIntensity(prediction.main_mean, prediction.main_dich);
			const forecastedFatalities = Math.round(prediction.main_mean * 10) / 10;
			const fatalityProbability = prediction.main_dich;

			hotspots.push({
				id: `views-${prediction.country_id}`,
				name: prediction.name,
				lat: coords.lat,
				lon: coords.lon,
				country: prediction.name,
				isoCode: prediction.isoab,
				intensity,
				forecastedFatalities,
				fatalityProbability: Math.round(fatalityProbability * 1000) / 10,
				forecastMonth: formatForecastMonth(prediction.year, prediction.month),
				forecastYear: prediction.year,
				label: getVIEWSLabel(prediction.name, intensity),
				riskDescription: getVIEWSRiskDescription(intensity, forecastedFatalities, fatalityProbability),
				reasoning: 'VIEWS prediction based on historical conflict patterns and machine learning models.',
				dataSource: 'VIEWS (Violence Early-Warning System) - Uppsala University'
			});
		}

		// Sort by forecasted fatalities
		hotspots.sort((a, b) => b.forecastedFatalities - a.forecastedFatalities);

		// Generate arcs
		const arcs: ConflictArc[] = [];
		const countryIntensity = new Map<string, 'low' | 'elevated' | 'high' | 'critical'>();

		for (const h of hotspots) {
			countryIntensity.set(h.isoCode, h.intensity);
		}

		for (const arcDef of CONFLICT_ARCS) {
			const fromCoords = COUNTRY_CENTROIDS[arcDef.from];
			const toCoords = COUNTRY_CENTROIDS[arcDef.to];

			if (!fromCoords || !toCoords) continue;

			const fromIntensity = countryIntensity.get(arcDef.from);
			const toIntensity = countryIntensity.get(arcDef.to);

			if (!fromIntensity && !toIntensity) continue;
			if (fromIntensity === 'low' && toIntensity === 'low') continue;

			const intensityOrder = { critical: 3, high: 2, elevated: 1, low: 0 };
			const arcIntensity =
				intensityOrder[fromIntensity || 'low'] >= intensityOrder[toIntensity || 'low']
					? fromIntensity || 'low'
					: toIntensity || 'low';

			arcs.push({
				id: `views-arc-${arcDef.from}-${arcDef.to}`,
				from: { name: fromCoords.name, lat: fromCoords.lat, lon: fromCoords.lon },
				to: { name: toCoords.name, lat: toCoords.lat, lon: toCoords.lon },
				color: getVIEWSIntensityColor(arcIntensity),
				intensity: arcIntensity,
				description: arcDef.description
			});
		}

		console.log(`Processed ${hotspots.length} hotspots and ${arcs.length} arcs`);

		return {
			hotspots,
			arcs,
			lastUpdated: Date.now(),
			forecastRun: runId
		};
	} catch (error) {
		console.error('Error fetching VIEWS conflicts:', error);
		return {
			hotspots: [],
			arcs: [],
			lastUpdated: Date.now(),
			forecastRun: 'error'
		};
	}
}
