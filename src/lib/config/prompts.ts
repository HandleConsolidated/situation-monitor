/**
 * AI Analysis Prompts Configuration
 * Comprehensive collection of prompts for different analysis use cases
 */

import type { ContextCategory } from '$lib/types/llm';

/**
 * Analysis prompt definition
 */
export interface AnalysisPromptConfig {
	id: string;
	name: string;
	description: string;
	category: 'briefing' | 'threat' | 'market' | 'pattern' | 'regional' | 'custom';
	icon: string;
	prompt: string;
	focusCategories: ContextCategory[];
	suggestedDepth: 'brief' | 'standard' | 'detailed';
	autoTrigger?: boolean; // Can be used for auto-analysis
}

/**
 * Daily briefing prompts
 */
export const BRIEFING_PROMPTS: AnalysisPromptConfig[] = [
	{
		id: 'daily-briefing',
		name: 'Daily Intelligence Briefing',
		description: 'Comprehensive morning overview of global situation',
		category: 'briefing',
		icon: '📋',
		prompt: `Generate a professional daily intelligence briefing covering:

## EXECUTIVE SUMMARY
- 2-3 sentence overview of the current global situation
- Overall threat/risk assessment level

## KEY DEVELOPMENTS (Top 5)
For each development:
- What happened
- Why it matters
- Potential implications

## THREAT INDICATORS
- Active hotspots and their status
- Escalation risks
- Infrastructure concerns

## MARKET SENTIMENT
- Overall market direction
- Key movers and catalysts
- Correlation with geopolitical events

## WATCH LIST
- 3-5 items requiring close monitoring in the next 24 hours
- Recommended actions or areas of focus

Format professionally with clear section headers.`,
		focusCategories: ['geopolitical', 'news', 'markets', 'analysis'],
		suggestedDepth: 'standard'
	},
	{
		id: 'evening-summary',
		name: 'Evening Summary',
		description: 'End-of-day recap of significant events',
		category: 'briefing',
		icon: '🌙',
		prompt: `Provide an evening summary of today's intelligence:

## TODAY'S HIGHLIGHTS
- Most significant developments
- Unexpected events or surprises

## OVERNIGHT WATCH
- Situations to monitor during off-hours
- Time-zone relevant developments (Asia/Europe markets, etc.)

## TOMORROW'S OUTLOOK
- Scheduled events or announcements
- Potential market movers
- Ongoing situations likely to develop

Keep it concise and actionable.`,
		focusCategories: ['news', 'markets', 'geopolitical'],
		suggestedDepth: 'brief'
	},
	{
		id: 'flash-update',
		name: 'Flash Update',
		description: 'Quick summary of recent alerts only',
		category: 'briefing',
		icon: '⚡',
		prompt: `Provide a rapid flash update on recent alert-level news:

Focus ONLY on items flagged as alerts. For each:
- What: Brief description
- Impact: Immediate implications
- Action: Recommended response

No background or context needed - assume reader is already informed.
Keep response under 200 words.`,
		focusCategories: ['news', 'geopolitical'],
		suggestedDepth: 'brief',
		autoTrigger: true
	}
];

/**
 * Threat assessment prompts
 */
export const THREAT_PROMPTS: AnalysisPromptConfig[] = [
	{
		id: 'threat-assessment',
		name: 'Full Threat Assessment',
		description: 'Comprehensive security threat analysis',
		category: 'threat',
		icon: '🎯',
		prompt: `Conduct a comprehensive threat assessment:

## THREAT MATRIX
Rate each category LOW / ELEVATED / HIGH / CRITICAL:
- Military/Conflict
- Cyber/Infrastructure
- Economic/Financial
- Political/Social
- Environmental/Natural

## ACTIVE THREAT INDICATORS
For each critical/high hotspot:
- Current status
- Recent developments
- Escalation potential
- Key actors involved

## INFRASTRUCTURE VULNERABILITIES
- Grid stress analysis
- Internet/communications status
- Critical infrastructure concerns

## RISK CORRELATIONS
- Connections between disparate threat indicators
- Potential cascade effects
- Second-order implications

## RECOMMENDED POSTURE
- Overall alert level recommendation
- Specific defensive measures
- Monitoring priorities

Be specific and cite data points from the intelligence context.`,
		focusCategories: ['geopolitical', 'news', 'infrastructure', 'environmental'],
		suggestedDepth: 'detailed'
	},
	{
		id: 'escalation-watch',
		name: 'Escalation Watch',
		description: 'Focus on conflict escalation potential',
		category: 'threat',
		icon: '🔺',
		prompt: `Analyze escalation potential for active conflicts:

For each conflict zone/hotspot at elevated or higher:

## ESCALATION INDICATORS
- Recent military movements or rhetoric
- Diplomatic failures or successes
- Economic pressure changes
- Alliance/support shifts

## ESCALATION PROBABILITY
- 24-hour: [LOW/MEDIUM/HIGH]
- 7-day: [LOW/MEDIUM/HIGH]
- Key triggers to watch

## DE-ESCALATION FACTORS
- Ongoing negotiations
- External pressure points
- Economic incentives

Focus on actionable intelligence about escalation timing and triggers.`,
		focusCategories: ['geopolitical', 'news'],
		suggestedDepth: 'standard',
		autoTrigger: true
	},
	{
		id: 'cyber-threat',
		name: 'Cyber Threat Analysis',
		description: 'Digital infrastructure and cyber security focus',
		category: 'threat',
		icon: '🔐',
		prompt: `Analyze cyber and digital infrastructure threats:

## CURRENT CYBER INDICATORS
- Internet outages and their patterns
- Grid stress correlation with geopolitical events
- Known attack vectors in active use

## INFRASTRUCTURE STATUS
- Power grid stress levels by region
- Communications integrity
- Financial system stability

## THREAT ACTOR ACTIVITY
- State-sponsored indicators
- Ransomware trends
- Critical infrastructure targeting

## DEFENSIVE PRIORITIES
- Most vulnerable sectors
- Recommended mitigations
- Monitoring focus areas`,
		focusCategories: ['infrastructure', 'news', 'geopolitical'],
		suggestedDepth: 'standard'
	}
];

/**
 * Market analysis prompts
 */
export const MARKET_PROMPTS: AnalysisPromptConfig[] = [
	{
		id: 'market-intelligence',
		name: 'Market Intelligence',
		description: 'Financial markets comprehensive analysis',
		category: 'market',
		icon: '📈',
		prompt: `Provide comprehensive market intelligence:

## MARKET OVERVIEW
- Overall sentiment: [BULLISH/BEARISH/MIXED/NEUTRAL]
- Key indices performance
- Volume and volatility indicators (VIX)

## SECTOR ANALYSIS
- Best performing sectors
- Worst performing sectors
- Rotation signals

## COMMODITY SIGNALS
- Energy prices and implications
- Precious metals (safe haven indicator)
- Agricultural/soft commodities

## CRYPTOCURRENCY
- Major crypto movements
- Whale activity analysis
- DeFi/institutional signals

## GEOPOLITICAL-MARKET CORRELATION
- How current events are affecting markets
- Risk-off vs risk-on sentiment
- Flight to safety indicators

## ACTIONABLE INSIGHTS
- Key levels to watch
- Event catalysts upcoming
- Risk/reward assessment`,
		focusCategories: ['markets', 'crypto', 'news', 'alternative'],
		suggestedDepth: 'detailed'
	},
	{
		id: 'whale-alert',
		name: 'Whale Movement Analysis',
		description: 'Large cryptocurrency transaction analysis',
		category: 'market',
		icon: '🐋',
		prompt: `Analyze recent whale cryptocurrency movements:

## WHALE ACTIVITY SUMMARY
- Total volume moved
- Dominant direction (accumulation vs distribution)
- Key wallets active

## PATTERN ANALYSIS
- Is this consistent with historical patterns?
- Correlation with price action
- Exchange flows (in vs out)

## MARKET IMPLICATIONS
- Short-term price impact expectation
- Institutional sentiment signal
- Correlation with traditional markets

## ALERTS
- Any unusual patterns requiring attention
- Potential market manipulation signals`,
		focusCategories: ['crypto', 'markets'],
		suggestedDepth: 'brief',
		autoTrigger: true
	},
	{
		id: 'prediction-markets',
		name: 'Prediction Markets Analysis',
		description: 'Polymarket and prediction market insights',
		category: 'market',
		icon: '🔮',
		prompt: `Analyze prediction market data:

## HIGH-CONFIDENCE PREDICTIONS
- Markets with >80% probability
- Recent significant shifts

## CONTRARIAN SIGNALS
- Where markets may be mispriced
- Low-probability events worth monitoring

## POLITICAL/GEOPOLITICAL PREDICTIONS
- Election/policy related markets
- Conflict outcome predictions
- Economic predictions

## VOLUME ANALYSIS
- Where is money flowing?
- Smart money vs retail patterns

Compare prediction market signals with actual news/intelligence.`,
		focusCategories: ['alternative', 'news', 'geopolitical'],
		suggestedDepth: 'standard'
	}
];

/**
 * Pattern analysis prompts
 */
export const PATTERN_PROMPTS: AnalysisPromptConfig[] = [
	{
		id: 'correlation-analysis',
		name: 'Correlation Deep Dive',
		description: 'Analyze detected patterns and correlations',
		category: 'pattern',
		icon: '🔗',
		prompt: `Examine detected correlations and patterns:

## VALIDATED CORRELATIONS
For each detected correlation:
- Is this correlation meaningful or spurious?
- Historical precedent
- Causal vs coincidental

## NARRATIVE ANALYSIS
- Which narratives are emerging vs fading?
- Source diversity (echo chamber vs organic spread)
- Coordinated campaign indicators

## MAIN CHARACTER ANALYSIS
- Who is dominating the news cycle?
- Sentiment trends for key figures
- Action/reaction patterns

## HIDDEN CONNECTIONS
- What patterns might be missed?
- Cross-domain correlations (markets ↔ politics ↔ tech)
- Timing patterns

## MISINFORMATION RISK
- Potential coordinated narratives
- Verification recommendations
- Source credibility assessment`,
		focusCategories: ['analysis', 'news', 'monitors'],
		suggestedDepth: 'detailed'
	},
	{
		id: 'narrative-tracker',
		name: 'Narrative Evolution',
		description: 'Track how stories develop and spread',
		category: 'pattern',
		icon: '📊',
		prompt: `Track narrative evolution across sources:

## EMERGING NARRATIVES
- New stories gaining traction
- Origin and spread pattern
- Key amplifiers

## ESTABLISHED NARRATIVES
- Dominant stories this cycle
- How they've evolved
- Potential fatigue/saturation

## FADING NARRATIVES
- Stories losing attention
- Why (resolved? displaced? suppressed?)
- Potential for resurgence

## PREDICTION
- Which emerging narratives will dominate next?
- Timeline expectations
- Impact assessment`,
		focusCategories: ['analysis', 'news'],
		suggestedDepth: 'standard'
	}
];

/**
 * Regional focus prompts
 */
export const REGIONAL_PROMPTS: AnalysisPromptConfig[] = [
	{
		id: 'europe-focus',
		name: 'Europe Situation',
		description: 'European and NATO region focus',
		category: 'regional',
		icon: '🇪🇺',
		prompt: `Provide a Europe-focused intelligence summary:

Focus on: NATO, EU, UK, Ukraine, Russia, Eastern Europe

## CONFLICT STATUS
- Ukraine war developments
- NATO posture changes
- Russian actions and rhetoric

## POLITICAL DEVELOPMENTS
- EU policy changes
- Election implications
- Alliance dynamics

## ECONOMIC INDICATORS
- Euro performance
- Energy security
- Trade impacts

## REGIONAL THREATS
- Migration pressures
- Cyber activity
- Hybrid warfare indicators`,
		focusCategories: ['geopolitical', 'news', 'markets'],
		suggestedDepth: 'standard'
	},
	{
		id: 'asia-pacific-focus',
		name: 'Asia-Pacific Situation',
		description: 'Indo-Pacific and East Asia focus',
		category: 'regional',
		icon: '🌏',
		prompt: `Provide an Asia-Pacific focused intelligence summary:

Focus on: China, Taiwan, Japan, Korea, ASEAN, India, Australia

## TAIWAN STRAIT
- Military activity
- Political developments
- Escalation indicators

## NORTH KOREA
- Missile/nuclear activity
- Diplomatic signals
- Regime stability

## CHINA
- Economic indicators
- Military posture
- International relations

## REGIONAL DYNAMICS
- Alliance activities (QUAD, AUKUS)
- Trade tensions
- Territorial disputes`,
		focusCategories: ['geopolitical', 'news', 'markets'],
		suggestedDepth: 'standard'
	},
	{
		id: 'middle-east-focus',
		name: 'Middle East Situation',
		description: 'MENA region focus',
		category: 'regional',
		icon: '🏜️',
		prompt: `Provide a Middle East focused intelligence summary:

Focus on: Israel, Iran, Saudi Arabia, Gulf States, Syria, Iraq, Yemen

## ISRAEL-IRAN AXIS
- Direct confrontation risk
- Proxy activities
- Nuclear program status

## GULF DYNAMICS
- Oil production/pricing
- Regional realignment
- Economic diversification

## CONFLICT ZONES
- Gaza/Palestinian situation
- Yemen conflict
- Syria stability

## ENERGY IMPLICATIONS
- Oil supply risks
- Shipping/chokepoints
- Price impact potential`,
		focusCategories: ['geopolitical', 'news', 'markets'],
		suggestedDepth: 'standard'
	}
];

/**
 * All prompts combined
 */
export const ALL_ANALYSIS_PROMPTS: AnalysisPromptConfig[] = [
	...BRIEFING_PROMPTS,
	...THREAT_PROMPTS,
	...MARKET_PROMPTS,
	...PATTERN_PROMPTS,
	...REGIONAL_PROMPTS
];

/**
 * Get prompts by category
 */
export function getPromptsByCategory(category: AnalysisPromptConfig['category']): AnalysisPromptConfig[] {
	return ALL_ANALYSIS_PROMPTS.filter(p => p.category === category);
}

/**
 * Get prompts that can auto-trigger
 */
export function getAutoTriggerPrompts(): AnalysisPromptConfig[] {
	return ALL_ANALYSIS_PROMPTS.filter(p => p.autoTrigger);
}

/**
 * Get prompt by ID
 */
export function getPromptById(id: string): AnalysisPromptConfig | undefined {
	return ALL_ANALYSIS_PROMPTS.find(p => p.id === id);
}

/**
 * Prompt categories for UI
 */
export const PROMPT_CATEGORIES = [
	{ id: 'briefing', name: 'Briefings', icon: '📋', description: 'Regular intelligence updates' },
	{ id: 'threat', name: 'Threat Analysis', icon: '🎯', description: 'Security and risk assessment' },
	{ id: 'market', name: 'Markets', icon: '📈', description: 'Financial intelligence' },
	{ id: 'pattern', name: 'Patterns', icon: '🔗', description: 'Correlation and narrative analysis' },
	{ id: 'regional', name: 'Regional', icon: '🌍', description: 'Geographic focus areas' }
] as const;
