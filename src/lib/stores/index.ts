/**
 * Stores barrel file - re-exports all stores
 */

// Settings store
export {
	settings,
	enabledPanels,
	disabledPanels,
	draggablePanels,
	layoutSettings,
	type PanelSettings,
	type SettingsState,
	type LayoutSettings
} from './settings';

// Monitors store
export {
	monitors,
	enabledMonitors,
	monitorCount,
	matchCount,
	hasMatches,
	type MonitorMatch,
	type MonitorsState
} from './monitors';

// News store
export {
	news,
	politicsNews,
	techNews,
	financeNews,
	govNews,
	aiNews,
	intelNews,
	allNewsItems,
	categorizedNewsItems,
	alerts,
	isLoading as isNewsLoading,
	hasErrors as hasNewsErrors,
	type CategoryState,
	type NewsState
} from './news';

// Markets store
export {
	markets,
	indices,
	sectors,
	commodities,
	crypto,
	isMarketsLoading,
	marketsLastUpdated,
	vix,
	type MarketsState
} from './markets';

// Refresh store
export {
	refresh,
	isRefreshing,
	currentStage,
	lastRefresh,
	autoRefreshEnabled,
	timeSinceRefresh,
	categoriesWithErrors,
	REFRESH_STAGES,
	type RefreshStage,
	type StageConfig,
	type RefreshState
} from './refresh';

// Panel Layout store (drag-drop)
export {
	panelLayout,
	leftPanels,
	rightPanels,
	bottomPanels,
	isDragging,
	draggedPanelId,
	currentDropTarget,
	type PanelZone,
	type PanelPosition,
	type PanelLayoutState
} from './panelLayout';

// Chat store (LLM analysis)
export {
	chat,
	activeSession,
	activeMessages,
	sessionCount,
	isLoading as isChatLoading,
	chatError,
	recentSessions,
	type ChatState,
	type ChatSession,
	type ChatMessage
} from './chat';

// LLM Preferences store
export {
	llmPreferences,
	enabledCategories,
	enabledCategoryList,
	analysisDepth,
	currentProvider,
	newsFilterCategories,
	type LLMPreferences
} from './llmPreferences';

// Analysis Results store (correlations, narratives, main characters)
export {
	analysisResults,
	correlationResults,
	narrativeResults,
	mainCharacterResults,
	hasAnalysisResults,
	emergingTopics,
	risingCorrelations,
	topCharacters,
	type AnalysisResultsState
} from './analysisResults';

// Weather Command Center store
export {
	weather,
	activeAlerts,
	alertCount,
	severeAlertCount,
	enabledZones,
	zoneCount,
	weatherLoading,
	selectedAlert
} from './weather';

// Vessel Track store (selected vessel visualization)
export {
	selectedVesselTrack,
	hasSelectedTrack,
	trackPointCount,
	setSelectedVesselTrack,
	clearSelectedVesselTrack,
	type SelectedVesselTrack
} from './vesselTrack';

// Crisis Watch store
export {
	crisisWatch,
	crisisWatchConfigs,
	enabledCrisisWatches,
	getDefaultConfig,
	getConfigByPanelId,
	type CrisisWatchConfig,
	type CrisisWatchState
} from './crisisWatch';
