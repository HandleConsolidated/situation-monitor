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
 * CORS proxy URLs for external API requests
 * Multiple proxies for redundancy - tries each in order until one works
 * Primary: Custom Cloudflare Worker (faster, dedicated)
 * Fallbacks: Various public proxies (may rate limit or block certain traffic)
 */
export const CORS_PROXIES = {
	primary: 'https://situation-monitor-proxy.seanthielen-e.workers.dev/?url=',
	fallback: 'https://corsproxy.io/?url=',
	// Additional fallback proxies for better reliability
	allOrigins: 'https://api.allorigins.win/raw?url=',
	corsfix: 'https://proxy.cors.sh/'
} as const;

// Default export for backward compatibility
export const CORS_PROXY_URL = CORS_PROXIES.fallback;

/**
 * Fetch options for CORS proxy requests
 */
export interface FetchWithProxyOptions {
	headers?: Record<string, string>;
	maxRetries?: number;
	retryDelay?: number;
}

/**
 * Fetch with CORS proxy fallback and retry logic
 * Tries multiple proxies in order, with configurable retries
 * Supports custom headers for authenticated APIs
 */
export async function fetchWithProxy(
	url: string,
	options: FetchWithProxyOptions = {}
): Promise<Response> {
	const { headers = {}, maxRetries = 2, retryDelay = 1000 } = options;
	const encodedUrl = encodeURIComponent(url);

	// List of proxies to try in order
	const proxiesToTry = [
		{ name: 'primary', url: CORS_PROXIES.primary + encodedUrl },
		{ name: 'corsproxy', url: CORS_PROXIES.fallback + encodedUrl },
		{ name: 'allOrigins', url: CORS_PROXIES.allOrigins + encodedUrl }
	];

	let lastError: Error | null = null;

	for (const proxy of proxiesToTry) {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const response = await fetch(proxy.url, {
					headers: {
						Accept: 'application/json',
						...headers
					}
				});

				if (response.ok) {
					return response;
				}

				// Log non-OK responses but continue trying
				if (response.status >= 400 && response.status < 500) {
					// Client errors (4xx) - likely won't succeed with retry
					logger.warn('API', `${proxy.name} proxy returned ${response.status} for ${url}`);
					break; // Try next proxy
				}

				// Server errors (5xx) - might succeed with retry
				logger.warn('API', `${proxy.name} proxy returned ${response.status}, attempt ${attempt + 1}/${maxRetries}`);
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				logger.warn('API', `${proxy.name} proxy error (attempt ${attempt + 1}/${maxRetries}):`, lastError.message);
			}

			// Wait before retry (but not after last attempt)
			if (attempt < maxRetries - 1) {
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
			}
		}
	}

	// All proxies failed - throw the last error
	throw lastError || new Error(`All CORS proxies failed for ${url}`);
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
