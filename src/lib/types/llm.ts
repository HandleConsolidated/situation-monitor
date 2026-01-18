/**
 * LLM Integration Type Definitions
 * Types for context building, chat, and LLM preferences
 */

import type {
	NewsItem,
	NewsCategory,
	MarketItem,
	SectorPerformance,
	CryptoItem,
	CorrelationResult,
	NarrativeResult,
	MainCharacterResult,
	EarthquakeData,
	DiseaseOutbreak,
	WhaleTransaction
} from './index';
import type {
	Contract,
	Layoff,
	Prediction,
	GridStressData,
	RadiationReading
} from '$lib/api';

// ============================================================================
// Context Categories - What data to include in LLM context
// ============================================================================

export type ContextCategory =
	| 'geopolitical'
	| 'news'
	| 'markets'
	| 'crypto'
	| 'infrastructure'
	| 'analysis'
	| 'monitors'
	| 'environmental'
	| 'alternative';

// ============================================================================
// Intelligence Context - Structured JSON for LLM consumption
// ============================================================================

/**
 * Geopolitical context including hotspots, conflict zones, and critical infrastructure
 */
export interface GeopoliticalContext {
	hotspots: Array<{
		name: string;
		location: string;
		level: 'low' | 'elevated' | 'high' | 'critical';
		description?: string;
	}>;
	conflictZones: string[];
	chokepoints: Array<{ name: string; description: string }> | string[];
	criticalInfrastructure?: {
		cableLandings: Array<{ name: string; description: string }>;
		nuclearSites: Array<{ name: string; description: string }>;
		militaryBases: Array<{ name: string; description: string }>;
	};
	worldLeaders?: Array<{
		name: string;
		title: string;
		country: string;
		party?: string;
		focus?: string[];
		recentNewsCount: number;
		recentHeadlines: string[];
	}>;
}

/**
 * News context organized by category with summary stats
 */
export interface NewsContext {
	byCategory: Record<NewsCategory, NewsItem[]>;
	alerts: NewsItem[];
	totalCount: number;
	alertCount: number;
	topSources: string[];
	topRegions: string[];
}

/**
 * VIX analysis with fear/greed classification
 */
export interface VixAnalysis {
	value: number;
	status: 'extreme_fear' | 'high_fear' | 'elevated' | 'low' | 'very_low';
	label: string;
	description: string;
}

/**
 * Market context with indices, sectors, and trend analysis
 */
export interface MarketsContext {
	indices: MarketItem[];
	sectors: SectorPerformance[];
	commodities: MarketItem[];
	trend: 'bullish' | 'bearish' | 'mixed' | 'neutral';
	vix?: number;
	vixAnalysis?: VixAnalysis;
	topGainer?: { symbol: string; change: number };
	topLoser?: { symbol: string; change: number };
}

/**
 * Cryptocurrency context with whale activity
 */
export interface CryptoContext {
	prices: CryptoItem[];
	whaleTransactions: WhaleTransaction[];
	totalWhaleVolume: number;
	dominantDirection: 'buying' | 'selling' | 'mixed';
}

/**
 * Data quality info for a context section
 */
export interface DataQualityInfo {
	tier: 1 | 2 | 3;
	tierLabel: string;
	note: string;
	limitations?: string;
	lastUpdated?: number;
}

/**
 * Infrastructure monitoring context
 */
export interface InfrastructureContext {
	gridStress: GridStressData[];
	outages: Array<{
		location: string;
		type: string;
		severity: string;
	}>;
	dataQuality?: DataQualityInfo;
}

/**
 * Analysis engine context - correlations, narratives, main characters
 */
export interface AnalysisContext {
	correlations: CorrelationResult[];
	narratives: NarrativeResult[];
	mainCharacters: MainCharacterResult[];
	emergingTopics: string[];
}

/**
 * User monitors and their matches
 */
export interface MonitorsContext {
	activeMonitors: Array<{
		name: string;
		keywords: string[];
		matchCount: number;
	}>;
	totalMatches: number;
	topMatchingKeywords: string[];
}

/**
 * Environmental events context
 */
export interface EnvironmentalContext {
	earthquakes: EarthquakeData[];
	radiation: RadiationReading[];
	diseaseOutbreaks: DiseaseOutbreak[];
	significantEvents: string[];
	dataQuality?: {
		earthquakes: DataQualityInfo;
		radiation: DataQualityInfo;
		diseaseOutbreaks: DataQualityInfo;
	};
}

/**
 * Alternative data context
 */
export interface AlternativeContext {
	predictions: Prediction[];
	govContracts: Contract[];
	layoffs: Layoff[];
	dataQuality?: {
		predictions: DataQualityInfo;
		govContracts: DataQualityInfo;
		layoffs: DataQualityInfo;
	};
}

/**
 * Data reliability tier summary for the context
 */
export interface ReliabilityTierSummary {
	tier1: {
		label: string;
		description: string;
		categories: string[];
		guidance: string;
	};
	tier2: {
		label: string;
		description: string;
		categories: string[];
		guidance: string;
	};
	tier3: {
		label: string;
		description: string;
		categories: string[];
		guidance: string;
		limitations: Record<string, string>;
	};
}

/**
 * Complete intelligence context for LLM analysis
 */
export interface IntelligenceContext {
	timestamp: string;
	generatedAt: number;
	version: string;

	// Data reliability guidance for the LLM
	reliabilityTiers?: ReliabilityTierSummary;

	// Data sections (all optional based on preferences)
	geopolitical?: GeopoliticalContext;
	news?: NewsContext;
	markets?: MarketsContext;
	crypto?: CryptoContext;
	infrastructure?: InfrastructureContext;
	analysis?: AnalysisContext;
	monitors?: MonitorsContext;
	environmental?: EnvironmentalContext;
	alternative?: AlternativeContext;

	// Metadata
	metadata: {
		enabledCategories: ContextCategory[];
		totalItems: number;
		dataFreshness: Record<string, number>;
		truncated: boolean;
		truncationReason?: string;
	};
}

// ============================================================================
// User Preferences for LLM Analysis
// ============================================================================

/**
 * Analysis depth levels
 */
export type AnalysisDepth = 'brief' | 'standard' | 'detailed';

/**
 * LLM provider options
 */
export type LLMProvider = 'openai' | 'anthropic' | 'custom';

/**
 * User preferences for LLM analysis
 */
export interface LLMPreferences {
	// Category toggles
	enabledCategories: Record<ContextCategory, boolean>;

	// News filters
	newsFilters: {
		categories: NewsCategory[];
		maxItemsPerCategory: number;
		alertsOnly: boolean;
		includeRegions: string[];
	};

	// Analysis configuration
	analysisDepth: AnalysisDepth;
	maxContextTokens: number;

	// LLM provider settings
	provider: LLMProvider;
	apiKey?: string; // Encrypted/stored securely
	customEndpoint?: string;
	model?: string;

	// Custom prompts
	systemPrompt?: string;
	focusAreas?: string[];
}

/**
 * Default LLM preferences
 */
export const DEFAULT_LLM_PREFERENCES: LLMPreferences = {
	enabledCategories: {
		geopolitical: true,
		news: true,
		markets: true,
		crypto: true,
		infrastructure: true,
		analysis: true,
		monitors: true,
		environmental: true,
		alternative: false
	},
	newsFilters: {
		categories: ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'],
		maxItemsPerCategory: 10,
		alertsOnly: false,
		includeRegions: []
	},
	analysisDepth: 'standard',
	maxContextTokens: 50000,
	provider: 'anthropic',
	model: 'claude-sonnet-4-20250514'
};

// ============================================================================
// Chat Messages and Sessions
// ============================================================================

/**
 * Chat message role
 */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * A single chat message
 */
export interface ChatMessage {
	id: string;
	role: ChatRole;
	content: string;
	timestamp: number;
	contextSnapshot?: string; // Hash of the context used for this message
	tokenCount?: number;
	error?: string;
}

/**
 * A chat session containing multiple messages
 */
export interface ChatSession {
	id: string;
	title: string;
	messages: ChatMessage[];
	createdAt: number;
	lastActiveAt: number;
	contextCategories: ContextCategory[];
}

/**
 * Chat state for the store
 */
export interface ChatState {
	sessions: ChatSession[];
	activeSessionId: string | null;
	isLoading: boolean;
	error: string | null;
	initialized: boolean;
}

// ============================================================================
// LLM API Types
// ============================================================================

/**
 * LLM API request
 */
export interface LLMRequest {
	messages: Array<{
		role: ChatRole;
		content: string;
	}>;
	model?: string;
	maxTokens?: number;
	temperature?: number;
	systemPrompt?: string;
}

/**
 * LLM API response
 */
export interface LLMResponse {
	content: string;
	model: string;
	tokenUsage?: {
		input: number;
		output: number;
		total: number;
	};
	finishReason?: string;
}

/**
 * LLM service status
 */
export interface LLMServiceStatus {
	available: boolean;
	provider: LLMProvider;
	model?: string;
	lastError?: string;
	lastSuccess?: number;
}

// ============================================================================
// Analysis Prompts
// ============================================================================

/**
 * Pre-defined analysis prompt templates
 */
export interface AnalysisPrompt {
	id: string;
	name: string;
	description: string;
	prompt: string;
	focusCategories: ContextCategory[];
}

/**
 * Built-in analysis prompts
 */
export const ANALYSIS_PROMPTS: AnalysisPrompt[] = [
	{
		id: 'daily-briefing',
		name: 'Daily Intelligence Briefing',
		description: 'Comprehensive overview of current global situation',
		prompt: `You are **ARTEMIS**, an expert intelligence analyst. Generate a comprehensive daily briefing.

## FORMATTING RULES (CRITICAL)
- Use clean markdown with proper hierarchy: ## for main sections, ### for subsections, #### for details
- Every main section MUST start with ## (double hash)
- Use **bold** sparingly for critical items only
- Use > blockquotes for executive summary and key callouts
- Use tables for comparative data (always include header row with |---|)
- Use bullet lists (-) for details, numbered lists (1.) for prioritized items
- Keep paragraphs short (2-3 sentences max)
- Add --- horizontal rules between major sections
- NO emoji or special characters

## DATA RULES
- ONLY use data from the provided context
- Cite sources inline: *[Source: publication name]*
- If data missing, write: "*Data not available*"

---

## REQUIRED STRUCTURE

## Executive Summary

> *2-3 sentences: Most critical finding and its strategic implication.*

---

## Priority Developments

### 1. [Development Title]
- **Situation**: What is happening *[cite source]*
- **Impact**: Why it matters strategically
- **Outlook**: Likely trajectory

### 2. [Next Development]
*(repeat pattern for 3-5 key developments)*

---

## Threat Assessment

| Region | Level | Trend | Primary Driver |
|--------|-------|-------|----------------|
| *[from hotspots data]* | CRITICAL/HIGH/ELEVATED/LOW | ↑↓→ | *brief description* |

---

## Market Conditions

**Overall Sentiment**: [Bullish/Bearish/Mixed/Neutral]

| Asset Class | Performance | Key Movement |
|-------------|-------------|--------------|
| *Equities* | *[from data]* | *[notable change]* |
| *Crypto* | *[from data]* | *[whale activity if any]* |
| *Commodities* | *[from data]* | *[VIX status if available]* |

---

## Patterns & Correlations

### Detected Patterns
- **[Pattern name]**: *[description from correlation data]*

### Narrative Tracking
- *[narrative topic]*: [fringe/growing/mainstream] — *[implication]*

---

## Watch List (24hr)

1. **[Item]** — *[reason to monitor]*
2. **[Item]** — *[reason to monitor]*
3. **[Item]** — *[reason to monitor]*

---

*Analysis generated by ARTEMIS. Data freshness indicators are embedded in context.*`,
		focusCategories: ['geopolitical', 'news', 'markets', 'analysis']
	},
	{
		id: 'threat-assessment',
		name: 'Threat Assessment',
		description: 'Focus on security threats and risk factors',
		prompt: `You are **ARTEMIS**, a security intelligence analyst. Generate a threat assessment.

## FORMATTING RULES (CRITICAL)
- Use clean markdown: ## for sections, ### for subsections
- Use > blockquotes for critical warnings and summary
- Tables for threat matrices (always include |---| separator row)
- Bullet lists for details, keep concise
- Use **bold** only for threat levels and critical items
- Add --- between major sections
- NO emoji

## DATA RULES
- Base ALL assessments on provided context data
- Cite sources: *[Source: name]*
- For missing data: "*Insufficient data*"
- Err on side of caution in ratings

---

## REQUIRED STRUCTURE

## Threat Summary

> **[Highest threat level observed]**: *1-2 sentence summary of most critical active threats.*

---

## Active Threat Matrix

| Region/Hotspot | Level | Trend | Key Indicator |
|----------------|-------|-------|---------------|
| *[name]* | **CRITICAL** | ↑ Rising | *[specific event/data]* |
| *[name]* | **HIGH** | → Stable | *[specific event/data]* |
| *[name]* | **ELEVATED** | ↓ Declining | *[specific event/data]* |

**Legend**: CRITICAL = immediate concern | HIGH = elevated monitoring | ELEVATED = watch status | LOW = baseline

---

## Geopolitical Analysis

### [Hotspot Name 1]

| Aspect | Assessment |
|--------|------------|
| Status | *[current situation from news]* |
| Escalation Risk | Low/Medium/High — *[rationale]* |
| Key Actors | *[identified parties]* |
| Trigger Events | *[what to watch]* |

### [Hotspot Name 2]
*(repeat pattern)*

---

## Infrastructure Status

### Grid & Power
- **Status**: [Normal/Stressed/Critical]
- **Active Issues**: *[from grid stress data]*

### Network & Connectivity
- **Outages**: *[count and locations from outage data]*
- **Impact Assessment**: *[severity]*

---

## Environmental Hazards

| Type | Location | Severity | Details |
|------|----------|----------|---------|
| Seismic | *[from earthquake data]* | *[magnitude]* | *[impact]* |
| Radiation | *[from radiation data]* | *[level]* | *[status]* |
| Disease | *[from outbreak data]* | *[cases]* | *[trend]* |

---

## Cross-Domain Correlations

> *[Any patterns linking multiple threat domains — e.g., cyber + geopolitical, environmental + infrastructure]*

---

## Intelligence Gaps

- *[List areas where data is insufficient for assessment]*

---

*Assessment generated by ARTEMIS. Confidence levels based on source corroboration.*`,
		focusCategories: ['geopolitical', 'news', 'infrastructure', 'environmental']
	},
	{
		id: 'market-analysis',
		name: 'Market Intelligence',
		description: 'Financial markets and economic analysis',
		prompt: `You are **Artemis**, an expert intelligence analyst specializing in financial markets, economic indicators, cryptocurrency dynamics, and the intersection of geopolitical events with market movements. Your analysis informs strategic financial decision-making.

## Your Task
Provide comprehensive market intelligence analysis based on the provided data context.

## Data Integrity Rules
- **ONLY** use market data, prices, and trends explicitly provided in the context
- You may reference well-known market principles and established economic relationships
- **NEVER** fabricate price targets, specific percentage predictions, or financial metrics not in the data
- Do not provide specific investment advice or price predictions beyond what the data supports
- If market data is incomplete, state what's missing rather than estimate
- Treat the provided data as the most current and authoritative source

## Citation Requirements
- Cite specific market indices, prices, or metrics: [Data: S&P 500 at X, change Y%]
- Reference specific news items when correlating events to market movements: [Source: Article Title]
- Distinguish between **market facts** (prices, volumes) and **analytical interpretation** (sentiment, outlook)

## Required Output Structure

### Market Overview
> 2-3 sentence executive summary of current market conditions

### Index & Sector Performance

| Index/Sector | Current Level | Change | Trend | Notable Driver |
|--------------|---------------|--------|-------|----------------|
| (from provided data) |

### Detailed Analysis

#### Equity Markets
- Overall sentiment assessment based on provided indices [cite data]
- Sector rotation patterns (if evident)
- Volume and volatility indicators (VIX if available)

#### Cryptocurrency Markets
- Major asset performance [cite specific prices/changes]
- **Whale Activity Analysis**:
  - Total whale volume: [from data]
  - Dominant direction: [buying/selling/mixed]
  - Notable transactions and potential implications
- Market structure observations

#### Commodities
- Key commodity movements [cite specific data]
- Supply/demand indicators present in the data

### Geopolitical-Market Correlations
For each correlation identified:
- **Event**: [cite news source]
- **Market Impact**: [cite market data]
- **Mechanism**: How the connection manifests
- **Confidence**: High/Medium/Low based on evidence strength

### Risk & Opportunity Assessment

| Factor | Type | Potential Impact | Supporting Evidence |
|--------|------|------------------|---------------------|
| (identify from data) | Risk/Opportunity | High/Medium/Low | [cite sources] |

### Key Metrics Summary
- Market trend: [from data]
- Top gainer: [if in data]
- Top loser: [if in data]
- Whale sentiment: [from whale transaction analysis]

### Data Limitations
Note any significant gaps in the provided market data

---
**Response Formatting**: Use markdown tables for numerical data, **bold** for significant moves, and blockquotes for key insights. Charts cannot be generated, but describe trends clearly.`,
		focusCategories: ['markets', 'crypto', 'news', 'analysis']
	},
	{
		id: 'correlation-deep-dive',
		name: 'Pattern & Correlation Analysis',
		description: 'Deep analysis of detected patterns',
		prompt: `You are **Artemis**, an expert intelligence analyst specializing in pattern recognition, narrative analysis, information correlation, and detection of coordinated information campaigns. Your analysis helps distinguish signal from noise in complex information environments.

## Your Task
Conduct a deep analysis of detected patterns, correlations, and narrative trends in the provided intelligence context.

## Data Integrity Rules
- **ONLY** analyze patterns and correlations explicitly identified in the provided context
- You may apply established analytical frameworks (e.g., narrative progression models, correlation validation techniques)
- **NEVER** fabricate correlation scores, actor attributions, or source counts not in the data
- Express appropriate uncertainty when pattern significance is ambiguous
- **Critical thinking is essential** - not all correlations are meaningful; validate rigorously
- Treat the provided data as the most current and authoritative source

## Citation Requirements
- Each correlation claim must reference specific data points: [Correlation: Topic X, confidence Y%]
- Narrative tracking must cite specific sources showing progression: [Source 1] → [Source 2] → [Source 3]
- Main character analysis must cite evidence for prominence: [Mentions: N articles, sources: X, Y, Z]
- Clearly separate **detected patterns** from **analytical interpretation**

## Required Output Structure

### Pattern Analysis Summary
> Key finding: The most significant pattern identified and its implications

### Correlation Validation

For each detected correlation in the data:

#### [Correlation Topic]
- **Detected Pattern**: [describe from data]
- **Evidence Strength**: [cite specific articles/sources]
- **Validity Assessment**:
  - Is this correlation **meaningful** or **coincidental**?
  - Alternative explanations considered
  - Cross-source corroboration level
- **Confidence**: High/Medium/Low with rationale

### Narrative Evolution Tracking

For each tracked narrative:

| Stage | Timeframe | Sources | Key Characteristics |
|-------|-----------|---------|---------------------|
| Fringe | [from data] | [cite] | Initial emergence |
| Growing | [from data] | [cite] | Amplification patterns |
| Mainstream | [from data] | [cite] | Broad adoption |

- **Trajectory**: Accelerating / Stable / Declining
- **Influence Vectors**: How the narrative spreads [cite evidence]
- **Predicted Development**: Based on observed patterns (with uncertainty acknowledgment)

### Main Character Analysis

| Actor/Entity | Prominence Score | Article Count | Context | Sentiment |
|--------------|------------------|---------------|---------|-----------|
| (from data) | [cite score] | [cite count] | [role in narratives] | [from analysis] |

- **Activity Patterns**: What are key actors doing? [cite specific articles]
- **Network Effects**: Connections between main characters (if evident)

### Information Integrity Assessment

#### Potential Misinformation Indicators
- Inconsistencies between sources [cite specific conflicts]
- Unusual amplification patterns
- Source credibility considerations

#### Coordinated Campaign Indicators
- Synchronized messaging patterns (if detected)
- Cross-platform correlation (if data supports)
- **Confidence Level**: High/Medium/Low/Insufficient Data

### Monitor Matches Analysis
- Active monitors triggered: [list from data]
- Keyword frequency patterns
- Emerging topics requiring new monitors

### Analytical Limitations
- Patterns requiring more data to validate
- Ambiguous correlations requiring further observation
- Potential blind spots in current monitoring

---
**Response Formatting**: Use markdown tables for structured comparisons, **bold** for high-confidence findings, *italics* for tentative assessments, and blockquotes for critical insights. Use nested bullet points to show evidence chains.`,
		focusCategories: ['analysis', 'news', 'monitors']
	},
	{
		id: 'custom',
		name: 'Custom Analysis',
		description: 'Ask your own question about the data',
		prompt: '',
		focusCategories: []
	}
];
