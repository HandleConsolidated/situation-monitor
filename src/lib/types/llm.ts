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
	RadiationReading,
	OutageData
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
	outages: OutageData[];
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
	model: 'claude-sonnet-4-5'
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
		prompt: `You are **ARTEMIS**, a financial intelligence analyst. Generate market analysis.

## FORMATTING RULES (CRITICAL)
- Use ## for main sections, ### for subsections
- Tables for all numerical comparisons (always include |---| row)
- > blockquotes for summary and key insights
- Bullet lists for analysis points
- **bold** for significant moves (>2%) and key metrics
- --- between major sections
- NO emoji, NO investment advice

## DATA RULES
- Use ONLY provided market data
- Cite data inline: *[Data: metric value]*
- For missing data: "*Data not available*"
- NO price predictions or targets

---

## REQUIRED STRUCTURE

## Market Summary

> **[Bullish/Bearish/Mixed/Neutral]**: *1-2 sentences on overall market conditions.*

---

## Equity Indices

| Index | Price | Change | Trend |
|-------|-------|--------|-------|
| *[from data]* | *[value]* | *[% change]* | ↑↓→ |

### Notable Movements
- **[Symbol]**: *[change]* — *[context if available]*

---

## Volatility & Risk

| Indicator | Value | Status |
|-----------|-------|--------|
| VIX | *[from data]* | **[EXTREME FEAR/HIGH FEAR/ELEVATED/LOW/VERY LOW]** |

> *[Interpretation of volatility status and what it signals]*

---

## Cryptocurrency

### Major Assets

| Asset | Price | 24h Change | Notes |
|-------|-------|------------|-------|
| *[from crypto data]* | *[price]* | *[change]* | *[any context]* |

### Whale Activity

| Metric | Value |
|--------|-------|
| Total Volume | *[from whale data]* |
| Direction | **[Buying/Selling/Mixed]** |
| Notable Txns | *[count and summary]* |

---

## Sector Performance

| Sector | Performance | Outlook |
|--------|-------------|---------|
| *[from sectors data]* | *[% change]* | *[brief note]* |

---

## Commodities

| Commodity | Price | Change |
|-----------|-------|--------|
| *[from commodities data]* | *[value]* | *[change]* |

---

## Geopolitical Correlations

> *[Any observable connections between news events and market movements]*

### Identified Links
- **Event**: *[news item]* → **Market Impact**: *[observed movement]*

---

## Key Takeaways

1. *[Most important market observation]*
2. *[Secondary insight]*
3. *[What to monitor]*

---

*Analysis by ARTEMIS. Not investment advice.*`,
		focusCategories: ['markets', 'crypto', 'news', 'analysis']
	},
	{
		id: 'correlation-deep-dive',
		name: 'Pattern & Correlation Analysis',
		description: 'Deep analysis of detected patterns',
		prompt: `You are **ARTEMIS**, a pattern recognition analyst. Analyze correlations and narratives.

## FORMATTING RULES (CRITICAL)
- Use ## for main sections, ### for subsections
- Tables for all comparative data (include |---| row)
- > blockquotes for key findings
- Bullet lists for analysis
- **bold** for high-confidence findings
- *italics* for tentative assessments
- --- between sections
- NO emoji

## DATA RULES
- Analyze ONLY patterns in provided context
- Cite correlation data: *[Correlation: topic, confidence%]*
- For no data: "*No patterns detected*"
- Be skeptical — not all correlations are meaningful

---

## REQUIRED STRUCTURE

## Key Finding

> *[Single most significant pattern and its implication]*

---

## Detected Correlations

### [Correlation Topic 1]

| Aspect | Details |
|--------|---------|
| Pattern | *[what was detected]* |
| Evidence | *[sources showing this]* |
| Confidence | **High/Medium/Low** |
| Significance | *[meaningful or coincidental?]* |

### [Correlation Topic 2]
*(repeat pattern)*

---

## Narrative Tracking

### [Narrative Topic]

| Stage | Status | Sources | Indicators |
|-------|--------|---------|------------|
| Fringe | ○/● | *[count]* | *[characteristics]* |
| Growing | ○/● | *[count]* | *[amplification]* |
| Mainstream | ○/● | *[count]* | *[adoption]* |

**Trajectory**: Accelerating / Stable / Declining
**Assessment**: *[implication]*

---

## Main Characters

| Entity | Prominence | Mentions | Role | Sentiment |
|--------|------------|----------|------|-----------|
| *[from data]* | *[score]* | *[count]* | *[context]* | Pos/Neg/Neutral |

### Activity Analysis
- *[What key entities are doing based on articles]*

---

## Monitor Matches

| Monitor | Matches | Top Keywords |
|---------|---------|--------------|
| *[from monitors data]* | *[count]* | *[keywords triggered]* |

### Emerging Topics
- *[Topics that may warrant new monitors]*

---

## Information Integrity

### Consistency Check
- *[Any conflicting reports between sources]*

### Amplification Patterns
- *[Unusual spread patterns if detected]*

---

## Analytical Gaps

- *[Patterns needing more data]*
- *[Ambiguous correlations]*
- *[Monitoring blind spots]*

---

*Pattern analysis by ARTEMIS. Correlations require validation.*`,
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
