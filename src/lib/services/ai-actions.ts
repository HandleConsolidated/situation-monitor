/**
 * AI Actions Service
 * Defines tools/actions that the AI can invoke to interact with the dashboard
 */

// ============================================================================
// Staleness Configuration
// ============================================================================

/**
 * Default staleness threshold in milliseconds.
 * Data older than this will be refreshed; fresher data will use cache.
 */
export const DEFAULT_STALENESS_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Per-category staleness thresholds (in milliseconds).
 * Categories not listed use DEFAULT_STALENESS_THRESHOLD_MS.
 */
export const CATEGORY_STALENESS_THRESHOLDS: Record<string, number> = {
	news: 2 * 60 * 1000, // 2 minutes - news updates frequently
	markets: 60 * 1000, // 1 minute - markets are time-sensitive
	crypto: 60 * 1000, // 1 minute - crypto is volatile
	geopolitical: 2 * 60 * 1000, // 2 minutes
	infrastructure: 5 * 60 * 1000, // 5 minutes - infrastructure data is more stable
	environmental: 5 * 60 * 1000, // 5 minutes - earthquakes/radiation update less frequently
	alternative: 5 * 60 * 1000 // 5 minutes - polymarket/contracts/layoffs
};

// ============================================================================
// Tool Definitions (for Anthropic/OpenAI tool use)
// ============================================================================

export interface ToolParameter {
	name: string;
	type: 'string' | 'number' | 'boolean' | 'array';
	description: string;
	required: boolean;
	enum?: string[];
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: ToolParameter[];
	category: 'data' | 'analysis' | 'navigation' | 'system';
}

/**
 * All available tools the AI can invoke
 */
export const AI_TOOLS: ToolDefinition[] = [
	// Data refresh tools
	{
		name: 'refresh_news',
		description:
			'Refresh news data from all RSS feeds and news sources. Smart caching: only fetches if data is older than 2 minutes, otherwise uses cached data. Use when user asks to check for new news, updates, or breaking stories.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_markets',
		description:
			'Refresh market data including stock indices, sectors, and commodities. Smart caching: only fetches if data is older than 1 minute, otherwise uses cached data. Use when user asks about current market conditions or prices.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_crypto',
		description:
			'Refresh cryptocurrency prices and whale transaction data. Smart caching: only fetches if data is older than 1 minute, otherwise uses cached data. Use when user asks about crypto, Bitcoin, Ethereum, or whale activity.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_geopolitical',
		description:
			'Refresh geopolitical data including hotspot statuses, conflicts, and threat indicators. Smart caching: only fetches if data is older than 2 minutes. Use when user asks about conflicts, tensions, or geopolitical situations.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_infrastructure',
		description:
			'Refresh infrastructure data including grid stress levels and outage information. Smart caching: only fetches if data is older than 5 minutes. Use when user asks about power grid, infrastructure, or outages.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_environmental',
		description:
			'Refresh environmental data including earthquakes, radiation readings, and disease outbreaks. Smart caching: only fetches if data is older than 5 minutes. Use when user asks about natural disasters, radiation, or health emergencies.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_alternative',
		description:
			'Refresh alternative data including prediction markets (Polymarket), government contracts, and layoff announcements. Smart caching: only fetches if data is older than 5 minutes. Use when user asks about predictions, contracts, or layoffs.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_all',
		description:
			'Refresh all data sources. Smart caching applies per-category: only stale data is refreshed. Use when user asks for a complete refresh or wants everything updated.',
		parameters: [],
		category: 'data'
	},

	// Analysis tools
	{
		name: 'run_analysis',
		description: 'Run a specific type of analysis on the current data. Available types: daily-briefing, threat-assessment, escalation-watch, market-intelligence, whale-alert, correlation-analysis, flash-update.',
		parameters: [
			{
				name: 'analysis_type',
				type: 'string',
				description: 'The type of analysis to run',
				required: true,
				enum: [
					'daily-briefing',
					'evening-summary',
					'flash-update',
					'threat-assessment',
					'escalation-watch',
					'cyber-threat',
					'market-intelligence',
					'whale-alert',
					'prediction-markets',
					'correlation-analysis',
					'narrative-tracker',
					'europe-focus',
					'asia-pacific-focus',
					'middle-east-focus'
				]
			}
		],
		category: 'analysis'
	},
	{
		name: 'focus_category',
		description: 'Focus the analysis context on specific data categories. Use when user wants to zoom in on particular areas.',
		parameters: [
			{
				name: 'categories',
				type: 'array',
				description: 'Categories to focus on: geopolitical, news, markets, crypto, infrastructure, analysis, monitors, environmental, alternative',
				required: true
			}
		],
		category: 'analysis'
	},

	// Navigation tools
	{
		name: 'highlight_panel',
		description: 'Highlight or bring attention to a specific panel in the dashboard. Use when discussing specific data shown in a panel.',
		parameters: [
			{
				name: 'panel_id',
				type: 'string',
				description: 'The panel to highlight',
				required: true,
				enum: [
					'news', 'markets', 'heatmap', 'commodities', 'crypto',
					'mainchar', 'printer', 'polymarket', 'whales', 'contracts',
					'layoffs', 'intel', 'situation', 'correlation', 'narrative',
					'monitors', 'map', 'globe', 'leaders', 'gridstress',
					'earthquakes', 'radiation', 'outbreaks'
				]
			}
		],
		category: 'navigation'
	},

	// System tools
	{
		name: 'get_data_freshness',
		description: 'Check when each data category was last updated. Use when user asks about data freshness or staleness.',
		parameters: [],
		category: 'system'
	}
];

// ============================================================================
// Tool Execution Types
// ============================================================================

export type ToolName = typeof AI_TOOLS[number]['name'];

export interface ToolCall {
	id: string;
	name: ToolName;
	parameters: Record<string, unknown>;
}

export interface ToolResult {
	toolCallId: string;
	success: boolean;
	result?: string;
	error?: string;
	data?: unknown;
}

export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ActionExecution {
	id: string;
	toolName: ToolName;
	parameters: Record<string, unknown>;
	status: ActionStatus;
	startTime: number;
	endTime?: number;
	result?: ToolResult;
}

// ============================================================================
// Action Handlers Interface
// ============================================================================

/**
 * Callbacks that the page must provide to execute actions
 */
export interface ActionHandlers {
	refreshNews: () => Promise<void>;
	refreshMarkets: () => Promise<void>;
	refreshCrypto: () => Promise<void>;
	refreshGeopolitical: () => Promise<void>;
	refreshInfrastructure: () => Promise<void>;
	refreshEnvironmental: () => Promise<void>;
	refreshAlternative: () => Promise<void>;
	refreshAll: () => Promise<void>;
	highlightPanel: (panelId: string) => void;
	getDataFreshness: () => Record<string, number | null>;
}

// ============================================================================
// Convert to Anthropic Tool Format
// ============================================================================

export interface AnthropicTool {
	name: string;
	description: string;
	input_schema: {
		type: 'object';
		properties: Record<string, {
			type: string;
			description: string;
			enum?: string[];
			items?: { type: string };
		}>;
		required: string[];
	};
}

/**
 * Convert our tool definitions to Anthropic's tool format
 */
export function getAnthropicTools(): AnthropicTool[] {
	return AI_TOOLS.map(tool => {
		const properties: AnthropicTool['input_schema']['properties'] = {};
		const required: string[] = [];

		tool.parameters.forEach(param => {
			const prop: { type: string; description: string; enum?: string[]; items?: { type: string } } = {
				type: param.type === 'array' ? 'array' : param.type,
				description: param.description
			};

			if (param.enum) {
				prop.enum = param.enum;
			}

			if (param.type === 'array') {
				prop.items = { type: 'string' };
			}

			properties[param.name] = prop;

			if (param.required) {
				required.push(param.name);
			}
		});

		return {
			name: tool.name,
			description: tool.description,
			input_schema: {
				type: 'object',
				properties,
				required
			}
		};
	});
}

// ============================================================================
// Tool Execution Engine
// ============================================================================

/**
 * Check if a data category is stale and needs refresh
 */
function isCategoryStale(
	category: string,
	freshness: Record<string, number | null>
): { isStale: boolean; ageSeconds: number | null } {
	const lastUpdated = freshness[category];
	if (lastUpdated === null || lastUpdated === undefined) {
		return { isStale: true, ageSeconds: null };
	}

	const threshold = CATEGORY_STALENESS_THRESHOLDS[category] ?? DEFAULT_STALENESS_THRESHOLD_MS;
	const ageMs = Date.now() - lastUpdated;
	const ageSeconds = Math.round(ageMs / 1000);

	return {
		isStale: ageMs > threshold,
		ageSeconds
	};
}

/**
 * Format age for human-readable output
 */
function formatAge(seconds: number | null): string {
	if (seconds === null) return 'never fetched';
	if (seconds < 60) return `${seconds} seconds ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes === 1) return '1 minute ago';
	return `${minutes} minutes ago`;
}

/**
 * Execute a conditional refresh for a single category.
 * Only refreshes if data is stale; returns appropriate message.
 */
async function executeConditionalRefresh(
	category: string,
	refreshFn: () => Promise<void>,
	freshness: Record<string, number | null>,
	dataDescription: string
): Promise<{ refreshed: boolean; message: string }> {
	const { isStale, ageSeconds } = isCategoryStale(category, freshness);

	if (!isStale) {
		return {
			refreshed: false,
			message: `Using cached ${dataDescription} (last updated ${formatAge(ageSeconds)}). Data is still fresh.`
		};
	}

	await refreshFn();
	return {
		refreshed: true,
		message: `${dataDescription} has been refreshed with latest data.${ageSeconds !== null ? ` Previous data was ${formatAge(ageSeconds)}.` : ''}`
	};
}

/**
 * Execute conditional refreshes for multiple categories.
 * Returns a summary of what was refreshed vs cached.
 */
async function executeMultiCategoryRefresh(
	categories: Array<{ category: string; refreshFn: () => Promise<void>; description: string }>,
	freshness: Record<string, number | null>
): Promise<{ refreshedCount: number; cachedCount: number; message: string }> {
	const results: Array<{ category: string; refreshed: boolean; description: string; ageSeconds: number | null }> = [];

	for (const { category, refreshFn, description } of categories) {
		const { isStale, ageSeconds } = isCategoryStale(category, freshness);

		if (isStale) {
			await refreshFn();
			results.push({ category, refreshed: true, description, ageSeconds });
		} else {
			results.push({ category, refreshed: false, description, ageSeconds });
		}
	}

	const refreshed = results.filter((r) => r.refreshed);
	const cached = results.filter((r) => !r.refreshed);

	const lines: string[] = [];

	if (refreshed.length > 0) {
		lines.push(
			`Refreshed: ${refreshed.map((r) => r.description).join(', ')}.`
		);
	}

	if (cached.length > 0) {
		const cachedDetails = cached
			.map((r) => `${r.description} (${formatAge(r.ageSeconds)})`)
			.join(', ');
		lines.push(`Using cached data for: ${cachedDetails}.`);
	}

	return {
		refreshedCount: refreshed.length,
		cachedCount: cached.length,
		message: lines.join(' ')
	};
}

/**
 * Execute a tool call using the provided handlers
 */
export async function executeToolCall(
	toolCall: ToolCall,
	handlers: ActionHandlers
): Promise<ToolResult> {
	try {
		// Get current data freshness for smart caching decisions
		const freshness = handlers.getDataFreshness();

		switch (toolCall.name) {
			case 'refresh_news': {
				const { refreshed, message } = await executeConditionalRefresh(
					'news',
					handlers.refreshNews,
					freshness,
					'News data'
				);
				return {
					toolCallId: toolCall.id,
					success: true,
					result: message,
					data: { refreshed, category: 'news' }
				};
			}

			case 'refresh_markets': {
				const { refreshed, message } = await executeConditionalRefresh(
					'markets',
					handlers.refreshMarkets,
					freshness,
					'Market data'
				);
				return {
					toolCallId: toolCall.id,
					success: true,
					result: message,
					data: { refreshed, category: 'markets' }
				};
			}

			case 'refresh_crypto': {
				const { refreshed, message } = await executeConditionalRefresh(
					'crypto',
					handlers.refreshCrypto,
					freshness,
					'Cryptocurrency data'
				);
				return {
					toolCallId: toolCall.id,
					success: true,
					result: message,
					data: { refreshed, category: 'crypto' }
				};
			}

			case 'refresh_geopolitical': {
				const { refreshed, message } = await executeConditionalRefresh(
					'geopolitical',
					handlers.refreshGeopolitical,
					freshness,
					'Geopolitical data'
				);
				return {
					toolCallId: toolCall.id,
					success: true,
					result: message,
					data: { refreshed, category: 'geopolitical' }
				};
			}

			case 'refresh_infrastructure': {
				const { refreshed, message } = await executeConditionalRefresh(
					'infrastructure',
					handlers.refreshInfrastructure,
					freshness,
					'Infrastructure data'
				);
				return {
					toolCallId: toolCall.id,
					success: true,
					result: message,
					data: { refreshed, category: 'infrastructure' }
				};
			}

			case 'refresh_environmental': {
				const { refreshed, message } = await executeConditionalRefresh(
					'environmental',
					handlers.refreshEnvironmental,
					freshness,
					'Environmental data'
				);
				return {
					toolCallId: toolCall.id,
					success: true,
					result: message,
					data: { refreshed, category: 'environmental' }
				};
			}

			case 'refresh_alternative': {
				const { refreshed, message } = await executeConditionalRefresh(
					'alternative',
					handlers.refreshAlternative,
					freshness,
					'Alternative data'
				);
				return {
					toolCallId: toolCall.id,
					success: true,
					result: message,
					data: { refreshed, category: 'alternative' }
				};
			}

			case 'refresh_all': {
				const { refreshedCount, cachedCount, message } = await executeMultiCategoryRefresh(
					[
						{ category: 'news', refreshFn: handlers.refreshNews, description: 'News' },
						{ category: 'markets', refreshFn: handlers.refreshMarkets, description: 'Markets' },
						{ category: 'crypto', refreshFn: handlers.refreshCrypto, description: 'Crypto' },
						{ category: 'geopolitical', refreshFn: handlers.refreshGeopolitical, description: 'Geopolitical' },
						{ category: 'infrastructure', refreshFn: handlers.refreshInfrastructure, description: 'Infrastructure' },
						{ category: 'environmental', refreshFn: handlers.refreshEnvironmental, description: 'Environmental' },
						{ category: 'alternative', refreshFn: handlers.refreshAlternative, description: 'Alternative' }
					],
					freshness
				);
				return {
					toolCallId: toolCall.id,
					success: true,
					result: message || 'All data is already fresh. No refresh needed.',
					data: { refreshedCount, cachedCount }
				};
			}

			case 'run_analysis': {
				const analysisType = toolCall.parameters.analysis_type as string;
				return {
					toolCallId: toolCall.id,
					success: true,
					result: `Running ${analysisType} analysis. Please proceed with the analysis using the refreshed context.`,
					data: { analysisType }
				};
			}

			case 'focus_category': {
				const categories = toolCall.parameters.categories as string[];
				return {
					toolCallId: toolCall.id,
					success: true,
					result: `Focusing analysis on: ${categories.join(', ')}. Context will emphasize these categories.`,
					data: { categories }
				};
			}

			case 'highlight_panel': {
				const panelId = toolCall.parameters.panel_id as string;
				handlers.highlightPanel(panelId);
				return {
					toolCallId: toolCall.id,
					success: true,
					result: `Panel "${panelId}" has been highlighted for the user's attention.`
				};
			}

			case 'get_data_freshness': {
				const freshness = handlers.getDataFreshness();
				const report = Object.entries(freshness)
					.map(([category, timestamp]) => {
						if (!timestamp) return `${category}: Never updated`;
						const ageMs = Date.now() - timestamp;
						const ageMins = Math.floor(ageMs / 60000);
						return `${category}: ${ageMins < 1 ? 'Just now' : `${ageMins} minutes ago`}`;
					})
					.join('\n');
				return {
					toolCallId: toolCall.id,
					success: true,
					result: `Data Freshness Report:\n${report}`,
					data: freshness
				};
			}

			default:
				return {
					toolCallId: toolCall.id,
					success: false,
					error: `Unknown tool: ${toolCall.name}`
				};
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return {
			toolCallId: toolCall.id,
			success: false,
			error: `Failed to execute ${toolCall.name}: ${errorMessage}`
		};
	}
}

/**
 * Generate a unique tool call ID
 */
export function generateToolCallId(): string {
	return `tc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get tool description for the system prompt
 */
export function getToolsSystemPrompt(): string {
	return `You have access to tools that can interact with the intelligence dashboard. When the user asks you to check, refresh, or look up specific information, use the appropriate tool.

Available actions:
- Refresh specific data: news, markets, crypto, geopolitical, infrastructure, environmental, alternative data
- Run specialized analyses: threat assessment, market intelligence, correlation analysis, etc.
- Highlight panels: bring attention to specific dashboard panels
- Check data freshness: see when data was last updated

IMPORTANT - Smart Caching:
All refresh tools use smart caching. When you call a refresh tool:
- If data is fresh (recently fetched), it will use cached data and tell you when it was last updated
- If data is stale, it will fetch new data and confirm the refresh
- The tool result will clearly indicate whether data was refreshed or came from cache
- You do NOT need to check data freshness before refreshing - the tools handle this automatically

Staleness thresholds by category:
- Markets/Crypto: 1 minute (time-sensitive)
- News/Geopolitical: 2 minutes
- Infrastructure/Environmental/Alternative: 5 minutes

When using tools:
1. Call refresh tools freely - smart caching prevents unnecessary fetches
2. Trust the tool result to tell you if data was refreshed or cached
3. After a tool call, analyze the information in your response
4. Use highlight_panel to direct user attention to relevant dashboard sections`;
}
