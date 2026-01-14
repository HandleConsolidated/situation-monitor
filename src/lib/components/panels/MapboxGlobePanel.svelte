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
	import { fetchOutageData, fetchVIEWSConflicts } from '$lib/api';
	import type { OutageData, VIEWSConflictData } from '$lib/api';
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
		outages: { visible: true, paused: false },
		monitors: { visible: true, paused: false },
		news: { visible: true, paused: false },
		arcs: { visible: true, paused: false },
		smartHotspots: { visible: false, paused: false } // VIEWS conflict forecasts - off by default
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
	let isRotating = $state(false); // Current rotation state
	let userEnabledRotation = $state(false); // Track if user explicitly enabled rotation
	let rotationAnimationId: number | null = null;

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipExpanded = $state(false);
	let tooltipData = $state<{
		label: string;
		type: string;
		desc?: string;
		level?: string;
		newsCount?: number;
		recentNews?: Array<{ title: string; link?: string }>; // First 3 items shown by default
		allNews?: Array<{ title: string; link?: string; source?: string }>; // All items for expansion
		isAlert?: boolean;
		timestamp?: number;
		category?: string;
		categoryLabel?: string;
		hotspotName?: string;
	} | null>(null);

	// Frozen news data (when paused)
	let frozenNews = $state<NewsItem[]>([]);
	let frozenCategorizedNews = $state<CategorizedNews | null>(null);
	let lastNewsUpdate = $state<number>(Date.now());

	// Real outage data from API
	let outageData = $state<OutageData[]>([]);
	let outageDataLoading = $state(false);

	// VIEWS Conflict Forecast data (Smart Hotspots)
	let conflictData = $state<VIEWSConflictData | null>(null);
	let conflictDataLoading = $state(false);

	// Arc particle animation - stored as mutable array for direct manipulation
	// Each particle has a progress value (0-1) along its arc
	const arcParticlePositions = [
		{ arcIndex: 0, progress: 0 },
		{ arcIndex: 0, progress: 0.33 },
		{ arcIndex: 0, progress: 0.66 },
		{ arcIndex: 1, progress: 0.15 },
		{ arcIndex: 1, progress: 0.48 },
		{ arcIndex: 1, progress: 0.81 },
		{ arcIndex: 2, progress: 0.1 },
		{ arcIndex: 2, progress: 0.4 },
		{ arcIndex: 2, progress: 0.7 },
		{ arcIndex: 3, progress: 0.2 },
		{ arcIndex: 3, progress: 0.55 },
		{ arcIndex: 3, progress: 0.88 }
	];

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

	// Generate GeoJSON for all points - now with enhanced type-specific properties
	function getPointsGeoJSON(): GeoJSON.FeatureCollection {
		const features: GeoJSON.Feature[] = [];

		// Add hotspots (with news integration) - main geopolitical markers
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
						size: activity.level === 'critical' ? 10 : activity.level === 'high' ? 8 : 6,
						glowSize: activity.level === 'critical' ? 16 : activity.level === 'high' ? 12 : 10,
						strokeWidth: activity.level === 'critical' ? 2 : 1.5,
						icon: activity.hasAlert ? '⚠' : '◉',
						newsCount: activity.newsCount,
						hasAlert: activity.hasAlert,
						importance: activity.level === 'critical' ? 3 : activity.level === 'high' ? 2 : 1,
						recentNews: JSON.stringify(hotspotNews.slice(0, 3).map((n) => ({ title: n.title, link: n.link })))
					}
				});
			});
		}

		// Add chokepoints - diamond markers for maritime strategic routes
		if (dataLayers.chokepoints.visible) {
			CHOKEPOINTS.forEach((cp) => {
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [cp.lon, cp.lat] },
					properties: {
						label: cp.name,
						type: 'chokepoint',
						desc: cp.desc,
						color: '#06b6d4', // Cyan-500
						innerColor: '#0891b2', // Cyan-600
						size: 9,
						glowSize: 16,
						strokeWidth: 2,
						icon: '⬥', // Diamond shape
						importance: 1
					}
				});
			});
		}

		// Add cable landings - small pulsing circles for digital infrastructure
		if (dataLayers.cables.visible) {
			CABLE_LANDINGS.forEach((cl) => {
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [cl.lon, cl.lat] },
					properties: {
						label: cl.name,
						type: 'cable',
						desc: cl.desc,
						color: '#10b981', // Emerald-500
						innerColor: '#059669', // Emerald-600
						size: 6,
						glowSize: 10,
						strokeWidth: 1.5,
						icon: '◈', // Diamond with dot
						importance: 0
					}
				});
			});
		}

		// Add nuclear sites - warning markers with radiation symbol
		if (dataLayers.nuclear.visible) {
			NUCLEAR_SITES.forEach((ns) => {
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [ns.lon, ns.lat] },
					properties: {
						label: ns.name,
						type: 'nuclear',
						desc: ns.desc,
						color: '#f97316', // Orange-500
						innerColor: '#ea580c', // Orange-600
						size: 10,
						glowSize: 18,
						strokeWidth: 2,
						icon: '☢', // Radiation symbol
						importance: 2
					}
				});
			});
		}

		// Add military bases - star markers for defense installations
		if (dataLayers.military.visible) {
			MILITARY_BASES.forEach((mb) => {
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [mb.lon, mb.lat] },
					properties: {
						label: mb.name,
						type: 'military',
						desc: mb.desc,
						color: '#3b82f6', // Blue-500
						innerColor: '#2563eb', // Blue-600
						size: 8,
						glowSize: 14,
						strokeWidth: 1.5,
						icon: '✦', // Star shape
						importance: 1
					}
				});
			});
		}

		// Add custom monitors - user-defined watch markers
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
								innerColor: m.color || '#0891b2',
								size: 10,
								glowSize: 16,
								strokeWidth: 2,
								icon: '◎', // Target/bullseye
								importance: 2
							}
						});
					}
				});
		}

		return { type: 'FeatureCollection', features };
	}

	// Generate separate GeoJSON for each marker type to enable distinct styling
	function getHotspotsGeoJSON(): GeoJSON.FeatureCollection {
		const allPoints = getPointsGeoJSON();
		return {
			type: 'FeatureCollection',
			features: allPoints.features.filter((f) => f.properties?.type === 'hotspot')
		};
	}

	function getChokepointsGeoJSON(): GeoJSON.FeatureCollection {
		const allPoints = getPointsGeoJSON();
		return {
			type: 'FeatureCollection',
			features: allPoints.features.filter((f) => f.properties?.type === 'chokepoint')
		};
	}

	function getCablesGeoJSON(): GeoJSON.FeatureCollection {
		const allPoints = getPointsGeoJSON();
		return {
			type: 'FeatureCollection',
			features: allPoints.features.filter((f) => f.properties?.type === 'cable')
		};
	}

	function getNuclearGeoJSON(): GeoJSON.FeatureCollection {
		const allPoints = getPointsGeoJSON();
		return {
			type: 'FeatureCollection',
			features: allPoints.features.filter((f) => f.properties?.type === 'nuclear')
		};
	}

	function getMilitaryGeoJSON(): GeoJSON.FeatureCollection {
		const allPoints = getPointsGeoJSON();
		return {
			type: 'FeatureCollection',
			features: allPoints.features.filter((f) => f.properties?.type === 'military')
		};
	}

	function getMonitorsGeoJSON(): GeoJSON.FeatureCollection {
		const allPoints = getPointsGeoJSON();
		return {
			type: 'FeatureCollection',
			features: allPoints.features.filter((f) => f.properties?.type === 'monitor')
		};
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
						hotspotName: hotspotName,
						recentNews: JSON.stringify(newsItems.slice(0, 3).map((n) => ({ title: n.title, link: n.link }))),
						allNews: JSON.stringify(newsItems.slice(0, 15).map((n) => ({ title: n.title, link: n.link, source: n.source })))
					}
				});
			});
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate arc data for tension corridors with 3D rocket trajectory effect
	function getArcsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.arcs.visible) return { type: 'FeatureCollection', features: [] };

		const hotspotMap = new Map(HOTSPOTS.map((h) => [h.name, h]));
		const features: GeoJSON.Feature[] = [];

		// Glow colors for each arc
		const glowColors: Record<string, string> = {
			'#ef4444': 'rgba(239, 68, 68, 0.4)',
			'#fbbf24': 'rgba(251, 191, 36, 0.4)'
		};

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
						glowColor: glowColors[conn.color] || 'rgba(255, 255, 255, 0.4)',
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
	 * Generate beautiful 3D arc coordinates using geodesic (great circle) interpolation
	 * with simulated altitude that creates a dramatic ballistic trajectory effect.
	 * The arc rises above the earth's surface and follows the curvature of the globe.
	 */
	function generateArcCoordinates(
		start: [number, number],
		end: [number, number],
		segments: number
	): [number, number][] {
		const coords: [number, number][] = [];

		// Convert to radians for spherical calculations
		const toRad = (deg: number) => (deg * Math.PI) / 180;
		const toDeg = (rad: number) => (rad * 180) / Math.PI;

		const lon1 = toRad(start[0]);
		const lat1 = toRad(start[1]);
		const lon2 = toRad(end[0]);
		const lat2 = toRad(end[1]);

		// Calculate great circle distance (angular distance in radians)
		const dLon = lon2 - lon1;
		const dLat = lat2 - lat1;
		const a =
			Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
		const angularDistance = 2 * Math.asin(Math.sqrt(Math.min(1, a))); // Clamp to avoid NaN

		// Guard against very short distances (would cause division by zero)
		if (angularDistance < 0.0001) {
			// Just return a straight line for very short distances
			for (let i = 0; i <= segments; i++) {
				const t = i / segments;
				coords.push([
					start[0] + (end[0] - start[0]) * t,
					start[1] + (end[1] - start[1]) * t
				]);
			}
			return coords;
		}

		// Arc height scales with distance - longer arcs get higher peaks
		// Reduced values for more subtle, less dramatic arcs
		const distanceDegrees = toDeg(angularDistance);
		// Lower height factor for subtle arcs that don't dominate the view
		const arcHeightFactor = Math.min(distanceDegrees * 0.25, 10);

		for (let i = 0; i <= segments; i++) {
			const t = i / segments;

			// Spherical interpolation along great circle (geodesic path)
			const sinAngDist = Math.sin(angularDistance);
			const A = Math.sin((1 - t) * angularDistance) / sinAngDist;
			const B = Math.sin(t * angularDistance) / sinAngDist;

			// Calculate point on great circle
			const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
			const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
			const z = A * Math.sin(lat1) + B * Math.sin(lat2);

			const gcLat = Math.atan2(z, Math.sqrt(x * x + y * y));
			const gcLon = Math.atan2(y, x);

			// Calculate arc elevation - parabolic curve that peaks at midpoint
			// Using a smooth sin curve creates natural ballistic trajectory
			const elevationFactor = Math.sin(t * Math.PI);

			// Calculate perpendicular offset direction for the arc bulge
			// The arc bulges perpendicular to the path direction
			const pathBearing = Math.atan2(
				Math.sin(dLon) * Math.cos(lat2),
				Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
			);

			// Perpendicular direction (90 degrees to the right of path)
			const perpBearing = pathBearing + Math.PI / 2;

			// Apply offset perpendicular to path for dramatic arc bulge
			const offsetMagnitude = toRad(arcHeightFactor * elevationFactor);
			const latOffset = offsetMagnitude * Math.cos(perpBearing);
			const lonOffset = offsetMagnitude * Math.sin(perpBearing) / Math.cos(gcLat);

			const finalLat = toDeg(gcLat + latOffset);
			const finalLon = toDeg(gcLon + lonOffset);

			coords.push([finalLon, finalLat]);
		}

		return coords;
	}

	// Arc connection definitions (used by both arcs and particles)
	const arcConnections = [
		{ from: 'Moscow', to: 'Kyiv', color: '#ef4444' },
		{ from: 'Tehran', to: 'Tel Aviv', color: '#ef4444' },
		{ from: 'Beijing', to: 'Taipei', color: '#fbbf24' },
		{ from: 'Pyongyang', to: 'Tokyo', color: '#fbbf24' }
	];

	// Generate moving particles along arc paths
	function getArcParticlesGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.arcs.visible) return { type: 'FeatureCollection', features: [] };

		const hotspotMap = new Map(HOTSPOTS.map((h) => [h.name, h]));
		const features: GeoJSON.Feature[] = [];

		arcParticlePositions.forEach((particle) => {
			const conn = arcConnections[particle.arcIndex];
			if (!conn) return;

			const from = hotspotMap.get(conn.from);
			const to = hotspotMap.get(conn.to);
			if (!from || !to) return;

			// Get position along the arc at this progress
			const pos = getArcPointAtProgress(
				[from.lon, from.lat],
				[to.lon, to.lat],
				particle.progress
			);

			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: pos },
				properties: {
					color: conn.color,
					arcIndex: particle.arcIndex,
					progress: particle.progress
				}
			});
		});

		return { type: 'FeatureCollection', features };
	}

	// Get a single point along an arc at a given progress (0-1)
	// Uses the same geodesic algorithm as generateArcCoordinates for consistency
	function getArcPointAtProgress(
		start: [number, number],
		end: [number, number],
		progress: number
	): [number, number] {
		const toRad = (deg: number) => (deg * Math.PI) / 180;
		const toDeg = (rad: number) => (rad * 180) / Math.PI;

		const lon1 = toRad(start[0]);
		const lat1 = toRad(start[1]);
		const lon2 = toRad(end[0]);
		const lat2 = toRad(end[1]);

		// Great circle distance
		const dLon = lon2 - lon1;
		const dLat = lat2 - lat1;
		const a =
			Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
		const angularDistance = 2 * Math.asin(Math.sqrt(Math.min(1, a)));

		// Guard against very short distances
		if (angularDistance < 0.0001) {
			const t = progress;
			return [
				start[0] + (end[0] - start[0]) * t,
				start[1] + (end[1] - start[1]) * t
			];
		}

		const distanceDegrees = toDeg(angularDistance);
		const arcHeightFactor = Math.min(distanceDegrees * 0.25, 10); // Match the arc generation

		const t = progress;

		// Spherical interpolation
		const sinAngDist = Math.sin(angularDistance);
		const A = Math.sin((1 - t) * angularDistance) / sinAngDist;
		const B = Math.sin(t * angularDistance) / sinAngDist;

		const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
		const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
		const z = A * Math.sin(lat1) + B * Math.sin(lat2);

		const gcLat = Math.atan2(z, Math.sqrt(x * x + y * y));
		const gcLon = Math.atan2(y, x);

		const elevationFactor = Math.sin(t * Math.PI);

		// Calculate perpendicular offset - same as generateArcCoordinates
		const pathBearing = Math.atan2(
			Math.sin(dLon) * Math.cos(lat2),
			Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
		);
		const perpBearing = pathBearing + Math.PI / 2;

		const offsetMagnitude = toRad(arcHeightFactor * elevationFactor);
		const latOffset = offsetMagnitude * Math.cos(perpBearing);
		const lonOffset = offsetMagnitude * Math.sin(perpBearing) / Math.cos(gcLat);

		return [toDeg(gcLon + lonOffset), toDeg(gcLat + latOffset)];
	}

	// Generate outage events overlay GeoJSON - now uses real API data
	function getOutagesGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.outages.visible) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = [];
		const severityColors = {
			total: '#dc2626', // Red - complete blackout
			major: '#ea580c', // Orange - major disruption
			partial: '#ca8a04' // Yellow - partial issues
		};

		// Carbon intensity colors (for WattTime data - NOT grid stress/reliability)
		const carbonIntensityColors = {
			critical: '#dc2626', // Red - extreme emissions
			high: '#f97316', // Orange - very high emissions
			elevated: '#eab308', // Yellow - above normal emissions
			normal: '#22c55e' // Green - normal emissions
		};

		const typeIcons = {
			internet: '⊘', // No internet symbol
			power: '⚡', // Power/lightning
			both: '◉' // Combined - filled circle
		};

		// Use real outage data from API
		outageData.filter((e) => e.active).forEach((event) => {
			// Determine if this is a carbon intensity event (WattTime data)
			const isCarbonIntensity = event.source === 'WattTime Carbon Intensity' || event.source === 'WattTime Grid Monitor' || event.gridStressLevel;

			// Select appropriate color based on data type
			const markerColor = isCarbonIntensity && event.gridStressLevel
				? carbonIntensityColors[event.gridStressLevel]
				: severityColors[event.severity];

			// Carbon intensity events get leaf icon, regular outages use their type icon
			const icon = isCarbonIntensity ? '🌿' : typeIcons[event.type];

			// Size based on intensity level or severity
			let size = event.severity === 'total' ? 14 : event.severity === 'major' ? 12 : 10;
			if (isCarbonIntensity) {
				size = event.gridStressLevel === 'critical' ? 14 :
				       event.gridStressLevel === 'high' ? 12 : 10;
			}

			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [event.lon, event.lat] },
				properties: {
					id: event.id,
					label: event.country,
					type: 'outage',
					outageType: event.type,
					severity: event.severity,
					desc: event.description,
					affectedPopulation: event.affectedPopulation,
					color: markerColor,
					icon,
					size,
					radiusKm: event.radiusKm || 100,
					source: event.source,
					// Carbon intensity specific properties (NOT grid stress/reliability)
					isCarbonIntensity,
					gridStressLevel: event.gridStressLevel, // Legacy name for compatibility
					gridStressPercent: event.gridStressPercent, // Legacy name for compatibility
					hasBoundary: Boolean(event.boundaryCoords && event.boundaryCoords.length > 0)
				}
			});
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate outage area GeoJSON for geographic visualization
	// Uses actual boundary polygons when available, falls back to circles
	function getOutageRadiusGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.outages.visible) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = [];
		const severityColors = {
			total: '#dc2626',
			major: '#ea580c',
			partial: '#ca8a04'
		};

		// Carbon intensity colors (NOT grid stress/reliability)
		const carbonIntensityColors = {
			critical: '#dc2626', // Red - extreme emissions
			high: '#f97316', // Orange - very high emissions
			elevated: '#eab308', // Yellow - above normal emissions
			normal: '#22c55e' // Green - normal emissions
		};

		outageData.filter((e) => e.active).forEach((event) => {
			// Determine if this is a carbon intensity event (WattTime data)
			const isCarbonIntensity = event.source === 'WattTime Carbon Intensity' || event.source === 'WattTime Grid Monitor' || event.gridStressLevel;

			// Use carbon intensity color if applicable
			const fillColor = isCarbonIntensity && event.gridStressLevel
				? carbonIntensityColors[event.gridStressLevel]
				: severityColors[event.severity];

			// Check if we have actual boundary coordinates
			if (event.boundaryCoords && event.boundaryCoords.length > 0) {
				// Use the actual boundary polygon for accurate geographic coverage
				features.push({
					type: 'Feature',
					geometry: { type: 'Polygon', coordinates: event.boundaryCoords },
					properties: {
						id: `${event.id}-boundary`,
						severity: event.severity,
						color: fillColor,
						isCarbonIntensity,
						gridStressLevel: event.gridStressLevel, // Legacy name
						gridStressPercent: event.gridStressPercent, // Legacy name
						areaKm2: event.areaKm2
					}
				});
			} else {
				// Fall back to circle polygon based on radius
				const radiusKm = event.radiusKm || 100;
				const circleCoords = generateCircleCoordinates(event.lon, event.lat, radiusKm);

				features.push({
					type: 'Feature',
					geometry: { type: 'Polygon', coordinates: [circleCoords] },
					properties: {
						id: `${event.id}-radius`,
						severity: event.severity,
						color: fillColor,
						radiusKm,
						isCarbonIntensity,
						gridStressLevel: event.gridStressLevel, // Legacy name
						gridStressPercent: event.gridStressPercent // Legacy name
					}
				});
			}
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate circle coordinates for radius visualization
	function generateCircleCoordinates(
		centerLon: number,
		centerLat: number,
		radiusKm: number
	): [number, number][] {
		const coords: [number, number][] = [];
		const points = 64; // Number of points for smooth circle

		// Convert km to degrees (approximate)
		const radiusDeg = radiusKm / 111; // 1 degree ~= 111 km

		for (let i = 0; i <= points; i++) {
			const angle = (i / points) * 2 * Math.PI;
			// Adjust for latitude (longitude degrees are narrower near poles)
			const latAdjust = Math.cos((centerLat * Math.PI) / 180);
			const lon = centerLon + (radiusDeg * Math.cos(angle)) / latAdjust;
			const lat = centerLat + radiusDeg * Math.sin(angle);
			coords.push([lon, lat]);
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
			outage: 'CONNECTIVITY OUTAGE',
			'news-cluster': 'NEWS ACTIVITY',
			'feed-news': category ? FEED_LABELS[category as keyof typeof FEED_LABELS] || 'NEWS FEED' : 'NEWS FEED',
			'views-conflict': 'CONFLICT FORECAST (VIEWS)',
			'views-arc': 'TENSION CORRIDOR'
		};
		return labels[type] || type.toUpperCase();
	}

	// VIEWS Conflict intensity colors (matches VIEWS API intensity levels)
	const CONFLICT_INTENSITY_COLORS = {
		critical: '#dc2626', // Red-600
		high: '#ef4444', // Red-500
		elevated: '#f97316', // Orange-500
		low: '#fbbf24' // Amber-400
	};

	// Generate GeoJSON for VIEWS conflict forecast hotspots (Smart Hotspots)
	function getConflictHotspotsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.smartHotspots.visible || !conflictData) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = conflictData.hotspots.map((hotspot) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [hotspot.lon, hotspot.lat] },
			properties: {
				id: hotspot.id,
				label: hotspot.name,
				type: 'views-conflict',
				country: hotspot.country,
				isoCode: hotspot.isoCode,
				intensity: hotspot.intensity,
				forecastedFatalities: hotspot.forecastedFatalities,
				fatalityProbability: hotspot.fatalityProbability,
				forecastMonth: hotspot.forecastMonth,
				forecastYear: hotspot.forecastYear,
				color: CONFLICT_INTENSITY_COLORS[hotspot.intensity as keyof typeof CONFLICT_INTENSITY_COLORS],
				size: hotspot.intensity === 'critical' ? 12 : hotspot.intensity === 'high' ? 10 : 8,
				glowSize: hotspot.intensity === 'critical' ? 20 : hotspot.intensity === 'high' ? 16 : 12,
				desc: `Forecast: ${hotspot.forecastedFatalities} fatalities/month (${hotspot.fatalityProbability}% probability) - ${hotspot.forecastMonth}`
			}
		}));

		return { type: 'FeatureCollection', features };
	}

	// Generate GeoJSON for VIEWS conflict tension arcs
	function getConflictArcsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.smartHotspots.visible || !conflictData) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = [];

		for (const arc of conflictData.arcs) {
			// Generate arc coordinates using the same geodesic algorithm as existing arcs
			const coords = generateArcCoordinates(
				[arc.from.lon, arc.from.lat],
				[arc.to.lon, arc.to.lat],
				40
			);

			features.push({
				type: 'Feature',
				geometry: { type: 'LineString', coordinates: coords },
				properties: {
					id: arc.id,
					type: 'views-arc',
					from: arc.from.name,
					to: arc.to.name,
					color: arc.color,
					intensity: arc.intensity,
					description: arc.description,
					glowColor: `${arc.color}66` // Add alpha for glow
				}
			});
		}

		return { type: 'FeatureCollection', features };
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

	// Update all map layers - now includes type-specific marker sources
	function updateMapLayers() {
		if (!map || !isInitialized) return;

		try {
			// Update main points source (for interactivity)
			const pointsSource = map.getSource('points') as mapboxgl.GeoJSONSource;
			if (pointsSource) pointsSource.setData(getPointsGeoJSON());

			// Update type-specific marker sources
			const hotspotsSource = map.getSource('hotspots') as mapboxgl.GeoJSONSource;
			if (hotspotsSource) hotspotsSource.setData(getHotspotsGeoJSON());

			const chokepointsSource = map.getSource('chokepoints') as mapboxgl.GeoJSONSource;
			if (chokepointsSource) chokepointsSource.setData(getChokepointsGeoJSON());

			const cablesSource = map.getSource('cables') as mapboxgl.GeoJSONSource;
			if (cablesSource) cablesSource.setData(getCablesGeoJSON());

			const nuclearSource = map.getSource('nuclear') as mapboxgl.GeoJSONSource;
			if (nuclearSource) nuclearSource.setData(getNuclearGeoJSON());

			const militarySource = map.getSource('military') as mapboxgl.GeoJSONSource;
			if (militarySource) militarySource.setData(getMilitaryGeoJSON());

			const monitorsSource = map.getSource('monitors') as mapboxgl.GeoJSONSource;
			if (monitorsSource) monitorsSource.setData(getMonitorsGeoJSON());

			// Update other sources
			const arcsSource = map.getSource('arcs') as mapboxgl.GeoJSONSource;
			if (arcsSource) arcsSource.setData(getArcsGeoJSON());

			const arcParticlesSource = map.getSource('arc-particles') as mapboxgl.GeoJSONSource;
			if (arcParticlesSource) arcParticlesSource.setData(getArcParticlesGeoJSON());

			const ringsSource = map.getSource('pulsing-rings') as mapboxgl.GeoJSONSource;
			if (ringsSource) ringsSource.setData(getPulsingRingsGeoJSON());

			const labelsSource = map.getSource('labels') as mapboxgl.GeoJSONSource;
			if (labelsSource) labelsSource.setData(getLabelsGeoJSON());

			const newsSource = map.getSource('news-events') as mapboxgl.GeoJSONSource;
			if (newsSource) newsSource.setData(getNewsEventsGeoJSON());

			const outagesSource = map.getSource('outages') as mapboxgl.GeoJSONSource;
			if (outagesSource) outagesSource.setData(getOutagesGeoJSON());

			const outageRadiusSource = map.getSource('outage-radius') as mapboxgl.GeoJSONSource;
			if (outageRadiusSource) outageRadiusSource.setData(getOutageRadiusGeoJSON());

			// Update UCDP conflict sources (Smart Hotspots)
			const conflictHotspotsSource = map.getSource('ucdp-hotspots') as mapboxgl.GeoJSONSource;
			if (conflictHotspotsSource) conflictHotspotsSource.setData(getConflictHotspotsGeoJSON());

			const conflictArcsSource = map.getSource('ucdp-arcs') as mapboxgl.GeoJSONSource;
			if (conflictArcsSource) conflictArcsSource.setData(getConflictArcsGeoJSON());
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
		// Only resume if user has explicitly enabled rotation via the play button
		if (!userEnabledRotation) return;
		isRotating = true;
		startRotation();
	}

	// Toggle rotation from UI button
	function toggleRotation() {
		if (isRotating) {
			userEnabledRotation = false;
			pauseRotation();
		} else {
			userEnabledRotation = true;
			isRotating = true;
			startRotation();
		}
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
						},
						'mapbox-streets': {
							type: 'vector',
							url: 'mapbox://mapbox.mapbox-streets-v8'
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
						},
						// Country borders
						{
							id: 'admin-0-boundary',
							type: 'line',
							source: 'mapbox-streets',
							'source-layer': 'admin',
							filter: ['all', ['==', ['get', 'admin_level'], 0], ['==', ['get', 'disputed'], 'false'], ['==', ['get', 'maritime'], 'false']],
							paint: {
								'line-color': 'rgba(100, 116, 139, 0.6)',
								'line-width': 1,
								'line-dasharray': [2, 1]
							}
						},
						// Disputed borders
						{
							id: 'admin-0-boundary-disputed',
							type: 'line',
							source: 'mapbox-streets',
							'source-layer': 'admin',
							filter: ['all', ['==', ['get', 'admin_level'], 0], ['==', ['get', 'disputed'], 'true']],
							paint: {
								'line-color': 'rgba(239, 68, 68, 0.4)',
								'line-width': 1,
								'line-dasharray': [3, 2]
							}
						},
						// Country labels
						{
							id: 'country-labels',
							type: 'symbol',
							source: 'mapbox-streets',
							'source-layer': 'place_label',
							filter: ['==', ['get', 'class'], 'country'],
							layout: {
								'text-field': ['get', 'name_en'],
								'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
								'text-size': ['interpolate', ['linear'], ['zoom'], 1, 8, 4, 12, 8, 16],
								'text-transform': 'uppercase',
								'text-letter-spacing': 0.1,
								'text-max-width': 8
							},
							paint: {
								'text-color': 'rgba(148, 163, 184, 0.7)',
								'text-halo-color': 'rgba(0, 0, 0, 0.8)',
								'text-halo-width': 1.5
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

				// Add all sources - now with separate sources for each marker type
				map.addSource('points', { type: 'geojson', data: getPointsGeoJSON() });
				map.addSource('hotspots', { type: 'geojson', data: getHotspotsGeoJSON() });
				map.addSource('chokepoints', { type: 'geojson', data: getChokepointsGeoJSON() });
				map.addSource('cables', { type: 'geojson', data: getCablesGeoJSON() });
				map.addSource('nuclear', { type: 'geojson', data: getNuclearGeoJSON() });
				map.addSource('military', { type: 'geojson', data: getMilitaryGeoJSON() });
				map.addSource('monitors', { type: 'geojson', data: getMonitorsGeoJSON() });
				map.addSource('arcs', { type: 'geojson', data: getArcsGeoJSON() });
				map.addSource('arc-particles', { type: 'geojson', data: getArcParticlesGeoJSON() });
				map.addSource('pulsing-rings', { type: 'geojson', data: getPulsingRingsGeoJSON() });
				map.addSource('labels', { type: 'geojson', data: getLabelsGeoJSON() });
				map.addSource('news-events', {
					type: 'geojson',
					data: getNewsEventsGeoJSON(),
					cluster: true,
					clusterRadius: 50,
					clusterMaxZoom: 14,
					clusterProperties: {
						hasAlerts: ['any', ['get', 'hasAlerts']]
					}
				});
				map.addSource('outages', { type: 'geojson', data: getOutagesGeoJSON() });
				map.addSource('outage-radius', { type: 'geojson', data: getOutageRadiusGeoJSON() });

				// UCDP Conflict sources (Smart Hotspots)
				map.addSource('ucdp-hotspots', { type: 'geojson', data: getConflictHotspotsGeoJSON() });
				map.addSource('ucdp-arcs', { type: 'geojson', data: getConflictArcsGeoJSON() });

				// Add layers

				// ========== ARC LAYERS - Threat corridor visualization (subtle styling) ==========
				// Layer 1: Outer glow (widest, most diffuse) - subtle halo
				map.addLayer({
					id: 'arcs-glow-outer',
					type: 'line',
					source: 'arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 16,
						'line-opacity': 0.08,
						'line-blur': 8
					}
				});

				// Layer 2: Middle glow
				map.addLayer({
					id: 'arcs-glow-middle',
					type: 'line',
					source: 'arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 10,
						'line-opacity': 0.15,
						'line-blur': 4
					}
				});

				// Layer 3: Inner glow
				map.addLayer({
					id: 'arcs-glow-inner',
					type: 'line',
					source: 'arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 5,
						'line-opacity': 0.3,
						'line-blur': 1.5
					}
				});

				// Layer 4: Main arc line - solid colored core
				map.addLayer({
					id: 'arcs-main',
					type: 'line',
					source: 'arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 2.5,
						'line-opacity': 0.9
					}
				});

				// Layer 5: White highlight center line - gives depth
				map.addLayer({
					id: 'arcs-highlight',
					type: 'line',
					source: 'arcs',
					paint: {
						'line-color': '#ffffff',
						'line-width': 1,
						'line-opacity': 0.5
					}
				});

				// ========== ARC PARTICLES - Hidden (per user request) ==========
				// Particle layers are kept but invisible for potential future use

				// Particle outer glow (hidden)
				map.addLayer({
					id: 'arc-particles-glow-outer',
					type: 'circle',
					source: 'arc-particles',
					paint: {
						'circle-radius': 0,
						'circle-color': ['get', 'color'],
						'circle-opacity': 0,
						'circle-blur': 1
					}
				});

				// Particle middle glow (hidden)
				map.addLayer({
					id: 'arc-particles-glow-middle',
					type: 'circle',
					source: 'arc-particles',
					paint: {
						'circle-radius': 0,
						'circle-color': ['get', 'color'],
						'circle-opacity': 0,
						'circle-blur': 0.5
					}
				});

				// Particle core (hidden)
				map.addLayer({
					id: 'arc-particles-core',
					type: 'circle',
					source: 'arc-particles',
					paint: {
						'circle-radius': 0,
						'circle-color': ['get', 'color'],
						'circle-opacity': 0,
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 0,
						'circle-stroke-opacity': 0
					}
				});

				// Particle bright center dot (hidden)
				map.addLayer({
					id: 'arc-particles-center',
					type: 'circle',
					source: 'arc-particles',
					paint: {
						'circle-radius': 0,
						'circle-color': '#ffffff',
						'circle-opacity': 0
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

				// ========== NEWS CLUSTERING LAYERS ==========
				// Cluster outer glow
				map.addLayer({
					id: 'news-cluster-glow',
					type: 'circle',
					source: 'news-events',
					filter: ['has', 'point_count'],
					paint: {
						'circle-radius': [
							'step',
							['get', 'point_count'],
							20, // base radius
							5, 25, // >= 5 points
							10, 30, // >= 10 points
							25, 35 // >= 25 points
						],
						'circle-color': [
							'case',
							['get', 'hasAlerts'],
							'#ef4444', // red if has alerts
							'#3b82f6' // blue default
						],
						'circle-opacity': 0.25,
						'circle-blur': 1
					}
				});

				// Cluster circles
				map.addLayer({
					id: 'news-clusters',
					type: 'circle',
					source: 'news-events',
					filter: ['has', 'point_count'],
					paint: {
						'circle-radius': [
							'step',
							['get', 'point_count'],
							15, // base radius
							5, 18, // >= 5 points
							10, 22, // >= 10 points
							25, 26 // >= 25 points
						],
						'circle-color': [
							'case',
							['get', 'hasAlerts'],
							'#ef4444', // red if has alerts
							'#3b82f6' // blue default
						],
						'circle-opacity': 0.85,
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 2,
						'circle-stroke-opacity': 0.6
					}
				});

				// Cluster count labels
				map.addLayer({
					id: 'news-cluster-count',
					type: 'symbol',
					source: 'news-events',
					filter: ['has', 'point_count'],
					layout: {
						'text-field': '{point_count_abbreviated}',
						'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
						'text-size': 12,
						'text-allow-overlap': true
					},
					paint: {
						'text-color': '#ffffff'
					}
				});

				// Individual news points (non-clustered) - glow
				map.addLayer({
					id: 'news-events-glow',
					type: 'circle',
					source: 'news-events',
					filter: ['!', ['has', 'point_count']],
					paint: {
						'circle-radius': ['*', ['get', 'size'], 1.8],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['*', ['get', 'opacity'], 0.3],
						'circle-blur': 1
					}
				});

				// Individual news points (non-clustered) - main
				map.addLayer({
					id: 'news-events-layer',
					type: 'circle',
					source: 'news-events',
					filter: ['!', ['has', 'point_count']],
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 8],
						'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
						'circle-opacity': ['coalesce', ['get', 'opacity'], 0.8],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1,
						'circle-stroke-opacity': 0.5
					}
				});

				// Outage radius area - shows affected region
				map.addLayer({
					id: 'outage-radius-fill',
					type: 'fill',
					source: 'outage-radius',
					paint: {
						'fill-color': ['get', 'color'],
						'fill-opacity': 0.08
					}
				});

				// Outage radius border
				map.addLayer({
					id: 'outage-radius-border',
					type: 'line',
					source: 'outage-radius',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 1.5,
						'line-opacity': 0.4,
						'line-dasharray': [4, 2]
					}
				});

				// Outage layer - outer pulsing ring for visibility
				map.addLayer({
					id: 'outages-pulse',
					type: 'circle',
					source: 'outages',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 2],
						'circle-color': ['get', 'color'],
						'circle-opacity': 0.15,
						'circle-blur': 1
					}
				});

				// Outage layer - inner glow
				map.addLayer({
					id: 'outages-glow',
					type: 'circle',
					source: 'outages',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 1.5],
						'circle-color': ['get', 'color'],
						'circle-opacity': 0.3,
						'circle-blur': 0.5
					}
				});

				// Outage layer - main marker
				map.addLayer({
					id: 'outages-layer',
					type: 'circle',
					source: 'outages',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 10],
						'circle-color': ['get', 'color'],
						'circle-opacity': 0.8,
						'circle-stroke-color': '#1e1b4b',
						'circle-stroke-width': 2,
						'circle-stroke-opacity': 0.9
					}
				});

				// Outage layer - icon symbols
				map.addLayer({
					id: 'outages-icons',
					type: 'symbol',
					source: 'outages',
					layout: {
						'text-field': ['get', 'icon'],
						'text-size': 14,
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(0, 0, 0, 0.8)',
						'text-halo-width': 1
					}
				});

				// ========== CABLE LANDINGS - Small emerald markers for digital infrastructure ==========
				// Outer glow
				map.addLayer({
					id: 'cables-glow-outer',
					type: 'circle',
					source: 'cables',
					paint: {
						'circle-radius': ['coalesce', ['get', 'glowSize'], 10],
						'circle-color': ['coalesce', ['get', 'color'], '#10b981'],
						'circle-opacity': 0.1,
						'circle-blur': 1
					}
				});
				// Inner glow
				map.addLayer({
					id: 'cables-glow-inner',
					type: 'circle',
					source: 'cables',
					paint: {
						'circle-radius': ['*', ['coalesce', ['get', 'size'], 6], 1.3],
						'circle-color': ['coalesce', ['get', 'color'], '#10b981'],
						'circle-opacity': 0.25,
						'circle-blur': 0.5
					}
				});
				// Main marker
				map.addLayer({
					id: 'cables-layer',
					type: 'circle',
					source: 'cables',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 6],
						'circle-color': ['coalesce', ['get', 'innerColor'], '#059669'],
						'circle-stroke-color': ['coalesce', ['get', 'color'], '#10b981'],
						'circle-stroke-width': ['coalesce', ['get', 'strokeWidth'], 1.5],
						'circle-stroke-opacity': 0.9
					}
				});

				// ========== MILITARY BASES - Blue star markers for defense installations ==========
				// Outer glow
				map.addLayer({
					id: 'military-glow-outer',
					type: 'circle',
					source: 'military',
					paint: {
						'circle-radius': ['coalesce', ['get', 'glowSize'], 14],
						'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
						'circle-opacity': 0.12,
						'circle-blur': 1
					}
				});
				// Inner glow
				map.addLayer({
					id: 'military-glow-inner',
					type: 'circle',
					source: 'military',
					paint: {
						'circle-radius': ['*', ['coalesce', ['get', 'size'], 8], 1.4],
						'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
						'circle-opacity': 0.3,
						'circle-blur': 0.4
					}
				});
				// Main marker
				map.addLayer({
					id: 'military-layer',
					type: 'circle',
					source: 'military',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 8],
						'circle-color': ['coalesce', ['get', 'innerColor'], '#2563eb'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': ['coalesce', ['get', 'strokeWidth'], 1.5],
						'circle-stroke-opacity': 0.6
					}
				});
				// Icon symbol
				map.addLayer({
					id: 'military-icons',
					type: 'symbol',
					source: 'military',
					layout: {
						'text-field': ['coalesce', ['get', 'icon'], '✦'],
						'text-size': 10,
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(37, 99, 235, 0.8)',
						'text-halo-width': 1
					}
				});

				// ========== CHOKEPOINTS - Cyan diamond markers for maritime strategic routes ==========
				// Outer glow
				map.addLayer({
					id: 'chokepoints-glow-outer',
					type: 'circle',
					source: 'chokepoints',
					paint: {
						'circle-radius': ['coalesce', ['get', 'glowSize'], 16],
						'circle-color': ['coalesce', ['get', 'color'], '#06b6d4'],
						'circle-opacity': 0.15,
						'circle-blur': 1
					}
				});
				// Inner glow
				map.addLayer({
					id: 'chokepoints-glow-inner',
					type: 'circle',
					source: 'chokepoints',
					paint: {
						'circle-radius': ['*', ['coalesce', ['get', 'size'], 9], 1.4],
						'circle-color': ['coalesce', ['get', 'color'], '#06b6d4'],
						'circle-opacity': 0.35,
						'circle-blur': 0.4
					}
				});
				// Main marker - diamond shape via rotated square stroke
				map.addLayer({
					id: 'chokepoints-layer',
					type: 'circle',
					source: 'chokepoints',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 9],
						'circle-color': 'rgba(6, 182, 212, 0.15)', // Semi-transparent fill
						'circle-stroke-color': ['coalesce', ['get', 'color'], '#06b6d4'],
						'circle-stroke-width': ['coalesce', ['get', 'strokeWidth'], 2],
						'circle-stroke-opacity': 1
					}
				});
				// Icon symbol
				map.addLayer({
					id: 'chokepoints-icons',
					type: 'symbol',
					source: 'chokepoints',
					layout: {
						'text-field': '⛵',
						'text-size': 11,
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#06b6d4',
						'text-halo-color': 'rgba(0, 0, 0, 0.8)',
						'text-halo-width': 1.5
					}
				});

				// ========== NUCLEAR SITES - Orange warning markers with radiation symbol ==========
				// Outer warning glow
				map.addLayer({
					id: 'nuclear-glow-outer',
					type: 'circle',
					source: 'nuclear',
					paint: {
						'circle-radius': ['coalesce', ['get', 'glowSize'], 18],
						'circle-color': ['coalesce', ['get', 'color'], '#f97316'],
						'circle-opacity': 0.18,
						'circle-blur': 1.2
					}
				});
				// Inner glow
				map.addLayer({
					id: 'nuclear-glow-inner',
					type: 'circle',
					source: 'nuclear',
					paint: {
						'circle-radius': ['*', ['coalesce', ['get', 'size'], 10], 1.5],
						'circle-color': ['coalesce', ['get', 'color'], '#f97316'],
						'circle-opacity': 0.4,
						'circle-blur': 0.5
					}
				});
				// Main marker
				map.addLayer({
					id: 'nuclear-layer',
					type: 'circle',
					source: 'nuclear',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 10],
						'circle-color': ['coalesce', ['get', 'innerColor'], '#ea580c'],
						'circle-stroke-color': '#fbbf24', // Amber warning border
						'circle-stroke-width': ['coalesce', ['get', 'strokeWidth'], 2],
						'circle-stroke-opacity': 0.9
					}
				});
				// Radiation symbol
				map.addLayer({
					id: 'nuclear-icons',
					type: 'symbol',
					source: 'nuclear',
					layout: {
						'text-field': '☢',
						'text-size': 12,
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#fef3c7', // Amber-100 for visibility
						'text-halo-color': 'rgba(234, 88, 12, 0.9)',
						'text-halo-width': 1
					}
				});

				// ========== CUSTOM MONITORS - User-defined watch markers ==========
				// Outer glow
				map.addLayer({
					id: 'monitors-glow-outer',
					type: 'circle',
					source: 'monitors',
					paint: {
						'circle-radius': ['coalesce', ['get', 'glowSize'], 16],
						'circle-color': ['coalesce', ['get', 'color'], '#06b6d4'],
						'circle-opacity': 0.15,
						'circle-blur': 1
					}
				});
				// Inner glow
				map.addLayer({
					id: 'monitors-glow-inner',
					type: 'circle',
					source: 'monitors',
					paint: {
						'circle-radius': ['*', ['coalesce', ['get', 'size'], 10], 1.4],
						'circle-color': ['coalesce', ['get', 'color'], '#06b6d4'],
						'circle-opacity': 0.35,
						'circle-blur': 0.4
					}
				});
				// Main marker
				map.addLayer({
					id: 'monitors-layer',
					type: 'circle',
					source: 'monitors',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 10],
						'circle-color': ['coalesce', ['get', 'innerColor'], '#0891b2'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': ['coalesce', ['get', 'strokeWidth'], 2],
						'circle-stroke-opacity': 0.7
					}
				});
				// Target icon
				map.addLayer({
					id: 'monitors-icons',
					type: 'symbol',
					source: 'monitors',
					layout: {
						'text-field': '◎',
						'text-size': 12,
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(8, 145, 178, 0.8)',
						'text-halo-width': 1
					}
				});

				// ========== HOTSPOTS - Main geopolitical threat markers (highest priority) ==========
				// Outer glow - dramatic for critical/high threats
				map.addLayer({
					id: 'hotspots-glow-outer',
					type: 'circle',
					source: 'hotspots',
					paint: {
						'circle-radius': ['coalesce', ['get', 'glowSize'], 18],
						'circle-color': ['coalesce', ['get', 'color'], '#ef4444'],
						'circle-opacity': ['case',
							['==', ['get', 'level'], 'critical'], 0.35,
							['==', ['get', 'level'], 'high'], 0.25,
							0.15
						],
						'circle-blur': 1.5
					}
				});
				// Middle glow ring
				map.addLayer({
					id: 'hotspots-glow-middle',
					type: 'circle',
					source: 'hotspots',
					paint: {
						'circle-radius': ['*', ['coalesce', ['get', 'size'], 12], 1.6],
						'circle-color': ['coalesce', ['get', 'color'], '#ef4444'],
						'circle-opacity': ['case',
							['==', ['get', 'level'], 'critical'], 0.4,
							['==', ['get', 'level'], 'high'], 0.3,
							0.2
						],
						'circle-blur': 0.8
					}
				});
				// Inner glow
				map.addLayer({
					id: 'hotspots-glow-inner',
					type: 'circle',
					source: 'hotspots',
					paint: {
						'circle-radius': ['*', ['coalesce', ['get', 'size'], 12], 1.2],
						'circle-color': ['coalesce', ['get', 'color'], '#ef4444'],
						'circle-opacity': 0.5,
						'circle-blur': 0.3
					}
				});
				// Main marker
				map.addLayer({
					id: 'hotspots-layer',
					type: 'circle',
					source: 'hotspots',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 12],
						'circle-color': ['coalesce', ['get', 'color'], '#ef4444'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': ['coalesce', ['get', 'strokeWidth'], 2],
						'circle-stroke-opacity': 0.8
					}
				});
				// Alert icon for hotspots with alerts
				map.addLayer({
					id: 'hotspots-alert-icon',
					type: 'symbol',
					source: 'hotspots',
					filter: ['==', ['get', 'hasAlert'], true],
					layout: {
						'text-field': '⚠',
						'text-size': 11,
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#fef3c7',
						'text-halo-color': 'rgba(0, 0, 0, 0.9)',
						'text-halo-width': 1.5
					}
				});

				// ========== UCDP CONFLICT LAYERS - Smart Hotspots (armed conflict data) ==========
				// Arc outer glow
				map.addLayer({
					id: 'ucdp-arcs-glow-outer',
					type: 'line',
					source: 'ucdp-arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 14,
						'line-opacity': 0.1,
						'line-blur': 6
					}
				});

				// Arc middle glow
				map.addLayer({
					id: 'ucdp-arcs-glow-middle',
					type: 'line',
					source: 'ucdp-arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 8,
						'line-opacity': 0.2,
						'line-blur': 3
					}
				});

				// Arc inner glow
				map.addLayer({
					id: 'ucdp-arcs-glow-inner',
					type: 'line',
					source: 'ucdp-arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 4,
						'line-opacity': 0.35,
						'line-blur': 1
					}
				});

				// Main arc line
				map.addLayer({
					id: 'ucdp-arcs-main',
					type: 'line',
					source: 'ucdp-arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 2,
						'line-opacity': 0.8
					}
				});

				// UCDP Conflict hotspot outer glow
				map.addLayer({
					id: 'ucdp-hotspots-glow-outer',
					type: 'circle',
					source: 'ucdp-hotspots',
					paint: {
						'circle-radius': ['coalesce', ['get', 'glowSize'], 16],
						'circle-color': ['coalesce', ['get', 'color'], '#ef4444'],
						'circle-opacity': ['case',
							['==', ['get', 'intensity'], 'critical'], 0.3,
							['==', ['get', 'intensity'], 'high'], 0.25,
							0.15
						],
						'circle-blur': 1.2
					}
				});

				// UCDP Conflict hotspot middle glow
				map.addLayer({
					id: 'ucdp-hotspots-glow-middle',
					type: 'circle',
					source: 'ucdp-hotspots',
					paint: {
						'circle-radius': ['*', ['coalesce', ['get', 'size'], 10], 1.5],
						'circle-color': ['coalesce', ['get', 'color'], '#ef4444'],
						'circle-opacity': ['case',
							['==', ['get', 'intensity'], 'critical'], 0.4,
							['==', ['get', 'intensity'], 'high'], 0.35,
							0.25
						],
						'circle-blur': 0.6
					}
				});

				// UCDP Conflict hotspot main marker
				map.addLayer({
					id: 'ucdp-hotspots-layer',
					type: 'circle',
					source: 'ucdp-hotspots',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 10],
						'circle-color': ['coalesce', ['get', 'color'], '#ef4444'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1.5,
						'circle-stroke-opacity': 0.7
					}
				});

				// UCDP Conflict icon (crossed swords)
				map.addLayer({
					id: 'ucdp-hotspots-icon',
					type: 'symbol',
					source: 'ucdp-hotspots',
					layout: {
						'text-field': '⚔',
						'text-size': 10,
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(0, 0, 0, 0.8)',
						'text-halo-width': 1
					}
				});

				// Legacy points layers for backward compatibility (now mainly used by interactivity)
				map.addLayer({
					id: 'points-glow',
					type: 'circle',
					source: 'points',
					paint: {
						'circle-radius': 0, // Hidden - use type-specific layers instead
						'circle-color': 'transparent',
						'circle-opacity': 0
					}
				});

				map.addLayer({
					id: 'points-layer',
					type: 'circle',
					source: 'points',
					paint: {
						'circle-radius': ['coalesce', ['get', 'size'], 8],
						'circle-color': 'transparent', // Transparent - visual handled by type-specific layers
						'circle-opacity': 0 // Invisible but interactive
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
						// Use readable light color instead of threat color (red is hard to read)
						'text-color': '#fef3c7',
						'text-halo-color': 'rgba(0, 0, 0, 0.9)',
						'text-halo-width': 1.5
					}
				});

				// Ensure labels layer doesn't capture pointer events
				map.on('mouseenter', 'labels-layer', () => {});
				map.on('mouseleave', 'labels-layer', () => {});

				setupInteractivity();
				// Globe starts paused - user must click play to start rotation
				isInitialized = true;
				// Start polling for data changes
				startMapUpdatePolling();
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

		// Interactive layers for cursor and click handling
		// Includes both the main points-layer (transparent for clicks) and type-specific visible layers
		const interactiveLayers = [
			'points-layer',
			'hotspots-layer',
			'chokepoints-layer',
			'cables-layer',
			'nuclear-layer',
			'military-layer',
			'monitors-layer',
			'news-events-layer',
			'outages-layer',
			'news-clusters',
			'ucdp-hotspots-layer' // UCDP conflict markers
		];

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

			let recentNews: Array<{ title: string; link?: string }> = [];
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

			let recentNews: Array<{ title: string; link?: string }> = [];
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

		map.on('mousemove', 'outages-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			// Check if this is a carbon intensity event (WattTime data - NOT grid stress)
			const isCarbonIntensity = props?.isCarbonIntensity || props?.source === 'WattTime Carbon Intensity' || props?.source === 'WattTime Grid Monitor';

			let label: string;
			let desc: string;
			let level: string;
			let isAlert: boolean;

			if (isCarbonIntensity) {
				// Carbon intensity hover tooltip (NOT grid stress - this is emissions data)
				const intensityLevel = props?.gridStressLevel || 'elevated';
				const intensityPercent = props?.gridStressPercent ? `${Math.round(props.gridStressPercent)}th percentile` : '';

				label = props?.label || 'Grid Region';
				desc = `Carbon Intensity: ${intensityPercent || intensityLevel} (emissions, not reliability)`;
				level = intensityLevel;
				// Only flag as alert for truly extreme emissions (98th+ percentile)
				isAlert = intensityLevel === 'critical';
			} else {
				// Regular outage hover tooltip
				const affectedPop = props?.affectedPopulation
					? `~${(props.affectedPopulation / 1000000).toFixed(1)}M people affected`
					: '';

				label = props?.label || '';
				desc = `${props?.desc || ''}${affectedPop ? ` — ${affectedPop}` : ''}`;
				level = props?.severity;
				isAlert = props?.severity === 'total';
			}

			tooltipData = {
				label,
				type: 'outage',
				desc,
				level,
				isAlert
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		// UCDP Conflict hotspot tooltip
		map.on('mousemove', 'ucdp-hotspots-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			const violenceType = props?.typeOfViolence === 1 ? 'State-based' : props?.typeOfViolence === 2 ? 'Non-state' : 'One-sided';

			tooltipData = {
				label: props?.conflictName || props?.label || 'Armed Conflict',
				type: 'ucdp-conflict',
				desc: `${props?.sideA || ''} vs ${props?.sideB || ''} (${violenceType})`,
				level: props?.intensity,
				isAlert: props?.intensity === 'critical' || props?.intensity === 'high'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		map.on('mouseleave', 'points-layer', handleMouseLeave);
		map.on('mouseleave', 'news-events-layer', handleMouseLeave);
		map.on('mouseleave', 'outages-layer', handleMouseLeave);
		map.on('mouseleave', 'ucdp-hotspots-layer', handleMouseLeave);

		map.on('click', 'points-layer', (e) => handlePointClick(e));
		map.on('click', 'news-events-layer', (e) => handlePointClick(e));
		map.on('click', 'outages-layer', (e) => handleOutageClick(e));
		map.on('click', 'ucdp-hotspots-layer', (e) => handleConflictClick(e));

		// Cluster click handler - zoom in to expand cluster
		map.on('click', 'news-clusters', (e) => {
			const features = e.features;
			if (!features || features.length === 0 || !map) return;

			const clusterId = features[0].properties?.cluster_id;
			const source = map.getSource('news-events') as mapboxgl.GeoJSONSource;

			source.getClusterExpansionZoom(clusterId, (err, expansionZoom) => {
				if (err || !map || expansionZoom == null) return;

				const geometry = features[0].geometry as GeoJSON.Point;
				map.easeTo({
					center: geometry.coordinates as [number, number],
					zoom: expansionZoom
				});
			});
		});

		map.on('click', (e) => {
			const features = map?.queryRenderedFeatures(e.point, {
				layers: ['points-layer', 'news-events-layer', 'outages-layer', 'news-clusters']
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

		let recentNews: Array<{ title: string; link?: string }> = [];
		let allNews: Array<{ title: string; link?: string; source?: string }> = [];
		try {
			recentNews = props?.recentNews ? JSON.parse(props.recentNews) : [];
		} catch {
			recentNews = [];
		}
		try {
			allNews = props?.allNews ? JSON.parse(props.allNews) : [];
		} catch {
			allNews = [];
		}

		const isFeedNews = props?.type === 'feed-news';
		tooltipExpanded = false; // Reset expansion state when clicking new item
		tooltipData = {
			label: isFeedNews ? `${props?.count || 0} ${props?.categoryLabel || 'News'} Items` : (props?.label || ''),
			type: props?.type || '',
			desc: props?.desc,
			level: props?.level,
			newsCount: props?.newsCount || props?.count || 0,
			recentNews,
			allNews: allNews.length > 0 ? allNews : undefined,
			isAlert: props?.hasAlerts || props?.hasAlert,
			category: props?.category,
			categoryLabel: props?.categoryLabel,
			hotspotName: props?.hotspotName
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	function handleOutageClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;

		const feature = e.features[0];
		const props = feature.properties;

		// Check if this is a carbon intensity event (WattTime data - NOT grid stress)
		const isCarbonIntensity = props?.isCarbonIntensity || props?.source === 'WattTime Carbon Intensity' || props?.source === 'WattTime Grid Monitor';

		let label: string;
		let desc: string;
		let level: string;
		let isAlert: boolean;

		if (isCarbonIntensity) {
			// Carbon intensity tooltip (NOT grid stress - this is emissions data)
			const intensityLevel = props?.gridStressLevel || 'elevated';
			const intensityPercent = props?.gridStressPercent ? `${Math.round(props.gridStressPercent)}th percentile` : '';
			const intensityLevelLabel = intensityLevel.charAt(0).toUpperCase() + intensityLevel.slice(1);

			label = props?.label || 'Grid Region';
			desc = `Carbon Intensity: ${intensityLevelLabel}${intensityPercent ? ` (${intensityPercent})` : ''}. ${props?.desc || ''} Note: This is emissions data, not grid reliability.`;
			level = intensityLevel === 'critical' ? 'critical' : intensityLevel === 'high' ? 'high' : 'elevated';
			// Only flag as alert for truly extreme emissions
			isAlert = intensityLevel === 'critical';
		} else {
			// Regular outage tooltip
			const affectedPop = props?.affectedPopulation
				? `~${(props.affectedPopulation / 1000000).toFixed(1)}M people affected`
				: '';

			const outageTypeLabel = props?.outageType === 'both'
				? 'Internet + Power'
				: props?.outageType === 'internet'
					? 'Internet Blackout'
					: 'Power Outage';

			label = props?.label || '';
			desc = `${outageTypeLabel}. ${props?.desc || ''}${affectedPop ? ` — ${affectedPop}` : ''}`;
			level = props?.severity;
			isAlert = props?.severity === 'total';
		}

		tooltipData = {
			label,
			type: 'outage',
			desc,
			level,
			isAlert
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	function handleConflictClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;

		const feature = e.features[0];
		const props = feature.properties;

		const violenceType = props?.typeOfViolence === 1 ? 'State-based conflict' : props?.typeOfViolence === 2 ? 'Non-state conflict' : 'One-sided violence';
		const deathInfo = props?.totalDeaths ? `${props.totalDeaths} deaths` : '';
		const eventInfo = props?.eventCount ? `${props.eventCount} events` : '';
		const dateRange = props?.dateStart && props?.dateEnd ? `${props.dateStart} to ${props.dateEnd}` : '';

		tooltipData = {
			label: props?.conflictName || props?.label || 'Armed Conflict',
			type: 'ucdp-conflict',
			desc: `${props?.sideA || ''} vs ${props?.sideB || ''}\n${violenceType}. ${[deathInfo, eventInfo].filter(Boolean).join(', ')}${dateRange ? ` (${dateRange})` : ''}`,
			level: props?.intensity,
			isAlert: props?.intensity === 'critical' || props?.intensity === 'high'
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

	// =============================================================================
	// MAP UPDATE SYSTEM - Using interval-based polling instead of $effect
	// This avoids Svelte 5's fine-grained reactivity causing infinite loops
	// =============================================================================

	// Track last update timestamps to detect changes
	let lastUpdateKey = '';
	let mapUpdateInterval: ReturnType<typeof setInterval> | null = null;

	// Start polling for updates after map initializes
	function startMapUpdatePolling() {
		if (mapUpdateInterval) return;

		mapUpdateInterval = setInterval(() => {
			if (!map || !isInitialized) return;

			// Create a key from current data state
			const currentKey = [
				monitors?.length ?? 0,
				news?.length ?? 0,
				outageData?.length ?? 0,
				dataLayers.hotspots.visible,
				dataLayers.chokepoints.visible,
				dataLayers.cables.visible,
				dataLayers.nuclear.visible,
				dataLayers.military.visible,
				dataLayers.outages.visible,
				dataLayers.monitors.visible,
				dataLayers.news.visible,
				dataLayers.arcs.visible,
				dataLayers.smartHotspots.visible,
				newsTTL,
				newsTimeFilter,
				showAlertsOnly
			].join(',');

			// Only update if something changed
			if (currentKey !== lastUpdateKey) {
				lastUpdateKey = currentKey;
				updateMapLayers();
			}
		}, 500); // Poll every 500ms
	}

	function stopMapUpdatePolling() {
		if (mapUpdateInterval) {
			clearInterval(mapUpdateInterval);
			mapUpdateInterval = null;
		}
	}

	// UCDP Conflict loading - manual trigger only, no reactive effects
	// The loadConflictData function is called when the Smart Hotspots toggle is clicked
	// See the toggle handler in the UI section below

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

	// Animate enhanced marker glow effects for visual hierarchy
	$effect(() => {
		if (!map || !isInitialized) return;

		let markerPhase = 0;
		const markerInterval = setInterval(() => {
			if (!map) return;
			markerPhase = (markerPhase + 1) % 120;

			try {
				// Hotspots - dramatic pulsing glow (critical threats pulse faster)
				const hotspotOuterOpacity = 0.15 + Math.sin((markerPhase / 40) * Math.PI * 2) * 0.15;
				const hotspotMiddleOpacity = 0.2 + Math.sin((markerPhase / 30) * Math.PI * 2) * 0.15;
				map.setPaintProperty('hotspots-glow-outer', 'circle-opacity', ['case',
					['==', ['get', 'level'], 'critical'], hotspotOuterOpacity + 0.2,
					['==', ['get', 'level'], 'high'], hotspotOuterOpacity + 0.1,
					hotspotOuterOpacity
				]);
				map.setPaintProperty('hotspots-glow-middle', 'circle-opacity', ['case',
					['==', ['get', 'level'], 'critical'], hotspotMiddleOpacity + 0.2,
					['==', ['get', 'level'], 'high'], hotspotMiddleOpacity + 0.1,
					hotspotMiddleOpacity
				]);

				// Nuclear sites - warning pulse
				const nuclearPulse = Math.sin((markerPhase / 25) * Math.PI * 2);
				const nuclearOuterOpacity = 0.15 + nuclearPulse * 0.12;
				const nuclearInnerOpacity = 0.35 + nuclearPulse * 0.15;
				map.setPaintProperty('nuclear-glow-outer', 'circle-opacity', nuclearOuterOpacity);
				map.setPaintProperty('nuclear-glow-inner', 'circle-opacity', nuclearInnerOpacity);

				// Chokepoints - subtle wave effect
				const chokePulse = Math.sin((markerPhase / 60) * Math.PI * 2);
				const chokeOuterOpacity = 0.12 + chokePulse * 0.08;
				map.setPaintProperty('chokepoints-glow-outer', 'circle-opacity', chokeOuterOpacity);

				// Monitors - watch indicator pulse
				const monitorPulse = Math.sin((markerPhase / 45) * Math.PI * 2);
				const monitorOpacity = 0.12 + monitorPulse * 0.1;
				map.setPaintProperty('monitors-glow-outer', 'circle-opacity', monitorOpacity);

				// Cables - very subtle breathing
				const cablePulse = Math.sin((markerPhase / 80) * Math.PI * 2);
				const cableOpacity = 0.08 + cablePulse * 0.05;
				map.setPaintProperty('cables-glow-outer', 'circle-opacity', cableOpacity);
			} catch {
				// Layers might not exist yet
			}
		}, 40);

		return () => clearInterval(markerInterval);
	});

	// Animate threat corridor arcs - pulsing glow and moving particles
	$effect(() => {
		if (!map || !isInitialized) return;

		let arcPhase = 0;

		// Arc glow pulsing animation - subtle breathing effect
		const arcGlowInterval = setInterval(() => {
			if (!map || !dataLayers.arcs.visible) return;
			arcPhase = (arcPhase + 2) % 360;

			try {
				// Outer glow breathing - subtle
				const outerGlowOpacity = 0.06 + Math.sin((arcPhase / 90) * Math.PI) * 0.04;
				const outerGlowWidth = 14 + Math.sin((arcPhase / 90) * Math.PI) * 4;
				map.setPaintProperty('arcs-glow-outer', 'line-opacity', outerGlowOpacity);
				map.setPaintProperty('arcs-glow-outer', 'line-width', outerGlowWidth);

				// Middle glow breathing
				const middleGlowOpacity = 0.12 + Math.sin((arcPhase / 60) * Math.PI) * 0.06;
				const middleGlowWidth = 8 + Math.sin((arcPhase / 60) * Math.PI) * 3;
				map.setPaintProperty('arcs-glow-middle', 'line-opacity', middleGlowOpacity);
				map.setPaintProperty('arcs-glow-middle', 'line-width', middleGlowWidth);

				// Inner glow subtle pulse
				const innerGlowOpacity = 0.25 + Math.sin((arcPhase / 45) * Math.PI) * 0.1;
				map.setPaintProperty('arcs-glow-inner', 'line-opacity', innerGlowOpacity);

				// Main arc line subtle width pulse
				const mainWidth = 2.3 + Math.sin((arcPhase / 120) * Math.PI) * 0.5;
				map.setPaintProperty('arcs-main', 'line-width', mainWidth);

				// Highlight shimmer - subtle sparkle effect
				const highlightOpacity = 0.4 + Math.sin((arcPhase / 30) * Math.PI) * 0.2;
				map.setPaintProperty('arcs-highlight', 'line-opacity', highlightOpacity);
			} catch (e) {
				// Layers might not exist yet - this is expected during initialization
			}
		}, 40);

		// Particle intervals removed - particles are hidden per user request
		// Keep source updates for potential future reactivation
		const particleInterval = setInterval(() => {
			// Particles are hidden - no need to animate
		}, 1000);

		const particleGlowInterval = setInterval(() => {
			// Particles are hidden - no need to animate glow
		}, 1000);

		return () => {
			clearInterval(arcGlowInterval);
			clearInterval(particleInterval);
			clearInterval(particleGlowInterval);
		};
	});

	// Animate outage markers with flickering/pulsing effect
	$effect(() => {
		if (!map || !isInitialized) return;

		let outagePhase = 0;
		const outageInterval = setInterval(() => {
			if (!map) return;
			outagePhase = (outagePhase + 1) % 100;

			try {
				// Outer pulse ring expands and fades
				const pulseRadius = 2 + Math.sin((outagePhase / 100) * Math.PI * 2) * 0.8;
				const pulseOpacity = 0.1 + Math.sin((outagePhase / 100) * Math.PI * 2) * 0.1;
				map.setPaintProperty('outages-pulse', 'circle-radius', ['*', ['get', 'size'], pulseRadius]);
				map.setPaintProperty('outages-pulse', 'circle-opacity', pulseOpacity);

				// Glow flicker effect
				const glowOpacity = 0.25 + Math.sin((outagePhase / 50) * Math.PI * 2) * 0.15;
				map.setPaintProperty('outages-glow', 'circle-opacity', glowOpacity);

				// Main marker subtle pulse
				const mainOpacity = 0.7 + Math.sin((outagePhase / 100) * Math.PI * 2) * 0.2;
				map.setPaintProperty('outages-layer', 'circle-opacity', mainOpacity);

				// Radius area pulsing
				const radiusFillOpacity = 0.05 + Math.sin((outagePhase / 100) * Math.PI * 2) * 0.05;
				const radiusBorderOpacity = 0.3 + Math.sin((outagePhase / 100) * Math.PI * 2) * 0.2;
				map.setPaintProperty('outage-radius-fill', 'fill-opacity', radiusFillOpacity);
				map.setPaintProperty('outage-radius-border', 'line-opacity', radiusBorderOpacity);
			} catch {
				// Layers might not exist yet
			}
		}, 30);

		return () => clearInterval(outageInterval);
	});

	// Fetch outage data from real API
	async function loadOutageData() {
		if (outageDataLoading) return;
		outageDataLoading = true;
		try {
			const data = await fetchOutageData();
			outageData = data;
			// Update map layers with new outage data
			if (map && isInitialized) {
				updateMapLayers();
			}
		} catch (error) {
			console.warn('Failed to fetch outage data:', error);
		} finally {
			outageDataLoading = false;
		}
	}

	// Load UCDP conflict data (Smart Hotspots)
	async function loadConflictData() {
		if (conflictDataLoading) return;
		conflictDataLoading = true;
		try {
			const data = await fetchUCDPConflicts();
			conflictData = data;
			// Update map layers with new conflict data
			if (map && isInitialized) {
				updateMapLayers();
			}
		} catch (error) {
			console.warn('Failed to fetch UCDP conflict data:', error);
		} finally {
			conflictDataLoading = false;
		}
	}

	onMount(() => {
		requestAnimationFrame(() => initMap());
		// Fetch outage data immediately
		loadOutageData();
		// Refresh outage data every 5 minutes
		const outageRefreshInterval = setInterval(loadOutageData, 5 * 60 * 1000);
		return () => clearInterval(outageRefreshInterval);
	});

	onDestroy(() => {
		stopRotation();
		stopMapUpdatePolling();
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
				onclick={toggleRotation}
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
						<label class="layer-toggle" class:smart-hotspots={layer === 'smartHotspots'}>
							<input type="checkbox" bind:checked={state.visible} onchange={() => {
								updateMapLayers();
								// Load UCDP conflict data when Smart Hotspots is enabled
								if (layer === 'smartHotspots' && state.visible && !conflictData && !conflictDataLoading) {
									loadConflictData();
								}
							}} />
							<span class="layer-name">
								{#if layer === 'smartHotspots'}
									Smart Hotspots (UCDP)
								{:else}
									{layer.charAt(0).toUpperCase() + layer.slice(1)}
								{/if}
							</span>
							{#if layer === 'smartHotspots' && conflictDataLoading}
								<span class="loading-indicator">...</span>
							{:else if layer === 'smartHotspots' && conflictData}
								<span class="data-count">{conflictData.hotspots.length}</span>
							{/if}
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
								<span class="legend-icon" style="color: #06b6d4;">⛵</span>
								<span class="legend-label">Chokepoint</span>
							</div>
							<div class="legend-item">
								<span class="legend-icon" style="color: #10b981;">◈</span>
								<span class="legend-label">Cable Landing</span>
							</div>
							<div class="legend-item">
								<span class="legend-icon" style="color: #fb923c;">☢</span>
								<span class="legend-label">Nuclear Site</span>
							</div>
							<div class="legend-item">
								<span class="legend-icon" style="color: #60a5fa;">✦</span>
								<span class="legend-label">Military Base</span>
							</div>
						</div>
					</div>
					<div class="legend-section">
						<span class="legend-section-title">OUTAGES</span>
						<div class="legend-items">
							<div class="legend-item">
								<span class="legend-marker outage-total"></span>
								<span class="legend-label">Total Blackout</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker outage-major"></span>
								<span class="legend-label">Major Disruption</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker outage-partial"></span>
								<span class="legend-label">Partial Outage</span>
							</div>
						</div>
					</div>
					<div class="legend-section">
						<span class="legend-section-title">SMART HOTSPOTS (UCDP)</span>
						<div class="legend-items">
							<div class="legend-item">
								<span class="legend-marker conflict-critical"></span>
								<span class="legend-label">Critical Conflict</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker conflict-high"></span>
								<span class="legend-label">High Intensity</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker conflict-medium"></span>
								<span class="legend-label">Medium Intensity</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker conflict-low"></span>
								<span class="legend-label">Low Intensity</span>
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
		<div
			class="globe-tooltip"
			class:locked={tooltipLocked}
			style="left: {tooltipX}px; top: {tooltipY}px;"
		>
			{#if tooltipLocked}
				<button
					class="tooltip-close"
					onclick={() => { tooltipLocked = false; tooltipVisible = false; tooltipData = null; }}
					title="Close"
				>×</button>
			{/if}
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
			{#if tooltipData.hotspotName}
				<div class="tooltip-hotspot">Near {tooltipData.hotspotName}</div>
			{/if}
			{#if tooltipData.recentNews && tooltipData.recentNews.length > 0}
				<div class="tooltip-news" class:expanded={tooltipExpanded}>
					<div class="news-header">
						<span class="news-label">{tooltipExpanded ? 'All Headlines' : 'Recent Headlines'}:</span>
						{#if tooltipData.allNews && tooltipData.allNews.length > 3}
							<button
								class="expand-btn"
								onclick={() => tooltipExpanded = !tooltipExpanded}
							>
								{tooltipExpanded ? 'Show Less' : `Show All (${tooltipData.allNews.length})`}
							</button>
						{/if}
					</div>
					<div class="news-list" class:scrollable={tooltipExpanded}>
						{#each (tooltipExpanded && tooltipData.allNews ? tooltipData.allNews : tooltipData.recentNews) as newsItem}
							{#if typeof newsItem === 'object' && newsItem.link}
								<a
									class="news-headline clickable"
									href={newsItem.link}
									target="_blank"
									rel="noopener noreferrer"
								>
									<span class="news-title">{newsItem.title}</span>
									{#if tooltipExpanded && 'source' in newsItem && newsItem.source}
										<span class="news-source">{newsItem.source}</span>
									{/if}
								</a>
							{:else}
								<div class="news-headline">{typeof newsItem === 'string' ? newsItem : newsItem.title}</div>
							{/if}
						{/each}
					</div>
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

	.layer-toggle.smart-hotspots {
		border-top: 1px solid rgb(51 65 85 / 0.3);
		margin-top: 0.375rem;
		padding-top: 0.375rem;
	}

	.loading-indicator {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(251 191 36);
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.data-count {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(34 211 238);
		background: rgb(34 211 238 / 0.1);
		padding: 0.125rem 0.25rem;
		border-radius: 2px;
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

	.legend-marker.outage-total {
		background: #dc2626;
		box-shadow: 0 0 6px #dc2626;
		animation: outage-pulse 1.5s ease-in-out infinite;
	}

	.legend-marker.outage-major {
		background: #ea580c;
		box-shadow: 0 0 4px #ea580c;
		animation: outage-pulse 2s ease-in-out infinite;
	}

	.legend-marker.outage-partial {
		background: #ca8a04;
		box-shadow: 0 0 3px #ca8a04;
		animation: outage-pulse 2.5s ease-in-out infinite;
	}

	/* UCDP Conflict intensity markers */
	.legend-marker.conflict-critical {
		background: #dc2626;
		box-shadow: 0 0 6px #dc2626;
	}

	.legend-marker.conflict-high {
		background: #ef4444;
		box-shadow: 0 0 5px #ef4444;
	}

	.legend-marker.conflict-medium {
		background: #f97316;
		box-shadow: 0 0 4px #f97316;
	}

	.legend-marker.conflict-low {
		background: #fbbf24;
		box-shadow: 0 0 3px #fbbf24;
	}

	@keyframes outage-pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(1.2);
		}
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

	.globe-tooltip.locked {
		pointer-events: auto;
	}

	.tooltip-close {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(51 65 85 / 0.5);
		border: 1px solid rgb(71 85 105 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tooltip-close:hover {
		background: rgb(71 85 105 / 0.8);
		color: white;
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
		display: block;
		font-size: 0.5625rem;
		color: rgb(203 213 225);
		line-height: 1.3;
		padding: 0.125rem 0;
		border-bottom: 1px solid rgb(51 65 85 / 0.2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-decoration: none;
	}

	.news-headline:last-child {
		border-bottom: none;
	}

	.news-headline.clickable {
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.news-headline.clickable:hover {
		color: rgb(34 211 238);
	}

	.tooltip-hotspot {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184);
		margin-top: 0.25rem;
		padding: 0.125rem 0.25rem;
		background: rgb(30 41 59 / 0.5);
		border-radius: 2px;
		display: inline-block;
	}

	.news-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.expand-btn {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		padding: 0.125rem 0.375rem;
		background: rgb(6 182 212 / 0.15);
		color: rgb(34 211 238);
		border: 1px solid rgb(6 182 212 / 0.3);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.expand-btn:hover {
		background: rgb(6 182 212 / 0.25);
		border-color: rgb(6 182 212 / 0.5);
	}

	.news-list.scrollable {
		max-height: 200px;
		overflow-y: auto;
		padding-right: 0.25rem;
	}

	.news-list.scrollable::-webkit-scrollbar {
		width: 4px;
	}

	.news-list.scrollable::-webkit-scrollbar-track {
		background: rgb(30 41 59 / 0.3);
		border-radius: 2px;
	}

	.news-list.scrollable::-webkit-scrollbar-thumb {
		background: rgb(71 85 105);
		border-radius: 2px;
	}

	.news-list.scrollable::-webkit-scrollbar-thumb:hover {
		background: rgb(100 116 139);
	}

	.tooltip-news.expanded {
		min-width: 280px;
	}

	.news-title {
		display: block;
		flex: 1;
	}

	.news-source {
		display: block;
		font-size: 0.45rem;
		color: rgb(100 116 139);
		margin-top: 0.125rem;
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
