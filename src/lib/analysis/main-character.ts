/**
 * Main Character analysis - tracks prominent figures in news
 * Enhanced with sentiment analysis, source tracking, and improved ranking algorithms
 */

import type { NewsItem } from '$lib/types';
import { PERSON_PATTERNS, SENTIMENT_INDICATORS, type PersonRole } from '$lib/config/analysis';

// Types for sentiment analysis
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

export interface SentimentBreakdown {
	positive: number;
	negative: number;
	neutral: number;
}

export interface SourceMention {
	source: string;
	title: string;
	link: string;
	sentiment: Sentiment;
	timestamp?: number;
}

export interface MainCharacterEntry {
	name: string;
	count: number;
	rank: number;
	role?: PersonRole;
	sentiment: Sentiment;
	sentimentBreakdown: SentimentBreakdown;
	sentimentScore: number; // -100 to +100
	sources: string[];
	sourceCount: number;
	recentMentions: SourceMention[];
	momentum: 'rising' | 'stable' | 'falling';
	dominanceScore: number; // 0-100, how dominant this person is vs others
	coMentions: string[]; // Other people frequently mentioned alongside
}

export interface MainCharacterResults {
	characters: MainCharacterEntry[];
	topCharacter: MainCharacterEntry | null;
	totalMentions: number;
	roleBreakdown: Record<PersonRole, number>;
	overallSentiment: Sentiment;
}

// History for momentum tracking
const mentionHistory: Record<string, { timestamp: number; count: number }[]> = {};
const HISTORY_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Analyze sentiment of text around a person mention
 */
function analyzeSentiment(text: string): { sentiment: Sentiment; score: number } {
	const lowerText = text.toLowerCase();
	let positiveCount = 0;
	let negativeCount = 0;

	// Count positive indicators
	for (const indicator of SENTIMENT_INDICATORS.positive) {
		if (lowerText.includes(indicator.toLowerCase())) {
			positiveCount++;
		}
	}

	// Count negative indicators
	for (const indicator of SENTIMENT_INDICATORS.negative) {
		if (lowerText.includes(indicator.toLowerCase())) {
			negativeCount++;
		}
	}

	// Calculate sentiment score (-100 to +100)
	const total = positiveCount + negativeCount;
	let score = 0;
	let sentiment: Sentiment = 'neutral';

	if (total > 0) {
		score = Math.round(((positiveCount - negativeCount) / total) * 100);

		if (positiveCount > 0 && negativeCount > 0) {
			sentiment = 'mixed';
		} else if (positiveCount > negativeCount) {
			sentiment = 'positive';
		} else if (negativeCount > positiveCount) {
			sentiment = 'negative';
		}
	}

	return { sentiment, score };
}

/**
 * Determine overall sentiment from breakdown
 */
function determineSentiment(breakdown: SentimentBreakdown): Sentiment {
	const { positive, negative, neutral } = breakdown;
	const total = positive + negative + neutral;

	if (total === 0) return 'neutral';

	// If both positive and negative are significant, it's mixed
	if (positive > 0 && negative > 0 && Math.min(positive, negative) / total > 0.2) {
		return 'mixed';
	}

	if (positive > negative && positive > neutral) return 'positive';
	if (negative > positive && negative > neutral) return 'negative';
	return 'neutral';
}

/**
 * Calculate momentum based on historical data
 */
function calculateMomentum(name: string, currentCount: number): 'rising' | 'stable' | 'falling' {
	const now = Date.now();
	const history = mentionHistory[name] || [];

	// Clean old entries
	const recentHistory = history.filter((h) => now - h.timestamp < HISTORY_WINDOW_MS);

	// If not enough history, assume stable
	if (recentHistory.length < 2) {
		return 'stable';
	}

	// Compare current to average of recent history
	const avgCount = recentHistory.reduce((sum, h) => sum + h.count, 0) / recentHistory.length;
	const changeRatio = currentCount / avgCount;

	if (changeRatio > 1.3) return 'rising';
	if (changeRatio < 0.7) return 'falling';
	return 'stable';
}

/**
 * Find co-mentioned people (people mentioned in the same headlines)
 */
function findCoMentions(
	personName: string,
	allNews: NewsItem[],
	personPatterns: typeof PERSON_PATTERNS
): string[] {
	const coMentionCounts: Record<string, number> = {};

	for (const item of allNews) {
		const text = (item.title || '').toLowerCase();

		// Check if this person is mentioned
		const personPattern = personPatterns.find((p) => p.name === personName);
		if (!personPattern) continue;

		personPattern.pattern.lastIndex = 0;
		if (!personPattern.pattern.test(text)) continue;

		// Check for other people in the same headline
		for (const otherPattern of personPatterns) {
			if (otherPattern.name === personName) continue;

			otherPattern.pattern.lastIndex = 0;
			if (otherPattern.pattern.test(text)) {
				coMentionCounts[otherPattern.name] = (coMentionCounts[otherPattern.name] || 0) + 1;
			}
		}
	}

	// Return top 3 co-mentions
	return Object.entries(coMentionCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([name]) => name);
}

/**
 * Calculate the "Main Character" (most mentioned person) from news headlines
 * with enhanced sentiment analysis, source tracking, and improved ranking
 */
export function calculateMainCharacter(allNews: NewsItem[]): MainCharacterResults {
	if (!allNews || allNews.length === 0) {
		return {
			characters: [],
			topCharacter: null,
			totalMentions: 0,
			roleBreakdown: { political: 0, tech: 0, finance: 0, military: 0, media: 0, other: 0 },
			overallSentiment: 'neutral'
		};
	}

	const now = Date.now();

	// Track data per person
	const personData: Record<
		string,
		{
			count: number;
			role?: PersonRole;
			sentimentBreakdown: SentimentBreakdown;
			sentimentScores: number[];
			sources: Set<string>;
			mentions: SourceMention[];
		}
	> = {};

	// Analyze each news item
	for (const item of allNews) {
		const text = (item.title || '').toLowerCase();
		const source = item.source || 'Unknown';

		for (const personPattern of PERSON_PATTERNS) {
			// Reset lastIndex for global regex
			personPattern.pattern.lastIndex = 0;
			const matches = text.match(personPattern.pattern);

			if (matches) {
				const name = personPattern.name;

				if (!personData[name]) {
					personData[name] = {
						count: 0,
						role: personPattern.role,
						sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 },
						sentimentScores: [],
						sources: new Set(),
						mentions: []
					};
				}

				personData[name].count += matches.length;
				personData[name].sources.add(source);

				// Analyze sentiment for this mention
				const { sentiment, score } = analyzeSentiment(item.title || '');
				personData[name].sentimentBreakdown[sentiment === 'mixed' ? 'neutral' : sentiment]++;
				personData[name].sentimentScores.push(score);

				// Track recent mentions (limit to 5)
				if (personData[name].mentions.length < 5) {
					personData[name].mentions.push({
						source,
						title: item.title || '',
						link: item.link,
						sentiment,
						timestamp: item.timestamp
					});
				}
			}
		}
	}

	// Calculate total mentions for dominance scoring
	const totalMentions = Object.values(personData).reduce((sum, p) => sum + p.count, 0);

	// Role breakdown
	const roleBreakdown: Record<PersonRole, number> = {
		political: 0,
		tech: 0,
		finance: 0,
		military: 0,
		media: 0,
		other: 0
	};

	// Build character entries with enhanced data
	const characters: MainCharacterEntry[] = Object.entries(personData)
		.map(([name, data]) => {
			// Update history for momentum tracking
			if (!mentionHistory[name]) {
				mentionHistory[name] = [];
			}
			mentionHistory[name].push({ timestamp: now, count: data.count });
			// Clean old history
			mentionHistory[name] = mentionHistory[name].filter(
				(h) => now - h.timestamp < HISTORY_WINDOW_MS
			);

			// Calculate average sentiment score
			const avgSentimentScore =
				data.sentimentScores.length > 0
					? Math.round(
							data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length
						)
					: 0;

			// Track role counts
			if (data.role) {
				roleBreakdown[data.role] += data.count;
			}

			return {
				name,
				count: data.count,
				rank: 0, // Will be set after sorting
				role: data.role,
				sentiment: determineSentiment(data.sentimentBreakdown),
				sentimentBreakdown: data.sentimentBreakdown,
				sentimentScore: avgSentimentScore,
				sources: Array.from(data.sources),
				sourceCount: data.sources.size,
				recentMentions: data.mentions,
				momentum: calculateMomentum(name, data.count),
				dominanceScore: totalMentions > 0 ? Math.round((data.count / totalMentions) * 100) : 0,
				coMentions: [] // Will be populated after sorting
			};
		})
		// Enhanced sorting: prioritize count, but boost for source diversity and momentum
		.sort((a, b) => {
			// Primary: mention count
			const countDiff = b.count - a.count;
			if (Math.abs(countDiff) > 2) return countDiff;

			// Secondary: source diversity (more sources = more significant)
			const sourceDiff = b.sourceCount - a.sourceCount;
			if (sourceDiff !== 0) return sourceDiff;

			// Tertiary: momentum (rising > stable > falling)
			const momentumScore = { rising: 2, stable: 1, falling: 0 };
			return momentumScore[b.momentum] - momentumScore[a.momentum];
		})
		.slice(0, 15)
		.map((entry, index) => ({
			...entry,
			rank: index + 1
		}));

	// Populate co-mentions for top characters
	for (const character of characters.slice(0, 5)) {
		character.coMentions = findCoMentions(character.name, allNews, PERSON_PATTERNS);
	}

	// Calculate overall sentiment across all mentions
	const overallBreakdown: SentimentBreakdown = { positive: 0, negative: 0, neutral: 0 };
	for (const data of Object.values(personData)) {
		overallBreakdown.positive += data.sentimentBreakdown.positive;
		overallBreakdown.negative += data.sentimentBreakdown.negative;
		overallBreakdown.neutral += data.sentimentBreakdown.neutral;
	}

	return {
		characters,
		topCharacter: characters[0] || null,
		totalMentions,
		roleBreakdown,
		overallSentiment: determineSentiment(overallBreakdown)
	};
}

/**
 * Get a summary of the main character for display
 */
export function getMainCharacterSummary(results: MainCharacterResults): {
	name: string;
	count: number;
	status: string;
	sentiment: Sentiment;
	momentum: 'rising' | 'stable' | 'falling';
} {
	if (!results.topCharacter) {
		return { name: '', count: 0, status: 'NO DATA', sentiment: 'neutral', momentum: 'stable' };
	}

	const { name, count, sentiment, momentum } = results.topCharacter;
	const sentimentEmoji =
		sentiment === 'positive' ? '+' : sentiment === 'negative' ? '-' : sentiment === 'mixed' ? '~' : '';
	const momentumIndicator = momentum === 'rising' ? '^' : momentum === 'falling' ? 'v' : '';

	return {
		name,
		count,
		status: `${name} (${count}${sentimentEmoji}${momentumIndicator})`,
		sentiment,
		momentum
	};
}

/**
 * Calculate relative dominance of main character
 * Returns a value 0-100 representing how dominant the top character is
 */
export function calculateDominance(results: MainCharacterResults): number {
	if (results.characters.length < 2) return 100;

	const top = results.characters[0];
	const second = results.characters[1];

	if (!top || top.count === 0) return 0;
	if (!second || second.count === 0) return 100;

	// Dominance is how much more the top is mentioned vs second
	const ratio = top.count / second.count;
	// Convert to 0-100 scale (ratio of 2 = 100% dominant)
	return Math.min(100, Math.round((ratio - 1) * 100));
}

/**
 * Get characters filtered by role
 */
export function getCharactersByRole(
	results: MainCharacterResults,
	role: PersonRole
): MainCharacterEntry[] {
	return results.characters.filter((c) => c.role === role);
}

/**
 * Get characters with specific sentiment
 */
export function getCharactersBySentiment(
	results: MainCharacterResults,
	sentiment: Sentiment
): MainCharacterEntry[] {
	return results.characters.filter((c) => c.sentiment === sentiment);
}

/**
 * Get trending characters (rising momentum)
 */
export function getTrendingCharacters(results: MainCharacterResults): MainCharacterEntry[] {
	return results.characters.filter((c) => c.momentum === 'rising');
}

/**
 * Get characters mentioned across multiple sources (cross-source validation)
 */
export function getCrossSourceCharacters(
	results: MainCharacterResults,
	minSources: number = 3
): MainCharacterEntry[] {
	return results.characters.filter((c) => c.sourceCount >= minSources);
}

/**
 * Clear mention history (for testing or reset)
 */
export function clearMentionHistory(): void {
	for (const key of Object.keys(mentionHistory)) {
		delete mentionHistory[key];
	}
}
