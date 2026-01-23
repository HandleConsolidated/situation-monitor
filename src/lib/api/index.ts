/**
 * API barrel exports
 */

export { fetchCategoryNews, fetchAllNews, fetchAllNewsWithErrors } from './news';
export type { FetchNewsResult } from './news';
export {
	fetchCryptoPrices,
	fetchIndices,
	fetchSectorPerformance,
	fetchCommodities,
	fetchAllMarkets
} from './markets';
export { fetchPolymarket, fetchWhaleTransactions, fetchGovContracts, fetchLayoffs, fetchOutageData, fetchVIEWSConflicts, fetchUCDPConflicts, fetchGridStress, fetchAllGridStress, gridStressToOutages, fetchRainViewerData, getLatestRadarTileUrl, fetchAircraftPositions, OpenSkyRateLimitError, getAltitudeColor, formatAltitude, formatVelocity, formatHeading, fetchElevatedVolcanoes, VOLCANO_ALERT_COLORS, VOLCANO_ALERT_DESCRIPTIONS, fetchVesselPositions, getShipTypeName, getShipTypeColor, formatVesselSpeed, formatVesselCourse, getFlagEmoji, fetchAirQualityData, AIR_QUALITY_COLORS, AIR_QUALITY_DESCRIPTIONS, getAirQualityLevel, calculateAQI, fetchEarthquakes, getEarthquakeSeverity, getEarthquakeColor, fetchDiseaseOutbreaks, getDiseaseOutbreakColor, DISEASE_OUTBREAK_COLORS, fetchRadiationData, RADIATION_LEVEL_COLORS, RADIATION_LEVEL_DESCRIPTIONS, getRadiationLevelColor, fetchFedBalanceData } from './misc';
export type { Prediction, PredictionCategory, WhaleTransaction, Contract, Layoff, OutageData, VIEWSConflictData, VIEWSConflictHotspot, VIEWSConflictArc, VIEWSCountryPrediction, VIEWSResponse, UCDPConflictData, UCDPConflictHotspot, UCDPConflictArc, GridStressData, GridRegion, RainViewerData, RainViewerTimestamp, Vessel, RadiationReading, RadiationLevel, FedBalanceData } from './misc';
export { fetchWorldLeaders } from './leaders';

// Cached API exports - use these for automatic caching
export { cachedApi, clearAllCaches, getCacheStats, invalidateCache } from './cached';

// Weather API
export {
	fetchAlertsByState,
	fetchAlertsByZone,
	fetchAllActiveAlerts,
	fetchAlertsForStates,
	fetchGridPoint,
	fetchForecast,
	fetchZoneInfo,
	fetchZoneGeometryForAlert,
	extractForecastHighlights,
	generateBriefingText,
	generateBriefingMarkdown
} from './weather';
