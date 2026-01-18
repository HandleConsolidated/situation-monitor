/**
 * AIS Stream WebSocket Service
 *
 * NOTE: aisstream.io does NOT support direct browser connections (CORS blocked).
 * Their documentation states: "Cross-origin resource sharing and thus connections
 * directly to aisstream.io from the browser are not supported."
 *
 * To use AIS Stream in a web app, you need a backend proxy server that:
 * 1. Connects to wss://stream.aisstream.io/v0/stream from the server
 * 2. Relays vessel data to your frontend via your own WebSocket
 *
 * This service is kept for reference and for potential backend/Electron usage.
 * For browser use, see vessel-fallback.ts for simulated vessel data.
 */

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import { getFallbackVessels } from './vessel-fallback';

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

// WebSocket connection
let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let fallbackInterval: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;
const FALLBACK_REFRESH_INTERVAL = 10000; // Refresh fallback data every 10 seconds
const MAX_VESSELS = 500; // Limit stored vessels for performance

/**
 * Load fallback vessel data for browser environments
 * Updates vessel positions with slight movement simulation
 */
function loadFallbackVessels(): void {
	// Clear any existing interval
	if (fallbackInterval) {
		clearInterval(fallbackInterval);
	}

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
 * Connect to AIS Stream WebSocket
 *
 * WARNING: This will fail in browsers due to CORS restrictions.
 * AIS Stream explicitly blocks browser connections to protect API keys.
 * For browser apps, you need a backend proxy server.
 */
export function connectVesselStream(): void {
	if (!browser) return;

	// AIS Stream blocks browser connections via CORS
	// Use fallback data instead for browser environments
	const isBrowserEnvironment = typeof window !== 'undefined';
	if (isBrowserEnvironment) {
		console.log('AIS Stream: Using fallback vessel data (browser CORS restriction)');
		loadFallbackVessels();
		return;
	}

	const apiKey = getApiKey();
	if (!apiKey) {
		vesselConnectionStatus.set('no_api_key');
		vesselError.set('No AIS Stream API key configured. Get a free key at https://aisstream.io');
		console.warn('Vessel tracking disabled: No VITE_AISSTREAM_API_KEY configured');
		console.warn('Get a free API key at https://aisstream.io and add VITE_AISSTREAM_API_KEY to your .env file');
		return;
	}

	if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
		return; // Already connected or connecting
	}

	vesselConnectionStatus.set('connecting');
	vesselError.set(null);

	try {
		ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

		ws.onopen = () => {
			console.log('AIS Stream WebSocket connected');
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

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				processAISMessage(data);
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

			if (event.code === 1006) {
				// Abnormal closure - usually auth failure or network issue
				const currentKey = getApiKey();
				if (currentKey === 'your_aisstream_api_key' || currentKey.length < 20) {
					errorMessage = 'Invalid API key. Get a free key at https://aisstream.io and set VITE_AISSTREAM_API_KEY';
					vesselConnectionStatus.set('no_api_key');
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
				// Not a normal close
				vesselConnectionStatus.set('disconnected');
				attemptReconnect();
				return; // Don't set error, will retry
			}

			// Don't reconnect for auth errors
			if (event.code === 1006 || event.code === 1008) {
				return;
			}
		};
	} catch (error) {
		console.error('Failed to create WebSocket:', error);
		vesselConnectionStatus.set('error');
		vesselError.set('Failed to create WebSocket connection');
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
 */
function processAISMessage(data: AISStreamMessage): void {
	if (!data.MetaData) return;

	const { MetaData, Message } = data;
	const mmsi = String(MetaData.MMSI);

	// Get current vessels
	const vessels = get(vesselStore);

	// Get or create vessel entry
	let vessel = vessels.get(mmsi) || {
		mmsi,
		lat: MetaData.latitude,
		lon: MetaData.longitude,
		course: 0,
		speed: 0,
		lastUpdate: Date.now()
	};

	// Update with metadata
	vessel.lat = MetaData.latitude;
	vessel.lon = MetaData.longitude;
	vessel.name = MetaData.ShipName || vessel.name;
	vessel.lastUpdate = Date.now();

	// Process position report
	if (Message?.PositionReport) {
		const pos = Message.PositionReport;
		vessel.course = pos.Cog ?? vessel.course;
		vessel.speed = pos.Sog ?? vessel.speed;
		vessel.heading = pos.TrueHeading !== 511 ? pos.TrueHeading : undefined;
	}

	// Process ship static data
	if (Message?.ShipStaticData) {
		const staticData = Message.ShipStaticData;
		vessel.imo = staticData.ImoNumber ? String(staticData.ImoNumber) : undefined;
		vessel.shipType = staticData.Type;
		vessel.shipTypeName = getShipTypeName(staticData.Type);
		vessel.callsign = staticData.CallSign;
		vessel.destination = staticData.Destination;
		vessel.eta = staticData.Eta ? formatEta(staticData.Eta) : undefined;
		vessel.draught = staticData.MaximumStaticDraught;

		if (staticData.Dimension) {
			vessel.length = (staticData.Dimension.A || 0) + (staticData.Dimension.B || 0);
			vessel.width = (staticData.Dimension.C || 0) + (staticData.Dimension.D || 0);
		}
	}

	// Update store
	vessels.set(mmsi, vessel);

	// Limit stored vessels - remove oldest if exceeded
	if (vessels.size > MAX_VESSELS) {
		const sortedByTime = Array.from(vessels.entries())
			.sort((a, b) => a[1].lastUpdate - b[1].lastUpdate);

		const toRemove = sortedByTime.slice(0, vessels.size - MAX_VESSELS);
		toRemove.forEach(([key]) => vessels.delete(key));
	}

	vesselStore.set(vessels);
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
 * Clear all vessel data
 */
export function clearVesselData(): void {
	vesselStore.set(new Map());
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
