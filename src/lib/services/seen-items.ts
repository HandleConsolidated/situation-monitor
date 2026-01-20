/**
 * Seen Items Tracker Service
 *
 * Tracks which news items a user has already seen across sessions.
 * This is separate from the API cache - API cache stores data,
 * while this tracks user viewing state.
 *
 * Features:
 * - Persistent localStorage storage for seen item IDs
 * - Automatic pruning of old entries to prevent unlimited growth
 * - Per-category tracking for efficient lookups
 * - Grace period for new items (items seen within session stay "new" briefly)
 */

import { browser } from '$app/environment';

/**
 * Configuration
 */
const STORAGE_KEY = 'sm_seen_items';
const MAX_ITEMS_PER_CATEGORY = 500; // Keep last 500 items per category
const PRUNE_THRESHOLD = 600; // Prune when exceeding this count
const NEW_ITEM_GRACE_PERIOD = 60 * 1000; // 60 seconds grace period for "new" items
const FIRST_LOAD_GRACE_PERIOD = 5 * 1000; // 5 seconds to mark initial items as seen

interface SeenItemsData {
	// Map of category -> array of { id, seenAt } entries
	categories: Record<string, Array<{ id: string; seenAt: number }>>;
	// Track session start to handle first-load scenario
	sessionStart: number;
	// Track if this is the first load of the session
	firstLoadComplete: boolean;
}

/**
 * Seen Items Tracker
 *
 * Provides methods to track and query which items a user has seen.
 */
class SeenItemsTracker {
	private data: SeenItemsData;
	private sessionSeenItems: Map<string, number> = new Map(); // Items seen this session (for grace period)
	private initialized = false;
	private debugMode = false;

	constructor() {
		this.data = this.createEmptyData();
	}

	/**
	 * Initialize the tracker - must be called on app startup
	 */
	init(): void {
		if (this.initialized) return;

		this.loadFromStorage();
		this.initialized = true;

		// Mark that we're in a new session
		this.data.sessionStart = Date.now();
		this.data.firstLoadComplete = false;

		// After a short delay, mark first load as complete
		// This prevents ALL items from showing as "new" on initial page load
		if (browser) {
			setTimeout(() => {
				this.data.firstLoadComplete = true;
				this.saveToStorage();
				this.log('First load complete, new items will now be tracked');
			}, FIRST_LOAD_GRACE_PERIOD);
		}
	}

	/**
	 * Enable or disable debug logging
	 */
	setDebug(enabled: boolean): void {
		this.debugMode = enabled;
	}

	/**
	 * Check if an item has been seen
	 * @param category - The news category
	 * @param itemId - The unique item ID
	 * @returns true if the item has been seen before
	 */
	hasSeen(category: string, itemId: string): boolean {
		// During first load, consider all items as "seen" to prevent flash of "NEW" badges
		if (!this.data.firstLoadComplete) {
			return true;
		}

		// Check if seen in storage
		const categoryItems = this.data.categories[category] || [];
		return categoryItems.some((entry) => entry.id === itemId);
	}

	/**
	 * Check if an item should show the NEW indicator
	 * This accounts for the grace period where newly-seen items stay "new"
	 * @param category - The news category
	 * @param itemId - The unique item ID
	 * @param fetchedAt - When the item was fetched (for session-based check)
	 * @returns true if the item should show as NEW
	 */
	isNew(category: string, itemId: string, fetchedAt?: number): boolean {
		// During first load, nothing is "new"
		if (!this.data.firstLoadComplete) {
			return false;
		}

		// If we haven't seen it before, it's new
		if (!this.hasSeen(category, itemId)) {
			return true;
		}

		// Check if within the grace period (just marked as seen)
		const sessionSeenKey = `${category}:${itemId}`;
		const seenAt = this.sessionSeenItems.get(sessionSeenKey);
		if (seenAt && Date.now() - seenAt < NEW_ITEM_GRACE_PERIOD) {
			return true;
		}

		// Also check fetchedAt for items fetched this session
		if (fetchedAt && Date.now() - fetchedAt < NEW_ITEM_GRACE_PERIOD) {
			// But only if we just marked it as seen this session
			if (seenAt) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Mark an item as seen
	 * @param category - The news category
	 * @param itemId - The unique item ID
	 */
	markSeen(category: string, itemId: string): void {
		if (!browser) return;

		const now = Date.now();

		// Initialize category if needed
		if (!this.data.categories[category]) {
			this.data.categories[category] = [];
		}

		// Check if already seen
		const categoryItems = this.data.categories[category];
		const existingIndex = categoryItems.findIndex((entry) => entry.id === itemId);

		if (existingIndex === -1) {
			// Add new entry
			categoryItems.push({ id: itemId, seenAt: now });

			// Track in session for grace period
			const sessionKey = `${category}:${itemId}`;
			this.sessionSeenItems.set(sessionKey, now);

			this.log(`Marked as seen: ${category}/${itemId.substring(0, 20)}...`);

			// Prune if needed
			if (categoryItems.length > PRUNE_THRESHOLD) {
				this.pruneCategory(category);
			}

			// Save to storage (debounced)
			this.debouncedSave();
		}
	}

	/**
	 * Mark multiple items as seen at once
	 * @param category - The news category
	 * @param itemIds - Array of item IDs to mark as seen
	 */
	markManySeen(category: string, itemIds: string[]): void {
		if (!browser || itemIds.length === 0) return;

		const now = Date.now();

		// Initialize category if needed
		if (!this.data.categories[category]) {
			this.data.categories[category] = [];
		}

		const categoryItems = this.data.categories[category];
		const existingIds = new Set(categoryItems.map((e) => e.id));
		let addedCount = 0;

		for (const itemId of itemIds) {
			if (!existingIds.has(itemId)) {
				categoryItems.push({ id: itemId, seenAt: now });
				existingIds.add(itemId);

				// Track in session for grace period
				const sessionKey = `${category}:${itemId}`;
				this.sessionSeenItems.set(sessionKey, now);
				addedCount++;
			}
		}

		if (addedCount > 0) {
			this.log(`Marked ${addedCount} items as seen in ${category}`);

			// Prune if needed
			if (categoryItems.length > PRUNE_THRESHOLD) {
				this.pruneCategory(category);
			}

			// Save to storage
			this.debouncedSave();
		}
	}

	/**
	 * Get the count of new (unseen) items for a category
	 * @param category - The news category
	 * @param itemIds - Array of item IDs to check
	 * @returns Count of unseen items
	 */
	getNewCount(category: string, itemIds: string[]): number {
		if (!this.data.firstLoadComplete) {
			return 0;
		}

		const categoryItems = this.data.categories[category] || [];
		const seenIds = new Set(categoryItems.map((e) => e.id));

		return itemIds.filter((id) => !seenIds.has(id)).length;
	}

	/**
	 * Clear all seen items (e.g., for testing or user reset)
	 */
	clear(): void {
		this.data = this.createEmptyData();
		this.sessionSeenItems.clear();

		if (browser) {
			try {
				localStorage.removeItem(STORAGE_KEY);
			} catch {
				// Ignore errors
			}
		}

		this.log('Cleared all seen items');
	}

	/**
	 * Clear seen items for a specific category
	 */
	clearCategory(category: string): void {
		delete this.data.categories[category];

		// Clear session items for this category
		const keysToDelete: string[] = [];
		this.sessionSeenItems.forEach((_, key) => {
			if (key.startsWith(`${category}:`)) {
				keysToDelete.push(key);
			}
		});
		keysToDelete.forEach((key) => this.sessionSeenItems.delete(key));

		this.saveToStorage();
		this.log(`Cleared seen items for category: ${category}`);
	}

	/**
	 * Get statistics about seen items
	 */
	getStats(): { totalItems: number; categoryCounts: Record<string, number> } {
		const categoryCounts: Record<string, number> = {};
		let totalItems = 0;

		for (const [category, items] of Object.entries(this.data.categories)) {
			categoryCounts[category] = items.length;
			totalItems += items.length;
		}

		return { totalItems, categoryCounts };
	}

	// Private methods

	private createEmptyData(): SeenItemsData {
		return {
			categories: {},
			sessionStart: Date.now(),
			firstLoadComplete: false
		};
	}

	private loadFromStorage(): void {
		if (!browser) return;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as SeenItemsData;
				// Validate structure
				if (parsed.categories && typeof parsed.categories === 'object') {
					this.data = {
						categories: parsed.categories,
						sessionStart: Date.now(),
						firstLoadComplete: false
					};
					this.log(`Loaded ${this.getStats().totalItems} seen items from storage`);
				}
			}
		} catch (e) {
			this.log(`Error loading seen items: ${(e as Error).message}`);
		}
	}

	private saveToStorage(): void {
		if (!browser) return;

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
		} catch (e) {
			if ((e as Error).name === 'QuotaExceededError') {
				// Prune all categories aggressively
				for (const category of Object.keys(this.data.categories)) {
					this.pruneCategory(category, MAX_ITEMS_PER_CATEGORY / 2);
				}
				// Try again
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
				} catch {
					this.log('Storage quota exceeded, could not save seen items');
				}
			}
		}
	}

	private saveTimeout: ReturnType<typeof setTimeout> | null = null;

	private debouncedSave(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}
		this.saveTimeout = setTimeout(() => {
			this.saveToStorage();
			this.saveTimeout = null;
		}, 1000);
	}

	private pruneCategory(category: string, maxItems: number = MAX_ITEMS_PER_CATEGORY): void {
		const categoryItems = this.data.categories[category];
		if (!categoryItems || categoryItems.length <= maxItems) return;

		// Sort by seenAt (oldest first) and keep the newest
		categoryItems.sort((a, b) => b.seenAt - a.seenAt);
		this.data.categories[category] = categoryItems.slice(0, maxItems);

		this.log(`Pruned ${category} from ${categoryItems.length} to ${maxItems} items`);
	}

	private log(message: string): void {
		if (this.debugMode) {
			console.log(`[SeenItems] ${message}`);
		}
	}
}

/**
 * Singleton instance of the seen items tracker
 */
export const seenItems = new SeenItemsTracker();
