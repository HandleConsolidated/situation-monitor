/**
 * Fetchers Index - Re-exports all fetcher modules for Supabase Edge Functions
 */

// Markets
export {
	fetchCryptoPrices,
	fetchIndices,
	fetchSectorPerformance,
	fetchCommodities,
	fetchAllMarkets,
	type CryptoItem,
	type MarketItem,
	type SectorPerformance
} from './markets.ts';

// News
export {
	fetchCategoryNews,
	fetchAllNews,
	FEEDS,
	type NewsItem,
	type NewsCategory,
	type FeedSource
} from './news.ts';

// Weather
export { fetchAllActiveAlerts, type WeatherAlert } from './weather.ts';

// Hazards
export {
	fetchEarthquakes,
	fetchAllGridStress,
	fetchOutageData,
	getEarthquakeSeverity,
	getEarthquakeColor,
	type EarthquakeData,
	type GridStressData,
	type OutageData
} from './hazards.ts';

// Intel
export {
	fetchPolymarket,
	fetchWhaleTransactions,
	fetchConflicts,
	type PolymarketPrediction,
	type WhaleTransaction,
	type ConflictHotspot,
	type ConflictArc,
	type ConflictData
} from './intel.ts';

// Environmental
export {
	fetchRadiationData,
	fetchDiseaseOutbreaks,
	RADIATION_LEVEL_COLORS,
	RADIATION_LEVEL_DESCRIPTIONS,
	type RadiationReading,
	type RadiationLevel,
	type DiseaseOutbreak,
	type DiseaseOutbreakSeverity,
	type DiseaseOutbreakStatus
} from './environmental.ts';

// Slow (Gov, Layoffs, Leaders)
export {
	fetchGovContracts,
	fetchLayoffs,
	fetchWorldLeaders,
	type GovContract,
	type Layoff,
	type WorldLeader,
	type LeaderNews
} from './slow.ts';

// Storms
export {
	fetchActiveTropicalCyclones,
	fetchAllDay1Outlooks,
	getCategoryInfo,
	getBasinInfo,
	OUTLOOK_RISK_COLORS,
	OUTLOOK_RISK_DESCRIPTIONS,
	type TropicalCyclone,
	type CycloneCategory,
	type CycloneBasin,
	type CycloneForecastPoint,
	type Day1Outlook,
	type OutlookRisk,
	type HazardType
} from './storms.ts';
