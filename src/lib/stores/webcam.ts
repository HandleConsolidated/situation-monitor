/**
 * Webcam Store - State management for webcam windows
 * Supports multiple draggable windows with live webcam feeds
 */

import { writable, derived, get } from 'svelte/store';
import type { Webcam, WebcamWindowState, CountryClickData } from '$lib/types/webcam';
import { fetchWebcamsByCountry, getAllStrategicWebcams, type StrategicWebcam } from '$lib/api/webcam';
import { isoAlpha3ToAlpha2 } from '$lib/types/webcam';

// Generate unique ID for each window
function generateWindowId(): string {
	return `webcam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Store for all open webcam windows
function createWebcamWindowsStore() {
	const { subscribe, update, set } = writable<WebcamWindowState[]>([]);

	return {
		subscribe,

		/**
		 * Open a new webcam window for a country
		 */
		async openWindow(countryData: CountryClickData): Promise<string> {
			const windowId = generateWindowId();
			const iso2 = isoAlpha3ToAlpha2(countryData.iso3) || countryData.iso2;

			// Calculate initial position (staggered from last window)
			const existingWindows = get({ subscribe });
			const lastWindow = existingWindows[existingWindows.length - 1];
			const baseX = lastWindow ? lastWindow.position.x + 30 : 100;
			const baseY = lastWindow ? lastWindow.position.y + 30 : 100;

			// Ensure window stays within viewport
			const maxX = typeof window !== 'undefined' ? window.innerWidth - 400 : 800;
			const maxY = typeof window !== 'undefined' ? window.innerHeight - 350 : 600;

			const newWindow: WebcamWindowState = {
				id: windowId,
				countryCode: iso2,
				countryName: countryData.name,
				webcams: [],
				selectedWebcam: null,
				position: {
					x: Math.min(baseX, maxX),
					y: Math.min(baseY, maxY)
				},
				size: { width: 380, height: 320 },
				isMinimized: false,
				isLoading: true,
				error: null,
				lastFetch: Date.now()
			};

			// Add the window immediately (shows loading state)
			update((windows) => [...windows, newWindow]);

			// Fetch webcams asynchronously
			try {
				const webcams = await fetchWebcamsByCountry(iso2);

				update((windows) =>
					windows.map((w) =>
						w.id === windowId
							? {
									...w,
									webcams,
									selectedWebcam: webcams.length > 0 ? webcams[0] : null,
									isLoading: false,
									error: webcams.length === 0 ? 'No webcams available for this country' : null
								}
							: w
					)
				);
			} catch (error) {
				update((windows) =>
					windows.map((w) =>
						w.id === windowId
							? {
									...w,
									isLoading: false,
									error: 'Failed to load webcams. Please try again.'
								}
							: w
					)
				);
			}

			return windowId;
		},

		/**
		 * Close a webcam window
		 */
		closeWindow(windowId: string): void {
			update((windows) => windows.filter((w) => w.id !== windowId));
		},

		/**
		 * Close all webcam windows
		 */
		closeAllWindows(): void {
			set([]);
		},

		/**
		 * Update window position (during/after drag)
		 */
		updatePosition(windowId: string, position: { x: number; y: number }): void {
			update((windows) =>
				windows.map((w) => (w.id === windowId ? { ...w, position } : w))
			);
		},

		/**
		 * Update window size
		 */
		updateSize(windowId: string, size: { width: number; height: number }): void {
			update((windows) =>
				windows.map((w) => (w.id === windowId ? { ...w, size } : w))
			);
		},

		/**
		 * Toggle minimize state
		 */
		toggleMinimize(windowId: string): void {
			update((windows) =>
				windows.map((w) =>
					w.id === windowId ? { ...w, isMinimized: !w.isMinimized } : w
				)
			);
		},

		/**
		 * Select a webcam within a window
		 */
		selectWebcam(windowId: string, webcam: Webcam): void {
			update((windows) =>
				windows.map((w) =>
					w.id === windowId ? { ...w, selectedWebcam: webcam } : w
				)
			);
		},

		/**
		 * Bring window to front (highest z-index)
		 */
		bringToFront(windowId: string): void {
			update((windows) => {
				const targetWindow = windows.find((w) => w.id === windowId);
				if (!targetWindow) return windows;
				// Move window to end of array (highest z-index)
				return [...windows.filter((w) => w.id !== windowId), targetWindow];
			});
		},

		/**
		 * Refresh webcams for a window
		 */
		async refreshWebcams(windowId: string): Promise<void> {
			const windows = get({ subscribe });
			const targetWindow = windows.find((w) => w.id === windowId);
			if (!targetWindow) return;

			// Strategic webcams panel - just reload from the static list
			if (targetWindow.countryCode === 'STRATEGIC') {
				const strategicWebcams = getAllStrategicWebcams();
				update((windows) =>
					windows.map((w) =>
						w.id === windowId
							? {
									...w,
									webcams: strategicWebcams,
									selectedWebcam: strategicWebcams.length > 0 ? strategicWebcams[0] : null,
									isLoading: false,
									error: null,
									lastFetch: Date.now()
								}
							: w
					)
				);
				return;
			}

			update((windows) =>
				windows.map((w) =>
					w.id === windowId ? { ...w, isLoading: true, error: null } : w
				)
			);

			try {
				const webcams = await fetchWebcamsByCountry(targetWindow.countryCode);

				update((windows) =>
					windows.map((w) =>
						w.id === windowId
							? {
									...w,
									webcams,
									selectedWebcam: webcams.length > 0 ? webcams[0] : null,
									isLoading: false,
									error: webcams.length === 0 ? 'No webcams available' : null,
									lastFetch: Date.now()
								}
							: w
					)
				);
			} catch (error) {
				update((windows) =>
					windows.map((w) =>
						w.id === windowId
							? {
									...w,
									isLoading: false,
									error: 'Failed to refresh webcams'
								}
							: w
					)
				);
			}
		},

		/**
		 * Open a strategic webcam window directly (Live YouTube streams)
		 */
		openStrategicWebcam(webcam: StrategicWebcam): string {
			const windowId = generateWindowId();

			// Calculate initial position
			const existingWindows = get({ subscribe });
			const lastWindow = existingWindows[existingWindows.length - 1];
			const baseX = lastWindow ? lastWindow.position.x + 30 : 100;
			const baseY = lastWindow ? lastWindow.position.y + 30 : 100;

			// Ensure window stays within viewport
			const maxX = typeof window !== 'undefined' ? window.innerWidth - 400 : 800;
			const maxY = typeof window !== 'undefined' ? window.innerHeight - 350 : 600;

			const newWindow: WebcamWindowState = {
				id: windowId,
				countryCode: webcam.location.countryCode,
				countryName: `${webcam.location.city} (LIVE)`,
				webcams: [webcam],
				selectedWebcam: webcam,
				position: {
					x: Math.min(baseX, maxX),
					y: Math.min(baseY, maxY)
				},
				size: { width: 480, height: 360 }, // Slightly larger for live streams
				isMinimized: false,
				isLoading: false,
				error: null,
				lastFetch: Date.now()
			};

			update((windows) => [...windows, newWindow]);
			return windowId;
		},

		/**
		 * Open strategic webcams panel (shows all strategic webcams)
		 */
		openStrategicWebcamsPanel(): string {
			const windowId = generateWindowId();
			const strategicWebcams = getAllStrategicWebcams();

			const existingWindows = get({ subscribe });
			const lastWindow = existingWindows[existingWindows.length - 1];
			const baseX = lastWindow ? lastWindow.position.x + 30 : 100;
			const baseY = lastWindow ? lastWindow.position.y + 30 : 100;

			const maxX = typeof window !== 'undefined' ? window.innerWidth - 500 : 800;
			const maxY = typeof window !== 'undefined' ? window.innerHeight - 400 : 600;

			const newWindow: WebcamWindowState = {
				id: windowId,
				countryCode: 'STRATEGIC',
				countryName: 'Strategic Webcams (LIVE)',
				webcams: strategicWebcams,
				selectedWebcam: strategicWebcams.length > 0 ? strategicWebcams[0] : null,
				position: {
					x: Math.min(baseX, maxX),
					y: Math.min(baseY, maxY)
				},
				size: { width: 540, height: 400 },
				isMinimized: false,
				isLoading: false,
				error: null,
				lastFetch: Date.now()
			};

			update((windows) => [...windows, newWindow]);
			return windowId;
		}
	};
}

// Export the store
export const webcamWindows = createWebcamWindowsStore();

// Derived store for window count
export const webcamWindowCount = derived(webcamWindows, ($windows) => $windows.length);

// Derived store for checking if any windows are open
export const hasOpenWebcamWindows = derived(webcamWindows, ($windows) => $windows.length > 0);
