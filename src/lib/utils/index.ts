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
	getShipTypeColor,
	getShipTypeIcon,
	type DetectedMilitaryShip
} from './military-ship-detection';
