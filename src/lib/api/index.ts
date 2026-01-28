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
export { fetchPolymarket, fetchWhaleTransactions, fetchGovContracts, fetchLayoffs, fetchOutageData, fetchVIEWSConflicts, fetchUCDPConflicts, fetchGridStress, fetchAllGridStress, gridStressToOutages, fetchRainViewerData, getLatestRadarTileUrl, fetchRadarAnimationData, fetchAircraftPositions, OpenSkyRateLimitError, getAltitudeColor, formatAltitude, formatVelocity, formatHeading, fetchElevatedVolcanoes, VOLCANO_ALERT_COLORS, VOLCANO_ALERT_DESCRIPTIONS, fetchVesselPositions, getShipTypeName, getShipTypeColor, formatVesselSpeed, formatVesselCourse, getFlagEmoji, fetchAirQualityData, AIR_QUALITY_COLORS, AIR_QUALITY_DESCRIPTIONS, getAirQualityLevel, calculateAQI, fetchEarthquakes, getEarthquakeSeverity, getEarthquakeColor, fetchDiseaseOutbreaks, getDiseaseOutbreakColor, DISEASE_OUTBREAK_COLORS, fetchRadiationData, RADIATION_LEVEL_COLORS, RADIATION_LEVEL_DESCRIPTIONS, getRadiationLevelColor, fetchFedBalanceData } from './misc';
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
	fetchAlertsForPoint,
	fetchGridPoint,
	fetchForecast,
	fetchZoneInfo,
	fetchZoneGeometryForAlert,
	extractForecastHighlights,
	generateBriefingText,
	generateBriefingMarkdown
} from './weather';

// Tropical Cyclone and Convective Outlook API
export {
	fetchActiveTropicalCyclones,
	fetchCycloneForecastCone,
	fetchConvectiveOutlooks,
	fetchAllDay1Outlooks,
	fetchActiveWatches,
	fetchMesoscaleDiscussions,
	fetchTodayStormReports,
	fetchAllSevereWeatherData
} from './storms';

// Space Weather API (NOAA SWPC)
export {
	fetchSpaceWeather,
	fetchSpaceWeatherAlerts,
	getSpaceWeatherColor
} from './space-weather';
export type { SolarActivity, SpaceWeatherAlert } from './space-weather';

// International Weather API (Global Alerts)
export {
	fetchCanadaAlerts,
	fetchMeteoAlarmAlerts,
	fetchJMAAlerts,
	fetchBOMAlerts,
	fetchAllInternationalAlerts,
	getInternationalAlertColor,
	getCountryFlag,
	getInternationalAlertStats
} from './international-weather';
export type { InternationalAlert } from './international-weather';
