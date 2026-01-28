/**
 * Alert Trend Tracking
 * Tracks alert escalations (Watch → Warning) and de-escalations
 * Provides historical context for weather alerts
 */

import { browser } from '$app/environment';
import type { WeatherAlert, AlertSeverity } from '$lib/types';

const HISTORY_STORAGE_KEY = 'alertHistory';
const MAX_HISTORY_HOURS = 24; // Keep 24 hours of history
const MAX_HISTORY_ENTRIES = 500; // Cap total entries

/**
 * Alert history entry
 */
export interface AlertHistoryEntry {
	id: string;
	event: string;
	areaDesc: string;
	severity: AlertSeverity;
	timestamp: number;
	headline: string | null;
	expires: string;
}

/**
 * Alert trend status
 */
export type TrendStatus = 
	| 'new'           // First time seeing this alert
	| 'escalated'     // Upgraded (e.g., Watch → Warning)
	| 'de-escalated'  // Downgraded
	| 'unchanged'     // Same severity as before
	| 'expired';      // Alert has expired

/**
 * Alert with trend information
 */
export interface AlertWithTrend extends WeatherAlert {
	trend: TrendStatus;
	previousSeverity?: AlertSeverity;
	firstSeen?: number;
	escalationTime?: number;
}

/**
 * Severity ranking (lower = more severe)
 */
const SEVERITY_RANK: Record<AlertSeverity, number> = {
	'Extreme': 0,
	'Severe': 1,
	'Moderate': 2,
	'Minor': 3,
	'Unknown': 4
};

/**
 * Alert type escalation patterns
 * Maps watch/advisory events to their warning counterparts
 */
const ESCALATION_PATTERNS: Record<string, string[]> = {
	// Tornado
	'Tornado Watch': ['Tornado Warning'],
	'Tornado Warning': [],
	
	// Severe Thunderstorm
	'Severe Thunderstorm Watch': ['Severe Thunderstorm Warning'],
	'Severe Thunderstorm Warning': [],
	
	// Winter Weather
	'Winter Storm Watch': ['Winter Storm Warning', 'Blizzard Warning', 'Ice Storm Warning'],
	'Winter Weather Advisory': ['Winter Storm Warning', 'Blizzard Warning'],
	'Winter Storm Warning': ['Blizzard Warning'],
	
	// Flood
	'Flood Watch': ['Flood Warning', 'Flash Flood Warning'],
	'Flood Advisory': ['Flood Warning', 'Flash Flood Warning'],
	'Flood Warning': ['Flash Flood Warning'],
	'Flash Flood Watch': ['Flash Flood Warning'],
	
	// Hurricane/Tropical
	'Tropical Storm Watch': ['Tropical Storm Warning', 'Hurricane Watch', 'Hurricane Warning'],
	'Tropical Storm Warning': ['Hurricane Watch', 'Hurricane Warning'],
	'Hurricane Watch': ['Hurricane Warning'],
	
	// Heat
	'Heat Advisory': ['Excessive Heat Warning'],
	'Excessive Heat Watch': ['Excessive Heat Warning'],
	
	// Wind
	'Wind Advisory': ['High Wind Warning'],
	'High Wind Watch': ['High Wind Warning'],
	
	// Fire
	'Fire Weather Watch': ['Red Flag Warning'],
	
	// Coastal
	'Coastal Flood Watch': ['Coastal Flood Warning'],
	'Coastal Flood Advisory': ['Coastal Flood Warning'],
};

/**
 * Load alert history from localStorage
 */
function loadHistory(): AlertHistoryEntry[] {
	if (!browser) return [];
	
	try {
		const data = localStorage.getItem(HISTORY_STORAGE_KEY);
		if (!data) return [];
		
		const history: AlertHistoryEntry[] = JSON.parse(data);
		const cutoff = Date.now() - (MAX_HISTORY_HOURS * 60 * 60 * 1000);
		
		// Filter out old entries
		return history.filter(entry => entry.timestamp > cutoff);
	} catch (e) {
		console.warn('Failed to load alert history:', e);
		return [];
	}
}

/**
 * Save alert history to localStorage
 */
function saveHistory(history: AlertHistoryEntry[]): void {
	if (!browser) return;
	
	try {
		// Trim to max entries
		const trimmed = history.slice(0, MAX_HISTORY_ENTRIES);
		localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
	} catch (e) {
		console.warn('Failed to save alert history:', e);
	}
}

/**
 * Create a unique key for matching alerts across updates
 * Uses event type + area to match, not the NWS ID which changes on updates
 */
function getAlertKey(alert: WeatherAlert | AlertHistoryEntry): string {
	const area = 'areaDesc' in alert ? alert.areaDesc : alert.areaDesc;
	const event = alert.event;
	// Normalize by removing "Watch"/"Warning"/"Advisory" for matching
	const baseEvent = event
		.replace(/ Watch$/, '')
		.replace(/ Warning$/, '')
		.replace(/ Advisory$/, '')
		.replace(/ Statement$/, '');
	return `${baseEvent}::${area}`;
}

/**
 * Check if alert B is an escalation of alert A
 */
function isEscalation(previous: AlertHistoryEntry, current: WeatherAlert): boolean {
	// Check severity increase
	if (SEVERITY_RANK[current.severity] < SEVERITY_RANK[previous.severity]) {
		return true;
	}
	
	// Check event type escalation (e.g., Watch → Warning)
	const escalationTargets = ESCALATION_PATTERNS[previous.event];
	if (escalationTargets && escalationTargets.includes(current.event)) {
		return true;
	}
	
	return false;
}

/**
 * Check if alert B is a de-escalation of alert A
 */
function isDeEscalation(previous: AlertHistoryEntry, current: WeatherAlert): boolean {
	// Check severity decrease
	if (SEVERITY_RANK[current.severity] > SEVERITY_RANK[previous.severity]) {
		return true;
	}
	
	// Check if previous was a warning and current is a watch/advisory
	const currentIsWatch = current.event.includes('Watch') || current.event.includes('Advisory');
	const previousWasWarning = previous.event.includes('Warning');
	
	if (currentIsWatch && previousWasWarning) {
		return true;
	}
	
	return false;
}

/**
 * Analyze alerts and add trend information
 * Also updates the history store
 */
export function analyzeAlertTrends(alerts: WeatherAlert[]): AlertWithTrend[] {
	const history = loadHistory();
	const now = Date.now();
	const result: AlertWithTrend[] = [];
	const newHistoryEntries: AlertHistoryEntry[] = [];
	
	// Build a map of recent history by alert key
	const historyByKey = new Map<string, AlertHistoryEntry[]>();
	for (const entry of history) {
		const key = getAlertKey(entry);
		if (!historyByKey.has(key)) {
			historyByKey.set(key, []);
		}
		historyByKey.get(key)!.push(entry);
	}
	
	// Sort history entries by timestamp (newest first)
	for (const entries of historyByKey.values()) {
		entries.sort((a, b) => b.timestamp - a.timestamp);
	}
	
	// Analyze each current alert
	for (const alert of alerts) {
		const key = getAlertKey(alert);
		const previousEntries = historyByKey.get(key) || [];
		const mostRecent = previousEntries[0];
		
		let trend: TrendStatus = 'new';
		let previousSeverity: AlertSeverity | undefined;
		let firstSeen: number | undefined;
		let escalationTime: number | undefined;
		
		if (mostRecent) {
			// We have history for this alert area/type
			firstSeen = previousEntries[previousEntries.length - 1]?.timestamp;
			
			if (isEscalation(mostRecent, alert)) {
				trend = 'escalated';
				previousSeverity = mostRecent.severity;
				escalationTime = now;
			} else if (isDeEscalation(mostRecent, alert)) {
				trend = 'de-escalated';
				previousSeverity = mostRecent.severity;
			} else if (mostRecent.severity === alert.severity && mostRecent.event === alert.event) {
				trend = 'unchanged';
			} else {
				// Different but not clearly escalated/de-escalated
				trend = 'unchanged';
			}
		}
		
		result.push({
			...alert,
			trend,
			previousSeverity,
			firstSeen,
			escalationTime
		});
		
		// Add to new history
		newHistoryEntries.push({
			id: alert.id,
			event: alert.event,
			areaDesc: alert.areaDesc,
			severity: alert.severity,
			timestamp: now,
			headline: alert.headline,
			expires: alert.expires
		});
	}
	
	// Merge new entries with existing history
	const updatedHistory = [...newHistoryEntries, ...history];
	saveHistory(updatedHistory);
	
	return result;
}

/**
 * Get trend display info for UI
 */
export function getTrendDisplay(trend: TrendStatus): {
	label: string;
	icon: string;
	color: string;
	bgColor: string;
} {
	switch (trend) {
		case 'escalated':
			return {
				label: 'ESCALATED',
				icon: '⬆️',
				color: 'text-red-400',
				bgColor: 'bg-red-500/20'
			};
		case 'de-escalated':
			return {
				label: 'De-escalated',
				icon: '⬇️',
				color: 'text-green-400',
				bgColor: 'bg-green-500/20'
			};
		case 'new':
			return {
				label: 'NEW',
				icon: '🆕',
				color: 'text-yellow-400',
				bgColor: 'bg-yellow-500/20'
			};
		case 'unchanged':
			return {
				label: '',
				icon: '',
				color: 'text-slate-400',
				bgColor: ''
			};
		case 'expired':
			return {
				label: 'Expired',
				icon: '✓',
				color: 'text-slate-500',
				bgColor: 'bg-slate-500/20'
			};
	}
}

/**
 * Get time since first seen, formatted
 */
export function getTimeSinceFirstSeen(firstSeen: number | undefined): string {
	if (!firstSeen) return '';
	
	const now = Date.now();
	const diffMs = now - firstSeen;
	const diffMins = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMins / 60);
	
	if (diffMins < 60) {
		return `${diffMins}m ago`;
	} else if (diffHours < 24) {
		const mins = diffMins % 60;
		return mins > 0 ? `${diffHours}h ${mins}m` : `${diffHours}h ago`;
	} else {
		return `${Math.floor(diffHours / 24)}d ago`;
	}
}

/**
 * Check for recent escalations (within last N minutes)
 */
export function getRecentEscalations(alerts: AlertWithTrend[], withinMinutes: number = 30): AlertWithTrend[] {
	const cutoff = Date.now() - (withinMinutes * 60 * 1000);
	return alerts.filter(a => 
		a.trend === 'escalated' && 
		a.escalationTime && 
		a.escalationTime > cutoff
	);
}

/**
 * Clear alert history (for testing/reset)
 */
export function clearAlertHistory(): void {
	if (browser) {
		localStorage.removeItem(HISTORY_STORAGE_KEY);
	}
}

/**
 * Get statistics about alert trends
 */
export function getAlertTrendStats(alerts: AlertWithTrend[]): {
	total: number;
	new: number;
	escalated: number;
	deEscalated: number;
	unchanged: number;
} {
	return {
		total: alerts.length,
		new: alerts.filter(a => a.trend === 'new').length,
		escalated: alerts.filter(a => a.trend === 'escalated').length,
		deEscalated: alerts.filter(a => a.trend === 'de-escalated').length,
		unchanged: alerts.filter(a => a.trend === 'unchanged').length
	};
}
