<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import {
		HOTSPOTS,
		CHOKEPOINTS,
		CABLE_LANDINGS,
		NUCLEAR_SITES,
		MILITARY_BASES,
		THREAT_COLORS,
		HOTSPOT_KEYWORDS
	} from '$lib/config/map';
	import type { CustomMonitor, NewsItem, NewsCategory } from '$lib/types';

	// Feed category colors for map visualization
	const FEED_COLORS: Record<NewsCategory, string> = {
		politics: '#ef4444', // Red - geopolitical importance
		tech: '#8b5cf6', // Purple - tech/innovation
		finance: '#10b981', // Green - money/markets
		gov: '#f59e0b', // Amber - government/policy
		ai: '#06b6d4', // Cyan - AI/future tech
		intel: '#ec4899' // Pink - intelligence/security
	};

	const FEED_LABELS: Record<NewsCategory, string> = {
		politics: 'Politics Feed',
		tech: 'Tech Feed',
		finance: 'Finance Feed',
		gov: 'Government Feed',
		ai: 'AI Feed',
		intel: 'Intel Feed'
	};

	interface CategorizedNews {
		politics: NewsItem[];
		tech: NewsItem[];
		finance: NewsItem[];
		gov: NewsItem[];
		ai: NewsItem[];
		intel: NewsItem[];
	}

	interface Props {
		monitors?: CustomMonitor[];
		news?: NewsItem[];
		categorizedNews?: CategorizedNews;
	}

	let { monitors = [], news = [], categorizedNews }: Props = $props();

	// Mapbox access token
	const MAPBOX_TOKEN =
		(typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAPBOX_TOKEN) ||
		'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	let isInitialized = $state(false);
	let initError = $state<string | null>(null);
	let legendExpanded = $state(true);
	let dataControlsExpanded = $state(false);

	// Data layer visibility controls
	let dataLayers = $state({
		hotspots: { visible: true, paused: false },
		chokepoints: { visible: true, paused: false },
		cables: { visible: true, paused: false },
		nuclear: { visible: true, paused: false },
		military: { visible: true, paused: false },
		monitors: { visible: true, paused: false },
		news: { visible: true, paused: false },
		arcs: { visible: true, paused: false }
	});

	// Individual feed category visibility
	let feedLayers = $state({
		politics: { visible: true },
		tech: { visible: true },
		finance: { visible: true },
		gov: { visible: true },
		ai: { visible: true },
		intel: { visible: true }
	});

	// News display settings
	let newsTTL = $state(30); // Minutes until news expires from map
	let newsTimeFilter = $state(60); // Only show news from last X minutes
	let showAlertsOnly = $state(false);

	// Interaction state
	let tooltipLocked = $state(false);
	let isRotating = $state(false); // Default to not rotating
	let rotationAnimationId: number | null = null;

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipData = $state<{
		label: string;
		type: string;
		desc?: string;
		level?: string;
		newsCount?: number;
		recentNews?: string[];
		isAlert?: boolean;
		timestamp?: number;
		category?: string;
		categoryLabel?: string;
	} | null>(null);

	// Frozen news data (when paused)
	let frozenNews = $state<NewsItem[]>([]);
	let frozenCategorizedNews = $state<CategorizedNews | null>(null);
	let lastNewsUpdate = $state<number>(Date.now());

	// Get effective news (frozen if paused, otherwise live)
	const effectiveNews = $derived(dataLayers.news.paused ? frozenNews : news);
	const effectiveCategorizedNews = $derived(
		dataLayers.news.paused && frozenCategorizedNews ? frozenCategorizedNews : categorizedNews
	);

	// Filter news by time and alert settings
	const filteredNews = $derived(() => {
		const now = Date.now();
		const cutoffTime = now - newsTimeFilter * 60 * 1000;

		return effectiveNews.filter((item) => {
			if (item.timestamp < cutoffTime) return false;
			if (showAlertsOnly && !item.isAlert) return false;
			return true;
		});
	});

	// Filter categorized news by time, alert settings, and feed visibility
	const filteredCategorizedNews = $derived(() => {
		const now = Date.now();
		const cutoffTime = now - newsTimeFilter * 60 * 1000;

		const filterItems = (items: NewsItem[]) =>
			items.filter((item) => {
				if (item.timestamp < cutoffTime) return false;
				if (showAlertsOnly && !item.isAlert) return false;
				return true;
			});

		if (!effectiveCategorizedNews) return null;

		return {
			politics: feedLayers.politics.visible ? filterItems(effectiveCategorizedNews.politics) : [],
			tech: feedLayers.tech.visible ? filterItems(effectiveCategorizedNews.tech) : [],
			finance: feedLayers.finance.visible ? filterItems(effectiveCategorizedNews.finance) : [],
			gov: feedLayers.gov.visible ? filterItems(effectiveCategorizedNews.gov) : [],
			ai: feedLayers.ai.visible ? filterItems(effectiveCategorizedNews.ai) : [],
			intel: feedLayers.intel.visible ? filterItems(effectiveCategorizedNews.intel) : []
		};
	});

	// Match news items to specific hotspots
	function getNewsForHotspot(hotspotName: string): NewsItem[] {
		const keywords = HOTSPOT_KEYWORDS[hotspotName] || [];
		if (keywords.length === 0) return [];

		return filteredNews().filter((item) => {
			const text = `${item.title} ${item.description || ''}`.toLowerCase();
			return keywords.some((kw) => text.includes(kw.toLowerCase()));
		});
	}

	// Get hotspot activity level based on news
	function getHotspotActivityLevel(
		hotspotName: string,
		baseLevel: string
	): { level: string; newsCount: number; hasAlert: boolean } {
		const hotspotNews = getNewsForHotspot(hotspotName);
		const newsCount = hotspotNews.length;
		const hasAlert = hotspotNews.some((n) => n.isAlert);

		// Escalate level based on news activity
		if (hasAlert && baseLevel !== 'critical') {
			return { level: 'high', newsCount, hasAlert };
		}
		return { level: baseLevel, newsCount, hasAlert };
	}

	// Generate GeoJSON for all points
	function getPointsGeoJSON(): GeoJSON.FeatureCollection {
		const features: GeoJSON.Feature[] = [];

		// Add hotspots (with news integration)
		if (dataLayers.hotspots.visible) {
			HOTSPOTS.forEach((h) => {
				const activity = getHotspotActivityLevel(h.name, h.level);
				const hotspotNews = getNewsForHotspot(h.name);

				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
					properties: {
						label: h.name,
						type: 'hotspot',
						desc: h.desc,
						level: activity.level,
						color: THREAT_COLORS[activity.level as keyof typeof THREAT_COLORS],
						size: activity.level === 'critical' ? 12 : activity.level === 'high' ? 10 : 8,
						newsCount: activity.newsCount,
						hasAlert: activity.hasAlert,
						recentNews: JSON.stringify(hotspotNews.slice(0, 3).map((n) => n.title))
					}
				});
			});
		}

		// Add chokepoints - more muted teal/slate
		if (dataLayers.chokepoints.visible) {
			CHOKEPOINTS.forEach((cp) => {
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [cp.lon, cp.lat] },
					properties: {
						label: cp.name,
						type: 'chokepoint',
						desc: cp.desc,
						color: '#5b8a8a', // Muted teal
						icon: '⚓',
						size: 7
					}
				});
			});
		}

		// Add cable landings - muted blue-gray
		if (dataLayers.cables.visible) {
			CABLE_LANDINGS.forEach((cl) => {
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [cl.lon, cl.lat] },
					properties: {
						label: cl.name,
						type: 'cable',
						desc: cl.desc,
						color: '#6b7a99', // Muted blue-gray
						icon: '📡',
						size: 6
					}
				});
			});
		}

		// Add nuclear sites - muted amber/ochre
		if (dataLayers.nuclear.visible) {
			NUCLEAR_SITES.forEach((ns) => {
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [ns.lon, ns.lat] },
					properties: {
						label: ns.name,
						type: 'nuclear',
						desc: ns.desc,
						color: '#b8860b', // Dark goldenrod / muted amber
						icon: '☢',
						size: 8
					}
				});
			});
		}

		// Add military bases - muted slate/steel
		if (dataLayers.military.visible) {
			MILITARY_BASES.forEach((mb) => {
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [mb.lon, mb.lat] },
					properties: {
						label: mb.name,
						type: 'military',
						desc: mb.desc,
						color: '#708090', // Slate gray
						icon: '🎖',
						size: 8
					}
				});
			});
		}

		// Add custom monitors
		if (dataLayers.monitors.visible) {
			monitors
				.filter((m) => m.enabled && m.location)
				.forEach((m) => {
					if (m.location) {
						features.push({
							type: 'Feature',
							geometry: { type: 'Point', coordinates: [m.location.lon, m.location.lat] },
							properties: {
								label: m.name,
								type: 'monitor',
								desc: `Custom monitor: ${m.keywords?.join(', ') || 'No keywords'}`,
								color: m.color || '#06b6d4',
								size: 9
							}
						});
					}
				});
		}

		return { type: 'FeatureCollection', features };
	}

	// Generate news event markers (legacy - for backward compatibility when categorizedNews not provided)
	function getNewsEventsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.news.visible) {
			return { type: 'FeatureCollection', features: [] };
		}

		// If we have categorized news, use that instead
		if (filteredCategorizedNews()) {
			return getCategorizedNewsGeoJSON();
		}

		const features: GeoJSON.Feature[] = [];
		const now = Date.now();
		const ttlMs = newsTTL * 60 * 1000;

		// Group news by hotspot for clustering
		const hotspotNewsMap = new Map<string, NewsItem[]>();

		filteredNews().forEach((item) => {
			// Find matching hotspot
			for (const [hotspotName, keywords] of Object.entries(HOTSPOT_KEYWORDS)) {
				const text = `${item.title} ${item.description || ''}`.toLowerCase();
				if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
					if (!hotspotNewsMap.has(hotspotName)) {
						hotspotNewsMap.set(hotspotName, []);
					}
					hotspotNewsMap.get(hotspotName)!.push(item);
					break;
				}
			}
		});

		// Create markers for each hotspot with news
		hotspotNewsMap.forEach((newsItems, hotspotName) => {
			const hotspot = HOTSPOTS.find((h) => h.name === hotspotName);
			if (!hotspot) return;

			const hasAlerts = newsItems.some((n) => n.isAlert);
			const age = now - Math.max(...newsItems.map((n) => n.timestamp));
			const opacity = Math.max(0.3, 1 - age / ttlMs);

			features.push({
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [hotspot.lon + 0.5, hotspot.lat + 0.5] // Offset slightly from hotspot
				},
				properties: {
					label: `${newsItems.length} news`,
					type: 'news-cluster',
					count: newsItems.length,
					hasAlerts,
					opacity,
					color: hasAlerts ? '#ef4444' : '#3b82f6',
					size: Math.min(12, 6 + newsItems.length)
				}
			});
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate categorized news markers with distinct colors per feed type
	function getCategorizedNewsGeoJSON(): GeoJSON.FeatureCollection {
		const categorized = filteredCategorizedNews();
		if (!categorized || !dataLayers.news.visible) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = [];
		const now = Date.now();
		const ttlMs = newsTTL * 60 * 1000;

		// Process each category separately
		const categories: NewsCategory[] = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'];

		categories.forEach((category, categoryIndex) => {
			if (!feedLayers[category].visible) return;

			const categoryNews = categorized[category];
			if (!categoryNews || categoryNews.length === 0) return;

			// Group by hotspot
			const hotspotNewsMap = new Map<string, NewsItem[]>();

			categoryNews.forEach((item) => {
				for (const [hotspotName, keywords] of Object.entries(HOTSPOT_KEYWORDS)) {
					const text = `${item.title} ${item.description || ''}`.toLowerCase();
					if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
						if (!hotspotNewsMap.has(hotspotName)) {
							hotspotNewsMap.set(hotspotName, []);
						}
						hotspotNewsMap.get(hotspotName)!.push(item);
						break;
					}
				}
			});

			// Create markers for each hotspot with offset based on category
			hotspotNewsMap.forEach((newsItems, hotspotName) => {
				const hotspot = HOTSPOTS.find((h) => h.name === hotspotName);
				if (!hotspot) return;

				const hasAlerts = newsItems.some((n) => n.isAlert);
				const age = now - Math.max(...newsItems.map((n) => n.timestamp));
				const opacity = Math.max(0.4, 1 - age / ttlMs);

				// Offset markers in a ring pattern around the hotspot
				const angle = (categoryIndex / categories.length) * 2 * Math.PI;
				const offsetDistance = 0.8; // degrees
				const offsetLon = Math.cos(angle) * offsetDistance;
				const offsetLat = Math.sin(angle) * offsetDistance;

				features.push({
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: [hotspot.lon + offsetLon, hotspot.lat + offsetLat]
					},
					properties: {
						label: `${newsItems.length} ${category}`,
						type: 'feed-news',
						category,
						categoryLabel: FEED_LABELS[category],
						count: newsItems.length,
						hasAlerts,
						opacity,
						color: hasAlerts ? '#ef4444' : FEED_COLORS[category],
						size: Math.min(10, 5 + newsItems.length),
						recentNews: JSON.stringify(newsItems.slice(0, 3).map((n) => n.title))
					}
				});
			});
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate arc data for tension corridors with 3D rocket trajectory effect
	function getArcsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.arcs.visible) return { type: 'FeatureCollection', features: [] };

		const arcConnections = [
			{ from: 'Moscow', to: 'Kyiv', color: '#ef4444', glowColor: 'rgba(239, 68, 68, 0.4)' },
			{ from: 'Tehran', to: 'Tel Aviv', color: '#ef4444', glowColor: 'rgba(239, 68, 68, 0.4)' },
			{ from: 'Beijing', to: 'Taipei', color: '#fbbf24', glowColor: 'rgba(251, 191, 36, 0.4)' },
			{ from: 'Pyongyang', to: 'Tokyo', color: '#fbbf24', glowColor: 'rgba(251, 191, 36, 0.4)' }
		];

		const hotspotMap = new Map(HOTSPOTS.map((h) => [h.name, h]));
		const features: GeoJSON.Feature[] = [];

		arcConnections.forEach((conn, index) => {
			const from = hotspotMap.get(conn.from);
			const to = hotspotMap.get(conn.to);
			if (from && to) {
				// Use 40 segments for smooth 3D arc
				const coords = generateArcCoordinates([from.lon, from.lat], [to.lon, to.lat], 40);
				features.push({
					type: 'Feature',
					geometry: { type: 'LineString', coordinates: coords },
					properties: {
						color: conn.color,
						glowColor: conn.glowColor,
						from: conn.from,
						to: conn.to,
						id: index
					}
				});
			}
		});

		return { type: 'FeatureCollection', features };
	}

	/**
	 * Generate 3D arc coordinates that curve outward like a rocket/missile trajectory.
	 * The arc bulges perpendicular to the great circle path, creating a parabolic effect.
	 */
	function generateArcCoordinates(
		start: [number, number],
		end: [number, number],
		segments: number
	): [number, number][] {
		const coords: [number, number][] = [];

		// Calculate perpendicular direction for the arc bulge
		const dx = end[0] - start[0];
		const dy = end[1] - start[1];
		const distance = Math.sqrt(dx * dx + dy * dy);

		// Perpendicular unit vector (rotated 90 degrees)
		// Normalized perpendicular: (-dy/dist, dx/dist)
		const perpX = -dy / distance;
		const perpY = dx / distance;

		// Arc height proportional to distance (gives rocket trajectory feel)
		// Larger distances get higher arcs
		const arcHeight = Math.min(distance * 0.35, 15); // Cap at 15 degrees max bulge

		for (let i = 0; i <= segments; i++) {
			const t = i / segments;

			// Linear interpolation for base position
			const baseLon = start[0] + dx * t;
			const baseLat = start[1] + dy * t;

			// Parabolic arc offset: peaks at t=0.5, zero at t=0 and t=1
			// Using sin curve for smoother, more natural arc shape
			const arcFactor = Math.sin(t * Math.PI);

			// Apply perpendicular offset for the 3D arc effect
			// The arc bulges in the perpendicular direction
			const offsetLon = perpX * arcHeight * arcFactor;
			const offsetLat = perpY * arcHeight * arcFactor;

			coords.push([baseLon + offsetLon, baseLat + offsetLat]);
		}

		return coords;
	}

	// Get pulsing rings (hotspots with alerts or critical level)
	function getPulsingRingsGeoJSON(): GeoJSON.FeatureCollection {
		const features: GeoJSON.Feature[] = [];

		if (dataLayers.hotspots.visible) {
			HOTSPOTS.forEach((h) => {
				const activity = getHotspotActivityLevel(h.name, h.level);
				if (activity.level === 'critical' || activity.hasAlert) {
					features.push({
						type: 'Feature',
						geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
						properties: {
							label: h.name,
							color: activity.hasAlert ? '#ef4444' : THREAT_COLORS[h.level]
						}
					});
				}
			});
		}

		return { type: 'FeatureCollection', features };
	}

	// Get labels for critical/high hotspots
	function getLabelsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.hotspots.visible) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = HOTSPOTS.filter((h) => {
			const activity = getHotspotActivityLevel(h.name, h.level);
			return activity.level === 'critical' || activity.level === 'high';
		}).map((h) => {
			const activity = getHotspotActivityLevel(h.name, h.level);
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
				properties: {
					label: activity.newsCount > 0 ? `${h.name} (${activity.newsCount})` : h.name,
					color: THREAT_COLORS[activity.level as keyof typeof THREAT_COLORS],
					level: activity.level
				}
			};
		});

		return { type: 'FeatureCollection', features };
	}

	function getTypeLabel(type: string, category?: string): string {
		const labels: Record<string, string> = {
			hotspot: 'GEOPOLITICAL HOTSPOT',
			chokepoint: 'SHIPPING CHOKEPOINT',
			cable: 'UNDERSEA CABLE',
			nuclear: 'NUCLEAR SITE',
			military: 'MILITARY BASE',
			monitor: 'CUSTOM MONITOR',
			'news-cluster': 'NEWS ACTIVITY',
			'feed-news': category ? FEED_LABELS[category as keyof typeof FEED_LABELS] || 'NEWS FEED' : 'NEWS FEED'
		};
		return labels[type] || type.toUpperCase();
	}

	// Pause/resume layer data
	function toggleLayerPause(layer: keyof typeof dataLayers) {
		if (layer === 'news') {
			if (!dataLayers.news.paused) {
				// Freezing - capture current news
				frozenNews = [...news];
				if (categorizedNews) {
					frozenCategorizedNews = {
						politics: [...categorizedNews.politics],
						tech: [...categorizedNews.tech],
						finance: [...categorizedNews.finance],
						gov: [...categorizedNews.gov],
						ai: [...categorizedNews.ai],
						intel: [...categorizedNews.intel]
					};
				}
				lastNewsUpdate = Date.now();
			}
		}
		dataLayers[layer].paused = !dataLayers[layer].paused;
	}

	// Update all map layers
	function updateMapLayers() {
		if (!map || !isInitialized) return;

		try {
			const pointsSource = map.getSource('points') as mapboxgl.GeoJSONSource;
			if (pointsSource) pointsSource.setData(getPointsGeoJSON());

			const arcsSource = map.getSource('arcs') as mapboxgl.GeoJSONSource;
			if (arcsSource) arcsSource.setData(getArcsGeoJSON());

			const ringsSource = map.getSource('pulsing-rings') as mapboxgl.GeoJSONSource;
			if (ringsSource) ringsSource.setData(getPulsingRingsGeoJSON());

			const labelsSource = map.getSource('labels') as mapboxgl.GeoJSONSource;
			if (labelsSource) labelsSource.setData(getLabelsGeoJSON());

			const newsSource = map.getSource('news-events') as mapboxgl.GeoJSONSource;
			if (newsSource) newsSource.setData(getNewsEventsGeoJSON());
		} catch (e) {
			// Sources might not exist yet
		}
	}

	// Auto-rotation logic
	function startRotation() {
		if (!map || !isRotating) return;
		const rotate = () => {
			if (!map || !isRotating) return;
			const center = map.getCenter();
			map.setCenter([center.lng + 0.05, center.lat]);
			rotationAnimationId = requestAnimationFrame(rotate);
		};
		rotationAnimationId = requestAnimationFrame(rotate);
	}

	function stopRotation() {
		if (rotationAnimationId) {
			cancelAnimationFrame(rotationAnimationId);
			rotationAnimationId = null;
		}
	}

	function pauseRotation() {
		isRotating = false;
		stopRotation();
	}

	function resumeRotation() {
		isRotating = true;
		startRotation();
	}

	// Initialize Mapbox map
	async function initMap() {
		if (typeof window === 'undefined' || !mapContainer) return;

		const width = mapContainer.clientWidth;
		const height = mapContainer.clientHeight;

		if (width === 0 || height === 0) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return initMap();
		}

		try {
			mapboxgl.accessToken = MAPBOX_TOKEN;

			map = new mapboxgl.Map({
				container: mapContainer,
				style: {
					version: 8,
					name: 'Dark Globe',
					sources: {
						'satellite-imagery': {
							type: 'raster',
							tiles: [
								'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=' +
									MAPBOX_TOKEN
							],
							tileSize: 256
						}
					},
					layers: [
						{ id: 'background', type: 'background', paint: { 'background-color': '#020305' } },
						{
							id: 'satellite',
							type: 'raster',
							source: 'satellite-imagery',
							paint: {
								'raster-brightness-max': 0.4,
								'raster-brightness-min': 0.0,
								'raster-saturation': -0.3,
								'raster-contrast': 0.2
							}
						}
					],
					glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf'
				},
				center: [10, 25],
				zoom: 1.5,
				projection: 'globe',
				attributionControl: false,
				logoPosition: 'bottom-right'
			});

			map.on('style.load', () => {
				if (!map) return;

				map.setFog({
					color: 'rgb(6, 182, 212)',
					'high-color': 'rgb(2, 6, 23)',
					'horizon-blend': 0.02,
					'space-color': 'rgb(2, 3, 5)',
					'star-intensity': 0.6
				});

				// Add all sources
				map.addSource('points', { type: 'geojson', data: getPointsGeoJSON() });
				map.addSource('arcs', { type: 'geojson', data: getArcsGeoJSON() });
				map.addSource('pulsing-rings', { type: 'geojson', data: getPulsingRingsGeoJSON() });
				map.addSource('labels', { type: 'geojson', data: getLabelsGeoJSON() });
				map.addSource('news-events', { type: 'geojson', data: getNewsEventsGeoJSON() });

				// Add layers

				// Arc glow layer (underneath) for 3D effect
				map.addLayer({
					id: 'arcs-glow',
					type: 'line',
					source: 'arcs',
					paint: {
						'line-color': ['get', 'glowColor'],
						'line-width': 8,
						'line-opacity': 0.6,
						'line-blur': 4
					}
				});

				// Arc main layer - solid curved line
				map.addLayer({
					id: 'arcs-layer',
					type: 'line',
					source: 'arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 2.5,
						'line-opacity': 0.9
					}
				});

				// Arc highlight layer - thin bright line on top
				map.addLayer({
					id: 'arcs-highlight',
					type: 'line',
					source: 'arcs',
					paint: {
						'line-color': '#ffffff',
						'line-width': 0.8,
						'line-opacity': 0.4
					}
				});

				map.addLayer({
					id: 'pulsing-rings-outer',
					type: 'circle',
					source: 'pulsing-rings',
					paint: {
						'circle-radius': 20,
						'circle-color': 'transparent',
						'circle-stroke-color': '#ff0000',
						'circle-stroke-width': 2,
						'circle-stroke-opacity': 0.3
					}
				});

				map.addLayer({
					id: 'pulsing-rings-inner',
					type: 'circle',
					source: 'pulsing-rings',
					paint: {
						'circle-radius': 12,
						'circle-color': 'transparent',
						'circle-stroke-color': '#ff0000',
						'circle-stroke-width': 1.5,
						'circle-stroke-opacity': 0.5
					}
				});

				map.addLayer({
					id: 'news-events-glow',
					type: 'circle',
					source: 'news-events',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 1.8],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['*', ['get', 'opacity'], 0.3],
						'circle-blur': 1
					}
				});

				map.addLayer({
					id: 'news-events-layer',
					type: 'circle',
					source: 'news-events',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 8],
						'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
						'circle-opacity': ['coalesce', ['get', 'opacity'], 0.8],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1,
						'circle-stroke-opacity': 0.5
					}
				});

				map.addLayer({
					id: 'points-glow',
					type: 'circle',
					source: 'points',
					paint: {
						'circle-radius': ['*', ['coalesce', ['get', 'size'], 8], 1.3],
						'circle-color': ['coalesce', ['get', 'color'], '#5b8a8a'],
						'circle-opacity': 0.15, // Reduced glow for less neon effect
						'circle-blur': 0.8
					}
				});

				map.addLayer({
					id: 'points-layer',
					type: 'circle',
					source: 'points',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 8],
						'circle-color': ['coalesce', ['get', 'color'], '#06b6d4'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1,
						'circle-stroke-opacity': 0.5
					}
				});

				map.addLayer({
					id: 'labels-layer',
					type: 'symbol',
					source: 'labels',
					layout: {
						'text-field': ['get', 'label'],
						'text-size': 10,
						'text-offset': [0, 1.5],
						'text-anchor': 'top',
						'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
						'text-allow-overlap': true,
						'text-ignore-placement': true
					},
					paint: {
						'text-color': ['get', 'color'],
						'text-halo-color': 'rgba(0, 0, 0, 0.8)',
						'text-halo-width': 1
					}
				});

				// Ensure labels layer doesn't capture pointer events
				map.on('mouseenter', 'labels-layer', () => {});
				map.on('mouseleave', 'labels-layer', () => {});

				setupInteractivity();
				// Globe starts paused - user must click play to start rotation
				isInitialized = true;
			});

			map.on('mousedown', pauseRotation);
			map.on('touchstart', pauseRotation);
			map.on('wheel', pauseRotation);
		} catch (error) {
			console.error('Failed to initialize map:', error);
			initError = 'Failed to load 3D globe. WebGL may not be supported.';
		}
	}

	function setupInteractivity() {
		if (!map) return;

		const interactiveLayers = ['points-layer', 'news-events-layer'];

		interactiveLayers.forEach((layerId) => {
			map!.on('mouseenter', layerId, () => {
				if (map) map.getCanvas().style.cursor = 'pointer';
			});

			map!.on('mouseleave', layerId, () => {
				if (map) map.getCanvas().style.cursor = '';
			});
		});

		map.on('mousemove', 'points-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			let recentNews: string[] = [];
			try {
				recentNews = props?.recentNews ? JSON.parse(props.recentNews) : [];
			} catch {
				recentNews = [];
			}

			tooltipData = {
				label: props?.label || '',
				type: props?.type || '',
				desc: props?.desc,
				level: props?.level,
				newsCount: props?.newsCount || 0,
				recentNews
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		map.on('mousemove', 'news-events-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			let recentNews: string[] = [];
			try {
				recentNews = props?.recentNews ? JSON.parse(props.recentNews) : [];
			} catch {
				recentNews = [];
			}

			const isFeedNews = props?.type === 'feed-news';
			tooltipData = {
				label: isFeedNews ? `${props?.count || 0} ${props?.categoryLabel || 'News'} Items` : `${props?.count || 0} News Items`,
				type: props?.type || 'news-cluster',
				desc: props?.hasAlerts ? 'Contains alert-level news' : 'Recent news activity',
				isAlert: props?.hasAlerts,
				category: props?.category,
				categoryLabel: props?.categoryLabel,
				recentNews
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		map.on('mouseleave', 'points-layer', handleMouseLeave);
		map.on('mouseleave', 'news-events-layer', handleMouseLeave);

		map.on('click', 'points-layer', (e) => handlePointClick(e));
		map.on('click', 'news-events-layer', (e) => handlePointClick(e));

		map.on('click', (e) => {
			const features = map?.queryRenderedFeatures(e.point, {
				layers: ['points-layer', 'news-events-layer']
			});
			if (!features || features.length === 0) {
				if (tooltipLocked) {
					tooltipLocked = false;
					tooltipVisible = false;
					tooltipData = null;
					setTimeout(() => {
						if (!tooltipLocked) resumeRotation();
					}, 1500);
				}
			}
		});
	}

	function handleMouseLeave() {
		if (!tooltipLocked) {
			tooltipVisible = false;
			tooltipData = null;
			setTimeout(() => {
				if (!tooltipLocked) resumeRotation();
			}, 2000);
		}
	}

	function handlePointClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;

		const feature = e.features[0];
		const props = feature.properties;

		let recentNews: string[] = [];
		try {
			recentNews = props?.recentNews ? JSON.parse(props.recentNews) : [];
		} catch {
			recentNews = [];
		}

		const isFeedNews = props?.type === 'feed-news';
		tooltipData = {
			label: isFeedNews ? `${props?.count || 0} ${props?.categoryLabel || 'News'} Items` : (props?.label || ''),
			type: props?.type || '',
			desc: props?.desc,
			level: props?.level,
			newsCount: props?.newsCount || props?.count || 0,
			recentNews,
			isAlert: props?.hasAlerts || props?.hasAlert,
			category: props?.category,
			categoryLabel: props?.categoryLabel
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	function updateTooltipPosition(point: mapboxgl.Point) {
		if (!mapContainer) return;
		const rect = mapContainer.getBoundingClientRect();
		tooltipX = point.x + 15;
		tooltipY = point.y + 15;

		const tooltipWidth = 300;
		const tooltipHeight = 150;
		if (tooltipX + tooltipWidth > rect.width) tooltipX = point.x - tooltipWidth - 15;
		if (tooltipY + tooltipHeight > rect.height) tooltipY = point.y - tooltipHeight - 15;
	}

	function handleMouseMove(event: MouseEvent) {
		if (!tooltipLocked && tooltipVisible && mapContainer) {
			const rect = mapContainer.getBoundingClientRect();
			tooltipX = event.clientX - rect.left + 15;
			tooltipY = event.clientY - rect.top + 15;

			const tooltipWidth = 300;
			const tooltipHeight = 150;
			if (tooltipX + tooltipWidth > rect.width) tooltipX = event.clientX - rect.left - tooltipWidth - 15;
			if (tooltipY + tooltipHeight > rect.height) tooltipY = event.clientY - rect.top - tooltipHeight - 15;
		}
	}

	function handleContainerEnter() {
		pauseRotation();
	}

	function handleContainerLeave() {
		if (!tooltipLocked) {
			tooltipVisible = false;
			tooltipData = null;
			setTimeout(() => {
				if (!tooltipLocked) resumeRotation();
			}, 1000);
		}
	}

	// React to data changes
	$effect(() => {
		if (map && isInitialized) {
			updateMapLayers();
		}
	});

	// Animate pulsing rings
	$effect(() => {
		if (!map || !isInitialized) return;

		let pulsePhase = 0;
		const pulseInterval = setInterval(() => {
			if (!map) return;
			pulsePhase = (pulsePhase + 1) % 60;
			const outerRadius = 15 + Math.sin((pulsePhase / 60) * Math.PI * 2) * 8;
			const innerRadius = 10 + Math.sin((pulsePhase / 60) * Math.PI * 2) * 4;
			const opacity = 0.3 + Math.sin((pulsePhase / 60) * Math.PI * 2) * 0.2;

			try {
				map.setPaintProperty('pulsing-rings-outer', 'circle-radius', outerRadius);
				map.setPaintProperty('pulsing-rings-outer', 'circle-stroke-opacity', opacity);
				map.setPaintProperty('pulsing-rings-inner', 'circle-radius', innerRadius);
			} catch {
				// Layer might not exist yet
			}
		}, 50);

		return () => clearInterval(pulseInterval);
	});

	onMount(() => {
		requestAnimationFrame(() => initMap());
	});

	onDestroy(() => {
		stopRotation();
		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<div
	class="globe-container"
	bind:this={mapContainer}
	onmousemove={handleMouseMove}
	onmouseenter={handleContainerEnter}
	onmouseleave={handleContainerLeave}
	role="application"
	aria-label="Interactive 3D globe showing global hotspots and live news"
>
	{#if !isInitialized && !initError}
		<div class="globe-loading">
			<div class="loading-spinner"></div>
			<span class="loading-text">INITIALIZING GLOBE</span>
		</div>
	{/if}
	{#if initError}
		<div class="globe-error">
			<span class="error-icon">!</span>
			<span class="error-text">{initError}</span>
		</div>
	{/if}

	<!-- Globe Controls -->
	{#if isInitialized}
		<div class="globe-controls">
			<button
				class="control-btn"
				class:active={dataControlsExpanded}
				onclick={() => (dataControlsExpanded = !dataControlsExpanded)}
				title="Data layer controls"
			>
				<span class="control-icon">&#9881;</span>
			</button>
			<button
				class="control-btn"
				class:active={isRotating}
				onclick={() => (isRotating ? pauseRotation() : resumeRotation())}
				title={isRotating ? 'Pause rotation' : 'Start rotation'}
			>
				<span class="control-icon">{isRotating ? '⏸' : '▶'}</span>
			</button>
		</div>
	{/if}

	<!-- Data Layer Controls Panel -->
	{#if isInitialized && dataControlsExpanded}
		<div class="data-controls">
			<div class="data-controls-header">
				<span class="data-controls-title">DATA LAYERS</span>
			</div>
			<div class="data-controls-content">
				<!-- Layer toggles -->
				<div class="layer-section">
					<span class="layer-section-title">VISIBILITY</span>
					{#each Object.entries(dataLayers) as [layer, state]}
						<label class="layer-toggle">
							<input type="checkbox" bind:checked={state.visible} onchange={() => updateMapLayers()} />
							<span class="layer-name">{layer.charAt(0).toUpperCase() + layer.slice(1)}</span>
							{#if layer === 'news' || layer === 'hotspots'}
								<button
									class="pause-btn"
									class:paused={state.paused}
									onclick={() => toggleLayerPause(layer as keyof typeof dataLayers)}
									title={state.paused ? 'Resume live data' : 'Pause live data'}
								>
									{state.paused ? '>' : '||'}
								</button>
							{/if}
						</label>
					{/each}
				</div>

				<!-- Feed category toggles -->
				{#if categorizedNews}
					<div class="layer-section">
						<span class="layer-section-title">NEWS FEEDS</span>
						{#each Object.entries(feedLayers) as [feed, state]}
							<label class="layer-toggle feed-toggle">
								<input
									type="checkbox"
									bind:checked={state.visible}
									onchange={() => updateMapLayers()}
								/>
								<span
									class="feed-color-dot"
									style="background-color: {FEED_COLORS[feed as keyof typeof FEED_COLORS]}"
								></span>
								<span class="layer-name">{FEED_LABELS[feed as keyof typeof FEED_LABELS]}</span>
							</label>
						{/each}
					</div>
				{/if}

				<!-- News filters -->
				<div class="layer-section">
					<span class="layer-section-title">NEWS FILTERS</span>
					<label class="filter-row">
						<span class="filter-label">Time window:</span>
						<select bind:value={newsTimeFilter} onchange={() => updateMapLayers()}>
							<option value={15}>15 min</option>
							<option value={30}>30 min</option>
							<option value={60}>1 hour</option>
							<option value={120}>2 hours</option>
							<option value={360}>6 hours</option>
							<option value={1440}>24 hours</option>
						</select>
					</label>
					<label class="filter-row">
						<span class="filter-label">Expire after:</span>
						<select bind:value={newsTTL} onchange={() => updateMapLayers()}>
							<option value={15}>15 min</option>
							<option value={30}>30 min</option>
							<option value={60}>1 hour</option>
							<option value={120}>2 hours</option>
						</select>
					</label>
					<label class="filter-row checkbox">
						<input type="checkbox" bind:checked={showAlertsOnly} onchange={() => updateMapLayers()} />
						<span class="filter-label">Alerts only</span>
					</label>
				</div>

				<!-- Status -->
				{#if dataLayers.news.paused}
					<div class="pause-status">
						<span class="pause-indicator"></span>
						News paused at {new Date(lastNewsUpdate).toLocaleTimeString()}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Globe Legend -->
	{#if isInitialized}
		<div class="globe-legend" class:expanded={legendExpanded}>
			<button class="legend-toggle" onclick={() => (legendExpanded = !legendExpanded)}>
				<span class="legend-toggle-text">LEGEND</span>
				<span class="legend-toggle-icon">{legendExpanded ? '▼' : '▲'}</span>
			</button>
			{#if legendExpanded}
				<div class="legend-content">
					<div class="legend-section">
						<span class="legend-section-title">THREAT LEVELS</span>
						<div class="legend-items">
							<div class="legend-item">
								<span class="legend-dot critical"></span>
								<span class="legend-label">Critical</span>
							</div>
							<div class="legend-item">
								<span class="legend-dot high"></span>
								<span class="legend-label">High</span>
							</div>
							<div class="legend-item">
								<span class="legend-dot elevated"></span>
								<span class="legend-label">Elevated</span>
							</div>
							<div class="legend-item">
								<span class="legend-dot low"></span>
								<span class="legend-label">Low</span>
							</div>
						</div>
					</div>
					<div class="legend-section">
						<span class="legend-section-title">NEWS FEEDS</span>
						<div class="legend-items">
							<div class="legend-item">
								<span class="legend-marker" style="background: #ef4444; box-shadow: 0 0 4px #ef4444;"></span>
								<span class="legend-label">Politics</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker" style="background: #8b5cf6; box-shadow: 0 0 4px #8b5cf6;"></span>
								<span class="legend-label">Tech</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker" style="background: #10b981; box-shadow: 0 0 4px #10b981;"></span>
								<span class="legend-label">Finance</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker" style="background: #f59e0b; box-shadow: 0 0 4px #f59e0b;"></span>
								<span class="legend-label">Government</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker" style="background: #06b6d4; box-shadow: 0 0 4px #06b6d4;"></span>
								<span class="legend-label">AI</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker" style="background: #ec4899; box-shadow: 0 0 4px #ec4899;"></span>
								<span class="legend-label">Intel</span>
							</div>
						</div>
					</div>
					<div class="legend-section">
						<span class="legend-section-title">INFRASTRUCTURE</span>
						<div class="legend-items">
							<div class="legend-item">
								<span class="legend-icon">⚓</span>
								<span class="legend-label">Chokepoint</span>
							</div>
							<div class="legend-item">
								<span class="legend-icon">📡</span>
								<span class="legend-label">Cable Landing</span>
							</div>
							<div class="legend-item">
								<span class="legend-icon">☢</span>
								<span class="legend-label">Nuclear Site</span>
							</div>
							<div class="legend-item">
								<span class="legend-icon">🎖</span>
								<span class="legend-label">Military Base</span>
							</div>
						</div>
					</div>
					<div class="legend-hint">
						Click gear icon for data controls. Click markers for details.
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Interactive Tooltip -->
	{#if tooltipVisible && tooltipData}
		<div class="globe-tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
			<div class="tooltip-header">
				<span
					class="tooltip-type"
					class:critical={tooltipData.level === 'critical' || tooltipData.isAlert}
					class:high={tooltipData.level === 'high'}
					class:elevated={tooltipData.level === 'elevated'}
					style={tooltipData.category ? `color: ${FEED_COLORS[tooltipData.category as keyof typeof FEED_COLORS]}` : ''}
				>
					{getTypeLabel(tooltipData.type, tooltipData.category)}
				</span>
				{#if tooltipData.level}
					<span
						class="tooltip-level"
						class:critical={tooltipData.level === 'critical'}
						class:high={tooltipData.level === 'high'}
						class:elevated={tooltipData.level === 'elevated'}
					>
						{tooltipData.level.toUpperCase()}
					</span>
				{:else if tooltipData.category}
					<span
						class="tooltip-feed-badge"
						style="background-color: {FEED_COLORS[tooltipData.category as keyof typeof FEED_COLORS]}20; border-color: {FEED_COLORS[tooltipData.category as keyof typeof FEED_COLORS]}40; color: {FEED_COLORS[tooltipData.category as keyof typeof FEED_COLORS]}"
					>
						{tooltipData.category.toUpperCase()}
					</span>
				{/if}
			</div>
			<div class="tooltip-name">{tooltipData.label}</div>
			{#if tooltipData.desc}
				<div class="tooltip-desc">{tooltipData.desc}</div>
			{/if}
			{#if tooltipData.newsCount && tooltipData.newsCount > 0 && !tooltipData.category}
				<div class="tooltip-news-count">
					<span class="news-badge">{tooltipData.newsCount} news items</span>
				</div>
			{/if}
			{#if tooltipData.recentNews && tooltipData.recentNews.length > 0}
				<div class="tooltip-news">
					<span class="news-label">Recent Headlines:</span>
					{#each tooltipData.recentNews as headline}
						<div class="news-headline">{headline}</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.globe-container {
		width: 100%;
		height: 100%;
		min-height: 400px;
		position: relative;
		background: radial-gradient(ellipse at center, #0a0f1a 0%, #020305 70%);
		overflow: visible;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 2px;
	}

	.globe-container::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.4) 100%);
		z-index: 10;
	}

	.globe-container :global(.mapboxgl-canvas-container) {
		position: relative;
		z-index: 0;
	}

	.globe-container :global(.mapboxgl-canvas) {
		cursor: grab;
		position: relative;
		z-index: 1;
	}

	.globe-container :global(.mapboxgl-canvas:active) {
		cursor: grabbing;
	}

	.globe-container :global(.mapboxgl-ctrl-logo) {
		display: none !important;
	}

	.globe-loading,
	.globe-error {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		z-index: 5;
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 2px solid rgb(51 65 85);
		border-top-color: rgb(34 211 238);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text,
	.error-text {
		font-size: 0.625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.15em;
		color: rgb(148 163 184);
		text-transform: uppercase;
	}

	.error-icon {
		font-size: 2rem;
		color: rgb(251 191 36);
	}

	.error-text {
		color: rgb(251 191 36);
		max-width: 200px;
		text-align: center;
	}

	/* Globe Controls */
	.globe-controls {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		z-index: 20;
	}

	.control-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(15 23 42 / 0.8);
		backdrop-filter: blur(8px);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.control-btn:hover {
		background: rgb(51 65 85 / 0.8);
		border-color: rgb(34 211 238 / 0.5);
		color: rgb(34 211 238);
	}

	.control-btn.active {
		background: rgb(22 78 99 / 0.5);
		border-color: rgb(34 211 238 / 0.5);
		color: rgb(34 211 238);
	}

	.control-icon {
		font-size: 0.875rem;
	}

	/* Data Controls Panel */
	.data-controls {
		position: absolute;
		top: 0.75rem;
		right: 3rem;
		z-index: 20;
		background: rgb(15 23 42 / 0.95);
		backdrop-filter: blur(12px);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		min-width: 200px;
		max-width: 260px;
	}

	.data-controls-header {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid rgb(51 65 85 / 0.3);
	}

	.data-controls-title {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: rgb(34 211 238);
		text-transform: uppercase;
	}

	.data-controls-content {
		padding: 0.5rem 0.75rem;
	}

	.layer-section {
		margin-bottom: 0.75rem;
	}

	.layer-section:last-child {
		margin-bottom: 0;
	}

	.layer-section-title {
		display: block;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: rgb(100 116 139);
		text-transform: uppercase;
		margin-bottom: 0.375rem;
	}

	.layer-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		cursor: pointer;
	}

	.layer-toggle input[type='checkbox'] {
		width: 12px;
		height: 12px;
		accent-color: rgb(34 211 238);
	}

	.layer-name {
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(203 213 225);
		flex: 1;
	}

	.feed-toggle {
		gap: 0.375rem;
	}

	.feed-color-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 0 4px currentColor;
	}

	.pause-btn {
		width: 20px;
		height: 16px;
		font-size: 0.5rem;
		background: rgb(51 65 85 / 0.5);
		border: 1px solid rgb(71 85 105 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.pause-btn:hover {
		background: rgb(71 85 105 / 0.5);
		color: rgb(34 211 238);
	}

	.pause-btn.paused {
		background: rgb(127 29 29 / 0.5);
		border-color: rgb(239 68 68 / 0.5);
		color: rgb(239 68 68);
	}

	.filter-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
	}

	.filter-row.checkbox {
		cursor: pointer;
	}

	.filter-label {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184);
		flex: 1;
	}

	.filter-row select {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		background: rgb(30 41 59);
		border: 1px solid rgb(51 65 85);
		border-radius: 2px;
		color: rgb(203 213 225);
		padding: 0.125rem 0.25rem;
	}

	.filter-row input[type='checkbox'] {
		width: 12px;
		height: 12px;
		accent-color: rgb(34 211 238);
	}

	.pause-status {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgb(51 65 85 / 0.3);
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(251 191 36);
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.pause-indicator {
		width: 6px;
		height: 6px;
		background: rgb(251 191 36);
		border-radius: 50%;
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}

	/* Globe Legend */
	.globe-legend {
		position: absolute;
		bottom: 0.75rem;
		left: 0.75rem;
		z-index: 20;
		background: rgb(15 23 42 / 0.9);
		backdrop-filter: blur(12px);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		min-width: 140px;
		max-width: 200px;
		max-height: 60%;
		overflow-y: auto;
	}

	.legend-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.625rem;
		background: transparent;
		border: none;
		color: rgb(148 163 184);
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.legend-toggle:hover {
		color: rgb(34 211 238);
	}

	.legend-toggle-text {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.legend-toggle-icon {
		font-size: 0.5rem;
	}

	.legend-content {
		padding: 0 0.625rem 0.625rem;
		border-top: 1px solid rgb(51 65 85 / 0.3);
	}

	.legend-section {
		margin-top: 0.5rem;
	}

	.legend-section-title {
		display: block;
		font-size: 0.4375rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: rgb(100 116 139);
		text-transform: uppercase;
		margin-bottom: 0.25rem;
	}

	.legend-items {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.legend-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-dot.critical {
		background: #ff0000;
		box-shadow: 0 0 4px #ff0000;
	}

	.legend-dot.high {
		background: #ff4444;
		box-shadow: 0 0 4px #ff4444;
	}

	.legend-dot.elevated {
		background: #ffcc00;
		box-shadow: 0 0 4px #ffcc00;
	}

	.legend-dot.low {
		background: #00ff88;
		box-shadow: 0 0 4px #00ff88;
	}

	.legend-marker {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	/* Infrastructure markers now use icons - see .legend-icon */

	.legend-icon {
		font-size: 0.625rem;
		width: 14px;
		text-align: center;
		flex-shrink: 0;
	}

	.legend-label {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(203 213 225);
		white-space: nowrap;
	}

	.legend-hint {
		margin-top: 0.375rem;
		padding-top: 0.375rem;
		border-top: 1px solid rgb(51 65 85 / 0.3);
		font-size: 0.4375rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
		line-height: 1.3;
	}

	/* Globe Tooltip */
	.globe-tooltip {
		position: absolute;
		z-index: 200;
		background: rgb(15 23 42 / 0.95);
		backdrop-filter: blur(12px);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		padding: 0.75rem;
		max-width: 300px;
		min-width: 180px;
		pointer-events: none;
		box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
	}

	.globe-tooltip::before,
	.globe-tooltip::after {
		content: '';
		position: absolute;
		width: 6px;
		height: 6px;
		pointer-events: none;
	}

	.globe-tooltip::before {
		top: 0;
		left: 0;
		border-top: 2px solid rgb(6 182 212 / 0.5);
		border-left: 2px solid rgb(6 182 212 / 0.5);
	}

	.globe-tooltip::after {
		top: 0;
		right: 0;
		border-top: 2px solid rgb(6 182 212 / 0.5);
		border-right: 2px solid rgb(6 182 212 / 0.5);
	}

	.tooltip-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
	}

	.tooltip-type {
		font-size: 0.5625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.1em;
		color: rgb(148 163 184);
		text-transform: uppercase;
	}

	.tooltip-type.critical {
		color: rgb(239 68 68);
	}

	.tooltip-type.high {
		color: rgb(251 191 36);
	}

	.tooltip-type.elevated {
		color: rgb(34 211 238);
	}

	.tooltip-level {
		font-size: 0.5625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.05em;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		text-transform: uppercase;
		background: rgb(100 116 139 / 0.2);
		color: rgb(148 163 184);
		border: 1px solid rgb(71 85 105 / 0.5);
	}

	.tooltip-level.critical {
		background: rgb(69 10 10 / 0.5);
		color: rgb(239 68 68);
		border-color: rgb(127 29 29 / 0.5);
	}

	.tooltip-level.high {
		background: rgb(69 26 3 / 0.5);
		color: rgb(251 191 36);
		border-color: rgb(146 64 14 / 0.5);
	}

	.tooltip-level.elevated {
		background: rgb(22 78 99 / 0.5);
		color: rgb(34 211 238);
		border-color: rgb(8 145 178 / 0.5);
	}

	.tooltip-feed-badge {
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.05em;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		text-transform: uppercase;
		border: 1px solid;
	}

	.tooltip-name {
		font-size: 0.75rem;
		font-weight: 700;
		color: white;
		margin-bottom: 0.25rem;
	}

	.tooltip-desc {
		font-size: 0.625rem;
		color: rgb(203 213 225);
		line-height: 1.4;
		border-top: 1px solid rgb(51 65 85 / 0.5);
		padding-top: 0.375rem;
		margin-top: 0.25rem;
	}

	.tooltip-news-count {
		margin-top: 0.375rem;
	}

	.news-badge {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		background: rgb(59 130 246 / 0.2);
		color: rgb(96 165 250);
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		border: 1px solid rgb(59 130 246 / 0.3);
	}

	.tooltip-news {
		margin-top: 0.5rem;
		padding-top: 0.375rem;
		border-top: 1px solid rgb(51 65 85 / 0.5);
	}

	.news-label {
		display: block;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
		margin-bottom: 0.25rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.news-headline {
		font-size: 0.5625rem;
		color: rgb(203 213 225);
		line-height: 1.3;
		padding: 0.125rem 0;
		border-bottom: 1px solid rgb(51 65 85 / 0.2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.news-headline:last-child {
		border-bottom: none;
	}

	@media (max-width: 480px) {
		.data-controls {
			right: 2.5rem;
			min-width: 180px;
		}

		.globe-legend {
			min-width: 120px;
			max-width: 160px;
		}
	}
</style>
