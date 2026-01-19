/**
 * Cached API Functions
 *
 * This module wraps all API functions with persistent caching to reduce redundant API calls.
 * Each function accepts an optional `forceRefresh` parameter to bypass the cache.
 *
 * Usage:
 * ```typescript
 * import { cachedApi } from '$lib/api/cached';
 *
 * // Normal call - uses cache if available
 * const data = await cachedApi.fetchCryptoPrices();
 *
 * // Force refresh - bypasses cache
 * const freshData = await cachedApi.fetchCryptoPrices(true);
 * ```
 */

import { apiCache, API_CACHE_TTL } from '$lib/services/api-cache';
import type { NewsCategory, NewsItem, MarketItem, SectorPerformance, CryptoItem, EarthquakeData, DiseaseOutbreak, WorldLeader } from '$lib/types';
import type {
	Prediction,
	WhaleTransaction,
	Contract,
	Layoff,
	OutageData,
	GridStressData,
	RadiationReading,
	FedBalanceData
} from './misc';
import type { FetchNewsResult } from './news';

// Import original API functions
import { fetchCategoryNews, fetchAllNews, fetchAllNewsWithErrors } from './news';
import {
	fetchCryptoPrices as _fetchCryptoPrices,
	fetchIndices as _fetchIndices,
	fetchSectorPerformance as _fetchSectorPerformance,
	fetchCommodities as _fetchCommodities,
	fetchAllMarkets as _fetchAllMarkets
} from './markets';
import {
	fetchPolymarket as _fetchPolymarket,
	fetchWhaleTransactions as _fetchWhaleTransactions,
	fetchGovContracts as _fetchGovContracts,
	fetchLayoffs as _fetchLayoffs,
	fetchOutageData as _fetchOutageData,
	fetchAllGridStress as _fetchAllGridStress,
	fetchEarthquakes as _fetchEarthquakes,
	fetchRadiationData as _fetchRadiationData,
	fetchDiseaseOutbreaks as _fetchDiseaseOutbreaks,
	fetchFedBalanceData as _fetchFedBalanceData
} from './misc';
import { fetchWorldLeaders as _fetchWorldLeaders } from './leaders';

// Cache keys
const CACHE_KEYS = {
	crypto: 'api:crypto',
	indices: 'api:indices',
	sectors: 'api:sectors',
	commodities: 'api:commodities',
	allMarkets: 'api:allMarkets',
	news: (category: NewsCategory) => `api:news:${category}`,
	allNews: 'api:allNews',
	allNewsWithErrors: 'api:allNewsWithErrors',
	polymarket: 'api:polymarket',
	whales: 'api:whales',
	contracts: 'api:contracts',
	layoffs: 'api:layoffs',
	outages: 'api:outages',
	gridStress: 'api:gridStress',
	earthquakes: (minMag: number) => `api:earthquakes:${minMag}`,
	radiation: 'api:radiation',
	diseaseOutbreaks: 'api:diseaseOutbreaks',
	fedBalance: 'api:fedBalance',
	worldLeaders: 'api:worldLeaders'
} as const;

/**
 * Helper to wrap an API call with caching
 */
async function withCache<T>(
	key: string,
	fetcher: () => Promise<T>,
	ttl: number,
	forceRefresh: boolean
): Promise<T> {
	// Check cache first (unless force refresh)
	if (!forceRefresh) {
		const cached = apiCache.get<T>(key);
		if (cached !== null) {
			return cached;
		}
	}

	// Fetch fresh data
	const data = await fetcher();

	// Cache the result
	apiCache.set(key, data, ttl);

	return data;
}

/**
 * Cached API object containing all cached API functions
 */
export const cachedApi = {
	// ============ Market Data ============

	/**
	 * Fetch cryptocurrency prices with caching
	 * TTL: 2 minutes
	 */
	async fetchCryptoPrices(forceRefresh = false): Promise<CryptoItem[]> {
		return withCache(
			CACHE_KEYS.crypto,
			_fetchCryptoPrices,
			API_CACHE_TTL.crypto,
			forceRefresh
		);
	},

	/**
	 * Fetch market indices with caching
	 * TTL: 2 minutes
	 */
	async fetchIndices(forceRefresh = false): Promise<MarketItem[]> {
		return withCache(
			CACHE_KEYS.indices,
			_fetchIndices,
			API_CACHE_TTL.indices,
			forceRefresh
		);
	},

	/**
	 * Fetch sector performance with caching
	 * TTL: 2 minutes
	 */
	async fetchSectorPerformance(forceRefresh = false): Promise<SectorPerformance[]> {
		return withCache(
			CACHE_KEYS.sectors,
			_fetchSectorPerformance,
			API_CACHE_TTL.sectors,
			forceRefresh
		);
	},

	/**
	 * Fetch commodities with caching
	 * TTL: 2 minutes
	 */
	async fetchCommodities(forceRefresh = false): Promise<MarketItem[]> {
		return withCache(
			CACHE_KEYS.commodities,
			_fetchCommodities,
			API_CACHE_TTL.commodities,
			forceRefresh
		);
	},

	/**
	 * Fetch all market data with caching
	 * TTL: 2 minutes
	 */
	async fetchAllMarkets(forceRefresh = false): Promise<{
		crypto: CryptoItem[];
		indices: MarketItem[];
		sectors: SectorPerformance[];
		commodities: MarketItem[];
	}> {
		return withCache(
			CACHE_KEYS.allMarkets,
			_fetchAllMarkets,
			API_CACHE_TTL.markets,
			forceRefresh
		);
	},

	// ============ News Data ============

	/**
	 * Fetch news for a specific category with caching
	 * TTL: 5 minutes
	 */
	async fetchCategoryNews(category: NewsCategory, forceRefresh = false): Promise<NewsItem[]> {
		return withCache(
			CACHE_KEYS.news(category),
			() => fetchCategoryNews(category),
			API_CACHE_TTL.newsCategory,
			forceRefresh
		);
	},

	/**
	 * Fetch all news categories with caching
	 * TTL: 5 minutes
	 */
	async fetchAllNews(forceRefresh = false): Promise<Record<NewsCategory, NewsItem[]>> {
		return withCache(
			CACHE_KEYS.allNews,
			fetchAllNews,
			API_CACHE_TTL.news,
			forceRefresh
		);
	},

	/**
	 * Fetch all news with error tracking and caching
	 * TTL: 5 minutes
	 */
	async fetchAllNewsWithErrors(forceRefresh = false): Promise<FetchNewsResult> {
		return withCache(
			CACHE_KEYS.allNewsWithErrors,
			fetchAllNewsWithErrors,
			API_CACHE_TTL.news,
			forceRefresh
		);
	},

	// ============ Alternative Data ============

	/**
	 * Fetch Polymarket predictions with caching
	 * TTL: 5 minutes
	 */
	async fetchPolymarket(forceRefresh = false): Promise<Prediction[]> {
		return withCache(
			CACHE_KEYS.polymarket,
			_fetchPolymarket,
			API_CACHE_TTL.polymarket,
			forceRefresh
		);
	},

	/**
	 * Fetch whale transactions with caching
	 * TTL: 5 minutes
	 */
	async fetchWhaleTransactions(forceRefresh = false): Promise<WhaleTransaction[]> {
		return withCache(
			CACHE_KEYS.whales,
			_fetchWhaleTransactions,
			API_CACHE_TTL.whales,
			forceRefresh
		);
	},

	/**
	 * Fetch government contracts with caching
	 * TTL: 30 minutes
	 */
	async fetchGovContracts(forceRefresh = false): Promise<Contract[]> {
		return withCache(
			CACHE_KEYS.contracts,
			_fetchGovContracts,
			API_CACHE_TTL.contracts,
			forceRefresh
		);
	},

	/**
	 * Fetch layoffs data with caching
	 * TTL: 15 minutes
	 */
	async fetchLayoffs(forceRefresh = false): Promise<Layoff[]> {
		return withCache(
			CACHE_KEYS.layoffs,
			_fetchLayoffs,
			API_CACHE_TTL.layoffs,
			forceRefresh
		);
	},

	// ============ Infrastructure Data ============

	/**
	 * Fetch outage data with caching
	 * TTL: 5 minutes
	 */
	async fetchOutageData(forceRefresh = false): Promise<OutageData[]> {
		return withCache(
			CACHE_KEYS.outages,
			_fetchOutageData,
			API_CACHE_TTL.outages,
			forceRefresh
		);
	},

	/**
	 * Fetch grid stress data with caching
	 * TTL: 5 minutes
	 */
	async fetchAllGridStress(forceRefresh = false): Promise<GridStressData[]> {
		return withCache(
			CACHE_KEYS.gridStress,
			_fetchAllGridStress,
			API_CACHE_TTL.gridStress,
			forceRefresh
		);
	},

	// ============ Environmental Data ============

	/**
	 * Fetch earthquake data with caching
	 * TTL: 5 minutes
	 */
	async fetchEarthquakes(minMagnitude = 4.0, forceRefresh = false): Promise<EarthquakeData[]> {
		return withCache(
			CACHE_KEYS.earthquakes(minMagnitude),
			() => _fetchEarthquakes(minMagnitude),
			API_CACHE_TTL.earthquakes,
			forceRefresh
		);
	},

	/**
	 * Fetch radiation data with caching
	 * TTL: 15 minutes
	 */
	async fetchRadiationData(forceRefresh = false): Promise<RadiationReading[]> {
		return withCache(
			CACHE_KEYS.radiation,
			_fetchRadiationData,
			API_CACHE_TTL.radiation,
			forceRefresh
		);
	},

	/**
	 * Fetch disease outbreak data with caching
	 * TTL: 30 minutes
	 */
	async fetchDiseaseOutbreaks(forceRefresh = false): Promise<DiseaseOutbreak[]> {
		return withCache(
			CACHE_KEYS.diseaseOutbreaks,
			_fetchDiseaseOutbreaks,
			API_CACHE_TTL.diseaseOutbreaks,
			forceRefresh
		);
	},

	// ============ Financial Data ============

	/**
	 * Fetch Federal Reserve balance sheet data with caching
	 * TTL: 4 hours
	 */
	async fetchFedBalanceData(forceRefresh = false): Promise<FedBalanceData | null> {
		return withCache(
			CACHE_KEYS.fedBalance,
			_fetchFedBalanceData,
			API_CACHE_TTL.fedBalance,
			forceRefresh
		);
	},

	// ============ Geopolitical Data ============

	/**
	 * Fetch world leaders data with caching
	 * TTL: 10 minutes
	 */
	async fetchWorldLeaders(forceRefresh = false): Promise<WorldLeader[]> {
		return withCache(
			CACHE_KEYS.worldLeaders,
			_fetchWorldLeaders,
			API_CACHE_TTL.worldLeaders,
			forceRefresh
		);
	},

	// ============ Cache Management ============

	/**
	 * Clear all API caches
	 */
	clearAllCaches(): void {
		apiCache.clear();
	},

	/**
	 * Invalidate specific cache entries
	 */
	invalidateCache(pattern: string): void {
		apiCache.invalidatePattern(pattern);
	},

	/**
	 * Get cache statistics
	 */
	getCacheStats() {
		return apiCache.getStats();
	},

	/**
	 * Check if data is cached and return age in seconds
	 */
	getCacheAge(key: string): number | null {
		const age = apiCache.getAge(`api:${key}`);
		return age !== null ? Math.round(age / 1000) : null;
	}
};

/**
 * Export individual cached functions for convenience
 */
export const {
	fetchCryptoPrices,
	fetchIndices,
	fetchSectorPerformance,
	fetchCommodities,
	fetchAllMarkets,
	fetchCategoryNews: fetchCategoryNewsCached,
	fetchAllNews: fetchAllNewsCached,
	fetchAllNewsWithErrors: fetchAllNewsWithErrorsCached,
	fetchPolymarket,
	fetchWhaleTransactions,
	fetchGovContracts,
	fetchLayoffs,
	fetchOutageData,
	fetchAllGridStress,
	fetchEarthquakes,
	fetchRadiationData,
	fetchDiseaseOutbreaks,
	fetchFedBalanceData,
	fetchWorldLeaders,
	clearAllCaches,
	invalidateCache,
	getCacheStats
} = cachedApi;
