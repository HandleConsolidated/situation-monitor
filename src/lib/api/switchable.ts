/**
 * Switchable API Layer
 *
 * This module provides switchable wrappers around all data fetching functions.
 * When Supabase is enabled (VITE_USE_SUPABASE=true), data is fetched from
 * the Supabase cache. Otherwise, data is fetched directly from source APIs.
 *
 * Usage:
 *   import { fetchCryptoPrices, fetchNews } from '$lib/api/switchable';
 *
 * The functions maintain the same signatures as the original API functions,
 * making this a drop-in replacement for direct imports.
 */

import { isSupabaseEnabled } from '$lib/supabase';
import { logger } from '$lib/config/api';

// Import original API functions
import {
	fetchCryptoPrices as fetchCryptoPricesDirect,
	fetchIndices as fetchIndicesDirect,
	fetchSectorPerformance as fetchSectorPerformanceDirect,
	fetchCommodities as fetchCommoditiesDirect,
	fetchAllMarkets as fetchAllMarketsDirect
} from './markets';

import {
	fetchCategoryNews as fetchCategoryNewsDirect,
	fetchAllNews as fetchAllNewsDirect
} from './news';

import {
	fetchPolymarket as fetchPolymarketDirect,
	fetchWhaleTransactions as fetchWhaleTransactionsDirect,
	fetchGovContracts as fetchGovContractsDirect,
	fetchLayoffs as fetchLayoffsDirect,
	fetchOutageData as fetchOutageDataDirect,
	fetchGridStress as fetchGridStressDirect,
	fetchEarthquakes as fetchEarthquakesDirect,
	fetchRadiationData as fetchRadiationDataDirect,
	fetchDiseaseOutbreaks as fetchDiseaseOutbreaksDirect,
	fetchFedBalanceData as fetchFedBalanceDataDirect
} from './misc';

import { fetchWorldLeaders as fetchWorldLeadersDirect } from './leaders';

import { fetchAllActiveAlerts as fetchWeatherAlertsDirect } from './weather';

import {
	fetchActiveTropicalCyclones as fetchTropicalCyclonesDirect,
	fetchConvectiveOutlooks as fetchConvectiveOutlooksDirect,
	fetchAllDay1Outlooks as fetchAllDay1OutlooksDirect
} from './storms';

// Import Supabase API functions
import {
	fetchCryptoPricesFromSupabase,
	fetchIndicesFromSupabase,
	fetchSectorPerformanceFromSupabase,
	fetchCommoditiesFromSupabase,
	fetchMarketDataFromSupabase,
	fetchNewsFromSupabase,
	fetchAllNewsFromSupabase,
	fetchPolymarketFromSupabase,
	fetchWhaleTransactionsFromSupabase,
	fetchGovContractsFromSupabase,
	fetchLayoffsFromSupabase,
	fetchOutagesFromSupabase,
	fetchGridStressFromSupabase,
	fetchEarthquakesFromSupabase,
	fetchRadiationFromSupabase,
	fetchDiseaseOutbreaksFromSupabase,
	fetchWorldLeadersFromSupabase,
	fetchWeatherAlertsFromSupabase,
	fetchFedBalanceFromSupabase,
	fetchTropicalCyclonesFromSupabase,
	fetchConvectiveOutlooksFromSupabase,
	fetchConflictsFromSupabase,
	fetchSyncStatus
} from './supabase-api';

import type { NewsCategory } from '$lib/types';

// =============================================================================
// Market Data
// =============================================================================

/**
 * Fetch cryptocurrency prices
 * Routes to Supabase or direct API based on configuration
 */
export async function fetchCryptoPrices() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching crypto prices from Supabase');
		return fetchCryptoPricesFromSupabase();
	}
	return fetchCryptoPricesDirect();
}

/**
 * Fetch market indices
 */
export async function fetchIndices() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching indices from Supabase');
		return fetchIndicesFromSupabase();
	}
	return fetchIndicesDirect();
}

/**
 * Fetch sector performance
 */
export async function fetchSectorPerformance() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching sector performance from Supabase');
		return fetchSectorPerformanceFromSupabase();
	}
	return fetchSectorPerformanceDirect();
}

/**
 * Fetch commodities
 */
export async function fetchCommodities() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching commodities from Supabase');
		return fetchCommoditiesFromSupabase();
	}
	return fetchCommoditiesDirect();
}

/**
 * Fetch all market data (crypto, indices, sectors, commodities)
 */
export async function fetchAllMarkets() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching all market data from Supabase');
		return fetchMarketDataFromSupabase();
	}
	return fetchAllMarketsDirect();
}

// =============================================================================
// News
// =============================================================================

/**
 * Fetch news for a specific category
 */
export async function fetchCategoryNews(category: NewsCategory) {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', `Fetching ${category} news from Supabase`);
		return fetchNewsFromSupabase(category);
	}
	return fetchCategoryNewsDirect(category);
}

/**
 * Fetch all news grouped by category
 */
export async function fetchAllNews() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching all news from Supabase');
		return fetchAllNewsFromSupabase();
	}
	return fetchAllNewsDirect();
}

// =============================================================================
// Prediction Markets and Crypto
// =============================================================================

/**
 * Fetch Polymarket predictions
 */
export async function fetchPolymarket() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching Polymarket from Supabase');
		return fetchPolymarketFromSupabase();
	}
	return fetchPolymarketDirect();
}

/**
 * Fetch whale transactions
 */
export async function fetchWhaleTransactions() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching whale transactions from Supabase');
		return fetchWhaleTransactionsFromSupabase();
	}
	return fetchWhaleTransactionsDirect();
}

// =============================================================================
// Government and Economic Data
// =============================================================================

/**
 * Fetch government contracts
 */
export async function fetchGovContracts() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching gov contracts from Supabase');
		return fetchGovContractsFromSupabase();
	}
	return fetchGovContractsDirect();
}

/**
 * Fetch layoffs
 */
export async function fetchLayoffs() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching layoffs from Supabase');
		return fetchLayoffsFromSupabase();
	}
	return fetchLayoffsDirect();
}

/**
 * Fetch world leaders
 */
export async function fetchWorldLeaders() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching world leaders from Supabase');
		return fetchWorldLeadersFromSupabase();
	}
	return fetchWorldLeadersDirect();
}

/**
 * Fetch Fed balance data
 */
export async function fetchFedBalanceData() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching Fed balance from Supabase');
		return fetchFedBalanceFromSupabase();
	}
	return fetchFedBalanceDataDirect();
}

// =============================================================================
// Weather and Alerts
// =============================================================================

/**
 * Fetch all active weather alerts
 */
export async function fetchAllActiveAlerts() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching weather alerts from Supabase');
		return fetchWeatherAlertsFromSupabase();
	}
	return fetchWeatherAlertsDirect();
}

// =============================================================================
// Natural Events and Hazards
// =============================================================================

/**
 * Fetch earthquakes
 */
export async function fetchEarthquakes(minMagnitude: number = 4.0) {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching earthquakes from Supabase');
		return fetchEarthquakesFromSupabase(minMagnitude);
	}
	return fetchEarthquakesDirect(minMagnitude);
}

/**
 * Fetch outage data
 */
export async function fetchOutageData() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching outages from Supabase');
		return fetchOutagesFromSupabase();
	}
	return fetchOutageDataDirect();
}

/**
 * Fetch grid stress data
 */
export async function fetchGridStress() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching grid stress from Supabase');
		return fetchGridStressFromSupabase();
	}
	return fetchGridStressDirect();
}

/**
 * Fetch radiation data
 */
export async function fetchRadiationData() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching radiation from Supabase');
		return fetchRadiationFromSupabase();
	}
	return fetchRadiationDataDirect();
}

/**
 * Fetch disease outbreaks
 */
export async function fetchDiseaseOutbreaks() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching disease outbreaks from Supabase');
		return fetchDiseaseOutbreaksFromSupabase();
	}
	return fetchDiseaseOutbreaksDirect();
}

// =============================================================================
// Tropical Storms and Convective Weather
// =============================================================================

/**
 * Fetch active tropical cyclones
 */
export async function fetchActiveTropicalCyclones() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching tropical cyclones from Supabase');
		return fetchTropicalCyclonesFromSupabase();
	}
	return fetchTropicalCyclonesDirect();
}

/**
 * Fetch convective outlooks
 * Note: When using Supabase, returns all cached outlooks.
 * Direct API allows filtering by day and type.
 */
export async function fetchConvectiveOutlooks(
	day: 1 | 2 | 3 = 1,
	type: 'categorical' | 'tornado' | 'hail' | 'wind' = 'categorical'
) {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching convective outlooks from Supabase');
		const allOutlooks = await fetchConvectiveOutlooksFromSupabase();
		// Filter to match requested day and type
		return allOutlooks.filter((o) => o.day === day && o.type === type);
	}
	return fetchConvectiveOutlooksDirect(day, type);
}

/**
 * Fetch all Day 1 convective outlooks
 */
export async function fetchAllDay1Outlooks() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching all Day 1 outlooks from Supabase');
		const allOutlooks = await fetchConvectiveOutlooksFromSupabase();
		return allOutlooks.filter((o) => o.day === 1);
	}
	return fetchAllDay1OutlooksDirect();
}

// =============================================================================
// Conflicts
// =============================================================================

/**
 * Fetch conflict data
 */
export async function fetchConflicts() {
	if (isSupabaseEnabled()) {
		logger.log('Switchable API', 'Fetching conflicts from Supabase');
		return fetchConflictsFromSupabase();
	}
	// Direct API uses VIEWS/UCDP - import and call as needed
	// For now, return empty if not using Supabase
	const { fetchVIEWSConflicts } = await import('./misc');
	return fetchVIEWSConflicts();
}

// =============================================================================
// Monitoring and Status
// =============================================================================

/**
 * Get sync status for all data types
 * Only available when Supabase is enabled
 */
export async function getSyncStatus() {
	if (!isSupabaseEnabled()) {
		return [];
	}
	return fetchSyncStatus();
}

/**
 * Check if data source is using Supabase
 */
export function isUsingSupabase(): boolean {
	return isSupabaseEnabled();
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

// Re-export types that consumers might need
export type {
	Prediction,
	PredictionCategory,
	WhaleTransaction,
	Contract,
	Layoff,
	OutageData,
	GridStressData,
	FedBalanceData
} from './misc';

export type { FetchNewsResult } from './news';
