/**
 * Advanced Intelligence Features Types
 * Types for Scenario Builder, Signal Classifier, Network Graph, etc.
 */

// =============================================================================
// Scenario Builder
// =============================================================================

export interface Scenario {
	id: string;
	name: string;
	description: string;
	category: 'military' | 'economic' | 'natural_disaster' | 'cyber' | 'political' | 'pandemic';
	triggers: ScenarioTrigger[];
	predictions: ScenarioPrediction[];
	historicalComparisons: HistoricalComparison[];
	createdAt: string;
	updatedAt: string;
	status: 'draft' | 'active' | 'archived';
}

export interface ScenarioTrigger {
	type: 'event' | 'threshold' | 'pattern';
	description: string;
	condition: string; // e.g., "military_ships > 5 in Taiwan Strait"
	met: boolean;
	metAt?: string;
}

export interface ScenarioPrediction {
	domain: 'military' | 'markets' | 'supply_chain' | 'diplomatic' | 'humanitarian';
	impact: 'extreme' | 'high' | 'medium' | 'low';
	description: string;
	probability: number; // 0-1
	timeframe: string; // e.g., "within 24 hours", "1-2 weeks"
	indicators: string[]; // What to watch for
	metrics?: {
		[key: string]: {
			current: number;
			predicted: number;
			unit: string;
		};
	};
}

export interface HistoricalComparison {
	event: string;
	date: string;
	similarity: number; // 0-1
	outcome: string;
	lessons: string[];
	references?: string[];
}

// =============================================================================
// Signal vs Noise Classifier
// =============================================================================

export interface SignalScore {
	itemId: string;
	itemType: 'news' | 'market' | 'military' | 'weather' | 'earthquake' | 'disease' | 'other';
	signalStrength: number; // 0-100, higher = more important
	classification: 'critical' | 'important' | 'relevant' | 'noise';
	confidence: number; // 0-1
	factors: SignalFactor[];
	reasoning: string;
	timestamp: string;
}

export interface SignalFactor {
	name: string;
	weight: number; // Contribution to score
	value: number;
	description: string;
}

export interface UserFeedback {
	itemId: string;
	action: 'save' | 'dismiss' | 'flag' | 'archive' | 'share';
	timestamp: string;
	context?: string;
}

export interface ClassifierModel {
	version: string;
	trainedAt: string;
	accuracy: number;
	weights: {
		[factor: string]: number;
	};
	thresholds: {
		critical: number;
		important: number;
		relevant: number;
	};
}

// =============================================================================
// Network Graph Visualization
// =============================================================================

export interface NetworkGraph {
	nodes: GraphNode[];
	edges: GraphEdge[];
	metadata: {
		generatedAt: string;
		nodeCount: number;
		edgeCount: number;
		clusters?: GraphCluster[];
	};
}

export interface GraphNode {
	id: string;
	label: string;
	type: 'event' | 'entity' | 'location' | 'person' | 'organization' | 'ship' | 'market' | 'topic';
	category?: string;
	importance: number; // 0-1, affects size
	properties: {
		[key: string]: any;
	};
	position?: {
		x: number;
		y: number;
	};
	color?: string;
	icon?: string;
}

export interface GraphEdge {
	id: string;
	source: string; // node ID
	target: string; // node ID
	type: 'correlates' | 'causes' | 'related' | 'mentions' | 'participates' | 'affects';
	strength: number; // 0-1, affects thickness
	bidirectional: boolean;
	properties: {
		[key: string]: any;
	};
	label?: string;
	color?: string;
}

export interface GraphCluster {
	id: string;
	name: string;
	nodeIds: string[];
	center: {
		x: number;
		y: number;
	};
	color?: string;
}

export interface GraphQuery {
	nodeTypes?: GraphNode['type'][];
	edgeTypes?: GraphEdge['type'][];
	search?: string;
	minImportance?: number;
	maxNodes?: number;
	timeRange?: {
		start: string;
		end: string;
	};
}

// =============================================================================
// Command Palette
// =============================================================================

export interface Command {
	id: string;
	label: string;
	description?: string;
	category: 'navigation' | 'action' | 'filter' | 'view' | 'data';
	icon?: string;
	keywords: string[];
	shortcut?: string;
	action: () => void | Promise<void>;
	available: boolean; // Can this command run right now?
}

export interface CommandCategory {
	name: string;
	icon?: string;
	priority: number;
}

export interface RecentCommand {
	commandId: string;
	timestamp: string;
	frequency: number; // How many times used
}

// =============================================================================
// Combined Intelligence Context
// =============================================================================

export interface IntelligenceContext {
	activeScenarios: Scenario[];
	recentSignals: SignalScore[];
	networkGraph?: NetworkGraph;
	userPreferences: {
		signalThreshold: number;
		autoClassify: boolean;
		dismissedNoiseCount: number;
	};
}
