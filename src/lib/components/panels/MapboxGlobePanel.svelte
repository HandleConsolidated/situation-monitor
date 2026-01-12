<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import {
		HOTSPOTS,
		CHOKEPOINTS,
		CABLE_LANDINGS,
		NUCLEAR_SITES,
		MILITARY_BASES,
		THREAT_COLORS
	} from '$lib/config/map';
	import type { CustomMonitor } from '$lib/types';

	interface Props {
		monitors?: CustomMonitor[];
	}

	let { monitors = [] }: Props = $props();

	// Mapbox access token - checks environment variable first, falls back to demo token
	// For production: set VITE_MAPBOX_TOKEN in .env file
	const MAPBOX_TOKEN =
		(typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAPBOX_TOKEN) ||
		'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	let isInitialized = $state(false);
	let initError = $state<string | null>(null);
	let showArcs = $state(true);
	let legendExpanded = $state(true);

	// Interaction state
	let tooltipLocked = $state(false);
	let isRotating = $state(true);
	let rotationAnimationId: number | null = null;

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipData = $state<{
		label: string;
		type: string;
		desc?: string;
		level?: string;
	} | null>(null);

	// Generate GeoJSON for all points
	function getPointsGeoJSON(): GeoJSON.FeatureCollection {
		const features: GeoJSON.Feature[] = [];

		// Add hotspots
		HOTSPOTS.forEach((h) => {
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
				properties: {
					label: h.name,
					type: 'hotspot',
					desc: h.desc,
					level: h.level,
					color: THREAT_COLORS[h.level],
					size: h.level === 'critical' ? 12 : h.level === 'high' ? 10 : 8
				}
			});
		});

		// Add chokepoints
		CHOKEPOINTS.forEach((cp) => {
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [cp.lon, cp.lat] },
				properties: {
					label: cp.name,
					type: 'chokepoint',
					desc: cp.desc,
					color: '#06b6d4',
					size: 7
				}
			});
		});

		// Add cable landings
		CABLE_LANDINGS.forEach((cl) => {
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [cl.lon, cl.lat] },
				properties: {
					label: cl.name,
					type: 'cable',
					desc: cl.desc,
					color: '#a855f7',
					size: 6
				}
			});
		});

		// Add nuclear sites
		NUCLEAR_SITES.forEach((ns) => {
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [ns.lon, ns.lat] },
				properties: {
					label: ns.name,
					type: 'nuclear',
					desc: ns.desc,
					color: '#f59e0b',
					size: 8
				}
			});
		});

		// Add military bases
		MILITARY_BASES.forEach((mb) => {
			features.push({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [mb.lon, mb.lat] },
				properties: {
					label: mb.name,
					type: 'military',
					desc: mb.desc,
					color: '#ec4899',
					size: 8
				}
			});
		});

		// Add custom monitors
		monitors
			.filter((m) => m.enabled && m.location)
			.forEach((m) => {
				if (m.location) {
					features.push({
						type: 'Feature',
						geometry: { type: 'Point', coordinates: [m.location.lon, m.location.lat] },
						properties: {
							label: m.name,
							type: 'monitor',
							desc: `Custom monitor: ${m.keywords?.join(', ') || 'No keywords'}`,
							color: m.color || '#06b6d4',
							size: 9
						}
					});
				}
			});

		return { type: 'FeatureCollection', features };
	}

	// Generate arc data for tension corridors
	function getArcsGeoJSON(): GeoJSON.FeatureCollection {
		if (!showArcs) return { type: 'FeatureCollection', features: [] };

		const arcConnections = [
			{ from: 'Moscow', to: 'Kyiv', color: 'rgba(239, 68, 68, 0.7)' },
			{ from: 'Tehran', to: 'Tel Aviv', color: 'rgba(239, 68, 68, 0.8)' },
			{ from: 'Beijing', to: 'Taipei', color: 'rgba(251, 191, 36, 0.7)' },
			{ from: 'Pyongyang', to: 'Tokyo', color: 'rgba(251, 191, 36, 0.7)' }
		];

		const hotspotMap = new Map(HOTSPOTS.map((h) => [h.name, h]));
		const features: GeoJSON.Feature[] = [];

		arcConnections.forEach((conn, index) => {
			const from = hotspotMap.get(conn.from);
			const to = hotspotMap.get(conn.to);
			if (from && to) {
				// Create a curved arc using intermediate points
				const coords = generateArcCoordinates(
					[from.lon, from.lat],
					[to.lon, to.lat],
					20 // number of segments
				);
				features.push({
					type: 'Feature',
					geometry: { type: 'LineString', coordinates: coords },
					properties: {
						color: conn.color,
						from: conn.from,
						to: conn.to,
						id: index
					}
				});
			}
		});

		return { type: 'FeatureCollection', features };
	}

	// Generate curved arc coordinates (great circle approximation)
	function generateArcCoordinates(
		start: [number, number],
		end: [number, number],
		segments: number
	): [number, number][] {
		const coords: [number, number][] = [];

		for (let i = 0; i <= segments; i++) {
			const t = i / segments;
			// Simple interpolation with altitude bump for arc effect
			const lng = start[0] + (end[0] - start[0]) * t;
			const lat = start[1] + (end[1] - start[1]) * t;
			coords.push([lng, lat]);
		}

		return coords;
	}

	// Get pulsing rings data (critical hotspots only)
	function getPulsingRingsGeoJSON(): GeoJSON.FeatureCollection {
		const features: GeoJSON.Feature[] = HOTSPOTS.filter((h) => h.level === 'critical').map((h) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
			properties: {
				label: h.name,
				color: THREAT_COLORS[h.level]
			}
		}));

		return { type: 'FeatureCollection', features };
	}

	// Get labels for critical/high hotspots
	function getLabelsGeoJSON(): GeoJSON.FeatureCollection {
		const features: GeoJSON.Feature[] = HOTSPOTS.filter(
			(h) => h.level === 'critical' || h.level === 'high'
		).map((h) => ({
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
			properties: {
				label: h.name,
				color: THREAT_COLORS[h.level],
				level: h.level
			}
		}));

		return { type: 'FeatureCollection', features };
	}

	function getTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			hotspot: 'GEOPOLITICAL HOTSPOT',
			chokepoint: 'SHIPPING CHOKEPOINT',
			cable: 'UNDERSEA CABLE',
			nuclear: 'NUCLEAR SITE',
			military: 'MILITARY BASE',
			monitor: 'CUSTOM MONITOR'
		};
		return labels[type] || type.toUpperCase();
	}

	// Auto-rotation logic
	function startRotation() {
		if (!map || !isRotating) return;

		const rotate = () => {
			if (!map || !isRotating) return;

			const center = map.getCenter();
			// Rotate by a small amount each frame
			map.setCenter([center.lng + 0.05, center.lat]);
			rotationAnimationId = requestAnimationFrame(rotate);
		};

		rotationAnimationId = requestAnimationFrame(rotate);
	}

	function stopRotation() {
		if (rotationAnimationId) {
			cancelAnimationFrame(rotationAnimationId);
			rotationAnimationId = null;
		}
	}

	function pauseRotation() {
		isRotating = false;
		stopRotation();
	}

	function resumeRotation() {
		isRotating = true;
		startRotation();
	}

	function toggleArcs() {
		showArcs = !showArcs;
		if (map && isInitialized) {
			const source = map.getSource('arcs') as mapboxgl.GeoJSONSource;
			if (source) {
				source.setData(getArcsGeoJSON());
			}
		}
	}

	// Initialize Mapbox map with globe projection
	async function initMap() {
		if (typeof window === 'undefined' || !mapContainer) return;

		const width = mapContainer.clientWidth;
		const height = mapContainer.clientHeight;

		if (width === 0 || height === 0) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			return initMap();
		}

		try {
			mapboxgl.accessToken = MAPBOX_TOKEN;

			map = new mapboxgl.Map({
				container: mapContainer,
				style: {
					version: 8,
					name: 'Dark Globe',
					sources: {
						'satellite-imagery': {
							type: 'raster',
							tiles: [
								'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=' +
									MAPBOX_TOKEN
							],
							tileSize: 256
						}
					},
					layers: [
						{
							id: 'background',
							type: 'background',
							paint: {
								'background-color': '#020305'
							}
						},
						{
							id: 'satellite',
							type: 'raster',
							source: 'satellite-imagery',
							paint: {
								'raster-brightness-max': 0.4,
								'raster-brightness-min': 0.0,
								'raster-saturation': -0.3,
								'raster-contrast': 0.2
							}
						}
					],
					glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf'
				},
				center: [10, 25],
				zoom: 1.5,
				projection: 'globe',
				attributionControl: false,
				logoPosition: 'bottom-right'
			});

			// Set atmosphere/fog for 3D globe effect
			map.on('style.load', () => {
				if (!map) return;

				// Add atmosphere
				map.setFog({
					color: 'rgb(6, 182, 212)',
					'high-color': 'rgb(2, 6, 23)',
					'horizon-blend': 0.02,
					'space-color': 'rgb(2, 3, 5)',
					'star-intensity': 0.6
				});

				// Add data sources
				map.addSource('points', {
					type: 'geojson',
					data: getPointsGeoJSON()
				});

				map.addSource('arcs', {
					type: 'geojson',
					data: getArcsGeoJSON()
				});

				map.addSource('pulsing-rings', {
					type: 'geojson',
					data: getPulsingRingsGeoJSON()
				});

				map.addSource('labels', {
					type: 'geojson',
					data: getLabelsGeoJSON()
				});

				// Add arcs layer (tension corridors)
				map.addLayer({
					id: 'arcs-layer',
					type: 'line',
					source: 'arcs',
					paint: {
						'line-color': ['get', 'color'],
						'line-width': 2,
						'line-opacity': 0.8,
						'line-dasharray': [2, 2]
					}
				});

				// Add pulsing rings layer (outer ring)
				map.addLayer({
					id: 'pulsing-rings-outer',
					type: 'circle',
					source: 'pulsing-rings',
					paint: {
						'circle-radius': 20,
						'circle-color': 'transparent',
						'circle-stroke-color': '#ff0000',
						'circle-stroke-width': 2,
						'circle-stroke-opacity': 0.3
					}
				});

				// Add pulsing rings layer (inner)
				map.addLayer({
					id: 'pulsing-rings-inner',
					type: 'circle',
					source: 'pulsing-rings',
					paint: {
						'circle-radius': 12,
						'circle-color': 'transparent',
						'circle-stroke-color': '#ff0000',
						'circle-stroke-width': 1.5,
						'circle-stroke-opacity': 0.5
					}
				});

				// Add glow layer for points
				map.addLayer({
					id: 'points-glow',
					type: 'circle',
					source: 'points',
					paint: {
						'circle-radius': ['*', ['get', 'size'], 1.5],
						'circle-color': ['get', 'color'],
						'circle-opacity': 0.3,
						'circle-blur': 1
					}
				});

				// Add main points layer
				map.addLayer({
					id: 'points-layer',
					type: 'circle',
					source: 'points',
					paint: {
						'circle-radius': ['get', 'size'],
						'circle-color': ['get', 'color'],
						'circle-stroke-color': '#ffffff',
						'circle-stroke-width': 1,
						'circle-stroke-opacity': 0.5
					}
				});

				// Add labels layer
				map.addLayer({
					id: 'labels-layer',
					type: 'symbol',
					source: 'labels',
					layout: {
						'text-field': ['get', 'label'],
						'text-size': 10,
						'text-offset': [0, 1.5],
						'text-anchor': 'top',
						'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular']
					},
					paint: {
						'text-color': ['get', 'color'],
						'text-halo-color': 'rgba(0, 0, 0, 0.8)',
						'text-halo-width': 1
					}
				});

				// Add interactivity
				setupInteractivity();

				// Start auto-rotation
				startRotation();

				isInitialized = true;
			});

			// Pause rotation on user interaction
			map.on('mousedown', () => {
				pauseRotation();
			});

			map.on('touchstart', () => {
				pauseRotation();
			});

			map.on('wheel', () => {
				pauseRotation();
			});
		} catch (error) {
			console.error('Failed to initialize map:', error);
			initError = 'Failed to load 3D globe. WebGL may not be supported.';
		}
	}

	function setupInteractivity() {
		if (!map) return;

		// Cursor changes
		map.on('mouseenter', 'points-layer', () => {
			if (map) map.getCanvas().style.cursor = 'pointer';
		});

		map.on('mouseleave', 'points-layer', () => {
			if (map) map.getCanvas().style.cursor = '';
		});

		// Hover tooltip
		map.on('mousemove', 'points-layer', (e) => {
			if (!e.features || e.features.length === 0) return;
			if (tooltipLocked) return;

			const feature = e.features[0];
			const props = feature.properties;

			tooltipData = {
				label: props?.label || '',
				type: props?.type || '',
				desc: props?.desc,
				level: props?.level
			};
			tooltipVisible = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		map.on('mouseleave', 'points-layer', () => {
			if (!tooltipLocked) {
				tooltipVisible = false;
				tooltipData = null;
				// Resume rotation after delay
				setTimeout(() => {
					if (!tooltipLocked) {
						resumeRotation();
					}
				}, 2000);
			}
		});

		// Click to lock tooltip
		map.on('click', 'points-layer', (e) => {
			if (!e.features || e.features.length === 0) return;

			const feature = e.features[0];
			const props = feature.properties;

			tooltipData = {
				label: props?.label || '',
				type: props?.type || '',
				desc: props?.desc,
				level: props?.level
			};
			tooltipVisible = true;
			tooltipLocked = true;
			updateTooltipPosition(e.point);
			pauseRotation();
		});

		// Click anywhere else to unlock
		map.on('click', (e) => {
			const features = map?.queryRenderedFeatures(e.point, { layers: ['points-layer'] });
			if (!features || features.length === 0) {
				if (tooltipLocked) {
					tooltipLocked = false;
					tooltipVisible = false;
					tooltipData = null;
					setTimeout(() => {
						if (!tooltipLocked) {
							resumeRotation();
						}
					}, 1500);
				}
			}
		});
	}

	function updateTooltipPosition(point: mapboxgl.Point) {
		if (!mapContainer) return;

		const rect = mapContainer.getBoundingClientRect();
		tooltipX = point.x + 15;
		tooltipY = point.y + 15;

		// Prevent tooltip from going off-screen
		const tooltipWidth = 280;
		const tooltipHeight = 100;
		if (tooltipX + tooltipWidth > rect.width) {
			tooltipX = point.x - tooltipWidth - 15;
		}
		if (tooltipY + tooltipHeight > rect.height) {
			tooltipY = point.y - tooltipHeight - 15;
		}
	}

	function handleMouseMove(event: MouseEvent) {
		if (!tooltipLocked && tooltipVisible && mapContainer) {
			const rect = mapContainer.getBoundingClientRect();
			tooltipX = event.clientX - rect.left + 15;
			tooltipY = event.clientY - rect.top + 15;

			const tooltipWidth = 280;
			const tooltipHeight = 100;
			if (tooltipX + tooltipWidth > rect.width) {
				tooltipX = event.clientX - rect.left - tooltipWidth - 15;
			}
			if (tooltipY + tooltipHeight > rect.height) {
				tooltipY = event.clientY - rect.top - tooltipHeight - 15;
			}
		}
	}

	function handleContainerEnter() {
		pauseRotation();
	}

	function handleContainerLeave() {
		if (!tooltipLocked) {
			tooltipVisible = false;
			tooltipData = null;
			setTimeout(() => {
				if (!tooltipLocked) {
					resumeRotation();
				}
			}, 1000);
		}
	}

	// Update points when monitors change
	$effect(() => {
		if (map && isInitialized) {
			const source = map.getSource('points') as mapboxgl.GeoJSONSource;
			if (source) {
				source.setData(getPointsGeoJSON());
			}
		}
	});

	// Animate pulsing rings
	$effect(() => {
		if (!map || !isInitialized) return;

		let pulsePhase = 0;
		const pulseInterval = setInterval(() => {
			if (!map) return;

			pulsePhase = (pulsePhase + 1) % 60;
			const outerRadius = 15 + Math.sin((pulsePhase / 60) * Math.PI * 2) * 8;
			const innerRadius = 10 + Math.sin((pulsePhase / 60) * Math.PI * 2) * 4;
			const opacity = 0.3 + Math.sin((pulsePhase / 60) * Math.PI * 2) * 0.2;

			try {
				map.setPaintProperty('pulsing-rings-outer', 'circle-radius', outerRadius);
				map.setPaintProperty('pulsing-rings-outer', 'circle-stroke-opacity', opacity);
				map.setPaintProperty('pulsing-rings-inner', 'circle-radius', innerRadius);
			} catch {
				// Layer might not exist yet
			}
		}, 50);

		return () => clearInterval(pulseInterval);
	});

	// Animate arc dash offset for flow effect
	$effect(() => {
		if (!map || !isInitialized) return;

		let dashOffset = 0;
		const arcInterval = setInterval(() => {
			if (!map) return;

			dashOffset = (dashOffset + 0.5) % 4;
			try {
				map.setPaintProperty('arcs-layer', 'line-dasharray', [2, 2]);
			} catch {
				// Layer might not exist yet
			}
		}, 100);

		return () => clearInterval(arcInterval);
	});

	onMount(() => {
		requestAnimationFrame(() => {
			initMap();
		});
	});

	onDestroy(() => {
		stopRotation();
		if (map) {
			map.remove();
			map = null;
		}
	});
</script>

<div
	class="globe-container"
	bind:this={mapContainer}
	onmousemove={handleMouseMove}
	onmouseenter={handleContainerEnter}
	onmouseleave={handleContainerLeave}
	role="application"
	aria-label="Interactive 3D globe showing global hotspots and regions"
>
	{#if !isInitialized && !initError}
		<div class="globe-loading">
			<div class="loading-spinner"></div>
			<span class="loading-text">INITIALIZING GLOBE</span>
		</div>
	{/if}
	{#if initError}
		<div class="globe-error">
			<span class="error-icon">⚠</span>
			<span class="error-text">{initError}</span>
		</div>
	{/if}

	<!-- Globe Controls -->
	{#if isInitialized}
		<div class="globe-controls">
			<button
				class="control-btn"
				class:active={showArcs}
				onclick={toggleArcs}
				title={showArcs ? 'Hide tension corridors' : 'Show tension corridors'}
			>
				<span class="control-icon">⌇</span>
			</button>
			<button class="control-btn" onclick={() => resumeRotation()} title="Resume rotation">
				<span class="control-icon">↻</span>
			</button>
			<button class="control-btn" onclick={() => pauseRotation()} title="Pause rotation">
				<span class="control-icon">⏸</span>
			</button>
		</div>
	{/if}

	<!-- Globe Legend -->
	{#if isInitialized}
		<div class="globe-legend" class:expanded={legendExpanded}>
			<button class="legend-toggle" onclick={() => (legendExpanded = !legendExpanded)}>
				<span class="legend-toggle-text">LEGEND</span>
				<span class="legend-toggle-icon">{legendExpanded ? '▼' : '▲'}</span>
			</button>
			{#if legendExpanded}
				<div class="legend-content">
					<div class="legend-section">
						<span class="legend-section-title">THREAT LEVELS (HOTSPOTS)</span>
						<div class="legend-items">
							<div class="legend-item">
								<span class="legend-dot critical"></span>
								<span class="legend-label">Critical</span>
							</div>
							<div class="legend-item">
								<span class="legend-dot high"></span>
								<span class="legend-label">High</span>
							</div>
							<div class="legend-item">
								<span class="legend-dot elevated"></span>
								<span class="legend-label">Elevated</span>
							</div>
							<div class="legend-item">
								<span class="legend-dot low"></span>
								<span class="legend-label">Low</span>
							</div>
						</div>
					</div>
					<div class="legend-section">
						<span class="legend-section-title">INFRASTRUCTURE MARKERS</span>
						<div class="legend-items">
							<div class="legend-item">
								<span class="legend-marker chokepoint"></span>
								<span class="legend-label">Shipping Chokepoint</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker cable"></span>
								<span class="legend-label">Undersea Cable</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker nuclear"></span>
								<span class="legend-label">Nuclear Site</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker military"></span>
								<span class="legend-label">Military Base</span>
							</div>
							<div class="legend-item">
								<span class="legend-marker monitor"></span>
								<span class="legend-label">Custom Monitor</span>
							</div>
						</div>
					</div>
					<div class="legend-section">
						<span class="legend-section-title">TENSION CORRIDORS</span>
						<div class="legend-desc">
							Animated arcs show intel/influence flows between geopolitically connected high-threat
							areas:
						</div>
						<div class="legend-items arc-list">
							<div class="legend-item">
								<span class="legend-arc red"></span>
								<span class="legend-label">Moscow ↔ Kyiv</span>
							</div>
							<div class="legend-item">
								<span class="legend-arc red"></span>
								<span class="legend-label">Tehran ↔ Tel Aviv</span>
							</div>
							<div class="legend-item">
								<span class="legend-arc amber"></span>
								<span class="legend-label">Beijing ↔ Taipei</span>
							</div>
							<div class="legend-item">
								<span class="legend-arc amber"></span>
								<span class="legend-label">Pyongyang ↔ Tokyo</span>
							</div>
						</div>
					</div>
					<div class="legend-section">
						<span class="legend-section-title">ALERTS</span>
						<div class="legend-items">
							<div class="legend-item">
								<span class="legend-ring"></span>
								<span class="legend-label">Critical Hotspot Pulse</span>
							</div>
						</div>
					</div>
					<div class="legend-hint">
						Hover markers for details. Click to lock tooltip. Click empty space to unlock. Drag to
						rotate globe.
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Interactive Tooltip -->
	{#if tooltipVisible && tooltipData}
		<div class="globe-tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
			<div class="tooltip-header">
				<span
					class="tooltip-type"
					class:critical={tooltipData.level === 'critical'}
					class:high={tooltipData.level === 'high'}
					class:elevated={tooltipData.level === 'elevated'}
				>
					{getTypeLabel(tooltipData.type)}
				</span>
				{#if tooltipData.level}
					<span
						class="tooltip-level"
						class:critical={tooltipData.level === 'critical'}
						class:high={tooltipData.level === 'high'}
						class:elevated={tooltipData.level === 'elevated'}
					>
						{tooltipData.level.toUpperCase()}
					</span>
				{/if}
			</div>
			<div class="tooltip-name">{tooltipData.label}</div>
			{#if tooltipData.desc}
				<div class="tooltip-desc">{tooltipData.desc}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.globe-container {
		width: 100%;
		height: 100%;
		min-height: 400px;
		position: relative;
		background: radial-gradient(ellipse at center, #0a0f1a 0%, #020305 70%);
		overflow: visible;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 2px;
	}

	.globe-container::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.4) 100%);
		z-index: 1;
	}

	.globe-container :global(.mapboxgl-canvas) {
		cursor: grab;
	}

	.globe-container :global(.mapboxgl-canvas:active) {
		cursor: grabbing;
	}

	.globe-container :global(.mapboxgl-ctrl-logo) {
		display: none !important;
	}

	.globe-loading,
	.globe-error {
		position: absolute;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		z-index: 5;
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 2px solid rgb(51 65 85);
		border-top-color: rgb(34 211 238);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-text,
	.error-text {
		font-size: 0.625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.15em;
		color: rgb(148 163 184);
		text-transform: uppercase;
	}

	.error-icon {
		font-size: 2rem;
		color: rgb(251 191 36);
	}

	.error-text {
		color: rgb(251 191 36);
		max-width: 200px;
		text-align: center;
	}

	/* Globe Tooltip Styles */
	.globe-tooltip {
		position: absolute;
		z-index: 200;
		background: rgb(15 23 42 / 0.95);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		padding: 0.75rem;
		max-width: 280px;
		min-width: 180px;
		pointer-events: none;
		box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
	}

	.globe-tooltip::before,
	.globe-tooltip::after {
		content: '';
		position: absolute;
		width: 6px;
		height: 6px;
		pointer-events: none;
	}

	.globe-tooltip::before {
		top: 0;
		left: 0;
		border-top: 2px solid rgb(6 182 212 / 0.5);
		border-left: 2px solid rgb(6 182 212 / 0.5);
	}

	.globe-tooltip::after {
		top: 0;
		right: 0;
		border-top: 2px solid rgb(6 182 212 / 0.5);
		border-right: 2px solid rgb(6 182 212 / 0.5);
	}

	.tooltip-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.375rem;
	}

	.tooltip-type {
		font-size: 0.5625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.1em;
		color: rgb(148 163 184);
		text-transform: uppercase;
	}

	.tooltip-type.critical {
		color: rgb(239 68 68);
	}

	.tooltip-type.high {
		color: rgb(251 191 36);
	}

	.tooltip-type.elevated {
		color: rgb(34 211 238);
	}

	.tooltip-level {
		font-size: 0.5625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.05em;
		padding: 0.125rem 0.375rem;
		border-radius: 2px;
		text-transform: uppercase;
		background: rgb(100 116 139 / 0.2);
		color: rgb(148 163 184);
		border: 1px solid rgb(71 85 105 / 0.5);
	}

	.tooltip-level.critical {
		background: rgb(69 10 10 / 0.5);
		color: rgb(239 68 68);
		border-color: rgb(127 29 29 / 0.5);
	}

	.tooltip-level.high {
		background: rgb(69 26 3 / 0.5);
		color: rgb(251 191 36);
		border-color: rgb(146 64 14 / 0.5);
	}

	.tooltip-level.elevated {
		background: rgb(22 78 99 / 0.5);
		color: rgb(34 211 238);
		border-color: rgb(8 145 178 / 0.5);
	}

	.tooltip-name {
		font-size: 0.75rem;
		font-weight: 700;
		color: white;
		margin-bottom: 0.25rem;
	}

	.tooltip-desc {
		font-size: 0.625rem;
		color: rgb(203 213 225);
		line-height: 1.4;
		border-top: 1px solid rgb(51 65 85 / 0.5);
		padding-top: 0.375rem;
		margin-top: 0.25rem;
	}

	/* Globe Controls */
	.globe-controls {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		z-index: 20;
	}

	.control-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(15 23 42 / 0.8);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		color: rgb(148 163 184);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.control-btn:hover {
		background: rgb(51 65 85 / 0.8);
		border-color: rgb(34 211 238 / 0.5);
		color: rgb(34 211 238);
	}

	.control-btn.active {
		background: rgb(22 78 99 / 0.5);
		border-color: rgb(34 211 238 / 0.5);
		color: rgb(34 211 238);
	}

	.control-icon {
		font-size: 0.875rem;
	}

	/* Globe Legend */
	.globe-legend {
		position: absolute;
		bottom: 0.75rem;
		left: 0.75rem;
		z-index: 20;
		background: rgb(15 23 42 / 0.9);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		min-width: 160px;
		max-width: 240px;
		max-height: 70%;
		overflow-y: auto;
	}

	.legend-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.625rem;
		background: transparent;
		border: none;
		color: rgb(148 163 184);
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.legend-toggle:hover {
		color: rgb(34 211 238);
	}

	.legend-toggle-text {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.legend-toggle-icon {
		font-size: 0.5rem;
	}

	.legend-content {
		padding: 0 0.625rem 0.625rem;
		border-top: 1px solid rgb(51 65 85 / 0.3);
	}

	.legend-section {
		margin-top: 0.5rem;
	}

	.legend-section-title {
		display: block;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: rgb(100 116 139);
		text-transform: uppercase;
		margin-bottom: 0.375rem;
	}

	.legend-items {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-dot.critical {
		background: #ff0000;
		box-shadow: 0 0 6px #ff0000;
	}

	.legend-dot.high {
		background: #ff4444;
		box-shadow: 0 0 6px #ff4444;
	}

	.legend-dot.elevated {
		background: #ffcc00;
		box-shadow: 0 0 6px #ffcc00;
	}

	.legend-dot.low {
		background: #00ff88;
		box-shadow: 0 0 6px #00ff88;
	}

	.legend-marker {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-marker.chokepoint {
		background: #06b6d4;
		box-shadow: 0 0 4px #06b6d4;
	}

	.legend-marker.cable {
		background: #a855f7;
		box-shadow: 0 0 4px #a855f7;
	}

	.legend-marker.nuclear {
		background: #f59e0b;
		box-shadow: 0 0 4px #f59e0b;
	}

	.legend-marker.military {
		background: #ec4899;
		box-shadow: 0 0 4px #ec4899;
	}

	.legend-marker.monitor {
		background: #06b6d4;
		box-shadow: 0 0 6px #06b6d4;
	}

	.legend-desc {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(148 163 184);
		line-height: 1.4;
		margin: 0.25rem 0;
	}

	.legend-items.arc-list {
		margin-top: 0.25rem;
	}

	.legend-arc {
		width: 16px;
		height: 2px;
		border-radius: 1px;
		flex-shrink: 0;
		position: relative;
		overflow: hidden;
	}

	.legend-arc::after {
		content: '';
		position: absolute;
		width: 100%;
		height: 100%;
		animation: arc-flow 1.5s linear infinite;
	}

	.legend-arc.red {
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(239, 68, 68, 0.7) 50%,
			transparent 100%
		);
	}

	.legend-arc.red::after {
		background: linear-gradient(90deg, transparent, rgba(255, 100, 100, 0.9), transparent);
	}

	.legend-arc.amber {
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(251, 191, 36, 0.7) 50%,
			transparent 100%
		);
	}

	.legend-arc.amber::after {
		background: linear-gradient(90deg, transparent, rgba(255, 220, 100, 0.9), transparent);
	}

	@keyframes arc-flow {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	.legend-ring {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(255, 0, 0, 0.6);
		border-radius: 50%;
		flex-shrink: 0;
		animation: legend-pulse 1.5s ease-in-out infinite;
	}

	@keyframes legend-pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.9);
		}
	}

	.legend-label {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(203 213 225);
		white-space: nowrap;
	}

	.legend-hint {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgb(51 65 85 / 0.3);
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: rgb(100 116 139);
		line-height: 1.4;
	}

	@media (max-width: 480px) {
		.globe-legend {
			min-width: 140px;
			max-width: 200px;
		}

		.legend-label {
			font-size: 0.5rem;
		}

		.legend-desc {
			font-size: 0.4375rem;
		}
	}
</style>
