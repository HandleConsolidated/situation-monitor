/**
 * Persistent API Cache Service
 *
 * Implements client-side caching for all API responses to reduce redundant API calls.
 * Uses localStorage for persistence across page loads with configurable TTL per data type.
 *
 * Features:
 * - Two-tier caching: Memory (L1) + localStorage (L2)
 * - Configurable TTL per API endpoint
 * - Stale-while-revalidate support
 * - Force refresh bypass
 * - Automatic cache invalidation on TTL expiry
 */

import { browser } from '$app/environment';

/**
 * TTL Configuration by data type (in milliseconds)
 *
 * Guidelines:
 * - Crypto prices: 1-2 minutes (volatile, real-time importance)
 * - Stock indices: 1-2 minutes (during market hours)
 * - News/RSS feeds: 5-10 minutes (semi-frequent updates)
 * - Earthquake data: 5 minutes (near real-time importance)
 * - Volcano data: 30 minutes (updates infrequently)
 * - Fed balance sheet: 1-4 hours (updates weekly)
 * - Layoffs data: 15-30 minutes (daily updates)
 * - Disease outbreaks: 30 minutes (periodic updates)
 * - Static reference data: 1 hour+
 */
export const API_CACHE_TTL = {
	// Market data - short TTL for real-time data
	crypto: 2 * 60 * 1000, // 2 minutes
	indices: 2 * 60 * 1000, // 2 minutes
	sectors: 2 * 60 * 1000, // 2 minutes
	commodities: 2 * 60 * 1000, // 2 minutes
	markets: 2 * 60 * 1000, // 2 minutes (all markets combined)

	// News data - medium TTL
	news: 5 * 60 * 1000, // 5 minutes
	newsCategory: 5 * 60 * 1000, // 5 minutes per category

	// Geopolitical/Intelligence data
	worldLeaders: 10 * 60 * 1000, // 10 minutes
	conflicts: 15 * 60 * 1000, // 15 minutes

	// Infrastructure data
	gridStress: 5 * 60 * 1000, // 5 minutes
	outages: 5 * 60 * 1000, // 5 minutes

	// Environmental data
	earthquakes: 5 * 60 * 1000, // 5 minutes (USGS updates frequently)
	volcanoes: 30 * 60 * 1000, // 30 minutes (updates infrequently)
	radiation: 15 * 60 * 1000, // 15 minutes
	airQuality: 15 * 60 * 1000, // 15 minutes
	diseaseOutbreaks: 30 * 60 * 1000, // 30 minutes

	// Alternative data
	polymarket: 5 * 60 * 1000, // 5 minutes
	whales: 5 * 60 * 1000, // 5 minutes
	contracts: 30 * 60 * 1000, // 30 minutes (updated daily)
	layoffs: 15 * 60 * 1000, // 15 minutes

	// Financial data
	fedBalance: 4 * 60 * 60 * 1000, // 4 hours (updates weekly)

	// Map data
	rainViewer: 5 * 60 * 1000, // 5 minutes
	aircraft: 30 * 1000, // 30 seconds (real-time tracking)
	vessels: 2 * 60 * 1000, // 2 minutes

	// Default fallback
	default: 5 * 60 * 1000 // 5 minutes
} as const;

export type ApiCacheKey = keyof typeof API_CACHE_TTL;

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

/**
 * Persistent API Cache Manager
 *
 * Provides a simple interface for caching API responses with automatic
 * TTL management and localStorage persistence.
 */
class PersistentApiCache {
	private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
	private readonly storagePrefix = 'sm_api_cache_';
	private readonly maxMemoryEntries = 100;
	private debugMode = false;

	constructor() {
		// Clean up expired entries on initialization
		if (browser) {
			this.cleanupExpiredEntries();
		}
	}

	/**
	 * Enable or disable debug logging
	 */
	setDebug(enabled: boolean): void {
		this.debugMode = enabled;
	}

	/**
	 * Get cached data if valid, or null if not cached or expired
	 */
	get<T>(key: string): T | null {
		// Check memory cache first (L1)
		const memEntry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
		if (memEntry && this.isValid(memEntry)) {
			this.log(`Cache HIT (memory): ${key}`);
			return memEntry.data;
		}

		// Check localStorage (L2)
		if (!browser) return null;

		try {
			const storageKey = this.getStorageKey(key);
			const stored = localStorage.getItem(storageKey);
			if (stored) {
				const entry = JSON.parse(stored) as CacheEntry<T>;
				if (this.isValid(entry)) {
					// Promote to memory cache
					this.memoryCache.set(key, entry);
					this.log(`Cache HIT (storage): ${key}`);
					return entry.data;
				} else {
					// Clean up expired entry
					localStorage.removeItem(storageKey);
				}
			}
		} catch (e) {
			this.log(`Storage read error: ${(e as Error).message}`);
		}

		this.log(`Cache MISS: ${key}`);
		return null;
	}

	/**
	 * Store data in cache with specified TTL
	 */
	set<T>(key: string, data: T, ttlKey: ApiCacheKey | number): void {
		const ttl = typeof ttlKey === 'number' ? ttlKey : API_CACHE_TTL[ttlKey];
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl
		};

		// Store in memory (L1)
		this.setMemory(key, entry);

		// Store in localStorage (L2)
		this.setStorage(key, entry);

		this.log(`Cache SET: ${key} (TTL: ${ttl / 1000}s)`);
	}

	/**
	 * Check if a key has valid cached data
	 */
	has(key: string): boolean {
		return this.get(key) !== null;
	}

	/**
	 * Get cached data age in milliseconds, or null if not cached
	 */
	getAge(key: string): number | null {
		// Check memory first
		const memEntry = this.memoryCache.get(key);
		if (memEntry) {
			return Date.now() - memEntry.timestamp;
		}

		// Check localStorage
		if (!browser) return null;

		try {
			const storageKey = this.getStorageKey(key);
			const stored = localStorage.getItem(storageKey);
			if (stored) {
				const entry = JSON.parse(stored) as CacheEntry<unknown>;
				return Date.now() - entry.timestamp;
			}
		} catch {
			// Ignore errors
		}

		return null;
	}

	/**
	 * Invalidate a specific cache entry
	 */
	invalidate(key: string): void {
		this.memoryCache.delete(key);

		if (browser) {
			try {
				localStorage.removeItem(this.getStorageKey(key));
			} catch {
				// Ignore errors
			}
		}

		this.log(`Cache INVALIDATE: ${key}`);
	}

	/**
	 * Invalidate all cache entries matching a pattern
	 */
	invalidatePattern(pattern: string): void {
		let count = 0;

		// Clear from memory
		for (const key of this.memoryCache.keys()) {
			if (key.includes(pattern)) {
				this.memoryCache.delete(key);
				count++;
			}
		}

		// Clear from storage
		if (browser) {
			try {
				for (let i = localStorage.length - 1; i >= 0; i--) {
					const key = localStorage.key(i);
					if (key?.startsWith(this.storagePrefix) && key.includes(pattern)) {
						localStorage.removeItem(key);
						count++;
					}
				}
			} catch {
				// Ignore errors
			}
		}

		this.log(`Cache INVALIDATE PATTERN: ${pattern} (${count} entries)`);
	}

	/**
	 * Clear all cached data
	 */
	clear(): void {
		this.memoryCache.clear();

		if (browser) {
			try {
				for (let i = localStorage.length - 1; i >= 0; i--) {
					const key = localStorage.key(i);
					if (key?.startsWith(this.storagePrefix)) {
						localStorage.removeItem(key);
					}
				}
			} catch {
				// Ignore errors
			}
		}

		this.log('Cache CLEARED');
	}

	/**
	 * Get cache statistics
	 */
	getStats(): { memoryEntries: number; storageEntries: number; storageSizeKB: number } {
		let storageCount = 0;
		let storageSize = 0;

		if (browser) {
			try {
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key?.startsWith(this.storagePrefix)) {
						storageCount++;
						storageSize += (localStorage.getItem(key) || '').length;
					}
				}
			} catch {
				// Ignore errors
			}
		}

		return {
			memoryEntries: this.memoryCache.size,
			storageEntries: storageCount,
			storageSizeKB: Math.round((storageSize / 1024) * 100) / 100
		};
	}

	// Private helpers

	private isValid(entry: CacheEntry<unknown>): boolean {
		return Date.now() < entry.timestamp + entry.ttl;
	}

	private getStorageKey(key: string): string {
		// Hash long keys to avoid localStorage key limits
		if (key.length > 50) {
			let hash = 0;
			for (let i = 0; i < key.length; i++) {
				const char = key.charCodeAt(i);
				hash = (hash << 5) - hash + char;
				hash = hash & hash;
			}
			return this.storagePrefix + Math.abs(hash).toString(36);
		}
		return this.storagePrefix + key;
	}

	private setMemory(key: string, entry: CacheEntry<unknown>): void {
		// LRU eviction if at capacity
		if (this.memoryCache.size >= this.maxMemoryEntries) {
			const firstKey = this.memoryCache.keys().next().value;
			if (firstKey) {
				this.memoryCache.delete(firstKey);
			}
		}
		this.memoryCache.set(key, entry);
	}

	private setStorage(key: string, entry: CacheEntry<unknown>): void {
		if (!browser) return;

		try {
			const storageKey = this.getStorageKey(key);
			localStorage.setItem(storageKey, JSON.stringify(entry));
		} catch (e) {
			if ((e as Error).name === 'QuotaExceededError') {
				this.pruneStorage();
				try {
					const storageKey = this.getStorageKey(key);
					localStorage.setItem(storageKey, JSON.stringify(entry));
				} catch {
					this.log('Storage quota exceeded, could not save');
				}
			}
		}
	}

	private pruneStorage(): void {
		if (!browser) return;

		try {
			const keys: Array<{ key: string; timestamp: number }> = [];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key?.startsWith(this.storagePrefix)) {
					const entry = JSON.parse(localStorage.getItem(key) || '') as CacheEntry<unknown>;
					keys.push({ key, timestamp: entry.timestamp });
				}
			}

			// Sort by timestamp (oldest first) and remove half
			keys.sort((a, b) => a.timestamp - b.timestamp);
			keys.slice(0, Math.ceil(keys.length / 2)).forEach((k) => localStorage.removeItem(k.key));
			this.log(`Pruned ${Math.ceil(keys.length / 2)} old cache entries`);
		} catch {
			// Ignore errors
		}
	}

	private cleanupExpiredEntries(): void {
		if (!browser) return;

		try {
			let count = 0;
			for (let i = localStorage.length - 1; i >= 0; i--) {
				const key = localStorage.key(i);
				if (key?.startsWith(this.storagePrefix)) {
					const stored = localStorage.getItem(key);
					if (stored) {
						const entry = JSON.parse(stored) as CacheEntry<unknown>;
						if (!this.isValid(entry)) {
							localStorage.removeItem(key);
							count++;
						}
					}
				}
			}
			if (count > 0) {
				this.log(`Cleaned up ${count} expired cache entries`);
			}
		} catch {
			// Ignore errors
		}
	}

	private log(message: string): void {
		if (this.debugMode) {
			console.log(`[ApiCache] ${message}`);
		}
	}
}

/**
 * Singleton instance of the API cache
 */
export const apiCache = new PersistentApiCache();

/**
 * Helper function to wrap an API call with caching
 *
 * @param key - Unique cache key for this API call
 * @param fetcher - Async function that fetches the data
 * @param ttlKey - TTL key from API_CACHE_TTL or a number in milliseconds
 * @param forceRefresh - If true, bypass cache and fetch fresh data
 * @returns The data (from cache or freshly fetched)
 */
export async function withCache<T>(
	key: string,
	fetcher: () => Promise<T>,
	ttlKey: ApiCacheKey | number = 'default',
	forceRefresh = false
): Promise<T> {
	// Check cache first (unless force refresh)
	if (!forceRefresh) {
		const cached = apiCache.get<T>(key);
		if (cached !== null) {
			return cached;
		}
	}

	// Fetch fresh data
	const data = await fetcher();

	// Cache the result
	apiCache.set(key, data, ttlKey);

	return data;
}

/**
 * Create a cached version of an API function
 *
 * @param key - Unique cache key for this API
 * @param fetcher - The original API function
 * @param ttlKey - TTL key from API_CACHE_TTL or a number in milliseconds
 * @returns A wrapped function that uses caching
 */
export function createCachedFetcher<TArgs extends unknown[], TResult>(
	key: string | ((...args: TArgs) => string),
	fetcher: (...args: TArgs) => Promise<TResult>,
	ttlKey: ApiCacheKey | number = 'default'
): (forceRefresh?: boolean, ...args: TArgs) => Promise<TResult> {
	return async (forceRefresh = false, ...args: TArgs): Promise<TResult> => {
		const cacheKey = typeof key === 'function' ? key(...args) : key;
		return withCache(cacheKey, () => fetcher(...args), ttlKey, forceRefresh);
	};
}
