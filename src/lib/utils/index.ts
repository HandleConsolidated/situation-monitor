/**
 * Utilities barrel file
 */

export {
	timeAgo,
	getRelativeTime,
	formatCurrency,
	formatNumber,
	formatPercentChange,
	getChangeClass,
	escapeHtml,
	getDateDaysAgo,
	getToday,
	latLonToXY
} from './format';

export {
	exportToPDF,
	downloadAsHTML,
	copyToClipboard
} from './pdf-export';

export {
	analyzeAlertTrends,
	getTrendDisplay,
	getTimeSinceFirstSeen,
	getRecentEscalations,
	clearAlertHistory,
	getAlertTrendStats,
	type AlertWithTrend,
	type AlertHistoryEntry,
	type TrendStatus
} from './alert-trends';

export {
	detectMilitaryShips,
	detectMilitaryShipsWithTracking,
	getShipTypeColor,
	getShipTypeIcon,
	updateShipTracking,
	getShipTrackingHistory,
	cleanupTrackingHistory,
	checkProximityAlerts,
	getProximityAlertColor,
	formatProximityAlert,
	type DetectedMilitaryShip,
	type ShipPosition,
	type ProximityAlert
} from './military-ship-detection';
