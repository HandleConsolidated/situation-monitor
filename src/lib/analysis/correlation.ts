/**
 * Correlation engine - analyzes patterns across news items
 * Enhanced with better pattern detection, weighted scoring, and predictive signals
 */

import type { NewsItem } from '$lib/types';
import { CORRELATION_TOPICS, SOURCE_TYPES, type CorrelationTopic } from '$lib/config/analysis';

// Types for correlation results
export interface HeadlineEntry {
	title: string;
	link: string;
	source: string;
	timestamp?: number;
	hasPredictiveIndicator?: boolean;
}

export interface EmergingPattern {
	id: string;
	name: string;
	category: string;
	count: number;
	weightedScore: number; // Score adjusted by topic weight
	level: 'critical' | 'high' | 'elevated' | 'emerging';
	sources: string[];
	sourceTypes: {
		mainstream: number;
		fringe: number;
		alternative: number;
		institutional: number;
	};
	headlines: HeadlineEntry[];
	relatedTopics: string[]; // Other topics that co-occur
	velocity: number; // Rate of change (mentions per hour)
}

export interface MomentumSignal {
	id: string;
	name: string;
	category: string;
	current: number;
	previous: number;
	delta: number;
	deltaPercent: number;
	momentum: 'surging' | 'rising' | 'stable' | 'declining';
	acceleration: 'accelerating' | 'steady' | 'decelerating';
	headlines: HeadlineEntry[];
	peakTime?: number; // When this topic was at its peak
}

export interface CrossSourceCorrelation {
	id: string;
	name: string;
	category: string;
	sourceCount: number;
	sources: string[];
	sourceBreakdown: {
		mainstream: string[];
		fringe: string[];
		alternative: string[];
		institutional: string[];
	};
	level: 'high' | 'elevated' | 'emerging';
	consensusScore: number; // 0-100, how much agreement across source types
	headlines: HeadlineEntry[];
}

export interface PredictiveSignal {
	id: string;
	name: string;
	category: string;
	score: number;
	confidence: number;
	prediction: string;
	predictiveIndicators: string[]; // Which indicators triggered this
	level: 'critical' | 'high' | 'medium' | 'low';
	timeframe: string; // Expected timeframe for prediction
	headlines: HeadlineEntry[];
	supportingFactors: string[];
}

export interface TopicCluster {
	id: string;
	name: string;
	topics: string[];
	totalMentions: number;
	dominantCategory: string;
}

export interface CorrelationResults {
	emergingPatterns: EmergingPattern[];
	momentumSignals: MomentumSignal[];
	crossSourceCorrelations: CrossSourceCorrelation[];
	predictiveSignals: PredictiveSignal[];
	topicClusters: TopicCluster[];
	overallActivityLevel: 'critical' | 'high' | 'elevated' | 'normal' | 'low';
	dominantCategory: string;
	totalTopicsDetected: number;
}

// Topic history for momentum analysis - stores count per minute
const topicHistory: Record<number, Record<string, number>> = {};

// Acceleration tracking - stores delta per minute
const accelerationHistory: Record<number, Record<string, number>> = {};

// Peak tracking
const topicPeaks: Record<string, { count: number; timestamp: number }> = {};

// History retention in minutes
const HISTORY_RETENTION_MINUTES = 60;

// Time window for momentum comparison in minutes
const MOMENTUM_WINDOW_MINUTES = 10;

// Velocity calculation window in minutes
const VELOCITY_WINDOW_MINUTES = 15;

/**
 * Format topic ID to display name
 */
function formatTopicName(id: string): string {
	return id.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Classify a source into source type
 */
function classifySource(
	source: string
): 'mainstream' | 'fringe' | 'alternative' | 'institutional' | 'unknown' {
	const lowerSource = source.toLowerCase();

	for (const src of SOURCE_TYPES.institutional) {
		if (lowerSource.includes(src)) return 'institutional';
	}
	for (const src of SOURCE_TYPES.mainstream) {
		if (lowerSource.includes(src)) return 'mainstream';
	}
	for (const src of SOURCE_TYPES.fringe) {
		if (lowerSource.includes(src)) return 'fringe';
	}
	for (const src of SOURCE_TYPES.alternative) {
		if (lowerSource.includes(src)) return 'alternative';
	}
	return 'unknown';
}

/**
 * Check if title contains predictive indicators for a topic
 */
function findPredictiveIndicators(title: string, topic: CorrelationTopic): string[] {
	const found: string[] = [];
	const lowerTitle = title.toLowerCase();

	if (topic.predictiveIndicators) {
		for (const indicator of topic.predictiveIndicators) {
			if (lowerTitle.includes(indicator.toLowerCase())) {
				found.push(indicator);
			}
		}
	}
	return found;
}

/**
 * Calculate velocity (mentions per hour)
 */
function calculateVelocity(topicId: string, currentCount: number): number {
	const now = Math.floor(Date.now() / 60000);

	// Get counts from VELOCITY_WINDOW_MINUTES ago
	let oldestCount = 0;
	let oldestTime = now;

	for (let i = VELOCITY_WINDOW_MINUTES; i >= 1; i--) {
		const timeKey = now - i;
		if (topicHistory[timeKey] && topicHistory[timeKey][topicId] !== undefined) {
			oldestCount = topicHistory[timeKey][topicId];
			oldestTime = timeKey;
			break;
		}
	}

	const minutesPassed = now - oldestTime;
	if (minutesPassed <= 0) return 0;

	const countDiff = currentCount - oldestCount;
	// Convert to per-hour rate
	return Math.round((countDiff / minutesPassed) * 60);
}

/**
 * Calculate acceleration (is momentum increasing or decreasing?)
 */
function calculateAcceleration(
	topicId: string,
	currentDelta: number
): 'accelerating' | 'steady' | 'decelerating' {
	const now = Math.floor(Date.now() / 60000);
	const oldTime = now - MOMENTUM_WINDOW_MINUTES;

	const oldDelta = accelerationHistory[oldTime]?.[topicId] || 0;
	const accelDiff = currentDelta - oldDelta;

	if (accelDiff > 1) return 'accelerating';
	if (accelDiff < -1) return 'decelerating';
	return 'steady';
}

/**
 * Find related topics (topics that co-occur in the same headlines)
 */
function findRelatedTopics(
	topicId: string,
	allNews: NewsItem[],
	topicHeadlines: Record<string, HeadlineEntry[]>
): string[] {
	const headlines = topicHeadlines[topicId] || [];
	const headlineTitles = new Set(headlines.map((h) => h.title));

	const coOccurrence: Record<string, number> = {};

	for (const topic of CORRELATION_TOPICS) {
		if (topic.id === topicId) continue;

		for (const item of allNews) {
			const title = item.title || '';
			if (!headlineTitles.has(title)) continue;

			for (const pattern of topic.patterns) {
				pattern.lastIndex = 0;
				if (pattern.test(title)) {
					coOccurrence[topic.id] = (coOccurrence[topic.id] || 0) + 1;
					break;
				}
			}
		}
	}

	return Object.entries(coOccurrence)
		.filter(([, count]) => count >= 2)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([id]) => formatTopicName(id));
}

/**
 * Calculate consensus score based on source type diversity
 */
function calculateConsensusScore(sourceBreakdown: {
	mainstream: string[];
	fringe: string[];
	alternative: string[];
	institutional: string[];
}): number {
	const types = [
		sourceBreakdown.mainstream.length > 0 ? 1 : 0,
		sourceBreakdown.fringe.length > 0 ? 1 : 0,
		sourceBreakdown.alternative.length > 0 ? 1 : 0,
		sourceBreakdown.institutional.length > 0 ? 1 : 0
	];

	const typesWithCoverage = types.reduce((a, b) => a + b, 0);

	// Base score on number of source types covering the topic
	// Higher score if mainstream and institutional agree
	let score = typesWithCoverage * 20;

	// Bonus for mainstream + institutional agreement
	if (sourceBreakdown.mainstream.length > 0 && sourceBreakdown.institutional.length > 0) {
		score += 20;
	}

	// Bonus for cross-spectrum coverage
	if (sourceBreakdown.mainstream.length > 0 && sourceBreakdown.fringe.length > 0) {
		score += 10;
	}

	return Math.min(100, score);
}

/**
 * Detect topic clusters (groups of related topics)
 */
function detectTopicClusters(
	topicCounts: Record<string, number>,
	_allNews: NewsItem[]
): TopicCluster[] {
	const clusters: TopicCluster[] = [];

	// Category-based clustering
	const categoryGroups: Record<string, { topics: string[]; count: number }> = {};

	for (const topic of CORRELATION_TOPICS) {
		const count = topicCounts[topic.id] || 0;
		if (count < 2) continue;

		if (!categoryGroups[topic.category]) {
			categoryGroups[topic.category] = { topics: [], count: 0 };
		}
		categoryGroups[topic.category].topics.push(topic.id);
		categoryGroups[topic.category].count += count;
	}

	// Create clusters from categories with multiple topics
	for (const [category, data] of Object.entries(categoryGroups)) {
		if (data.topics.length >= 2) {
			clusters.push({
				id: `cluster-${category.toLowerCase()}`,
				name: `${category} Cluster`,
				topics: data.topics.map(formatTopicName),
				totalMentions: data.count,
				dominantCategory: category
			});
		}
	}

	return clusters.sort((a, b) => b.totalMentions - a.totalMentions).slice(0, 5);
}

/**
 * Analyze correlations across all news items
 * Enhanced with weighted scoring, velocity tracking, and predictive analysis
 */
export function analyzeCorrelations(allNews: NewsItem[]): CorrelationResults | null {
	if (!allNews || allNews.length === 0) return null;

	const now = Date.now();
	const currentTime = Math.floor(now / 60000); // Current minute

	const results: CorrelationResults = {
		emergingPatterns: [],
		momentumSignals: [],
		crossSourceCorrelations: [],
		predictiveSignals: [],
		topicClusters: [],
		overallActivityLevel: 'normal',
		dominantCategory: '',
		totalTopicsDetected: 0
	};

	// Count topics and track sources/headlines with enhanced data
	const topicCounts: Record<string, number> = {};
	const topicSources: Record<string, Set<string>> = {};
	const topicSourceTypes: Record<
		string,
		{ mainstream: Set<string>; fringe: Set<string>; alternative: Set<string>; institutional: Set<string> }
	> = {};
	const topicHeadlines: Record<string, HeadlineEntry[]> = {};
	const topicPredictiveIndicators: Record<string, Set<string>> = {};

	// Analyze each news item
	for (const item of allNews) {
		const title = item.title || '';
		const source = item.source || 'Unknown';
		const sourceType = classifySource(source);

		for (const topic of CORRELATION_TOPICS) {
			const matches = topic.patterns.some((p) => {
				p.lastIndex = 0;
				return p.test(title);
			});

			if (matches) {
				// Initialize tracking structures
				if (!topicCounts[topic.id]) {
					topicCounts[topic.id] = 0;
					topicSources[topic.id] = new Set();
					topicSourceTypes[topic.id] = {
						mainstream: new Set(),
						fringe: new Set(),
						alternative: new Set(),
						institutional: new Set()
					};
					topicHeadlines[topic.id] = [];
					topicPredictiveIndicators[topic.id] = new Set();
				}

				topicCounts[topic.id]++;
				topicSources[topic.id].add(source);

				// Track source type
				if (sourceType !== 'unknown') {
					topicSourceTypes[topic.id][sourceType].add(source);
				}

				// Track predictive indicators
				const indicators = findPredictiveIndicators(title, topic);
				for (const ind of indicators) {
					topicPredictiveIndicators[topic.id].add(ind);
				}

				// Store headline with metadata
				if (topicHeadlines[topic.id].length < 8) {
					topicHeadlines[topic.id].push({
						title,
						link: item.link,
						source,
						timestamp: item.timestamp,
						hasPredictiveIndicator: indicators.length > 0
					});
				}
			}
		}
	}

	// Update topic history for momentum tracking
	if (!topicHistory[currentTime]) {
		topicHistory[currentTime] = { ...topicCounts };

		// Clean old history entries
		for (const timeKey of Object.keys(topicHistory)) {
			if (currentTime - parseInt(timeKey) > HISTORY_RETENTION_MINUTES) {
				delete topicHistory[parseInt(timeKey)];
			}
		}
	}

	// Get old counts for momentum comparison
	const oldTime = currentTime - MOMENTUM_WINDOW_MINUTES;
	const oldCounts = topicHistory[oldTime] || {};

	// Calculate deltas and update acceleration history
	const currentDeltas: Record<string, number> = {};
	for (const topicId of Object.keys(topicCounts)) {
		currentDeltas[topicId] = topicCounts[topicId] - (oldCounts[topicId] || 0);
	}

	if (!accelerationHistory[currentTime]) {
		accelerationHistory[currentTime] = { ...currentDeltas };

		// Clean old acceleration history
		for (const timeKey of Object.keys(accelerationHistory)) {
			if (currentTime - parseInt(timeKey) > HISTORY_RETENTION_MINUTES) {
				delete accelerationHistory[parseInt(timeKey)];
			}
		}
	}

	// Track category totals for dominant category calculation
	const categoryTotals: Record<string, number> = {};

	// Process each topic
	for (const topic of CORRELATION_TOPICS) {
		const count = topicCounts[topic.id] || 0;
		if (count === 0) continue;

		results.totalTopicsDetected++;

		const sources = topicSources[topic.id] ? Array.from(topicSources[topic.id]) : [];
		const headlines = topicHeadlines[topic.id] || [];
		const oldCount = oldCounts[topic.id] || 0;
		const delta = count - oldCount;
		const weight = topic.weight || 1;
		const weightedScore = count * weight;
		const velocity = calculateVelocity(topic.id, count);

		// Track category totals
		categoryTotals[topic.category] = (categoryTotals[topic.category] || 0) + count;

		// Update peak tracking
		if (!topicPeaks[topic.id] || count > topicPeaks[topic.id].count) {
			topicPeaks[topic.id] = { count, timestamp: now };
		}

		// Source type breakdown
		const sourceTypes = topicSourceTypes[topic.id];
		const sourceBreakdown = {
			mainstream: Array.from(sourceTypes?.mainstream || []),
			fringe: Array.from(sourceTypes?.fringe || []),
			alternative: Array.from(sourceTypes?.alternative || []),
			institutional: Array.from(sourceTypes?.institutional || [])
		};

		// Emerging Patterns (weighted threshold)
		const emergingThreshold = 3;
		if (count >= emergingThreshold) {
			const level: EmergingPattern['level'] =
				weightedScore >= 20
					? 'critical'
					: weightedScore >= 12
						? 'high'
						: weightedScore >= 8
							? 'elevated'
							: 'emerging';

			results.emergingPatterns.push({
				id: topic.id,
				name: formatTopicName(topic.id),
				category: topic.category,
				count,
				weightedScore,
				level,
				sources,
				sourceTypes: {
					mainstream: sourceBreakdown.mainstream.length,
					fringe: sourceBreakdown.fringe.length,
					alternative: sourceBreakdown.alternative.length,
					institutional: sourceBreakdown.institutional.length
				},
				headlines,
				relatedTopics: findRelatedTopics(topic.id, allNews, topicHeadlines),
				velocity
			});
		}

		// Momentum Signals (enhanced with acceleration)
		const deltaPercent = oldCount > 0 ? Math.round((delta / oldCount) * 100) : delta > 0 ? 100 : 0;
		if (delta >= 2 || (count >= 3 && delta >= 1) || deltaPercent >= 50) {
			const momentum: MomentumSignal['momentum'] =
				delta >= 5
					? 'surging'
					: delta >= 2
						? 'rising'
						: delta < 0
							? 'declining'
							: 'stable';
			const acceleration = calculateAcceleration(topic.id, delta);

			results.momentumSignals.push({
				id: topic.id,
				name: formatTopicName(topic.id),
				category: topic.category,
				current: count,
				previous: oldCount,
				delta,
				deltaPercent,
				momentum,
				acceleration,
				headlines,
				peakTime: topicPeaks[topic.id]?.timestamp
			});
		}

		// Cross-Source Correlations (enhanced with consensus)
		if (sources.length >= 3) {
			const consensusScore = calculateConsensusScore(sourceBreakdown);
			const level: CrossSourceCorrelation['level'] =
				sources.length >= 6 || consensusScore >= 60
					? 'high'
					: sources.length >= 4
						? 'elevated'
						: 'emerging';

			results.crossSourceCorrelations.push({
				id: topic.id,
				name: formatTopicName(topic.id),
				category: topic.category,
				sourceCount: sources.length,
				sources,
				sourceBreakdown,
				level,
				consensusScore,
				headlines
			});
		}

		// Predictive Signals (enhanced with indicators)
		const predictiveInds = Array.from(topicPredictiveIndicators[topic.id] || []);
		const hasPredictiveIndicators = predictiveInds.length > 0;

		// Enhanced scoring with weights and predictive indicators
		const baseScore = count * weight + sources.length * 3 + delta * 5;
		const predictiveBonus = hasPredictiveIndicators ? predictiveInds.length * 10 : 0;
		const consensusBonus = calculateConsensusScore(sourceBreakdown) / 5;
		const score = baseScore + predictiveBonus + consensusBonus;

		if (score >= 15 || (hasPredictiveIndicators && count >= 2)) {
			const confidence = Math.min(95, Math.round(score * 1.2));
			const { prediction, timeframe, factors } = generatePrediction(topic, count, delta, predictiveInds);
			const level: PredictiveSignal['level'] =
				confidence >= 80
					? 'critical'
					: confidence >= 60
						? 'high'
						: confidence >= 40
							? 'medium'
							: 'low';

			results.predictiveSignals.push({
				id: topic.id,
				name: formatTopicName(topic.id),
				category: topic.category,
				score,
				confidence,
				prediction,
				predictiveIndicators: predictiveInds,
				level,
				timeframe,
				headlines,
				supportingFactors: factors
			});
		}
	}

	// Detect topic clusters
	results.topicClusters = detectTopicClusters(topicCounts, allNews);

	// Calculate overall activity level
	const totalSignals =
		results.emergingPatterns.length +
		results.momentumSignals.filter((m) => m.momentum === 'surging').length +
		results.predictiveSignals.filter((p) => p.level === 'critical' || p.level === 'high').length;

	results.overallActivityLevel =
		totalSignals >= 10
			? 'critical'
			: totalSignals >= 6
				? 'high'
				: totalSignals >= 3
					? 'elevated'
					: totalSignals >= 1
						? 'normal'
						: 'low';

	// Find dominant category
	const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
	results.dominantCategory = sortedCategories[0]?.[0] || 'None';

	// Sort results by relevance
	results.emergingPatterns.sort((a, b) => b.weightedScore - a.weightedScore);
	results.momentumSignals.sort((a, b) => {
		// Prioritize surging, then by delta
		const momentumOrder = { surging: 4, rising: 3, stable: 2, declining: 1 };
		const momentumDiff = momentumOrder[b.momentum] - momentumOrder[a.momentum];
		if (momentumDiff !== 0) return momentumDiff;
		return b.delta - a.delta;
	});
	results.crossSourceCorrelations.sort((a, b) => b.consensusScore - a.consensusScore);
	results.predictiveSignals.sort((a, b) => b.confidence - a.confidence);

	return results;
}

/**
 * Generate prediction text based on topic, count, and indicators
 */
function generatePrediction(
	topic: CorrelationTopic,
	count: number,
	delta: number,
	predictiveIndicators: string[]
): { prediction: string; timeframe: string; factors: string[] } {
	const factors: string[] = [];

	if (count >= 5) factors.push('High mention volume');
	if (delta >= 3) factors.push('Rapidly increasing coverage');
	if (predictiveIndicators.length > 0) factors.push(`Predictive language detected: ${predictiveIndicators.join(', ')}`);

	// Category-specific predictions
	if (topic.category === 'Economy' || topic.category === 'Finance') {
		if (topic.id === 'tariffs' && count >= 4) {
			return {
				prediction: 'Market volatility expected as trade tensions escalate',
				timeframe: 'Next 24-48 hours',
				factors: [...factors, 'Trade policy typically impacts markets within 1-2 days']
			};
		}
		if (topic.id === 'fed-rates') {
			return {
				prediction: 'Financial sector will see increased activity and coverage',
				timeframe: 'Next 1-7 days',
				factors: [...factors, 'Fed decisions drive extended market coverage']
			};
		}
		if (topic.id === 'bank-crisis') {
			return {
				prediction: 'Watch for contagion effects and regulatory responses',
				timeframe: 'Next 24-72 hours',
				factors: [...factors, 'Bank crises tend to cascade quickly']
			};
		}
		if (topic.id === 'recession' || topic.id === 'inflation') {
			return {
				prediction: 'Economic narrative likely to dominate news cycle',
				timeframe: 'Next 1-3 days',
				factors
			};
		}
	}

	if (topic.category === 'Conflict' || topic.category === 'Geopolitics') {
		if (topic.id.includes('russia') || topic.id.includes('ukraine')) {
			return {
				prediction: 'Expect breaking developments and diplomatic activity',
				timeframe: 'Next 12-48 hours',
				factors: [...factors, 'Active conflict zone with rapid developments']
			};
		}
		if (topic.id.includes('china') || topic.id.includes('taiwan')) {
			return {
				prediction: 'Geopolitical tensions may escalate or trigger market reactions',
				timeframe: 'Next 24-72 hours',
				factors: [...factors, 'US-China dynamics have broad implications']
			};
		}
		if (topic.id.includes('israel') || topic.id.includes('iran')) {
			return {
				prediction: 'Regional escalation possible, watch for military activity',
				timeframe: 'Next 12-24 hours',
				factors: [...factors, 'Middle East conflicts can escalate rapidly']
			};
		}
	}

	if (topic.category === 'Tech') {
		if (topic.id.includes('ai')) {
			return {
				prediction: 'AI narrative will continue building momentum',
				timeframe: 'Next 1-5 days',
				factors: [...factors, 'AI topics have sustained media attention']
			};
		}
		if (topic.id === 'cyber-attack') {
			return {
				prediction: 'Potential for broader impact disclosure or attribution',
				timeframe: 'Next 24-72 hours',
				factors: [...factors, 'Cyber incidents often reveal more details over time']
			};
		}
	}

	if (topic.category === 'Health') {
		if (topic.id === 'pandemic') {
			return {
				prediction: 'Health authorities may issue statements or guidance',
				timeframe: 'Next 24-48 hours',
				factors: [...factors, 'Pandemic coverage triggers official responses']
			};
		}
	}

	if (topic.category === 'Politics') {
		if (topic.id === 'election') {
			return {
				prediction: 'Polling and campaign coverage will intensify',
				timeframe: 'Next 1-7 days',
				factors
			};
		}
	}

	// Default prediction
	return {
		prediction: 'Topic gaining mainstream traction, expect continued coverage',
		timeframe: 'Next 24-48 hours',
		factors
	};
}

/**
 * Get correlation summary for status display
 */
export function getCorrelationSummary(results: CorrelationResults | null): {
	totalSignals: number;
	status: string;
	activityLevel: string;
	dominantCategory: string;
} {
	if (!results) {
		return { totalSignals: 0, status: 'NO DATA', activityLevel: 'low', dominantCategory: 'None' };
	}

	const totalSignals =
		results.emergingPatterns.length +
		results.momentumSignals.length +
		results.predictiveSignals.length;

	const criticalCount = results.predictiveSignals.filter(
		(p) => p.level === 'critical' || p.level === 'high'
	).length;

	const surgingCount = results.momentumSignals.filter((m) => m.momentum === 'surging').length;

	let status: string;
	if (criticalCount > 0) {
		status = `${criticalCount} CRITICAL`;
	} else if (surgingCount > 0) {
		status = `${surgingCount} SURGING`;
	} else if (totalSignals > 0) {
		status = `${totalSignals} SIGNALS`;
	} else {
		status = 'MONITORING';
	}

	return {
		totalSignals,
		status,
		activityLevel: results.overallActivityLevel,
		dominantCategory: results.dominantCategory
	};
}

/**
 * Get high-priority signals only
 */
export function getHighPrioritySignals(results: CorrelationResults | null): {
	patterns: EmergingPattern[];
	momentum: MomentumSignal[];
	predictions: PredictiveSignal[];
} {
	if (!results) {
		return { patterns: [], momentum: [], predictions: [] };
	}

	return {
		patterns: results.emergingPatterns.filter((p) => p.level === 'critical' || p.level === 'high'),
		momentum: results.momentumSignals.filter(
			(m) => m.momentum === 'surging' || m.acceleration === 'accelerating'
		),
		predictions: results.predictiveSignals.filter(
			(p) => p.level === 'critical' || p.level === 'high'
		)
	};
}

/**
 * Get topics by category
 */
export function getTopicsByCategory(
	results: CorrelationResults | null,
	category: string
): EmergingPattern[] {
	if (!results) return [];
	return results.emergingPatterns.filter((p) => p.category === category);
}

/**
 * Get cross-source validated topics (high consensus)
 */
export function getValidatedTopics(results: CorrelationResults | null): CrossSourceCorrelation[] {
	if (!results) return [];
	return results.crossSourceCorrelations.filter((c) => c.consensusScore >= 60);
}

/**
 * Clear topic history (for testing or reset)
 */
export function clearCorrelationHistory(): void {
	for (const key of Object.keys(topicHistory)) {
		delete topicHistory[parseInt(key)];
	}
	for (const key of Object.keys(accelerationHistory)) {
		delete accelerationHistory[parseInt(key)];
	}
	for (const key of Object.keys(topicPeaks)) {
		delete topicPeaks[key];
	}
}
