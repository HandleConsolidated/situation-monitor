/**
 * Service layer exports
 */

// Errors
export { ServiceError, NetworkError, TimeoutError, CircuitOpenError } from './errors';

// Cache Manager
export {
	CacheManager,
	cacheManager,
	type CacheEntry,
	type CacheResult,
	type CacheManagerOptions,
	type CacheStats
} from './cache';

// Persistent API Cache
export {
	apiCache,
	withCache,
	createCachedFetcher,
	API_CACHE_TTL,
	type ApiCacheKey
} from './api-cache';

// Circuit Breaker
export {
	CircuitBreaker,
	CircuitBreakerRegistry,
	CircuitBreakerStates,
	circuitBreakerRegistry,
	type CircuitBreakerState,
	type CircuitBreakerOptions,
	type CircuitBreakerStatus
} from './circuit-breaker';

// Request Deduplicator
export { RequestDeduplicator, requestDeduplicator } from './deduplicator';

// Service Registry
export {
	ServiceRegistry,
	SERVICE_CONFIG,
	type ServiceConfig,
	type ServiceId,
	type CacheConfig,
	type CircuitBreakerConfig
} from './registry';

// Service Client
export {
	ServiceClient,
	serviceClient,
	type RequestOptions,
	type RequestResult,
	type ServiceClientOptions,
	type HealthStatus
} from './client';

// Context Builder (LLM)
export {
	buildIntelligenceContext,
	getContextSummary,
	exportContextAsJSON,
	hashContext,
	type ExternalData
} from './context-builder';

// LLM Service
export {
	sendLLMRequest,
	sendLLMRequestWithTools,
	continueWithToolResults,
	analyzeContext,
	formatContextForLLM,
	getLLMServiceStatus,
	storeApiKey,
	getStoredApiKey,
	removeApiKey,
	hasApiKey,
	generateMessageId,
	generateSessionId,
	type LLMResponseWithTools
} from './llm';

// AI Actions Service
export {
	AI_TOOLS,
	getAnthropicTools,
	executeToolCall,
	generateToolCallId,
	getToolsSystemPrompt,
	type ToolDefinition,
	type ToolCall,
	type ToolResult,
	type ActionHandlers,
	type ActionExecution,
	type ActionStatus,
	type AnthropicTool
} from './ai-actions';

// Auto Analysis Service
export {
	autoAnalysis,
	ttsService as browserTtsService,
	isAutoAnalysisEnabled,
	unacknowledgedAlerts,
	criticalAlerts,
	DEFAULT_AUTO_ANALYSIS_PREFERENCES,
	type AlertSeverity,
	type AlertTrigger,
	type AnalysisAlert,
	type AutoAnalysisPreferences,
	type AutoAnalysisState,
	type AnalysisHistoryEntry
} from './auto-analysis';

// TTS Service (Multi-provider: ElevenLabs, OpenAI, Browser)
export {
	tts,
	ttsState,
	ttsPreferences,
	speak,
	stopSpeaking,
	isSpeaking,
	getVoicesForProvider,
	getDefaultVoiceForProvider,
	testTTS,
	storeTTSApiKey,
	getTTSApiKey,
	hasTTSApiKey,
	removeTTSApiKey,
	ELEVENLABS_VOICES,
	OPENAI_VOICES,
	DEFAULT_TTS_PREFERENCES,
	type TTSProvider,
	type TTSVoice,
	type TTSOptions,
	type TTSState,
	type TTSPreferences
} from './tts';
