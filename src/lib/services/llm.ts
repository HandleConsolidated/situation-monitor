/**
 * LLM Service
 * Handles communication with LLM providers (Anthropic Claude, OpenAI)
 */

import { browser } from '$app/environment';
import type {
	LLMProvider,
	LLMRequest,
	LLMResponse,
	LLMServiceStatus,
	IntelligenceContext,
	AnalysisDepth
} from '$lib/types/llm';
import type { NewsItem } from '$lib/types';
import type { AnthropicTool, ToolCall } from './ai-actions';
import { getToolsSystemPrompt } from './ai-actions';

// Storage key for API keys
const API_KEY_STORAGE_PREFIX = 'llm_api_key_';

// Default models per provider
const DEFAULT_MODELS: Record<LLMProvider, string> = {
	anthropic: 'claude-sonnet-4-5',
	openai: 'gpt-4.1-2025-04-14',
	custom: ''
};

// Available models per provider
export const AVAILABLE_MODELS: Record<Exclude<LLMProvider, 'custom'>, Array<{ id: string; name: string }>> = {
	anthropic: [
		{ id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
		{ id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
		{ id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' }
	],
	openai: [
		{ id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1' },
		{ id: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini' },
		{ id: 'gpt-4o', name: 'GPT-4o' },
		{ id: 'o3-mini', name: 'o3-mini (Reasoning)' }
	]
};

// API endpoints
const API_ENDPOINTS: Record<Exclude<LLMProvider, 'custom'>, string> = {
	anthropic: 'https://api.anthropic.com/v1/messages',
	openai: 'https://api.openai.com/v1/chat/completions'
};

// Token limits per depth
const TOKEN_LIMITS: Record<AnalysisDepth, number> = {
	brief: 500,
	standard: 1500,
	detailed: 4000
};

/**
 * Markdown formatting instructions to ensure consistent output for modal and PDF display
 */
const MARKDOWN_FORMAT_INSTRUCTIONS = `

**MARKDOWN FORMATTING REQUIREMENTS:**
Your response will be displayed in both a web modal AND exported to professional PDF. Use proper Markdown for beautiful, readable output.

1. STRUCTURE & SPACING (CRITICAL):
   - Use ## for major sections (Executive Summary, Threat Assessment, etc.)
   - Use ### for subsections within major sections
   - Use --- on its own line between major sections
   - ALWAYS add blank lines before AND after every header
   - ALWAYS add blank lines between paragraphs
   - Keep paragraphs to 2-4 sentences maximum - never create walls of text

2. BOLD TEXT (**bold**) - Use strategically:
   - ALWAYS bold threat levels: **CRITICAL**, **HIGH**, **ELEVATED**, **LOW**
   - ALWAYS bold status indicators: **ACTIVE**, **RESOLVED**, **ONGOING**, **STABLE**, **VOLATILE**
   - Bold key findings: **Key Finding:**, **Assessment:**, **Conclusion:**
   - Bold important numbers: **$4.2 billion**, **+15%**, **72 hours**
   - Bold alert categories: **WARNING**, **URGENT**, **CRITICAL ALERT**
   - Bold probability statements: **Probability: 45%**, **Confidence: HIGH**
   - DO NOT over-bold: max 2-3 bold terms per paragraph

3. INLINE CODE (\`code\`):
   - Use for percentages: \`45%\`, \`+12.5%\`
   - Use for specific values: \`$125.50\`, \`DEFCON 3\`, \`UTC 14:30\`
   - Use for references: \`REF-2026-0119\`

4. LISTS:
   - Use - for bullet points, 1. 2. 3. for numbered lists
   - Add blank line before starting a list
   - Keep list items concise (1-2 lines each)

5. TABLES:
   - Format: | Column | Header | and |---|---| separator
   - Add blank lines before and after tables
   - Bold important values in cells
   - Limit to 4-5 columns

6. BLOCKQUOTES (use for critical callouts):
   - Use > for important warnings or key intelligence
   - Include bold label: > **CRITICAL:** or > **KEY INTELLIGENCE:**
   - Reserve for genuinely important callouts - don't overuse

7. AVOID:
   - Running sections together without blank lines
   - Walls of text without paragraph breaks
   - XML-style tags (use markdown headers instead)
   - Excessive bolding or under-bolding`;

/**
 * System prompts for intelligence analysis
 */
const SYSTEM_PROMPTS = {
	default: `You are an intelligence analyst assistant for Aegis Situation Monitor, a real-time global intelligence dashboard. Your role is to analyze data from multiple sources including:

- News feeds across politics, technology, finance, government, AI, and intelligence domains
- Market data including indices, sectors, commodities, and cryptocurrency
- Geopolitical hotspots and conflict zones
- Infrastructure monitoring (grid stress, outages)
- Pattern analysis (correlations, narratives, main character detection)
- Environmental events (earthquakes, radiation, disease outbreaks)
- Alternative data (prediction markets, government contracts, layoffs)

Provide concise, actionable intelligence analysis. Focus on:
1. Identifying significant developments and emerging patterns
2. Assessing threats and risk levels
3. Noting correlations between disparate data points
4. Highlighting items requiring attention
${MARKDOWN_FORMAT_INSTRUCTIONS}

**CITATION REQUIREMENTS:**
- When referencing specific news articles, include the source name and article link in markdown format: [Article Title](url)
- Cite the data source (e.g., "per CoinGecko data", "according to BBC World News", "USGS reports")
- At the end of your analysis, include a "Sources" section listing the key sources you referenced

Use professional intelligence briefing style. Be direct and avoid unnecessary caveats.`,

	brief: `You are an intelligence analyst. Provide brief, bullet-point analysis. Focus only on the most critical items. Keep responses under 300 words.
${MARKDOWN_FORMAT_INSTRUCTIONS}

**CITATION REQUIREMENTS:**
- Include source attribution for key claims (e.g., "via Reuters", "per CoinGecko")
- When available, include markdown links to referenced articles`,

	detailed: `You are a senior intelligence analyst for Aegis Situation Monitor. Provide comprehensive analysis with:
- Executive summary
- Detailed assessment per domain
- Cross-domain correlations
- Risk indicators with severity ratings
- Recommended watch items and potential scenarios
- Confidence levels for key assessments

Support conclusions with specific data points from the provided context.
${MARKDOWN_FORMAT_INSTRUCTIONS}

**CITATION REQUIREMENTS:**
- When referencing news articles, use markdown links: [Article Title](url)
- Cite data sources explicitly (e.g., "CoinGecko API data shows...", "According to USGS earthquake data...")
- Include a "Sources & References" section at the end with:
  1. Links to specific articles referenced
  2. Data APIs/sources used (CoinGecko, Yahoo Finance, USGS, etc.)
  3. Intelligence feeds cited (CSIS, Brookings, Bellingcat, etc.)
- Use numbered citations [1], [2], etc. when referencing multiple sources`
};

/**
 * Store API key securely in localStorage
 */
export function storeApiKey(provider: LLMProvider, apiKey: string): void {
	if (!browser) return;

	try {
		// Basic obfuscation (not true encryption, but better than plaintext)
		const encoded = btoa(apiKey);
		localStorage.setItem(`${API_KEY_STORAGE_PREFIX}${provider}`, encoded);
	} catch (e) {
		console.error('Failed to store API key:', e);
	}
}

/**
 * Retrieve stored API key
 */
export function getStoredApiKey(provider: LLMProvider): string | null {
	if (!browser) return null;

	try {
		const encoded = localStorage.getItem(`${API_KEY_STORAGE_PREFIX}${provider}`);
		if (encoded) {
			return atob(encoded);
		}
	} catch (e) {
		console.error('Failed to retrieve API key:', e);
	}
	return null;
}

/**
 * Remove stored API key
 */
export function removeApiKey(provider: LLMProvider): void {
	if (!browser) return;
	localStorage.removeItem(`${API_KEY_STORAGE_PREFIX}${provider}`);
}

/**
 * Check if API key is configured for a provider
 */
export function hasApiKey(provider: LLMProvider): boolean {
	return !!getStoredApiKey(provider);
}

/**
 * Data sources documentation for citation
 */
const DATA_SOURCES = {
	news: {
		name: 'RSS News Feeds',
		description: 'Real-time news from major outlets',
		feeds: [
			'BBC World News',
			'NPR News',
			'The Guardian',
			'New York Times',
			'Reuters',
			'Hacker News',
			'Ars Technica',
			'The Verge',
			'MIT Technology Review',
			'CNBC',
			'MarketWatch',
			'Financial Times',
			'White House',
			'Federal Reserve',
			'SEC',
			'Department of Defense'
		]
	},
	markets: {
		name: 'Financial Market APIs',
		description: 'Real-time market data',
		sources: ['Yahoo Finance API', 'Alpha Vantage API']
	},
	crypto: {
		name: 'CoinGecko API',
		description: 'Cryptocurrency prices and market data',
		url: 'https://www.coingecko.com'
	},
	intel: {
		name: 'Intelligence Sources',
		description: 'Analysis from think tanks and defense sources',
		sources: [
			'CSIS (Center for Strategic & International Studies)',
			'Brookings Institution',
			'Council on Foreign Relations (CFR)',
			'Defense One',
			'War on the Rocks',
			'Breaking Defense',
			'The Diplomat',
			'Al-Monitor',
			'Bellingcat (OSINT)',
			'CISA Alerts',
			'Krebs on Security'
		]
	},
	geopolitical: {
		name: 'Geopolitical Configuration',
		description: 'Curated hotspot and infrastructure data'
	},
	environmental: {
		name: 'Environmental APIs',
		sources: ['USGS Earthquake API', 'Safecast Radiation Network', 'ProMED Disease Surveillance']
	},
	infrastructure: {
		name: 'Infrastructure Monitoring',
		sources: ['IODA (Internet Outage Detection)', 'OONI (Network Interference)', 'Internet Society Pulse']
	},
	alternative: {
		name: 'Alternative Data Sources',
		sources: ['Polymarket Prediction Markets', 'USASpending.gov (Government Contracts)', 'Layoffs.fyi']
	}
};

/**
 * Format context for LLM consumption
 */
export function formatContextForLLM(
	context: IntelligenceContext,
	maxLength: number = 50000
): string {
	let formatted = `# Intelligence Context\n`;
	formatted += `Generated: ${context.timestamp}\n`;
	formatted += `Categories: ${context.metadata.enabledCategories.join(', ')}\n\n`;

	// Track referenced sources for citation section
	const referencedSources: Set<string> = new Set();
	const articleLinks: Array<{ title: string; url: string; source: string; category: string }> = [];

	// Add each section
	if (context.geopolitical) {
		formatted += `## Geopolitical Situation\n`;
		referencedSources.add('geopolitical');
		const critical = context.geopolitical.hotspots.filter(
			(h) => h.level === 'critical' || h.level === 'high'
		);
		if (critical.length > 0) {
			formatted += `### Critical/High Threat Hotspots\n`;
			critical.forEach((h) => {
				formatted += `- **${h.name}** [${h.level.toUpperCase()}]: ${h.description || h.location}\n`;
			});
		}
		if (context.geopolitical.conflictZones.length > 0) {
			formatted += `### Active Conflict Zones: ${context.geopolitical.conflictZones.join(', ')}\n`;
		}
		formatted += '\n';
	}

	if (context.news) {
		referencedSources.add('news');
		formatted += `## News Intelligence (${context.news.totalCount} items, ${context.news.alertCount} alerts)\n`;

		if (context.news.alerts.length > 0) {
			formatted += `### Alert Headlines\n`;
			context.news.alerts.slice(0, 10).forEach((item) => {
				const linkText = item.link ? ` [Link](${item.link})` : '';
				formatted += `- [${item.category.toUpperCase()}] ${item.title} (${item.alertKeyword || 'alert'})${linkText}\n`;
				if (item.link) {
					articleLinks.push({ title: item.title, url: item.link, source: item.source, category: item.category });
				}
			});
			formatted += '\n';
		}

		// Top items per category with links
		for (const [category, items] of Object.entries(context.news.byCategory) as [string, NewsItem[]][]) {
			if (items.length > 0) {
				formatted += `### ${category.charAt(0).toUpperCase() + category.slice(1)} (${items.length} items)\n`;
				items.slice(0, 5).forEach((item) => {
					const linkText = item.link ? ` [Link](${item.link})` : '';
					formatted += `- ${item.title} (${item.source})${linkText}\n`;
					if (item.link) {
						articleLinks.push({ title: item.title, url: item.link, source: item.source, category });
					}
				});
				formatted += '\n';
			}
		}
	}

	if (context.markets) {
		referencedSources.add('markets');
		formatted += `## Market Intelligence\n`;
		formatted += `**Overall Trend:** ${context.markets.trend.toUpperCase()}\n`;
		if (context.markets.vix) {
			formatted += `**VIX:** ${context.markets.vix.toFixed(2)}\n`;
		}
		if (context.markets.topGainer) {
			formatted += `**Top Gainer:** ${context.markets.topGainer.symbol} (+${context.markets.topGainer.change.toFixed(2)}%)\n`;
		}
		if (context.markets.topLoser) {
			formatted += `**Top Loser:** ${context.markets.topLoser.symbol} (${context.markets.topLoser.change.toFixed(2)}%)\n`;
		}

		if (context.markets.indices.length > 0) {
			formatted += `### Indices\n`;
			context.markets.indices.forEach((idx) => {
				const sign = idx.changePercent >= 0 ? '+' : '';
				formatted += `- ${idx.symbol}: $${idx.price.toFixed(2)} (${sign}${idx.changePercent.toFixed(2)}%)\n`;
			});
		}
		formatted += '\n';
	}

	if (context.crypto) {
		referencedSources.add('crypto');
		formatted += `## Cryptocurrency\n`;
		formatted += `**Whale Activity:** ${context.crypto.dominantDirection} ($${(context.crypto.totalWhaleVolume / 1000000).toFixed(1)}M volume)\n`;
		if (context.crypto.prices.length > 0) {
			formatted += `### Top Cryptos\n`;
			context.crypto.prices.slice(0, 5).forEach((c) => {
				const sign = c.price_change_percentage_24h >= 0 ? '+' : '';
				formatted += `- ${c.symbol.toUpperCase()}: $${c.current_price.toLocaleString()} (${sign}${c.price_change_percentage_24h.toFixed(2)}%)\n`;
			});
		}
		formatted += '\n';
	}

	if (context.analysis) {
		formatted += `## Pattern Analysis\n`;

		if (context.analysis.correlations.length > 0) {
			formatted += `### Correlations Detected\n`;
			context.analysis.correlations.forEach((c) => {
				formatted += `- **${c.topic}**: ${c.count} mentions, momentum ${c.momentum}\n`;
			});
		}

		if (context.analysis.narratives.length > 0) {
			formatted += `### Narrative Tracking\n`;
			context.analysis.narratives.forEach((n) => {
				formatted += `- **${n.narrative}**: ${n.trend} (${n.mentions} mentions)\n`;
			});
		}

		if (context.analysis.mainCharacters.length > 0) {
			formatted += `### Main Characters (Entity Prominence)\n`;
			context.analysis.mainCharacters.slice(0, 5).forEach((mc) => {
				formatted += `- ${mc.name}: ${mc.mentions} mentions, sentiment ${mc.sentiment}\n`;
			});
		}
		formatted += '\n';
	}

	if (context.monitors && context.monitors.totalMatches > 0) {
		formatted += `## Monitor Alerts (${context.monitors.totalMatches} matches)\n`;
		context.monitors.activeMonitors
			.filter((m) => m.matchCount > 0)
			.forEach((m) => {
				formatted += `- **${m.name}**: ${m.matchCount} matches (keywords: ${m.keywords.slice(0, 3).join(', ')})\n`;
			});
		formatted += '\n';
	}

	if (context.environmental) {
		referencedSources.add('environmental');
		if (context.environmental.significantEvents.length > 0) {
			formatted += `## Environmental Events\n`;
			context.environmental.significantEvents.forEach((e) => {
				formatted += `- ${e}\n`;
			});
			formatted += '\n';
		}
	}

	if (context.alternative) {
		referencedSources.add('alternative');
		if (context.alternative.predictions.length > 0) {
			formatted += `## Prediction Markets\n`;
			context.alternative.predictions.slice(0, 5).forEach((p) => {
				formatted += `- ${p.question}: ${Math.round(p.yes * 100)}% (vol: $${p.volume})\n`;
			});
			formatted += '\n';
		}
	}

	// Add Data Sources section
	formatted += `\n---\n\n## Data Sources & APIs Used\n`;
	formatted += `*When citing information in your analysis, reference these sources:*\n\n`;

	if (referencedSources.has('news')) {
		formatted += `### News & Intelligence Feeds\n`;
		formatted += `- **RSS Feeds**: ${DATA_SOURCES.news.feeds.slice(0, 8).join(', ')}, and more\n`;
		formatted += `- **Intelligence Sources**: ${DATA_SOURCES.intel.sources.slice(0, 5).join(', ')}\n\n`;
	}

	if (referencedSources.has('markets')) {
		formatted += `### Market Data\n`;
		formatted += `- **APIs**: ${DATA_SOURCES.markets.sources.join(', ')}\n\n`;
	}

	if (referencedSources.has('crypto')) {
		formatted += `### Cryptocurrency Data\n`;
		formatted += `- **API**: CoinGecko (${DATA_SOURCES.crypto.url})\n\n`;
	}

	if (referencedSources.has('environmental')) {
		formatted += `### Environmental Monitoring\n`;
		formatted += `- **Sources**: ${DATA_SOURCES.environmental.sources.join(', ')}\n\n`;
	}

	if (referencedSources.has('alternative')) {
		formatted += `### Alternative Data\n`;
		formatted += `- **Sources**: ${DATA_SOURCES.alternative.sources.join(', ')}\n\n`;
	}

	if (referencedSources.has('geopolitical')) {
		formatted += `### Geopolitical Data\n`;
		formatted += `- **Source**: Curated geopolitical hotspot database\n\n`;
	}

	// Add article links section if we have any
	if (articleLinks.length > 0) {
		formatted += `### Referenced Article Links\n`;
		formatted += `*Include these links when referencing specific articles:*\n`;
		articleLinks.slice(0, 15).forEach((article, i) => {
			formatted += `${i + 1}. [${article.title}](${article.url}) - ${article.source}\n`;
		});
		formatted += '\n';
	}

	formatted += `\n**IMPORTANT**: When providing analysis, cite specific sources by name and include article links where relevant. The reader should be able to verify claims by following the source references.\n`;

	// Truncate if too long
	if (formatted.length > maxLength) {
		formatted = formatted.substring(0, maxLength) + '\n\n[Context truncated due to length]';
	}

	return formatted;
}

/**
 * Get system prompt based on analysis depth
 */
function getSystemPrompt(depth: AnalysisDepth, customPrompt?: string): string {
	if (customPrompt) {
		return customPrompt;
	}

	switch (depth) {
		case 'brief':
			return SYSTEM_PROMPTS.brief;
		case 'detailed':
			return SYSTEM_PROMPTS.detailed;
		default:
			return SYSTEM_PROMPTS.default;
	}
}

/**
 * Sanitize API error messages to prevent system prompt leakage
 */
function sanitizeApiError(error: Record<string, unknown>, status: number, provider: string): string {
	const rawMessage = (error.error as Record<string, unknown>)?.message as string || '';

	// Provide user-friendly error messages for common HTTP status codes
	switch (status) {
		case 400:
			return `Invalid request. Please check your input and try again.`;
		case 401:
			return `Invalid API key. Please check your ${provider} API key in settings.`;
		case 403:
			return `Access denied. Your API key may not have permission for this model.`;
		case 404:
			return `API endpoint or model not found. Please verify your model selection is valid.`;
		case 429:
			return `Rate limited. Please wait a moment and try again.`;
		case 500:
		case 502:
		case 503:
			return `${provider} API is temporarily unavailable. Please try again later.`;
		default:
			// Sanitize the error message - truncate and remove potential sensitive content
			if (rawMessage) {
				// Remove any content that looks like it might contain system prompts
				const sanitized = rawMessage
					.replace(/system[:\s]*["']?[^"'\n]{50,}/gi, '[content removed]')
					.replace(/prompt[:\s]*["']?[^"'\n]{50,}/gi, '[content removed]');
				return sanitized.length > 150
					? sanitized.substring(0, 150) + '...'
					: sanitized;
			}
			return `${provider} API error: ${status}`;
	}
}

/**
 * Call Anthropic Claude API
 */
async function callAnthropic(
	request: LLMRequest,
	apiKey: string,
	model?: string
): Promise<LLMResponse> {
	const response = await fetch(API_ENDPOINTS.anthropic, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify({
			model: model || DEFAULT_MODELS.anthropic,
			max_tokens: request.maxTokens || 2048,
			system: request.systemPrompt || SYSTEM_PROMPTS.default,
			messages: request.messages.map((m) => ({
				role: m.role === 'system' ? 'user' : m.role,
				content: m.content
			}))
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(sanitizeApiError(error, response.status, 'Anthropic'));
	}

	const data = await response.json();

	return {
		content: data.content[0]?.text || '',
		model: data.model,
		tokenUsage: {
			input: data.usage?.input_tokens || 0,
			output: data.usage?.output_tokens || 0,
			total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
		},
		finishReason: data.stop_reason
	};
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
	request: LLMRequest,
	apiKey: string,
	model?: string
): Promise<LLMResponse> {
	const messages: Array<{ role: string; content: string }> = [];

	// Add system prompt if provided
	if (request.systemPrompt) {
		messages.push({ role: 'system', content: request.systemPrompt });
	}

	// Add conversation messages
	messages.push(
		...request.messages.map((m) => ({
			role: m.role,
			content: m.content
		}))
	);

	const response = await fetch(API_ENDPOINTS.openai, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: model || DEFAULT_MODELS.openai,
			max_tokens: request.maxTokens || 2048,
			temperature: request.temperature || 0.7,
			messages
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(sanitizeApiError(error, response.status, 'OpenAI'));
	}

	const data = await response.json();

	return {
		content: data.choices[0]?.message?.content || '',
		model: data.model,
		tokenUsage: {
			input: data.usage?.prompt_tokens || 0,
			output: data.usage?.completion_tokens || 0,
			total: data.usage?.total_tokens || 0
		},
		finishReason: data.choices[0]?.finish_reason
	};
}

/**
 * Call custom endpoint
 */
async function callCustom(
	request: LLMRequest,
	apiKey: string,
	endpoint: string,
	model?: string
): Promise<LLMResponse> {
	// Custom endpoint should be OpenAI-compatible
	const messages: Array<{ role: string; content: string }> = [];

	if (request.systemPrompt) {
		messages.push({ role: 'system', content: request.systemPrompt });
	}

	messages.push(
		...request.messages.map((m) => ({
			role: m.role,
			content: m.content
		}))
	);

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: model || 'default',
			max_tokens: request.maxTokens || 2048,
			temperature: request.temperature || 0.7,
			messages
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(sanitizeApiError(error, response.status, 'Custom'));
	}

	const data = await response.json();

	return {
		content: data.choices?.[0]?.message?.content || data.content || '',
		model: data.model || model || 'custom',
		tokenUsage: data.usage
			? {
					input: data.usage.prompt_tokens || 0,
					output: data.usage.completion_tokens || 0,
					total: data.usage.total_tokens || 0
				}
			: undefined,
		finishReason: data.choices?.[0]?.finish_reason || data.stop_reason
	};
}

/**
 * Main function to send a request to the LLM
 */
export async function sendLLMRequest(
	provider: LLMProvider,
	request: LLMRequest,
	options: {
		apiKey?: string;
		customEndpoint?: string;
		model?: string;
	} = {}
): Promise<LLMResponse> {
	// Get API key from options or storage
	const apiKey = options.apiKey || getStoredApiKey(provider);

	if (!apiKey) {
		throw new Error(`No API key configured for ${provider}. Please add your API key in settings.`);
	}

	switch (provider) {
		case 'anthropic':
			return callAnthropic(request, apiKey, options.model);
		case 'openai':
			return callOpenAI(request, apiKey, options.model);
		case 'custom':
			if (!options.customEndpoint) {
				throw new Error('Custom endpoint URL is required for custom provider');
			}
			return callCustom(request, apiKey, options.customEndpoint, options.model);
		default:
			throw new Error(`Unknown LLM provider: ${provider}`);
	}
}

/**
 * Convenience function to analyze intelligence context
 */
export async function analyzeContext(
	context: IntelligenceContext,
	options: {
		provider: LLMProvider;
		depth?: AnalysisDepth;
		prompt?: string;
		customSystemPrompt?: string;
		model?: string;
		apiKey?: string;
		customEndpoint?: string;
	}
): Promise<LLMResponse> {
	const depth = options.depth || 'standard';
	const formattedContext = formatContextForLLM(context);

	const userPrompt = options.prompt
		? `${options.prompt}\n\n---\n\n${formattedContext}`
		: `Analyze the following intelligence context and provide a ${depth} briefing:\n\n${formattedContext}`;

	const request: LLMRequest = {
		messages: [{ role: 'user', content: userPrompt }],
		maxTokens: TOKEN_LIMITS[depth] * 2,
		systemPrompt: getSystemPrompt(depth, options.customSystemPrompt)
	};

	return sendLLMRequest(options.provider, request, {
		apiKey: options.apiKey,
		customEndpoint: options.customEndpoint,
		model: options.model
	});
}

/**
 * Get LLM service status
 */
export function getLLMServiceStatus(provider: LLMProvider): LLMServiceStatus {
	return {
		available: hasApiKey(provider),
		provider,
		model: DEFAULT_MODELS[provider]
	};
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
	return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
	return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Tool Use Support
// ============================================================================

/**
 * Response that may include tool calls
 */
export interface LLMResponseWithTools extends LLMResponse {
	toolCalls?: ToolCall[];
	stopReason?: 'end_turn' | 'tool_use' | 'max_tokens' | string;
}

/**
 * Content block types from Anthropic API
 */
interface AnthropicTextBlock {
	type: 'text';
	text: string;
}

interface AnthropicToolUseBlock {
	type: 'tool_use';
	id: string;
	name: string;
	input: Record<string, unknown>;
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

/**
 * Call Anthropic Claude API with tool support
 */
async function callAnthropicWithTools(
	request: LLMRequest,
	apiKey: string,
	tools: AnthropicTool[],
	model?: string
): Promise<LLMResponseWithTools> {
	const systemPrompt = request.systemPrompt
		? `${request.systemPrompt}\n\n${getToolsSystemPrompt()}`
		: `${SYSTEM_PROMPTS.default}\n\n${getToolsSystemPrompt()}`;

	const response = await fetch(API_ENDPOINTS.anthropic, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify({
			model: model || DEFAULT_MODELS.anthropic,
			max_tokens: request.maxTokens || 2048,
			system: systemPrompt,
			messages: request.messages.map((m) => ({
				role: m.role === 'system' ? 'user' : m.role,
				content: m.content
			})),
			tools
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(sanitizeApiError(error, response.status, 'Anthropic'));
	}

	const data = await response.json();

	// Extract text and tool calls from content blocks
	let textContent = '';
	const toolCalls: ToolCall[] = [];

	if (Array.isArray(data.content)) {
		for (const block of data.content as AnthropicContentBlock[]) {
			if (block.type === 'text') {
				textContent += block.text;
			} else if (block.type === 'tool_use') {
				toolCalls.push({
					id: block.id,
					name: block.name as ToolCall['name'],
					parameters: block.input
				});
			}
		}
	}

	return {
		content: textContent,
		model: data.model,
		tokenUsage: {
			input: data.usage?.input_tokens || 0,
			output: data.usage?.output_tokens || 0,
			total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
		},
		finishReason: data.stop_reason,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		stopReason: data.stop_reason
	};
}

/**
 * Continue conversation after tool execution
 */
export async function continueWithToolResults(
	provider: LLMProvider,
	originalMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
	assistantContentBlocks: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }>,
	toolResults: Array<{ tool_use_id: string; content: string }>,
	options: {
		apiKey?: string;
		customEndpoint?: string;
		model?: string;
		systemPrompt?: string;
		maxTokens?: number;
		tools?: AnthropicTool[];
	} = {}
): Promise<LLMResponseWithTools> {
	const apiKey = options.apiKey || getStoredApiKey(provider);
	if (!apiKey) {
		throw new Error(`No API key configured for ${provider}`);
	}

	if (provider !== 'anthropic') {
		throw new Error('Tool use is currently only supported with Anthropic');
	}

	// Build the messages array with tool results
	const messages = [
		...originalMessages.map(m => ({
			role: m.role as 'user' | 'assistant',
			content: m.content
		})),
		{
			role: 'assistant' as const,
			content: assistantContentBlocks
		},
		{
			role: 'user' as const,
			content: toolResults.map(r => ({
				type: 'tool_result' as const,
				tool_use_id: r.tool_use_id,
				content: r.content
			}))
		}
	];

	const systemPrompt = options.systemPrompt
		? `${options.systemPrompt}\n\n${getToolsSystemPrompt()}`
		: `${SYSTEM_PROMPTS.default}\n\n${getToolsSystemPrompt()}`;

	const response = await fetch(API_ENDPOINTS.anthropic, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify({
			model: options.model || DEFAULT_MODELS.anthropic,
			max_tokens: options.maxTokens || 2048,
			system: systemPrompt,
			messages,
			tools: options.tools
		})
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(sanitizeApiError(error, response.status, 'Anthropic'));
	}

	const data = await response.json();

	// Extract text and tool calls from content blocks
	let textContent = '';
	const toolCalls: ToolCall[] = [];

	if (Array.isArray(data.content)) {
		for (const block of data.content as AnthropicContentBlock[]) {
			if (block.type === 'text') {
				textContent += block.text;
			} else if (block.type === 'tool_use') {
				toolCalls.push({
					id: block.id,
					name: block.name as ToolCall['name'],
					parameters: block.input
				});
			}
		}
	}

	return {
		content: textContent,
		model: data.model,
		tokenUsage: {
			input: data.usage?.input_tokens || 0,
			output: data.usage?.output_tokens || 0,
			total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
		},
		finishReason: data.stop_reason,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		stopReason: data.stop_reason
	};
}

/**
 * Send request with tool support
 */
export async function sendLLMRequestWithTools(
	provider: LLMProvider,
	request: LLMRequest,
	tools: AnthropicTool[],
	options: {
		apiKey?: string;
		customEndpoint?: string;
		model?: string;
	} = {}
): Promise<LLMResponseWithTools> {
	const apiKey = options.apiKey || getStoredApiKey(provider);

	if (!apiKey) {
		throw new Error(`No API key configured for ${provider}. Please add your API key in settings.`);
	}

	// For now, tool use is only supported with Anthropic
	if (provider !== 'anthropic') {
		// Fall back to regular request without tools
		const response = await sendLLMRequest(provider, request, options);
		return {
			...response,
			toolCalls: undefined,
			stopReason: response.finishReason
		};
	}

	return callAnthropicWithTools(request, apiKey, tools, options.model);
}
