/**
 * Network Graph Builder
 * Creates network graphs showing relationships between entities
 */

import type {
	NetworkGraph,
	GraphNode,
	GraphEdge,
	GraphCluster,
	GraphQuery
} from '$lib/types/intelligence';
import type { NewsItem } from '$lib/types';
import type { DetectedMilitaryShip } from './military-ship-detection';

/**
 * Build network graph from news items
 */
export function buildGraphFromNews(newsItems: NewsItem[]): NetworkGraph {
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	const nodeMap = new Map<string, GraphNode>();
	const edgeSet = new Set<string>();

	newsItems.forEach(item => {
		// Create node for the news event itself
		const eventNode: GraphNode = {
			id: `event-${item.id}`,
			label: truncate(item.title, 50),
			type: 'event',
			category: item.category,
			importance: item.isAlert ? 0.9 : 0.5,
			properties: {
				title: item.title,
				source: item.source,
				timestamp: item.timestamp,
				url: item.url
			}
		};
		nodes.push(eventNode);
		nodeMap.set(eventNode.id, eventNode);

		// Extract entities from topics/regions
		if (item.topics) {
			item.topics.forEach(topic => {
				const topicId = `topic-${sanitize(topic)}`;
				if (!nodeMap.has(topicId)) {
					const topicNode: GraphNode = {
						id: topicId,
						label: topic,
						type: 'topic',
						importance: 0.6,
						properties: { name: topic }
					};
					nodes.push(topicNode);
					nodeMap.set(topicId, topicNode);
				}

				// Create edge between event and topic
				addEdge(edges, edgeSet, eventNode.id, topicId, 'mentions', 0.7);
			});
		}

		// Extract location nodes
		if (item.region) {
			const locationId = `location-${sanitize(item.region)}`;
			if (!nodeMap.has(locationId)) {
				const locationNode: GraphNode = {
					id: locationId,
					label: item.region,
					type: 'location',
					importance: 0.7,
					properties: { name: item.region }
				};
				nodes.push(locationNode);
				nodeMap.set(locationId, locationNode);
			}

			addEdge(edges, edgeSet, eventNode.id, locationId, 'mentions', 0.8);
		}
	});

	// Find correlations between events (same topics/locations)
	nodes.filter(n => n.type === 'event').forEach((eventA, i, events) => {
		events.slice(i + 1).forEach(eventB => {
			const topicsA = edges
				.filter(e => e.source === eventA.id && e.type === 'mentions')
				.map(e => e.target);
			const topicsB = edges
				.filter(e => e.source === eventB.id && e.type === 'mentions')
				.map(e => e.target);

			const sharedTopics = topicsA.filter(t => topicsB.includes(t));

			if (sharedTopics.length > 0) {
				addEdge(
					edges,
					edgeSet,
					eventA.id,
					eventB.id,
					'related',
					Math.min(0.9, sharedTopics.length * 0.3)
				);
			}
		});
	});

	return {
		nodes,
		edges,
		metadata: {
			generatedAt: new Date().toISOString(),
			nodeCount: nodes.length,
			edgeCount: edges.length
		}
	};
}

/**
 * Build graph from military ships
 */
export function buildGraphFromShips(ships: DetectedMilitaryShip[]): NetworkGraph {
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	const nodeMap = new Map<string, GraphNode>();
	const edgeSet = new Set<string>();

	ships.forEach(ship => {
		// Ship node
		const shipNode: GraphNode = {
			id: `ship-${ship.id}`,
			label: ship.name,
			type: 'ship',
			category: ship.type,
			importance: ship.type === 'carrier' ? 0.95 : ship.type === 'submarine' ? 0.9 : 0.7,
			properties: {
				name: ship.name,
				type: ship.type,
				country: ship.country,
				location: ship.location
			}
		};
		nodes.push(shipNode);
		nodeMap.set(shipNode.id, shipNode);

		// Country node
		const countryId = `country-${ship.country}`;
		if (!nodeMap.has(countryId)) {
			const countryNode: GraphNode = {
				id: countryId,
				label: getCountryName(ship.country),
				type: 'organization',
				importance: 0.8,
				properties: { code: ship.country }
			};
			nodes.push(countryNode);
			nodeMap.set(countryId, countryNode);
		}

		addEdge(edges, edgeSet, shipNode.id, countryId, 'participates', 1.0);

		// Location node
		if (ship.location) {
			const locationId = `location-${sanitize(ship.location)}`;
			if (!nodeMap.has(locationId)) {
				const locationNode: GraphNode = {
					id: locationId,
					label: ship.location,
					type: 'location',
					importance: 0.75,
					properties: { name: ship.location }
				};
				nodes.push(locationNode);
				nodeMap.set(locationId, locationNode);
			}

			addEdge(edges, edgeSet, shipNode.id, locationId, 'related', 0.9);
		}
	});

	// Group ships by country (formations)
	const shipsByCountry = ships.reduce(
		(acc, ship) => {
			if (!acc[ship.country]) acc[ship.country] = [];
			acc[ship.country].push(ship);
			return acc;
		},
		{} as Record<string, DetectedMilitaryShip[]>
	);

	// Create edges between ships from same country in same location
	Object.values(shipsByCountry).forEach(countryShips => {
		countryShips.forEach((shipA, i) => {
			countryShips.slice(i + 1).forEach(shipB => {
				if (shipA.location === shipB.location && shipA.location) {
					addEdge(
						edges,
						edgeSet,
						`ship-${shipA.id}`,
						`ship-${shipB.id}`,
						'related',
						0.7,
						true
					);
				}
			});
		});
	});

	return {
		nodes,
		edges,
		metadata: {
			generatedAt: new Date().toISOString(),
			nodeCount: nodes.length,
			edgeCount: edges.length
		}
	};
}

/**
 * Merge multiple graphs
 */
export function mergeGraphs(...graphs: NetworkGraph[]): NetworkGraph {
	const allNodes: GraphNode[] = [];
	const allEdges: GraphEdge[] = [];
	const nodeIds = new Set<string>();
	const edgeIds = new Set<string>();

	graphs.forEach(graph => {
		graph.nodes.forEach(node => {
			if (!nodeIds.has(node.id)) {
				allNodes.push(node);
				nodeIds.add(node.id);
			}
		});

		graph.edges.forEach(edge => {
			if (!edgeIds.has(edge.id)) {
				allEdges.push(edge);
				edgeIds.add(edge.id);
			}
		});
	});

	return {
		nodes: allNodes,
		edges: allEdges,
		metadata: {
			generatedAt: new Date().toISOString(),
			nodeCount: allNodes.length,
			edgeCount: allEdges.length
		}
	};
}

/**
 * Filter graph by query
 */
export function filterGraph(graph: NetworkGraph, query: GraphQuery): NetworkGraph {
	let filteredNodes = [...graph.nodes];
	let filteredEdges = [...graph.edges];

	// Filter by node types
	if (query.nodeTypes && query.nodeTypes.length > 0) {
		filteredNodes = filteredNodes.filter(n => query.nodeTypes!.includes(n.type));
	}

	// Filter by importance
	if (query.minImportance !== undefined) {
		filteredNodes = filteredNodes.filter(n => n.importance >= query.minImportance!);
	}

	// Filter by search
	if (query.search) {
		const searchLower = query.search.toLowerCase();
		filteredNodes = filteredNodes.filter(n => n.label.toLowerCase().includes(searchLower));
	}

	// Remove edges whose nodes were filtered out
	const nodeIds = new Set(filteredNodes.map(n => n.id));
	filteredEdges = filteredEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

	// Filter by edge types
	if (query.edgeTypes && query.edgeTypes.length > 0) {
		filteredEdges = filteredEdges.filter(e => query.edgeTypes!.includes(e.type));
	}

	// Limit node count
	if (query.maxNodes && filteredNodes.length > query.maxNodes) {
		// Keep most important nodes
		filteredNodes = filteredNodes.sort((a, b) => b.importance - a.importance).slice(0, query.maxNodes);
		const nodeIds = new Set(filteredNodes.map(n => n.id));
		filteredEdges = filteredEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
	}

	return {
		nodes: filteredNodes,
		edges: filteredEdges,
		metadata: {
			...graph.metadata,
			nodeCount: filteredNodes.length,
			edgeCount: filteredEdges.length
		}
	};
}

/**
 * Detect clusters in graph (simple community detection)
 */
export function detectClusters(graph: NetworkGraph): GraphCluster[] {
	// Simple clustering based on connected components
	const visited = new Set<string>();
	const clusters: GraphCluster[] = [];

	graph.nodes.forEach(node => {
		if (visited.has(node.id)) return;

		const cluster = new Set<string>();
		const queue = [node.id];

		while (queue.length > 0) {
			const current = queue.shift()!;
			if (visited.has(current)) continue;

			visited.add(current);
			cluster.add(current);

			// Find connected nodes
			graph.edges.forEach(edge => {
				if (edge.source === current && !visited.has(edge.target)) {
					queue.push(edge.target);
				}
				if (edge.target === current && !visited.has(edge.source)) {
					queue.push(edge.source);
				}
			});
		}

		if (cluster.size > 1) {
			const clusterNodes = graph.nodes.filter(n => cluster.has(n.id));
			const avgX = clusterNodes.reduce((sum, n) => sum + (n.position?.x || 0), 0) / clusterNodes.length;
			const avgY = clusterNodes.reduce((sum, n) => sum + (n.position?.y || 0), 0) / clusterNodes.length;

			clusters.push({
				id: `cluster-${clusters.length}`,
				name: `Cluster ${clusters.length + 1}`,
				nodeIds: Array.from(cluster),
				center: { x: avgX, y: avgY }
			});
		}
	});

	return clusters;
}

/**
 * Calculate node degrees (connections)
 */
export function getNodeDegrees(graph: NetworkGraph): Map<string, number> {
	const degrees = new Map<string, number>();

	graph.nodes.forEach(node => degrees.set(node.id, 0));

	graph.edges.forEach(edge => {
		degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
		degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
	});

	return degrees;
}

/**
 * Get most connected nodes
 */
export function getMostConnectedNodes(graph: NetworkGraph, limit = 10): GraphNode[] {
	const degrees = getNodeDegrees(graph);
	return graph.nodes
		.sort((a, b) => (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0))
		.slice(0, limit);
}

// Helper functions

function addEdge(
	edges: GraphEdge[],
	edgeSet: Set<string>,
	source: string,
	target: string,
	type: GraphEdge['type'],
	strength: number,
	bidirectional = false
) {
	const id = `${source}-${target}`;
	if (edgeSet.has(id)) return;

	edges.push({
		id,
		source,
		target,
		type,
		strength,
		bidirectional,
		properties: {}
	});
	edgeSet.add(id);
}

function sanitize(str: string): string {
	return str.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function truncate(str: string, maxLen: number): string {
	return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function getCountryName(code: string): string {
	const names: Record<string, string> = {
		US: 'United States',
		CN: 'China',
		RU: 'Russia',
		UK: 'United Kingdom',
		FR: 'France',
		JP: 'Japan',
		IN: 'India',
		KR: 'South Korea',
		AU: 'Australia',
		CA: 'Canada',
		DE: 'Germany',
		IT: 'Italy',
		ES: 'Spain',
		TR: 'Turkey',
		IL: 'Israel',
		IR: 'Iran',
		KP: 'North Korea',
		BR: 'Brazil',
		PK: 'Pakistan',
		SA: 'Saudi Arabia'
	};
	return names[code] || code;
}

/**
 * Export graph as JSON
 */
export function exportGraphAsJSON(graph: NetworkGraph): string {
	return JSON.stringify(graph, null, 2);
}

/**
 * Export graph as DOT format (Graphviz)
 */
export function exportGraphAsDOT(graph: NetworkGraph): string {
	let dot = 'digraph G {\n';
	dot += '  node [shape=box];\n';

	graph.nodes.forEach(node => {
		const size = node.importance * 2;
		dot += `  "${node.id}" [label="${node.label}", width=${size}];\n`;
	});

	graph.edges.forEach(edge => {
		const arrow = edge.bidirectional ? 'both' : 'forward';
		dot += `  "${edge.source}" -> "${edge.target}" [dir=${arrow}, penwidth=${edge.strength * 3}];\n`;
	});

	dot += '}';
	return dot;
}
