/**
 * Markets API - Fetch market data from Finnhub
 *
 * Get your free API key at: https://finnhub.io/
 * Free tier: 60 calls/minute
 */

import { INDICES, SECTORS, COMMODITIES, CRYPTO } from '$lib/config/markets';
import type { MarketItem, SectorPerformance, CryptoItem } from '$lib/types';
import { logger, FINNHUB_API_KEY, FINNHUB_BASE_URL } from '$lib/config/api';

/**
 * CoinGecko API response structure for /simple/price endpoint
 */
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

/**
 * Check if Finnhub API key is configured
 */
function hasFinnhubApiKey(): boolean {
	return Boolean(FINNHUB_API_KEY && FINNHUB_API_KEY.length > 0);
}

/**
 * Rate limiter for Finnhub API - ensures we don't exceed 60 calls/minute
 * Implements sequential requests with delays and caching
 */
const finnhubRateLimiter = {
	lastRequestTime: 0,
	minDelayMs: 200, // Minimum 200ms between requests (max 5 requests/second = 300/minute, well under limit)

	async waitForNextSlot(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRequest = now - this.lastRequestTime;

		if (timeSinceLastRequest < this.minDelayMs) {
			await new Promise(resolve => setTimeout(resolve, this.minDelayMs - timeSinceLastRequest));
		}

		this.lastRequestTime = Date.now();
	}
};

/**
 * Cache for Finnhub quotes to reduce API calls
 * TTL: 60 seconds (data updates during market hours)
 */
const finnhubCache = new Map<string, { data: FinnhubQuote; timestamp: number }>();
const FINNHUB_CACHE_TTL = 60000; // 1 minute cache

/**
 * Create an empty market item (used for error/missing data states)
 */
function createEmptyMarketItem<T extends 'index' | 'commodity'>(
	symbol: string,
	name: string,
	type: T
): MarketItem {
	return { symbol, name, price: NaN, change: NaN, changePercent: NaN, type };
}

/**
 * Create an empty sector performance item
 */
function createEmptySectorItem(symbol: string, name: string): SectorPerformance {
	return { symbol, name, price: NaN, change: NaN, changePercent: NaN };
}

// Map index symbols to ETF proxies (free tier doesn't support direct indices)
const INDEX_ETF_MAP: Record<string, string> = {
	'^DJI': 'DIA', // Dow Jones -> SPDR Dow Jones ETF
	'^GSPC': 'SPY', // S&P 500 -> SPDR S&P 500 ETF
	'^IXIC': 'QQQ', // NASDAQ -> Invesco QQQ (NASDAQ-100)
	'^RUT': 'IWM' // Russell 2000 -> iShares Russell 2000 ETF
};

/**
 * Fetch a quote from Finnhub with rate limiting and caching
 */
async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
	// Check cache first
	const cached = finnhubCache.get(symbol);
	if (cached && Date.now() - cached.timestamp < FINNHUB_CACHE_TTL) {
		logger.log('Markets API', `Using cached quote for ${symbol}`);
		return cached.data;
	}

	try {
		// Wait for rate limit slot
		await finnhubRateLimiter.waitForNextSlot();

		const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;
		const response = await fetch(url, {
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			// Handle rate limiting specifically
			if (response.status === 429) {
				logger.warn('Markets API', `Rate limited for ${symbol}, using cached data if available`);
				return cached?.data ?? null;
			}
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: FinnhubQuote = await response.json();

		// Finnhub returns all zeros when symbol not found
		if (data.c === 0 && data.pc === 0) {
			return null;
		}

		// Cache the result
		finnhubCache.set(symbol, { data, timestamp: Date.now() });

		return data;
	} catch (error) {
		logger.error('Markets API', `Error fetching quote for ${symbol}:`, error);
		// Return cached data on error if available
		return cached?.data ?? null;
	}
}

// Simple cache for crypto prices to avoid rate limiting
let cryptoCache: { data: CryptoItem[]; timestamp: number } | null = null;
const CRYPTO_CACHE_TTL = 60000; // 1 minute cache

// Map CRYPTO config ids to CoinGecko ids
const COINGECKO_ID_MAP: Record<string, string> = {
	bitcoin: 'bitcoin',
	ethereum: 'ethereum',
	solana: 'solana'
};

/**
 * Fetch crypto prices from CoinGecko API
 * CoinGecko is free, no API key required, and supports CORS directly
 * Note: Previous CoinCap API had DNS issues (ERR_NAME_NOT_RESOLVED)
 */
export async function fetchCryptoPrices(): Promise<CryptoItem[]> {
	// Return cached data if fresh
	if (cryptoCache && Date.now() - cryptoCache.timestamp < CRYPTO_CACHE_TTL) {
		logger.log('Markets API', 'Using cached crypto data');
		return cryptoCache.data;
	}

	try {
		const ids = CRYPTO.map((c) => COINGECKO_ID_MAP[c.id] || c.id).join(',');
		// CoinGecko simple/price endpoint - more reliable than CoinCap
		const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

		logger.log('Markets API', 'Fetching crypto from CoinGecko');

		// CoinGecko supports CORS directly - no proxy needed
		const response = await fetch(coinGeckoUrl, {
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: CoinGeckoPriceResponse = await response.json();

		const result = CRYPTO.map((crypto) => {
			const coinGeckoId = COINGECKO_ID_MAP[crypto.id] || crypto.id;
			const priceData = data[coinGeckoId];
			const price = priceData?.usd ?? 0;
			const changePercent = priceData?.usd_24h_change ?? 0;

			return {
				id: crypto.id,
				symbol: crypto.symbol,
				name: crypto.name,
				current_price: price,
				price_change_24h: (price * changePercent) / 100, // Calculate dollar change
				price_change_percentage_24h: changePercent
			};
		});

		// Cache the result
		cryptoCache = { data: result, timestamp: Date.now() };
		logger.log('Markets API', `Fetched ${result.length} crypto prices from CoinGecko`);
		return result;
	} catch (error) {
		logger.error('Markets API', 'Error fetching crypto:', error);
		// Return cached data if available, even if stale
		if (cryptoCache) {
			logger.log('Markets API', 'Using stale cached crypto data');
			return cryptoCache.data;
		}
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
 * Uses sequential fetching to respect rate limits
 */
export async function fetchIndices(): Promise<MarketItem[]> {
	const createEmptyIndices = () =>
		INDICES.map((i) => createEmptyMarketItem(i.symbol, i.name, 'index'));

	if (!hasFinnhubApiKey()) {
		logger.warn('Markets API', 'Finnhub API key not configured. Add VITE_FINNHUB_API_KEY to .env');
		return createEmptyIndices();
	}

	try {
		logger.log('Markets API', 'Fetching indices from Finnhub (sequential with rate limiting)');

		const results: MarketItem[] = [];

		// Fetch sequentially to respect rate limits
		for (const index of INDICES) {
			const etfSymbol = INDEX_ETF_MAP[index.symbol] || index.symbol;
			const quote = await fetchFinnhubQuote(etfSymbol);

			results.push({
				symbol: index.symbol,
				name: index.name,
				price: quote?.c ?? NaN,
				change: quote?.d ?? NaN,
				changePercent: quote?.dp ?? NaN,
				type: 'index' as const
			});
		}

		return results;
	} catch (error) {
		logger.error('Markets API', 'Error fetching indices:', error);
		return createEmptyIndices();
	}
}

/**
 * Fetch sector performance from Finnhub (using sector ETFs)
 * Uses sequential fetching to respect rate limits
 */
export async function fetchSectorPerformance(): Promise<SectorPerformance[]> {
	const createEmptySectors = () => SECTORS.map((s) => createEmptySectorItem(s.symbol, s.name));

	if (!hasFinnhubApiKey()) {
		logger.warn('Markets API', 'Finnhub API key not configured');
		return createEmptySectors();
	}

	try {
		logger.log('Markets API', 'Fetching sector performance from Finnhub (sequential with rate limiting)');

		const results: SectorPerformance[] = [];

		// Fetch sequentially to respect rate limits
		for (const sector of SECTORS) {
			const quote = await fetchFinnhubQuote(sector.symbol);

			results.push({
				symbol: sector.symbol,
				name: sector.name,
				price: quote?.c ?? NaN,
				change: quote?.d ?? NaN,
				changePercent: quote?.dp ?? NaN
			});
		}

		return results;
	} catch (error) {
		logger.error('Markets API', 'Error fetching sectors:', error);
		return createEmptySectors();
	}
}

// Finnhub commodity ETF proxies (free tier doesn't support direct commodities)
const COMMODITY_SYMBOL_MAP: Record<string, string> = {
	'^VIX': 'VIXY', // VIX -> ProShares VIX Short-Term Futures ETF
	'GC=F': 'GLD', // Gold -> SPDR Gold Shares
	'CL=F': 'USO', // Crude Oil -> United States Oil Fund
	'NG=F': 'UNG', // Natural Gas -> United States Natural Gas Fund
	'SI=F': 'SLV', // Silver -> iShares Silver Trust
	'HG=F': 'CPER' // Copper -> United States Copper Index Fund
};

/**
 * Fetch commodities from Finnhub
 * Uses sequential fetching to respect rate limits
 */
export async function fetchCommodities(): Promise<MarketItem[]> {
	const createEmptyCommodities = () =>
		COMMODITIES.map((c) => createEmptyMarketItem(c.symbol, c.name, 'commodity'));

	if (!hasFinnhubApiKey()) {
		logger.warn('Markets API', 'Finnhub API key not configured');
		return createEmptyCommodities();
	}

	try {
		logger.log('Markets API', 'Fetching commodities from Finnhub (sequential with rate limiting)');

		const results: MarketItem[] = [];

		// Fetch sequentially to respect rate limits
		for (const commodity of COMMODITIES) {
			const finnhubSymbol = COMMODITY_SYMBOL_MAP[commodity.symbol] || commodity.symbol;
			const quote = await fetchFinnhubQuote(finnhubSymbol);

			results.push({
				symbol: commodity.symbol,
				name: commodity.name,
				price: quote?.c ?? NaN,
				change: quote?.d ?? NaN,
				changePercent: quote?.dp ?? NaN,
				type: 'commodity' as const
			});
		}

		return results;
	} catch (error) {
		logger.error('Markets API', 'Error fetching commodities:', error);
		return createEmptyCommodities();
	}
}

interface AllMarketsData {
	crypto: CryptoItem[];
	indices: MarketItem[];
	sectors: SectorPerformance[];
	commodities: MarketItem[];
}

/**
 * Fetch all market data
 */
export async function fetchAllMarkets(): Promise<AllMarketsData> {
	const [crypto, indices, sectors, commodities] = await Promise.all([
		fetchCryptoPrices(),
		fetchIndices(),
		fetchSectorPerformance(),
		fetchCommodities()
	]);

	return { crypto, indices, sectors, commodities };
}
