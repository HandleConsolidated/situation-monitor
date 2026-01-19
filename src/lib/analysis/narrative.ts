/**
 * Narrative tracker - analyzes fringe-to-mainstream narrative propagation
 * Enhanced with amplification detection, debunking tracking, and nuanced trend analysis
 */

import type { NewsItem } from '$lib/types';
import { NARRATIVE_PATTERNS, SOURCE_TYPES, type NarrativePattern } from '$lib/config/analysis';

// Source type classification
export type SourceType = 'fringe' | 'alternative' | 'mainstream' | 'institutional' | 'aggregator' | 'unknown';

// Narrative lifecycle stages
export type NarrativeStage = 'nascent' | 'emerging' | 'spreading' | 'crossing' | 'mainstream' | 'declining' | 'debunked';

// Types for narrative results
export interface HeadlineMatch {
	title: string;
	link: string;
	source: string;
	sourceType: SourceType;
	timestamp?: number;
	hasAmplification: boolean;
	hasDebunk: boolean;
	matchedKeywords: string[];
}

export interface NarrativeData {
	id: string;
	name: string;
	category: string;
	severity: NarrativePattern['severity'];
	count: number;
	fringeCount: number;
	alternativeCount: number;
	mainstreamCount: number;
	institutionalCount: number;
	sources: string[];
	sourceBreakdown: Record<SourceType, string[]>;
	headlines: HeadlineMatch[];
	keywords: string[];
	matchedKeywords: string[]; // Which keywords actually matched
	amplificationScore: number; // 0-100, how amplified is this narrative
	debunkScore: number; // 0-100, how debunked is this narrative
	stage: NarrativeStage;
	velocity: number; // Rate of spread
	firstSeenTimestamp?: number;
	timeSinceFirstSeen?: number; // In minutes
}

export interface EmergingFringe extends NarrativeData {
	status: 'nascent' | 'emerging' | 'spreading' | 'viral';
	spreadRate: 'slow' | 'moderate' | 'fast' | 'explosive';
	predictedCrossover: boolean; // Likely to cross to mainstream
	riskLevel: 'low' | 'medium' | 'high';
}

export interface FringeToMainstream extends NarrativeData {
	status: 'crossing' | 'crossed';
	crossoverLevel: number; // 0-100
	crossoverDirection: 'fringe-to-mainstream' | 'mainstream-to-fringe' | 'simultaneous';
	timeToMainstream?: number; // Minutes from first fringe mention to mainstream
	validationStatus: 'unverified' | 'partially-verified' | 'verified' | 'disputed' | 'debunked';
}

export interface DisinfoSignal extends NarrativeData {
	threatLevel: 'low' | 'medium' | 'high' | 'critical';
	indicators: string[];
	countermeasures: string[]; // Fact-checks, debunks found
	spreadPattern: 'organic' | 'coordinated' | 'unknown';
}

export interface NarrativeResults {
	emergingFringe: EmergingFringe[];
	fringeToMainstream: FringeToMainstream[];
	narrativeWatch: NarrativeData[];
	disinfoSignals: DisinfoSignal[];
	activeNarratives: number;
	crossingNarratives: number;
	highRiskCount: number;
	overallThreatLevel: 'low' | 'elevated' | 'high' | 'critical';
	dominantCategory: string;
}

// Track narrative history for crossover detection
interface NarrativeHistoryEntry {
	firstSeen: number;
	sources: Set<string>;
	sourceTypesOverTime: Array<{ timestamp: number; types: SourceType[] }>;
	countHistory: Array<{ timestamp: number; count: number }>;
	fringeToMainstreamTime?: number; // When it first appeared in mainstream
}

const narrativeHistory: Record<string, NarrativeHistoryEntry> = {};

// History retention in minutes
const HISTORY_RETENTION_MINUTES = 120;

/**
 * Format narrative ID to display name
 */
function formatNarrativeName(id: string): string {
	return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Classify source type with enhanced categories
 */
function classifySource(source: string): SourceType {
	const lowerSource = source.toLowerCase();

	// Check institutional first (most specific)
	for (const src of SOURCE_TYPES.institutional) {
		if (lowerSource.includes(src)) return 'institutional';
	}
	// Check mainstream
	for (const src of SOURCE_TYPES.mainstream) {
		if (lowerSource.includes(src)) return 'mainstream';
	}
	// Check fringe
	for (const src of SOURCE_TYPES.fringe) {
		if (lowerSource.includes(src)) return 'fringe';
	}
	// Check alternative
	for (const src of SOURCE_TYPES.alternative) {
		if (lowerSource.includes(src)) return 'alternative';
	}
	// Check aggregator
	for (const src of SOURCE_TYPES.aggregator) {
		if (lowerSource.includes(src)) return 'aggregator';
	}
	return 'unknown';
}

/**
 * Check for amplification phrases in title
 */
function detectAmplification(title: string, pattern: NarrativePattern): boolean {
	if (!pattern.amplificationPhrases) return false;

	const lowerTitle = title.toLowerCase();
	return pattern.amplificationPhrases.some((phrase) => lowerTitle.includes(phrase.toLowerCase()));
}

/**
 * Check for debunk indicators in title
 */
function detectDebunk(title: string, pattern: NarrativePattern): boolean {
	if (!pattern.debunkIndicators) return false;

	const lowerTitle = title.toLowerCase();
	return pattern.debunkIndicators.some((indicator) => lowerTitle.includes(indicator.toLowerCase()));
}

/**
 * Find which keywords matched in the title
 */
function findMatchedKeywords(title: string, keywords: string[]): string[] {
	const lowerTitle = title.toLowerCase();
	return keywords.filter((kw) => lowerTitle.includes(kw.toLowerCase()));
}

/**
 * Calculate amplification score based on headline patterns
 */
function calculateAmplificationScore(headlines: HeadlineMatch[]): number {
	if (headlines.length === 0) return 0;

	const amplifiedCount = headlines.filter((h) => h.hasAmplification).length;
	const mainstreamAmplified = headlines.filter(
		(h) => h.hasAmplification && (h.sourceType === 'mainstream' || h.sourceType === 'institutional')
	).length;

	// Base score on amplification ratio
	let score = (amplifiedCount / headlines.length) * 50;

	// Bonus for mainstream amplification
	if (mainstreamAmplified > 0) {
		score += mainstreamAmplified * 15;
	}

	return Math.min(100, Math.round(score));
}

/**
 * Calculate debunk score based on headline patterns
 */
function calculateDebunkScore(headlines: HeadlineMatch[]): number {
	if (headlines.length === 0) return 0;

	const debunkedCount = headlines.filter((h) => h.hasDebunk).length;
	const mainstreamDebunked = headlines.filter(
		(h) => h.hasDebunk && (h.sourceType === 'mainstream' || h.sourceType === 'institutional')
	).length;

	// Base score on debunk ratio
	let score = (debunkedCount / headlines.length) * 40;

	// Strong bonus for mainstream/institutional debunking
	if (mainstreamDebunked > 0) {
		score += mainstreamDebunked * 20;
	}

	return Math.min(100, Math.round(score));
}

/**
 * Determine narrative stage based on source distribution and history
 */
function determineNarrativeStage(
	sourceBreakdown: Record<SourceType, string[]>,
	historyEntry: NarrativeHistoryEntry | undefined,
	debunkScore: number
): NarrativeStage {
	const fringeCount = sourceBreakdown.fringe.length + sourceBreakdown.alternative.length;
	const mainstreamCount = sourceBreakdown.mainstream.length + sourceBreakdown.institutional.length;
	const total = fringeCount + mainstreamCount;

	if (debunkScore >= 60) return 'debunked';

	if (total === 0) return 'nascent';

	// Check crossover history
	if (historyEntry?.fringeToMainstreamTime) {
		const now = Date.now();
		const timeSinceCrossover = (now - historyEntry.fringeToMainstreamTime) / 60000;

		if (timeSinceCrossover > 30 && mainstreamCount > fringeCount) {
			return 'mainstream';
		}
	}

	if (mainstreamCount > 0 && fringeCount > 0) {
		return 'crossing';
	}

	if (mainstreamCount > fringeCount) {
		return 'mainstream';
	}

	if (fringeCount >= 3) {
		return 'spreading';
	}

	if (fringeCount >= 1) {
		return 'emerging';
	}

	return 'nascent';
}

/**
 * Calculate velocity of narrative spread
 */
function calculateVelocity(
	narrativeId: string,
	currentCount: number
): number {
	const history = narrativeHistory[narrativeId];
	if (!history || history.countHistory.length < 2) return 0;

	const now = Date.now();
	const recentHistory = history.countHistory.filter(
		(h) => now - h.timestamp < 30 * 60 * 1000 // Last 30 minutes
	);

	if (recentHistory.length < 2) return 0;

	const oldest = recentHistory[0];
	const minutesPassed = (now - oldest.timestamp) / 60000;

	if (minutesPassed <= 0) return 0;

	const countDiff = currentCount - oldest.count;
	// Convert to per-hour rate
	return Math.round((countDiff / minutesPassed) * 60);
}

/**
 * Predict if a narrative will cross to mainstream
 */
function predictCrossover(
	sourceBreakdown: Record<SourceType, string[]>,
	velocity: number,
	amplificationScore: number
): boolean {
	const fringeCount = sourceBreakdown.fringe.length + sourceBreakdown.alternative.length;

	// Already in mainstream
	if (sourceBreakdown.mainstream.length > 0 || sourceBreakdown.institutional.length > 0) {
		return false;
	}

	// High velocity + high fringe presence + amplification = likely crossover
	if (velocity >= 5 && fringeCount >= 3) return true;
	if (amplificationScore >= 50 && fringeCount >= 2) return true;
	if (fringeCount >= 5) return true;

	return false;
}

/**
 * Determine spread rate based on velocity and count
 */
function determineSpreadRate(
	velocity: number,
	count: number
): 'slow' | 'moderate' | 'fast' | 'explosive' {
	if (velocity >= 20 || count >= 10) return 'explosive';
	if (velocity >= 10 || count >= 7) return 'fast';
	if (velocity >= 5 || count >= 4) return 'moderate';
	return 'slow';
}

/**
 * Determine crossover direction
 */
function determineCrossoverDirection(
	historyEntry: NarrativeHistoryEntry | undefined,
	currentSourceTypes: SourceType[]
): 'fringe-to-mainstream' | 'mainstream-to-fringe' | 'simultaneous' {
	if (!historyEntry || historyEntry.sourceTypesOverTime.length === 0) {
		// No history, check current
		const hasFringe = currentSourceTypes.includes('fringe') || currentSourceTypes.includes('alternative');
		const hasMainstream = currentSourceTypes.includes('mainstream') || currentSourceTypes.includes('institutional');

		if (hasFringe && hasMainstream) return 'simultaneous';
		return 'fringe-to-mainstream'; // Default assumption
	}

	// Check first appearance
	const firstTypes = historyEntry.sourceTypesOverTime[0].types;
	const hadFringeFirst = firstTypes.includes('fringe') || firstTypes.includes('alternative');
	const hadMainstreamFirst = firstTypes.includes('mainstream') || firstTypes.includes('institutional');

	if (hadFringeFirst && !hadMainstreamFirst) return 'fringe-to-mainstream';
	if (hadMainstreamFirst && !hadFringeFirst) return 'mainstream-to-fringe';
	return 'simultaneous';
}

/**
 * Determine validation status based on source types and debunk score
 */
function determineValidationStatus(
	sourceBreakdown: Record<SourceType, string[]>,
	debunkScore: number
): 'unverified' | 'partially-verified' | 'verified' | 'disputed' | 'debunked' {
	if (debunkScore >= 60) return 'debunked';
	if (debunkScore >= 30) return 'disputed';

	const hasInstitutional = sourceBreakdown.institutional.length > 0;
	const hasMainstream = sourceBreakdown.mainstream.length > 0;
	const hasFringe = sourceBreakdown.fringe.length > 0;

	if (hasInstitutional && hasMainstream && !hasFringe) return 'verified';
	if (hasMainstream && !hasFringe) return 'partially-verified';
	return 'unverified';
}

/**
 * Determine disinfo spread pattern
 */
function determineSpreadPattern(
	headlines: HeadlineMatch[],
	velocity: number
): 'organic' | 'coordinated' | 'unknown' {
	// Check for timestamp clustering (many posts in short window)
	const timestamps = headlines.filter((h) => h.timestamp).map((h) => h.timestamp!);

	if (timestamps.length < 3) return 'unknown';

	timestamps.sort((a, b) => a - b);
	const timeRange = timestamps[timestamps.length - 1] - timestamps[0];
	const avgGap = timeRange / (timestamps.length - 1);

	// If very high velocity with very uniform spacing, might be coordinated
	if (velocity >= 15 && avgGap < 2 * 60 * 1000) {
		// Less than 2 min avg gap
		return 'coordinated';
	}

	return 'organic';
}

/**
 * Analyze narratives across all news items
 * Enhanced with amplification detection, debunking tracking, and nuanced trend analysis
 */
export function analyzeNarratives(allNews: NewsItem[]): NarrativeResults | null {
	if (!allNews || allNews.length === 0) return null;

	const now = Date.now();
	const results: NarrativeResults = {
		emergingFringe: [],
		fringeToMainstream: [],
		narrativeWatch: [],
		disinfoSignals: [],
		activeNarratives: 0,
		crossingNarratives: 0,
		highRiskCount: 0,
		overallThreatLevel: 'low',
		dominantCategory: ''
	};

	const categoryTotals: Record<string, number> = {};

	for (const narrative of NARRATIVE_PATTERNS) {
		const headlines: HeadlineMatch[] = [];
		const sourceBreakdown: Record<SourceType, string[]> = {
			fringe: [],
			alternative: [],
			mainstream: [],
			institutional: [],
			aggregator: [],
			unknown: []
		};
		const allMatchedKeywords: Set<string> = new Set();

		// Find matching news items
		for (const item of allNews) {
			const title = item.title || '';
			const source = item.source || '';

			const matchedKws = findMatchedKeywords(title, narrative.keywords);

			if (matchedKws.length > 0) {
				const sourceType = classifySource(source);
				const hasAmplification = detectAmplification(title, narrative);
				const hasDebunk = detectDebunk(title, narrative);

				headlines.push({
					title,
					link: item.link,
					source,
					sourceType,
					timestamp: item.timestamp,
					hasAmplification,
					hasDebunk,
					matchedKeywords: matchedKws
				});

				// Track by source type
				if (!sourceBreakdown[sourceType].includes(source)) {
					sourceBreakdown[sourceType].push(source);
				}

				// Track matched keywords
				for (const kw of matchedKws) {
					allMatchedKeywords.add(kw);
				}
			}
		}

		if (headlines.length === 0) continue;

		results.activeNarratives++;

		// Track category totals
		categoryTotals[narrative.category] = (categoryTotals[narrative.category] || 0) + headlines.length;

		// Update narrative history
		if (!narrativeHistory[narrative.id]) {
			narrativeHistory[narrative.id] = {
				firstSeen: now,
				sources: new Set(),
				sourceTypesOverTime: [],
				countHistory: []
			};
		}

		const historyEntry = narrativeHistory[narrative.id];

		// Update sources
		for (const headline of headlines) {
			historyEntry.sources.add(headline.source);
		}

		// Track source types over time
		const currentSourceTypes = headlines.map((h) => h.sourceType);
		historyEntry.sourceTypesOverTime.push({ timestamp: now, types: currentSourceTypes });

		// Clean old history
		historyEntry.sourceTypesOverTime = historyEntry.sourceTypesOverTime.filter(
			(e) => now - e.timestamp < HISTORY_RETENTION_MINUTES * 60 * 1000
		);

		// Track count history
		historyEntry.countHistory.push({ timestamp: now, count: headlines.length });
		historyEntry.countHistory = historyEntry.countHistory.filter(
			(e) => now - e.timestamp < HISTORY_RETENTION_MINUTES * 60 * 1000
		);

		// Check for first mainstream appearance
		const hasMainstream = sourceBreakdown.mainstream.length > 0 || sourceBreakdown.institutional.length > 0;
		if (hasMainstream && !historyEntry.fringeToMainstreamTime) {
			historyEntry.fringeToMainstreamTime = now;
		}

		// Calculate scores
		const amplificationScore = calculateAmplificationScore(headlines);
		const debunkScore = calculateDebunkScore(headlines);
		const velocity = calculateVelocity(narrative.id, headlines.length);
		const stage = determineNarrativeStage(sourceBreakdown, historyEntry, debunkScore);

		// Build narrative data
		const narrativeData: NarrativeData = {
			id: narrative.id,
			name: formatNarrativeName(narrative.id),
			category: narrative.category,
			severity: narrative.severity,
			count: headlines.length,
			fringeCount: sourceBreakdown.fringe.length,
			alternativeCount: sourceBreakdown.alternative.length,
			mainstreamCount: sourceBreakdown.mainstream.length,
			institutionalCount: sourceBreakdown.institutional.length,
			sources: [...new Set(headlines.map((h) => h.source))].slice(0, 8),
			sourceBreakdown,
			headlines: headlines.slice(0, 5),
			keywords: narrative.keywords,
			matchedKeywords: Array.from(allMatchedKeywords),
			amplificationScore,
			debunkScore,
			stage,
			velocity,
			firstSeenTimestamp: historyEntry.firstSeen,
			timeSinceFirstSeen: Math.round((now - historyEntry.firstSeen) / 60000)
		};

		// Categorize narrative
		const fringePresence = sourceBreakdown.fringe.length + sourceBreakdown.alternative.length;
		const mainstreamPresence = sourceBreakdown.mainstream.length + sourceBreakdown.institutional.length;

		if (mainstreamPresence > 0 && fringePresence > 0) {
			// Fringe to Mainstream crossover
			results.crossingNarratives++;

			const crossoverLevel = Math.round(
				(mainstreamPresence / (mainstreamPresence + fringePresence)) * 100
			);

			const timeToMainstream = historyEntry.fringeToMainstreamTime
				? Math.round((historyEntry.fringeToMainstreamTime - historyEntry.firstSeen) / 60000)
				: undefined;

			results.fringeToMainstream.push({
				...narrativeData,
				status: crossoverLevel >= 50 ? 'crossed' : 'crossing',
				crossoverLevel,
				crossoverDirection: determineCrossoverDirection(historyEntry, currentSourceTypes),
				timeToMainstream,
				validationStatus: determineValidationStatus(sourceBreakdown, debunkScore)
			});
		} else if (narrative.severity === 'disinfo' || (amplificationScore >= 50 && debunkScore < 30)) {
			// Disinformation signal
			const threatLevel: DisinfoSignal['threatLevel'] =
				amplificationScore >= 70 && mainstreamPresence > 0
					? 'critical'
					: amplificationScore >= 50
						? 'high'
						: amplificationScore >= 30
							? 'medium'
							: 'low';

			if (threatLevel === 'high' || threatLevel === 'critical') {
				results.highRiskCount++;
			}

			const indicators: string[] = [];
			if (amplificationScore >= 50) indicators.push('High amplification');
			if (velocity >= 10) indicators.push('Rapid spread');
			if (fringePresence >= 3) indicators.push('Multi-source fringe presence');
			if (debunkScore < 20 && headlines.length >= 3) indicators.push('Limited fact-checking');

			const countermeasures = headlines
				.filter((h) => h.hasDebunk)
				.map((h) => h.title)
				.slice(0, 3);

			results.disinfoSignals.push({
				...narrativeData,
				threatLevel,
				indicators,
				countermeasures,
				spreadPattern: determineSpreadPattern(headlines, velocity)
			});
		} else if (fringePresence > 0) {
			// Emerging from fringe sources
			const status: EmergingFringe['status'] =
				headlines.length >= 8
					? 'viral'
					: headlines.length >= 5
						? 'spreading'
						: headlines.length >= 2
							? 'emerging'
							: 'nascent';

			const spreadRate = determineSpreadRate(velocity, headlines.length);
			const predictedCrossover = predictCrossover(sourceBreakdown, velocity, amplificationScore);

			const riskLevel: EmergingFringe['riskLevel'] =
				predictedCrossover && amplificationScore >= 40
					? 'high'
					: amplificationScore >= 30 || velocity >= 10
						? 'medium'
						: 'low';

			if (riskLevel === 'high') {
				results.highRiskCount++;
			}

			results.emergingFringe.push({
				...narrativeData,
				status,
				spreadRate,
				predictedCrossover,
				riskLevel
			});
		} else {
			// General narrative watch
			results.narrativeWatch.push(narrativeData);
		}
	}

	// Calculate overall threat level
	results.overallThreatLevel =
		results.highRiskCount >= 3 || results.disinfoSignals.some((d) => d.threatLevel === 'critical')
			? 'critical'
			: results.highRiskCount >= 2 || results.crossingNarratives >= 3
				? 'high'
				: results.highRiskCount >= 1 || results.crossingNarratives >= 1
					? 'elevated'
					: 'low';

	// Find dominant category
	const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
	results.dominantCategory = sortedCategories[0]?.[0] || 'None';

	// Sort results
	results.emergingFringe.sort((a, b) => {
		// Prioritize by risk level, then count
		const riskOrder = { high: 3, medium: 2, low: 1 };
		const riskDiff = riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
		if (riskDiff !== 0) return riskDiff;
		return b.count - a.count;
	});

	results.fringeToMainstream.sort((a, b) => b.crossoverLevel - a.crossoverLevel);

	results.narrativeWatch.sort((a, b) => b.count - a.count);

	results.disinfoSignals.sort((a, b) => {
		const threatOrder = { critical: 4, high: 3, medium: 2, low: 1 };
		return threatOrder[b.threatLevel] - threatOrder[a.threatLevel];
	});

	return results;
}

/**
 * Get narrative summary for status display
 */
export function getNarrativeSummary(results: NarrativeResults | null): {
	total: number;
	status: string;
	threatLevel: string;
	crossingCount: number;
} {
	if (!results) {
		return { total: 0, status: 'NO DATA', threatLevel: 'low', crossingCount: 0 };
	}

	const total =
		results.emergingFringe.length +
		results.fringeToMainstream.length +
		results.narrativeWatch.length +
		results.disinfoSignals.length;

	let status: string;
	if (results.overallThreatLevel === 'critical') {
		status = 'CRITICAL';
	} else if (results.highRiskCount > 0) {
		status = `${results.highRiskCount} HIGH RISK`;
	} else if (results.crossingNarratives > 0) {
		status = `${results.crossingNarratives} CROSSING`;
	} else if (total > 0) {
		status = `${total} ACTIVE`;
	} else {
		status = 'MONITORING';
	}

	return {
		total,
		status,
		threatLevel: results.overallThreatLevel,
		crossingCount: results.crossingNarratives
	};
}

/**
 * Get high-risk narratives only
 */
export function getHighRiskNarratives(results: NarrativeResults | null): {
	emergingFringe: EmergingFringe[];
	disinfo: DisinfoSignal[];
} {
	if (!results) {
		return { emergingFringe: [], disinfo: [] };
	}

	return {
		emergingFringe: results.emergingFringe.filter((n) => n.riskLevel === 'high'),
		disinfo: results.disinfoSignals.filter(
			(d) => d.threatLevel === 'high' || d.threatLevel === 'critical'
		)
	};
}

/**
 * Get narratives by category
 */
export function getNarrativesByCategory(
	results: NarrativeResults | null,
	category: string
): NarrativeData[] {
	if (!results) return [];

	const all: NarrativeData[] = [
		...results.emergingFringe,
		...results.fringeToMainstream,
		...results.narrativeWatch,
		...results.disinfoSignals
	];

	return all.filter((n) => n.category === category);
}

/**
 * Get crossing narratives (active crossover in progress)
 */
export function getCrossingNarratives(results: NarrativeResults | null): FringeToMainstream[] {
	if (!results) return [];
	return results.fringeToMainstream.filter((n) => n.status === 'crossing');
}

/**
 * Clear narrative history (for testing or reset)
 */
export function clearNarrativeHistory(): void {
	for (const key of Object.keys(narrativeHistory)) {
		delete narrativeHistory[key];
	}
}
