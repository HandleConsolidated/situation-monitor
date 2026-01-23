# Weather Radar & Storm Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add animated radar playback, tropical cyclone forecast tracks, and severe weather convective outlooks to the globe visualization.

**Architecture:** Extend the existing RainViewer integration with animation controls, add NHC tropical cyclone data from NOAA ArcGIS REST services, and integrate SPC convective outlook polygons. All data sources are free, public NOAA APIs requiring no authentication.

**Tech Stack:** Mapbox GL JS, RainViewer API (existing), NOAA NCEP ArcGIS REST (GeoJSON), SPC MapServices (GeoJSON), Svelte 5 runes

---

## Part 1: Animated Radar Playback

### Task 1: Create Radar Animation Types

**Files:**
- Create: `src/lib/types/radar.ts`
- Test: `src/lib/types/radar.test.ts` (type validation only)

**Step 1: Write the type definitions**

```typescript
// src/lib/types/radar.ts

/**
 * Radar animation frame from RainViewer
 */
export interface RadarFrame {
	timestamp: number;
	path: string;
	tileUrl: string;
	type: 'past' | 'nowcast';
}

/**
 * Complete radar animation data
 */
export interface RadarAnimationData {
	frames: RadarFrame[];
	currentIndex: number;
	isPlaying: boolean;
	playbackSpeed: number; // frames per second
	host: string;
}

/**
 * Radar animation controls
 */
export interface RadarAnimationControls {
	play: () => void;
	pause: () => void;
	stepForward: () => void;
	stepBackward: () => void;
	goToFrame: (index: number) => void;
	setSpeed: (fps: number) => void;
}
```

**Step 2: Commit**

```bash
git add src/lib/types/radar.ts
git commit -m "feat(weather): add radar animation types"
```

---

### Task 2: Extend RainViewer API to Return All Frames

**Files:**
- Modify: `src/lib/api/misc.ts` (add new function after existing RainViewer code ~line 2869)
- Test: `src/lib/api/misc.test.ts` (create if doesn't exist)

**Step 1: Write the failing test**

```typescript
// Add to misc.test.ts or create new file
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRadarAnimationData } from './misc';

describe('fetchRadarAnimationData', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('should return all past and nowcast frames with tile URLs', async () => {
		const mockData = {
			version: '2.0',
			generated: 1706000000,
			host: 'https://tilecache.rainviewer.com',
			radar: {
				past: [
					{ time: 1706000000, path: '/v2/radar/1706000000' },
					{ time: 1706000600, path: '/v2/radar/1706000600' }
				],
				nowcast: [
					{ time: 1706001200, path: '/v2/radar/1706001200' }
				]
			}
		};

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockData)
		});

		const result = await fetchRadarAnimationData();

		expect(result).not.toBeNull();
		expect(result!.frames).toHaveLength(3);
		expect(result!.frames[0].type).toBe('past');
		expect(result!.frames[2].type).toBe('nowcast');
		expect(result!.frames[0].tileUrl).toContain('256/{z}/{x}/{y}');
	});

	it('should return null when API fails', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

		const result = await fetchRadarAnimationData();

		expect(result).toBeNull();
	});
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run misc.test.ts`
Expected: FAIL with "fetchRadarAnimationData is not exported"

**Step 3: Write minimal implementation**

Add after `getLatestRadarTileUrl` function in `src/lib/api/misc.ts`:

```typescript
/**
 * Fetch all radar frames for animation (past + nowcast)
 * Returns frames with pre-built tile URLs for Mapbox
 */
export async function fetchRadarAnimationData(): Promise<RadarAnimationData | null> {
	const data = await fetchRainViewerData();

	if (!data || !data.radar.past.length) {
		return null;
	}

	const frames: RadarFrame[] = [];

	// Add past frames
	for (const frame of data.radar.past) {
		frames.push({
			timestamp: frame.time,
			path: frame.path,
			tileUrl: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_0.png`,
			type: 'past'
		});
	}

	// Add nowcast (forecast) frames
	for (const frame of data.radar.nowcast) {
		frames.push({
			timestamp: frame.time,
			path: frame.path,
			tileUrl: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_0.png`,
			type: 'nowcast'
		});
	}

	return {
		frames,
		currentIndex: frames.length - 1, // Start at most recent
		isPlaying: false,
		playbackSpeed: 1, // 1 fps default
		host: data.host
	};
}
```

Also add imports at top of file:

```typescript
import type { RadarFrame, RadarAnimationData } from '$lib/types/radar';
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run misc.test.ts`
Expected: PASS

**Step 5: Update exports in index.ts**

Add to `src/lib/api/index.ts`:

```typescript
export { fetchRadarAnimationData } from './misc';
export type { RadarFrame, RadarAnimationData } from '$lib/types/radar';
```

**Step 6: Commit**

```bash
git add src/lib/api/misc.ts src/lib/api/misc.test.ts src/lib/api/index.ts src/lib/types/radar.ts
git commit -m "feat(weather): add radar animation data fetching"
```

---

### Task 3: Add Radar Animation UI to Globe

**Files:**
- Modify: `src/lib/components/panels/MapboxGlobePanel.svelte`

**Step 1: Add animation state variables**

Find the weather radar state section (~line 201-204) and extend:

```typescript
// Weather radar overlay state
let weatherRadarVisible = $state(false);
let weatherRadarTileUrl = $state<string | null>(null);
let weatherRadarLoading = $state(false);

// Radar animation state (new)
let radarAnimationData = $state<RadarAnimationData | null>(null);
let radarAnimationPlaying = $state(false);
let radarCurrentFrame = $state(0);
let radarAnimationInterval: ReturnType<typeof setInterval> | null = null;
```

**Step 2: Add animation control functions**

After the `addOrUpdateRadarLayer` function (~line 5427), add:

```typescript
// Start/stop radar animation playback
function toggleRadarAnimation() {
	if (!radarAnimationData) return;

	if (radarAnimationPlaying) {
		// Stop animation
		if (radarAnimationInterval) {
			clearInterval(radarAnimationInterval);
			radarAnimationInterval = null;
		}
		radarAnimationPlaying = false;
	} else {
		// Start animation
		radarAnimationPlaying = true;
		radarAnimationInterval = setInterval(() => {
			if (!radarAnimationData) return;
			radarCurrentFrame = (radarCurrentFrame + 1) % radarAnimationData.frames.length;
			updateRadarFrame(radarCurrentFrame);
		}, 500); // 2 fps
	}
}

// Update map to show specific radar frame
function updateRadarFrame(frameIndex: number) {
	if (!map || !radarAnimationData || !radarAnimationData.frames[frameIndex]) return;

	const frame = radarAnimationData.frames[frameIndex];

	// Update the raster source with new tile URL
	const source = map.getSource('weather-radar') as mapboxgl.RasterSource;
	if (source) {
		// Remove and re-add source with new tiles (Mapbox limitation)
		if (map.getLayer('weather-radar-layer')) {
			map.removeLayer('weather-radar-layer');
		}
		map.removeSource('weather-radar');

		map.addSource('weather-radar', {
			type: 'raster',
			tiles: [frame.tileUrl],
			tileSize: 256
		});

		map.addLayer({
			id: 'weather-radar-layer',
			type: 'raster',
			source: 'weather-radar',
			paint: {
				'raster-opacity': 0.6,
				'raster-fade-duration': 0 // Instant for animation
			}
		});
	}
}

// Step forward/backward one frame
function radarStepForward() {
	if (!radarAnimationData) return;
	radarCurrentFrame = (radarCurrentFrame + 1) % radarAnimationData.frames.length;
	updateRadarFrame(radarCurrentFrame);
}

function radarStepBackward() {
	if (!radarAnimationData) return;
	radarCurrentFrame = (radarCurrentFrame - 1 + radarAnimationData.frames.length) % radarAnimationData.frames.length;
	updateRadarFrame(radarCurrentFrame);
}
```

**Step 3: Update loadWeatherRadar to fetch animation data**

Replace the existing `loadWeatherRadar` function:

```typescript
async function loadWeatherRadar() {
	if (weatherRadarLoading) return;
	weatherRadarLoading = true;
	try {
		// Fetch full animation data instead of just latest frame
		const animData = await fetchRadarAnimationData();
		if (animData && animData.frames.length > 0) {
			radarAnimationData = animData;
			radarCurrentFrame = animData.frames.length - 1; // Most recent
			weatherRadarTileUrl = animData.frames[radarCurrentFrame].tileUrl;

			if (map && isInitialized) {
				addOrUpdateRadarLayer(weatherRadarTileUrl);
			}
		}
	} catch (error) {
		console.warn('Failed to fetch weather radar data:', error);
	} finally {
		weatherRadarLoading = false;
	}
}
```

**Step 4: Add animation controls UI**

Find the weather radar button section (~line 5672-5680) and replace with:

```svelte
<!-- Radar controls group -->
<div class="radar-controls" class:visible={weatherRadarVisible && radarAnimationData}>
	<button
		class="control-btn radar-step-btn"
		onclick={radarStepBackward}
		title="Previous frame"
		disabled={!radarAnimationData}
	>
		<span class="control-icon">⏮</span>
	</button>
	<button
		class="control-btn radar-play-btn"
		class:active={radarAnimationPlaying}
		onclick={toggleRadarAnimation}
		title={radarAnimationPlaying ? 'Pause' : 'Play'}
		disabled={!radarAnimationData}
	>
		<span class="control-icon">{radarAnimationPlaying ? '⏸' : '▶'}</span>
	</button>
	<button
		class="control-btn radar-step-btn"
		onclick={radarStepForward}
		title="Next frame"
		disabled={!radarAnimationData}
	>
		<span class="control-icon">⏭</span>
	</button>
	<div class="radar-timestamp">
		{#if radarAnimationData && radarAnimationData.frames[radarCurrentFrame]}
			{new Date(radarAnimationData.frames[radarCurrentFrame].timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
			{#if radarAnimationData.frames[radarCurrentFrame].type === 'nowcast'}
				<span class="nowcast-badge">FCST</span>
			{/if}
		{/if}
	</div>
</div>
<button
	class="control-btn weather-radar-btn"
	class:active={weatherRadarVisible}
	class:loading={weatherRadarLoading}
	onclick={toggleWeatherRadar}
	title={weatherRadarVisible ? 'Hide weather radar' : 'Show weather radar'}
>
	<span class="control-icon">{weatherRadarLoading ? '...' : '☁'}</span>
</button>
```

**Step 5: Add CSS for animation controls**

Add to the style section:

```css
/* Radar Animation Controls */
.radar-controls {
	display: none;
	align-items: center;
	gap: 2px;
	background: rgb(15 23 42 / 0.8);
	border: 1px solid rgb(51 65 85 / 0.5);
	border-radius: 4px;
	padding: 2px 4px;
}

.radar-controls.visible {
	display: flex;
}

.radar-step-btn,
.radar-play-btn {
	padding: 4px 6px;
	min-width: 24px;
}

.radar-play-btn.active {
	background: rgb(6 78 59 / 0.6);
	border-color: rgb(16 185 129 / 0.6);
	color: rgb(52 211 153);
}

.radar-timestamp {
	font-size: 10px;
	font-family: 'JetBrains Mono', monospace;
	color: rgb(148 163 184);
	padding: 0 6px;
	min-width: 60px;
	text-align: center;
}

.nowcast-badge {
	font-size: 8px;
	background: rgb(59 130 246 / 0.3);
	color: rgb(96 165 250);
	padding: 1px 3px;
	border-radius: 2px;
	margin-left: 4px;
}
```

**Step 6: Clean up animation on component destroy**

Add to the onMount cleanup or create effect:

```typescript
$effect(() => {
	return () => {
		// Cleanup radar animation interval
		if (radarAnimationInterval) {
			clearInterval(radarAnimationInterval);
			radarAnimationInterval = null;
		}
	};
});
```

**Step 7: Commit**

```bash
git add src/lib/components/panels/MapboxGlobePanel.svelte
git commit -m "feat(weather): add animated radar playback with controls"
```

---

## Part 2: Tropical Cyclone Tracks

### Task 4: Create Tropical Cyclone Types

**Files:**
- Create: `src/lib/types/storms.ts`

**Step 1: Write the type definitions**

```typescript
// src/lib/types/storms.ts

/**
 * Tropical cyclone intensity category
 */
export type CycloneCategory =
	| 'TD'  // Tropical Depression
	| 'TS'  // Tropical Storm
	| 'H1'  // Category 1 Hurricane
	| 'H2'  // Category 2 Hurricane
	| 'H3'  // Category 3 Hurricane (Major)
	| 'H4'  // Category 4 Hurricane (Major)
	| 'H5'  // Category 5 Hurricane (Major)
	| 'EX'  // Extratropical
	| 'SD'  // Subtropical Depression
	| 'SS'  // Subtropical Storm
	| 'PTC'; // Post-Tropical Cyclone

/**
 * Single forecast point for a tropical cyclone
 */
export interface CycloneForecastPoint {
	lat: number;
	lon: number;
	forecastHour: number; // 0, 12, 24, 36, 48, 72, 96, 120
	maxWind: number; // knots
	gusts: number | null;
	category: CycloneCategory;
	pressure: number | null; // mb
	validTime: string;
}

/**
 * Tropical cyclone track data
 */
export interface TropicalCyclone {
	id: string;
	name: string;
	basin: 'AL' | 'EP' | 'CP'; // Atlantic, East Pacific, Central Pacific
	stormNumber: number;
	currentPosition: {
		lat: number;
		lon: number;
		validTime: string;
	};
	currentIntensity: {
		maxWind: number;
		gusts: number | null;
		pressure: number | null;
		category: CycloneCategory;
		movement: {
			direction: string;
			speed: number; // mph
		};
	};
	forecastTrack: CycloneForecastPoint[];
	forecastCone: GeoJSON.Geometry | null;
	windRadii: {
		34kt: GeoJSON.Geometry | null;
		50kt: GeoJSON.Geometry | null;
		64kt: GeoJSON.Geometry | null;
	};
	lastUpdate: string;
}

/**
 * Color mapping for cyclone categories
 */
export const CYCLONE_COLORS: Record<CycloneCategory, string> = {
	TD: '#5ebaff',   // Light blue
	TS: '#00faf4',   // Cyan
	H1: '#ffffcc',   // Pale yellow
	H2: '#ffe775',   // Yellow
	H3: '#ffc140',   // Orange
	H4: '#ff8f20',   // Dark orange
	H5: '#ff6060',   // Red
	EX: '#cccccc',   // Gray
	SD: '#8888ff',   // Purple-blue
	SS: '#aa88ff',   // Purple
	PTC: '#888888'   // Dark gray
};
```

**Step 2: Export types**

Add to `src/lib/types/index.ts`:

```typescript
export * from './storms';
```

**Step 3: Commit**

```bash
git add src/lib/types/storms.ts src/lib/types/index.ts
git commit -m "feat(weather): add tropical cyclone types"
```

---

### Task 5: Create NHC API Functions

**Files:**
- Create: `src/lib/api/storms.ts`
- Test: `src/lib/api/storms.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/api/storms.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchActiveTropicalCyclones } from './storms';

describe('fetchActiveTropicalCyclones', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('should fetch and parse active tropical cyclones from NHC', async () => {
		const mockGeoJson = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {
						STORMNAME: 'MILTON',
						STORMNUM: 14,
						BASIN: 'AL',
						LAT: 25.5,
						LON: -85.2,
						MAXWIND: 85,
						GUST: 105,
						MSLP: 970,
						STORMTYPE: 'HU',
						DVLBL: 'H1',
						VALIDTIME: '2024-10-08T12:00:00Z',
						DESSION: 'E',
						SSNUM: 4
					},
					geometry: {
						type: 'Point',
						coordinates: [-85.2, 25.5]
					}
				}
			]
		};

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockGeoJson)
		});

		const result = await fetchActiveTropicalCyclones();

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('MILTON');
		expect(result[0].currentIntensity.category).toBe('H1');
		expect(result[0].basin).toBe('AL');
	});

	it('should return empty array when no active storms', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ type: 'FeatureCollection', features: [] })
		});

		const result = await fetchActiveTropicalCyclones();

		expect(result).toEqual([]);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run storms.test.ts`
Expected: FAIL with "cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/lib/api/storms.ts

/**
 * Tropical Cyclone API functions
 * Fetches from NOAA NCEP ArcGIS REST services
 */

import type { TropicalCyclone, CycloneCategory, CycloneForecastPoint } from '$lib/types/storms';

const NHC_BASE_URL = 'https://idpgis.ncep.noaa.gov/arcgis/rest/services/NWS_Forecasts_Guidance_Warnings';

// Active storm endpoints for each basin
const CYCLONE_ENDPOINTS = {
	atlantic: `${NHC_BASE_URL}/NHC_Atl_trop_cyclones_active/MapServer`,
	eastPacific: `${NHC_BASE_URL}/NHC_E_Pac_trop_cyclones_active/MapServer`
};

// Layer IDs in the MapServer
const LAYERS = {
	forecastPoints: 0,
	forecastTrack: 1,
	forecastCone: 2,
	currentWindExtent: 3
};

/**
 * Convert NHC storm type code to our category
 */
function parseCategory(stormType: string, dvlbl: string): CycloneCategory {
	if (stormType === 'TD' || dvlbl === 'TD') return 'TD';
	if (stormType === 'TS' || dvlbl === 'TS') return 'TS';
	if (dvlbl === 'H1') return 'H1';
	if (dvlbl === 'H2') return 'H2';
	if (dvlbl === 'H3') return 'H3';
	if (dvlbl === 'H4') return 'H4';
	if (dvlbl === 'H5') return 'H5';
	if (stormType === 'EX') return 'EX';
	if (stormType === 'SD') return 'SD';
	if (stormType === 'SS') return 'SS';
	if (stormType === 'PT') return 'PTC';
	return 'TS'; // Default
}

/**
 * Fetch active tropical cyclones from all basins
 */
export async function fetchActiveTropicalCyclones(): Promise<TropicalCyclone[]> {
	const cyclones: TropicalCyclone[] = [];

	// Fetch from both Atlantic and East Pacific
	for (const [basin, baseUrl] of Object.entries(CYCLONE_ENDPOINTS)) {
		try {
			// Query forecast points layer for current positions
			const pointsUrl = `${baseUrl}/${LAYERS.forecastPoints}/query?where=1=1&outFields=*&f=geojson`;

			const response = await fetch(pointsUrl, {
				signal: AbortSignal.timeout(15000)
			});

			if (!response.ok) continue;

			const data = await response.json();

			if (!data.features || data.features.length === 0) continue;

			// Group points by storm
			const stormMap = new Map<string, typeof data.features>();

			for (const feature of data.features) {
				const props = feature.properties;
				const stormId = `${props.BASIN}${props.STORMNUM}`;

				if (!stormMap.has(stormId)) {
					stormMap.set(stormId, []);
				}
				stormMap.get(stormId)!.push(feature);
			}

			// Build cyclone objects
			for (const [stormId, features] of stormMap.entries()) {
				// Find current position (forecast hour 0)
				const currentFeature = features.find((f: { properties: { FHOUR?: number } }) =>
					f.properties.FHOUR === 0 || f.properties.FHOUR === undefined
				) || features[0];

				const props = currentFeature.properties;

				const forecastTrack: CycloneForecastPoint[] = features.map((f: { properties: Record<string, unknown> }) => ({
					lat: f.properties.LAT as number,
					lon: f.properties.LON as number,
					forecastHour: (f.properties.FHOUR as number) || 0,
					maxWind: f.properties.MAXWIND as number,
					gusts: f.properties.GUST as number | null,
					category: parseCategory(f.properties.STORMTYPE as string, f.properties.DVLBL as string),
					pressure: f.properties.MSLP as number | null,
					validTime: f.properties.VALIDTIME as string
				})).sort((a: CycloneForecastPoint, b: CycloneForecastPoint) => a.forecastHour - b.forecastHour);

				const cyclone: TropicalCyclone = {
					id: stormId,
					name: props.STORMNAME || `Storm ${props.STORMNUM}`,
					basin: props.BASIN as 'AL' | 'EP' | 'CP',
					stormNumber: props.STORMNUM,
					currentPosition: {
						lat: props.LAT,
						lon: props.LON,
						validTime: props.VALIDTIME
					},
					currentIntensity: {
						maxWind: props.MAXWIND,
						gusts: props.GUST,
						pressure: props.MSLP,
						category: parseCategory(props.STORMTYPE, props.DVLBL),
						movement: {
							direction: props.DESSION || 'N',
							speed: props.SSNUM || 0
						}
					},
					forecastTrack,
					forecastCone: null, // Fetched separately if needed
					windRadii: {
						'34kt': null,
						'50kt': null,
						'64kt': null
					},
					lastUpdate: props.VALIDTIME
				};

				cyclones.push(cyclone);
			}
		} catch (error) {
			console.warn(`Failed to fetch tropical cyclones for ${basin}:`, error);
		}
	}

	return cyclones;
}

/**
 * Fetch forecast cone geometry for a specific cyclone
 */
export async function fetchCycloneForecastCone(
	basin: 'AL' | 'EP' | 'CP',
	stormNumber: number
): Promise<GeoJSON.Geometry | null> {
	const baseUrl = basin === 'AL' ? CYCLONE_ENDPOINTS.atlantic : CYCLONE_ENDPOINTS.eastPacific;

	try {
		const coneUrl = `${baseUrl}/${LAYERS.forecastCone}/query?where=STORMNUM=${stormNumber}&outFields=*&f=geojson`;

		const response = await fetch(coneUrl, {
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) return null;

		const data = await response.json();

		if (!data.features || data.features.length === 0) return null;

		// Return the first cone geometry
		return data.features[0].geometry;
	} catch (error) {
		console.warn('Failed to fetch cyclone forecast cone:', error);
		return null;
	}
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run storms.test.ts`
Expected: PASS

**Step 5: Export from index**

Add to `src/lib/api/index.ts`:

```typescript
export { fetchActiveTropicalCyclones, fetchCycloneForecastCone } from './storms';
```

**Step 6: Commit**

```bash
git add src/lib/api/storms.ts src/lib/api/storms.test.ts src/lib/api/index.ts
git commit -m "feat(weather): add NHC tropical cyclone API"
```

---

### Task 6: Add Tropical Cyclone Layer to Globe

**Files:**
- Modify: `src/lib/components/panels/MapboxGlobePanel.svelte`

**Step 1: Add cyclone state and imports**

Add imports:

```typescript
import { fetchActiveTropicalCyclones, fetchCycloneForecastCone } from '$lib/api';
import type { TropicalCyclone } from '$lib/types/storms';
import { CYCLONE_COLORS } from '$lib/types/storms';
```

Add state after weather radar state:

```typescript
// Tropical cyclone overlay state
let tropicalCyclonesVisible = $state(false);
let tropicalCyclonesLoading = $state(false);
let activeCyclones = $state<TropicalCyclone[]>([]);
```

**Step 2: Add fetch and layer functions**

```typescript
// Fetch active tropical cyclones
async function loadTropicalCyclones() {
	if (tropicalCyclonesLoading) return;
	tropicalCyclonesLoading = true;

	try {
		const cyclones = await fetchActiveTropicalCyclones();
		activeCyclones = cyclones;

		// Fetch forecast cones for each cyclone
		for (const cyclone of cyclones) {
			const cone = await fetchCycloneForecastCone(cyclone.basin, cyclone.stormNumber);
			if (cone) {
				cyclone.forecastCone = cone;
			}
		}

		if (map && isInitialized) {
			updateCycloneLayers();
		}

		console.log(`[Tropical] Loaded ${cyclones.length} active cyclones`);
	} catch (error) {
		console.warn('Failed to fetch tropical cyclones:', error);
	} finally {
		tropicalCyclonesLoading = false;
	}
}

// Update cyclone visualization layers
function updateCycloneLayers() {
	if (!map) return;

	// Remove existing cyclone layers
	const layerIds = ['cyclone-cones', 'cyclone-tracks', 'cyclone-points', 'cyclone-labels'];
	for (const id of layerIds) {
		if (map.getLayer(id)) map.removeLayer(id);
	}
	if (map.getSource('cyclone-data')) map.removeSource('cyclone-data');
	if (map.getSource('cyclone-cones')) map.removeSource('cyclone-cones');

	if (activeCyclones.length === 0) return;

	// Build GeoJSON for tracks and points
	const trackFeatures: GeoJSON.Feature[] = [];
	const pointFeatures: GeoJSON.Feature[] = [];
	const coneFeatures: GeoJSON.Feature[] = [];

	for (const cyclone of activeCyclones) {
		// Forecast track line
		if (cyclone.forecastTrack.length > 1) {
			trackFeatures.push({
				type: 'Feature',
				properties: {
					id: cyclone.id,
					name: cyclone.name,
					category: cyclone.currentIntensity.category
				},
				geometry: {
					type: 'LineString',
					coordinates: cyclone.forecastTrack.map(p => [p.lon, p.lat])
				}
			});
		}

		// Forecast points
		for (const point of cyclone.forecastTrack) {
			pointFeatures.push({
				type: 'Feature',
				properties: {
					id: cyclone.id,
					name: cyclone.name,
					hour: point.forecastHour,
					wind: point.maxWind,
					category: point.category,
					color: CYCLONE_COLORS[point.category]
				},
				geometry: {
					type: 'Point',
					coordinates: [point.lon, point.lat]
				}
			});
		}

		// Forecast cone
		if (cyclone.forecastCone) {
			coneFeatures.push({
				type: 'Feature',
				properties: {
					id: cyclone.id,
					name: cyclone.name
				},
				geometry: cyclone.forecastCone
			});
		}
	}

	// Add cone source and layer
	if (coneFeatures.length > 0) {
		map.addSource('cyclone-cones', {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: coneFeatures }
		});

		map.addLayer({
			id: 'cyclone-cones',
			type: 'fill',
			source: 'cyclone-cones',
			paint: {
				'fill-color': 'rgba(255, 255, 255, 0.15)',
				'fill-outline-color': 'rgba(255, 255, 255, 0.5)'
			}
		});
	}

	// Add track/point source
	map.addSource('cyclone-data', {
		type: 'geojson',
		data: { type: 'FeatureCollection', features: [...trackFeatures, ...pointFeatures] }
	});

	// Track lines
	map.addLayer({
		id: 'cyclone-tracks',
		type: 'line',
		source: 'cyclone-data',
		filter: ['==', '$type', 'LineString'],
		paint: {
			'line-color': '#ffffff',
			'line-width': 2,
			'line-dasharray': [2, 2]
		}
	});

	// Forecast points
	map.addLayer({
		id: 'cyclone-points',
		type: 'circle',
		source: 'cyclone-data',
		filter: ['==', '$type', 'Point'],
		paint: {
			'circle-radius': ['case', ['==', ['get', 'hour'], 0], 10, 6],
			'circle-color': ['get', 'color'],
			'circle-stroke-color': '#000000',
			'circle-stroke-width': 1
		}
	});

	// Labels for current positions
	map.addLayer({
		id: 'cyclone-labels',
		type: 'symbol',
		source: 'cyclone-data',
		filter: ['all', ['==', '$type', 'Point'], ['==', ['get', 'hour'], 0]],
		layout: {
			'text-field': ['get', 'name'],
			'text-size': 12,
			'text-offset': [0, 1.5],
			'text-anchor': 'top'
		},
		paint: {
			'text-color': '#ffffff',
			'text-halo-color': '#000000',
			'text-halo-width': 1
		}
	});
}

// Toggle cyclone visibility
function toggleTropicalCyclones() {
	tropicalCyclonesVisible = !tropicalCyclonesVisible;

	if (tropicalCyclonesVisible && activeCyclones.length === 0) {
		loadTropicalCyclones();
	}

	// Toggle layer visibility
	const layerIds = ['cyclone-cones', 'cyclone-tracks', 'cyclone-points', 'cyclone-labels'];
	for (const id of layerIds) {
		if (map?.getLayer(id)) {
			map.setLayoutProperty(id, 'visibility', tropicalCyclonesVisible ? 'visible' : 'none');
		}
	}
}
```

**Step 3: Add hover interaction for cyclones**

Add after other hover handlers:

```typescript
// Cyclone hover
map.on('mousemove', 'cyclone-points', (e) => {
	if (!e.features || e.features.length === 0 || tooltipLocked || !map) return;

	const feature = e.features[0];
	const props = feature.properties;

	map.getCanvas().style.cursor = 'pointer';

	const isCurrentPos = props?.hour === 0;
	tooltipData = {
		label: `${isCurrentPos ? '🌀 ' : ''}${props?.name || 'Storm'}`,
		type: 'cyclone',
		desc: `${props?.category || 'TS'} - ${props?.wind || '?'} kt${props?.hour > 0 ? ` (+${props.hour}h forecast)` : ' (current)'}`,
		level: props?.category?.startsWith('H') && parseInt(props.category.slice(1)) >= 3 ? 'critical' : 'elevated'
	};
	tooltipVisible = true;
	updateTooltipPosition(e.point);
	pauseRotation();
});

map.on('mouseleave', 'cyclone-points', () => {
	if (tooltipLocked || !map) return;
	map.getCanvas().style.cursor = '';
	tooltipVisible = false;
	tooltipData = null;
	resumeRotation();
});
```

**Step 4: Add UI button**

Add after weather alerts button:

```svelte
<button
	class="control-btn cyclone-btn"
	class:active={tropicalCyclonesVisible}
	class:loading={tropicalCyclonesLoading}
	onclick={toggleTropicalCyclones}
	title={tropicalCyclonesVisible ? 'Hide tropical cyclones' : 'Show tropical cyclones'}
>
	<span class="control-icon">{tropicalCyclonesLoading ? '...' : '🌀'}</span>
</button>
```

**Step 5: Add CSS**

```css
/* Cyclone Button */
.cyclone-btn.active {
	background: rgb(127 29 29 / 0.6);
	border-color: rgb(239 68 68 / 0.6);
	color: rgb(252 165 165);
}

.cyclone-btn:hover {
	border-color: rgb(239 68 68 / 0.5);
	color: rgb(252 165 165);
}

.cyclone-btn.loading {
	opacity: 0.7;
	cursor: wait;
}
```

**Step 6: Commit**

```bash
git add src/lib/components/panels/MapboxGlobePanel.svelte
git commit -m "feat(weather): add tropical cyclone track visualization"
```

---

## Part 3: SPC Convective Outlooks

### Task 7: Create SPC Convective Outlook Types

**Files:**
- Modify: `src/lib/types/storms.ts`

**Step 1: Add convective outlook types**

Append to `src/lib/types/storms.ts`:

```typescript
/**
 * SPC Convective Outlook risk levels
 */
export type ConvectiveRisk =
	| 'TSTM'  // General thunderstorms
	| 'MRGL'  // Marginal risk
	| 'SLGT'  // Slight risk
	| 'ENH'   // Enhanced risk
	| 'MDT'   // Moderate risk
	| 'HIGH'; // High risk

/**
 * Convective outlook polygon
 */
export interface ConvectiveOutlook {
	day: 1 | 2 | 3;
	type: 'categorical' | 'tornado' | 'hail' | 'wind';
	risk: ConvectiveRisk;
	geometry: GeoJSON.Geometry;
	validTime: string;
	isSignificant: boolean;
}

/**
 * Color mapping for convective risks
 */
export const CONVECTIVE_COLORS: Record<ConvectiveRisk, string> = {
	TSTM: '#c0e8c0', // Light green
	MRGL: '#66c57c', // Dark green
	SLGT: '#f6f67f', // Yellow
	ENH: '#e6c27c', // Orange
	MDT: '#e67c7c', // Red
	HIGH: '#ff66ff'  // Magenta
};
```

**Step 2: Commit**

```bash
git add src/lib/types/storms.ts
git commit -m "feat(weather): add SPC convective outlook types"
```

---

### Task 8: Create SPC API Functions

**Files:**
- Modify: `src/lib/api/storms.ts`
- Test: `src/lib/api/storms.test.ts`

**Step 1: Write the failing test**

Add to `storms.test.ts`:

```typescript
import { fetchConvectiveOutlooks } from './storms';

describe('fetchConvectiveOutlooks', () => {
	it('should fetch Day 1 categorical outlook polygons', async () => {
		const mockGeoJson = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {
						LABEL: 'SLGT',
						LABEL2: 'Slight',
						VALID: '202401221200',
						EXPIRE: '202401231200',
						ISSUE: '202401220600'
					},
					geometry: {
						type: 'Polygon',
						coordinates: [[[-100, 35], [-95, 35], [-95, 40], [-100, 40], [-100, 35]]]
					}
				}
			]
		};

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockGeoJson)
		});

		const result = await fetchConvectiveOutlooks(1, 'categorical');

		expect(result).toHaveLength(1);
		expect(result[0].risk).toBe('SLGT');
		expect(result[0].day).toBe(1);
		expect(result[0].type).toBe('categorical');
	});
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run storms.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Add to `src/lib/api/storms.ts`:

```typescript
import type { ConvectiveOutlook, ConvectiveRisk } from '$lib/types/storms';

const SPC_BASE_URL = 'https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer';

// Layer IDs for SPC convective outlooks
const SPC_LAYERS = {
	day1: {
		categorical: 1,
		tornado: 3,
		hail: 5,
		wind: 7,
		sigTornado: 2,
		sigHail: 4,
		sigWind: 6
	},
	day2: {
		categorical: 9,
		tornado: 11,
		hail: 13,
		wind: 15,
		sigTornado: 10,
		sigHail: 12,
		sigWind: 14
	},
	day3: {
		categorical: 17,
		probabilistic: 19,
		significant: 18
	}
};

/**
 * Parse SPC risk label to our type
 */
function parseConvectiveRisk(label: string): ConvectiveRisk {
	const upper = label.toUpperCase();
	if (upper.includes('HIGH')) return 'HIGH';
	if (upper.includes('MDT') || upper.includes('MODERATE')) return 'MDT';
	if (upper.includes('ENH') || upper.includes('ENHANCED')) return 'ENH';
	if (upper.includes('SLGT') || upper.includes('SLIGHT')) return 'SLGT';
	if (upper.includes('MRGL') || upper.includes('MARGINAL')) return 'MRGL';
	return 'TSTM';
}

/**
 * Fetch SPC convective outlooks for a given day and type
 */
export async function fetchConvectiveOutlooks(
	day: 1 | 2 | 3,
	type: 'categorical' | 'tornado' | 'hail' | 'wind' = 'categorical'
): Promise<ConvectiveOutlook[]> {
	const outlooks: ConvectiveOutlook[] = [];

	// Get layer ID
	let layerId: number;
	if (day === 3) {
		layerId = type === 'categorical' ? SPC_LAYERS.day3.categorical : SPC_LAYERS.day3.probabilistic;
	} else {
		const dayLayers = day === 1 ? SPC_LAYERS.day1 : SPC_LAYERS.day2;
		layerId = dayLayers[type as keyof typeof dayLayers] as number;
	}

	try {
		const url = `${SPC_BASE_URL}/${layerId}/query?where=1=1&outFields=*&f=geojson`;

		const response = await fetch(url, {
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) return [];

		const data = await response.json();

		if (!data.features) return [];

		for (const feature of data.features) {
			const props = feature.properties;

			outlooks.push({
				day,
				type,
				risk: parseConvectiveRisk(props.LABEL || props.LABEL2 || 'TSTM'),
				geometry: feature.geometry,
				validTime: props.VALID || props.ISSUE || '',
				isSignificant: (props.LABEL || '').toUpperCase().includes('SIG')
			});
		}
	} catch (error) {
		console.warn(`Failed to fetch SPC ${type} outlook for day ${day}:`, error);
	}

	return outlooks;
}

/**
 * Fetch all Day 1 convective outlooks (categorical + hazards)
 */
export async function fetchAllDay1Outlooks(): Promise<ConvectiveOutlook[]> {
	const [categorical, tornado, hail, wind] = await Promise.all([
		fetchConvectiveOutlooks(1, 'categorical'),
		fetchConvectiveOutlooks(1, 'tornado'),
		fetchConvectiveOutlooks(1, 'hail'),
		fetchConvectiveOutlooks(1, 'wind')
	]);

	return [...categorical, ...tornado, ...hail, ...wind];
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run storms.test.ts`
Expected: PASS

**Step 5: Export functions**

Add to `src/lib/api/index.ts`:

```typescript
export { fetchConvectiveOutlooks, fetchAllDay1Outlooks } from './storms';
```

**Step 6: Commit**

```bash
git add src/lib/api/storms.ts src/lib/api/storms.test.ts src/lib/api/index.ts
git commit -m "feat(weather): add SPC convective outlook API"
```

---

### Task 9: Add Convective Outlook Layer to Globe

**Files:**
- Modify: `src/lib/components/panels/MapboxGlobePanel.svelte`

**Step 1: Add state and imports**

```typescript
import { fetchAllDay1Outlooks } from '$lib/api';
import type { ConvectiveOutlook } from '$lib/types/storms';
import { CONVECTIVE_COLORS } from '$lib/types/storms';

// Convective outlook state
let convectiveOutlooksVisible = $state(false);
let convectiveOutlooksLoading = $state(false);
let convectiveOutlooks = $state<ConvectiveOutlook[]>([]);
```

**Step 2: Add layer functions**

```typescript
// Fetch convective outlooks
async function loadConvectiveOutlooks() {
	if (convectiveOutlooksLoading) return;
	convectiveOutlooksLoading = true;

	try {
		const outlooks = await fetchAllDay1Outlooks();
		convectiveOutlooks = outlooks;

		if (map && isInitialized) {
			updateConvectiveLayer();
		}

		console.log(`[SPC] Loaded ${outlooks.length} convective outlook polygons`);
	} catch (error) {
		console.warn('Failed to fetch convective outlooks:', error);
	} finally {
		convectiveOutlooksLoading = false;
	}
}

// Update convective outlook layer
function updateConvectiveLayer() {
	if (!map) return;

	// Remove existing
	if (map.getLayer('convective-fill')) map.removeLayer('convective-fill');
	if (map.getLayer('convective-outline')) map.removeLayer('convective-outline');
	if (map.getSource('convective-outlooks')) map.removeSource('convective-outlooks');

	if (convectiveOutlooks.length === 0) return;

	// Only show categorical outlooks on main layer
	const categoricalOutlooks = convectiveOutlooks.filter(o => o.type === 'categorical');

	const features: GeoJSON.Feature[] = categoricalOutlooks.map(outlook => ({
		type: 'Feature',
		properties: {
			risk: outlook.risk,
			color: CONVECTIVE_COLORS[outlook.risk],
			day: outlook.day
		},
		geometry: outlook.geometry
	}));

	map.addSource('convective-outlooks', {
		type: 'geojson',
		data: { type: 'FeatureCollection', features }
	});

	// Fill layer
	map.addLayer({
		id: 'convective-fill',
		type: 'fill',
		source: 'convective-outlooks',
		paint: {
			'fill-color': ['get', 'color'],
			'fill-opacity': 0.3
		}
	});

	// Outline
	map.addLayer({
		id: 'convective-outline',
		type: 'line',
		source: 'convective-outlooks',
		paint: {
			'line-color': ['get', 'color'],
			'line-width': 2
		}
	});
}

// Toggle visibility
function toggleConvectiveOutlooks() {
	convectiveOutlooksVisible = !convectiveOutlooksVisible;

	if (convectiveOutlooksVisible && convectiveOutlooks.length === 0) {
		loadConvectiveOutlooks();
	}

	for (const id of ['convective-fill', 'convective-outline']) {
		if (map?.getLayer(id)) {
			map.setLayoutProperty(id, 'visibility', convectiveOutlooksVisible ? 'visible' : 'none');
		}
	}
}
```

**Step 3: Add hover interaction**

```typescript
map.on('mousemove', 'convective-fill', (e) => {
	if (!e.features || e.features.length === 0 || tooltipLocked || !map) return;

	const props = e.features[0].properties;

	map.getCanvas().style.cursor = 'pointer';

	const riskLabels: Record<string, string> = {
		TSTM: 'General Thunderstorms',
		MRGL: 'Marginal Risk',
		SLGT: 'Slight Risk',
		ENH: 'Enhanced Risk',
		MDT: 'Moderate Risk',
		HIGH: 'HIGH RISK'
	};

	tooltipData = {
		label: `⛈ Day ${props?.day || 1} Outlook`,
		type: 'convective',
		desc: riskLabels[props?.risk] || props?.risk || 'Unknown',
		level: props?.risk === 'HIGH' || props?.risk === 'MDT' ? 'critical' :
		       props?.risk === 'ENH' || props?.risk === 'SLGT' ? 'elevated' : 'low'
	};
	tooltipVisible = true;
	updateTooltipPosition(e.point);
	pauseRotation();
});

map.on('mouseleave', 'convective-fill', () => {
	if (tooltipLocked || !map) return;
	map.getCanvas().style.cursor = '';
	tooltipVisible = false;
	tooltipData = null;
	resumeRotation();
});
```

**Step 4: Add UI button**

```svelte
<button
	class="control-btn convective-btn"
	class:active={convectiveOutlooksVisible}
	class:loading={convectiveOutlooksLoading}
	onclick={toggleConvectiveOutlooks}
	title={convectiveOutlooksVisible ? 'Hide storm outlooks' : 'Show storm outlooks'}
>
	<span class="control-icon">{convectiveOutlooksLoading ? '...' : '⛈'}</span>
</button>
```

**Step 5: Add CSS**

```css
/* Convective Button */
.convective-btn.active {
	background: rgb(113 63 18 / 0.6);
	border-color: rgb(245 158 11 / 0.6);
	color: rgb(253 224 71);
}

.convective-btn:hover {
	border-color: rgb(245 158 11 / 0.5);
	color: rgb(253 224 71);
}
```

**Step 6: Commit**

```bash
git add src/lib/components/panels/MapboxGlobePanel.svelte
git commit -m "feat(weather): add SPC convective outlook layer"
```

---

## Part 4: Performance Testing

### Task 10: Create Performance Test Suite

**Files:**
- Create: `src/lib/tests/performance/radar-perf.test.ts`

**Step 1: Create performance test infrastructure**

```typescript
// src/lib/tests/performance/radar-perf.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRadarAnimationData } from '$lib/api/misc';
import { fetchActiveTropicalCyclones, fetchAllDay1Outlooks } from '$lib/api/storms';

/**
 * Performance test utilities
 */
function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
	const start = performance.now();
	return fn().then(result => ({
		result,
		durationMs: performance.now() - start
	}));
}

describe('Weather Data Fetch Performance', () => {
	const TIMEOUT_THRESHOLD_MS = 5000; // 5 seconds max
	const ACCEPTABLE_LATENCY_MS = 2000; // Target under 2 seconds

	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('Radar Animation Data', () => {
		it('should fetch animation data within acceptable latency', async () => {
			// Mock with realistic delay
			global.fetch = vi.fn().mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					ok: true,
					json: () => Promise.resolve({
						version: '2.0',
						generated: Date.now() / 1000,
						host: 'https://tilecache.rainviewer.com',
						radar: {
							past: Array(12).fill(null).map((_, i) => ({
								time: Date.now() / 1000 - (12 - i) * 600,
								path: `/v2/radar/${Date.now() - (12 - i) * 600000}`
							})),
							nowcast: Array(6).fill(null).map((_, i) => ({
								time: Date.now() / 1000 + i * 600,
								path: `/v2/radar/${Date.now() + i * 600000}`
							}))
						}
					})
				}), 100)) // 100ms simulated network latency
			);

			const { durationMs } = await measureTime(() => fetchRadarAnimationData());

			expect(durationMs).toBeLessThan(ACCEPTABLE_LATENCY_MS);
			console.log(`Radar animation fetch: ${durationMs.toFixed(0)}ms`);
		});

		it('should handle 18 frames without memory issues', async () => {
			const mockData = {
				version: '2.0',
				generated: Date.now() / 1000,
				host: 'https://tilecache.rainviewer.com',
				radar: {
					past: Array(12).fill(null).map((_, i) => ({
						time: Date.now() / 1000 - (12 - i) * 600,
						path: `/v2/radar/${i}`
					})),
					nowcast: Array(6).fill(null).map((_, i) => ({
						time: Date.now() / 1000 + i * 600,
						path: `/v2/radar/nowcast_${i}`
					}))
				}
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockData)
			});

			const result = await fetchRadarAnimationData();

			expect(result?.frames).toHaveLength(18);
			// Check memory size is reasonable (< 10KB for frame metadata)
			const jsonSize = JSON.stringify(result).length;
			expect(jsonSize).toBeLessThan(10000);
		});
	});

	describe('Tropical Cyclone Data', () => {
		it('should handle concurrent basin requests efficiently', async () => {
			global.fetch = vi.fn().mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					ok: true,
					json: () => Promise.resolve({ type: 'FeatureCollection', features: [] })
				}), 150))
			);

			const { durationMs } = await measureTime(() => fetchActiveTropicalCyclones());

			// Should fetch both basins in parallel, not sequential
			// 2 requests * 150ms sequential = 300ms, parallel should be ~150ms
			expect(durationMs).toBeLessThan(400); // Allow some overhead
			console.log(`Tropical cyclone fetch: ${durationMs.toFixed(0)}ms`);
		});
	});

	describe('Convective Outlooks', () => {
		it('should fetch all Day 1 outlooks in parallel', async () => {
			global.fetch = vi.fn().mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					ok: true,
					json: () => Promise.resolve({ type: 'FeatureCollection', features: [] })
				}), 100))
			);

			const { durationMs } = await measureTime(() => fetchAllDay1Outlooks());

			// 4 parallel requests @ 100ms each should complete in ~100-200ms, not 400ms
			expect(durationMs).toBeLessThan(300);
			console.log(`Convective outlooks fetch: ${durationMs.toFixed(0)}ms`);
		});
	});

	describe('Memory Efficiency', () => {
		it('should not leak memory on repeated radar frame updates', async () => {
			const mockData = {
				version: '2.0',
				generated: Date.now() / 1000,
				host: 'https://tilecache.rainviewer.com',
				radar: {
					past: [{ time: Date.now() / 1000, path: '/test' }],
					nowcast: []
				}
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockData)
			});

			// Simulate 100 frame updates
			const results: unknown[] = [];
			for (let i = 0; i < 100; i++) {
				results.push(await fetchRadarAnimationData());
			}

			// All should be valid
			expect(results.every(r => r !== null)).toBe(true);

			// Clear references
			results.length = 0;
		});
	});
});
```

**Step 2: Run performance tests**

Run: `npm run test -- --run radar-perf.test.ts`

**Step 3: Commit**

```bash
git add src/lib/tests/performance/radar-perf.test.ts
git commit -m "test(weather): add performance test suite for weather data"
```

---

### Task 11: Create Map Layer Performance Tests

**Files:**
- Create: `src/lib/tests/performance/map-layers-perf.test.ts`

**Step 1: Create layer performance tests**

```typescript
// src/lib/tests/performance/map-layers-perf.test.ts
import { describe, it, expect } from 'vitest';
import type { ConvectiveOutlook, TropicalCyclone } from '$lib/types/storms';
import { CONVECTIVE_COLORS, CYCLONE_COLORS } from '$lib/types/storms';

/**
 * Test GeoJSON generation performance
 */
describe('Map Layer GeoJSON Generation Performance', () => {
	describe('Convective Outlook GeoJSON', () => {
		it('should generate GeoJSON for 20 outlook polygons in under 10ms', () => {
			// Create mock outlooks with complex polygons
			const mockOutlooks: ConvectiveOutlook[] = Array(20).fill(null).map((_, i) => ({
				day: 1 as const,
				type: 'categorical' as const,
				risk: ['TSTM', 'MRGL', 'SLGT', 'ENH', 'MDT'][i % 5] as ConvectiveOutlook['risk'],
				geometry: {
					type: 'Polygon' as const,
					coordinates: [Array(50).fill(null).map((_, j) => [-100 + j * 0.1, 35 + Math.sin(j) * 2])]
				},
				validTime: new Date().toISOString(),
				isSignificant: false
			}));

			const start = performance.now();

			// Simulate GeoJSON generation logic
			const features = mockOutlooks.map(outlook => ({
				type: 'Feature' as const,
				properties: {
					risk: outlook.risk,
					color: CONVECTIVE_COLORS[outlook.risk],
					day: outlook.day
				},
				geometry: outlook.geometry
			}));

			const geojson = { type: 'FeatureCollection' as const, features };

			const duration = performance.now() - start;

			expect(duration).toBeLessThan(10);
			expect(geojson.features).toHaveLength(20);
			console.log(`Convective GeoJSON generation: ${duration.toFixed(2)}ms`);
		});
	});

	describe('Cyclone Track GeoJSON', () => {
		it('should generate GeoJSON for 5 cyclones with 120-hour forecasts in under 10ms', () => {
			// Create mock cyclones with full forecast tracks
			const mockCyclones: Partial<TropicalCyclone>[] = Array(5).fill(null).map((_, i) => ({
				id: `AL${i + 1}`,
				name: `STORM${i + 1}`,
				forecastTrack: [0, 12, 24, 36, 48, 72, 96, 120].map(hour => ({
					lat: 25 + Math.random() * 10,
					lon: -80 + Math.random() * 20,
					forecastHour: hour,
					maxWind: 75 + Math.random() * 50,
					gusts: null,
					category: 'H1' as const,
					pressure: null,
					validTime: new Date().toISOString()
				}))
			}));

			const start = performance.now();

			const trackFeatures: GeoJSON.Feature[] = [];
			const pointFeatures: GeoJSON.Feature[] = [];

			for (const cyclone of mockCyclones) {
				if (cyclone.forecastTrack && cyclone.forecastTrack.length > 1) {
					trackFeatures.push({
						type: 'Feature',
						properties: { id: cyclone.id, name: cyclone.name },
						geometry: {
							type: 'LineString',
							coordinates: cyclone.forecastTrack.map(p => [p.lon, p.lat])
						}
					});

					for (const point of cyclone.forecastTrack) {
						pointFeatures.push({
							type: 'Feature',
							properties: {
								id: cyclone.id,
								hour: point.forecastHour,
								color: CYCLONE_COLORS[point.category]
							},
							geometry: {
								type: 'Point',
								coordinates: [point.lon, point.lat]
							}
						});
					}
				}
			}

			const duration = performance.now() - start;

			expect(duration).toBeLessThan(10);
			expect(trackFeatures).toHaveLength(5);
			expect(pointFeatures).toHaveLength(40); // 5 cyclones * 8 forecast points
			console.log(`Cyclone GeoJSON generation: ${duration.toFixed(2)}ms`);
		});
	});

	describe('Radar Frame Switching', () => {
		it('should prepare tile URL switch in under 1ms', () => {
			const frames = Array(18).fill(null).map((_, i) => ({
				timestamp: Date.now() / 1000 + i * 600,
				path: `/v2/radar/${i}`,
				tileUrl: `https://tilecache.rainviewer.com/v2/radar/${i}/256/{z}/{x}/{y}/2/1_0.png`,
				type: 'past' as const
			}));

			const iterations = 1000;
			const start = performance.now();

			for (let i = 0; i < iterations; i++) {
				const frameIndex = i % frames.length;
				const _newTileUrl = frames[frameIndex].tileUrl;
			}

			const avgDuration = (performance.now() - start) / iterations;

			expect(avgDuration).toBeLessThan(0.1);
			console.log(`Avg frame switch prep: ${(avgDuration * 1000).toFixed(3)}μs`);
		});
	});
});
```

**Step 2: Run tests**

Run: `npm run test -- --run map-layers-perf.test.ts`

**Step 3: Commit**

```bash
git add src/lib/tests/performance/map-layers-perf.test.ts
git commit -m "test(weather): add map layer performance tests"
```

---

## Part 5: Performance Optimization (Based on Test Results)

### Task 12: Optimize Radar Animation Frame Switching

**Files:**
- Modify: `src/lib/components/panels/MapboxGlobePanel.svelte`

**Context:** If performance tests reveal frame switching is slow due to source recreation, implement tile URL switching without source removal.

**Step 1: Implement optimized frame switching**

Replace `updateRadarFrame` with an optimized version that uses multiple pre-created sources:

```typescript
// Pre-create radar sources for smooth animation
const RADAR_SOURCE_COUNT = 2; // Double-buffer
let activeRadarSource = 0;

function initRadarSources() {
	if (!map) return;

	for (let i = 0; i < RADAR_SOURCE_COUNT; i++) {
		const sourceId = `weather-radar-${i}`;
		if (!map.getSource(sourceId)) {
			map.addSource(sourceId, {
				type: 'raster',
				tiles: ['about:blank'], // Placeholder
				tileSize: 256
			});
		}
	}
}

function updateRadarFrameOptimized(frameIndex: number) {
	if (!map || !radarAnimationData || !radarAnimationData.frames[frameIndex]) return;

	const frame = radarAnimationData.frames[frameIndex];
	const nextSourceIndex = (activeRadarSource + 1) % RADAR_SOURCE_COUNT;
	const nextSourceId = `weather-radar-${nextSourceIndex}`;
	const currentLayerId = `weather-radar-layer-${activeRadarSource}`;
	const nextLayerId = `weather-radar-layer-${nextSourceIndex}`;

	// Update the next source with new tiles
	const source = map.getSource(nextSourceId) as mapboxgl.RasterSource;
	if (source) {
		// @ts-expect-error - Mapbox internal method
		source.setTiles([frame.tileUrl]);
	}

	// Create layer if needed
	if (!map.getLayer(nextLayerId)) {
		map.addLayer({
			id: nextLayerId,
			type: 'raster',
			source: nextSourceId,
			paint: {
				'raster-opacity': 0,
				'raster-fade-duration': 0
			}
		});
	}

	// Cross-fade: show next, hide current
	map.setPaintProperty(nextLayerId, 'raster-opacity', 0.6);
	if (map.getLayer(currentLayerId)) {
		map.setPaintProperty(currentLayerId, 'raster-opacity', 0);
	}

	activeRadarSource = nextSourceIndex;
}
```

**Step 2: Commit**

```bash
git add src/lib/components/panels/MapboxGlobePanel.svelte
git commit -m "perf(weather): optimize radar frame switching with double-buffering"
```

---

### Task 13: Add Request Deduplication for Storm Data

**Files:**
- Modify: `src/lib/api/storms.ts`

**Context:** Prevent duplicate API requests when user rapidly toggles layers.

**Step 1: Add request tracking**

```typescript
// Request deduplication
const pendingRequests = new Map<string, Promise<unknown>>();

async function deduplicatedFetch<T>(
	key: string,
	fetcher: () => Promise<T>
): Promise<T> {
	if (pendingRequests.has(key)) {
		return pendingRequests.get(key) as Promise<T>;
	}

	const promise = fetcher().finally(() => {
		pendingRequests.delete(key);
	});

	pendingRequests.set(key, promise);
	return promise;
}

// Update fetchActiveTropicalCyclones to use deduplication
export async function fetchActiveTropicalCyclones(): Promise<TropicalCyclone[]> {
	return deduplicatedFetch('tropical-cyclones', async () => {
		// ... existing implementation
	});
}

// Update fetchAllDay1Outlooks to use deduplication
export async function fetchAllDay1Outlooks(): Promise<ConvectiveOutlook[]> {
	return deduplicatedFetch('day1-outlooks', async () => {
		// ... existing implementation
	});
}
```

**Step 2: Commit**

```bash
git add src/lib/api/storms.ts
git commit -m "perf(weather): add request deduplication for storm data fetching"
```

---

### Task 14: Add Data Caching

**Files:**
- Modify: `src/lib/api/storms.ts`

**Step 1: Implement simple time-based cache**

```typescript
interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
	const entry = cache.get(key) as CacheEntry<T> | undefined;
	if (!entry) return null;

	if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
		cache.delete(key);
		return null;
	}

	return entry.data;
}

function setCache<T>(key: string, data: T): void {
	cache.set(key, { data, timestamp: Date.now() });
}

// Update fetch functions to use cache
export async function fetchActiveTropicalCyclones(): Promise<TropicalCyclone[]> {
	const cached = getCached<TropicalCyclone[]>('tropical-cyclones');
	if (cached) return cached;

	const result = await deduplicatedFetch('tropical-cyclones', async () => {
		// ... fetch logic
	});

	setCache('tropical-cyclones', result);
	return result;
}

// Clear cache function for manual refresh
export function clearStormCache(): void {
	cache.clear();
}
```

**Step 2: Commit**

```bash
git add src/lib/api/storms.ts
git commit -m "perf(weather): add 5-minute cache for storm data"
```

---

### Task 15: Run Full Test Suite & Verify TypeScript

**Step 1: Run all tests**

Run: `npm run test:unit`

**Step 2: Run TypeScript check**

Run: `npm run check`

**Step 3: Fix any errors found**

Address any TypeScript or test failures.

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve test and type errors from weather features"
```

---

### Task 16: Run E2E Tests

**Step 1: Build and preview**

Run: `npm run build && npm run preview`

**Step 2: Run E2E tests**

Run: `npm run test:e2e`

**Step 3: Fix any failures**

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve E2E test issues"
```

---

## Summary

This plan implements:

1. **Animated Radar** (Tasks 1-3): RainViewer past + nowcast frames with playback controls
2. **Tropical Cyclones** (Tasks 4-6): NHC forecast tracks and uncertainty cones from NOAA ArcGIS
3. **Convective Outlooks** (Tasks 7-9): SPC Day 1 categorical and hazard-specific outlooks
4. **Performance Testing** (Tasks 10-11): Latency and memory efficiency tests
5. **Performance Optimization** (Tasks 12-14): Double-buffered radar, request deduplication, caching
6. **Verification** (Tasks 15-16): Full test suite and E2E validation

All data sources are free public NOAA APIs with no authentication required.
