/**
 * AIS Stream WebSocket Service
 *
 * NOTE: aisstream.io does NOT support direct browser connections (CORS blocked).
 * Their documentation states: "Cross-origin resource sharing and thus connections
 * directly to aisstream.io from the browser are not supported."
 *
 * This service uses the existing Cloudflare Worker (same one used for CORS proxy)
 * with WebSocket support at the /ws/aisstream path.
 *
 * Falls back to simulated vessel data if:
 * - No API key is configured
 * - WebSocket proxy connection fails
 */

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import { getFallbackVessels } from './vessel-fallback';
import { CORS_PROXY_URL } from '$lib/config/api';

export interface Vessel {
	mmsi: string;
	name?: string;
	imo?: string;
	lat: number;
	lon: number;
	course: number;
	speed: number;
	heading?: number;
	shipType?: number;
	shipTypeName?: string;
	destination?: string;
	eta?: string;
	draught?: number;
	length?: number;
	width?: number;
	callsign?: string;
	flag?: string;
	lastUpdate: number;
}

// Message counter for debug logging
let messageCount = 0;
let messagesInCurrentBatch = 0;
let lastLogTime = Date.now();

// Throttle store updates for performance (update UI every N seconds, not every message)
let pendingVessels: Map<string, Vessel> = new Map();
let updateScheduled = false;
const DEFAULT_UPDATE_INTERVAL = 5000; // 5 seconds default - much longer to reduce UI thrashing

// Message rate limiting - skip messages if coming too fast
let lastMessageTime = 0;
const MIN_MESSAGE_INTERVAL = 100; // Minimum 100ms between processing messages

function scheduleStoreUpdate(): void {
	if (updateScheduled) return;
	updateScheduled = true;

	// Get current interval from store
	const currentInterval = get(streamUpdateInterval);

	setTimeout(() => {
		// Skip update if paused
		if (!get(streamPaused) && pendingVessels.size > 0) {
			vesselStore.set(new Map(pendingVessels));
			// Update stats
			streamStats.update(s => ({
				...s,
				lastBatchSize: messagesInCurrentBatch,
				lastUpdateTime: Date.now()
			}));
			messagesInCurrentBatch = 0;
		}
		updateScheduled = false;
	}, currentInterval);
}

// Log statistics every 30 seconds (not every 500 messages)
function logStatsIfNeeded(): void {
	const now = Date.now();
	if (now - lastLogTime >= 30000) {
		const currentVessels = get(vesselStore);
		console.log(`AIS Stream: ${messageCount} total messages, ${currentVessels.size} strategic vessels tracked`);
		lastLogTime = now;
	}
}

// AIS Ship Type mapping
const AIS_SHIP_TYPES: Record<number, string> = {
	0: 'Not Available',
	20: 'Wing In Ground',
	21: 'WIG Hazardous A',
	22: 'WIG Hazardous B',
	23: 'WIG Hazardous C',
	24: 'WIG Hazardous D',
	29: 'WIG No Info',
	30: 'Fishing',
	31: 'Towing',
	32: 'Towing Large',
	33: 'Dredging',
	34: 'Diving Ops',
	35: 'Military Operations',
	36: 'Sailing',
	37: 'Pleasure Craft',
	40: 'High Speed Craft',
	41: 'HSC Hazardous A',
	42: 'HSC Hazardous B',
	43: 'HSC Hazardous C',
	44: 'HSC Hazardous D',
	49: 'HSC No Info',
	50: 'Pilot Vessel',
	51: 'Search and Rescue',
	52: 'Tug',
	53: 'Port Tender',
	54: 'Anti-Pollution',
	55: 'Law Enforcement',
	56: 'Spare Local 1',
	57: 'Spare Local 2',
	58: 'Medical Transport',
	59: 'Noncombatant',
	60: 'Passenger',
	61: 'Passenger Hazardous A',
	62: 'Passenger Hazardous B',
	63: 'Passenger Hazardous C',
	64: 'Passenger Hazardous D',
	69: 'Passenger No Info',
	70: 'Cargo',
	71: 'Cargo Hazardous A',
	72: 'Cargo Hazardous B',
	73: 'Cargo Hazardous C',
	74: 'Cargo Hazardous D',
	79: 'Cargo No Info',
	80: 'Tanker',
	81: 'Tanker Hazardous A',
	82: 'Tanker Hazardous B',
	83: 'Tanker Hazardous C',
	84: 'Tanker Hazardous D',
	89: 'Tanker No Info',
	90: 'Other',
	91: 'Other Hazardous A',
	92: 'Other Hazardous B',
	93: 'Other Hazardous C',
	94: 'Other Hazardous D',
	99: 'Other No Info'
};

function getShipTypeName(typeCode: number | undefined): string {
	if (!typeCode) return 'Unknown';
	return AIS_SHIP_TYPES[typeCode] || `Type ${typeCode}`;
}

// Vessel data store
export const vesselStore = writable<Map<string, Vessel>>(new Map());
export const vesselConnectionStatus = writable<'disconnected' | 'connecting' | 'connected' | 'error' | 'no_api_key'>('disconnected');
export const vesselError = writable<string | null>(null);

// Stream control state
export const streamPaused = writable<boolean>(false);
export const streamUpdateInterval = writable<number>(DEFAULT_UPDATE_INTERVAL);

// Stream statistics for UI display
export interface StreamStats {
	totalMessages: number;
	lastBatchSize: number;
	lastUpdateTime: number;
	stagedVessels: number;
}
export const streamStats = writable<StreamStats>({
	totalMessages: 0,
	lastBatchSize: 0,
	lastUpdateTime: 0,
	stagedVessels: 0
});

// Vessel track history (last N positions per vessel)
export interface VesselTrackPoint {
	lat: number;
	lon: number;
	timestamp: number;
	speed?: number;
	course?: number;
}
export const vesselTracks = writable<Map<string, VesselTrackPoint[]>>(new Map());
const MAX_TRACK_POINTS = 50; // Max track points per vessel

// WebSocket connection
let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let fallbackInterval: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;
const FALLBACK_REFRESH_INTERVAL = 10000; // Refresh fallback data every 10 seconds
const MAX_VESSELS = 500; // Limit stored vessels for performance

// Strategic ship types for intelligence monitoring (narrowed down to reduce volume)
// AIS Stream doesn't support server-side ship type filtering, so we filter client-side
const STRATEGIC_SHIP_TYPES = new Set([
	35,  // Military Operations
	55,  // Law Enforcement
	59,  // Noncombatant (military auxiliary)
	51,  // Search and Rescue
	// Tankers only (80-89) - most strategically relevant for energy monitoring
	80, 81, 82, 83, 84, 89,
]);

// Direct AIS Stream URL (for non-browser environments)
const AISSTREAM_DIRECT_URL = 'wss://stream.aisstream.io/v0/stream';

/**
 * Get WebSocket proxy URL from the existing CORS proxy URL
 * Derives wss://worker.workers.dev/ws/aisstream from https://worker.workers.dev/?url=
 */
function getProxyUrl(): string {
	if (!browser) return '';

	// Use the existing CORS proxy URL and convert to WebSocket URL
	// CORS_PROXY_URL format: https://worker.workers.dev/?url=
	// WebSocket URL format: wss://worker.workers.dev/ws/aisstream
	if (CORS_PROXY_URL) {
		try {
			const url = new URL(CORS_PROXY_URL.replace('?url=', ''));
			return `wss://${url.host}/ws/aisstream`;
		} catch {
			return '';
		}
	}
	return '';
}

/**
 * Load fallback vessel data for browser environments
 * Updates vessel positions with slight movement simulation
 */
function loadFallbackVessels(): void {
	// Clear any existing interval
	if (fallbackInterval) {
		clearInterval(fallbackInterval);
	}

	// Reset pending vessels state
	pendingVessels = new Map();
	updateScheduled = false;

	// Load initial data
	const vessels = getFallbackVessels();
	const vesselMap = new Map<string, Vessel>();
	vessels.forEach((v) => vesselMap.set(v.mmsi, v));
	vesselStore.set(vesselMap);
	vesselConnectionStatus.set('connected');
	vesselError.set(null);

	// Set up periodic refresh for movement simulation
	fallbackInterval = setInterval(() => {
		const updatedVessels = getFallbackVessels();
		const updatedMap = new Map<string, Vessel>();
		updatedVessels.forEach((v) => updatedMap.set(v.mmsi, v));
		vesselStore.set(updatedMap);
	}, FALLBACK_REFRESH_INTERVAL);
}

/**
 * Get API key from environment
 */
function getApiKey(): string {
	if (!browser) return '';
	return import.meta.env?.VITE_AISSTREAM_API_KEY ?? '';
}

/**
 * Determine the best WebSocket URL to use
 * - In browser: Use proxy URL if available, otherwise fall back to simulated data
 * - In Node.js/Electron: Use direct connection
 */
function getWebSocketUrl(): string | null {
	const isBrowserEnvironment = typeof window !== 'undefined';

	if (isBrowserEnvironment) {
		// In browser, we must use a proxy due to CORS restrictions
		const proxyUrl = getProxyUrl();
		if (proxyUrl) {
			return proxyUrl;
		}
		// No proxy configured - will use fallback data
		return null;
	}

	// Non-browser environment - can connect directly
	return AISSTREAM_DIRECT_URL;
}

/**
 * Connect to AIS Stream WebSocket
 *
 * Connection strategy:
 * 1. Browser: Connect via the existing Cloudflare Worker at /ws/aisstream path
 * 2. Non-browser (Node.js/Electron): Connect directly to AIS Stream
 *
 * Uses the same Cloudflare Worker configured in CORS_PROXY_URL.
 * Ensure the worker is updated with WebSocket support (cloudflare-worker.js).
 */
export function connectVesselStream(): void {
	if (!browser) return;

	const apiKey = getApiKey();
	if (!apiKey) {
		vesselConnectionStatus.set('no_api_key');
		vesselError.set('No AIS Stream API key configured. Get a free key at https://aisstream.io');
		console.warn('Vessel tracking disabled: No VITE_AISSTREAM_API_KEY configured');
		console.warn('Get a free API key at https://aisstream.io and add VITE_AISSTREAM_API_KEY to your .env file');
		// Use fallback data when no API key
		loadFallbackVessels();
		return;
	}

	const wsUrl = getWebSocketUrl();

	// If no WebSocket URL available in browser, use fallback data
	if (!wsUrl) {
		console.log('AIS Stream: No CORS proxy configured. Using fallback vessel data.');
		console.log('To enable live AIS data, ensure CORS_PROXY_URL is set in src/lib/config/api.ts');
		console.log('and the Cloudflare Worker has WebSocket support at /ws/aisstream');
		loadFallbackVessels();
		return;
	}

	if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
		return; // Already connected or connecting
	}

	vesselConnectionStatus.set('connecting');
	vesselError.set(null);

	const isUsingProxy = wsUrl !== AISSTREAM_DIRECT_URL;
	console.log(`AIS Stream: Connecting ${isUsingProxy ? 'via proxy' : 'directly'} to ${wsUrl}`);

	try {
		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			console.log(`AIS Stream WebSocket connected ${isUsingProxy ? '(via proxy)' : '(direct)'}`);
			reconnectAttempts = 0;

			// Send subscription message - must be within 3 seconds of connecting
			const subscriptionMessage = {
				APIKey: apiKey,
				BoundingBoxes: [[[-90, -180], [90, 180]]], // Global coverage
				FilterMessageTypes: ['PositionReport', 'ShipStaticData']
			};

			ws?.send(JSON.stringify(subscriptionMessage));
			vesselConnectionStatus.set('connected');
		};

		ws.onmessage = async (event) => {
			try {
				// Skip processing if paused
				if (get(streamPaused)) {
					return;
				}

				// Rate limiting - skip messages that come too fast
				const now = Date.now();
				if (now - lastMessageTime < MIN_MESSAGE_INTERVAL) {
					return; // Skip this message
				}
				lastMessageTime = now;

				let jsonString: string;

				// Handle binary messages (ArrayBuffer or Blob)
				if (event.data instanceof ArrayBuffer) {
					jsonString = new TextDecoder().decode(event.data);
				} else if (event.data instanceof Blob) {
					jsonString = await event.data.text();
				} else {
					jsonString = event.data;
				}

				const data = JSON.parse(jsonString);
				messageCount++;
				messagesInCurrentBatch++;

				// Update stats
				streamStats.update(s => ({ ...s, totalMessages: messageCount }));

				// Check for proxy error messages
				if (data.error) {
					console.error('AIS Stream proxy error:', data.error, data.message || '');
					vesselError.set(`Proxy error: ${data.error}`);
					vesselConnectionStatus.set('error');

					// Fall back to simulated data on proxy error
					console.log('AIS Stream: Falling back to simulated vessel data');
					loadFallbackVessels();
					return;
				}

				processAISMessage(data);

				// Log stats periodically (every 30 seconds, not every N messages)
				logStatsIfNeeded();
			} catch (error) {
				console.warn('Failed to parse AIS message:', error);
			}
		};

		ws.onerror = () => {
			// WebSocket error events don't contain useful info for security reasons
			// The actual error details come from the close event
			console.error('AIS Stream WebSocket error - check close event for details');
		};

		ws.onclose = (event) => {
			console.log('AIS Stream WebSocket closed:', event.code, event.reason);
			ws = null;

			// Provide helpful error messages based on close code
			let errorMessage = 'Connection closed';
			let shouldUseFallback = false;

			if (event.code === 1006) {
				// Abnormal closure - usually auth failure, network issue, or CORS block
				const currentKey = getApiKey();
				if (currentKey === 'your_aisstream_api_key' || currentKey.length < 20) {
					errorMessage = 'Invalid API key. Get a free key at https://aisstream.io and set VITE_AISSTREAM_API_KEY';
					vesselConnectionStatus.set('no_api_key');
				} else if (isUsingProxy) {
					errorMessage = 'Proxy connection failed. Check that the WebSocket proxy worker is deployed and accessible.';
					vesselConnectionStatus.set('error');
					shouldUseFallback = true;
				} else {
					errorMessage = 'Connection rejected - API key may be invalid or expired. Verify your key at https://aisstream.io';
					vesselConnectionStatus.set('error');
				}
				vesselError.set(errorMessage);
				console.error('AIS Stream:', errorMessage);
			} else if (event.code === 1008) {
				// Policy violation - usually invalid subscription
				errorMessage = 'Subscription rejected by server. Check API key permissions.';
				vesselConnectionStatus.set('error');
				vesselError.set(errorMessage);
			} else if (event.code !== 1000) {
				// Not a normal close - attempt reconnect
				if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
					vesselConnectionStatus.set('disconnected');
					attemptReconnect();
					return;
				} else {
					shouldUseFallback = true;
				}
			}

			// Fall back to simulated data after connection failures
			if (shouldUseFallback) {
				console.log('AIS Stream: Connection failed. Falling back to simulated vessel data.');
				loadFallbackVessels();
			}
		};
	} catch (error) {
		console.error('Failed to create WebSocket:', error);
		vesselConnectionStatus.set('error');
		vesselError.set('Failed to create WebSocket connection');

		// Fall back to simulated data
		console.log('AIS Stream: WebSocket creation failed. Using fallback vessel data.');
		loadFallbackVessels();
	}
}

/**
 * Disconnect from AIS Stream
 */
export function disconnectVesselStream(): void {
	if (reconnectTimeout) {
		clearTimeout(reconnectTimeout);
		reconnectTimeout = null;
	}

	if (fallbackInterval) {
		clearInterval(fallbackInterval);
		fallbackInterval = null;
	}

	if (ws) {
		ws.close(1000, 'User disconnected');
		ws = null;
	}

	vesselConnectionStatus.set('disconnected');
}

/**
 * Attempt to reconnect with exponential backoff
 */
function attemptReconnect(): void {
	if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
		vesselError.set(`Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
		return;
	}

	reconnectAttempts++;
	const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);

	console.log(`Attempting reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);

	reconnectTimeout = setTimeout(() => {
		connectVesselStream();
	}, delay);
}

/**
 * Process incoming AIS message
 *
 * Strategy for vessel accumulation:
 * - Only add vessels to the display map once we know their ship type is strategic
 * - PositionReport messages don't include ship type, so we store them in a staging area
 * - When ShipStaticData arrives with the type, we either promote to display or discard
 * - Vessels already in the display (confirmed strategic) get position updates immediately
 */

// Staging area for vessels whose type is not yet known
// Key: MMSI, Value: partial vessel data from PositionReport
const vesselStagingArea: Map<string, Vessel> = new Map();

function processAISMessage(data: AISStreamMessage): void {
	if (!data.MetaData) return;

	const { MetaData, Message } = data;
	const mmsi = String(MetaData.MMSI);

	// Use pending vessels map for batched updates
	if (pendingVessels.size === 0) {
		// Initialize from store on first message
		pendingVessels = new Map(get(vesselStore));
	}
	const vessels = pendingVessels;

	// Check if this vessel is already in our confirmed display list
	const existingVessel = vessels.get(mmsi);

	// If vessel exists and has a confirmed strategic type, update it directly
	if (existingVessel && existingVessel.shipType !== undefined) {
		// Update position data
		existingVessel.lat = MetaData.latitude;
		existingVessel.lon = MetaData.longitude;
		existingVessel.name = MetaData.ShipName || existingVessel.name;
		existingVessel.lastUpdate = Date.now();

		if (Message?.PositionReport) {
			const pos = Message.PositionReport;
			existingVessel.course = pos.Cog ?? existingVessel.course;
			existingVessel.speed = pos.Sog ?? existingVessel.speed;
			existingVessel.heading = pos.TrueHeading !== 511 ? pos.TrueHeading : undefined;

			// Record track point
			recordTrackPoint(mmsi, MetaData.latitude, MetaData.longitude, pos.Sog, pos.Cog);
		}

		// Update static data if provided
		if (Message?.ShipStaticData) {
			const staticData = Message.ShipStaticData;
			existingVessel.imo = staticData.ImoNumber ? String(staticData.ImoNumber) : existingVessel.imo;
			existingVessel.callsign = staticData.CallSign || existingVessel.callsign;
			existingVessel.destination = staticData.Destination || existingVessel.destination;
			existingVessel.eta = staticData.Eta ? formatEta(staticData.Eta) : existingVessel.eta;
			existingVessel.draught = staticData.MaximumStaticDraught ?? existingVessel.draught;

			if (staticData.Dimension) {
				existingVessel.length = (staticData.Dimension.A || 0) + (staticData.Dimension.B || 0);
				existingVessel.width = (staticData.Dimension.C || 0) + (staticData.Dimension.D || 0);
			}
		}

		vessels.set(mmsi, existingVessel);
		scheduleStoreUpdate();
		return;
	}

	// Process ShipStaticData - this tells us the vessel type
	if (Message?.ShipStaticData) {
		const staticData = Message.ShipStaticData;

		// Check if this is a strategic vessel type
		if (staticData.Type !== undefined && !STRATEGIC_SHIP_TYPES.has(staticData.Type)) {
			// Not a strategic type - remove from staging area and don't add to display
			vesselStagingArea.delete(mmsi);
			return;
		}

		// Strategic vessel type confirmed! Create or update the vessel
		const stagedVessel = vesselStagingArea.get(mmsi);
		const vessel: Vessel = {
			mmsi,
			lat: MetaData.latitude,
			lon: MetaData.longitude,
			course: stagedVessel?.course ?? 0,
			speed: stagedVessel?.speed ?? 0,
			heading: stagedVessel?.heading,
			name: MetaData.ShipName || stagedVessel?.name,
			lastUpdate: Date.now(),
			imo: staticData.ImoNumber ? String(staticData.ImoNumber) : undefined,
			shipType: staticData.Type,
			shipTypeName: getShipTypeName(staticData.Type),
			callsign: staticData.CallSign,
			destination: staticData.Destination,
			eta: staticData.Eta ? formatEta(staticData.Eta) : undefined,
			draught: staticData.MaximumStaticDraught
		};

		if (staticData.Dimension) {
			vessel.length = (staticData.Dimension.A || 0) + (staticData.Dimension.B || 0);
			vessel.width = (staticData.Dimension.C || 0) + (staticData.Dimension.D || 0);
		}

		// Remove from staging, add to confirmed display
		vesselStagingArea.delete(mmsi);
		vessels.set(mmsi, vessel);

		// Limit stored vessels - remove oldest if exceeded
		if (vessels.size > MAX_VESSELS) {
			const sortedByTime = Array.from(vessels.entries())
				.sort((a, b) => a[1].lastUpdate - b[1].lastUpdate);

			const toRemove = sortedByTime.slice(0, vessels.size - MAX_VESSELS);
			toRemove.forEach(([key]) => vessels.delete(key));
		}

		scheduleStoreUpdate();
		return;
	}

	// PositionReport without ShipStaticData - stage the vessel data
	// Don't add to display yet until we confirm the type
	if (Message?.PositionReport) {
		const pos = Message.PositionReport;
		const stagedVessel = vesselStagingArea.get(mmsi) || {
			mmsi,
			lat: MetaData.latitude,
			lon: MetaData.longitude,
			course: 0,
			speed: 0,
			lastUpdate: Date.now()
		};

		stagedVessel.lat = MetaData.latitude;
		stagedVessel.lon = MetaData.longitude;
		stagedVessel.name = MetaData.ShipName || stagedVessel.name;
		stagedVessel.course = pos.Cog ?? stagedVessel.course;
		stagedVessel.speed = pos.Sog ?? stagedVessel.speed;
		stagedVessel.heading = pos.TrueHeading !== 511 ? pos.TrueHeading : stagedVessel.heading;
		stagedVessel.lastUpdate = Date.now();

		vesselStagingArea.set(mmsi, stagedVessel);

		// Clean up old staged vessels (older than 2 minutes) to prevent memory bloat
		const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
		for (const [key, v] of vesselStagingArea.entries()) {
			if (v.lastUpdate < twoMinutesAgo) {
				vesselStagingArea.delete(key);
			}
		}

		// Update staging area stats
		streamStats.update(s => ({ ...s, stagedVessels: vesselStagingArea.size }));
	}
}

/**
 * Format ETA from AIS format
 */
function formatEta(eta: { Month: number; Day: number; Hour: number; Minute: number }): string {
	const month = String(eta.Month).padStart(2, '0');
	const day = String(eta.Day).padStart(2, '0');
	const hour = String(eta.Hour).padStart(2, '0');
	const minute = String(eta.Minute).padStart(2, '0');
	return `${month}-${day} ${hour}:${minute}`;
}

/**
 * Get current vessel positions as array
 */
export function getVesselPositions(): Vessel[] {
	const vessels = get(vesselStore);
	return Array.from(vessels.values());
}

/**
 * Clear all vessel data and reset counters
 */
export function clearVesselData(): void {
	pendingVessels = new Map();
	vesselStagingArea.clear();
	updateScheduled = false;
	messageCount = 0;
	messagesInCurrentBatch = 0;
	vesselStore.set(new Map());
	vesselTracks.set(new Map());
	streamStats.set({
		totalMessages: 0,
		lastBatchSize: 0,
		lastUpdateTime: 0,
		stagedVessels: 0
	});
}

/**
 * Pause the vessel stream updates (doesn't disconnect, just stops UI updates)
 */
export function pauseVesselStream(): void {
	streamPaused.set(true);
}

/**
 * Resume the vessel stream updates
 */
export function resumeVesselStream(): void {
	streamPaused.set(false);
}

/**
 * Toggle pause state
 */
export function toggleVesselStreamPause(): void {
	streamPaused.update(paused => !paused);
}

/**
 * Set the UI update interval (in ms)
 * Valid range: 1000ms (1s) to 60000ms (60s)
 */
export function setUpdateInterval(intervalMs: number): void {
	streamUpdateInterval.set(Math.max(1000, Math.min(60000, intervalMs)));
}

/**
 * Available update interval options for the UI
 */
export const UPDATE_INTERVAL_OPTIONS = [
	{ label: '5s', value: 5000 },
	{ label: '10s', value: 10000 },
	{ label: '30s', value: 30000 },
	{ label: '60s', value: 60000 }
] as const;

/**
 * Search vessels by name, MMSI, or callsign
 */
export function searchVessels(query: string): Vessel[] {
	const vessels = get(vesselStore);
	const lowerQuery = query.toLowerCase().trim();
	if (!lowerQuery) return [];

	const results: Vessel[] = [];
	for (const vessel of vessels.values()) {
		const name = vessel.name?.toLowerCase() || '';
		const mmsi = vessel.mmsi.toLowerCase();
		const callsign = vessel.callsign?.toLowerCase() || '';
		const destination = vessel.destination?.toLowerCase() || '';

		if (name.includes(lowerQuery) || mmsi.includes(lowerQuery) ||
			callsign.includes(lowerQuery) || destination.includes(lowerQuery)) {
			results.push(vessel);
		}
	}
	return results.slice(0, 50); // Limit results
}

/**
 * Get track history for a specific vessel
 */
export function getVesselTrack(mmsi: string): VesselTrackPoint[] {
	const tracks = get(vesselTracks);
	return tracks.get(mmsi) || [];
}

/**
 * Record a track point for a vessel
 */
function recordTrackPoint(mmsi: string, lat: number, lon: number, speed?: number, course?: number): void {
	const isPaused = get(streamPaused);
	if (isPaused) return;

	vesselTracks.update(tracks => {
		const vesselTrack = tracks.get(mmsi) || [];
		const now = Date.now();

		// Only add point if vessel has moved significantly or time passed (>30s)
		const lastPoint = vesselTrack[vesselTrack.length - 1];
		if (lastPoint) {
			const timeDiff = now - lastPoint.timestamp;
			const latDiff = Math.abs(lat - lastPoint.lat);
			const lonDiff = Math.abs(lon - lastPoint.lon);

			// Skip if less than 30 seconds and minimal movement
			if (timeDiff < 30000 && latDiff < 0.001 && lonDiff < 0.001) {
				return tracks;
			}
		}

		vesselTrack.push({ lat, lon, timestamp: now, speed, course });

		// Limit track length
		if (vesselTrack.length > MAX_TRACK_POINTS) {
			vesselTrack.shift();
		}

		tracks.set(mmsi, vesselTrack);
		return tracks;
	});
}

// AIS Stream message types
interface AISStreamMessage {
	MessageType: string;
	MetaData: {
		MMSI: number;
		MMSI_String?: string;
		ShipName?: string;
		latitude: number;
		longitude: number;
		time_utc: string;
	};
	Message?: {
		PositionReport?: {
			Cog?: number;
			Sog?: number;
			TrueHeading?: number;
			NavigationalStatus?: number;
			PositionAccuracy?: boolean;
			Raim?: boolean;
			Timestamp?: number;
		};
		ShipStaticData?: {
			AisVersion?: number;
			CallSign?: string;
			Destination?: string;
			Dimension?: {
				A?: number;
				B?: number;
				C?: number;
				D?: number;
			};
			Dte?: boolean;
			Eta?: {
				Month: number;
				Day: number;
				Hour: number;
				Minute: number;
			};
			FixType?: number;
			ImoNumber?: number;
			MaximumStaticDraught?: number;
			Name?: string;
			Type?: number;
		};
	};
}
