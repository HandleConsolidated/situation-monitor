# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Aegis Situation Monitor** - A real-time intelligence dashboard for monitoring global events, news, markets, and geopolitical situations. Features a 3D interactive globe visualization with tactical military UI aesthetics.

## Development Workflow

When working on a new feature:

1. Create a new branch before making any changes
2. Make all commits on that feature branch
3. Before opening a PR, run the `code-simplifier` agent to clean up the code

## Build & Development Commands

```bash
npm run dev          # Start dev server (localhost:5173)
npm run build        # Build to /build directory
npm run preview      # Preview production build (localhost:4173)
npm run check        # TypeScript type checking
npm run check:watch  # Type checking in watch mode
npm run test         # Run Vitest in watch mode
npm run test:unit    # Run unit tests once
npm run test:e2e     # Run Playwright E2E tests (requires preview server)
npm run lint         # ESLint + Prettier check
npm run format       # Auto-format with Prettier
```

## Technology Stack

- **SvelteKit 2.0** with Svelte 5 reactivity (`$state`, `$derived`, `$effect` runes)
- **TypeScript** (strict mode enabled)
- **Tailwind CSS** with custom dark theme
- **Mapbox GL** for 3D globe visualization
- **Vitest** (unit) + **Playwright** (E2E) for testing
- **Static adapter** - deploys as pure static site to GitHub Pages

## Project Architecture

### Core Directories (`src/lib/`)

```
src/lib/
├── analysis/       # Pattern correlation, narrative tracking, main character detection
├── api/            # Data fetching: GDELT, RSS feeds (30+ sources), markets, crypto, outages
├── components/
│   ├── common/     # Reusable: Panel, Badge, NewsItem, MarketItem, CommodityItem
│   ├── layout/     # Dashboard, Header, PanelGrid
│   ├── modals/     # MonitorModal, SearchModal
│   └── panels/     # 20 data panels + MapboxGlobePanel
├── config/         # Centralized configuration (feeds, keywords, analysis, map hotspots)
├── services/       # Resilience: CacheManager, CircuitBreaker, RequestDeduplicator
├── stores/         # Svelte stores: settings, news, markets, monitors, refresh
└── types/          # TypeScript interfaces
```

### Path Aliases

```typescript
$lib        → src/lib
$components → src/lib/components
$stores     → src/lib/stores
$services   → src/lib/services
$config     → src/lib/config
$types      → src/lib/types
```

## Key Architectural Patterns

### Svelte 5 Runes Usage

This project uses Svelte 5's new reactivity system:

```typescript
// State declaration
let count = $state(0);
let items = $state<Item[]>([]);

// Derived values
const doubled = $derived(count * 2);
const filteredItems = $derived(() => items.filter(i => i.active));

// Effects for side effects
$effect(() => {
    console.log('Count changed:', count);
    return () => cleanup(); // Optional cleanup
});
```

### Service Layer (`src/lib/services/`)

All HTTP requests go through `ServiceClient` which integrates:

- **CacheManager**: Per-service caching with configurable TTL
- **CircuitBreaker**: Prevents cascading failures (5 failures = 30s open)
- **RequestDeduplicator**: Prevents concurrent duplicate requests

```typescript
// Usage
import { services } from '$services';
const data = await services.gdelt.fetch('/api/endpoint');
```

### Multi-Stage Refresh (`src/lib/stores/refresh.ts`)

Data fetches happen in 3 stages with staggered delays:

1. **Critical (0ms)**: News, markets, alerts
2. **Secondary (2s)**: Crypto, commodities, intel
3. **Tertiary (4s)**: Contracts, whales, layoffs, polymarket

### Analysis Engine (`src/lib/analysis/`)

Unique business logic for intelligence analysis:

- **Correlation detection** across disparate news items
- **Narrative tracking** (fringe → mainstream progression)
- **Entity prominence** calculation ("main character" analysis)
- All use configurable regex patterns from `src/lib/config/analysis.ts`

## Globe/Map System (`MapboxGlobePanel.svelte`)

### Data Layers & GeoJSON Sources

| Source | Content |
|--------|---------|
| `points` | Hotspots, chokepoints, cables, nuclear, military, monitors |
| `arcs` | Threat corridor lines between hostile locations |
| `arc-particles` | Animated dots traveling along arcs |
| `pulsing-rings` | Animated rings on critical hotspots |
| `labels` | Text labels for critical/high threat hotspots |
| `news-events` | News activity markers by feed category |
| `outages` | Internet/power outage markers |
| `outage-radius` | Impact radius circles for outages |

### Marker Types & Colors

| Type | Color | Description |
|------|-------|-------------|
| Hotspot (critical) | `#ff0000` | Active crisis zones |
| Hotspot (high) | `#ff4444` | High tension areas |
| Hotspot (elevated) | `#ffcc00` | Elevated concern |
| Hotspot (low) | `#00ff88` | Monitoring only |
| Chokepoint | `#06b6d4` (cyan) | Maritime chokepoints |
| Cable Landing | `#10b981` (emerald) | Undersea cable junctions |
| Nuclear Site | `#f97316` (orange) | Nuclear facilities |
| Military Base | `#3b82f6` (blue) | Military installations |

### Threat Corridor Arcs

Four animated arcs connecting hostile locations:
- Moscow ↔ Kyiv (red)
- Tehran ↔ Tel Aviv (red)
- Beijing ↔ Taipei (amber)
- Pyongyang ↔ Tokyo (amber)

### News Feed Categories

| Category | Color | Content |
|----------|-------|---------|
| Politics | `#ef4444` (red) | Geopolitical news |
| Tech | `#8b5cf6` (purple) | Technology/innovation |
| Finance | `#10b981` (green) | Markets/economy |
| Gov | `#f59e0b` (amber) | Government/policy |
| AI | `#06b6d4` (cyan) | AI/ML developments |
| Intel | `#ec4899` (pink) | Intelligence/security |

## Configuration Files

### `src/lib/config/map.ts`

Contains all geographic data:
- `HOTSPOTS`: 16 geopolitical hotspots with threat levels
- `CHOKEPOINTS`: 7 maritime chokepoints
- `CABLE_LANDINGS`: 20 undersea cable junctions
- `NUCLEAR_SITES`: 18 nuclear facilities
- `MILITARY_BASES`: 22 military installations
- `CONFLICT_ZONES`: 6 active conflict regions
- `OUTAGE_EVENTS`: Fallback outage data
- `HOTSPOT_KEYWORDS`: Keywords for news matching

### `src/lib/config/feeds.ts`

30+ RSS sources across 6 categories:
- Politics, Tech, Finance, Gov, AI, Intel

### `src/lib/config/analysis.ts`

Pattern detection configuration:
- Correlation topics with regex patterns
- Narrative progression tracking
- Severity level mappings

## API Integration

### Outage Data (`src/lib/api/misc.ts`)

Currently fetches from:
- **IODA** (Georgia Tech): Real-time internet outage detection
- **OONI**: Network interference monitoring
- **Internet Society Pulse**: Shutdown tracking

### Market Data

- **CoinGecko**: Cryptocurrency prices
- **Alpha Vantage** (optional): Stock market data
- **Open-Meteo**: Weather data for hotspots

### News Aggregation

- **GDELT API**: Global news events
- **RSS feeds**: Via CORS proxy (Cloudflare Worker)

## Design System Reference

See `design_system.md` for comprehensive UI guidelines:

- **Dark-first**: Near-black backgrounds (#050505)
- **Glass morphism**: `bg-slate-950/80 backdrop-blur-md`
- **Tech corners**: Cyan accent borders on panels
- **Font sizes**: `text-lg` (18px) → `text-[9px]` (9px)
- **Monospace**: For data/timestamps/coordinates

### Semantic Colors

```
Critical: bg-red-950/50 text-red-500 border-red-800/50
Warning:  bg-amber-950/50 text-amber-500 border-amber-800/50
Success:  bg-emerald-950/50 text-emerald-500 border-emerald-800/50
Neutral:  bg-slate-800/50 text-slate-400 border-slate-700/50
```

## Testing

**Unit tests**: Located alongside source as `*.test.ts`
**E2E tests**: In `tests/e2e/*.spec.ts`, run against preview server

Key test file: `src/lib/components/panels/GlobePanel.test.ts`
- Validates hotspot, chokepoint, cable, nuclear, military data
- Tests threat color formats
- Validates arc connections

## Deployment

GitHub Actions workflow builds with `BASE_PATH=/situation-monitor` and deploys to GitHub Pages at `https://hipcityreg.github.io/situation-monitor/`

## Environment Variables

Create `.env` for local development:

```env
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_ALPHA_VANTAGE_KEY=optional_for_stocks
```

## Common Tasks

### Adding a New Panel

1. Create component in `src/lib/components/panels/`
2. Register in `src/lib/config/panels.ts`
3. Add data fetching in appropriate API file
4. Integrate with refresh stages in `src/lib/stores/refresh.ts`

### Adding a New Hotspot

Edit `src/lib/config/map.ts`:
```typescript
export const HOTSPOTS: Hotspot[] = [
    // ... existing
    {
        name: 'Location',
        lat: 0.0,
        lon: 0.0,
        level: 'elevated', // critical | high | elevated | low
        desc: 'Description of significance'
    }
];
```

### Adding News Keywords for Hotspot Matching

Edit `HOTSPOT_KEYWORDS` in `src/lib/config/map.ts`:
```typescript
export const HOTSPOT_KEYWORDS: Record<string, string[]> = {
    'Location': ['keyword1', 'keyword2', 'keyword3']
};
```

## External Dependencies

- **Mapbox GL**: 3D globe visualization (requires token)
- **CORS proxy** (Cloudflare Worker): RSS feed parsing
- **CoinGecko API**: Cryptocurrency data (free tier)
- **USASpending API**: Government contracts
- **IODA/OONI APIs**: Internet outage detection
