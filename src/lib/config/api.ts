/**
 * API Configuration
 */

import { browser } from '$app/environment';

/**
 * Finnhub API key
 * Get your free key at: https://finnhub.io/
 * Free tier: 60 calls/minute
 */
export const FINNHUB_API_KEY = browser
	? (import.meta.env?.VITE_FINNHUB_API_KEY ?? '')
	: (process.env.VITE_FINNHUB_API_KEY ?? '');

export const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

/**
 * Check if we're in development mode
 * Uses import.meta.env which is available in both browser and test environments
 */
const isDev = browser ? (import.meta.env?.DEV ?? false) : false;

/**
 * CORS proxy URL for external API requests
 * Using custom Cloudflare Worker for reliable CORS handling
 * Format: https://bitter-sea-8577.ahandle.workers.dev/?url=encodedUrl
 */
export const CORS_PROXY_URL = 'https://bitter-sea-8577.ahandle.workers.dev/?url=';

// Legacy export for backward compatibility
export const CORS_PROXIES = {
	primary: CORS_PROXY_URL,
	fallback: CORS_PROXY_URL,
	allOrigins: CORS_PROXY_URL,
	corsfix: CORS_PROXY_URL
} as const;

/**
 * Fetch options for CORS proxy requests
 */
export interface FetchWithProxyOptions {
	headers?: Record<string, string>;
	maxRetries?: number;
	retryDelay?: number;
}

/**
 * Fetch with CORS proxy and retry logic
 * Uses api.cors.lol as the CORS proxy
 * Supports custom headers for authenticated APIs
 */
export async function fetchWithProxy(
	url: string,
	options: FetchWithProxyOptions = {}
): Promise<Response> {
	const { headers = {}, maxRetries = 3, retryDelay = 1000 } = options;
	// Cloudflare Worker expects URL to be encoded
	const proxyUrl = CORS_PROXY_URL + encodeURIComponent(url);

	let lastError: Error | null = null;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const response = await fetch(proxyUrl, {
				headers: {
					Accept: 'application/json',
					...headers
				},
				signal: AbortSignal.timeout(15000)
			});

			if (response.ok) {
				return response;
			}

			// Log non-OK responses
			logger.warn('API', `CORS proxy returned ${response.status} for ${url}, attempt ${attempt + 1}/${maxRetries}`);

			// Client errors (4xx) - likely won't succeed with retry
			if (response.status >= 400 && response.status < 500) {
				throw new Error(`HTTP ${response.status}`);
			}
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			logger.warn('API', `CORS proxy error (attempt ${attempt + 1}/${maxRetries}):`, lastError.message);
		}

		// Wait before retry (but not after last attempt)
		if (attempt < maxRetries - 1) {
			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	}

	// All attempts failed - throw the last error
	throw lastError || new Error(`CORS proxy failed for ${url}`);
}

/**
 * Fetch with custom headers directly (no proxy)
 * Useful for APIs that support CORS but need authentication
 */
export async function fetchWithHeaders(
	url: string,
	headers: Record<string, string> = {}
): Promise<Response> {
	return fetch(url, {
		headers: {
			Accept: 'application/json',
			...headers
		}
	});
}

/**
 * API request delays (ms) to avoid rate limiting
 */
export const API_DELAYS = {
	betweenCategories: 500,
	betweenRetries: 1000
} as const;

/**
 * Cache TTLs (ms)
 */
export const CACHE_TTLS = {
	weather: 10 * 60 * 1000, // 10 minutes
	news: 5 * 60 * 1000, // 5 minutes
	markets: 60 * 1000, // 1 minute
	default: 5 * 60 * 1000 // 5 minutes
} as const;

/**
 * Debug/logging configuration
 */
export const DEBUG = {
	enabled: isDev,
	logApiCalls: isDev,
	logCacheHits: false
} as const;

/**
 * Conditional logger - only logs in development
 */
export const logger = {
	log: (prefix: string, ...args: unknown[]) => {
		if (DEBUG.logApiCalls) {
			console.log(`[${prefix}]`, ...args);
		}
	},
	warn: (prefix: string, ...args: unknown[]) => {
		console.warn(`[${prefix}]`, ...args);
	},
	error: (prefix: string, ...args: unknown[]) => {
		console.error(`[${prefix}]`, ...args);
	}
};
