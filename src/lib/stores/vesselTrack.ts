/**
 * Vessel Track Store
 *
 * Stores the currently selected vessel and its track for display on the map.
 * Used to communicate between MaritimeIntelPanel and MapLibreGlobePanel.
 */

import { writable, derived } from 'svelte/store';
import type { Vessel, VesselTrackPoint } from '$lib/services/vessel-stream';

export interface SelectedVesselTrack {
	vessel: Vessel | null;
	track: VesselTrackPoint[];
}

/**
 * Store for the currently selected vessel and its track history
 */
export const selectedVesselTrack = writable<SelectedVesselTrack>({
	vessel: null,
	track: []
});

/**
 * Derived store: whether a vessel track is currently selected
 */
export const hasSelectedTrack = derived(
	selectedVesselTrack,
	($track) => $track.vessel !== null && $track.track.length > 1
);

/**
 * Derived store: track point count
 */
export const trackPointCount = derived(selectedVesselTrack, ($track) => $track.track.length);

/**
 * Set the selected vessel and its track
 */
export function setSelectedVesselTrack(vessel: Vessel | null, track: VesselTrackPoint[]): void {
	selectedVesselTrack.set({ vessel, track });
}

/**
 * Clear the selected vessel track
 */
export function clearSelectedVesselTrack(): void {
	selectedVesselTrack.set({ vessel: null, track: [] });
}
