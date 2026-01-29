# Advanced Intelligence Features

## Overview

Four major new capabilities transform Situation Monitor into a comprehensive intelligence analysis platform:

1. **Scenario Builder** - "What if" analysis with impact predictions
2. **Command Palette** - Keyboard-driven quick actions (Cmd+K / Ctrl+K)
3. **Signal vs Noise Classifier** - AI-powered importance scoring
4. **Network Graph Visualization** - Relationship mapping between entities

---

## 1. Scenario Builder 🎯

### What It Does
Simulate and analyze potential crisis scenarios with multi-domain impact predictions.

### Features
- **5 pre-loaded scenario templates:**
  - ⚔️ China Invades Taiwan
  - 🌋 Major Earthquake in California  
  - 💣 Iran-Israel Conflict Escalation
  - 🦠 Global Pandemic (H5N1 Bird Flu)
  - 💻 Massive Cyberattack on US Grid

- **Trigger tracking** - Monitor conditions that could activate scenarios
- **Multi-domain predictions** - Markets, military, supply chain, diplomatic, humanitarian
- **Probability scoring** - Calculate likelihood based on trigger status
- **Historical comparisons** - Learn from similar past events
- **Impact metrics** - Quantified predictions (e.g., oil price $75 → $180)
- **Export to Markdown** - Generate briefing documents

### Usage

```typescript
import { 
  createScenario, 
  SCENARIO_TEMPLATES,
  evaluateScenarioTriggers,
  calculateScenarioProbability 
} from '$lib/utils/scenario-builder';

// Create scenario from template
const scenario = createScenario(SCENARIO_TEMPLATES[0]);

// Evaluate triggers with current data
const updated = evaluateScenarioTriggers(scenario, {
  militaryShips: detectedShips,
  earthquakes: recentQuakes
});

// Calculate probability (0-1)
const probability = calculateScenarioProbability(updated);

console.log(`Scenario probability: ${Math.round(probability * 100)}%`);
```

### Scenario Structure

```typescript
interface Scenario {
  id: string;
  name: string;
  description: string;
  category: 'military' | 'economic' | 'natural_disaster' | 'cyber' | 'political' | 'pandemic';
  triggers: ScenarioTrigger[];
  predictions: ScenarioPrediction[];
  historicalComparisons: HistoricalComparison[];
  status: 'draft' | 'active' | 'archived';
}
```

### Example Output

**Scenario: China Invades Taiwan**

**Predicted Impacts:**

🚨 **MARKETS - EXTREME (95% probability)**
- Global stock market crash
- Semiconductor supply crisis
- Metrics: S&P 500 (5000 → 3500), Oil ($75 → $150/barrel)

⚔️ **MILITARY - EXTREME (85% probability)**
- US military intervention likely
- Risk of great power war
- Timeframe: within 48 hours

**Historical Comparison:**
- Russia invades Ukraine (2022) - 75% similarity
- Lessons: Swift international response likely, supply chain disruptions amplify impact

---

## 2. Command Palette ⌘K

### What It Does
Quick keyboard-driven access to all app functions (like VSCode, Linear, Raycast).

### Features
- **Fuzzy search** - Type partial matches
- **Categorized commands** - Navigation, Actions, Filters, Views, Data
- **Keyboard navigation** - ↑↓ to select, Enter to execute, Esc to close
- **Recent commands** - Remembers frequently used actions
- **Shortcuts displayed** - Shows keyboard shortcuts for each command

### Usage

**Open palette:**
- Mac: `Cmd+K`
- Windows/Linux: `Ctrl+K`

**Example commands:**
- "Show Taiwan" → Jump to Taiwan on map
- "Add alert for Bitcoin" → Create new alert
- "Filter by military" → Show only military news
- "Export data" → Download current view

### Implementation

```typescript
import CommandPalette from '$lib/components/common/CommandPalette.svelte';
import type { Command } from '$lib/types/intelligence';

const commands: Command[] = [
  {
    id: 'nav-taiwan',
    label: 'Show Taiwan on Map',
    description: 'Jump to Taiwan region',
    category: 'navigation',
    icon: '🗺️',
    keywords: ['taiwan', 'map', 'region'],
    shortcut: 'G T',
    action: () => map.flyTo({ center: [121, 25] }),
    available: true
  },
  {
    id: 'filter-critical',
    label: 'Show Critical Signals Only',
    description: 'Filter by critical classification',
    category: 'filter',
    icon: '🚨',
    keywords: ['filter', 'critical', 'important'],
    action: () => setFilter('critical'),
    available: true
  }
];
```

### Adding Custom Commands

```typescript
// In your main app/layout
function registerCommands() {
  return [
    // Navigation commands
    ...mapLocations.map(loc => ({
      id: `nav-${loc.id}`,
      label: `Go to ${loc.name}`,
      category: 'navigation',
      keywords: [loc.name, 'map', 'location'],
      action: () => navigateTo(loc),
      available: true
    })),
    
    // Action commands
    {
      id: 'action-refresh',
      label: 'Refresh All Data',
      category: 'action',
      shortcut: 'Cmd+R',
      action: async () => await refreshData(),
      available: true
    }
  ];
}
```

---

## 3. Signal vs Noise Classifier 🎯

### What It Does
Automatically scores events by importance (0-100) to filter out low-value alerts.

### Classification Levels
- **🚨 Critical** (80-100) - Immediate attention required
- **⚠️ Important** (60-79) - High priority
- **👁️ Relevant** (40-59) - Worth monitoring
- **🔇 Noise** (0-39) - Can be filtered out

### Scoring Factors
1. **Source Credibility** (25% weight) - Reuters, AP, BBC = high score
2. **Keyword Match** (20%) - "nuclear", "attack", "invasion" boost score
3. **Magnitude** (20%) - Earthquake size, market moves, etc.
4. **Recency** (15%) - Newer events score higher
5. **Geographic Relevance** (10%) - Taiwan, Ukraine, Middle East = high priority
6. **User Interest** (10%) - Learns from your saves/dismissals

### Usage

```typescript
import { classifyNewsItem, filterBySignal } from '$lib/utils/signal-classifier';

// Classify a single item
const score = classifyNewsItem(newsItem);

console.log(`Signal Strength: ${score.signalStrength}/100`);
console.log(`Classification: ${score.classification}`);
console.log(`Reasoning: ${score.reasoning}`);

// Filter items by minimum signal strength
const importantNews = filterBySignal(newsItems, scores, 60); // 60+ only

// Get classification stats
const stats = getClassificationStats(scores);
console.log(`Critical: ${stats.critical}, Noise: ${stats.noise}`);
```

### Example Output

```
Signal Strength: 85/100
Classification: critical
Reasoning: Critical signal: Reuters, Critical keywords detected, Just happened
Factors:
  - Source Credibility: Reuters (90 × 0.25 = 22.5)
  - Keyword Relevance: "carrier" detected (95 × 0.20 = 19.0)
  - Recency: <1 hour old (100 × 0.15 = 15.0)
  - Geographic Relevance: Taiwan Strait (90 × 0.10 = 9.0)
  - User Interest: High interest topic (80 × 0.10 = 8.0)
```

### Learning from User Behavior

The classifier adapts based on your actions:
- **Save** an item → Similar items score higher
- **Dismiss** an item → Similar items score lower
- **Flag** an item → Critical signals prioritized

```typescript
import { updateModelFromFeedback } from '$lib/utils/signal-classifier';

const feedback: UserFeedback[] = [
  { itemId: 'news-123', action: 'save', timestamp: '...' },
  { itemId: 'news-456', action: 'dismiss', timestamp: '...' }
];

const updatedModel = updateModelFromFeedback(feedback);
// Model thresholds automatically adjust
```

---

## 4. Network Graph Visualization 🌐

### What It Does
Visualize relationships between entities (events, ships, locations, topics) as an interactive force-directed graph.

### Features
- **Node types:** Events, Entities, Locations, People, Organizations, Ships, Markets, Topics
- **Edge types:** Correlates, Causes, Related, Mentions, Participates, Affects
- **Force-directed layout** - Nodes naturally cluster by relationships
- **Interactive** - Hover for details, click to select
- **Importance-based sizing** - Critical nodes appear larger
- **Cluster detection** - Automatically groups related nodes
- **Color-coded** - Events (red), Ships (cyan), Locations (green), Topics (indigo)

### Usage

```typescript
import { buildGraphFromNews, buildGraphFromShips, mergeGraphs } from '$lib/utils/network-graph';
import NetworkGraphView from '$lib/components/common/NetworkGraphView.svelte';

// Build graph from news
const newsGraph = buildGraphFromNews(newsItems);

// Build graph from military ships
const shipGraph = buildGraphFromShips(detectedShips);

// Merge multiple graphs
const combinedGraph = mergeGraphs(newsGraph, shipGraph);

// Filter graph
const filtered = filterGraph(combinedGraph, {
  nodeTypes: ['event', 'ship', 'location'],
  minImportance: 0.5,
  maxNodes: 50
});
```

### Component

```svelte
<script>
  import NetworkGraphView from '$lib/components/common/NetworkGraphView.svelte';
  import { buildGraphFromNews } from '$lib/utils/network-graph';

  let graph = buildGraphFromNews(newsItems);
</script>

<NetworkGraphView {graph} width={800} height={600} />
```

### Graph Analysis

```typescript
import { 
  detectClusters, 
  getNodeDegrees,
  getMostConnectedNodes 
} from '$lib/utils/network-graph';

// Find clusters
const clusters = detectClusters(graph);
console.log(`Found ${clusters.length} clusters`);

// Get node connection counts
const degrees = getNodeDegrees(graph);

// Find most connected nodes (hub analysis)
const hubs = getMostConnectedNodes(graph, 10);
console.log('Top hubs:', hubs.map(n => n.label));
```

### Example Graph

```
Nodes:
  - event-123: "US carrier enters Taiwan Strait" (importance: 0.9)
  - ship-USS-Ronald-Reagan: "USS Ronald Reagan" (importance: 0.95)
  - location-taiwan-strait: "Taiwan Strait" (importance: 0.85)
  - topic-military: "Military" (importance: 0.7)

Edges:
  - event-123 → ship-USS-Ronald-Reagan (type: mentions, strength: 1.0)
  - event-123 → location-taiwan-strait (type: mentions, strength: 0.9)
  - ship-USS-Ronald-Reagan → location-taiwan-strait (type: related, strength: 0.8)
```

### Export Options

```typescript
import { exportGraphAsJSON, exportGraphAsDOT } from '$lib/utils/network-graph';

// Export as JSON
const json = exportGraphAsJSON(graph);
downloadFile('network.json', json);

// Export as DOT (Graphviz)
const dot = exportGraphAsDOT(graph);
downloadFile('network.dot', dot);
```

---

## Integration Examples

### Complete Workflow

```typescript
// 1. Fetch news
const newsItems = await fetchNews();

// 2. Classify signals
const scores = newsItems.map(item => classifyNewsItem(item));

// 3. Filter critical signals only
const criticalNews = filterBySignal(newsItems, scores, 80);

// 4. Build network graph
const graph = buildGraphFromNews(criticalNews);

// 5. Detect formations
const formations = detectFormations(criticalNews);

// 6. Check active scenarios
const scenarios = loadScenarios().filter(s => s.status === 'active');

const updated = scenarios.map(scenario => 
  evaluateScenarioTriggers(scenario, {
    militaryShips: detectedShips,
    news: criticalNews
  })
);

// 7. Alert if scenario probability high
updated.forEach(scenario => {
  const probability = calculateScenarioProbability(scenario);
  if (probability > 0.7) {
    alert(`⚠️ Scenario "${scenario.name}" is ${Math.round(probability * 100)}% likely!`);
  }
});
```

### Command Palette Integration

```typescript
const advancedCommands: Command[] = [
  {
    id: 'scenario-taiwan',
    label: 'Activate Taiwan Invasion Scenario',
    category: 'action',
    icon: '⚔️',
    keywords: ['scenario', 'taiwan', 'china'],
    action: () => openScenarioBuilder('taiwan-invasion'),
    available: true
  },
  {
    id: 'view-graph',
    label: 'Show Network Graph',
    category: 'view',
    icon: '🌐',
    keywords: ['graph', 'network', 'relationships'],
    action: () => toggleNetworkGraph(),
    available: true
  },
  {
    id: 'filter-critical-signals',
    label: 'Filter Critical Signals Only',
    category: 'filter',
    icon: '🚨',
    keywords: ['filter', 'signal', 'critical'],
    action: () => setSignalThreshold(80),
    available: true
  }
];
```

---

## API Reference

### Scenario Builder

| Function | Purpose | Returns |
|----------|---------|---------|
| `createScenario(template)` | Create from template | `Scenario` |
| `evaluateScenarioTriggers(scenario, data)` | Check trigger conditions | `Scenario` |
| `calculateScenarioProbability(scenario)` | Get likelihood score | `number` (0-1) |
| `getImpactSummary(scenario)` | Summarize impacts | `ImpactSummary` |
| `getMostSimilarHistoricalEvent(scenario)` | Find closest historical match | `HistoricalComparison` |
| `exportScenarioAsMarkdown(scenario)` | Export as MD file | `string` |

### Signal Classifier

| Function | Purpose | Returns |
|----------|---------|---------|
| `classifyNewsItem(item, feedback?)` | Score news item | `SignalScore` |
| `filterBySignal(items, scores, minStrength)` | Filter by threshold | `T[]` |
| `getClassificationStats(scores)` | Get stats | `Stats` |
| `updateModelFromFeedback(feedback)` | Adapt model | `ClassifierModel` |

### Network Graph

| Function | Purpose | Returns |
|----------|---------|---------|
| `buildGraphFromNews(items)` | Build from news | `NetworkGraph` |
| `buildGraphFromShips(ships)` | Build from ships | `NetworkGraph` |
| `mergeGraphs(...graphs)` | Combine graphs | `NetworkGraph` |
| `filterGraph(graph, query)` | Filter nodes/edges | `NetworkGraph` |
| `detectClusters(graph)` | Find communities | `GraphCluster[]` |
| `getNodeDegrees(graph)` | Count connections | `Map<string, number>` |
| `getMostConnectedNodes(graph, limit)` | Find hubs | `GraphNode[]` |
| `exportGraphAsJSON(graph)` | Export as JSON | `string` |
| `exportGraphAsDOT(graph)` | Export for Graphviz | `string` |

---

## Performance Considerations

- **Signal Classifier:** Very fast, can run on every update
- **Network Graph:** O(n²) force simulation - limit to <200 nodes for smooth 60fps
- **Scenario Builder:** Lightweight - can evaluate triggers frequently
- **Command Palette:** Instant - fuzzy search is fast even with 100s of commands

---

## Future Enhancements

Potential additions:
- **Scenario Builder:** Multi-step triggers, automated scenario activation, PDF export
- **Command Palette:** Voice commands, AI-powered suggestions
- **Signal Classifier:** Deep learning model, sentiment analysis integration
- **Network Graph:** 3D visualization, temporal evolution, path finding

---

## Testing

```bash
# Run TypeScript type checking
npm run check

# Run unit tests
npm test

# Build for production
npm run build
```

---

## Files Added

```
src/lib/types/intelligence.ts                        # New type definitions
src/lib/utils/scenario-builder.ts                   # Scenario logic
src/lib/utils/signal-classifier.ts                  # Classification engine
src/lib/utils/network-graph.ts                      # Graph building
src/lib/components/common/CommandPalette.svelte     # Cmd+K palette
src/lib/components/common/NetworkGraphView.svelte   # Graph visualization
src/lib/components/modals/ScenarioBuilderModal.svelte  # Scenario UI
```

---

*Documentation generated: 2026-01-28*
