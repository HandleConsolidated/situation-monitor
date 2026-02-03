<script lang="ts">
	import { settings } from '$lib/stores';
	import MapboxGlobePanel from './MapboxGlobePanel.svelte';
	import MapLibreGlobePanel from './MapLibreGlobePanel.svelte';
	import type { CustomMonitor, NewsItem, NewsCategory, Aircraft, RadiationReading, DiseaseOutbreak, EarthquakeData } from '$lib/types';

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

	interface AircraftSnapshot {
		timestamp: number;
		aircraft: Aircraft[];
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

	// Get map provider from settings
	const mapProvider = $derived($settings.appSettings?.mapProvider || 'mapbox');
</script>

{#if mapProvider === 'maplibre'}
	<MapLibreGlobePanel
		{monitors}
		{news}
		{categorizedNews}
		{flyToTarget}
		{radiationReadings}
		{diseaseOutbreaks}
		{earthquakes}
		{onAircraftDataChange}
		{selectedAircraftTrack}
		{adsbEnabled}
		{selectedAircraftRegions}
		{onAdsbToggle}
	/>
{:else}
	<MapboxGlobePanel
		{monitors}
		{news}
		{categorizedNews}
		{flyToTarget}
		{radiationReadings}
		{diseaseOutbreaks}
		{earthquakes}
		{onAircraftDataChange}
		{selectedAircraftTrack}
		{adsbEnabled}
		{selectedAircraftRegions}
		{onAdsbToggle}
	/>
{/if}
