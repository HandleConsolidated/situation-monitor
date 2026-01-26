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
	import { selectedAlert, weather, mapPickerMode } from '$lib/stores';
	import { ALERT_MAP_COLORS } from '$lib/config/weather';
	import type { WeatherAlert } from '$lib/types';
	import { fetchOutageData, fetchUCDPConflicts, fetchAircraftPositions, OpenSkyRateLimitError, getAltitudeColor, formatAltitude, formatVelocity, formatHeading, fetchElevatedVolcanoes, VOLCANO_ALERT_COLORS, VOLCANO_ALERT_DESCRIPTIONS, fetchRadarAnimationData, getShipTypeColor, formatVesselSpeed, formatVesselCourse, getFlagEmoji, fetchAirQualityData, AIR_QUALITY_COLORS, AIR_QUALITY_DESCRIPTIONS, RADIATION_LEVEL_COLORS, fetchAllActiveAlerts, fetchZoneGeometryForAlert, fetchActiveTropicalCyclones, fetchCycloneForecastCone, fetchAllDay1Outlooks } from '$lib/api';
	import type { RadarAnimationData, TropicalCyclone, ConvectiveOutlook } from '$lib/types';
	import { CYCLONE_COLORS, CONVECTIVE_COLORS } from '$lib/types/storms';
	import { vesselStore, vesselConnectionStatus, connectVesselStream, disconnectVesselStream } from '$lib/services/vessel-stream';
	import type { OutageData, VIEWSConflictData, Vessel, RadiationReading } from '$lib/api';
	import type { CustomMonitor, NewsItem, NewsCategory, Aircraft, VolcanoData, AirQualityReading, DiseaseOutbreak, EarthquakeData } from '$lib/types';

	// Predefined ADS-B regions for filtering (matching AircraftPanel)
	const AIRCRAFT_REGIONS: Record<string, { name: string; bounds: [number, number, number, number] }> = {
		'north-america': { name: 'North America', bounds: [-170, 15, -50, 72] },
		'europe': { name: 'Europe', bounds: [-25, 35, 45, 72] },
		'middle-east': { name: 'Middle East', bounds: [25, 12, 65, 45] },
		'east-asia': { name: 'East Asia', bounds: [95, 15, 150, 55] },
		'southeast-asia': { name: 'SE Asia', bounds: [90, -15, 155, 28] },
		'australia': { name: 'Oceania', bounds: [110, -50, 180, 0] },
		'south-america': { name: 'S. America', bounds: [-85, -60, -30, 15] },
		'africa': { name: 'Africa', bounds: [-20, -40, 55, 40] },
		'viewport': { name: 'Viewport', bounds: [0, 0, 0, 0] } // Dynamic - uses map bounds
	};

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

	interface FlyToTarget {
		lat: number;
		lon: number;
		zoom?: number;
		_ts?: number; // Timestamp to force reactivity
	}

	interface AircraftTrackPoint {
		lat: number;
		lon: number;
		timestamp: number;
		altitude: number | null;
	}

	interface Props {
		monitors?: CustomMonitor[];
		news?: NewsItem[];
		categorizedNews?: CategorizedNews;
		flyToTarget?: FlyToTarget | null;
		radiationReadings?: RadiationReading[];
		diseaseOutbreaks?: DiseaseOutbreak[];
		earthquakes?: EarthquakeData[];
		// Aircraft data export callbacks
		onAircraftDataChange?: (aircraft: Aircraft[], history: AircraftSnapshot[]) => void;
		// Selected aircraft to highlight and show track
		selectedAircraftTrack?: { aircraft: Aircraft; track: AircraftTrackPoint[] } | null;
		// ADS-B control from AircraftPanel
		adsbEnabled?: boolean;
		selectedAircraftRegions?: Set<string>;
		onAdsbToggle?: (enabled: boolean) => void;
	}

	let {
		monitors = [],
		news = [],
		categorizedNews,
		flyToTarget = null,
		radiationReadings = [],
		diseaseOutbreaks = [],
		earthquakes = [],
		onAircraftDataChange,
		selectedAircraftTrack = null,
		adsbEnabled = false,
		selectedAircraftRegions = new Set<string>(['viewport']),
		onAdsbToggle
	}: Props = $props();

	// Create derived value to explicitly track flyToTarget changes for reactivity
	const currentFlyTarget = $derived(flyToTarget ? { ...flyToTarget } : null);

	// Mapbox access token
	const MAPBOX_TOKEN =
		(typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAPBOX_TOKEN) ||
		'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	let isInitialized = $state(false);
	let initError = $state<string | null>(null);
	let legendExpanded = $state(false);
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
		earthquakes: { visible: true, paused: false },
		smartHotspots: { visible: false, paused: false }, // VIEWS conflict forecasts - off by default
		aircraft: { visible: false, paused: false }, // ADS-B aircraft tracking - off by default (API rate limited)
		volcanoes: { visible: true, paused: false }, // USGS elevated volcanoes
		vessels: { visible: false, paused: false }, // AIS vessel/ship tracking - off by default
		airQuality: { visible: false, paused: false }, // OpenAQ air quality monitoring - off by default
		radiation: { visible: true, paused: false }, // Safecast radiation readings
		diseases: { visible: true, paused: false }, // WHO/ReliefWeb disease outbreaks
		traffic: { visible: false, paused: false } // Mapbox traffic and roads - off by default
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

	// Weather radar overlay state
	let weatherRadarVisible = $state(false);
	let weatherRadarTileUrl = $state<string | null>(null);
	let weatherRadarLoading = $state(false);

	// Satellite imagery state
	let satelliteOverlayVisible = $state(false);
	let satelliteOverlayLoading = $state(false);

	// Radar animation state
	let radarAnimationData = $state<RadarAnimationData | null>(null);
	let radarAnimationPlaying = $state(false);
	let radarCurrentFrame = $state(0);
	let radarAnimationInterval: ReturnType<typeof setInterval> | null = null;
	// Track which layer (A or B) is currently active for crossfade effect
	let radarActiveLayer = $state<'A' | 'B'>('A');
	// Preloaded frame images for smoother transitions
	let radarPreloadedFrames = $state<Set<number>>(new Set());

	// Weather alert overlay state
	let weatherAlertsVisible = $state(false);
	let weatherAlertsLoading = $state(false);
	let globeWeatherAlerts = $state<WeatherAlert[]>([]);

	// Tropical cyclone overlay state
	let tropicalCyclonesVisible = $state(false);
	let tropicalCyclonesLoading = $state(false);
	let activeCyclones = $state<TropicalCyclone[]>([]);

	// Convective outlook overlay state
	let convectiveOutlooksVisible = $state(false);
	let convectiveOutlooksLoading = $state(false);
	let convectiveOutlooks = $state<ConvectiveOutlook[]>([]);

	// ADS-B Aircraft tracking data
	let aircraftData = $state<Aircraft[]>([]);
	let aircraftDataLoading = $state(false);
	let aircraftRefreshInterval: ReturnType<typeof setInterval> | null = null;
	// Use localStorage to persist last fetch time across page refreshes to avoid rate limiting
	let lastAircraftFetch = typeof window !== 'undefined'
		? parseInt(localStorage.getItem('adsb-last-fetch') || '0', 10)
		: 0;
	let isRateLimited = $state(false); // Track if we got a 429 recently
	const AIRCRAFT_REFRESH_INTERVAL = 60000; // 60 seconds (respecting OpenSky rate limits for anonymous users)
	const AIRCRAFT_DEBOUNCE_MS = 10000; // Minimum 10 seconds between fetches (OpenSky recommends at least 10s)
	const RATE_LIMIT_BACKOFF_MS = 60000; // Wait 60 seconds after a 429 before trying again
	const MAX_AIRCRAFT_DISPLAY = 2500; // Limit displayed aircraft for performance
	const MAX_AIRCRAFT_HISTORY = 5; // Number of historical snapshots to keep

	// Aircraft position history for tracking (stores last N snapshots)
	interface AircraftSnapshot {
		timestamp: number;
		aircraft: Aircraft[];
		region: string;
	}
	let aircraftHistory = $state<AircraftSnapshot[]>([]);

	// USGS Volcano data
	let volcanoData = $state<VolcanoData[]>([]);
	let volcanoDataLoading = $state(false);
	const VOLCANO_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes (volcano status changes slowly)

	// AIS Vessel/Ship tracking data - uses WebSocket stream from aisstream.io
	let vesselData = $state<Vessel[]>([]);
	let vesselUnsubscribe: (() => void) | null = null;
	// Derive loading state from connection status
	let vesselConnectionState = $state<'disconnected' | 'connecting' | 'connected' | 'error' | 'no_api_key'>('disconnected');
	const vesselDataLoading = $derived(vesselConnectionState === 'connecting');

	// OpenAQ Air Quality data
	let airQualityData = $state<AirQualityReading[]>([]);
	let airQualityDataLoading = $state(false);

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
			outage: 'GRID STRESS INDICATOR',
			earthquake: 'SEISMIC EVENT',
			'news-cluster': 'NEWS ACTIVITY',
			'feed-news': category ? FEED_LABELS[category as keyof typeof FEED_LABELS] || 'NEWS FEED' : 'NEWS FEED',
			'views-conflict': 'CONFLICT FORECAST (VIEWS)',
			'views-arc': 'TENSION CORRIDOR',
			aircraft: 'AIRCRAFT (ADS-B)',
			vessel: 'VESSEL (AIS)'
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
				label: hotspot.label, // Use the enhanced descriptive label
				name: hotspot.name,   // Keep original country name for reference
				type: 'views-conflict',
				country: hotspot.country,
				isoCode: hotspot.isoCode,
				intensity: hotspot.intensity,
				forecastedFatalities: hotspot.forecastedFatalities,
				fatalityProbability: hotspot.fatalityProbability,
				forecastMonth: hotspot.forecastMonth,
				forecastYear: hotspot.forecastYear,
				// Enhanced descriptive fields for tooltips
				riskDescription: hotspot.riskDescription,
				reasoning: hotspot.reasoning,
				dataSource: hotspot.dataSource,
				// Visual properties
				color: CONFLICT_INTENSITY_COLORS[hotspot.intensity as keyof typeof CONFLICT_INTENSITY_COLORS],
				size: hotspot.intensity === 'critical' ? 12 : hotspot.intensity === 'high' ? 10 : 8,
				glowSize: hotspot.intensity === 'critical' ? 20 : hotspot.intensity === 'high' ? 16 : 12,
				desc: hotspot.riskDescription // Short description for quick hover
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

	// Generate GeoJSON for aircraft positions (ADS-B tracking)
	function getAircraftGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.aircraft.visible || aircraftData.length === 0) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = aircraftData.map((aircraft) => {
			const altitude = aircraft.geoAltitude ?? aircraft.baroAltitude;
			const color = getAltitudeColor(altitude, aircraft.onGround);

			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [aircraft.longitude!, aircraft.latitude!]
				},
				properties: {
					icao24: aircraft.icao24,
					callsign: aircraft.callsign || aircraft.icao24.toUpperCase(),
					originCountry: aircraft.originCountry,
					altitude: altitude,
					altitudeFormatted: formatAltitude(altitude),
					velocity: aircraft.velocity,
					velocityFormatted: formatVelocity(aircraft.velocity),
					heading: aircraft.trueTrack,
					headingFormatted: formatHeading(aircraft.trueTrack),
					verticalRate: aircraft.verticalRate,
					onGround: aircraft.onGround,
					squawk: aircraft.squawk,
					color,
					type: 'aircraft',
					// Icon rotation based on heading (default 0 = north)
					rotation: aircraft.trueTrack ?? 0
				}
			};
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate GeoJSON for volcano markers
	function getVolcanoGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.volcanoes.visible || volcanoData.length === 0) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = volcanoData.map((volcano) => {
			// Get color based on alert level
			const color = VOLCANO_ALERT_COLORS[volcano.colorCode] || '#f97316';
			const alertDesc = VOLCANO_ALERT_DESCRIPTIONS[volcano.alertLevel] || '';

			// Size based on alert level
			let size = 8;
			if (volcano.alertLevel === 'WARNING') size = 14;
			else if (volcano.alertLevel === 'WATCH') size = 11;
			else if (volcano.alertLevel === 'ADVISORY') size = 8;

			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [volcano.lon, volcano.lat]
				},
				properties: {
					id: volcano.id,
					name: volcano.name,
					type: 'volcano',
					country: volcano.country,
					region: volcano.region || '',
					elevation: volcano.elevation,
					alertLevel: volcano.alertLevel,
					colorCode: volcano.colorCode,
					lastUpdate: volcano.lastUpdate || '',
					notice: volcano.notice || '',
					description: volcano.description || '',
					alertDescription: alertDesc,
					color,
					size,
					// Glow intensity based on alert level
					glowOpacity: volcano.alertLevel === 'WARNING' ? 0.6 : volcano.alertLevel === 'WATCH' ? 0.4 : 0.3
				}
			};
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate GeoJSON for vessel/ship positions (AIS tracking)
	function getVesselGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.vessels.visible || vesselData.length === 0) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = vesselData.map((vessel) => {
			const color = getShipTypeColor(vessel.shipType);
			const flag = getFlagEmoji(vessel.flag);

			// Size based on ship type
			let size = 8;
			if (vessel.shipType) {
				if (vessel.shipType >= 60 && vessel.shipType <= 69) size = 10; // Passenger
				else if (vessel.shipType >= 70 && vessel.shipType <= 89) size = 9; // Cargo/Tanker
			}

			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [vessel.lon, vessel.lat]
				},
				properties: {
					mmsi: vessel.mmsi,
					name: vessel.name || `MMSI ${vessel.mmsi}`,
					imo: vessel.imo || '',
					type: 'vessel',
					shipType: vessel.shipType || 0,
					shipTypeName: vessel.shipTypeName || 'Unknown',
					flag: vessel.flag || '',
					flagEmoji: flag,
					destination: vessel.destination || 'Not reported',
					eta: vessel.eta || '',
					speed: vessel.speed,
					speedFormatted: formatVesselSpeed(vessel.speed),
					course: vessel.course,
					courseFormatted: formatVesselCourse(vessel.course),
					heading: vessel.heading ?? vessel.course,
					draught: vessel.draught || 0,
					length: vessel.length || 0,
					width: vessel.width || 0,
					callsign: vessel.callsign || '',
					color,
					size,
					// Icon rotation based on course/heading
					rotation: vessel.heading ?? vessel.course ?? 0
				}
			};
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate GeoJSON for air quality readings (OpenAQ PM2.5 data)
	function getAirQualityGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.airQuality.visible || airQualityData.length === 0) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = airQualityData.map((reading) => {
			const color = AIR_QUALITY_COLORS[reading.level] || '#22c55e';
			const description = AIR_QUALITY_DESCRIPTIONS[reading.level] || '';

			// Size based on PM2.5 value (logarithmic scale for better visualization)
			// Base size 6, scales up with worse air quality
			let size = 6;
			if (reading.value > 150) size = 12;
			else if (reading.value > 55) size = 10;
			else if (reading.value > 35) size = 8;
			else if (reading.value > 12) size = 7;

			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [reading.lon, reading.lat]
				},
				properties: {
					id: reading.id,
					location: reading.location,
					city: reading.city || '',
					country: reading.country,
					type: 'air-quality',
					parameter: reading.parameter,
					value: reading.value,
					unit: reading.unit,
					aqi: reading.aqi || 0,
					level: reading.level,
					levelDescription: description,
					lastUpdated: reading.lastUpdated,
					color,
					size,
					// Glow intensity based on severity
					glowOpacity: reading.level === 'hazardous' ? 0.6 :
						reading.level === 'very_unhealthy' ? 0.5 :
						reading.level === 'unhealthy' ? 0.4 :
						reading.level === 'unhealthy_sensitive' ? 0.35 :
						reading.level === 'moderate' ? 0.3 : 0.25
				}
			};
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate radiation readings GeoJSON from Safecast data
	function getRadiationGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.radiation.visible || radiationReadings.length === 0) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = radiationReadings.map((reading) => {
			const color = RADIATION_LEVEL_COLORS[reading.level] || '#22c55e';

			// Size based on radiation level
			let size = 6;
			if (reading.level === 'dangerous') size = 14;
			else if (reading.level === 'high') size = 11;
			else if (reading.level === 'elevated') size = 8;

			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [reading.lon, reading.lat]
				},
				properties: {
					id: reading.id,
					type: 'radiation',
					location: reading.location || `${reading.lat.toFixed(2)}, ${reading.lon.toFixed(2)}`,
					value: reading.value,
					unit: reading.unit,
					level: reading.level,
					capturedAt: reading.capturedAt,
					deviceId: reading.deviceId || '',
					color,
					size,
					glowOpacity: reading.level === 'dangerous' ? 0.6 :
						reading.level === 'high' ? 0.5 :
						reading.level === 'elevated' ? 0.4 : 0.25
				}
			};
		});

		return { type: 'FeatureCollection', features };
	}

	// Disease outbreak severity colors
	const DISEASE_SEVERITY_COLORS: Record<string, string> = {
		critical: '#ef4444', // red-500
		high: '#f97316', // orange-500
		moderate: '#eab308', // yellow-500
		low: '#22c55e' // green-500
	};

	// Generate disease outbreaks GeoJSON
	function getDiseaseGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.diseases.visible || diseaseOutbreaks.length === 0) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = diseaseOutbreaks.map((outbreak) => {
			const color = DISEASE_SEVERITY_COLORS[outbreak.severity] || '#eab308';

			// Size based on severity and cases
			let size = 8;
			if (outbreak.severity === 'critical') size = 14;
			else if (outbreak.severity === 'high') size = 11;
			else if (outbreak.severity === 'moderate') size = 9;

			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [outbreak.lon, outbreak.lat]
				},
				properties: {
					id: outbreak.id,
					type: 'disease',
					disease: outbreak.disease,
					country: outbreak.country,
					region: outbreak.region || '',
					cases: outbreak.cases || 0,
					deaths: outbreak.deaths || 0,
					severity: outbreak.severity,
					status: outbreak.status,
					lastUpdate: outbreak.lastUpdate,
					source: outbreak.source,
					url: outbreak.url || '',
					color,
					size,
					glowOpacity: outbreak.severity === 'critical' ? 0.6 :
						outbreak.severity === 'high' ? 0.5 :
						outbreak.severity === 'moderate' ? 0.4 : 0.3
				}
			};
		});

		return { type: 'FeatureCollection', features };
	}

	// Earthquake magnitude colors
	const EARTHQUAKE_MAGNITUDE_COLORS: Record<string, string> = {
		major: '#dc2626', // red-600 - M7.0+
		strong: '#ef4444', // red-500 - M6.0-6.9
		moderate: '#f97316', // orange-500 - M5.0-5.9
		light: '#eab308' // yellow-500 - M4.0-4.9
	};

	// Generate earthquake GeoJSON from USGS data
	function getEarthquakesGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.earthquakes.visible || earthquakes.length === 0) {
			return { type: 'FeatureCollection', features: [] };
		}

		const features: GeoJSON.Feature[] = earthquakes.map((quake) => {
			// Determine magnitude category
			let category: string;
			if (quake.magnitude >= 7.0) category = 'major';
			else if (quake.magnitude >= 6.0) category = 'strong';
			else if (quake.magnitude >= 5.0) category = 'moderate';
			else category = 'light';

			const color = EARTHQUAKE_MAGNITUDE_COLORS[category] || '#eab308';

			// Smaller base size with magnitude scaling (reduced from previous)
			const baseSize = Math.max(3, Math.min(8, 2 + (quake.magnitude - 4) * 1.5));

			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [quake.lon, quake.lat]
				},
				properties: {
					id: quake.id,
					type: 'earthquake',
					magnitude: quake.magnitude,
					place: quake.place,
					depth: quake.depth,
					time: quake.time,
					url: quake.url,
					category,
					color,
					baseSize, // Used for zoom interpolation
					glowOpacity: category === 'major' ? 0.5 :
						category === 'strong' ? 0.4 :
						category === 'moderate' ? 0.3 : 0.25
				}
			};
		});

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

			// Update ADS-B aircraft source
			const aircraftSource = map.getSource('aircraft') as mapboxgl.GeoJSONSource;
			if (aircraftSource) aircraftSource.setData(getAircraftGeoJSON());

			// Update AIS vessel source
			const vesselSource = map.getSource('vessels') as mapboxgl.GeoJSONSource;
			if (vesselSource) vesselSource.setData(getVesselGeoJSON());

			// Update USGS volcano source
			const volcanoSource = map.getSource('volcanoes') as mapboxgl.GeoJSONSource;
			if (volcanoSource) volcanoSource.setData(getVolcanoGeoJSON());

			// Update OpenAQ air quality source
			const airQualitySource = map.getSource('air-quality') as mapboxgl.GeoJSONSource;
			if (airQualitySource) airQualitySource.setData(getAirQualityGeoJSON());

			// Update radiation readings source
			const radiationSource = map.getSource('radiation') as mapboxgl.GeoJSONSource;
			if (radiationSource) radiationSource.setData(getRadiationGeoJSON());

			// Update disease outbreaks source
			const diseaseSource = map.getSource('diseases') as mapboxgl.GeoJSONSource;
			if (diseaseSource) diseaseSource.setData(getDiseaseGeoJSON());

			// Update earthquakes source
			const earthquakesSource = map.getSource('earthquakes') as mapboxgl.GeoJSONSource;
			if (earthquakesSource) earthquakesSource.setData(getEarthquakesGeoJSON());

			// Update traffic flow layer visibility (road base layers are always visible)
			const trafficVisibility = dataLayers.traffic.visible ? 'visible' : 'none';
			const trafficFlowLayers = [
				'traffic-low',
				'traffic-moderate',
				'traffic-heavy',
				'traffic-severe'
			];
			for (const layerId of trafficFlowLayers) {
				if (map.getLayer(layerId)) {
					map.setLayoutProperty(layerId, 'visibility', trafficVisibility);
				}
			}
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
						// Country borders - cyan tactical style for visibility (enhanced)
						{
							id: 'admin-0-boundary',
							type: 'line',
							source: 'mapbox-streets',
							'source-layer': 'admin',
							filter: ['all', ['==', ['get', 'admin_level'], 0], ['==', ['get', 'disputed'], 'false'], ['==', ['get', 'maritime'], 'false']],
							paint: {
								'line-color': 'rgba(6, 182, 212, 0.7)',
								'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 3, 1.5, 6, 2, 10, 2.5],
								'line-dasharray': [3, 1]
							}
						},
						// Disputed borders - red dashed for conflict zones
						{
							id: 'admin-0-boundary-disputed',
							type: 'line',
							source: 'mapbox-streets',
							'source-layer': 'admin',
							filter: ['all', ['==', ['get', 'admin_level'], 0], ['==', ['get', 'disputed'], 'true']],
							paint: {
								'line-color': 'rgba(239, 68, 68, 0.75)',
								'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 3, 1.5, 6, 2, 10, 2.5],
								'line-dasharray': [3, 2]
							}
						},
						// State/Province borders - subtle administrative boundaries (admin_level 1)
						{
							id: 'admin-1-boundary',
							type: 'line',
							source: 'mapbox-streets',
							'source-layer': 'admin',
							minzoom: 4,
							filter: ['all', ['==', ['get', 'admin_level'], 1], ['==', ['get', 'maritime'], 'false']],
							paint: {
								'line-color': 'rgba(100, 116, 139, 0.5)',
								'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 6, 0.5, 8, 0.8, 12, 1.2],
								'line-dasharray': [2, 2]
							}
						},
						// Country labels - more prominent for tactical awareness
						{
							id: 'country-labels',
							type: 'symbol',
							source: 'mapbox-streets',
							'source-layer': 'place_label',
							filter: ['==', ['get', 'class'], 'country'],
							layout: {
								'text-field': ['get', 'name_en'],
								'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
								'text-size': ['interpolate', ['linear'], ['zoom'], 0, 9, 2, 11, 4, 14, 8, 18],
								'text-transform': 'uppercase',
								'text-letter-spacing': 0.15,
								'text-max-width': 10,
								'text-allow-overlap': false,
								'text-ignore-placement': false
							},
							paint: {
								'text-color': 'rgba(203, 213, 225, 0.85)',
								'text-halo-color': 'rgba(0, 0, 0, 0.9)',
								'text-halo-width': 2
							}
						},
						// Major cities (capitals, large metro areas) - visible from zoom 4+
						{
							id: 'city-labels-major',
							type: 'symbol',
							source: 'mapbox-streets',
							'source-layer': 'place_label',
							minzoom: 4,
							filter: ['all',
								['==', ['get', 'class'], 'settlement'],
								['<=', ['get', 'filterrank'], 2]
							],
							layout: {
								'text-field': ['get', 'name_en'],
								'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
								'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 16, 12, 20],
								'text-max-width': 8,
								'text-allow-overlap': false,
								'text-ignore-placement': false,
								'text-padding': 2
							},
							paint: {
								'text-color': 'rgba(248, 250, 252, 0.95)',
								'text-halo-color': 'rgba(0, 0, 0, 0.95)',
								'text-halo-width': 1.5,
								'text-halo-blur': 0.5
							}
						},
						// Medium cities - visible from zoom 6+
						{
							id: 'city-labels-medium',
							type: 'symbol',
							source: 'mapbox-streets',
							'source-layer': 'place_label',
							minzoom: 6,
							filter: ['all',
								['==', ['get', 'class'], 'settlement'],
								['>', ['get', 'filterrank'], 2],
								['<=', ['get', 'filterrank'], 4]
							],
							layout: {
								'text-field': ['get', 'name_en'],
								'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
								'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 14, 14, 16],
								'text-max-width': 8,
								'text-allow-overlap': false,
								'text-ignore-placement': false,
								'text-padding': 2
							},
							paint: {
								'text-color': 'rgba(226, 232, 240, 0.9)',
								'text-halo-color': 'rgba(0, 0, 0, 0.9)',
								'text-halo-width': 1.25,
								'text-halo-blur': 0.5
							}
						},
						// Small cities and towns - visible from zoom 8+
						{
							id: 'city-labels-small',
							type: 'symbol',
							source: 'mapbox-streets',
							'source-layer': 'place_label',
							minzoom: 8,
							filter: ['all',
								['==', ['get', 'class'], 'settlement'],
								['>', ['get', 'filterrank'], 4],
								['<=', ['get', 'filterrank'], 6]
							],
							layout: {
								'text-field': ['get', 'name_en'],
								'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
								'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 12, 12, 16, 14],
								'text-max-width': 7,
								'text-allow-overlap': false,
								'text-ignore-placement': false,
								'text-padding': 1
							},
							paint: {
								'text-color': 'rgba(203, 213, 225, 0.85)',
								'text-halo-color': 'rgba(0, 0, 0, 0.85)',
								'text-halo-width': 1,
								'text-halo-blur': 0.5
							}
						},
						// Villages and small places - visible from zoom 10+
						{
							id: 'city-labels-minor',
							type: 'symbol',
							source: 'mapbox-streets',
							'source-layer': 'place_label',
							minzoom: 10,
							filter: ['all',
								['==', ['get', 'class'], 'settlement'],
								['>', ['get', 'filterrank'], 6]
							],
							layout: {
								'text-field': ['get', 'name_en'],
								'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
								'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11, 18, 13],
								'text-max-width': 6,
								'text-allow-overlap': false,
								'text-ignore-placement': false,
								'text-padding': 1
							},
							paint: {
								'text-color': 'rgba(148, 163, 184, 0.8)',
								'text-halo-color': 'rgba(0, 0, 0, 0.8)',
								'text-halo-width': 1,
								'text-halo-blur': 0.5
							}
						},
						// Neighborhoods and subdivisions - visible from zoom 13+
						{
							id: 'neighborhood-labels',
							type: 'symbol',
							source: 'mapbox-streets',
							'source-layer': 'place_label',
							minzoom: 13,
							filter: ['==', ['get', 'class'], 'settlement_subdivision'],
							layout: {
								'text-field': ['get', 'name_en'],
								'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
								'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 11, 20, 13],
								'text-max-width': 6,
								'text-transform': 'uppercase',
								'text-letter-spacing': 0.1,
								'text-allow-overlap': false,
								'text-ignore-placement': false,
								'text-padding': 1
							},
							paint: {
								'text-color': 'rgba(100, 116, 139, 0.7)',
								'text-halo-color': 'rgba(0, 0, 0, 0.7)',
								'text-halo-width': 1,
								'text-halo-blur': 0.5
							}
						}
					],
					glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf'
				},
				center: [-98, 39],
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

				// Add terrain DEM source for 3D terrain visualization
				map.addSource('mapbox-dem', {
					type: 'raster-dem',
					url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
					tileSize: 512,
					maxzoom: 14
				});

				// Calculate terrain exaggeration based on zoom level
				// Multi-stage curve: dramatic at globe/continent, stays dramatic through region/county,
				// only becoming subtle at city-level zoom for realistic close-up terrain
				const calculateTerrainExaggeration = (zoom: number): number => {
					// Define zoom level breakpoints and their exaggeration values
					// Globe view (zoom 0-3): 20.0 - dramatic, mountains visible from space
					// Continent view (zoom 3-5): 20.0 to 12.0 - still dramatic
					// Region/Country view (zoom 5-8): 12.0 to 8.0 - dramatic, good for mountain ranges
					// County level (zoom 8-10): 8.0 to 3.0 - moderately exaggerated, terrain features clear
					// City and closer (zoom 10+): 1.5 - subtle, realistic

					const breakpoints = [
						{ zoom: 0, exaggeration: 20.0 },   // Globe view - maximum drama
						{ zoom: 3, exaggeration: 20.0 },   // End of globe view
						{ zoom: 5, exaggeration: 12.0 },   // Continent view
						{ zoom: 8, exaggeration: 8.0 },    // Region/Country view
						{ zoom: 10, exaggeration: 3.0 },   // County level
						{ zoom: 14, exaggeration: 1.5 }    // City and closer - subtle, realistic
					];

					// Find the appropriate segment for interpolation
					if (zoom <= breakpoints[0].zoom) return breakpoints[0].exaggeration;
					if (zoom >= breakpoints[breakpoints.length - 1].zoom) {
						return breakpoints[breakpoints.length - 1].exaggeration;
					}

					// Find the two breakpoints we're between
					for (let i = 0; i < breakpoints.length - 1; i++) {
						const lower = breakpoints[i];
						const upper = breakpoints[i + 1];

						if (zoom >= lower.zoom && zoom <= upper.zoom) {
							// Linear interpolation between breakpoints
							const t = (zoom - lower.zoom) / (upper.zoom - lower.zoom);
							// Apply ease-in-out for smoother transitions
							const easeInOut = t < 0.5
								? 2 * t * t
								: 1 - Math.pow(-2 * t + 2, 2) / 2;
							return lower.exaggeration - (lower.exaggeration - upper.exaggeration) * easeInOut;
						}
					}

					// Fallback (shouldn't reach here)
					return 1.5;
				};

				// Set initial terrain with exaggeration based on current zoom
				const initialZoom = map.getZoom();
				map.setTerrain({
					source: 'mapbox-dem',
					exaggeration: calculateTerrainExaggeration(initialZoom)
				});

				// Add hillshade layer for enhanced terrain visualization
				map.addLayer(
					{
						id: 'hillshade',
						type: 'hillshade',
						source: 'mapbox-dem',
						paint: {
							'hillshade-exaggeration': 0.5,
							'hillshade-shadow-color': '#000000',
							'hillshade-highlight-color': '#ffffff',
							'hillshade-accent-color': '#0891b2',
							'hillshade-illumination-direction': 315
						}
					},
					'satellite' // Insert below satellite layer but above background
				);

				// Add 3D buildings layer - visible when zoomed in
				map.addLayer({
					id: '3d-buildings',
					source: 'mapbox-streets',
					'source-layer': 'building',
					type: 'fill-extrusion',
					minzoom: 13,
					paint: {
						'fill-extrusion-color': [
							'interpolate',
							['linear'],
							['get', 'height'],
							0, '#1e293b',  // slate-800 for low buildings
							50, '#334155', // slate-700 for medium buildings
							100, '#475569', // slate-600 for tall buildings
							200, '#64748b'  // slate-500 for very tall buildings
						],
						'fill-extrusion-height': ['get', 'height'],
						'fill-extrusion-base': ['get', 'min_height'],
						'fill-extrusion-opacity': 0.8
					}
				});

				// Update terrain exaggeration dynamically as user zooms
				map.on('zoom', () => {
					if (!map) return;
					const currentZoom = map.getZoom();
					const exaggeration = calculateTerrainExaggeration(currentZoom);
					map.setTerrain({
						source: 'mapbox-dem',
						exaggeration: exaggeration
					});
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

				// USGS Volcano source
				map.addSource('volcanoes', { type: 'geojson', data: getVolcanoGeoJSON() });

				// AIS Vessel/Ship tracking source
				map.addSource('vessels', { type: 'geojson', data: getVesselGeoJSON() });

				// ADS-B Aircraft tracking source
				map.addSource('aircraft', { type: 'geojson', data: getAircraftGeoJSON() });

				// OpenAQ Air Quality source
				map.addSource('air-quality', { type: 'geojson', data: getAirQualityGeoJSON() });

				// Safecast Radiation readings source
				map.addSource('radiation', { type: 'geojson', data: getRadiationGeoJSON() });

				// Disease outbreaks source
				map.addSource('diseases', { type: 'geojson', data: getDiseaseGeoJSON() });

				// USGS Earthquake source
				map.addSource('earthquakes', { type: 'geojson', data: getEarthquakesGeoJSON() });

				// Mapbox Traffic source (real-time traffic data)
				map.addSource('mapbox-traffic', {
					type: 'vector',
					url: 'mapbox://mapbox.mapbox-traffic-v1'
				});

				// Add layers

				// ========== ROAD LAYERS - Always visible, progressively shown at different zoom levels ==========
				// These layers show major roadways to provide geographic context

				// Motorways/Highways - most prominent roads (visible at zoom 6+)
				map.addLayer({
					id: 'roads-motorway',
					type: 'line',
					source: 'mapbox-streets',
					'source-layer': 'road',
					minzoom: 6,
					filter: ['==', ['get', 'class'], 'motorway'],
					layout: {
						'line-join': 'round',
						'line-cap': 'round'
					},
					paint: {
						'line-color': 'rgba(100, 110, 130, 0.5)',
						'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 8, 1, 10, 1.5, 14, 3, 18, 6],
						'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 10, 0.7, 14, 0.8]
					}
				});

				// Trunk roads (major highways, one level below motorway) - visible at zoom 7+
				map.addLayer({
					id: 'roads-trunk',
					type: 'line',
					source: 'mapbox-streets',
					'source-layer': 'road',
					minzoom: 7,
					filter: ['==', ['get', 'class'], 'trunk'],
					layout: {
						'line-join': 'round',
						'line-cap': 'round'
					},
					paint: {
						'line-color': 'rgba(95, 105, 125, 0.45)',
						'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 10, 1, 14, 2.5, 18, 5],
						'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.35, 10, 0.6, 14, 0.75]
					}
				});

				// Primary roads (visible at zoom 8+)
				map.addLayer({
					id: 'roads-primary',
					type: 'line',
					source: 'mapbox-streets',
					'source-layer': 'road',
					minzoom: 8,
					filter: ['==', ['get', 'class'], 'primary'],
					layout: {
						'line-join': 'round',
						'line-cap': 'round'
					},
					paint: {
						'line-color': 'rgba(90, 100, 120, 0.4)',
						'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 10, 0.8, 14, 2, 18, 4],
						'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 10, 0.55, 14, 0.7]
					}
				});

				// Secondary roads - visible at zoom 10+
				map.addLayer({
					id: 'roads-secondary',
					type: 'line',
					source: 'mapbox-streets',
					'source-layer': 'road',
					minzoom: 10,
					filter: ['==', ['get', 'class'], 'secondary'],
					layout: {
						'line-join': 'round',
						'line-cap': 'round'
					},
					paint: {
						'line-color': 'rgba(85, 95, 115, 0.35)',
						'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 13, 0.8, 16, 1.5, 18, 3],
						'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 0.5, 16, 0.6]
					}
				});

				// Tertiary roads - visible at higher zoom (12+)
				map.addLayer({
					id: 'roads-tertiary',
					type: 'line',
					source: 'mapbox-streets',
					'source-layer': 'road',
					minzoom: 12,
					filter: ['==', ['get', 'class'], 'tertiary'],
					layout: {
						'line-join': 'round',
						'line-cap': 'round'
					},
					paint: {
						'line-color': 'rgba(80, 90, 110, 0.3)',
						'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.3, 15, 0.7, 17, 1.2, 18, 2],
						'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.25, 15, 0.4, 17, 0.5]
					}
				});

				// ========== TRAFFIC FLOW LAYERS - Real-time traffic conditions ==========
				// Traffic congestion overlay - shows traffic flow colors on roads

				// Traffic layer - low congestion (green/normal flow)
				map.addLayer({
					id: 'traffic-low',
					type: 'line',
					source: 'mapbox-traffic',
					'source-layer': 'traffic',
					minzoom: 10,
					filter: ['==', ['get', 'congestion'], 'low'],
					layout: {
						'line-join': 'round',
						'line-cap': 'round',
						'visibility': dataLayers.traffic.visible ? 'visible' : 'none'
					},
					paint: {
						'line-color': '#22c55e', // green-500
						'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 3, 18, 6],
						'line-opacity': 0.7
					}
				});

				// Traffic layer - moderate congestion (yellow)
				map.addLayer({
					id: 'traffic-moderate',
					type: 'line',
					source: 'mapbox-traffic',
					'source-layer': 'traffic',
					minzoom: 10,
					filter: ['==', ['get', 'congestion'], 'moderate'],
					layout: {
						'line-join': 'round',
						'line-cap': 'round',
						'visibility': dataLayers.traffic.visible ? 'visible' : 'none'
					},
					paint: {
						'line-color': '#eab308', // yellow-500
						'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 3, 18, 6],
						'line-opacity': 0.8
					}
				});

				// Traffic layer - heavy congestion (orange)
				map.addLayer({
					id: 'traffic-heavy',
					type: 'line',
					source: 'mapbox-traffic',
					'source-layer': 'traffic',
					minzoom: 10,
					filter: ['==', ['get', 'congestion'], 'heavy'],
					layout: {
						'line-join': 'round',
						'line-cap': 'round',
						'visibility': dataLayers.traffic.visible ? 'visible' : 'none'
					},
					paint: {
						'line-color': '#f97316', // orange-500
						'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 3.5, 18, 7],
						'line-opacity': 0.85
					}
				});

				// Traffic layer - severe congestion (red)
				map.addLayer({
					id: 'traffic-severe',
					type: 'line',
					source: 'mapbox-traffic',
					'source-layer': 'traffic',
					minzoom: 10,
					filter: ['==', ['get', 'congestion'], 'severe'],
					layout: {
						'line-join': 'round',
						'line-cap': 'round',
						'visibility': dataLayers.traffic.visible ? 'visible' : 'none'
					},
					paint: {
						'line-color': '#ef4444', // red-500
						'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4, 18, 8],
						'line-opacity': 0.9
					}
				});

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

				// ========== VOLCANO LAYERS - USGS elevated volcanic activity ==========
				// Volcano outer glow
				map.addLayer({
					id: 'volcanoes-glow-outer',
					type: 'circle',
					source: 'volcanoes',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 2.5],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['get', 'glowOpacity'],
						'circle-blur': 1.5
					}
				});

				// Volcano middle glow
				map.addLayer({
					id: 'volcanoes-glow-middle',
					type: 'circle',
					source: 'volcanoes',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 1.5],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['*', ['get', 'glowOpacity'], 1.3],
						'circle-blur': 0.6
					}
				});

				// Volcano main marker
				map.addLayer({
					id: 'volcanoes-layer',
					type: 'circle',
					source: 'volcanoes',
					paint: {
						'circle-radius': ['get', 'size'],
						'circle-color': ['get', 'color'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1.5,
						'circle-stroke-opacity': 0.8
					}
				});

				// Volcano icon (mountain/triangle symbol)
				map.addLayer({
					id: 'volcanoes-icon',
					type: 'symbol',
					source: 'volcanoes',
					layout: {
						'text-field': '\u25B2', // Triangle pointing up (mountain)
						'text-size': ['case',
							['==', ['get', 'alertLevel'], 'WARNING'], 12,
							['==', ['get', 'alertLevel'], 'WATCH'], 10,
							8
						],
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(0, 0, 0, 0.9)',
						'text-halo-width': 1.5
					}
				});

				// ========== VESSEL/SHIP LAYERS - AIS maritime tracking ==========
				// Vessel outer glow
				map.addLayer({
					id: 'vessels-glow-outer',
					type: 'circle',
					source: 'vessels',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 2],
						'circle-color': ['get', 'color'],
						'circle-opacity': 0.3,
						'circle-blur': 1
					}
				});

				// Vessel main marker (circle base)
				map.addLayer({
					id: 'vessels-layer',
					type: 'circle',
					source: 'vessels',
					paint: {
						'circle-radius': ['get', 'size'],
						'circle-color': ['get', 'color'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1.5,
						'circle-stroke-opacity': 0.8
					}
				});

				// Vessel direction indicator (ship icon with rotation)
				map.addLayer({
					id: 'vessels-icon',
					type: 'symbol',
					source: 'vessels',
					layout: {
						'text-field': '\u25B2', // Triangle pointing up (ship bow)
						'text-size': 10,
						'text-rotation-alignment': 'map',
						'text-rotate': ['get', 'rotation'],
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

				// ========== ADS-B AIRCRAFT LAYERS ==========
				// Simple, performant airplane icons with altitude-based coloring

				// Subtle glow layer for visibility
				map.addLayer({
					id: 'aircraft-glow',
					type: 'circle',
					source: 'aircraft',
					paint: {
						'circle-radius': 8,
						'circle-color': ['get', 'color'],
						'circle-opacity': 0.25,
						'circle-blur': 1
					}
				});

				// Main aircraft icon layer - airplane symbol with rotation
				map.addLayer({
					id: 'aircraft-layer',
					type: 'symbol',
					source: 'aircraft',
					layout: {
						'text-field': '✈',
						'text-size': 16,
						'text-rotation-alignment': 'map',
						'text-rotate': ['get', 'rotation'],
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': ['get', 'color'],
						'text-halo-color': 'rgba(0, 0, 0, 0.8)',
						'text-halo-width': 1.5
					}
				});

				// ========== AIR QUALITY LAYERS - OpenAQ PM2.5 monitoring ==========
				// Air quality outer glow
				map.addLayer({
					id: 'air-quality-glow-outer',
					type: 'circle',
					source: 'air-quality',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 2.5],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['get', 'glowOpacity'],
						'circle-blur': 1.5
					}
				});

				// Air quality middle glow
				map.addLayer({
					id: 'air-quality-glow-middle',
					type: 'circle',
					source: 'air-quality',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 1.5],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['*', ['get', 'glowOpacity'], 1.3],
						'circle-blur': 0.6
					}
				});

				// Air quality main marker
				map.addLayer({
					id: 'air-quality-layer',
					type: 'circle',
					source: 'air-quality',
					paint: {
						'circle-radius': ['get', 'size'],
						'circle-color': ['get', 'color'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1.5,
						'circle-stroke-opacity': 0.8
					}
				});

				// Air quality icon (cloud symbol for air quality)
				map.addLayer({
					id: 'air-quality-icon',
					type: 'symbol',
					source: 'air-quality',
					layout: {
						'text-field': '\u2601', // Cloud symbol
						'text-size': ['case',
							['==', ['get', 'level'], 'hazardous'], 12,
							['==', ['get', 'level'], 'very_unhealthy'], 11,
							['==', ['get', 'level'], 'unhealthy'], 10,
							9
						],
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(0, 0, 0, 0.9)',
						'text-halo-width': 1.5
					}
				});

				// ========== RADIATION LAYERS ==========
				// Radiation glow layer
				map.addLayer({
					id: 'radiation-glow',
					type: 'circle',
					source: 'radiation',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 2],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['get', 'glowOpacity'],
						'circle-blur': 0.8
					}
				});

				// Radiation main marker
				map.addLayer({
					id: 'radiation-layer',
					type: 'circle',
					source: 'radiation',
					paint: {
						'circle-radius': ['get', 'size'],
						'circle-color': ['get', 'color'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1.5,
						'circle-stroke-opacity': 0.8
					}
				});

				// Radiation icon (radiation symbol)
				map.addLayer({
					id: 'radiation-icon',
					type: 'symbol',
					source: 'radiation',
					layout: {
						'text-field': '\u2622', // Radiation symbol
						'text-size': ['case',
							['==', ['get', 'level'], 'dangerous'], 14,
							['==', ['get', 'level'], 'high'], 12,
							['==', ['get', 'level'], 'elevated'], 10,
							8
						],
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(0, 0, 0, 0.9)',
						'text-halo-width': 1.5
					}
				});

				// ========== DISEASE OUTBREAK LAYERS ==========
				// Disease glow layer
				map.addLayer({
					id: 'diseases-glow',
					type: 'circle',
					source: 'diseases',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 2],
						'circle-color': ['get', 'color'],
						'circle-opacity': ['get', 'glowOpacity'],
						'circle-blur': 0.8
					}
				});

				// Disease main marker
				map.addLayer({
					id: 'diseases-layer',
					type: 'circle',
					source: 'diseases',
					paint: {
						'circle-radius': ['get', 'size'],
						'circle-color': ['get', 'color'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1.5,
						'circle-stroke-opacity': 0.8
					}
				});

				// Disease icon (biohazard symbol)
				map.addLayer({
					id: 'diseases-icon',
					type: 'symbol',
					source: 'diseases',
					layout: {
						'text-field': '\u2623', // Biohazard symbol
						'text-size': ['case',
							['==', ['get', 'severity'], 'critical'], 14,
							['==', ['get', 'severity'], 'high'], 12,
							['==', ['get', 'severity'], 'moderate'], 10,
							9
						],
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(0, 0, 0, 0.9)',
						'text-halo-width': 1.5
					}
				});

				// ========== EARTHQUAKE LAYERS ==========
				// Earthquake glow layer - zoom responsive, fades at high zoom
				map.addLayer({
					id: 'earthquakes-glow',
					type: 'circle',
					source: 'earthquakes',
					paint: {
						// Glow radius: smaller at low zoom, grows with zoom but capped
						'circle-radius': [
							'interpolate', ['linear'], ['zoom'],
							1, ['*', ['get', 'baseSize'], 1.5],
							4, ['*', ['get', 'baseSize'], 2],
							8, ['*', ['get', 'baseSize'], 2.5],
							12, ['*', ['get', 'baseSize'], 3]
						],
						'circle-color': ['get', 'color'],
						// Opacity fades as you zoom in
						'circle-opacity': [
							'interpolate', ['linear'], ['zoom'],
							1, ['get', 'glowOpacity'],
							6, ['*', ['get', 'glowOpacity'], 0.7],
							10, ['*', ['get', 'glowOpacity'], 0.4]
						],
						'circle-blur': 0.8
					}
				});

				// Earthquake main marker - zoom responsive sizing
				map.addLayer({
					id: 'earthquakes-layer',
					type: 'circle',
					source: 'earthquakes',
					paint: {
						// Size grows with zoom for detail
						'circle-radius': [
							'interpolate', ['linear'], ['zoom'],
							1, ['get', 'baseSize'],
							4, ['*', ['get', 'baseSize'], 1.2],
							8, ['*', ['get', 'baseSize'], 1.8],
							12, ['*', ['get', 'baseSize'], 2.5]
						],
						'circle-color': ['get', 'color'],
						// Opacity decreases as you zoom in (markers become more transparent)
						'circle-opacity': [
							'interpolate', ['linear'], ['zoom'],
							1, 0.9,
							6, 0.75,
							10, 0.5
						],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': [
							'interpolate', ['linear'], ['zoom'],
							1, 0.5,
							6, 1,
							12, 1.5
						],
						'circle-stroke-opacity': [
							'interpolate', ['linear'], ['zoom'],
							1, 0.7,
							6, 0.6,
							10, 0.4
						]
					}
				});

				// Earthquake icon (seismic wave symbol ~) - appears at closer zoom
				map.addLayer({
					id: 'earthquakes-icon',
					type: 'symbol',
					source: 'earthquakes',
					minzoom: 3, // Only show icon when zoomed in a bit
					layout: {
						'text-field': '〰', // Wavy line as seismic wave indicator
						'text-size': [
							'interpolate', ['linear'], ['zoom'],
							3, 6,
							6, 8,
							10, 12
						],
						'text-allow-overlap': true,
						'text-ignore-placement': true,
						'text-anchor': 'center'
					},
					paint: {
						'text-color': '#ffffff',
						'text-halo-color': 'rgba(0, 0, 0, 0.9)',
						'text-halo-width': 1,
						'text-opacity': [
							'interpolate', ['linear'], ['zoom'],
							3, 0.4,
							6, 0.7,
							10, 0.5
						]
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
			'ucdp-hotspots-layer', // UCDP conflict markers
			'volcanoes-layer', // USGS volcano markers
			'vessels-layer', // AIS vessel/ship markers
			'aircraft-layer', // ADS-B aircraft tracking
			'air-quality-layer', // OpenAQ air quality monitoring
			'radiation-layer', // Safecast radiation readings
			'diseases-layer' // Disease outbreaks
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

		// VIEWS Conflict forecast hotspot tooltip (Smart Hotspots)
		map.on('mousemove', 'ucdp-hotspots-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			// Use VIEWS-specific data fields
			const forecastMonth = props?.forecastMonth || 'Unknown';
			const fatalities = props?.forecastedFatalities || 0;
			const probability = props?.fatalityProbability || 0;

			// Build concise hover description
			const hoverDesc = `${forecastMonth} forecast: ~${fatalities} fatalities (${probability}% probability)`;

			tooltipData = {
				label: props?.label || props?.name || 'Conflict Forecast',
				type: 'views-conflict',
				desc: hoverDesc,
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
		map.on('mouseleave', 'volcanoes-layer', handleMouseLeave);
		map.on('mouseleave', 'vessels-layer', handleMouseLeave);
		map.on('mouseleave', 'aircraft-layer', handleMouseLeave);

		// Volcano mousemove handler
		map.on('mousemove', 'volcanoes-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			const alertLevel = props?.alertLevel || 'ADVISORY';
			const colorCode = props?.colorCode || 'YELLOW';

			tooltipData = {
				label: props?.name || 'Volcano',
				type: 'volcano',
				desc: `${alertLevel} (${colorCode}) - ${props?.country || 'Unknown'}`,
				level: alertLevel.toLowerCase(),
				isAlert: alertLevel === 'WARNING' || alertLevel === 'WATCH'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		// Vessel/Ship mousemove handler
		map.on('mousemove', 'vessels-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			const shipName = props?.name || 'Unknown Vessel';
			const shipType = props?.shipTypeName || 'Unknown';
			const flag = props?.flagEmoji || '';
			const speed = props?.speedFormatted || '0 kts';
			const course = props?.courseFormatted || 'N/A';

			tooltipData = {
				label: `${flag} ${shipName}`,
				type: 'vessel',
				desc: `${shipType} | ${speed} | ${course}`,
				level: 'info'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		// Aircraft mousemove handler
		map.on('mousemove', 'aircraft-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;
			const feature = e.features[0];
			const props = feature.properties;
			const callsign = props?.callsign || props?.icao24?.toUpperCase() || 'Unknown';
			const country = props?.originCountry || '';
			const alt = props?.altitudeFormatted || 'N/A';
			const spd = props?.velocityFormatted || 'N/A';
			tooltipData = {
				label: `${callsign} (${country})`,
				type: 'aircraft',
				desc: `${props?.onGround ? 'ON GROUND' : alt} | ${spd}`,
				level: props?.onGround ? 'low' : 'elevated'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		// Air quality mousemove handler
		map.on('mouseleave', 'air-quality-layer', handleMouseLeave);
		map.on('mousemove', 'air-quality-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			const location = props?.location || 'Unknown Station';
			const city = props?.city || '';
			const country = props?.country || '';
			const value = props?.value || 0;
			const unit = props?.unit || 'ug/m3';
			const aqi = props?.aqi || 0;
			const levelDesc = props?.levelDescription || '';

			const locationStr = city ? `${location}, ${city}` : `${location}, ${country}`;

			tooltipData = {
				label: locationStr,
				type: 'air-quality',
				desc: `PM2.5: ${value.toFixed(1)} ${unit} | AQI: ${aqi} | ${levelDesc}`,
				level: props?.level || 'good'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		// Radiation mousemove handler
		map.on('mouseleave', 'radiation-layer', handleMouseLeave);
		map.on('mousemove', 'radiation-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			const location = props?.location || 'Unknown Location';
			const value = props?.value || 0;
			const unit = props?.unit || 'cpm';
			const level = props?.level || 'normal';
			const deviceId = props?.deviceId || '';

			const valueStr = unit === 'usv' ? `${value.toFixed(3)} µSv/h` : `${Math.round(value)} CPM`;
			const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

			tooltipData = {
				label: location,
				type: 'radiation',
				desc: `${valueStr} | ${levelLabel}${deviceId ? ` | ${deviceId}` : ''}`,
				level: level,
				isAlert: level === 'dangerous' || level === 'high'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		// Disease outbreak mousemove handler
		map.on('mouseleave', 'diseases-layer', handleMouseLeave);
		map.on('mousemove', 'diseases-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			const disease = props?.disease || 'Unknown Disease';
			const country = props?.country || '';
			const region = props?.region || '';
			const cases = props?.cases || 0;
			const deaths = props?.deaths || 0;
			const severity = props?.severity || 'moderate';
			const status = props?.status || 'active';

			const locationStr = region ? `${country} (${region})` : country;
			const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
			const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

			let statsStr = '';
			if (cases > 0) statsStr += `Cases: ${cases.toLocaleString()}`;
			if (deaths > 0) statsStr += statsStr ? ` | Deaths: ${deaths.toLocaleString()}` : `Deaths: ${deaths.toLocaleString()}`;

			tooltipData = {
				label: `${disease} - ${locationStr}`,
				type: 'disease',
				desc: `${severityLabel} | ${statusLabel}${statsStr ? ` | ${statsStr}` : ''}`,
				level: severity,
				isAlert: severity === 'critical' || severity === 'high'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		// Earthquake mousemove handler
		map.on('mouseleave', 'earthquakes-layer', handleMouseLeave);
		map.on('mousemove', 'earthquakes-layer', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			const magnitude = props?.magnitude || 0;
			const place = props?.place || 'Unknown Location';
			const depth = props?.depth || 0;
			const time = props?.time || Date.now();
			const category = props?.category || 'light';

			// Format time
			const quakeDate = new Date(time);
			const timeAgo = formatTimeAgo(quakeDate);

			// Magnitude category label
			const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

			tooltipData = {
				label: `M${magnitude.toFixed(1)} - ${place}`,
				type: 'earthquake',
				desc: `${categoryLabel} | Depth: ${depth.toFixed(1)}km | ${timeAgo}`,
				level: category,
				isAlert: category === 'major' || category === 'strong'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		// Weather alerts hover
		map.on('mousemove', 'weather-alerts-fill', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked || !map) return;

			const feature = e.features[0];
			const props = feature.properties;

			map.getCanvas().style.cursor = 'pointer';

			tooltipData = {
				label: props?.event || 'Weather Alert',
				type: 'weather-alert',
				desc: props?.areaDesc || 'Unknown area',
				level: props?.severity?.toLowerCase() || 'unknown'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		map.on('mouseleave', 'weather-alerts-fill', () => {
			if (tooltipLocked || !map) return;
			map.getCanvas().style.cursor = '';
			tooltipVisible = false;
			tooltipData = null;
			resumeRotation();
		});

		// Convective outlook hover - both categorical and hazard layers
		const convectiveHoverHandler = (e: mapboxgl.MapLayerMouseEvent) => {
			if (!e.features || e.features.length === 0 || tooltipLocked || !map) return;

			const props = e.features[0].properties;

			map.getCanvas().style.cursor = 'pointer';

			// Use the pre-computed labels from the GeoJSON properties
			const typeLabel = props?.typeLabel || 'Storm Outlook';
			const riskLabel = props?.riskLabel || props?.risk || 'Unknown';
			const isSignificant = props?.isSignificant;

			tooltipData = {
				label: `Day ${props?.day || 1} ${typeLabel}`,
				type: 'convective',
				desc: `${riskLabel}${isSignificant ? ' (SIGNIFICANT)' : ''}`,
				level:
					props?.risk === 'HIGH' || props?.risk === 'MDT' || isSignificant
						? 'critical'
						: props?.risk === 'ENH' || props?.risk === 'SLGT' || props?.risk === '10%' || props?.risk === '15%'
							? 'elevated'
							: 'low'
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		};

		const convectiveLeaveHandler = () => {
			if (tooltipLocked || !map) return;
			map.getCanvas().style.cursor = '';
			tooltipVisible = false;
			tooltipData = null;
			resumeRotation();
		};

		map.on('mousemove', 'convective-fill', convectiveHoverHandler);
		map.on('mousemove', 'convective-hazard-outline', convectiveHoverHandler);
		map.on('mouseleave', 'convective-fill', convectiveLeaveHandler);
		map.on('mouseleave', 'convective-hazard-outline', convectiveLeaveHandler);

		// Cyclone hover
		map.on('mousemove', 'cyclone-points', (e) => {
			if (!e.features || e.features.length === 0 || tooltipLocked || !map) return;

			const feature = e.features[0];
			const props = feature.properties;

			map.getCanvas().style.cursor = 'pointer';

			const isCurrentPos = props?.hour === 0;
			const forecastHour = props?.hour ?? 0;
			tooltipData = {
				label: `${isCurrentPos ? '🌀 ' : ''}${props?.name || 'Storm'}`,
				type: 'cyclone',
				desc: `${props?.category || 'TS'} - ${props?.wind || '?'} kt${forecastHour > 0 ? ` (+${forecastHour}h forecast)` : ' (current)'}`,
				level:
					props?.category?.startsWith('H') && parseInt(props.category.slice(1)) >= 3
						? 'critical'
						: 'elevated'
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

		map.on('click', 'points-layer', (e) => handlePointClick(e));
		map.on('click', 'news-events-layer', (e) => handlePointClick(e));
		map.on('click', 'outages-layer', (e) => handleOutageClick(e));
		map.on('click', 'ucdp-hotspots-layer', (e) => handleConflictClick(e));
		map.on('click', 'volcanoes-layer', (e) => handleVolcanoClick(e));
		map.on('click', 'vessels-layer', (e) => handleVesselClick(e));
		map.on('click', 'aircraft-layer', (e) => handleAircraftClick(e));
		map.on('click', 'air-quality-layer', (e) => handleAirQualityClick(e));
		map.on('click', 'radiation-layer', (e) => handleRadiationClick(e));
		map.on('click', 'diseases-layer', (e) => handleDiseaseClick(e));
		map.on('click', 'earthquakes-layer', (e) => handleEarthquakeClick(e));
		map.on('click', 'weather-alerts-fill', (e) => handleWeatherAlertClick(e));

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
			// Handle map picker mode for weather zones
			if ($mapPickerMode) {
				const { lng, lat } = e.lngLat;
				weather.handleMapPick(lat, lng);
				return;
			}

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
			desc = `Carbon Intensity: ${intensityLevelLabel}${intensityPercent ? ` (${intensityPercent})` : ''}. ${props?.desc || ''}`;
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

		// Build detailed description using VIEWS data
		const country = props?.name || props?.country || 'Unknown';
		const isoCode = props?.isoCode || '';
		const forecastMonth = props?.forecastMonth || 'Unknown';
		const fatalities = props?.forecastedFatalities || 0;
		const probability = props?.fatalityProbability || 0;
		const riskDescription = props?.riskDescription || '';
		const reasoning = props?.reasoning || '';
		const dataSource = props?.dataSource || 'VIEWS';

		// Format multi-line description for detailed click view
		const descParts = [
			`Country: ${country}${isoCode ? ` (${isoCode})` : ''}`,
			`Forecast Period: ${forecastMonth}`,
			fatalities > 0 ? `Forecasted Fatalities: ${fatalities}` : '',
			probability > 0 ? `Probability: ${(probability * 100).toFixed(1)}%` : '',
			``,
			riskDescription,
			``,
			`Analysis: ${reasoning}`,
			``,
			`Source: ${dataSource}`
		].filter(Boolean);

		tooltipData = {
			label: props?.label || `${country} - Conflict Forecast`,
			type: 'views-conflict',
			desc: descParts.join('\n'),
			level: props?.intensity,
			isAlert: props?.intensity === 'critical' || props?.intensity === 'high'
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	function handleVolcanoClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;

		const feature = e.features[0];
		const props = feature.properties;

		const alertLevel = props?.alertLevel || 'ADVISORY';
		const colorCode = props?.colorCode || 'YELLOW';
		const elevation = props?.elevation ? `${props.elevation.toLocaleString()}m elevation` : '';
		const region = props?.region || '';
		const country = props?.country || 'Unknown';
		const alertDesc = props?.alertDescription || '';
		const notice = props?.notice || '';
		const lastUpdate = props?.lastUpdate ? `Last update: ${new Date(props.lastUpdate).toLocaleDateString()}` : '';

		// Build description
		const descParts = [
			`Alert: ${alertLevel} (${colorCode})`,
			alertDesc,
			region ? `Region: ${region}` : '',
			elevation,
			notice,
			lastUpdate
		].filter(Boolean);

		tooltipData = {
			label: `${props?.name || 'Volcano'} - ${country}`,
			type: 'volcano',
			desc: descParts.join('\n'),
			level: alertLevel.toLowerCase(),
			isAlert: alertLevel === 'WARNING' || alertLevel === 'WATCH'
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	function handleVesselClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;
		const feature = e.features[0];
		const props = feature.properties;

		tooltipData = {
			label: props?.name || props?.mmsi || 'Unknown Vessel',
			type: 'vessel',
			desc: `Type: ${props?.shipType || 'Unknown'}\nFlag: ${props?.flag || 'N/A'}\nSpeed: ${props?.speedFormatted || 'N/A'}\nHeading: ${props?.headingFormatted || 'N/A'}`,
			level: 'low'
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	function handleAircraftClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;
		const feature = e.features[0];
		const props = feature.properties;

		const verticalRate = props?.verticalRate;
		const verticalIndicator = verticalRate ? (verticalRate > 0 ? ' (Climbing)' : verticalRate < 0 ? ' (Descending)' : ' (Level)') : '';
		const groundStatus = props?.onGround ? 'ON GROUND' : 'AIRBORNE';

		tooltipData = {
			label: `${props?.callsign || props?.icao24?.toUpperCase() || 'Unknown'} - ${props?.originCountry || 'Unknown'}`,
			type: 'aircraft',
			desc: `ICAO24: ${props?.icao24?.toUpperCase() || 'N/A'}\nStatus: ${groundStatus}${verticalIndicator}\nAltitude: ${props?.altitudeFormatted || 'N/A'}\nSpeed: ${props?.velocityFormatted || 'N/A'}\nHeading: ${props?.headingFormatted || 'N/A'}${props?.squawk ? `\nSquawk: ${props.squawk}` : ''}`,
			level: props?.onGround ? 'low' : 'elevated'
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	function handleAirQualityClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;
		const feature = e.features[0];
		const props = feature.properties;

		const location = props?.location || 'Unknown Station';
		const city = props?.city || '';
		const country = props?.country || 'Unknown';
		const value = props?.value || 0;
		const unit = props?.unit || 'ug/m3';
		const aqi = props?.aqi || 0;
		const level = props?.level || 'good';
		const levelDesc = props?.levelDescription || '';
		const lastUpdated = props?.lastUpdated ? new Date(props.lastUpdated).toLocaleString() : 'N/A';

		const locationStr = city ? `${location}, ${city}, ${country}` : `${location}, ${country}`;

		tooltipData = {
			label: locationStr,
			type: 'air-quality',
			desc: `PM2.5: ${value.toFixed(1)} ${unit}\nAQI: ${aqi}\nLevel: ${levelDesc}\nLast Updated: ${lastUpdated}`,
			level: level
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	function handleRadiationClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;
		const feature = e.features[0];
		const props = feature.properties;

		const location = props?.location || 'Unknown Location';
		const value = props?.value || 0;
		const unit = props?.unit || 'cpm';
		const level = props?.level || 'normal';
		const deviceId = props?.deviceId || '';
		const capturedAt = props?.capturedAt ? new Date(props.capturedAt).toLocaleString() : 'N/A';

		const valueStr = unit === 'usv' ? `${value.toFixed(3)} µSv/h` : `${Math.round(value)} CPM`;
		const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

		tooltipData = {
			label: `☢ ${location}`,
			type: 'radiation',
			desc: `Radiation: ${valueStr}\nLevel: ${levelLabel}${deviceId ? `\nDevice: ${deviceId}` : ''}\nCaptured: ${capturedAt}`,
			level: level,
			isAlert: level === 'dangerous' || level === 'high'
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	function handleDiseaseClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;
		const feature = e.features[0];
		const props = feature.properties;

		const disease = props?.disease || 'Unknown Disease';
		const country = props?.country || 'Unknown';
		const region = props?.region || '';
		const cases = props?.cases || 0;
		const deaths = props?.deaths || 0;
		const severity = props?.severity || 'moderate';
		const status = props?.status || 'active';
		const source = props?.source || '';
		const lastUpdate = props?.lastUpdate ? new Date(props.lastUpdate).toLocaleDateString() : 'N/A';

		const locationStr = region ? `${country} (${region})` : country;
		const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
		const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

		let statsStr = '';
		if (cases > 0) statsStr += `Cases: ${cases.toLocaleString()}`;
		if (deaths > 0) statsStr += statsStr ? `\nDeaths: ${deaths.toLocaleString()}` : `Deaths: ${deaths.toLocaleString()}`;

		tooltipData = {
			label: `☣ ${disease}`,
			type: 'disease',
			desc: `Location: ${locationStr}\nSeverity: ${severityLabel}\nStatus: ${statusLabel}${statsStr ? `\n${statsStr}` : ''}\nSource: ${source}\nLast Update: ${lastUpdate}`,
			level: severity,
			isAlert: severity === 'critical' || severity === 'high'
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();
	}

	// Format time as relative (e.g., "2h ago", "15m ago")
	function formatTimeAgo(date: Date): string {
		const now = Date.now();
		const diff = now - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ago`;
		if (hours > 0) return `${hours}h ago`;
		if (minutes > 0) return `${minutes}m ago`;
		return 'just now';
	}

	function handleEarthquakeClick(e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) {
		if (!e.features || e.features.length === 0) return;
		const feature = e.features[0];
		const props = feature.properties;

		const magnitude = props?.magnitude || 0;
		const place = props?.place || 'Unknown Location';
		const depth = props?.depth || 0;
		const time = props?.time || Date.now();
		const category = props?.category || 'light';
		const url = props?.url || '';

		const quakeDate = new Date(time);
		const formattedDate = quakeDate.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});

		const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

		tooltipData = {
			label: `〰 M${magnitude.toFixed(1)} Earthquake`,
			type: 'earthquake',
			desc: `Location: ${place}\nMagnitude: ${magnitude.toFixed(1)} (${categoryLabel})\nDepth: ${depth.toFixed(1)} km\nTime: ${formattedDate}${url ? `\n\nClick USGS link for details` : ''}`,
			level: category,
			isAlert: category === 'major' || category === 'strong'
		};
		tooltipVisible = true;
		tooltipLocked = true;
		updateTooltipPosition(e.point);
		pauseRotation();

		// Open USGS link if available
		if (url) {
			window.open(url, '_blank', 'noopener,noreferrer');
		}
	}

	function handleWeatherAlertClick(
		e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }
	) {
		if (!e.features || e.features.length === 0) return;
		const feature = e.features[0];
		const props = feature.properties;

		const event = props?.event || 'Weather Alert';
		const severity = props?.severity || 'Unknown';
		const areaDesc = props?.areaDesc || 'Unknown area';
		const alertId = props?.id || '';

		// Find full alert data
		const fullAlert = globeWeatherAlerts.find((a) => a.id === alertId);
		const headline = fullAlert?.headline || '';
		const instruction = fullAlert?.instruction || '';
		const expires = fullAlert?.expires ? new Date(fullAlert.expires).toLocaleString() : '';

		tooltipData = {
			label: `⚠ ${event}`,
			type: 'weather-alert',
			desc: `${areaDesc}${headline ? `\n\n${headline}` : ''}${instruction ? `\n\nInstructions: ${instruction.substring(0, 200)}${instruction.length > 200 ? '...' : ''}` : ''}${expires ? `\n\nExpires: ${expires}` : ''}`,
			level: severity.toLowerCase()
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
				aircraftData?.length ?? 0,
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
				dataLayers.aircraft.visible,
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

	// Handle flyToTarget prop changes - navigate globe to specified coordinates
	$effect(() => {
		// Use the derived currentFlyTarget to ensure reactivity
		const target = currentFlyTarget;
		console.log('[GlobePanel flyTo Effect] Running', { map: !!map, isInitialized, target });
		if (!map || !isInitialized || !target) return;

		// Track all target properties to ensure reactivity
		const { lat, lon, zoom, _ts } = target;

		console.log('[GlobePanel flyTo Effect] Flying to:', { lat, lon, zoom, _ts });

		// Pause rotation when flying to a location
		if (isRotating) {
			pauseRotation();
		}

		// Fly to the target coordinates with smooth animation
		map.flyTo({
			center: [lon, lat],
			zoom: zoom ?? 4,
			duration: 2000,
			essential: true
		});
	});

	// Update map layers when radiation or disease data changes
	$effect(() => {
		// Track changes to radiation readings and disease outbreaks
		const radiationCount = radiationReadings.length;
		const diseaseCount = diseaseOutbreaks.length;

		// Only update if map is ready
		if (!map || !isInitialized) return;

		// Avoid running on initial mount with empty data
		if (radiationCount > 0 || diseaseCount > 0) {
			updateMapLayers();
		}
	});

	// Watch for selected weather alert changes
	$effect(() => {
		const alert = $selectedAlert;
		if (alert && map && isInitialized) {
			// Handle alert selection (may need to fetch geometry)
			handleAlertSelection(alert);
		}
	});

	// Handle alert selection - fetch geometry if needed, then show on map
	async function handleAlertSelection(alert: WeatherAlert) {
		// Ensure alerts are visible
		if (!weatherAlertsVisible) {
			weatherAlertsVisible = true;
		}

		// Check if alert has geometry
		let alertWithGeometry = alert;
		if (!alert.geometry) {
			console.log(`[Weather Alerts] Alert "${alert.event}" has no geometry, fetching zone geometry...`);
			const geometry = await fetchZoneGeometryForAlert(alert);
			if (geometry) {
				alertWithGeometry = { ...alert, geometry };
				console.log(`[Weather Alerts] Fetched zone geometry for "${alert.event}"`);
			} else {
				console.log(`[Weather Alerts] Could not fetch geometry for "${alert.event}"`);
			}
		}

		// Add alert to globe alerts if not present (with geometry if we got it)
		const existingIndex = globeWeatherAlerts.findIndex((a) => a.id === alert.id);
		if (existingIndex === -1) {
			globeWeatherAlerts = [...globeWeatherAlerts, alertWithGeometry];
		} else if (alertWithGeometry.geometry && !globeWeatherAlerts[existingIndex].geometry) {
			// Update existing alert with geometry
			const updated = [...globeWeatherAlerts];
			updated[existingIndex] = alertWithGeometry;
			globeWeatherAlerts = updated;
		}

		updateWeatherAlertLayer();
		flyToAlert(alertWithGeometry);
	}

	// Track which store alert batches we've processed to avoid loops
	let lastProcessedStoreAlertIds = $state<string>('');
	let isProcessingStoreAlerts = $state(false);

	// Watch for weather store alerts changes (from configured zones)
	// Automatically fetch geometry for all alerts and add to map
	$effect(() => {
		const storeAlerts = $weather.alerts;
		if (storeAlerts.length > 0 && map && isInitialized && !isProcessingStoreAlerts) {
			// Create a key from alert IDs to detect actual changes
			const alertIdsKey = storeAlerts.map((a) => a.id).sort().join(',');

			// Skip if we've already processed this exact set of alerts
			if (alertIdsKey === lastProcessedStoreAlertIds) {
				return;
			}

			lastProcessedStoreAlertIds = alertIdsKey;

			// Automatically show weather alerts and fetch geometries
			if (!weatherAlertsVisible) {
				weatherAlertsVisible = true;
			}
			// Fetch geometries for all store alerts
			fetchGeometriesForStoreAlerts(storeAlerts);
		}
	});

	// Fetch geometries for store alerts and add them to globe alerts
	async function fetchGeometriesForStoreAlerts(storeAlerts: WeatherAlert[]) {
		if (isProcessingStoreAlerts) return;
		isProcessingStoreAlerts = true;

		// Filter to only alerts not already in globe alerts
		const newAlerts = storeAlerts.filter((a) => !globeWeatherAlerts.find((g) => g.id === a.id));

		if (newAlerts.length === 0) {
			isProcessingStoreAlerts = false;
			return;
		}

		console.log(`[Weather Alerts] Processing ${newAlerts.length} new watched zone alerts...`);

		// Separate alerts that already have geometry from those that need fetching
		const alertsWithExistingGeometry = newAlerts.filter((a) => a.geometry);
		const alertsNeedingGeometry = newAlerts.filter((a) => !a.geometry);

		// Immediately add alerts that already have geometry
		if (alertsWithExistingGeometry.length > 0) {
			console.log(`[Weather Alerts] Immediately adding ${alertsWithExistingGeometry.length} alerts with existing geometry`);
			globeWeatherAlerts = [...globeWeatherAlerts, ...alertsWithExistingGeometry];
			updateWeatherAlertLayer();
		}

		// Fetch missing geometries in parallel (batch of 5 at a time to avoid overwhelming the API)
		if (alertsNeedingGeometry.length > 0) {
			console.log(`[Weather Alerts] Fetching geometries for ${alertsNeedingGeometry.length} alerts...`);

			const BATCH_SIZE = 5;
			for (let i = 0; i < alertsNeedingGeometry.length; i += BATCH_SIZE) {
				const batch = alertsNeedingGeometry.slice(i, i + BATCH_SIZE);

				const batchResults = await Promise.all(
					batch.map(async (alert) => {
						const geometry = await fetchZoneGeometryForAlert(alert);
						return geometry ? { ...alert, geometry } : alert;
					})
				);

				// Add batch results and update layer
				const withGeometry = batchResults.filter((a) => a.geometry);
				if (withGeometry.length > 0) {
					globeWeatherAlerts = [...globeWeatherAlerts, ...batchResults];
					updateWeatherAlertLayer();
					console.log(`[Weather Alerts] Added batch of ${batchResults.length} alerts (${withGeometry.length} with geometry)`);
				} else {
					// Still add alerts without geometry so they're tracked
					globeWeatherAlerts = [...globeWeatherAlerts, ...batchResults];
				}
			}
		}

		const finalWithGeo = globeWeatherAlerts.filter((a) => a.geometry).length;
		console.log(`[Weather Alerts] Total: ${globeWeatherAlerts.length} alerts (${finalWithGeo} with geometry)`);

		isProcessingStoreAlerts = false;
	}

	// Reactively update weather alert layer when globeWeatherAlerts or visibility changes
	$effect(() => {
		// Track dependencies
		const alertCount = globeWeatherAlerts.length;
		const storeAlertCount = $weather.alerts.length;
		const visible = weatherAlertsVisible;

		// Only update if we have alerts and layer is visible
		if ((alertCount > 0 || storeAlertCount > 0) && visible && map && isInitialized) {
			// Use tick to ensure state is committed before updating
			updateWeatherAlertLayer();
		}
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

				// Volcanoes - fiery pulse effect (faster pulse for urgency)
				const volcanoPulse = Math.sin((markerPhase / 20) * Math.PI * 2);
				const volcanoOuterOpacity = 0.25 + volcanoPulse * 0.15;
				const volcanoMiddleOpacity = 0.35 + volcanoPulse * 0.2;
				map.setPaintProperty('volcanoes-glow-outer', 'circle-opacity', volcanoOuterOpacity);
				map.setPaintProperty('volcanoes-glow-middle', 'circle-opacity', volcanoMiddleOpacity);
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

	// Load ADS-B aircraft data from OpenSky Network for selected regions
	async function loadAircraftData(force = false) {
		// Use adsbEnabled prop directly instead of dataLayers.aircraft.visible
		// to avoid timing issues when called immediately after enabling
		if (aircraftDataLoading) {
			console.log('[ADS-B] Skipping fetch - already loading');
			return;
		}
		if (!adsbEnabled) {
			console.log('[ADS-B] Skipping fetch - ADS-B not enabled');
			return;
		}

		const now = Date.now();

		// Check if we're in rate-limit backoff period
		if (isRateLimited && now - lastAircraftFetch < RATE_LIMIT_BACKOFF_MS) {
			const waitTime = Math.ceil((RATE_LIMIT_BACKOFF_MS - (now - lastAircraftFetch)) / 1000);
			console.log(`[ADS-B] Skipping fetch - rate limited, waiting ${waitTime}s`);
			return;
		}
		// Clear rate limit flag if backoff period has passed
		if (isRateLimited) {
			isRateLimited = false;
			console.log('[ADS-B] Rate limit backoff period ended');
		}

		// Debounce: don't fetch if we fetched recently (unless forced)
		if (!force && now - lastAircraftFetch < AIRCRAFT_DEBOUNCE_MS) {
			console.log('[ADS-B] Skipping fetch - debounced');
			return;
		}

		if (selectedAircraftRegions.size === 0) {
			console.log('[ADS-B] No regions selected, clearing data');
			aircraftData = [];
			if (map && isInitialized) updateMapLayers();
			return;
		}

		console.log('[ADS-B] Starting fetch for regions:', Array.from(selectedAircraftRegions));
		lastAircraftFetch = now;
		// Persist to localStorage for cross-refresh rate limiting
		if (typeof window !== 'undefined') {
			localStorage.setItem('adsb-last-fetch', now.toString());
		}
		aircraftDataLoading = true;
		try {
			// Collect all aircraft from selected regions
			const allAircraft: Aircraft[] = [];
			const seenIcao = new Set<string>(); // Deduplicate by ICAO24

			// Fetch aircraft from each selected region
			for (const regionId of selectedAircraftRegions) {
				let bounds: [number, number, number, number];

				if (regionId === 'viewport') {
					// Use current viewport bounds
					if (map) {
						const mapBounds = map.getBounds();
						if (mapBounds) {
							bounds = [
								mapBounds.getWest(),
								mapBounds.getSouth(),
								mapBounds.getEast(),
								mapBounds.getNorth()
							];
							console.log('[ADS-B] Viewport bounds:', bounds);
						} else {
							console.log('[ADS-B] No map bounds available for viewport');
							continue; // Skip if no bounds available
						}
					} else {
						console.log('[ADS-B] Map not ready for viewport region');
						continue;
					}
				} else {
					const region = AIRCRAFT_REGIONS[regionId];
					if (!region) continue;
					bounds = region.bounds;
				}

				try {
					const data = await fetchAircraftPositions(bounds);
					console.log(`[ADS-B] Fetched ${data.length} aircraft for region ${regionId}`);

					// Add unique aircraft to the list
					for (const aircraft of data) {
						if (!seenIcao.has(aircraft.icao24)) {
							seenIcao.add(aircraft.icao24);
							allAircraft.push(aircraft);
						}
					}

					// Store snapshot in history (per region)
					const regionName = regionId === 'viewport' ? 'Viewport' : AIRCRAFT_REGIONS[regionId]?.name || regionId;
					const snapshot: AircraftSnapshot = {
						timestamp: Date.now(),
						aircraft: data,
						region: regionName
					};

					// Add to history (maintaining max size)
					aircraftHistory = [snapshot, ...aircraftHistory].slice(0, MAX_AIRCRAFT_HISTORY);
				} catch (regionError) {
					// Check if this is a rate limit error
					if (regionError instanceof OpenSkyRateLimitError) {
						console.warn(`[ADS-B] Rate limited by OpenSky API - waiting ${RATE_LIMIT_BACKOFF_MS / 1000}s before retrying`);
						isRateLimited = true;
						// Break out of the region loop since all subsequent calls will also fail
						break;
					}
					console.warn(`Failed to fetch aircraft for region ${regionId}:`, regionError);
				}
			}

			console.log(`[ADS-B] Total unique aircraft loaded: ${allAircraft.length}`);

			// Limit displayed aircraft for performance, prioritizing by altitude (higher = more visible)
			if (allAircraft.length > MAX_AIRCRAFT_DISPLAY) {
				// Sort by altitude descending (higher altitude aircraft are more significant)
				allAircraft.sort((a, b) => {
					const altA = a.geoAltitude ?? a.baroAltitude ?? 0;
					const altB = b.geoAltitude ?? b.baroAltitude ?? 0;
					return altB - altA;
				});
				aircraftData = allAircraft.slice(0, MAX_AIRCRAFT_DISPLAY);
				console.log(`[ADS-B] Limited to ${MAX_AIRCRAFT_DISPLAY} aircraft for display`);
			} else {
				aircraftData = allAircraft;
			}

			if (map && isInitialized) updateMapLayers();
		} catch (error) {
			console.warn('Failed to fetch aircraft data:', error);
		} finally {
			aircraftDataLoading = false;
		}
	}

	function startAircraftPolling() {
		if (aircraftRefreshInterval) return;
		loadAircraftData(true); // Force initial fetch
		aircraftRefreshInterval = setInterval(() => loadAircraftData(true), AIRCRAFT_REFRESH_INTERVAL);
	}

	function stopAircraftPolling() {
		if (aircraftRefreshInterval) {
			clearInterval(aircraftRefreshInterval);
			aircraftRefreshInterval = null;
		}
		aircraftData = [];
		if (map && isInitialized) updateMapLayers();
	}

	// Sync ADS-B enabled state with dataLayers (controlled from AircraftPanel)
	// Track both adsbEnabled and isInitialized to ensure we start polling only when map is ready
	$effect(() => {
		// Track isInitialized as a dependency so this effect re-runs when map is ready
		const mapReady = isInitialized;

		if (dataLayers.aircraft.visible !== adsbEnabled) {
			dataLayers.aircraft.visible = adsbEnabled;
			if (adsbEnabled) {
				// Only start polling if map is initialized
				if (mapReady) {
					console.log('[ADS-B] Starting aircraft polling - map ready');
					startAircraftPolling();
				} else {
					console.log('[ADS-B] ADS-B enabled but map not ready yet, waiting...');
				}
			} else {
				stopAircraftPolling();
				aircraftData = [];
				if (map && mapReady) updateMapLayers();
			}
		} else if (adsbEnabled && mapReady && !aircraftRefreshInterval) {
			// Map just became ready and ADS-B is already enabled - start polling now
			console.log('[ADS-B] Map ready, starting deferred aircraft polling');
			startAircraftPolling();
		}
	});

	// Track previous regions to detect actual changes
	let lastRegionKey = '';

	// Reload aircraft data only when regions actually change
	$effect(() => {
		const regionCount = selectedAircraftRegions.size;
		const currentRegionKey = Array.from(selectedAircraftRegions).sort().join(',');

		// Only proceed if regions actually changed
		if (currentRegionKey === lastRegionKey) return;
		lastRegionKey = currentRegionKey;

		// Clear data if no regions selected
		if (regionCount === 0) {
			if (adsbEnabled) {
				aircraftData = [];
				if (map && isInitialized) updateMapLayers();
			}
			return;
		}

		// Reload data if ADS-B is enabled and regions changed
		if (adsbEnabled) {
			loadAircraftData();
		}
	});

	// Notify parent component when aircraft data changes
	$effect(() => {
		if (onAircraftDataChange && (aircraftData.length > 0 || aircraftHistory.length > 0)) {
			onAircraftDataChange(aircraftData, aircraftHistory);
		}
	});

	// Handle selected aircraft track visualization
	$effect(() => {
		// Access selectedAircraftTrack first to ensure we track it as a dependency
		const track = selectedAircraftTrack;
		const hasTrack = track && track.aircraft && track.aircraft.latitude !== null && track.aircraft.longitude !== null;

		// Then check if map is ready
		if (!map || !isInitialized) return;

		if (hasTrack && track) {
			console.log('[GlobePanel] Flying to selected aircraft:', track.aircraft.callsign, track.aircraft.latitude, track.aircraft.longitude);
			// Fly to the selected aircraft
			map.flyTo({
				center: [track.aircraft.longitude!, track.aircraft.latitude!],
				zoom: 6,
				duration: 2000
			});

			// Update the track line layer
			updateAircraftTrackLayer();
		} else {
			// Clear the track line
			clearAircraftTrackLayer();
		}
	});

	// Generate GeoJSON for aircraft track history line
	function getAircraftTrackGeoJSON(): GeoJSON.FeatureCollection {
		if (!selectedAircraftTrack || selectedAircraftTrack.track.length < 2) {
			return { type: 'FeatureCollection', features: [] };
		}

		// Create line from track points (ordered oldest to newest for proper line direction)
		const sortedTrack = [...selectedAircraftTrack.track].sort((a, b) => a.timestamp - b.timestamp);
		const coordinates = sortedTrack.map(p => [p.lon, p.lat]);

		// Add current position at the end
		if (selectedAircraftTrack.aircraft.longitude && selectedAircraftTrack.aircraft.latitude) {
			coordinates.push([selectedAircraftTrack.aircraft.longitude, selectedAircraftTrack.aircraft.latitude]);
		}

		const features: GeoJSON.Feature[] = [
			// Track line
			{
				type: 'Feature',
				geometry: {
					type: 'LineString',
					coordinates
				},
				properties: {
					icao24: selectedAircraftTrack.aircraft.icao24,
					callsign: selectedAircraftTrack.aircraft.callsign
				}
			},
			// Track points
			...sortedTrack.map((point, index) => ({
				type: 'Feature' as const,
				geometry: {
					type: 'Point' as const,
					coordinates: [point.lon, point.lat]
				},
				properties: {
					index,
					timestamp: point.timestamp,
					altitude: point.altitude,
					isHistorical: true
				}
			}))
		];

		return { type: 'FeatureCollection', features };
	}

	// Update aircraft track layer on map
	function updateAircraftTrackLayer() {
		if (!map) return;

		const trackData = getAircraftTrackGeoJSON();

		// Update or create the track source
		const trackSource = map.getSource('aircraft-track') as mapboxgl.GeoJSONSource;
		if (trackSource) {
			trackSource.setData(trackData);
		} else {
			// Add source and layers if they don't exist
			map.addSource('aircraft-track', {
				type: 'geojson',
				data: trackData
			});

			// Track line layer
			map.addLayer({
				id: 'aircraft-track-line',
				type: 'line',
				source: 'aircraft-track',
				filter: ['==', '$type', 'LineString'],
				paint: {
					'line-color': '#a855f7', // Purple
					'line-width': 3,
					'line-opacity': 0.8,
					'line-dasharray': [2, 1]
				}
			});

			// Track points layer
			map.addLayer({
				id: 'aircraft-track-points',
				type: 'circle',
				source: 'aircraft-track',
				filter: ['==', '$type', 'Point'],
				paint: {
					'circle-radius': 5,
					'circle-color': '#a855f7',
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 1,
					'circle-opacity': 0.9
				}
			});
		}
	}

	// Clear aircraft track layer
	function clearAircraftTrackLayer() {
		if (!map) return;

		const trackSource = map.getSource('aircraft-track') as mapboxgl.GeoJSONSource;
		if (trackSource) {
			trackSource.setData({ type: 'FeatureCollection', features: [] });
		}
	}

	// Start AIS vessel WebSocket stream
	function startVesselStream() {
		if (vesselUnsubscribe) return; // Already subscribed

		// Subscribe to vessel data store for real-time updates
		vesselUnsubscribe = vesselStore.subscribe((vessels) => {
			vesselData = Array.from(vessels.values());
			if (map && isInitialized) updateMapLayers();
		});

		// Subscribe to connection status
		const statusUnsubscribe = vesselConnectionStatus.subscribe((status) => {
			vesselConnectionState = status;
		});

		// Store both unsubscribers
		const originalUnsubscribe = vesselUnsubscribe;
		vesselUnsubscribe = () => {
			originalUnsubscribe();
			statusUnsubscribe();
		};

		// Connect to WebSocket stream
		connectVesselStream();
	}

	function stopVesselStream() {
		if (vesselUnsubscribe) {
			vesselUnsubscribe();
			vesselUnsubscribe = null;
		}
		disconnectVesselStream();
		vesselData = [];
		vesselConnectionState = 'disconnected';
		if (map && isInitialized) updateMapLayers();
	}

	// Load OpenAQ air quality data
	async function loadAirQualityData() {
		if (airQualityDataLoading || !dataLayers.airQuality.visible) return;
		airQualityDataLoading = true;
		try {
			const data = await fetchAirQualityData();
			airQualityData = data;
			if (map && isInitialized) updateMapLayers();
		} catch (error) {
			console.warn('Failed to fetch air quality data:', error);
		} finally {
			airQualityDataLoading = false;
		}
	}

	// Load USGS volcano data
	async function loadVolcanoData() {
		if (volcanoDataLoading) return;
		volcanoDataLoading = true;
		try {
			const data = await fetchElevatedVolcanoes();
			volcanoData = data;
			if (map && isInitialized) {
				updateMapLayers();
			}
		} catch (error) {
			console.warn('Failed to fetch volcano data:', error);
		} finally {
			volcanoDataLoading = false;
		}
	}

	// Load weather radar animation data from RainViewer with retry
	let radarLoadRetries = 0;
	const MAX_RADAR_RETRIES = 3;

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
				radarLoadRetries = 0; // Reset retry count on success

				if (map && isInitialized) {
					addOrUpdateRadarLayer(weatherRadarTileUrl);
				}
				console.log(`[Radar] Loaded ${animData.frames.length} frames`);
			} else {
				throw new Error('No radar frames returned');
			}
		} catch (error) {
			console.warn('[Radar] Failed to fetch weather radar data:', error);

			// Retry logic
			if (radarLoadRetries < MAX_RADAR_RETRIES && weatherRadarVisible) {
				radarLoadRetries++;
				const retryDelay = 2000 * radarLoadRetries; // Exponential backoff
				console.log(`[Radar] Retrying in ${retryDelay}ms (attempt ${radarLoadRetries}/${MAX_RADAR_RETRIES})...`);
				setTimeout(() => {
					weatherRadarLoading = false;
					loadWeatherRadar();
				}, retryDelay);
				return; // Don't set loading to false yet
			}
		} finally {
			weatherRadarLoading = false;
		}
	}

	// Find the first symbol layer to insert radar layers before
	function findFirstSymbolLayer(): string | undefined {
		if (!map) return undefined;
		const layers = map.getStyle()?.layers || [];
		for (const layer of layers) {
			if (layer.type === 'symbol' || layer.type === 'circle') {
				return layer.id;
			}
		}
		return undefined;
	}

	// Initialize dual radar layers for smooth crossfade animation
	function initRadarLayers() {
		if (!map || !radarAnimationData) return;

		// Ensure map style is loaded before adding layers
		if (!map.isStyleLoaded()) {
			console.log('[Radar] Map style not loaded, deferring radar layer init...');
			map.once('style.load', () => initRadarLayers());
			return;
		}

		try {
			const firstSymbolLayer = findFirstSymbolLayer();
			const visibility = weatherRadarVisible ? 'visible' : 'none';
			const frame = radarAnimationData.frames[radarCurrentFrame];

			if (!frame?.tileUrl) {
				console.warn('[Radar] No valid frame URL for radar layer');
				return;
			}

			// Create layer A (initially visible)
			if (!map.getSource('weather-radar-A')) {
				map.addSource('weather-radar-A', {
					type: 'raster',
					tiles: [frame.tileUrl],
					tileSize: 256
				});
				map.addLayer(
					{
						id: 'weather-radar-layer-A',
						type: 'raster',
						source: 'weather-radar-A',
						paint: {
							'raster-opacity': 0.6,
							'raster-fade-duration': 200
						},
						layout: {
							visibility
						}
					},
					firstSymbolLayer
				);
			}

			// Create layer B (initially hidden, for preloading next frame)
			if (!map.getSource('weather-radar-B')) {
				map.addSource('weather-radar-B', {
					type: 'raster',
					tiles: [frame.tileUrl],
					tileSize: 256
				});
				map.addLayer(
					{
						id: 'weather-radar-layer-B',
						type: 'raster',
						source: 'weather-radar-B',
						paint: {
							'raster-opacity': 0,
							'raster-fade-duration': 200
						},
						layout: {
							visibility
						}
					},
					firstSymbolLayer
				);
			}

			radarActiveLayer = 'A';
			console.log('[Radar] Layers initialized successfully');
		} catch (error) {
			console.warn('[Radar] Failed to initialize radar layers:', error);
			// Retry after a short delay
			setTimeout(() => {
				if (map && radarAnimationData && weatherRadarVisible) {
					initRadarLayers();
				}
			}, 1000);
		}
	}

	// Add or update the weather radar raster layer
	function addOrUpdateRadarLayer(_tileUrl: string) {
		if (!map) return;

		try {
			// Clean up old single-layer approach if it exists
			if (map.getSource('weather-radar')) {
				if (map.getLayer('weather-radar-layer')) {
					map.removeLayer('weather-radar-layer');
				}
				map.removeSource('weather-radar');
			}

			// Initialize dual layers (uses radarAnimationData for current frame)
			initRadarLayers();
		} catch (error) {
			console.warn('[Radar] Failed to update radar layer:', error);
		}
	}

	// Preload upcoming frames for smoother animation
	function preloadRadarFrames() {
		if (!radarAnimationData) return;

		// Preload next 3 frames by creating Image objects
		for (let i = 1; i <= 3; i++) {
			const nextIndex = (radarCurrentFrame + i) % radarAnimationData.frames.length;
			if (!radarPreloadedFrames.has(nextIndex)) {
				const img = new Image();
				img.src = radarAnimationData.frames[nextIndex].tileUrl
					.replace('{z}', '4')
					.replace('{x}', '4')
					.replace('{y}', '6');
				radarPreloadedFrames = new Set([...radarPreloadedFrames, nextIndex]);
			}
		}
	}

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
			// Preload frames before starting
			preloadRadarFrames();
			radarAnimationInterval = setInterval(() => {
				if (!radarAnimationData) return;
				radarCurrentFrame = (radarCurrentFrame + 1) % radarAnimationData.frames.length;
				updateRadarFrame(radarCurrentFrame);
				// Preload more frames as we go
				preloadRadarFrames();
			}, 600); // Slightly slower for smoother transitions
		}
	}

	// Update map to show specific radar frame using crossfade
	function updateRadarFrame(frameIndex: number) {
		if (!map || !radarAnimationData || !radarAnimationData.frames[frameIndex]) return;

		const frame = radarAnimationData.frames[frameIndex];
		const nextLayer = radarActiveLayer === 'A' ? 'B' : 'A';
		const currentLayerId = `weather-radar-layer-${radarActiveLayer}`;
		const nextLayerId = `weather-radar-layer-${nextLayer}`;
		const nextSourceId = `weather-radar-${nextLayer}`;

		// Update the inactive layer's source with the new frame
		const nextSource = map.getSource(nextSourceId);
		if (nextSource) {
			// Remove and recreate source with new tiles
			if (map.getLayer(nextLayerId)) {
				// Fade out current layer
				map.setPaintProperty(currentLayerId, 'raster-opacity', 0);
			}
			map.removeSource(nextSourceId);
			map.addSource(nextSourceId, {
				type: 'raster',
				tiles: [frame.tileUrl],
				tileSize: 256
			});

			// The layer should already exist, just update its source reference
			// Fade in the new layer
			setTimeout(() => {
				if (map && map.getLayer(nextLayerId)) {
					map.setPaintProperty(nextLayerId, 'raster-opacity', 0.6);
				}
			}, 50);

			// Switch active layer
			radarActiveLayer = nextLayer;
		} else {
			// Fallback: recreate layers if they don't exist
			initRadarLayers();
		}
	}

	// Step forward one frame
	function radarStepForward() {
		if (!radarAnimationData) return;
		radarCurrentFrame = (radarCurrentFrame + 1) % radarAnimationData.frames.length;
		updateRadarFrame(radarCurrentFrame);
	}

	// Step backward one frame
	function radarStepBackward() {
		if (!radarAnimationData) return;
		radarCurrentFrame =
			(radarCurrentFrame - 1 + radarAnimationData.frames.length) %
			radarAnimationData.frames.length;
		updateRadarFrame(radarCurrentFrame);
	}

	// Toggle weather radar visibility
	function toggleWeatherRadar() {
		weatherRadarVisible = !weatherRadarVisible;

		// Stop animation when hiding radar
		if (!weatherRadarVisible && radarAnimationPlaying) {
			if (radarAnimationInterval) {
				clearInterval(radarAnimationInterval);
				radarAnimationInterval = null;
			}
			radarAnimationPlaying = false;
		}

		// Load radar data if not already loaded
		if (weatherRadarVisible && !weatherRadarTileUrl && !weatherRadarLoading) {
			loadWeatherRadar();
		}

		// Toggle layer visibility for dual-layer system
		const visibility = weatherRadarVisible ? 'visible' : 'none';
		if (map) {
			// Handle dual-layer system
			if (map.getLayer('weather-radar-layer-A')) {
				map.setLayoutProperty('weather-radar-layer-A', 'visibility', visibility);
			}
			if (map.getLayer('weather-radar-layer-B')) {
				map.setLayoutProperty('weather-radar-layer-B', 'visibility', visibility);
			}
			// Legacy single-layer fallback
			if (map.getLayer('weather-radar-layer')) {
				map.setLayoutProperty('weather-radar-layer', 'visibility', visibility);
			}
		}
	}

	// Toggle satellite overlay visibility
	async function toggleSatelliteOverlay() {
		satelliteOverlayVisible = !satelliteOverlayVisible;

		if (satelliteOverlayVisible && !map?.getSource('satellite-overlay')) {
			satelliteOverlayLoading = true;
			try {
				// RainViewer infrared satellite tiles
				// Using infrared composite for cloud visibility
				const satelliteUrl = 'https://tilecache.rainviewer.com/v2/satellite/latest/256/{z}/{x}/{y}/0/0_0.png';

				if (map) {
					const firstSymbolLayer = findFirstSymbolLayer();

					map.addSource('satellite-overlay', {
						type: 'raster',
						tiles: [satelliteUrl],
						tileSize: 256
					});

					map.addLayer(
						{
							id: 'satellite-overlay-layer',
							type: 'raster',
							source: 'satellite-overlay',
							paint: {
								'raster-opacity': 0.5,
								'raster-fade-duration': 300
							}
						},
						firstSymbolLayer
					);
				}
			} catch (error) {
				console.error('[Satellite] Failed to load satellite imagery:', error);
			}
			satelliteOverlayLoading = false;
		} else if (map) {
			const visibility = satelliteOverlayVisible ? 'visible' : 'none';
			if (map.getLayer('satellite-overlay-layer')) {
				map.setLayoutProperty('satellite-overlay-layer', 'visibility', visibility);
			}
		}
	}

	// Build GeoJSON from weather alerts with geometry
	function buildAlertGeoJSON(alerts: WeatherAlert[]): GeoJSON.FeatureCollection {
		const features: GeoJSON.Feature[] = [];

		for (const alert of alerts) {
			if (!alert.geometry) continue;

			// Get color based on severity
			const colorConfig = ALERT_MAP_COLORS[alert.severity as keyof typeof ALERT_MAP_COLORS] || ALERT_MAP_COLORS.Unknown;

			features.push({
				type: 'Feature',
				properties: {
					id: alert.id,
					event: alert.event,
					severity: alert.severity,
					areaDesc: alert.areaDesc,
					fillColor: colorConfig.fill,
					strokeColor: colorConfig.stroke,
					strokeWidth: colorConfig.strokeWidth
				},
				geometry: alert.geometry
			});
		}

		return {
			type: 'FeatureCollection',
			features
		};
	}

	// Update weather alert layer
	function updateWeatherAlertLayer() {
		if (!map || !isInitialized) return;

		// Merge alerts from both sources:
		// 1. Globe's local alerts (from fetchAllActiveAlerts - nationwide)
		// 2. Weather store's alerts (from configured zones)
		const storeAlerts = $weather.alerts || [];
		const allAlerts = [...globeWeatherAlerts];

		// Add store alerts that aren't already in globe alerts (by id)
		for (const alert of storeAlerts) {
			if (!allAlerts.find((a) => a.id === alert.id)) {
				allAlerts.push(alert);
			}
		}

		const alertsWithGeometry = allAlerts.filter((a: WeatherAlert) => a.geometry);
		const geojson = buildAlertGeoJSON(alertsWithGeometry);

		// Add or update source
		const source = map.getSource('weather-alerts') as mapboxgl.GeoJSONSource;
		if (source) {
			source.setData(geojson);
		} else {
			map.addSource('weather-alerts', {
				type: 'geojson',
				data: geojson
			});

			// Add fill layer for alert polygons
			map.addLayer({
				id: 'weather-alerts-fill',
				type: 'fill',
				source: 'weather-alerts',
				paint: {
					'fill-color': ['get', 'fillColor'],
					'fill-opacity': 0.3
				}
			});

			// Add outline layer
			map.addLayer({
				id: 'weather-alerts-line',
				type: 'line',
				source: 'weather-alerts',
				paint: {
					'line-color': ['get', 'strokeColor'],
					'line-width': ['get', 'strokeWidth'],
					'line-opacity': 0.8
				}
			});
		}

		// Set visibility
		const visibility = weatherAlertsVisible ? 'visible' : 'none';
		if (map.getLayer('weather-alerts-fill')) {
			map.setLayoutProperty('weather-alerts-fill', 'visibility', visibility);
		}
		if (map.getLayer('weather-alerts-line')) {
			map.setLayoutProperty('weather-alerts-line', 'visibility', visibility);
		}
	}

	// Toggle weather alerts visibility
	async function toggleWeatherAlerts() {
		weatherAlertsVisible = !weatherAlertsVisible;

		// Fetch ALL active US alerts when toggling on (not just configured zones)
		if (weatherAlertsVisible && globeWeatherAlerts.length === 0) {
			weatherAlertsLoading = true;
			try {
				globeWeatherAlerts = await fetchAllActiveAlerts();
				const withGeometry = globeWeatherAlerts.filter((a) => a.geometry);
				const withoutGeometry = globeWeatherAlerts.filter((a) => !a.geometry);
				console.log(
					`[Weather Alerts] Fetched ${globeWeatherAlerts.length} active alerts:`
				);
				console.log(
					`  - ${withGeometry.length} have polygon geometry (will display on map)`
				);
				console.log(
					`  - ${withoutGeometry.length} have zone references only (not displayed)`
				);
				if (withGeometry.length > 0) {
					console.log(
						`  - Alert types with geometry: ${[...new Set(withGeometry.map((a) => a.event))].join(', ')}`
					);
				}
			} catch (error) {
				console.error('[Weather Alerts] Failed to fetch alerts:', error);
				globeWeatherAlerts = [];
			}
			weatherAlertsLoading = false;
			updateWeatherAlertLayer();
		} else {
			updateWeatherAlertLayer();
		}
	}

	// Fly to selected weather alert
	function flyToAlert(alert: WeatherAlert) {
		if (!map || !alert.geometry) return;

		// Calculate bounds from geometry
		let bounds: mapboxgl.LngLatBounds | null = null;

		if (alert.geometry.type === 'Polygon') {
			bounds = new mapboxgl.LngLatBounds();
			for (const coord of (alert.geometry as GeoJSON.Polygon).coordinates[0]) {
				bounds.extend(coord as [number, number]);
			}
		} else if (alert.geometry.type === 'MultiPolygon') {
			bounds = new mapboxgl.LngLatBounds();
			for (const polygon of (alert.geometry as GeoJSON.MultiPolygon).coordinates) {
				for (const coord of polygon[0]) {
					bounds.extend(coord as [number, number]);
				}
			}
		}

		if (bounds) {
			map.fitBounds(bounds, {
				padding: 50,
				maxZoom: 8,
				duration: 1500
			});
		}
	}

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
						coordinates: cyclone.forecastTrack.map((p) => [p.lon, p.lat])
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

		// Set visibility based on state
		const visibility = tropicalCyclonesVisible ? 'visible' : 'none';
		for (const id of layerIds) {
			if (map.getLayer(id)) {
				map.setLayoutProperty(id, 'visibility', visibility);
			}
		}
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

	// Fetch convective outlooks from SPC
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

	// Update convective outlook layer on the map
	function updateConvectiveLayer() {
		if (!map) return;

		// Remove existing layers and source
		const layerIds = ['convective-fill', 'convective-outline', 'convective-hazard-fill', 'convective-hazard-outline'];
		for (const id of layerIds) {
			if (map.getLayer(id)) map.removeLayer(id);
		}
		if (map.getSource('convective-outlooks')) map.removeSource('convective-outlooks');
		if (map.getSource('convective-hazards')) map.removeSource('convective-hazards');

		if (convectiveOutlooks.length === 0) return;

		// Separate categorical outlooks from hazard-specific outlooks
		const categoricalOutlooks = convectiveOutlooks.filter(
			(o: ConvectiveOutlook) => o.type === 'categorical'
		);
		const hazardOutlooks = convectiveOutlooks.filter(
			(o: ConvectiveOutlook) => o.type !== 'categorical'
		);

		// Risk labels for tooltip - more descriptive
		const riskDescriptions: Record<string, string> = {
			'TSTM': 'General Thunderstorm Area - 10% or greater chance of thunderstorms',
			'MRGL': 'Marginal Risk - Isolated severe storms possible',
			'SLGT': 'Slight Risk - Scattered severe storms possible',
			'ENH': 'Enhanced Risk - Numerous severe storms likely',
			'MDT': 'Moderate Risk - Widespread severe storms expected',
			'HIGH': 'HIGH RISK - Major severe weather outbreak expected'
		};

		// Type labels
		const typeLabels: Record<string, string> = {
			'categorical': 'Severe Storm Risk',
			'tornado': 'Tornado Probability',
			'hail': 'Large Hail Probability',
			'wind': 'Damaging Wind Probability'
		};

		// Create features for categorical outlooks
		const categoricalFeatures: GeoJSON.Feature[] = categoricalOutlooks.map((outlook: ConvectiveOutlook) => ({
			type: 'Feature',
			properties: {
				risk: outlook.risk,
				riskLabel: riskDescriptions[outlook.risk] || outlook.risk,
				type: outlook.type,
				typeLabel: typeLabels[outlook.type] || outlook.type,
				color: CONVECTIVE_COLORS[outlook.risk],
				day: outlook.day,
				isSignificant: outlook.isSignificant
			},
			geometry: outlook.geometry
		}));

		// Create features for hazard-specific outlooks (tornado/hail/wind probabilities)
		const hazardFeatures: GeoJSON.Feature[] = hazardOutlooks.map((outlook: ConvectiveOutlook) => {
			// Hazard outlooks use percentage-based colors - gradient from green to purple
			const getHazardColor = (risk: string): string => {
				// For significant areas, use a distinctive color
				if (risk === 'SIGN' || risk.includes('SIG')) return '#ff00ff'; // Magenta

				// Parse percentage value
				const pctMatch = risk.match(/(\d+)/);
				const pct = pctMatch ? parseInt(pctMatch[1]) : 0;

				// Color scale based on percentage
				if (pct <= 2) return '#40a040';   // Green - low probability
				if (pct <= 5) return '#c0c000';   // Yellow
				if (pct <= 10) return '#ff8000';  // Orange
				if (pct <= 15) return '#ff6060';  // Red-orange
				if (pct <= 30) return '#ff0000';  // Red
				if (pct <= 45) return '#ff00ff';  // Magenta
				return '#8b00ff';                  // Purple - extreme
			};
			const color = getHazardColor(outlook.risk);

			return {
				type: 'Feature',
				properties: {
					risk: outlook.risk,
					riskLabel: `${outlook.risk} probability`,
					type: outlook.type,
					typeLabel: typeLabels[outlook.type] || outlook.type,
					color: color,
					day: outlook.day,
					isSignificant: outlook.isSignificant
				},
				geometry: outlook.geometry
			};
		});

		// Add categorical outlook source and layers
		if (categoricalFeatures.length > 0) {
			map.addSource('convective-outlooks', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: categoricalFeatures }
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

		// Add hazard-specific outlook source and layers (tornado/hail/wind probabilities)
		if (hazardFeatures.length > 0) {
			map.addSource('convective-hazards', {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: hazardFeatures }
			});

			// Dashed outline for hazard areas
			map.addLayer({
				id: 'convective-hazard-outline',
				type: 'line',
				source: 'convective-hazards',
				paint: {
					'line-color': ['get', 'color'],
					'line-width': 3,
					'line-dasharray': [4, 2]
				}
			});
		}

		// Set initial visibility based on state
		const visibility = convectiveOutlooksVisible ? 'visible' : 'none';
		for (const id of layerIds) {
			if (map.getLayer(id)) {
				map.setLayoutProperty(id, 'visibility', visibility);
			}
		}
	}

	// Toggle convective outlook visibility
	function toggleConvectiveOutlooks() {
		convectiveOutlooksVisible = !convectiveOutlooksVisible;

		if (convectiveOutlooksVisible && convectiveOutlooks.length === 0) {
			loadConvectiveOutlooks();
		}

		// Toggle layer visibility if layers exist (both categorical and hazard layers)
		const layerIds = ['convective-fill', 'convective-outline', 'convective-hazard-fill', 'convective-hazard-outline'];
		for (const id of layerIds) {
			if (map?.getLayer(id)) {
				map.setLayoutProperty(id, 'visibility', convectiveOutlooksVisible ? 'visible' : 'none');
			}
		}
	}

	onMount(() => {
		requestAnimationFrame(() => initMap());
		// Fetch outage data immediately
		loadOutageData();
		// Refresh outage data every 5 minutes
		const outageRefreshInterval = setInterval(loadOutageData, 5 * 60 * 1000);

		// Fetch volcano data immediately
		loadVolcanoData();
		// Refresh volcano data every 30 minutes (volcano status changes slowly)
		const volcanoRefreshInterval = setInterval(loadVolcanoData, VOLCANO_REFRESH_INTERVAL);

		return () => {
			clearInterval(outageRefreshInterval);
			clearInterval(volcanoRefreshInterval);
		};
	});

	onDestroy(() => {
		stopRotation();
		stopMapUpdatePolling();
		stopAircraftPolling();
		stopVesselStream();
		// Cleanup radar animation interval
		if (radarAnimationInterval) {
			clearInterval(radarAnimationInterval);
			radarAnimationInterval = null;
		}
		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<div
	class="globe-container"
	class:picker-mode={$mapPickerMode}
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

	<!-- Map Picker Mode Overlay -->
	{#if $mapPickerMode}
		<div class="picker-overlay">
			<div class="picker-message">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="10" r="3"/>
					<path d="M12 2a8 8 0 0 0-8 8c0 5.4 7 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/>
				</svg>
				<span>Click on the globe to select a location</span>
				<button class="picker-cancel" onclick={() => weather.cancelMapPickerMode()}>
					Cancel
				</button>
			</div>
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
			<!-- Radar controls group -->
			<div class="radar-controls" class:visible={weatherRadarVisible && radarAnimationData}>
				<button
					class="control-btn radar-step-btn"
					onclick={radarStepBackward}
					title="Previous frame"
					disabled={!radarAnimationData}
				>
					<span class="control-icon">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
							<path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
						</svg>
					</span>
				</button>
				<button
					class="control-btn radar-play-btn"
					class:active={radarAnimationPlaying}
					onclick={toggleRadarAnimation}
					title={radarAnimationPlaying ? 'Pause' : 'Play'}
					disabled={!radarAnimationData}
				>
					<span class="control-icon">
						{#if radarAnimationPlaying}
							<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
								<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
							</svg>
						{:else}
							<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
								<path d="M8 5v14l11-7z"/>
							</svg>
						{/if}
					</span>
				</button>
				<button
					class="control-btn radar-step-btn"
					onclick={radarStepForward}
					title="Next frame"
					disabled={!radarAnimationData}
				>
					<span class="control-icon">
						<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
							<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
						</svg>
					</span>
				</button>
				<div class="radar-timestamp">
					{#if radarAnimationData && radarAnimationData.frames[radarCurrentFrame]}
						{new Date(radarAnimationData.frames[radarCurrentFrame].timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
						{#if radarAnimationData.frames[radarCurrentFrame].type === 'nowcast'}
							<span class="nowcast-badge">Future</span>
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
			<button
				class="control-btn satellite-btn"
				class:active={satelliteOverlayVisible}
				class:loading={satelliteOverlayLoading}
				onclick={toggleSatelliteOverlay}
				title={satelliteOverlayVisible ? 'Hide satellite imagery' : 'Show satellite imagery'}
			>
				<span class="control-icon">{satelliteOverlayLoading ? '...' : '🛰'}</span>
			</button>
			<button
				class="control-btn weather-alerts-btn"
				class:active={weatherAlertsVisible}
				class:loading={weatherAlertsLoading}
				onclick={toggleWeatherAlerts}
				title={weatherAlertsVisible ? 'Hide weather alerts' : 'Show weather alerts'}
			>
				<span class="control-icon">{weatherAlertsLoading ? '...' : '⚠'}</span>
			</button>
			<button
				class="control-btn convective-btn"
				class:active={convectiveOutlooksVisible}
				class:loading={convectiveOutlooksLoading}
				onclick={toggleConvectiveOutlooks}
				title={convectiveOutlooksVisible ? 'Hide storm outlooks' : 'Show storm outlooks'}
			>
				<span class="control-icon">{convectiveOutlooksLoading ? '...' : '⛈'}</span>
			</button>
			<button
				class="control-btn cyclone-btn"
				class:active={tropicalCyclonesVisible}
				class:loading={tropicalCyclonesLoading}
				onclick={toggleTropicalCyclones}
				title={tropicalCyclonesVisible ? 'Hide tropical cyclones' : 'Show tropical cyclones'}
			>
				<span class="control-icon">{tropicalCyclonesLoading ? '...' : '🌀'}</span>
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

	<!-- Radar Precipitation Legend -->
	{#if isInitialized && weatherRadarVisible}
		<div class="radar-legend">
			<div class="radar-legend-title">PRECIPITATION</div>
			<div class="radar-legend-items">
				<div class="radar-legend-item">
					<span class="radar-legend-color" style="background: #40ff40;"></span>
					<span class="radar-legend-label">Light Rain</span>
				</div>
				<div class="radar-legend-item">
					<span class="radar-legend-color" style="background: #ffff00;"></span>
					<span class="radar-legend-label">Moderate</span>
				</div>
				<div class="radar-legend-item">
					<span class="radar-legend-color" style="background: #ff8000;"></span>
					<span class="radar-legend-label">Heavy</span>
				</div>
				<div class="radar-legend-item">
					<span class="radar-legend-color" style="background: #ff0000;"></span>
					<span class="radar-legend-label">Intense</span>
				</div>
				<div class="radar-legend-item">
					<span class="radar-legend-color" style="background: #ff00ff;"></span>
					<span class="radar-legend-label">Extreme</span>
				</div>
				<div class="radar-legend-item">
					<span class="radar-legend-color" style="background: #00ffff;"></span>
					<span class="radar-legend-label">Snow/Ice</span>
				</div>
			</div>
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
							{#if layer === 'aircraft'}
								<!-- Aircraft layer is controlled via AircraftPanel props -->
								<input type="checkbox" checked={adsbEnabled} onchange={() => {
									onAdsbToggle?.(!adsbEnabled);
								}} />
							{:else}
								<input type="checkbox" bind:checked={state.visible} onchange={() => {
									updateMapLayers();
									// Load UCDP conflict data when Smart Hotspots is enabled
									if (layer === 'smartHotspots' && state.visible && !conflictData && !conflictDataLoading) {
										loadConflictData();
									}
									// Start/stop vessel WebSocket stream based on visibility
									if (layer === 'vessels') {
										if (state.visible) {
											startVesselStream();
										} else {
											stopVesselStream();
										}
									}
									// Load air quality data when enabled
									if (layer === 'airQuality') {
										if (state.visible && airQualityData.length === 0 && !airQualityDataLoading) {
											loadAirQualityData();
										}
									}
								}} />
							{/if}
							<span class="layer-name">
								{#if layer === 'smartHotspots'}
									Smart Hotspots (UCDP)
								{:else if layer === 'volcanoes'}
									Volcanoes (USGS)
								{:else if layer === 'aircraft'}
									Aircraft (ADS-B)
								{:else if layer === 'airQuality'}
									Air Quality (OpenAQ)
								{:else if layer === 'traffic'}
									Traffic & Roads
								{:else}
									{layer.charAt(0).toUpperCase() + layer.slice(1)}
								{/if}
							</span>
							{#if layer === 'smartHotspots' && conflictDataLoading}
								<span class="loading-indicator">...</span>
							{:else if layer === 'smartHotspots' && conflictData}
								<span class="data-count">{conflictData.hotspots.length}</span>
							{/if}
							{#if layer === 'volcanoes' && volcanoDataLoading}
								<span class="loading-indicator">...</span>
							{:else if layer === 'volcanoes' && volcanoData.length > 0}
								<span class="data-count">{volcanoData.length}</span>
							{/if}
							{#if layer === 'aircraft' && aircraftDataLoading}
								<span class="loading-indicator">...</span>
							{:else if layer === 'aircraft' && aircraftData.length > 0}
								<span class="data-count">{aircraftData.length}</span>
							{/if}
							{#if layer === 'vessels' && vesselDataLoading}
								<span class="loading-indicator">...</span>
							{:else if layer === 'vessels' && vesselData.length > 0}
								<span class="data-count">{vesselData.length}</span>
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
					<div class="legend-section">
						<span class="legend-section-title">VOLCANOES (USGS)</span>
						<div class="legend-items">
							<div class="legend-item">
								<span class="legend-marker volcano-warning"></span>
								<span class="legend-label">Warning (Red)</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker volcano-watch"></span>
								<span class="legend-label">Watch (Orange)</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker volcano-advisory"></span>
								<span class="legend-label">Advisory (Yellow)</span>
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

	/* Map Picker Mode */
	.globe-container.picker-mode {
		cursor: crosshair !important;
	}

	.globe-container.picker-mode :global(.mapboxgl-canvas) {
		cursor: crosshair !important;
	}

	.picker-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		display: flex;
		justify-content: center;
		padding: 12px;
		pointer-events: none;
	}

	.picker-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: rgb(59 130 246 / 0.9);
		border: 1px solid rgb(96 165 250 / 0.6);
		border-radius: 4px;
		color: rgb(219 234 254);
		font-size: 12px;
		font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
		font-weight: 500;
		backdrop-filter: blur(4px);
		pointer-events: auto;
		animation: pulse-border 1.5s ease-in-out infinite;
	}

	@keyframes pulse-border {
		0%, 100% { border-color: rgb(96 165 250 / 0.6); }
		50% { border-color: rgb(147 197 253 / 0.9); }
	}

	.picker-message svg {
		flex-shrink: 0;
	}

	.picker-cancel {
		margin-left: 8px;
		padding: 4px 10px;
		background: rgb(30 58 138 / 0.6);
		border: 1px solid rgb(59 130 246 / 0.5);
		border-radius: 2px;
		color: rgb(191 219 254);
		font-size: 10px;
		font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.picker-cancel:hover {
		background: rgb(30 58 138 / 0.9);
		border-color: rgb(96 165 250 / 0.8);
		color: white;
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

	/* Weather Radar Button */
	.weather-radar-btn.active {
		background: rgb(6 78 59 / 0.6);
		border-color: rgb(16 185 129 / 0.6);
		color: rgb(52 211 153);
	}

	.weather-radar-btn:hover {
		border-color: rgb(16 185 129 / 0.5);
		color: rgb(52 211 153);
	}

	.weather-radar-btn.loading {
		opacity: 0.7;
		cursor: wait;
	}

	.weather-radar-btn.loading .control-icon {
		animation: pulse 1s ease-in-out infinite;
	}

	/* Satellite Imagery Button */
	.satellite-btn.active {
		background: rgb(55 48 163 / 0.6);
		border-color: rgb(129 140 248 / 0.6);
		color: rgb(165 180 252);
	}

	.satellite-btn:hover {
		border-color: rgb(129 140 248 / 0.5);
		color: rgb(165 180 252);
	}

	.satellite-btn.loading {
		opacity: 0.7;
		cursor: wait;
	}

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
		font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
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

	/* Radar Precipitation Legend */
	.radar-legend {
		position: absolute;
		bottom: 12px;
		left: 12px;
		background: rgb(15 23 42 / 0.9);
		border: 1px solid rgb(51 65 85 / 0.6);
		border-radius: 4px;
		padding: 8px 10px;
		z-index: 10;
		backdrop-filter: blur(4px);
	}

	.radar-legend-title {
		font-size: 9px;
		font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
		font-weight: 700;
		color: rgb(148 163 184);
		letter-spacing: 0.05em;
		margin-bottom: 6px;
		text-transform: uppercase;
	}

	.radar-legend-items {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.radar-legend-item {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.radar-legend-color {
		width: 12px;
		height: 8px;
		border-radius: 1px;
		flex-shrink: 0;
	}

	.radar-legend-label {
		font-size: 9px;
		font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
		color: rgb(203 213 225);
	}

	/* Weather Alerts Button */
	.weather-alerts-btn.active {
		background: rgb(127 29 29 / 0.6);
		border-color: rgb(248 113 113 / 0.6);
		color: rgb(248 113 113);
	}

	.weather-alerts-btn:hover {
		border-color: rgb(248 113 113 / 0.5);
		color: rgb(248 113 113);
	}

	.weather-alerts-btn.loading {
		opacity: 0.7;
		cursor: wait;
	}

	.weather-alerts-btn.loading .control-icon {
		animation: pulse 1s ease-in-out infinite;
	}

	/* Convective Outlook Button */
	.convective-btn.active {
		background: rgb(113 63 18 / 0.6);
		border-color: rgb(245 158 11 / 0.6);
		color: rgb(253 224 71);
	}

	.convective-btn:hover {
		border-color: rgb(245 158 11 / 0.5);
		color: rgb(253 224 71);
	}

	.convective-btn.loading {
		opacity: 0.7;
		cursor: wait;
	}

	.convective-btn.loading .control-icon {
		animation: pulse 1s ease-in-out infinite;
	}

	/* Tropical Cyclone Button */
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

	.cyclone-btn.loading .control-icon {
		animation: pulse 1s ease-in-out infinite;
	}

	/* Data Controls Panel */
	.data-controls {
		position: absolute;
		top: 0.75rem;
		right: 3rem;
		z-index: 1000;
		background: rgb(15 23 42 / 0.95);
		backdrop-filter: blur(12px);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		min-width: 200px;
		max-width: 260px;
		max-height: calc(100% - 1.5rem);
		overflow-y: auto;
		overflow-x: hidden;
	}

	/* Custom scrollbar for data controls */
	.data-controls::-webkit-scrollbar {
		width: 4px;
	}

	.data-controls::-webkit-scrollbar-track {
		background: rgb(15 23 42 / 0.5);
	}

	.data-controls::-webkit-scrollbar-thumb {
		background: rgb(51 65 85);
		border-radius: 2px;
	}

	.data-controls::-webkit-scrollbar-thumb:hover {
		background: rgb(71 85 105);
	}

	.data-controls-header {
		position: sticky;
		top: 0;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid rgb(51 65 85 / 0.3);
		background: rgb(15 23 42 / 0.98);
		z-index: 1;
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
		/* Solid dark background for cross-browser dropdown support */
		background-color: #1e293b; /* slate-800 */
		border: 1px solid rgb(51 65 85);
		border-radius: 2px;
		color: #e2e8f0; /* slate-200 - light text */
		padding: 0.125rem 0.25rem;
		cursor: pointer;
		transition: all 0.15s ease;
		/* Custom dropdown arrow */
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.25rem center;
		padding-right: 1.25rem;
	}

	.filter-row select:hover {
		background-color: #334155; /* slate-700 */
		border-color: rgb(6 182 212 / 0.5); /* accent-border */
	}

	.filter-row select:focus {
		border-color: rgb(34 211 238); /* accent */
		background-color: #334155; /* slate-700 */
		outline: none;
	}

	.filter-row select option {
		background-color: #1e293b; /* slate-800 */
		color: #e2e8f0; /* slate-200 */
		padding: 0.25rem;
	}

	.filter-row select option:hover,
	.filter-row select option:checked {
		background-color: #334155; /* slate-700 */
		color: #22d3ee; /* cyan-400 */
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

	/* Volcano alert level markers */
	.legend-marker.volcano-warning {
		background: #ef4444;
		box-shadow: 0 0 6px #ef4444;
		border-radius: 0;
		clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
	}

	.legend-marker.volcano-watch {
		background: #f97316;
		box-shadow: 0 0 5px #f97316;
		border-radius: 0;
		clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
	}

	.legend-marker.volcano-advisory {
		background: #eab308;
		box-shadow: 0 0 4px #eab308;
		border-radius: 0;
		clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
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
