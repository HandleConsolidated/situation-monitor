/**
 * Context Builder Service
 * Aggregates data from all stores and configs into LLM-consumable JSON
 *
 * Data is organized into reliability tiers:
 * - Tier 1 (High Reliability): News articles, market data, crypto prices, whale transactions
 * - Tier 2 (Medium Reliability): Polymarket predictions, government contracts, layoffs data
 * - Tier 3 (Lower Reliability): Grid stress, radiation, disease outbreaks, earthquake data
 */

import { get } from 'svelte/store';
import {
	allNewsItems,
	alerts,
	categorizedNewsItems,
	markets,
	enabledMonitors,
	refresh
} from '$lib/stores';
import {
	HOTSPOTS,
	CHOKEPOINTS,
	CONFLICT_ZONES,
	CABLE_LANDINGS,
	NUCLEAR_SITES,
	MILITARY_BASES
} from '$lib/config';
import type {
	IntelligenceContext,
	GeopoliticalContext,
	NewsContext,
	MarketsContext,
	CryptoContext,
	InfrastructureContext,
	AnalysisContext,
	MonitorsContext,
	EnvironmentalContext,
	AlternativeContext,
	ContextCategory,
	LLMPreferences
} from '$lib/types/llm';
import { DEFAULT_LLM_PREFERENCES } from '$lib/types/llm';
import type {
	NewsItem,
	NewsCategory,
	CorrelationResult,
	NarrativeResult,
	MainCharacterResult,
	EarthquakeData,
	DiseaseOutbreak,
	WhaleTransaction
} from '$lib/types';
import type {
	Contract,
	Layoff,
	Prediction,
	GridStressData,
	RadiationReading,
	OutageData
} from '$lib/api';

// Version for context schema
const CONTEXT_VERSION = '1.1.0';

// ============================================================================
// Data Reliability Tiers
// ============================================================================

/**
 * Data reliability tier definitions
 */
export type DataReliabilityTier = 1 | 2 | 3;

export interface TierInfo {
	tier: DataReliabilityTier;
	label: string;
	description: string;
	guidance: string;
}

export const DATA_TIERS: Record<DataReliabilityTier, Omit<TierInfo, 'tier'>> = {
	1: {
		label: 'High Reliability',
		description: 'Real-time data from reputable sources',
		guidance: 'Prioritize this data in analysis. Can be cited with confidence.'
	},
	2: {
		label: 'Medium Reliability',
		description: 'Public data that may be delayed or opinion-based',
		guidance: 'Use with appropriate context. Note that predictions are speculative.'
	},
	3: {
		label: 'Lower Reliability',
		description: 'Data with potential gaps, delays, or verification challenges',
		guidance:
			'Treat with caution. Note uncertainties and limitations in analysis.'
	}
};

/**
 * Category to tier mapping
 */
export const CATEGORY_TIERS: Record<string, DataReliabilityTier> = {
	// Tier 1 - High Reliability
	news: 1,
	markets: 1,
	crypto: 1,
	whaleTransactions: 1,

	// Tier 2 - Medium Reliability
	predictions: 2,
	govContracts: 2,
	layoffs: 2,
	geopolitical: 2, // Static config data

	// Tier 3 - Lower Reliability
	gridStress: 3,
	radiation: 3,
	diseaseOutbreaks: 3,
	earthquakes: 3,
	outages: 3
};

/**
 * Data limitation notes for Tier 3 data
 */
export const DATA_LIMITATIONS: Record<string, string> = {
	gridStress:
		'Grid stress data may be unavailable in many regions. When available, it represents carbon intensity percentiles, not actual grid load. Regional coverage is limited.',
	radiation:
		'Radiation readings have sparse global coverage and may be from older sensors. Equipment variability affects readings. Normal background varies by location.',
	diseaseOutbreaks:
		'Disease outbreak data has inherent reporting delays (days to weeks). Case counts may be underreported. Verification from official health authorities is recommended.',
	earthquakes:
		'Earthquake data is reliable but significance varies greatly. Magnitude alone does not indicate impact - depth, location, and population density matter.',
	outages:
		'Internet/power outage detection depends on external monitoring services. Small or brief outages may not be detected. Attribution of cause may be uncertain.'
};

// Maximum token estimate (rough: 4 chars = 1 token)
const CHARS_PER_TOKEN = 4;

// ============================================================================
// VIX Status Classification
// ============================================================================

export type VixStatus = 'extreme_fear' | 'high_fear' | 'elevated' | 'low' | 'very_low';

export interface VixAnalysis {
	value: number;
	status: VixStatus;
	label: string;
	description: string;
}

/**
 * Classify VIX value into market fear status
 * Based on historical VIX levels:
 * - Below 12: Very low volatility (complacency)
 * - 12-20: Low/normal volatility
 * - 20-30: Elevated volatility
 * - 30-40: High fear
 * - Above 40: Extreme fear (crisis level)
 */
function classifyVix(vixValue: number | undefined): VixAnalysis | undefined {
	if (vixValue === undefined || isNaN(vixValue)) return undefined;

	if (vixValue >= 40) {
		return {
			value: vixValue,
			status: 'extreme_fear',
			label: 'EXTREME FEAR',
			description: 'Crisis-level volatility; historically associated with market panics and major selloffs'
		};
	} else if (vixValue >= 30) {
		return {
			value: vixValue,
			status: 'high_fear',
			label: 'HIGH FEAR',
			description: 'Significant market stress; elevated uncertainty and risk aversion'
		};
	} else if (vixValue >= 20) {
		return {
			value: vixValue,
			status: 'elevated',
			label: 'ELEVATED',
			description: 'Above-average volatility; heightened caution warranted'
		};
	} else if (vixValue >= 12) {
		return {
			value: vixValue,
			status: 'low',
			label: 'LOW',
			description: 'Normal market conditions; typical volatility range'
		};
	} else {
		return {
			value: vixValue,
			status: 'very_low',
			label: 'VERY LOW',
			description: 'Unusual calm; potential complacency, often precedes volatility spikes'
		};
	}
}

// ============================================================================
// Intel Source Type Classification
// ============================================================================

export type IntelSourceType = 'osint' | 'govt' | 'think-tank' | 'defense' | 'regional' | 'cyber';

/**
 * Infer intelligence source type from source name
 * Matches logic from IntelPanel.svelte
 */
function inferSourceType(source: string): IntelSourceType {
	const s = source.toLowerCase();
	if (s.includes('cisa') || s.includes('krebs') || s.includes('cyber')) return 'cyber';
	if (s.includes('bellingcat')) return 'osint';
	if (s.includes('defense') || s.includes('war') || s.includes('military')) return 'defense';
	if (s.includes('diplomat') || s.includes('monitor')) return 'regional';
	if (s.includes('white house') || s.includes('fed') || s.includes('sec') || s.includes('dod'))
		return 'govt';
	return 'think-tank';
}

// ============================================================================
// Formatted Article Types
// ============================================================================

/**
 * A news article formatted for LLM consumption with full citation info
 */
export interface FormattedArticle {
	title: string;
	link: string;
	source: string;
	sourceType: IntelSourceType;
	timeAgo: string;
	timestamp: number;
	category: NewsCategory;
	summary?: string;
	isAlert?: boolean;
	alertKeyword?: string;
	region?: string;
	// Pre-formatted markdown string for easy LLM consumption
	formatted: string;
}

/**
 * Enhanced news context with formatted articles
 */
export interface EnhancedNewsContext extends NewsContext {
	// Formatted articles organized by category
	formattedByCategory: Record<NewsCategory, FormattedArticle[]>;
	formattedAlerts: FormattedArticle[];
	// Data quality info
	dataQuality: {
		tier: DataReliabilityTier;
		tierLabel: string;
		note: string;
	};
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format a timestamp into a human-readable "time ago" string
 */
function formatTimeAgo(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	return new Date(timestamp).toLocaleDateString();
}

/**
 * Format a news item into a citable article with markdown link
 */
function formatArticle(item: NewsItem): FormattedArticle {
	const timeAgo = formatTimeAgo(item.timestamp);
	const sourceType = inferSourceType(item.source);

	// Build a clean summary from description or content
	let summary = '';
	if (item.description) {
		// Clean HTML and truncate
		summary = item.description
			.replace(/<[^>]*>/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 200);
		if (item.description.length > 200) summary += '...';
	}

	// Build the formatted markdown string
	// Format: **[Title](url)**
	// Source: Reuters (OSINT) | Published: 2h ago
	// Key points: summary
	let formatted = `**[${item.title}](${item.link})**\n`;
	formatted += `Source: ${item.source} [${sourceType.toUpperCase()}] | Published: ${timeAgo}`;
	if (summary) {
		formatted += `\nKey points: ${summary}`;
	}
	if (item.isAlert && item.alertKeyword) {
		formatted += `\n[ALERT: matches keyword "${item.alertKeyword}"]`;
	}

	return {
		title: item.title,
		link: item.link,
		source: item.source,
		sourceType,
		timeAgo,
		timestamp: item.timestamp,
		category: item.category,
		summary: summary || undefined,
		isAlert: item.isAlert,
		alertKeyword: item.alertKeyword,
		region: item.region,
		formatted
	};
}

/**
 * World Leader data for context
 */
export interface WorldLeaderContext {
	id: string;
	name: string;
	title: string;
	country: string;
	party?: string;
	focus?: string[];
	recentNewsCount: number;
	recentHeadlines: string[];
}

/**
 * External data that needs to be passed in (not from stores)
 * These are typically fetched in +page.svelte and not stored in global stores
 */
export interface ExternalData {
	correlations?: CorrelationResult[];
	narratives?: NarrativeResult[];
	mainCharacters?: MainCharacterResult[];
	earthquakes?: EarthquakeData[];
	radiation?: RadiationReading[];
	diseaseOutbreaks?: DiseaseOutbreak[];
	whaleTransactions?: WhaleTransaction[];
	govContracts?: Contract[];
	layoffs?: Layoff[];
	predictions?: Prediction[];
	gridStress?: GridStressData[];
	outages?: OutageData[];
	worldLeaders?: Array<{
		id: string;
		name: string;
		title: string;
		country: string;
		party?: string;
		focus?: string[];
		news?: Array<{ title: string; source: string }>;
	}>;
}

/**
 * Build geopolitical context from map config
 * Now includes critical infrastructure data for comprehensive analysis
 */
function buildGeopoliticalContext(): GeopoliticalContext {
	return {
		hotspots: HOTSPOTS.map((h) => ({
			name: h.name,
			location: h.desc.split(' — ')[0] || h.name,
			level: h.level,
			description: h.desc
		})),
		conflictZones: CONFLICT_ZONES?.map((z) => z.name) || [],
		chokepoints: CHOKEPOINTS?.map((c) => ({
			name: c.name,
			description: c.desc
		})) || [],
		// Critical infrastructure for geopolitical analysis
		criticalInfrastructure: {
			cableLandings: CABLE_LANDINGS?.slice(0, 10).map((c) => ({
				name: c.name,
				description: c.desc
			})) || [],
			nuclearSites: NUCLEAR_SITES?.slice(0, 10).map((n) => ({
				name: n.name,
				description: n.desc
			})) || [],
			militaryBases: MILITARY_BASES?.slice(0, 12).map((m) => ({
				name: m.name,
				description: m.desc
			})) || []
		}
	};
}

/**
 * Build news context from news store
 * Returns enhanced context with formatted articles including links
 */
function buildNewsContext(
	preferences: LLMPreferences,
	maxItems: number = 10
): EnhancedNewsContext {
	const allItems = get(allNewsItems);
	const alertItems = get(alerts);
	const byCategory = get(categorizedNewsItems);

	// Filter and limit items per category
	const filteredByCategory: Record<NewsCategory, NewsItem[]> = {} as Record<
		NewsCategory,
		NewsItem[]
	>;
	const formattedByCategory: Record<NewsCategory, FormattedArticle[]> =
		{} as Record<NewsCategory, FormattedArticle[]>;

	const categories = preferences.newsFilters.categories;
	const maxPerCategory = Math.min(
		preferences.newsFilters.maxItemsPerCategory,
		maxItems
	);

	for (const category of categories) {
		const items = byCategory[category] || [];
		let filtered = items;

		// Apply alerts-only filter
		if (preferences.newsFilters.alertsOnly) {
			filtered = filtered.filter((item) => item.isAlert);
		}

		// Apply region filter if specified
		if (preferences.newsFilters.includeRegions.length > 0) {
			filtered = filtered.filter(
				(item) =>
					item.region &&
					preferences.newsFilters.includeRegions.includes(item.region)
			);
		}

		// Limit items and create formatted versions
		const limitedItems = filtered.slice(0, maxPerCategory);
		filteredByCategory[category] = limitedItems;
		formattedByCategory[category] = limitedItems.map(formatArticle);
	}

	// Format alerts
	const limitedAlerts = alertItems.slice(0, 20);
	const formattedAlerts = limitedAlerts.map(formatArticle);

	// Calculate top sources
	const sourceCounts: Record<string, number> = {};
	allItems.forEach((item) => {
		sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
	});
	const topSources = Object.entries(sourceCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([source]) => source);

	// Calculate top regions
	const regionCounts: Record<string, number> = {};
	allItems.forEach((item) => {
		if (item.region) {
			regionCounts[item.region] = (regionCounts[item.region] || 0) + 1;
		}
	});
	const topRegions = Object.entries(regionCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([region]) => region);

	return {
		byCategory: filteredByCategory,
		formattedByCategory,
		alerts: limitedAlerts,
		formattedAlerts,
		totalCount: allItems.length,
		alertCount: alertItems.length,
		topSources,
		topRegions,
		dataQuality: {
			tier: CATEGORY_TIERS.news,
			tierLabel: DATA_TIERS[CATEGORY_TIERS.news].label,
			note: 'News articles from reputable RSS feeds. Links provided for verification and citation.'
		}
	};
}

/**
 * Build markets context from markets store
 * Includes VIX analysis with fear/greed classification
 */
function buildMarketsContext(): MarketsContext {
	const marketsState = get(markets);
	const indicesData = marketsState.indices.items;
	const sectorsData = marketsState.sectors.items;
	const commoditiesData = marketsState.commodities.items;

	// Calculate market trend
	const allChanges = [
		...indicesData.map((i) => i.changePercent),
		...sectorsData.map((s) => s.changePercent)
	].filter((c) => !isNaN(c));

	const positiveCount = allChanges.filter((c) => c > 0).length;
	const negativeCount = allChanges.filter((c) => c < 0).length;

	let trend: 'bullish' | 'bearish' | 'mixed' | 'neutral' = 'neutral';
	if (allChanges.length > 0) {
		if (positiveCount > negativeCount * 1.5) {
			trend = 'bullish';
		} else if (negativeCount > positiveCount * 1.5) {
			trend = 'bearish';
		} else if (positiveCount > 0 || negativeCount > 0) {
			trend = 'mixed';
		}
	}

	// Find top gainer/loser
	const allItems = [...indicesData, ...commoditiesData];
	const sorted = allItems.sort((a, b) => b.changePercent - a.changePercent);
	const topGainer = sorted[0]
		? { symbol: sorted[0].symbol, change: sorted[0].changePercent }
		: undefined;
	const topLoser = sorted[sorted.length - 1]
		? {
				symbol: sorted[sorted.length - 1].symbol,
				change: sorted[sorted.length - 1].changePercent
			}
		: undefined;

	// Find VIX and classify fear level
	const vixItem = commoditiesData.find(
		(c) => c.symbol === '^VIX' || c.symbol === 'VIX'
	);
	const vixAnalysis = classifyVix(vixItem?.price);

	return {
		indices: indicesData,
		sectors: sectorsData,
		commodities: commoditiesData,
		trend,
		vix: vixItem?.price,
		vixAnalysis,
		topGainer,
		topLoser
	};
}

/**
 * Build crypto context from crypto store and whale data
 */
function buildCryptoContext(
	whaleTransactions: WhaleTransaction[] = []
): CryptoContext {
	const marketsState = get(markets);
	const cryptoData = marketsState.crypto.items;

	// Calculate whale activity
	const totalWhaleVolume = whaleTransactions.reduce((sum, tx) => sum + tx.usd, 0);
	const buyVolume = whaleTransactions
		.filter((tx) => tx.direction === 'buy')
		.reduce((sum, tx) => sum + tx.usd, 0);
	const sellVolume = whaleTransactions
		.filter((tx) => tx.direction === 'sell')
		.reduce((sum, tx) => sum + tx.usd, 0);

	let dominantDirection: 'buying' | 'selling' | 'mixed' = 'mixed';
	if (buyVolume > sellVolume * 1.5) {
		dominantDirection = 'buying';
	} else if (sellVolume > buyVolume * 1.5) {
		dominantDirection = 'selling';
	}

	return {
		prices: cryptoData,
		whaleTransactions: whaleTransactions.slice(0, 10),
		totalWhaleVolume,
		dominantDirection
	};
}

/**
 * Build infrastructure context with data quality warnings
 */
function buildInfrastructureContext(
	gridStress: ExternalData['gridStress'] = [],
	outages: ExternalData['outages'] = []
): InfrastructureContext {
	return {
		gridStress: gridStress.slice(0, 10),
		outages: outages.slice(0, 10),
		dataQuality: {
			tier: CATEGORY_TIERS.gridStress,
			tierLabel: DATA_TIERS[CATEGORY_TIERS.gridStress].label,
			note: 'Infrastructure data has variable coverage and reliability.',
			limitations: `Grid: ${DATA_LIMITATIONS.gridStress} | Outages: ${DATA_LIMITATIONS.outages}`
		}
	};
}

/**
 * Build analysis context from correlation/narrative engines
 */
function buildAnalysisContext(
	correlations: CorrelationResult[] = [],
	narratives: NarrativeResult[] = [],
	mainCharacters: MainCharacterResult[] = []
): AnalysisContext {
	// Extract emerging topics from narratives
	const emergingTopics = narratives
		.filter((n) => n.trend === 'emerging')
		.map((n) => n.narrative)
		.slice(0, 5);

	return {
		correlations: correlations.slice(0, 10),
		narratives: narratives.slice(0, 10),
		mainCharacters: mainCharacters.slice(0, 10),
		emergingTopics
	};
}

/**
 * Build monitors context from monitors store
 */
function buildMonitorsContext(): MonitorsContext {
	const activeMonitorsList = get(enabledMonitors);

	// Calculate total matches
	const totalMatches = activeMonitorsList.reduce(
		(sum, m) => sum + m.matchCount,
		0
	);

	// Get top matching keywords
	const keywordCounts: Record<string, number> = {};
	activeMonitorsList.forEach((m) => {
		if (m.matchCount > 0) {
			m.keywords.forEach((k) => {
				keywordCounts[k] = (keywordCounts[k] || 0) + m.matchCount;
			});
		}
	});
	const topMatchingKeywords = Object.entries(keywordCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([k]) => k);

	return {
		activeMonitors: activeMonitorsList.map((m) => ({
			name: m.name,
			keywords: m.keywords,
			matchCount: m.matchCount
		})),
		totalMatches,
		topMatchingKeywords
	};
}

/**
 * Build environmental context with data quality warnings for Tier 3 data
 */
function buildEnvironmentalContext(
	earthquakes: EarthquakeData[] = [],
	radiation: RadiationReading[] = [],
	diseaseOutbreaks: DiseaseOutbreak[] = []
): EnvironmentalContext {
	// Generate significant events summary
	const significantEvents: string[] = [];

	// Significant earthquakes (M5.5+)
	const bigQuakes = earthquakes.filter((eq) => eq.magnitude >= 5.5);
	bigQuakes.forEach((eq) => {
		significantEvents.push(`M${eq.magnitude.toFixed(1)} earthquake: ${eq.place}`);
	});

	// Elevated radiation
	const elevatedRadiation = radiation.filter(
		(r) => r.level === 'elevated' || r.level === 'high' || r.level === 'dangerous'
	);
	if (elevatedRadiation.length > 0) {
		significantEvents.push(
			`${elevatedRadiation.length} elevated radiation readings detected`
		);
	}

	// Active outbreaks
	const activeOutbreaks = diseaseOutbreaks.filter(
		(o) => o.status === 'active' && o.severity !== 'low'
	);
	activeOutbreaks.forEach((o) => {
		significantEvents.push(`${o.disease} outbreak in ${o.country}: ${o.status}`);
	});

	return {
		earthquakes: earthquakes.slice(0, 10),
		radiation: radiation.slice(0, 10),
		diseaseOutbreaks: diseaseOutbreaks.slice(0, 10),
		significantEvents,
		dataQuality: {
			earthquakes: {
				tier: CATEGORY_TIERS.earthquakes,
				tierLabel: DATA_TIERS[CATEGORY_TIERS.earthquakes].label,
				note: 'USGS earthquake data is reliable for detection.',
				limitations: DATA_LIMITATIONS.earthquakes
			},
			radiation: {
				tier: CATEGORY_TIERS.radiation,
				tierLabel: DATA_TIERS[CATEGORY_TIERS.radiation].label,
				note: 'Safecast radiation readings have sparse global coverage.',
				limitations: DATA_LIMITATIONS.radiation
			},
			diseaseOutbreaks: {
				tier: CATEGORY_TIERS.diseaseOutbreaks,
				tierLabel: DATA_TIERS[CATEGORY_TIERS.diseaseOutbreaks].label,
				note: 'Disease data has inherent reporting delays.',
				limitations: DATA_LIMITATIONS.diseaseOutbreaks
			}
		}
	};
}

/**
 * Build alternative data context with Tier 2 reliability notes
 */
function buildAlternativeContext(
	predictions: Prediction[] = [],
	govContracts: Contract[] = [],
	layoffs: Layoff[] = []
): AlternativeContext {
	return {
		predictions: predictions.slice(0, 10),
		govContracts: govContracts.slice(0, 10),
		layoffs: layoffs.slice(0, 10),
		dataQuality: {
			predictions: {
				tier: CATEGORY_TIERS.predictions,
				tierLabel: DATA_TIERS[CATEGORY_TIERS.predictions].label,
				note: 'Polymarket predictions are crowd-sourced probabilities, not forecasts. Treat as market sentiment indicators.',
				limitations:
					'Prediction markets reflect participant opinions and can be biased. Not reliable for certain outcomes.'
			},
			govContracts: {
				tier: CATEGORY_TIERS.govContracts,
				tierLabel: DATA_TIERS[CATEGORY_TIERS.govContracts].label,
				note: 'Government contract data from USASpending.gov. May have reporting delays of days to weeks.',
				limitations:
					'Contract data may not reflect latest awards. Some contracts may be classified or delayed in reporting.'
			},
			layoffs: {
				tier: CATEGORY_TIERS.layoffs,
				tierLabel: DATA_TIERS[CATEGORY_TIERS.layoffs].label,
				note: 'Layoff data aggregated from news sources. Numbers may be estimates.',
				limitations:
					'Layoff announcements may differ from actual separations. Small layoffs may not be reported.'
			}
		}
	};
}

/**
 * Estimate token count for a context object
 */
function estimateTokens(context: IntelligenceContext): number {
	const jsonString = JSON.stringify(context);
	return Math.ceil(jsonString.length / CHARS_PER_TOKEN);
}

/**
 * Truncate context to fit within token limits
 */
function truncateContext(
	context: IntelligenceContext,
	maxTokens: number
): IntelligenceContext {
	let currentTokens = estimateTokens(context);

	if (currentTokens <= maxTokens) {
		return context;
	}

	// Create a mutable copy
	const truncated = JSON.parse(JSON.stringify(context)) as IntelligenceContext;
	truncated.metadata.truncated = true;
	truncated.metadata.truncationReason = `Reduced from ${currentTokens} to fit ${maxTokens} token limit`;

	// Truncation priorities (remove least important first)
	const truncationOrder: (keyof IntelligenceContext)[] = [
		'alternative',
		'environmental',
		'infrastructure',
		'monitors',
		'crypto',
		'analysis',
		'markets',
		'news',
		'geopolitical'
	];

	for (const key of truncationOrder) {
		if (currentTokens <= maxTokens) break;

		const section = truncated[key];
		if (!section) continue;

		// Reduce arrays in the section
		if (typeof section === 'object' && section !== null) {
			for (const [k, v] of Object.entries(section)) {
				if (Array.isArray(v) && v.length > 3) {
					(section as Record<string, unknown>)[k] = v.slice(0, 3);
				}
			}
		}

		currentTokens = estimateTokens(truncated);
	}

	return truncated;
}

/**
 * Build reliability tier summary for the LLM to understand data quality
 */
function buildReliabilityTierSummary(): IntelligenceContext['reliabilityTiers'] {
	return {
		tier1: {
			label: DATA_TIERS[1].label,
			description: DATA_TIERS[1].description,
			categories: ['News articles (with links)', 'Market data', 'Cryptocurrency prices', 'Whale transactions'],
			guidance: DATA_TIERS[1].guidance
		},
		tier2: {
			label: DATA_TIERS[2].label,
			description: DATA_TIERS[2].description,
			categories: ['Polymarket predictions', 'Government contracts', 'Layoffs data', 'Geopolitical hotspots'],
			guidance: DATA_TIERS[2].guidance
		},
		tier3: {
			label: DATA_TIERS[3].label,
			description: DATA_TIERS[3].description,
			categories: ['Grid stress', 'Radiation readings', 'Disease outbreaks', 'Earthquakes', 'Outages'],
			guidance: DATA_TIERS[3].guidance,
			limitations: DATA_LIMITATIONS
		}
	};
}

/**
 * Main function to build complete intelligence context
 */
export function buildIntelligenceContext(
	preferences: LLMPreferences = DEFAULT_LLM_PREFERENCES,
	externalData: ExternalData = {}
): IntelligenceContext {
	const now = Date.now();
	const refreshState = get(refresh);

	// Build context sections based on enabled categories
	const context: IntelligenceContext = {
		timestamp: new Date(now).toISOString(),
		generatedAt: now,
		version: CONTEXT_VERSION,
		// Include reliability tier guidance for the LLM
		reliabilityTiers: buildReliabilityTierSummary(),
		metadata: {
			enabledCategories: Object.entries(preferences.enabledCategories)
				.filter(([, enabled]) => enabled)
				.map(([cat]) => cat as ContextCategory),
			totalItems: 0,
			dataFreshness: {},
			truncated: false
		}
	};

	// Build each enabled section
	if (preferences.enabledCategories.geopolitical) {
		context.geopolitical = buildGeopoliticalContext();
		// Add world leaders if available
		if (externalData.worldLeaders && externalData.worldLeaders.length > 0) {
			context.geopolitical.worldLeaders = externalData.worldLeaders
				.filter((l) => l.news && l.news.length > 0)
				.slice(0, 10)
				.map((l) => ({
					name: l.name,
					title: l.title,
					country: l.country,
					party: l.party,
					focus: l.focus,
					recentNewsCount: l.news?.length || 0,
					recentHeadlines: l.news?.slice(0, 3).map((n) => n.title) || []
				}));
		}
	}

	if (preferences.enabledCategories.news) {
		context.news = buildNewsContext(preferences);
		context.metadata.totalItems += context.news.totalCount;
		// Track news data freshness
		if (context.news.totalCount > 0) {
			context.metadata.dataFreshness['news'] = now;
		}
	}

	if (preferences.enabledCategories.markets) {
		context.markets = buildMarketsContext();
		context.metadata.totalItems +=
			context.markets.indices.length +
			context.markets.sectors.length +
			context.markets.commodities.length;
		// Track markets data freshness
		if (context.markets.indices.length > 0) {
			context.metadata.dataFreshness['markets'] = now;
		}
	}

	if (preferences.enabledCategories.crypto) {
		context.crypto = buildCryptoContext(externalData.whaleTransactions);
		context.metadata.totalItems +=
			context.crypto.prices.length + context.crypto.whaleTransactions.length;
		// Track crypto data freshness
		if (context.crypto.prices.length > 0) {
			context.metadata.dataFreshness['crypto'] = now;
		}
	}

	if (preferences.enabledCategories.infrastructure) {
		context.infrastructure = buildInfrastructureContext(
			externalData.gridStress,
			externalData.outages
		);
		// Track infrastructure freshness (if data available)
		if (
			(externalData.gridStress?.length ?? 0) > 0 ||
			(externalData.outages?.length ?? 0) > 0
		) {
			context.metadata.dataFreshness['infrastructure'] = now;
		}
	}

	if (preferences.enabledCategories.analysis) {
		context.analysis = buildAnalysisContext(
			externalData.correlations,
			externalData.narratives,
			externalData.mainCharacters
		);
	}

	if (preferences.enabledCategories.monitors) {
		context.monitors = buildMonitorsContext();
		context.metadata.totalItems += context.monitors.totalMatches;
	}

	if (preferences.enabledCategories.environmental) {
		context.environmental = buildEnvironmentalContext(
			externalData.earthquakes,
			externalData.radiation,
			externalData.diseaseOutbreaks
		);
		// Track environmental data freshness
		if (
			(externalData.earthquakes?.length ?? 0) > 0 ||
			(externalData.radiation?.length ?? 0) > 0 ||
			(externalData.diseaseOutbreaks?.length ?? 0) > 0
		) {
			context.metadata.dataFreshness['environmental'] = now;
		}
	}

	if (preferences.enabledCategories.alternative) {
		context.alternative = buildAlternativeContext(
			externalData.predictions,
			externalData.govContracts,
			externalData.layoffs
		);
		// Track alternative data freshness
		if (
			(externalData.predictions?.length ?? 0) > 0 ||
			(externalData.govContracts?.length ?? 0) > 0 ||
			(externalData.layoffs?.length ?? 0) > 0
		) {
			context.metadata.dataFreshness['alternative'] = now;
		}
	}

	// Add global data freshness from refresh store
	if (refreshState.lastRefresh) {
		context.metadata.dataFreshness['lastRefresh'] = refreshState.lastRefresh;
	}

	// Truncate if needed
	const maxTokens = preferences.maxContextTokens;
	const finalContext = truncateContext(context, maxTokens);

	return finalContext;
}

/**
 * Generate a context summary for display
 * Shows data availability organized by reliability tier
 */
export function getContextSummary(context: IntelligenceContext): string {
	const parts: string[] = [];

	// Tier 1 - High Reliability data
	const tier1Parts: string[] = [];
	if (context.news) {
		tier1Parts.push(`${context.news.totalCount} news (${context.news.alertCount} alerts)`);
	}
	if (context.markets) {
		let marketPart = `Markets: ${context.markets.trend}`;
		if (context.markets.vixAnalysis) {
			marketPart += `, VIX: ${context.markets.vixAnalysis.label}`;
		}
		tier1Parts.push(marketPart);
	}
	if (context.crypto) {
		tier1Parts.push(`${context.crypto.prices.length} crypto`);
		if (context.crypto.whaleTransactions.length > 0) {
			tier1Parts.push(`${context.crypto.whaleTransactions.length} whale txns`);
		}
	}

	if (tier1Parts.length > 0) {
		parts.push(`[T1] ${tier1Parts.join(', ')}`);
	}

	// Tier 2 - Medium Reliability data
	const tier2Parts: string[] = [];
	if (context.geopolitical) {
		const critical = context.geopolitical.hotspots.filter(
			(h) => h.level === 'critical'
		).length;
		if (critical > 0) {
			tier2Parts.push(`${critical} critical hotspots`);
		}
		// World leaders in the news
		if (context.geopolitical.worldLeaders && context.geopolitical.worldLeaders.length > 0) {
			tier2Parts.push(`${context.geopolitical.worldLeaders.length} leaders in news`);
		}
		// Infrastructure summary
		if (context.geopolitical.criticalInfrastructure) {
			const infraCount =
				(context.geopolitical.criticalInfrastructure.cableLandings?.length || 0) +
				(context.geopolitical.criticalInfrastructure.nuclearSites?.length || 0) +
				(context.geopolitical.criticalInfrastructure.militaryBases?.length || 0);
			if (infraCount > 0) {
				tier2Parts.push(`${infraCount} infrastructure sites`);
			}
		}
	}
	if (context.alternative) {
		if (context.alternative.predictions.length > 0) {
			tier2Parts.push(`${context.alternative.predictions.length} predictions`);
		}
		if (context.alternative.govContracts.length > 0) {
			tier2Parts.push(`${context.alternative.govContracts.length} contracts`);
		}
		if (context.alternative.layoffs.length > 0) {
			tier2Parts.push(`${context.alternative.layoffs.length} layoffs`);
		}
	}

	if (tier2Parts.length > 0) {
		parts.push(`[T2] ${tier2Parts.join(', ')}`);
	}

	// Tier 3 - Lower Reliability data (note limitations)
	const tier3Parts: string[] = [];
	if (context.infrastructure) {
		if (context.infrastructure.gridStress.length > 0) {
			tier3Parts.push(`${context.infrastructure.gridStress.length} grid readings`);
		}
		if (context.infrastructure.outages.length > 0) {
			tier3Parts.push(`${context.infrastructure.outages.length} outages`);
		}
	}
	if (context.environmental) {
		if (context.environmental.earthquakes.length > 0) {
			tier3Parts.push(`${context.environmental.earthquakes.length} quakes`);
		}
		if (context.environmental.radiation.length > 0) {
			tier3Parts.push(`${context.environmental.radiation.length} radiation`);
		}
		if (context.environmental.diseaseOutbreaks.length > 0) {
			tier3Parts.push(`${context.environmental.diseaseOutbreaks.length} outbreaks`);
		}
	}

	if (tier3Parts.length > 0) {
		parts.push(`[T3*] ${tier3Parts.join(', ')}`);
	}

	// Monitor matches
	if (context.monitors && context.monitors.totalMatches > 0) {
		parts.push(`${context.monitors.totalMatches} monitor matches`);
	}

	if (context.metadata.truncated) {
		parts.push('(truncated)');
	}

	return parts.join(' | ');
}

/**
 * Generate a detailed context summary with reliability notes
 * Useful for displaying to users or in system prompts
 */
export function getDetailedContextSummary(context: IntelligenceContext): string {
	const lines: string[] = [];

	lines.push('## Intelligence Context Summary');
	lines.push(`Generated: ${context.timestamp}`);
	lines.push('');

	// Tier 1 - High Reliability
	lines.push('### Tier 1 - High Reliability (prioritize in analysis)');
	if (context.news) {
		const newsContext = context.news as EnhancedNewsContext;
		lines.push(
			`- **News**: ${context.news.totalCount} articles, ${context.news.alertCount} alerts`
		);
		if (newsContext.formattedByCategory) {
			lines.push('  - Articles include direct links for citation');
		}
	}
	if (context.markets) {
		lines.push(
			`- **Markets**: ${context.markets.indices.length} indices, trend: ${context.markets.trend}`
		);
	}
	if (context.crypto) {
		lines.push(`- **Crypto**: ${context.crypto.prices.length} prices`);
		if (context.crypto.whaleTransactions.length > 0) {
			lines.push(
				`- **Whale Activity**: ${context.crypto.whaleTransactions.length} transactions, direction: ${context.crypto.dominantDirection}`
			);
		}
	}
	lines.push('');

	// Tier 2 - Medium Reliability
	if (context.alternative || context.geopolitical) {
		lines.push('### Tier 2 - Medium Reliability (use with context)');
		if (context.geopolitical) {
			const critical = context.geopolitical.hotspots.filter(
				(h) => h.level === 'critical'
			).length;
			lines.push(`- **Geopolitical**: ${context.geopolitical.hotspots.length} hotspots (${critical} critical)`);
		}
		if (context.alternative) {
			if (context.alternative.predictions.length > 0) {
				lines.push(
					`- **Predictions**: ${context.alternative.predictions.length} items (crowd-sourced, not forecasts)`
				);
			}
			if (context.alternative.govContracts.length > 0) {
				lines.push(
					`- **Gov Contracts**: ${context.alternative.govContracts.length} items (may have reporting delays)`
				);
			}
			if (context.alternative.layoffs.length > 0) {
				lines.push(`- **Layoffs**: ${context.alternative.layoffs.length} items`);
			}
		}
		lines.push('');
	}

	// Tier 3 - Lower Reliability
	if (context.infrastructure || context.environmental) {
		lines.push('### Tier 3 - Lower Reliability (note limitations)');
		if (context.infrastructure) {
			if (context.infrastructure.gridStress.length > 0) {
				lines.push(
					`- **Grid Stress**: ${context.infrastructure.gridStress.length} readings - *${DATA_LIMITATIONS.gridStress}*`
				);
			}
			if (context.infrastructure.outages.length > 0) {
				lines.push(
					`- **Outages**: ${context.infrastructure.outages.length} items - *${DATA_LIMITATIONS.outages}*`
				);
			}
		}
		if (context.environmental) {
			if (context.environmental.earthquakes.length > 0) {
				lines.push(
					`- **Earthquakes**: ${context.environmental.earthquakes.length} items - *${DATA_LIMITATIONS.earthquakes}*`
				);
			}
			if (context.environmental.radiation.length > 0) {
				lines.push(
					`- **Radiation**: ${context.environmental.radiation.length} readings - *${DATA_LIMITATIONS.radiation}*`
				);
			}
			if (context.environmental.diseaseOutbreaks.length > 0) {
				lines.push(
					`- **Disease Outbreaks**: ${context.environmental.diseaseOutbreaks.length} items - *${DATA_LIMITATIONS.diseaseOutbreaks}*`
				);
			}
		}
		lines.push('');
	}

	if (context.metadata.truncated) {
		lines.push(`*Note: Context was truncated. ${context.metadata.truncationReason}*`);
	}

	return lines.join('\n');
}

/**
 * Export context as downloadable JSON
 */
export function exportContextAsJSON(context: IntelligenceContext): string {
	return JSON.stringify(context, null, 2);
}

/**
 * Create a hash of the context for tracking
 */
export function hashContext(context: IntelligenceContext): string {
	const str = JSON.stringify({
		timestamp: context.timestamp,
		categories: context.metadata.enabledCategories,
		itemCount: context.metadata.totalItems
	});
	// Simple hash for identification
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash).toString(16).substring(0, 8);
}
