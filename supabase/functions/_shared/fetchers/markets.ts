/**
 * Markets Fetcher - Crypto and market data fetching for Supabase Edge Functions
 *
 * Ported from src/lib/api/markets.ts
 * Uses Deno-compatible fetch API
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CryptoItem {
	id: string;
	symbol: string;
	name: string;
	current_price: number;
	price_change_24h: number;
	price_change_percentage_24h: number;
}

export interface MarketItem {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
	type: 'index' | 'commodity';
}

export interface SectorPerformance {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
}

interface CoinGeckoPrice {
	usd: number;
	usd_24h_change?: number;
}

interface CoinGeckoPriceResponse {
	[id: string]: CoinGeckoPrice;
}

interface FinnhubQuote {
	c: number; // Current price
	d: number; // Change
	dp: number; // Percent change
	h: number; // High price of the day
	l: number; // Low price of the day
	o: number; // Open price of the day
	pc: number; // Previous close price
	t: number; // Timestamp
}

// ============================================================================
// CONFIG
// ============================================================================

// Crypto assets tracked
const CRYPTO = [
	{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
	{ id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
	{ id: 'solana', symbol: 'SOL', name: 'Solana' }
];

// Map CRYPTO config ids to CoinGecko ids
const COINGECKO_ID_MAP: Record<string, string> = {
	bitcoin: 'bitcoin',
	ethereum: 'ethereum',
	solana: 'solana'
};

// Major stock indices
const INDICES = [
	{ symbol: '^DJI', name: 'Dow Jones', display: 'DOW' },
	{ symbol: '^GSPC', name: 'S&P 500', display: 'S&P' },
	{ symbol: '^IXIC', name: 'NASDAQ', display: 'NDQ' },
	{ symbol: '^RUT', name: 'Russell 2000', display: 'RUT' }
];

// Map index symbols to ETF proxies (free tier doesn't support direct indices)
const INDEX_ETF_MAP: Record<string, string> = {
	'^DJI': 'DIA', // Dow Jones -> SPDR Dow Jones ETF
	'^GSPC': 'SPY', // S&P 500 -> SPDR S&P 500 ETF
	'^IXIC': 'QQQ', // NASDAQ -> Invesco QQQ (NASDAQ-100)
	'^RUT': 'IWM' // Russell 2000 -> iShares Russell 2000 ETF
};

// Sector ETFs
const SECTORS = [
	{ symbol: 'XLK', name: 'Tech' },
	{ symbol: 'XLF', name: 'Finance' },
	{ symbol: 'XLE', name: 'Energy' },
	{ symbol: 'XLV', name: 'Health' },
	{ symbol: 'XLY', name: 'Consumer' },
	{ symbol: 'XLI', name: 'Industrial' },
	{ symbol: 'XLP', name: 'Staples' },
	{ symbol: 'XLU', name: 'Utilities' },
	{ symbol: 'XLB', name: 'Materials' },
	{ symbol: 'XLRE', name: 'Real Est' },
	{ symbol: 'XLC', name: 'Comms' },
	{ symbol: 'SMH', name: 'Semis' }
];

// Commodities with ETF proxies
const COMMODITIES = [
	{ symbol: '^VIX', name: 'VIX', display: 'VIX' },
	{ symbol: 'GC=F', name: 'Gold', display: 'GOLD' },
	{ symbol: 'CL=F', name: 'Crude Oil', display: 'OIL' },
	{ symbol: 'NG=F', name: 'Natural Gas', display: 'NATGAS' },
	{ symbol: 'SI=F', name: 'Silver', display: 'SILVER' },
	{ symbol: 'HG=F', name: 'Copper', display: 'COPPER' }
];

// Finnhub commodity ETF proxies
const COMMODITY_SYMBOL_MAP: Record<string, string> = {
	'^VIX': 'VIXY',
	'GC=F': 'GLD',
	'CL=F': 'USO',
	'NG=F': 'UNG',
	'SI=F': 'SLV',
	'HG=F': 'CPER'
};

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyMarketItem(
	symbol: string,
	name: string,
	type: 'index' | 'commodity'
): MarketItem {
	return { symbol, name, price: NaN, change: NaN, changePercent: NaN, type };
}

function createEmptySectorItem(symbol: string, name: string): SectorPerformance {
	return { symbol, name, price: NaN, change: NaN, changePercent: NaN };
}

/**
 * Fetch a quote from Finnhub
 */
async function fetchFinnhubQuote(
	symbol: string,
	apiKey: string
): Promise<FinnhubQuote | null> {
	try {
		const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
		const response = await fetch(url, {
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			console.warn(`Finnhub API error for ${symbol}: ${response.status}`);
			return null;
		}

		const data: FinnhubQuote = await response.json();

		// Finnhub returns all zeros when symbol not found
		if (data.c === 0 && data.pc === 0) {
			return null;
		}

		return data;
	} catch (error) {
		console.warn(`Error fetching Finnhub quote for ${symbol}:`, error);
		return null;
	}
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Fetch crypto prices from CoinGecko API
 * CoinGecko is free, no API key required
 */
export async function fetchCryptoPrices(): Promise<CryptoItem[]> {
	try {
		const ids = CRYPTO.map((c) => COINGECKO_ID_MAP[c.id] || c.id).join(',');
		const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

		const response = await fetch(coinGeckoUrl, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: CoinGeckoPriceResponse = await response.json();

		return CRYPTO.map((crypto) => {
			const coinGeckoId = COINGECKO_ID_MAP[crypto.id] || crypto.id;
			const priceData = data[coinGeckoId];
			const price = priceData?.usd ?? 0;
			const changePercent = priceData?.usd_24h_change ?? 0;

			return {
				id: crypto.id,
				symbol: crypto.symbol,
				name: crypto.name,
				current_price: price,
				price_change_24h: (price * changePercent) / 100,
				price_change_percentage_24h: changePercent
			};
		});
	} catch (error) {
		console.error('Error fetching crypto prices:', error);
		return CRYPTO.map((c) => ({
			id: c.id,
			symbol: c.symbol,
			name: c.name,
			current_price: 0,
			price_change_24h: 0,
			price_change_percentage_24h: 0
		}));
	}
}

/**
 * Fetch market indices from Finnhub
 * Requires FINNHUB_API_KEY environment variable
 */
export async function fetchIndices(apiKey?: string): Promise<MarketItem[]> {
	const finnhubKey = apiKey || Deno.env.get('FINNHUB_API_KEY');

	if (!finnhubKey) {
		console.warn('Finnhub API key not configured');
		return INDICES.map((i) => createEmptyMarketItem(i.symbol, i.name, 'index'));
	}

	try {
		const results: MarketItem[] = [];

		// Fetch sequentially to respect rate limits
		for (const index of INDICES) {
			const etfSymbol = INDEX_ETF_MAP[index.symbol] || index.symbol;
			const quote = await fetchFinnhubQuote(etfSymbol, finnhubKey);

			results.push({
				symbol: index.symbol,
				name: index.name,
				price: quote?.c ?? NaN,
				change: quote?.d ?? NaN,
				changePercent: quote?.dp ?? NaN,
				type: 'index' as const
			});

			// Small delay between requests
			await new Promise((r) => setTimeout(r, 200));
		}

		return results;
	} catch (error) {
		console.error('Error fetching indices:', error);
		return INDICES.map((i) => createEmptyMarketItem(i.symbol, i.name, 'index'));
	}
}

/**
 * Fetch sector performance from Finnhub
 * Requires FINNHUB_API_KEY environment variable
 */
export async function fetchSectorPerformance(apiKey?: string): Promise<SectorPerformance[]> {
	const finnhubKey = apiKey || Deno.env.get('FINNHUB_API_KEY');

	if (!finnhubKey) {
		console.warn('Finnhub API key not configured');
		return SECTORS.map((s) => createEmptySectorItem(s.symbol, s.name));
	}

	try {
		const results: SectorPerformance[] = [];

		for (const sector of SECTORS) {
			const quote = await fetchFinnhubQuote(sector.symbol, finnhubKey);

			results.push({
				symbol: sector.symbol,
				name: sector.name,
				price: quote?.c ?? NaN,
				change: quote?.d ?? NaN,
				changePercent: quote?.dp ?? NaN
			});

			await new Promise((r) => setTimeout(r, 200));
		}

		return results;
	} catch (error) {
		console.error('Error fetching sectors:', error);
		return SECTORS.map((s) => createEmptySectorItem(s.symbol, s.name));
	}
}

/**
 * Fetch commodities from Finnhub
 * Requires FINNHUB_API_KEY environment variable
 */
export async function fetchCommodities(apiKey?: string): Promise<MarketItem[]> {
	const finnhubKey = apiKey || Deno.env.get('FINNHUB_API_KEY');

	if (!finnhubKey) {
		console.warn('Finnhub API key not configured');
		return COMMODITIES.map((c) => createEmptyMarketItem(c.symbol, c.name, 'commodity'));
	}

	try {
		const results: MarketItem[] = [];

		for (const commodity of COMMODITIES) {
			const finnhubSymbol = COMMODITY_SYMBOL_MAP[commodity.symbol] || commodity.symbol;
			const quote = await fetchFinnhubQuote(finnhubSymbol, finnhubKey);

			results.push({
				symbol: commodity.symbol,
				name: commodity.name,
				price: quote?.c ?? NaN,
				change: quote?.d ?? NaN,
				changePercent: quote?.dp ?? NaN,
				type: 'commodity' as const
			});

			await new Promise((r) => setTimeout(r, 200));
		}

		return results;
	} catch (error) {
		console.error('Error fetching commodities:', error);
		return COMMODITIES.map((c) => createEmptyMarketItem(c.symbol, c.name, 'commodity'));
	}
}

/**
 * Fetch all market data
 */
export async function fetchAllMarkets(apiKey?: string): Promise<{
	crypto: CryptoItem[];
	indices: MarketItem[];
	sectors: SectorPerformance[];
	commodities: MarketItem[];
}> {
	const [crypto, indices, sectors, commodities] = await Promise.all([
		fetchCryptoPrices(),
		fetchIndices(apiKey),
		fetchSectorPerformance(apiKey),
		fetchCommodities(apiKey)
	]);

	return { crypto, indices, sectors, commodities };
}
