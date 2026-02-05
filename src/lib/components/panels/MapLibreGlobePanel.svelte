<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import {
		HOTSPOTS,
		CHOKEPOINTS,
		CABLE_LANDINGS,
		NUCLEAR_SITES,
		MILITARY_BASES,
		THREAT_COLORS,
		HOTSPOT_KEYWORDS
	} from '$lib/config/map';
	import {
		MARKER_CONFIGS,
		MARKER_SIZES,
		PALETTE,
		getHotspotMarkerConfig,
		getOutageMarkerConfig,
		getVolcanoMarkerConfig,
		getEarthquakeMarkerConfig,
		getRadiationMarkerConfig,
		getDiseaseMarkerConfig,
		getVesselMarkerConfig,
		getNewsMarkerConfig,
		getConflictMarkerConfig,
		ARC_STYLES,
		LEGEND_SECTIONS
	} from '$lib/config/markers';
	import { fetchOutageData, fetchUCDPConflicts, fetchAircraftPositions, OpenSkyRateLimitError, getAltitudeColor, formatAltitude, formatVelocity, formatHeading, fetchElevatedVolcanoes, VOLCANO_ALERT_COLORS, VOLCANO_ALERT_DESCRIPTIONS, getShipTypeColor, formatVesselSpeed, formatVesselCourse, getFlagEmoji, fetchAirQualityData, AIR_QUALITY_COLORS, AIR_QUALITY_DESCRIPTIONS, RADIATION_LEVEL_COLORS } from '$lib/api';
	import { vesselStore, vesselConnectionStatus, connectVesselStream, disconnectVesselStream, type VesselTrackPoint } from '$lib/services/vessel-stream';
	import { selectedVesselTrack } from '$lib/stores/vesselTrack';
	import type { OutageData, VIEWSConflictData, Vessel, RadiationReading } from '$lib/api';
	import type { CustomMonitor, NewsItem, NewsCategory, Aircraft, VolcanoData, AirQualityReading, DiseaseOutbreak, EarthquakeData } from '$lib/types';
	import { webcamWindows } from '$lib/stores/webcam';
	import { isoAlpha3ToAlpha2 } from '$lib/types/webcam';
	import WebcamWindowsContainer from '$lib/components/webcam/WebcamWindowsContainer.svelte';

	// Predefined ADS-B regions for filtering
	const AIRCRAFT_REGIONS: Record<string, { name: string; bounds: [number, number, number, number] }> = {
		'north-america': { name: 'North America', bounds: [-170, 15, -50, 72] },
		'europe': { name: 'Europe', bounds: [-25, 35, 45, 72] },
		'middle-east': { name: 'Middle East', bounds: [25, 12, 65, 45] },
		'east-asia': { name: 'East Asia', bounds: [95, 15, 150, 55] },
		'southeast-asia': { name: 'SE Asia', bounds: [90, -15, 155, 28] },
		'australia': { name: 'Oceania', bounds: [110, -50, 180, 0] },
		'south-america': { name: 'S. America', bounds: [-85, -60, -30, 15] },
		'africa': { name: 'Africa', bounds: [-20, -40, 55, 40] },
		'viewport': { name: 'Viewport', bounds: [0, 0, 0, 0] }
	};

	// Feed category colors for map visualization
	const FEED_COLORS: Record<NewsCategory, string> = {
		politics: '#ef4444',
		tech: '#8b5cf6',
		finance: '#10b981',
		gov: '#f59e0b',
		ai: '#06b6d4',
		intel: '#ec4899'
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
		_ts?: number;
	}

	interface AircraftTrackPoint {
		lat: number;
		lon: number;
		timestamp: number;
		altitude: number | null;
	}

	interface AircraftSnapshot {
		timestamp: number;
		aircraft: Aircraft[];
		region: string;
	}

	interface Props {
		monitors?: CustomMonitor[];
		news?: NewsItem[];
		categorizedNews?: CategorizedNews;
		flyToTarget?: FlyToTarget | null;
		radiationReadings?: RadiationReading[];
		diseaseOutbreaks?: DiseaseOutbreak[];
		earthquakes?: EarthquakeData[];
		onAircraftDataChange?: (aircraft: Aircraft[], history: AircraftSnapshot[]) => void;
		selectedAircraftTrack?: { aircraft: Aircraft; track: AircraftTrackPoint[] } | null;
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

	const currentFlyTarget = $derived(flyToTarget ? { ...flyToTarget } : null);

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map | null = null;
	let isInitialized = $state(false);
	let initError = $state<string | null>(null);
	let isRotating = $state(true);
	let userEnabledRotation = $state(true);
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
		smartHotspots: { visible: false, paused: false },
		aircraft: { visible: false, paused: false },
		volcanoes: { visible: true, paused: false },
		vessels: { visible: false, paused: false },
		airQuality: { visible: false, paused: false },
		radiation: { visible: true, paused: false },
		diseases: { visible: true, paused: false }
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
	let newsTTL = $state(30);
	let newsTimeFilter = $state(60);
	let showAlertsOnly = $state(false);

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipLocked = $state(false);
	let tooltipExpanded = $state(false);
	let tooltipData = $state<{
		label: string;
		type: string;
		desc?: string;
		level?: string;
		newsCount?: number;
		recentNews?: Array<{ title: string; link?: string }>;
		allNews?: Array<{ title: string; link?: string; source?: string }>;
		isAlert?: boolean;
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

	// VIEWS Conflict Forecast data
	let conflictData = $state<VIEWSConflictData | null>(null);
	let conflictDataLoading = $state(false);

	// ADS-B Aircraft tracking data
	let aircraftData = $state<Aircraft[]>([]);
	let aircraftDataLoading = $state(false);
	let aircraftRefreshInterval: ReturnType<typeof setInterval> | null = null;
	let lastAircraftFetch = typeof window !== 'undefined'
		? parseInt(localStorage.getItem('adsb-last-fetch') || '0', 10)
		: 0;
	let isRateLimited = $state(false);
	const AIRCRAFT_REFRESH_INTERVAL = 60000;
	const AIRCRAFT_DEBOUNCE_MS = 10000;
	const RATE_LIMIT_BACKOFF_MS = 60000;
	const MAX_AIRCRAFT_DISPLAY = 2500;
	const MAX_AIRCRAFT_HISTORY = 5;
	let aircraftHistory = $state<AircraftSnapshot[]>([]);

	// USGS Volcano data
	let volcanoData = $state<VolcanoData[]>([]);
	let volcanoDataLoading = $state(false);
	const VOLCANO_REFRESH_INTERVAL = 30 * 60 * 1000;

	// AIS Vessel/Ship tracking data
	let vesselData = $state<Vessel[]>([]);
	let vesselUnsubscribe: (() => void) | null = null;
	let vesselConnectionState = $state<'disconnected' | 'connecting' | 'connected' | 'error' | 'no_api_key'>('disconnected');
	const vesselDataLoading = $derived(vesselConnectionState === 'connecting');

	// OpenAQ Air Quality data
	let airQualityData = $state<AirQualityReading[]>([]);
	let airQualityDataLoading = $state(false);

	// Selected vessel track from store (for map visualization)
	let currentVesselTrack = $state<{ vessel: { mmsi: string; name?: string } | null; track: VesselTrackPoint[] }>({ vessel: null, track: [] });
	let vesselTrackUnsubscribe: (() => void) | null = null;

	// Arc particle animation positions
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

	// Filter categorized news
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
	function getHotspotActivityLevel(hotspotName: string, baseLevel: string): { level: string; newsCount: number; hasAlert: boolean } {
		const hotspotNews = getNewsForHotspot(hotspotName);
		const newsCount = hotspotNews.length;
		const hasAlert = hotspotNews.some((n) => n.isAlert);
		if (hasAlert && baseLevel !== 'critical') {
			return { level: 'high', newsCount, hasAlert };
		}
		return { level: baseLevel, newsCount, hasAlert };
	}

	// Arc connection definitions
	const arcConnections = [
		{ from: 'Moscow', to: 'Kyiv', color: '#ef4444' },
		{ from: 'Tehran', to: 'Tel Aviv', color: '#ef4444' },
		{ from: 'Beijing', to: 'Taipei', color: '#fbbf24' },
		{ from: 'Pyongyang', to: 'Tokyo', color: '#fbbf24' }
	];

	// Generate arc coordinates using geodesic interpolation
	function generateArcCoordinates(start: [number, number], end: [number, number], segments: number): [number, number][] {
		const coords: [number, number][] = [];
		const toRad = (deg: number) => (deg * Math.PI) / 180;
		const toDeg = (rad: number) => (rad * 180) / Math.PI;

		const lon1 = toRad(start[0]);
		const lat1 = toRad(start[1]);
		const lon2 = toRad(end[0]);
		const lat2 = toRad(end[1]);

		const dLon = lon2 - lon1;
		const dLat = lat2 - lat1;
		const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
		const angularDistance = 2 * Math.asin(Math.sqrt(Math.min(1, a)));

		if (angularDistance < 0.0001) {
			for (let i = 0; i <= segments; i++) {
				const t = i / segments;
				coords.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
			}
			return coords;
		}

		const distanceDegrees = toDeg(angularDistance);
		const arcHeightFactor = Math.min(distanceDegrees * 0.25, 10);

		for (let i = 0; i <= segments; i++) {
			const t = i / segments;
			const sinAngDist = Math.sin(angularDistance);
			const A = Math.sin((1 - t) * angularDistance) / sinAngDist;
			const B = Math.sin(t * angularDistance) / sinAngDist;

			const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
			const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
			const z = A * Math.sin(lat1) + B * Math.sin(lat2);

			const gcLat = Math.atan2(z, Math.sqrt(x * x + y * y));
			const gcLon = Math.atan2(y, x);

			const elevationFactor = Math.sin(t * Math.PI);
			const pathBearing = Math.atan2(
				Math.sin(dLon) * Math.cos(lat2),
				Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
			);
			const perpBearing = pathBearing + Math.PI / 2;
			const offsetMagnitude = toRad(arcHeightFactor * elevationFactor);
			const latOffset = offsetMagnitude * Math.cos(perpBearing);
			const lonOffset = offsetMagnitude * Math.sin(perpBearing) / Math.cos(gcLat);

			coords.push([toDeg(gcLon + lonOffset), toDeg(gcLat + latOffset)]);
		}
		return coords;
	}

	// Generate circle coordinates for radius visualization
	function generateCircleCoordinates(centerLon: number, centerLat: number, radiusKm: number): [number, number][] {
		const coords: [number, number][] = [];
		const points = 64;
		const radiusDeg = radiusKm / 111;
		for (let i = 0; i <= points; i++) {
			const angle = (i / points) * 2 * Math.PI;
			const latAdjust = Math.cos((centerLat * Math.PI) / 180);
			const lon = centerLon + (radiusDeg * Math.cos(angle)) / latAdjust;
			const lat = centerLat + radiusDeg * Math.sin(angle);
			coords.push([lon, lat]);
		}
		return coords;
	}

	// GeoJSON generators
	function getHotspotsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.hotspots.visible) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = HOTSPOTS.map((h) => {
			const activity = getHotspotActivityLevel(h.name, h.level);
			const hotspotNews = getNewsForHotspot(h.name);
			const markerConfig = getHotspotMarkerConfig(activity.level as 'critical' | 'high' | 'elevated' | 'low');
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
				properties: {
					label: h.name,
					type: 'hotspot',
					desc: h.desc,
					level: activity.level,
					color: markerConfig.color,
					glowColor: markerConfig.glowColor,
					strokeColor: markerConfig.strokeColor,
					size: markerConfig.size.base,
					glowSize: markerConfig.size.base * markerConfig.size.glow,
					opacity: markerConfig.opacity,
					glowOpacity: markerConfig.glowOpacity,
					strokeWidth: markerConfig.size.stroke,
					strokeOpacity: markerConfig.strokeOpacity,
					newsCount: activity.newsCount,
					hasAlert: activity.hasAlert,
					isPulsing: markerConfig.style === 'pulsing',
					recentNews: JSON.stringify(hotspotNews.slice(0, 3).map((n) => ({ title: n.title, link: n.link })))
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	function getChokepointsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.chokepoints.visible) return { type: 'FeatureCollection', features: [] };
		const config = MARKER_CONFIGS.chokepoint;
		const features: GeoJSON.Feature[] = CHOKEPOINTS.map((cp) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [cp.lon, cp.lat] },
			properties: {
				label: cp.name,
				type: 'chokepoint',
				desc: cp.desc,
				color: config.color,
				glowColor: config.glowColor,
				strokeColor: config.strokeColor,
				size: config.size.base,
				glowSize: config.size.base * config.size.glow,
				opacity: config.opacity,
				glowOpacity: config.glowOpacity,
				strokeWidth: config.size.stroke,
				strokeOpacity: config.strokeOpacity
			}
		}));
		return { type: 'FeatureCollection', features };
	}

	function getCablesGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.cables.visible) return { type: 'FeatureCollection', features: [] };
		const config = MARKER_CONFIGS.cable;
		const features: GeoJSON.Feature[] = CABLE_LANDINGS.map((cl) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [cl.lon, cl.lat] },
			properties: {
				label: cl.name,
				type: 'cable',
				desc: cl.desc,
				color: config.color,
				glowColor: config.glowColor,
				strokeColor: config.strokeColor,
				size: config.size.base,
				glowSize: config.size.base * config.size.glow,
				opacity: config.opacity,
				glowOpacity: config.glowOpacity,
				strokeWidth: config.size.stroke,
				strokeOpacity: config.strokeOpacity
			}
		}));
		return { type: 'FeatureCollection', features };
	}

	function getNuclearGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.nuclear.visible) return { type: 'FeatureCollection', features: [] };
		const config = MARKER_CONFIGS.nuclear;
		const features: GeoJSON.Feature[] = NUCLEAR_SITES.map((ns) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [ns.lon, ns.lat] },
			properties: {
				label: ns.name,
				type: 'nuclear',
				desc: ns.desc,
				color: config.color,
				glowColor: config.glowColor,
				strokeColor: config.strokeColor,
				size: config.size.base,
				glowSize: config.size.base * config.size.glow,
				opacity: config.opacity,
				glowOpacity: config.glowOpacity,
				strokeWidth: config.size.stroke,
				strokeOpacity: config.strokeOpacity
			}
		}));
		return { type: 'FeatureCollection', features };
	}

	function getMilitaryGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.military.visible) return { type: 'FeatureCollection', features: [] };
		const config = MARKER_CONFIGS.military;
		const features: GeoJSON.Feature[] = MILITARY_BASES.map((mb) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [mb.lon, mb.lat] },
			properties: {
				label: mb.name,
				type: 'military',
				desc: mb.desc,
				color: config.color,
				glowColor: config.glowColor,
				strokeColor: config.strokeColor,
				size: config.size.base,
				glowSize: config.size.base * config.size.glow,
				opacity: config.opacity,
				glowOpacity: config.glowOpacity,
				strokeWidth: config.size.stroke,
				strokeOpacity: config.strokeOpacity
			}
		}));
		return { type: 'FeatureCollection', features };
	}

	function getMonitorsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.monitors.visible) return { type: 'FeatureCollection', features: [] };
		const config = MARKER_CONFIGS.monitor;
		const features: GeoJSON.Feature[] = monitors
			.filter((m) => m.enabled && m.location)
			.map((m) => ({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [m.location!.lon, m.location!.lat] },
				properties: {
					label: m.name,
					type: 'monitor',
					desc: `Custom monitor: ${m.keywords?.join(', ') || 'No keywords'}`,
					color: m.color || config.color,
					glowColor: m.color || config.glowColor,
					strokeColor: config.strokeColor,
					size: config.size.base,
					glowSize: config.size.base * config.size.glow,
					opacity: config.opacity,
					glowOpacity: config.glowOpacity,
					strokeWidth: config.size.stroke,
					strokeOpacity: config.strokeOpacity
				}
			}));
		return { type: 'FeatureCollection', features };
	}

	function getArcsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.arcs.visible) return { type: 'FeatureCollection', features: [] };
		const hotspotMap = new Map(HOTSPOTS.map((h) => [h.name, h]));
		const features: GeoJSON.Feature[] = [];
		arcConnections.forEach((conn, index) => {
			const from = hotspotMap.get(conn.from);
			const to = hotspotMap.get(conn.to);
			if (from && to) {
				const coords = generateArcCoordinates([from.lon, from.lat], [to.lon, to.lat], 40);
				features.push({
					type: 'Feature',
					geometry: { type: 'LineString', coordinates: coords },
					properties: { color: conn.color, from: conn.from, to: conn.to, id: index }
				});
			}
		});
		return { type: 'FeatureCollection', features };
	}

	function getNewsEventsGeoJSON(): GeoJSON.FeatureCollection {
		const categorized = filteredCategorizedNews();
		if (!categorized || !dataLayers.news.visible) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = [];
		const now = Date.now();
		const ttlMs = newsTTL * 60 * 1000;
		const categories: NewsCategory[] = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'];

		categories.forEach((category, categoryIndex) => {
			if (!feedLayers[category].visible) return;
			const categoryNews = categorized[category];
			if (!categoryNews || categoryNews.length === 0) return;

			const hotspotNewsMap = new Map<string, NewsItem[]>();
			categoryNews.forEach((item) => {
				for (const [hotspotName, keywords] of Object.entries(HOTSPOT_KEYWORDS)) {
					const text = `${item.title} ${item.description || ''}`.toLowerCase();
					if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
						if (!hotspotNewsMap.has(hotspotName)) hotspotNewsMap.set(hotspotName, []);
						hotspotNewsMap.get(hotspotName)!.push(item);
						break;
					}
				}
			});

			hotspotNewsMap.forEach((newsItems, hotspotName) => {
				const hotspot = HOTSPOTS.find((h) => h.name === hotspotName);
				if (!hotspot) return;
				const hasAlerts = newsItems.some((n) => n.isAlert);
				const age = now - Math.max(...newsItems.map((n) => n.timestamp));
				const ageOpacity = Math.max(0.4, 1 - age / ttlMs);
				const angle = (categoryIndex / categories.length) * 2 * Math.PI;
				const offsetDistance = 0.8;
				const offsetLon = Math.cos(angle) * offsetDistance;
				const offsetLat = Math.sin(angle) * offsetDistance;

				const config = getNewsMarkerConfig(category, hasAlerts);
				// Scale size based on news count (min 5, max 10)
				const scaledSize = Math.min(config.size.base + 4, config.size.base + newsItems.length - 1);

				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [hotspot.lon + offsetLon, hotspot.lat + offsetLat] },
					properties: {
						label: `${newsItems.length} ${category}`,
						type: 'feed-news',
						category,
						categoryLabel: FEED_LABELS[category],
						count: newsItems.length,
						hasAlerts,
						opacity: ageOpacity * config.opacity,
						glowOpacity: ageOpacity * config.glowOpacity,
						color: config.color,
						glowColor: config.glowColor,
						strokeColor: config.strokeColor,
						size: scaledSize,
						glowSize: scaledSize * config.size.glow,
						strokeWidth: config.size.stroke,
						strokeOpacity: config.strokeOpacity,
						hotspotName
					}
				});
			});
		});
		return { type: 'FeatureCollection', features };
	}

	function getOutagesGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.outages.visible) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = outageData.filter((e) => e.active).map((event) => {
			const config = getOutageMarkerConfig(event.severity as 'total' | 'major' | 'partial');
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [event.lon, event.lat] },
				properties: {
					id: event.id,
					label: event.country,
					type: 'outage',
					severity: event.severity,
					desc: event.description,
					color: config.color,
					glowColor: config.glowColor,
					strokeColor: config.strokeColor,
					size: config.size.base,
					glowSize: config.size.base * config.size.glow,
					opacity: config.opacity,
					glowOpacity: config.glowOpacity,
					strokeWidth: config.size.stroke,
					strokeOpacity: config.strokeOpacity,
					source: event.source
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	function getOutageRadiusGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.outages.visible) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = [];
		outageData.filter((e) => e.active).forEach((event) => {
			const config = getOutageMarkerConfig(event.severity as 'total' | 'major' | 'partial');
			if (event.boundaryCoords && event.boundaryCoords.length > 0) {
				features.push({
					type: 'Feature',
					geometry: { type: 'Polygon', coordinates: event.boundaryCoords },
					properties: { id: `${event.id}-boundary`, severity: event.severity, color: config.color }
				});
			} else {
				const radiusKm = event.radiusKm || 100;
				const circleCoords = generateCircleCoordinates(event.lon, event.lat, radiusKm);
				features.push({
					type: 'Feature',
					geometry: { type: 'Polygon', coordinates: [circleCoords] },
					properties: { id: `${event.id}-radius`, severity: event.severity, color: config.color }
				});
			}
		});
		return { type: 'FeatureCollection', features };
	}

	function getAircraftGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.aircraft.visible || aircraftData.length === 0) return { type: 'FeatureCollection', features: [] };
		// Filter out aircraft with invalid coordinates to prevent GeoJSON errors
		const validAircraft = aircraftData.filter((a) => a.longitude != null && a.latitude != null);
		const config = MARKER_CONFIGS.aircraft;
		const features: GeoJSON.Feature[] = validAircraft.map((aircraft) => {
			const altitude = aircraft.geoAltitude ?? aircraft.baroAltitude;
			const color = getAltitudeColor(altitude, aircraft.onGround);
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [aircraft.longitude!, aircraft.latitude!] },
				properties: {
					icao24: aircraft.icao24,
					callsign: aircraft.callsign || aircraft.icao24.toUpperCase(),
					originCountry: aircraft.originCountry,
					altitude,
					altitudeFormatted: formatAltitude(altitude),
					velocity: aircraft.velocity,
					velocityFormatted: formatVelocity(aircraft.velocity),
					heading: aircraft.trueTrack,
					headingFormatted: formatHeading(aircraft.trueTrack),
					onGround: aircraft.onGround,
					color,
					glowColor: color,
					strokeColor: config.strokeColor,
					size: config.size.base,
					opacity: config.opacity,
					strokeWidth: config.size.stroke,
					strokeOpacity: config.strokeOpacity,
					type: 'aircraft',
					rotation: aircraft.trueTrack ?? 0
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	function getVolcanoGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.volcanoes.visible || volcanoData.length === 0) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = volcanoData.map((volcano) => {
			const config = getVolcanoMarkerConfig(volcano.alertLevel);
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [volcano.lon, volcano.lat] },
				properties: {
					id: volcano.id,
					name: volcano.name,
					type: 'volcano',
					alertLevel: volcano.alertLevel,
					color: config.color,
					glowColor: config.glowColor,
					strokeColor: config.strokeColor,
					size: config.size.base,
					glowSize: config.size.base * config.size.glow,
					opacity: config.opacity,
					glowOpacity: config.glowOpacity,
					strokeWidth: config.size.stroke,
					strokeOpacity: config.strokeOpacity
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	function getVesselGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.vessels.visible || vesselData.length === 0) return { type: 'FeatureCollection', features: [] };
		// Filter out vessels with invalid coordinates to prevent GeoJSON errors
		const validVessels = vesselData.filter((v) => v.lon != null && v.lat != null);
		const features: GeoJSON.Feature[] = validVessels.map((vessel) => {
			const config = getVesselMarkerConfig(vessel.shipType);
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [vessel.lon, vessel.lat] },
				properties: {
					mmsi: vessel.mmsi,
					name: vessel.name || `MMSI ${vessel.mmsi}`,
					type: 'vessel',
					shipTypeName: vessel.shipTypeName || 'Unknown',
					destination: vessel.destination || 'Not reported',
					speedFormatted: formatVesselSpeed(vessel.speed),
					color: config.color,
					glowColor: config.glowColor,
					strokeColor: config.strokeColor,
					size: config.size.base,
					glowSize: config.size.base * config.size.glow,
					opacity: config.opacity,
					glowOpacity: config.glowOpacity,
					strokeWidth: config.size.stroke,
					strokeOpacity: config.strokeOpacity,
					rotation: vessel.heading ?? vessel.course ?? 0
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	function getRadiationGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.radiation.visible || radiationReadings.length === 0) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = radiationReadings.map((reading) => {
			const config = getRadiationMarkerConfig(reading.level);
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [reading.lon, reading.lat] },
				properties: {
					id: reading.id,
					type: 'radiation',
					value: reading.value,
					unit: reading.unit,
					level: reading.level,
					color: config.color,
					glowColor: config.glowColor,
					strokeColor: config.strokeColor,
					size: config.size.base,
					glowSize: config.size.base * config.size.glow,
					opacity: config.opacity,
					glowOpacity: config.glowOpacity,
					strokeWidth: config.size.stroke,
					strokeOpacity: config.strokeOpacity
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	function getDiseaseGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.diseases.visible || diseaseOutbreaks.length === 0) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = diseaseOutbreaks.map((outbreak) => {
			const config = getDiseaseMarkerConfig(outbreak.severity);
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [outbreak.lon, outbreak.lat] },
				properties: {
					id: outbreak.id,
					type: 'disease',
					disease: outbreak.disease,
					country: outbreak.country,
					severity: outbreak.severity,
					color: config.color,
					glowColor: config.glowColor,
					strokeColor: config.strokeColor,
					size: config.size.base,
					glowSize: config.size.base * config.size.glow,
					opacity: config.opacity,
					glowOpacity: config.glowOpacity,
					strokeWidth: config.size.stroke,
					strokeOpacity: config.strokeOpacity
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	function getEarthquakesGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.earthquakes.visible || earthquakes.length === 0) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = earthquakes.map((quake) => {
			const config = getEarthquakeMarkerConfig(quake.magnitude);
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [quake.lon, quake.lat] },
				properties: {
					id: quake.id,
					type: 'earthquake',
					magnitude: quake.magnitude,
					place: quake.place,
					depth: quake.depth,
					color: config.color,
					glowColor: config.glowColor,
					strokeColor: config.strokeColor,
					size: config.size.base,
					glowSize: config.size.base * config.size.glow,
					opacity: config.opacity,
					glowOpacity: config.glowOpacity,
					strokeWidth: config.size.stroke,
					strokeOpacity: config.strokeOpacity
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	// Get pulsing rings for critical hotspots or hotspots with alerts
	function getPulsingRingsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.hotspots.visible) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = [];
		HOTSPOTS.forEach((h) => {
			const activity = getHotspotActivityLevel(h.name, h.level);
			if (activity.level === 'critical' || activity.hasAlert) {
				const config = getHotspotMarkerConfig(activity.hasAlert ? 'critical' : (activity.level as 'critical' | 'high' | 'elevated' | 'low'));
				features.push({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
					properties: {
						label: h.name,
						color: config.color,
						outerRadius: config.size.base * 2.5,
						innerRadius: config.size.base * 1.5
					}
				});
			}
		});
		return { type: 'FeatureCollection', features };
	}

	// Get labels for critical/high hotspots
	function getLabelsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.hotspots.visible) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = HOTSPOTS.filter((h) => {
			const activity = getHotspotActivityLevel(h.name, h.level);
			return activity.level === 'critical' || activity.level === 'high';
		}).map((h) => {
			const activity = getHotspotActivityLevel(h.name, h.level);
			const config = getHotspotMarkerConfig(activity.level as 'critical' | 'high' | 'elevated' | 'low');
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
				properties: {
					label: activity.newsCount > 0 ? `${h.name} (${activity.newsCount})` : h.name,
					color: config.color,
					level: activity.level
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	// Generate GeoJSON for selected vessel track line
	function getVesselTrackGeoJSON(): GeoJSON.FeatureCollection {
		if (!currentVesselTrack.vessel || currentVesselTrack.track.length < 2) {
			return { type: 'FeatureCollection', features: [] };
		}
		// Create LineString from track points
		const coordinates: [number, number][] = currentVesselTrack.track.map((pt) => [pt.lon, pt.lat]);
		const features: GeoJSON.Feature[] = [
			{
				type: 'Feature',
				geometry: { type: 'LineString', coordinates },
				properties: {
					mmsi: currentVesselTrack.vessel.mmsi,
					name: currentVesselTrack.vessel.name || currentVesselTrack.vessel.mmsi,
					pointCount: currentVesselTrack.track.length
				}
			}
		];
		return { type: 'FeatureCollection', features };
	}

	// Generate GeoJSON for vessel track direction markers (arrows along the path)
	function getVesselTrackMarkersGeoJSON(): GeoJSON.FeatureCollection {
		if (!currentVesselTrack.vessel || currentVesselTrack.track.length < 2) {
			return { type: 'FeatureCollection', features: [] };
		}
		const features: GeoJSON.Feature[] = [];
		const track = currentVesselTrack.track;
		// Add markers at intervals along the track (every 5th point, plus start and end)
		const interval = Math.max(1, Math.floor(track.length / 8));
		for (let i = 0; i < track.length; i += interval) {
			const pt = track[i];
			const isStart = i === 0;
			const isEnd = i >= track.length - interval;
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
				properties: {
					isStart,
					isEnd: isEnd && i > 0,
					index: i,
					timestamp: pt.timestamp,
					speed: pt.speed,
					course: pt.course
				}
			});
		}
		// Always include the last point
		const lastPt = track[track.length - 1];
		if (features.length === 0 || features[features.length - 1].properties?.index !== track.length - 1) {
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [lastPt.lon, lastPt.lat] },
				properties: {
					isStart: false,
					isEnd: true,
					index: track.length - 1,
					timestamp: lastPt.timestamp,
					speed: lastPt.speed,
					course: lastPt.course
				}
			});
		}
		return { type: 'FeatureCollection', features };
	}

	// Generate GeoJSON for VIEWS conflict forecast hotspots (Smart Hotspots)
	function getConflictHotspotsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.smartHotspots.visible || !conflictData) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = conflictData.hotspots.map((hotspot) => {
			const config = getConflictMarkerConfig(hotspot.intensity);
			return {
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [hotspot.lon, hotspot.lat] },
				properties: {
					id: hotspot.id,
					label: hotspot.label,
					name: hotspot.name,
					type: 'views-conflict',
					intensity: hotspot.intensity,
					color: config.color,
					glowColor: config.glowColor,
					strokeColor: config.strokeColor,
					size: config.size.base,
					glowSize: config.size.base * config.size.glow,
					opacity: config.opacity,
					glowOpacity: config.glowOpacity,
					strokeWidth: config.size.stroke,
					strokeOpacity: config.strokeOpacity,
					desc: hotspot.riskDescription
				}
			};
		});
		return { type: 'FeatureCollection', features };
	}

	// Generate GeoJSON for VIEWS conflict tension arcs
	function getConflictArcsGeoJSON(): GeoJSON.FeatureCollection {
		if (!dataLayers.smartHotspots.visible || !conflictData) return { type: 'FeatureCollection', features: [] };
		const features: GeoJSON.Feature[] = [];
		for (const arc of conflictData.arcs) {
			const coords = generateArcCoordinates([arc.from.lon, arc.from.lat], [arc.to.lon, arc.to.lat], 40);
			const arcStyle = ARC_STYLES.conflict;
			features.push({
				type: 'Feature',
				geometry: { type: 'LineString', coordinates: coords },
				properties: {
					id: arc.id,
					type: 'views-arc',
					from: arc.from.name,
					to: arc.to.name,
					color: arc.color || arcStyle.color,
					width: arcStyle.width,
					glowWidth: arcStyle.glowWidth,
					opacity: arcStyle.opacity,
					glowOpacity: arcStyle.glowOpacity,
					intensity: arc.intensity,
					description: arc.description
				}
			});
		}
		return { type: 'FeatureCollection', features };
	}

	// Data loading functions
	async function loadOutageData() {
		if (outageDataLoading) return;
		outageDataLoading = true;
		try {
			outageData = await fetchOutageData();
		} catch (e) {
			console.error('Failed to load outage data:', e);
		} finally {
			outageDataLoading = false;
		}
	}

	async function loadConflictData() {
		if (conflictDataLoading) return;
		conflictDataLoading = true;
		try {
			conflictData = await fetchUCDPConflicts();
		} catch (e) {
			console.error('Failed to load conflict data:', e);
		} finally {
			conflictDataLoading = false;
		}
	}

	async function loadVolcanoData() {
		if (volcanoDataLoading) return;
		volcanoDataLoading = true;
		try {
			volcanoData = await fetchElevatedVolcanoes();
		} catch (e) {
			console.error('Failed to load volcano data:', e);
		} finally {
			volcanoDataLoading = false;
		}
	}

	async function loadAircraftData() {
		if (aircraftDataLoading || isRateLimited) return;
		const now = Date.now();
		if (now - lastAircraftFetch < AIRCRAFT_DEBOUNCE_MS) return;

		aircraftDataLoading = true;
		try {
			let bounds: [number, number, number, number] | undefined;
			const regions = Array.from(selectedAircraftRegions);

			if (regions.includes('viewport') && map) {
				const mapBounds = map.getBounds();
				bounds = [mapBounds.getWest(), mapBounds.getSouth(), mapBounds.getEast(), mapBounds.getNorth()];
			} else if (regions.length > 0) {
				const region = AIRCRAFT_REGIONS[regions[0]];
				if (region) bounds = region.bounds;
			}

			const data = await fetchAircraftPositions(bounds);
			const limitedData = data.slice(0, MAX_AIRCRAFT_DISPLAY);
			aircraftData = limitedData;
			lastAircraftFetch = now;
			localStorage.setItem('adsb-last-fetch', String(now));

			const snapshot: AircraftSnapshot = { timestamp: now, aircraft: limitedData, region: regions.join(',') };
			aircraftHistory = [...aircraftHistory.slice(-MAX_AIRCRAFT_HISTORY + 1), snapshot];
			onAircraftDataChange?.(limitedData, aircraftHistory);
		} catch (e) {
			if (e instanceof OpenSkyRateLimitError) {
				isRateLimited = true;
				setTimeout(() => { isRateLimited = false; }, RATE_LIMIT_BACKOFF_MS);
			}
			console.error('Failed to load aircraft data:', e);
		} finally {
			aircraftDataLoading = false;
		}
	}

	async function loadAirQualityData() {
		if (airQualityDataLoading) return;
		airQualityDataLoading = true;
		try {
			airQualityData = await fetchAirQualityData();
		} catch (e) {
			console.error('Failed to load air quality data:', e);
		} finally {
			airQualityDataLoading = false;
		}
	}

	function startVesselStream() {
		if (vesselUnsubscribe) return;
		connectVesselStream();
		vesselUnsubscribe = vesselStore.subscribe((vessels) => { vesselData = vessels; });
		const statusUnsub = vesselConnectionStatus.subscribe((status) => { vesselConnectionState = status; });
	}

	function stopVesselStream() {
		if (vesselUnsubscribe) {
			vesselUnsubscribe();
			vesselUnsubscribe = null;
		}
		disconnectVesselStream();
		vesselData = [];
		vesselConnectionState = 'disconnected';
	}

	// Update all map layers
	function updateMapLayers() {
		if (!map || !isInitialized) return;
		try {
			const sources = [
				{ name: 'hotspots', getData: getHotspotsGeoJSON },
				{ name: 'chokepoints', getData: getChokepointsGeoJSON },
				{ name: 'cables', getData: getCablesGeoJSON },
				{ name: 'nuclear', getData: getNuclearGeoJSON },
				{ name: 'military', getData: getMilitaryGeoJSON },
				{ name: 'monitors', getData: getMonitorsGeoJSON },
				{ name: 'arcs', getData: getArcsGeoJSON },
				{ name: 'news-events', getData: getNewsEventsGeoJSON },
				{ name: 'outages', getData: getOutagesGeoJSON },
				{ name: 'outage-radius', getData: getOutageRadiusGeoJSON },
				{ name: 'aircraft', getData: getAircraftGeoJSON },
				{ name: 'volcanoes', getData: getVolcanoGeoJSON },
				{ name: 'vessels', getData: getVesselGeoJSON },
				{ name: 'radiation', getData: getRadiationGeoJSON },
				{ name: 'diseases', getData: getDiseaseGeoJSON },
				{ name: 'earthquakes', getData: getEarthquakesGeoJSON },
				{ name: 'pulsing-rings', getData: getPulsingRingsGeoJSON },
				{ name: 'labels', getData: getLabelsGeoJSON },
				{ name: 'ucdp-hotspots', getData: getConflictHotspotsGeoJSON },
				{ name: 'ucdp-arcs', getData: getConflictArcsGeoJSON },
				{ name: 'vessel-track', getData: getVesselTrackGeoJSON },
				{ name: 'vessel-track-markers', getData: getVesselTrackMarkersGeoJSON }
			];
			sources.forEach(({ name, getData }) => {
				const source = map!.getSource(name) as maplibregl.GeoJSONSource;
				if (source) source.setData(getData());
			});
		} catch (e) {
			console.error('Error updating map layers:', e);
		}
	}

	// Pause/resume layer data
	function toggleLayerPause(layer: keyof typeof dataLayers) {
		if (layer === 'news') {
			if (!dataLayers.news.paused) {
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

	// Rotation animation
	let rotationFrame: number | null = null;

	function startRotation() {
		if (!map || !isRotating) return;
		const rotate = () => {
			if (!map || !isRotating) return;
			const center = map.getCenter();
			center.lng += 0.01;
			map.setCenter(center);
			rotationFrame = requestAnimationFrame(rotate);
		};
		rotate();
	}

	function stopRotation() {
		if (rotationFrame) {
			cancelAnimationFrame(rotationFrame);
			rotationFrame = null;
		}
	}

	function pauseRotation() {
		isRotating = false;
		stopRotation();
	}

	function resumeRotation() {
		if (!userEnabledRotation) return;
		isRotating = true;
		startRotation();
	}

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

	// Open strategic webcams
	function openStrategicWebcams() {
		webcamWindows.openStrategicWebcamsPanel();
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
			'feed-news': category ? FEED_LABELS[category as keyof typeof FEED_LABELS] || 'NEWS FEED' : 'NEWS FEED',
			aircraft: 'AIRCRAFT (ADS-B)',
			vessel: 'VESSEL (AIS)',
			volcano: 'VOLCANO (USGS)',
			radiation: 'RADIATION READING',
			disease: 'DISEASE OUTBREAK'
		};
		return labels[type] || type.toUpperCase();
	}

	// Initialize map
	async function initMap() {
		console.log('[MapLibre] initMap called');
		if (typeof window === 'undefined' || !mapContainer) {
			initError = 'Map container not found';
			console.error('[MapLibre] Map container not found');
			return;
		}

		// Check container has dimensions (wait if not ready)
		const width = mapContainer.clientWidth;
		const height = mapContainer.clientHeight;
		console.log(`[MapLibre] Container dimensions: ${width}x${height}`);

		if (width === 0 || height === 0) {
			console.log('[MapLibre] Container has no dimensions, retrying...');
			await new Promise((resolve) => setTimeout(resolve, 100));
			return initMap();
		}

		console.log('[MapLibre] Creating map...');
		try {
			map = new maplibregl.Map({
				container: mapContainer,
				style: {
					version: 8,
					name: 'Dark Globe',
					sources: {
						'osm-tiles': {
							type: 'raster',
							tiles: [
								'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
								'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
								'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
							],
							tileSize: 256,
							attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
						}
					},
					layers: [
						{ id: 'osm-tiles', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 }
					],
					glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'
				},
				center: [10, 25],
				zoom: 1.5,
				maxPitch: 85
			});

			console.log('[MapLibre] Map created, waiting for load event...');

			map.on('load', () => {
				console.log('[MapLibre] Map load event fired');
				if (!map) return;

				// Enable globe projection (must be set after style loads)
				try {
					map.setProjection({ type: 'globe' });
					console.log('[MapLibre] Globe projection enabled');
				} catch (e) {
					console.warn('[MapLibre] Globe projection not supported:', e);
				}

				// Set fog for globe effect
				try {
					map.setFog({
						color: 'rgb(6, 182, 212)',
						'high-color': 'rgb(2, 6, 23)',
						'horizon-blend': 0.02,
						'space-color': 'rgb(2, 3, 5)',
						'star-intensity': 0.6
					});
					console.log('[MapLibre] Fog enabled');
				} catch (e) {
					console.warn('[MapLibre] Fog not supported:', e);
				}

				// Add all GeoJSON sources
				console.log('[MapLibre] Adding GeoJSON sources...');
				try {
					map.addSource('hotspots', { type: 'geojson', data: getHotspotsGeoJSON() });
					map.addSource('chokepoints', { type: 'geojson', data: getChokepointsGeoJSON() });
					map.addSource('cables', { type: 'geojson', data: getCablesGeoJSON() });
					map.addSource('nuclear', { type: 'geojson', data: getNuclearGeoJSON() });
					map.addSource('military', { type: 'geojson', data: getMilitaryGeoJSON() });
					map.addSource('monitors', { type: 'geojson', data: getMonitorsGeoJSON() });
					map.addSource('arcs', { type: 'geojson', data: getArcsGeoJSON() });
					map.addSource('news-events', { type: 'geojson', data: getNewsEventsGeoJSON() });
					map.addSource('outages', { type: 'geojson', data: getOutagesGeoJSON() });
					map.addSource('outage-radius', { type: 'geojson', data: getOutageRadiusGeoJSON() });
					map.addSource('aircraft', { type: 'geojson', data: getAircraftGeoJSON() });
					map.addSource('volcanoes', { type: 'geojson', data: getVolcanoGeoJSON() });
					map.addSource('vessels', { type: 'geojson', data: getVesselGeoJSON() });
					map.addSource('radiation', { type: 'geojson', data: getRadiationGeoJSON() });
					map.addSource('diseases', { type: 'geojson', data: getDiseaseGeoJSON() });
					map.addSource('earthquakes', { type: 'geojson', data: getEarthquakesGeoJSON() });
					map.addSource('pulsing-rings', { type: 'geojson', data: getPulsingRingsGeoJSON() });
					map.addSource('labels', { type: 'geojson', data: getLabelsGeoJSON() });
					map.addSource('ucdp-hotspots', { type: 'geojson', data: getConflictHotspotsGeoJSON() });
					map.addSource('ucdp-arcs', { type: 'geojson', data: getConflictArcsGeoJSON() });
					map.addSource('vessel-track', { type: 'geojson', data: getVesselTrackGeoJSON() });
					map.addSource('vessel-track-markers', { type: 'geojson', data: getVesselTrackMarkersGeoJSON() });
					console.log('[MapLibre] All sources added successfully');
				} catch (e) {
					console.error('[MapLibre] Error adding sources:', e);
				}

				// Add all layers with try-catch for debugging
				console.log('[MapLibre] Adding layers...');
				try {
					// Outage radius layer - area effects
					map.addLayer({ id: 'outage-radius-fill', type: 'fill', source: 'outage-radius', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.06 } });
					map.addLayer({ id: 'outage-radius-border', type: 'line', source: 'outage-radius', paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.35, 'line-dasharray': [4, 2] } });

					// Arc layers - threat corridors with glow effect
					map.addLayer({ id: 'arcs-glow', type: 'line', source: 'arcs', paint: { 'line-color': ['get', 'color'], 'line-width': ARC_STYLES.threat.glowWidth, 'line-opacity': ARC_STYLES.threat.glowOpacity, 'line-blur': 3 } });
					map.addLayer({ id: 'arcs-main', type: 'line', source: 'arcs', paint: { 'line-color': ['get', 'color'], 'line-width': ARC_STYLES.threat.width, 'line-opacity': ARC_STYLES.threat.opacity } });

					// Cable layers - small emerald markers
					map.addLayer({ id: 'cables-glow', type: 'circle', source: 'cables', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 1 } });
					map.addLayer({ id: 'cables-layer', type: 'circle', source: 'cables', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Military layers - blue with white stroke
					map.addLayer({ id: 'military-glow', type: 'circle', source: 'military', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 1 } });
					map.addLayer({ id: 'military-layer', type: 'circle', source: 'military', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Chokepoint layers - outlined cyan circles (maritime style)
					map.addLayer({ id: 'chokepoints-glow', type: 'circle', source: 'chokepoints', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 1 } });
					map.addLayer({ id: 'chokepoints-layer', type: 'circle', source: 'chokepoints', paint: { 'circle-radius': ['get', 'size'], 'circle-color': 'rgba(6, 182, 212, 0.12)', 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Nuclear layers - orange with amber stroke (radiation warning)
					map.addLayer({ id: 'nuclear-glow', type: 'circle', source: 'nuclear', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 1 } });
					map.addLayer({ id: 'nuclear-layer', type: 'circle', source: 'nuclear', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Hotspot layers - threat-level colored with glow
					map.addLayer({ id: 'hotspots-glow', type: 'circle', source: 'hotspots', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 1 } });
					map.addLayer({ id: 'hotspots-layer', type: 'circle', source: 'hotspots', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });
					map.addLayer({ id: 'hotspots-labels', type: 'symbol', source: 'hotspots', layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] }, paint: { 'text-color': '#e2e8f0', 'text-halo-color': '#0f172a', 'text-halo-width': 1.5 } });

					// Monitor layers - custom user markers
					map.addLayer({ id: 'monitors-glow', type: 'circle', source: 'monitors', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 1 } });
					map.addLayer({ id: 'monitors-layer', type: 'circle', source: 'monitors', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// News event layers - category-colored with fade based on age
					map.addLayer({ id: 'news-glow', type: 'circle', source: 'news-events', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 1 } });
					map.addLayer({ id: 'news-layer', type: 'circle', source: 'news-events', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Outage layers - severity-based coloring
					map.addLayer({ id: 'outages-glow', type: 'circle', source: 'outages', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 0.5 } });
					map.addLayer({ id: 'outages-layer', type: 'circle', source: 'outages', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Aircraft layers - altitude-colored, small markers
					map.addLayer({ id: 'aircraft-layer', type: 'circle', source: 'aircraft', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Volcano layers - alert-level colored
					map.addLayer({ id: 'volcanoes-glow', type: 'circle', source: 'volcanoes', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 0.5 } });
					map.addLayer({ id: 'volcanoes-layer', type: 'circle', source: 'volcanoes', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Vessel layers - ship-type colored
					map.addLayer({ id: 'vessels-glow', type: 'circle', source: 'vessels', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 0.5 } });
					map.addLayer({ id: 'vessels-layer', type: 'circle', source: 'vessels', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Radiation layers - level-based coloring
					map.addLayer({ id: 'radiation-glow', type: 'circle', source: 'radiation', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 0.5 } });
					map.addLayer({ id: 'radiation-layer', type: 'circle', source: 'radiation', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Disease layers - severity-based coloring
					map.addLayer({ id: 'diseases-glow', type: 'circle', source: 'diseases', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 0.5 } });
					map.addLayer({ id: 'diseases-layer', type: 'circle', source: 'diseases', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Earthquake layers - magnitude-based sizing and coloring
					map.addLayer({ id: 'earthquakes-glow', type: 'circle', source: 'earthquakes', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 1 } });
					map.addLayer({ id: 'earthquakes-layer', type: 'circle', source: 'earthquakes', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Pulsing rings for critical hotspots - animated attention rings
					map.addLayer({ id: 'pulsing-rings-outer', type: 'circle', source: 'pulsing-rings', paint: { 'circle-radius': ['get', 'outerRadius'], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2.5, 'circle-stroke-opacity': 0.25 } });
					map.addLayer({ id: 'pulsing-rings-inner', type: 'circle', source: 'pulsing-rings', paint: { 'circle-radius': ['get', 'innerRadius'], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.45 } });

					// VIEWS Conflict arcs (Smart Hotspots)
					map.addLayer({ id: 'ucdp-arcs-glow', type: 'line', source: 'ucdp-arcs', paint: { 'line-color': ['get', 'color'], 'line-width': ARC_STYLES.conflict.glowWidth, 'line-opacity': ARC_STYLES.conflict.glowOpacity, 'line-blur': 3 } });
					map.addLayer({ id: 'ucdp-arcs-main', type: 'line', source: 'ucdp-arcs', paint: { 'line-color': ['get', 'color'], 'line-width': ARC_STYLES.conflict.width, 'line-opacity': ARC_STYLES.conflict.opacity } });

					// VIEWS Conflict hotspots (Smart Hotspots)
					map.addLayer({ id: 'ucdp-hotspots-glow', type: 'circle', source: 'ucdp-hotspots', paint: { 'circle-radius': ['get', 'glowSize'], 'circle-color': ['get', 'glowColor'], 'circle-opacity': ['get', 'glowOpacity'], 'circle-blur': 0.5 } });
					map.addLayer({ id: 'ucdp-hotspots-layer', type: 'circle', source: 'ucdp-hotspots', paint: { 'circle-radius': ['get', 'size'], 'circle-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-width': ['get', 'strokeWidth'], 'circle-stroke-color': ['get', 'strokeColor'], 'circle-stroke-opacity': ['get', 'strokeOpacity'] } });

					// Selected vessel track - cyan line with glow effect for tactical visibility
					map.addLayer({ id: 'vessel-track-glow', type: 'line', source: 'vessel-track', paint: { 'line-color': '#06b6d4', 'line-width': 6, 'line-opacity': 0.3, 'line-blur': 3 } });
					map.addLayer({ id: 'vessel-track-line', type: 'line', source: 'vessel-track', paint: { 'line-color': '#06b6d4', 'line-width': 2.5, 'line-opacity': 0.9 } });
					// Vessel track direction markers - circles along the path
					map.addLayer({ id: 'vessel-track-markers', type: 'circle', source: 'vessel-track-markers', paint: {
						'circle-radius': ['case', ['get', 'isStart'], 6, ['get', 'isEnd'], 7, 4],
						'circle-color': ['case', ['get', 'isStart'], '#10b981', ['get', 'isEnd'], '#f59e0b', '#06b6d4'],
						'circle-opacity': 0.9,
						'circle-stroke-width': 2,
						'circle-stroke-color': '#0f172a',
						'circle-stroke-opacity': 1
					} });

					console.log('[MapLibre] All layers added successfully');
				} catch (e) {
					console.error('[MapLibre] Error adding layers:', e);
				}

				// Add click handlers for all layers
				console.log('[MapLibre] Adding click handlers...');
				try {
					const clickableLayers = ['hotspots-layer', 'chokepoints-layer', 'cables-layer', 'nuclear-layer', 'military-layer', 'monitors-layer', 'outages-layer', 'news-layer', 'aircraft-layer', 'volcanoes-layer', 'vessels-layer', 'radiation-layer', 'diseases-layer', 'earthquakes-layer', 'ucdp-hotspots-layer'];
					clickableLayers.forEach((layer) => {
						// Only add handlers if layer exists
						if (!map!.getLayer(layer)) {
							console.warn(`[MapLibre] Layer ${layer} not found, skipping handlers`);
							return;
						}
						map!.on('click', layer, (e) => {
							if (!e.features || e.features.length === 0) return;
							const props = e.features[0].properties;
							new maplibregl.Popup()
								.setLngLat(e.lngLat)
								.setHTML(`<div style="font-family: monospace; font-size: 11px;"><strong style="color: ${props?.color || '#06b6d4'}">${props?.label || props?.name || props?.callsign || 'Unknown'}</strong><br/><span style="color: #94a3b8; text-transform: uppercase;">${props?.type}</span><br/><span style="color: #64748b;">${props?.desc || props?.disease || props?.altitudeFormatted || props?.speedFormatted || ''}</span></div>`)
								.addTo(map!);
						});
						map!.on('mouseenter', layer, () => { if (map) map.getCanvas().style.cursor = 'pointer'; });
						map!.on('mouseleave', layer, () => { if (map) map.getCanvas().style.cursor = ''; });
					});
					console.log('[MapLibre] Click handlers added');
				} catch (e) {
					console.error('[MapLibre] Error adding click handlers:', e);
				}

				// Pause rotation on user interaction
				map.on('mousedown', pauseRotation);
				map.on('wheel', pauseRotation);
				map.on('touchstart', pauseRotation);

				console.log('[MapLibre] All sources and layers added, setting isInitialized = true');
				isInitialized = true;
				if (isRotating) startRotation();

					// Load initial data
				console.log('[MapLibre] Loading initial data...');
				loadOutageData();
				loadVolcanoData();
			});

			map.on('error', (e) => {
				// Extract useful error information from MapLibre error events
				const errorInfo = e.error ? {
					message: e.error.message || e.error,
					sourceId: e.sourceId,
					source: e.source,
					tile: e.tile ? { x: e.tile.x, y: e.tile.y, z: e.tile.z } : undefined
				} : e;
				// Filter out benign tile loading errors (404s, etc)
				const isTileError = e.sourceId && (e.error?.message?.includes('tile') || e.error?.status === 404);
				if (!isTileError) {
					console.error('[MapLibre] Map error:', errorInfo);
				}
			});
		} catch (error) {
			console.error('[MapLibre] Failed to initialize:', error);
			initError = error instanceof Error ? error.message : 'Failed to initialize map';
		}
	}

	onMount(() => {
		console.log('[MapLibre] onMount called, scheduling initMap');
		requestAnimationFrame(() => initMap());
		// Subscribe to vessel track changes
		vesselTrackUnsubscribe = selectedVesselTrack.subscribe((trackData) => {
			currentVesselTrack = trackData;
			// Update the map layers when track changes
			if (map && isInitialized) {
				const trackSource = map.getSource('vessel-track') as maplibregl.GeoJSONSource;
				const markersSource = map.getSource('vessel-track-markers') as maplibregl.GeoJSONSource;
				if (trackSource) trackSource.setData(getVesselTrackGeoJSON());
				if (markersSource) markersSource.setData(getVesselTrackMarkersGeoJSON());
			}
		});
	});

	onDestroy(() => {
		stopRotation();
		stopVesselStream();
		if (aircraftRefreshInterval) clearInterval(aircraftRefreshInterval);
		if (vesselTrackUnsubscribe) vesselTrackUnsubscribe();
		if (map) { map.remove(); map = null; }
	});

	// Handle flyToTarget prop changes
	$effect(() => {
		const target = currentFlyTarget;
		if (!map || !isInitialized || !target) return;
		const { lat, lon, zoom } = target;
		if (isRotating) pauseRotation();
		map.flyTo({ center: [lon, lat], zoom: zoom ?? 4, duration: 2000 });
	});

	// Update map layers when data changes
	$effect(() => {
		const _ = [radiationReadings.length, diseaseOutbreaks.length, earthquakes.length];
		if (!map || !isInitialized) return;
		updateMapLayers();
	});

	// Handle ADS-B toggle from AircraftPanel
	$effect(() => {
		if (adsbEnabled && !aircraftRefreshInterval) {
			loadAircraftData();
			aircraftRefreshInterval = setInterval(loadAircraftData, AIRCRAFT_REFRESH_INTERVAL);
		} else if (!adsbEnabled && aircraftRefreshInterval) {
			clearInterval(aircraftRefreshInterval);
			aircraftRefreshInterval = null;
			aircraftData = [];
		}
		updateMapLayers();
	});
</script>

<div class="globe-panel">
	<!-- MapLibre Badge -->
	<div class="provider-badge">
		<span class="badge-text">MAPLIBRE GL</span>
		<span class="badge-experimental">EXPERIMENTAL</span>
	</div>

	<!-- Map Container -->
	<div class="map-container" bind:this={mapContainer}></div>

	<!-- Error State -->
	{#if initError}
		<div class="globe-error">
			<span class="error-icon">!</span>
			<span class="error-text">{initError}</span>
		</div>
	{/if}

	<!-- Globe Controls -->
	{#if isInitialized}
		<div class="globe-controls">
			<button class="control-btn" class:active={isRotating} onclick={toggleRotation} title={isRotating ? 'Pause rotation' : 'Start rotation'}>
				<span class="control-icon">{isRotating ? '⏸' : '▶'}</span>
			</button>
			<button class="control-btn" class:active={dataControlsExpanded} onclick={() => (dataControlsExpanded = !dataControlsExpanded)} title="Toggle data controls">
				<span class="control-icon">⚙</span>
			</button>
			<button class="control-btn" onclick={openStrategicWebcams} title="Open strategic live webcams">
				<span class="control-icon">📡</span>
			</button>
		</div>
	{/if}

	<!-- Data Controls Panel -->
	{#if isInitialized && dataControlsExpanded}
		<div class="data-controls">
			<div class="data-controls-header">
				<span class="data-controls-title">DATA LAYERS</span>
			</div>
			<div class="data-controls-content">
				<div class="layer-section">
					<span class="layer-section-title">VISIBILITY</span>
					{#each Object.entries(dataLayers) as [layer, state]}
						<label class="layer-toggle">
							{#if layer === 'aircraft'}
								<input type="checkbox" checked={adsbEnabled} onchange={() => onAdsbToggle?.(!adsbEnabled)} />
							{:else}
								<input type="checkbox" bind:checked={state.visible} onchange={() => {
									updateMapLayers();
									if (layer === 'smartHotspots' && state.visible && !conflictData && !conflictDataLoading) loadConflictData();
									if (layer === 'vessels') { if (state.visible) startVesselStream(); else stopVesselStream(); }
									if (layer === 'airQuality' && state.visible && airQualityData.length === 0 && !airQualityDataLoading) loadAirQualityData();
								}} />
							{/if}
							<span class="layer-name">
								{#if layer === 'smartHotspots'}Smart Hotspots (UCDP)
								{:else if layer === 'volcanoes'}Volcanoes (USGS)
								{:else if layer === 'aircraft'}Aircraft (ADS-B)
								{:else if layer === 'airQuality'}Air Quality (OpenAQ)
								{:else}{layer.charAt(0).toUpperCase() + layer.slice(1)}{/if}
							</span>
							{#if layer === 'aircraft' && aircraftDataLoading}<span class="loading-indicator">...</span>
							{:else if layer === 'aircraft' && aircraftData.length > 0}<span class="data-count">{aircraftData.length}</span>{/if}
							{#if layer === 'volcanoes' && volcanoData.length > 0}<span class="data-count">{volcanoData.length}</span>{/if}
							{#if layer === 'news' || layer === 'hotspots'}
								<button class="pause-btn" class:paused={state.paused} onclick={() => toggleLayerPause(layer as keyof typeof dataLayers)} title={state.paused ? 'Resume' : 'Pause'}>
									{state.paused ? '>' : '||'}
								</button>
							{/if}
						</label>
					{/each}
				</div>

				{#if categorizedNews}
					<div class="layer-section">
						<span class="layer-section-title">NEWS FEEDS</span>
						{#each Object.entries(feedLayers) as [feed, state]}
							<label class="layer-toggle feed-toggle">
								<input type="checkbox" bind:checked={state.visible} onchange={() => updateMapLayers()} />
								<span class="feed-color-dot" style="background-color: {FEED_COLORS[feed as keyof typeof FEED_COLORS]}"></span>
								<span class="layer-name">{FEED_LABELS[feed as keyof typeof FEED_LABELS]}</span>
							</label>
						{/each}
					</div>
				{/if}

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

				{#if dataLayers.news.paused}
					<div class="pause-status">
						<span class="pause-indicator"></span>
						News paused at {new Date(lastNewsUpdate).toLocaleTimeString()}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Legend -->
	{#if isInitialized}
		<div class="globe-legend" class:expanded={legendExpanded}>
			<button class="legend-toggle" onclick={() => (legendExpanded = !legendExpanded)}>
				<span class="legend-toggle-text">LEGEND</span>
				<span class="legend-toggle-icon">{legendExpanded ? '▼' : '▲'}</span>
			</button>
			{#if legendExpanded}
				<div class="legend-content">
					<div class="legend-section">
						<span class="legend-section-title">{LEGEND_SECTIONS.threatLevels.title}</span>
						<div class="legend-items">
							{#each LEGEND_SECTIONS.threatLevels.items as item}
								<div class="legend-item">
									<span class="legend-dot" style="background: {item.color}; box-shadow: 0 0 4px {item.color};"></span>
									<span class="legend-label">{item.label}</span>
								</div>
							{/each}
						</div>
					</div>
					<div class="legend-section">
						<span class="legend-section-title">{LEGEND_SECTIONS.newsFeeds.title}</span>
						<div class="legend-items">
							{#each LEGEND_SECTIONS.newsFeeds.items as item}
								<div class="legend-item">
									<span class="legend-marker" style="background: {item.color};"></span>
									<span class="legend-label">{item.label}</span>
								</div>
							{/each}
						</div>
					</div>
					<div class="legend-section">
						<span class="legend-section-title">{LEGEND_SECTIONS.infrastructure.title}</span>
						<div class="legend-items">
							{#each LEGEND_SECTIONS.infrastructure.items as item}
								<div class="legend-item">
									<span class="legend-marker" style="background: {item.color};"></span>
									<span class="legend-label">{item.label}</span>
								</div>
							{/each}
						</div>
					</div>
					{#if dataLayers.vessels.visible}
						<div class="legend-section">
							<span class="legend-section-title">{LEGEND_SECTIONS.vessels.title}</span>
							<div class="legend-items">
								{#each LEGEND_SECTIONS.vessels.items as item}
									<div class="legend-item">
										<span class="legend-marker" style="background: {item.color};"></span>
										<span class="legend-label">{item.label}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
					<div class="legend-hint">Click gear icon for data controls. Click markers for details.</div>
				</div>
			{/if}
		</div>
	{/if}

	<WebcamWindowsContainer />
</div>

<style>
	.globe-panel { position: relative; width: 100%; height: 100%; min-height: 400px; background: rgb(5 5 15); border-radius: 2px; overflow: hidden; }
	.map-container { position: absolute; inset: 0; }

	.provider-badge { position: absolute; top: 0.5rem; left: 0.5rem; z-index: 10; display: flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.5rem; background: rgb(15 23 42 / 0.9); backdrop-filter: blur(8px); border: 1px solid rgb(51 65 85 / 0.5); border-radius: 2px; }
	.badge-text { font-size: 0.5625rem; font-weight: 700; font-family: 'SF Mono', Monaco, monospace; color: rgb(34 211 238); letter-spacing: 0.05em; }
	.badge-experimental { font-size: 0.5rem; font-weight: 600; font-family: 'SF Mono', Monaco, monospace; color: rgb(234 179 8); background: rgb(234 179 8 / 0.15); padding: 0.0625rem 0.25rem; border-radius: 2px; border: 1px solid rgb(234 179 8 / 0.3); }

	.globe-error { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 1.5rem; background: rgb(15 23 42 / 0.9); border: 1px solid rgb(248 113 113 / 0.5); border-radius: 4px; z-index: 20; }
	.error-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgb(127 29 29 / 0.5); border: 2px solid rgb(248 113 113); border-radius: 50%; color: rgb(248 113 113); font-size: 1rem; font-weight: 700; }
	.error-text { font-size: 0.6875rem; color: rgb(248 113 113); text-align: center; max-width: 200px; }

	.globe-controls { position: absolute; top: 0.5rem; right: 0.5rem; z-index: 10; display: flex; flex-direction: column; gap: 0.25rem; }
	.control-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: rgb(15 23 42 / 0.8); backdrop-filter: blur(8px); border: 1px solid rgb(51 65 85 / 0.5); border-radius: 2px; color: rgb(148 163 184); cursor: pointer; transition: all 0.15s ease; }
	.control-btn:hover { background: rgb(51 65 85 / 0.8); border-color: rgb(34 211 238 / 0.5); color: rgb(34 211 238); }
	.control-btn.active { background: rgb(22 78 99 / 0.5); border-color: rgb(34 211 238 / 0.5); color: rgb(34 211 238); }
	.control-icon { font-size: 0.875rem; }

	.data-controls { position: absolute; top: 2.75rem; right: 0.5rem; z-index: 10; width: 200px; max-height: 60%; overflow-y: auto; background: rgb(15 23 42 / 0.95); backdrop-filter: blur(12px); border: 1px solid rgb(51 65 85 / 0.5); border-radius: 4px; }
	.data-controls::-webkit-scrollbar { width: 4px; }
	.data-controls::-webkit-scrollbar-track { background: transparent; }
	.data-controls::-webkit-scrollbar-thumb { background: rgb(51 65 85); border-radius: 2px; }
	.data-controls-header { padding: 0.5rem; border-bottom: 1px solid rgb(51 65 85 / 0.5); }
	.data-controls-title { font-size: 0.5625rem; font-weight: 700; font-family: 'SF Mono', Monaco, monospace; color: rgb(34 211 238); letter-spacing: 0.1em; }
	.data-controls-content { padding: 0.5rem; }

	.layer-section { margin-bottom: 0.75rem; }
	.layer-section:last-child { margin-bottom: 0; }
	.layer-section-title { font-size: 0.5rem; font-weight: 700; font-family: 'SF Mono', Monaco, monospace; color: rgb(100 116 139); letter-spacing: 0.1em; margin-bottom: 0.375rem; display: block; }
	.layer-toggle { display: flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0; cursor: pointer; font-size: 0.625rem; color: rgb(148 163 184); }
	.layer-toggle:hover { color: rgb(226 232 240); }
	.layer-toggle input[type="checkbox"] { width: 12px; height: 12px; accent-color: rgb(34 211 238); }
	.layer-name { flex: 1; }
	.data-count { font-size: 0.5rem; padding: 0.0625rem 0.25rem; background: rgb(34 211 238 / 0.15); color: rgb(34 211 238); border-radius: 2px; }
	.loading-indicator { font-size: 0.5rem; color: rgb(234 179 8); }
	.pause-btn { font-size: 0.5rem; padding: 0.125rem 0.25rem; background: rgb(51 65 85 / 0.5); border: 1px solid rgb(71 85 105 / 0.5); border-radius: 2px; color: rgb(148 163 184); cursor: pointer; }
	.pause-btn.paused { background: rgb(234 179 8 / 0.2); border-color: rgb(234 179 8 / 0.5); color: rgb(234 179 8); }

	.feed-toggle { gap: 0.25rem; }
	.feed-color-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

	.filter-row { display: flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0; font-size: 0.625rem; color: rgb(148 163 184); }
	.filter-row.checkbox { cursor: pointer; }
	.filter-label { flex: 1; }
	.filter-row select { font-size: 0.5625rem; padding: 0.125rem 0.25rem; background: rgb(30 41 59); border: 1px solid rgb(51 65 85); border-radius: 2px; color: rgb(226 232 240); }

	.pause-status { font-size: 0.5rem; padding: 0.375rem; background: rgb(234 179 8 / 0.1); border: 1px solid rgb(234 179 8 / 0.3); border-radius: 2px; color: rgb(234 179 8); display: flex; align-items: center; gap: 0.375rem; margin-top: 0.5rem; }
	.pause-indicator { width: 6px; height: 6px; background: rgb(234 179 8); border-radius: 50%; animation: pulse 1s infinite; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

	.globe-legend { position: absolute; bottom: 0.5rem; right: 0.5rem; z-index: 10; min-width: 140px; background: rgb(15 23 42 / 0.9); backdrop-filter: blur(8px); border: 1px solid rgb(51 65 85 / 0.5); border-radius: 2px; }
	.legend-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0.375rem 0.5rem; background: transparent; border: none; cursor: pointer; color: rgb(148 163 184); }
	.legend-toggle:hover { color: rgb(226 232 240); }
	.legend-toggle-text { font-size: 0.5625rem; font-weight: 700; font-family: 'SF Mono', Monaco, monospace; letter-spacing: 0.1em; }
	.legend-toggle-icon { font-size: 0.5rem; }
	.legend-content { padding: 0.5rem; border-top: 1px solid rgb(51 65 85 / 0.5); }
	.legend-section { margin-bottom: 0.5rem; }
	.legend-section:last-child { margin-bottom: 0; }
	.legend-section-title { font-size: 0.5rem; font-weight: 700; font-family: 'SF Mono', Monaco, monospace; color: rgb(100 116 139); letter-spacing: 0.1em; margin-bottom: 0.25rem; display: block; }
	.legend-items { display: flex; flex-direction: column; gap: 0.25rem; }
	.legend-item { display: flex; align-items: center; gap: 0.375rem; }
	.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
	.legend-marker { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
	.legend-label { font-size: 0.5625rem; color: rgb(148 163 184); }
	.legend-hint { font-size: 0.5rem; color: rgb(100 116 139); margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgb(51 65 85 / 0.5); }

	:global(.maplibregl-popup-content) { background: rgb(15 23 42 / 0.95) !important; border: 1px solid rgb(51 65 85) !important; border-radius: 4px !important; padding: 0.5rem 0.75rem !important; box-shadow: 0 4px 12px rgb(0 0 0 / 0.5) !important; }
	:global(.maplibregl-popup-close-button) { color: rgb(148 163 184) !important; font-size: 1rem !important; padding: 0.25rem 0.5rem !important; }
	:global(.maplibregl-popup-close-button:hover) { color: rgb(226 232 240) !important; background: transparent !important; }
	:global(.maplibregl-popup-tip) { border-top-color: rgb(15 23 42 / 0.95) !important; }
</style>
