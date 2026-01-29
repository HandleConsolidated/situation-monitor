/**
 * Signal vs Noise Classifier
 * Scores events/items by importance to filter out low-value alerts
 */

import type {
	SignalScore,
	SignalFactor,
	UserFeedback,
	ClassifierModel
} from '$lib/types/intelligence';
import type { NewsItem } from '$lib/types';

// Default classifier model (can be updated via ML training)
const DEFAULT_MODEL: ClassifierModel = {
	version: '1.0.0',
	trainedAt: new Date().toISOString(),
	accuracy: 0.85,
	weights: {
		source_credibility: 0.25,
		keyword_match: 0.20,
		magnitude: 0.20,
		recency: 0.15,
		geographic_relevance: 0.10,
		user_interest: 0.10
	},
	thresholds: {
		critical: 80,
		important: 60,
		relevant: 40
	}
};

// High-value keywords that boost signal strength
const CRITICAL_KEYWORDS = [
	'nuclear',
	'attack',
	'invasion',
	'earthquake',
	'tsunami',
	'pandemic',
	'outbreak',
	'carrier',
	'missile',
	'sanctions',
	'war',
	'crisis',
	'emergency',
	'disaster',
	'collapse',
	'default',
	'assassination',
	'coup'
];

const IMPORTANT_KEYWORDS = [
	'military',
	'deployment',
	'conflict',
	'protest',
	'election',
	'volcano',
	'hurricane',
	'cyber',
	'breach',
	'layoffs',
	'shutdown',
	'quarantine',
	'restriction'
];

// Trusted news sources (boost credibility)
const TRUSTED_SOURCES = [
	'reuters',
	'ap',
	'bbc',
	'nyt',
	'wsj',
	'ft',
	'bloomberg',
	'economist',
	'guardian',
	'wapo'
];

/**
 * Classify a news item as signal or noise
 */
export function classifyNewsItem(
	item: NewsItem,
	userFeedback: UserFeedback[] = [],
	model: ClassifierModel = DEFAULT_MODEL
): SignalScore {
	const factors: SignalFactor[] = [];

	// 1. Source Credibility (0-100)
	const sourceScore = calculateSourceCredibility(item.source);
	factors.push({
		name: 'Source Credibility',
		weight: model.weights.source_credibility,
		value: sourceScore,
		description: getTrustedSourceName(item.source) || 'Unknown source'
	});

	// 2. Keyword Match (0-100)
	const keywordScore = calculateKeywordScore(item.title + ' ' + (item.description || ''));
	factors.push({
		name: 'Keyword Relevance',
		weight: model.weights.keyword_match,
		value: keywordScore,
		description: keywordScore > 80 ? 'Critical keywords detected' : keywordScore > 60 ? 'Important keywords' : 'Standard content'
	});

	// 3. Recency (0-100)
	const recencyScore = calculateRecency(item.timestamp);
	factors.push({
		name: 'Recency',
		weight: model.weights.recency,
		value: recencyScore,
		description: recencyScore > 90 ? 'Just happened' : recencyScore > 70 ? 'Recent' : 'Older news'
	});

	// 4. Geographic Relevance (0-100)
	const geoScore = calculateGeographicRelevance(item);
	factors.push({
		name: 'Geographic Relevance',
		weight: model.weights.geographic_relevance,
		value: geoScore,
		description: item.region || 'Global'
	});

	// 5. User Interest (0-100) - Based on historical feedback
	const userInterestScore = calculateUserInterest(item, userFeedback);
	factors.push({
		name: 'User Interest',
		weight: model.weights.user_interest,
		value: userInterestScore,
		description: userInterestScore > 70 ? 'High interest topic' : userInterestScore > 40 ? 'Moderate interest' : 'Low interest'
	});

	// Calculate weighted signal strength
	const signalStrength = factors.reduce((total, factor) => {
		return total + factor.value * factor.weight;
	}, 0);

	// Classify based on thresholds
	let classification: SignalScore['classification'];
	if (signalStrength >= model.thresholds.critical) {
		classification = 'critical';
	} else if (signalStrength >= model.thresholds.important) {
		classification = 'important';
	} else if (signalStrength >= model.thresholds.relevant) {
		classification = 'relevant';
	} else {
		classification = 'noise';
	}

	// Generate reasoning
	const reasoning = generateReasoning(classification, factors);

	return {
		itemId: item.id,
		itemType: 'news',
		signalStrength: Math.round(signalStrength),
		classification,
		confidence: model.accuracy,
		factors,
		reasoning,
		timestamp: new Date().toISOString()
	};
}

/**
 * Calculate source credibility score
 */
function calculateSourceCredibility(source: string): number {
	const lowerSource = source.toLowerCase();
	
	// Check if it's a trusted source
	const isTrusted = TRUSTED_SOURCES.some(trusted => lowerSource.includes(trusted));
	if (isTrusted) return 90;

	// Check for common news domains
	if (lowerSource.includes('news') || lowerSource.includes('.gov')) return 70;
	
	// Social media or blogs
	if (lowerSource.includes('twitter') || lowerSource.includes('reddit') || lowerSource.includes('blog')) return 40;

	// Unknown source
	return 50;
}

/**
 * Get human-readable source name
 */
function getTrustedSourceName(source: string): string | null {
	const lowerSource = source.toLowerCase();
	const match = TRUSTED_SOURCES.find(trusted => lowerSource.includes(trusted));
	
	const names: Record<string, string> = {
		'reuters': 'Reuters',
		'ap': 'Associated Press',
		'bbc': 'BBC',
		'nyt': 'New York Times',
		'wsj': 'Wall Street Journal',
		'ft': 'Financial Times',
		'bloomberg': 'Bloomberg',
		'economist': 'The Economist',
		'guardian': 'The Guardian',
		'wapo': 'Washington Post'
	};

	return match ? names[match] : null;
}

/**
 * Calculate keyword relevance score
 */
function calculateKeywordScore(text: string): number {
	const lowerText = text.toLowerCase();

	// Critical keywords = high score
	const hasCritical = CRITICAL_KEYWORDS.some(kw => lowerText.includes(kw));
	if (hasCritical) return 95;

	// Important keywords = medium score
	const hasImportant = IMPORTANT_KEYWORDS.some(kw => lowerText.includes(kw));
	if (hasImportant) return 70;

	// Generic news = low score
	return 30;
}

/**
 * Calculate recency score (newer = higher)
 */
function calculateRecency(timestamp: number): number {
	const now = Date.now();
	const ageMs = now - timestamp;
	const ageHours = ageMs / (1000 * 60 * 60);

	if (ageHours < 1) return 100; // Last hour
	if (ageHours < 6) return 90;  // Last 6 hours
	if (ageHours < 24) return 75; // Last day
	if (ageHours < 72) return 50; // Last 3 days
	return 25; // Older than 3 days
}

/**
 * Calculate geographic relevance
 */
function calculateGeographicRelevance(item: NewsItem): number {
	// High-priority regions (based on typical geopolitical interest)
	const highPriorityRegions = [
		'taiwan',
		'ukraine',
		'middle east',
		'israel',
		'iran',
		'north korea',
		'south china sea',
		'russia',
		'china'
	];

	const region = (item.region || '').toLowerCase();
	const text = (item.title + ' ' + (item.description || '')).toLowerCase();

	const isHighPriority = highPriorityRegions.some(r => 
		region.includes(r) || text.includes(r)
	);

	if (isHighPriority) return 90;
	if (region) return 60; // Has region but not high priority
	return 40; // No specific region
}

/**
 * Calculate user interest based on past feedback
 */
function calculateUserInterest(item: NewsItem, feedback: UserFeedback[]): number {
	if (feedback.length === 0) return 50; // Neutral if no history

	// Extract keywords from this item
	const itemKeywords = extractKeywords(item.title + ' ' + (item.description || ''));

	// Find feedback on similar items (matching keywords)
	const relevantFeedback = feedback.filter(fb => {
		// Check if feedback item shares keywords (simplified - would need item lookup)
		return fb.action === 'save' || fb.action === 'flag';
	});

	// Simple scoring: more saves/flags = higher interest
	const saveCount = relevantFeedback.filter(fb => fb.action === 'save').length;
	const flagCount = relevantFeedback.filter(fb => fb.action === 'flag').length;
	const dismissCount = feedback.filter(fb => fb.action === 'dismiss').length;

	const interestScore = (saveCount * 20 + flagCount * 15) - (dismissCount * 5);
	return Math.max(0, Math.min(100, 50 + interestScore));
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
	const lowerText = text.toLowerCase();
	const allKeywords = [...CRITICAL_KEYWORDS, ...IMPORTANT_KEYWORDS];
	return allKeywords.filter(kw => lowerText.includes(kw));
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
	classification: SignalScore['classification'],
	factors: SignalFactor[]
): string {
	const topFactors = factors
		.sort((a, b) => b.value * b.weight - a.value * a.weight)
		.slice(0, 3)
		.map(f => f.description)
		.join(', ');

	const classificationText = {
		critical: 'Critical signal',
		important: 'Important signal',
		relevant: 'Relevant information',
		noise: 'Low-priority noise'
	}[classification];

	return `${classificationText}: ${topFactors}`;
}

/**
 * Filter items by signal threshold
 */
export function filterBySignal<T extends { id: string }>(
	items: T[],
	scores: SignalScore[],
	minStrength: number
): T[] {
	const scoreMap = new Map(scores.map(s => [s.itemId, s.signalStrength]));
	
	return items.filter(item => {
		const score = scoreMap.get(item.id);
		return score !== undefined && score >= minStrength;
	});
}

/**
 * Get classification statistics
 */
export function getClassificationStats(scores: SignalScore[]): {
	total: number;
	critical: number;
	important: number;
	relevant: number;
	noise: number;
	avgStrength: number;
} {
	return {
		total: scores.length,
		critical: scores.filter(s => s.classification === 'critical').length,
		important: scores.filter(s => s.classification === 'important').length,
		relevant: scores.filter(s => s.classification === 'relevant').length,
		noise: scores.filter(s => s.classification === 'noise').length,
		avgStrength: scores.reduce((sum, s) => sum + s.signalStrength, 0) / (scores.length || 1)
	};
}

/**
 * Update model based on user feedback (simple version)
 */
export function updateModelFromFeedback(
	feedback: UserFeedback[],
	currentModel: ClassifierModel = DEFAULT_MODEL
): ClassifierModel {
	// Count saves, dismissals, flags
	const saves = feedback.filter(f => f.action === 'save').length;
	const dismissals = feedback.filter(f => f.action === 'dismiss').length;
	const flags = feedback.filter(f => f.action === 'flag').length;

	// Adjust thresholds based on user behavior
	// If user saves a lot, lower thresholds (show more)
	// If user dismisses a lot, raise thresholds (show less)
	const saveDismissRatio = saves / (dismissals || 1);

	let thresholdAdjustment = 0;
	if (saveDismissRatio > 2) thresholdAdjustment = -5; // User wants more
	if (saveDismissRatio < 0.5) thresholdAdjustment = 5; // User wants less

	return {
		...currentModel,
		thresholds: {
			critical: Math.max(70, Math.min(90, currentModel.thresholds.critical + thresholdAdjustment)),
			important: Math.max(50, Math.min(70, currentModel.thresholds.important + thresholdAdjustment)),
			relevant: Math.max(30, Math.min(50, currentModel.thresholds.relevant + thresholdAdjustment))
		},
		trainedAt: new Date().toISOString()
	};
}
