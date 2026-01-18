/**
 * AI Actions Service
 * Defines tools/actions that the AI can invoke to interact with the dashboard
 */

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
		description: 'Refresh news data from all RSS feeds and news sources. Use when user asks to check for new news, updates, or breaking stories.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_markets',
		description: 'Refresh market data including stock indices, sectors, commodities, and cryptocurrency prices. Use when user asks about current market conditions or prices.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_crypto',
		description: 'Refresh cryptocurrency prices and whale transaction data. Use when user asks about crypto, Bitcoin, Ethereum, or whale activity.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_geopolitical',
		description: 'Refresh geopolitical data including hotspot statuses, conflicts, and threat indicators. Use when user asks about conflicts, tensions, or geopolitical situations.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_infrastructure',
		description: 'Refresh infrastructure data including grid stress levels and outage information. Use when user asks about power grid, infrastructure, or outages.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_environmental',
		description: 'Refresh environmental data including earthquakes, radiation readings, and disease outbreaks. Use when user asks about natural disasters, radiation, or health emergencies.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_alternative',
		description: 'Refresh alternative data including prediction markets (Polymarket), government contracts, and layoff announcements. Use when user asks about predictions, contracts, or layoffs.',
		parameters: [],
		category: 'data'
	},
	{
		name: 'refresh_all',
		description: 'Refresh all data sources. Use when user asks for a complete refresh or wants everything updated.',
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
 * Execute a tool call using the provided handlers
 */
export async function executeToolCall(
	toolCall: ToolCall,
	handlers: ActionHandlers
): Promise<ToolResult> {
	try {
		switch (toolCall.name) {
			case 'refresh_news':
				await handlers.refreshNews();
				return {
					toolCallId: toolCall.id,
					success: true,
					result: 'News data has been refreshed. New articles and alerts are now available in the context.'
				};

			case 'refresh_markets':
				await handlers.refreshMarkets();
				return {
					toolCallId: toolCall.id,
					success: true,
					result: 'Market data has been refreshed including indices, sectors, and commodities.'
				};

			case 'refresh_crypto':
				await handlers.refreshCrypto();
				return {
					toolCallId: toolCall.id,
					success: true,
					result: 'Cryptocurrency data has been refreshed including prices and whale transactions.'
				};

			case 'refresh_geopolitical':
				await handlers.refreshGeopolitical();
				return {
					toolCallId: toolCall.id,
					success: true,
					result: 'Geopolitical data has been refreshed including hotspot statuses and conflicts.'
				};

			case 'refresh_infrastructure':
				await handlers.refreshInfrastructure();
				return {
					toolCallId: toolCall.id,
					success: true,
					result: 'Infrastructure data has been refreshed including grid stress and outage information.'
				};

			case 'refresh_environmental':
				await handlers.refreshEnvironmental();
				return {
					toolCallId: toolCall.id,
					success: true,
					result: 'Environmental data has been refreshed including earthquakes, radiation, and disease outbreaks.'
				};

			case 'refresh_alternative':
				await handlers.refreshAlternative();
				return {
					toolCallId: toolCall.id,
					success: true,
					result: 'Alternative data has been refreshed including predictions, contracts, and layoffs.'
				};

			case 'refresh_all':
				await handlers.refreshAll();
				return {
					toolCallId: toolCall.id,
					success: true,
					result: 'All data sources have been refreshed. Full intelligence context is now up to date.'
				};

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

When using tools:
1. Use refresh tools when data might be stale or user asks for latest information
2. After refreshing data, analyze the new information in your response
3. Be proactive about suggesting refreshes when discussing potentially outdated information
4. Use highlight_panel to direct user attention to relevant dashboard sections`;
}
