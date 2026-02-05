<script lang="ts">
	import { Panel, Badge } from '$lib/components/common';
	import {
		vesselStore,
		vesselConnectionStatus,
		streamPaused,
		streamUpdateInterval,
		streamStats,
		toggleVesselStreamPause,
		setUpdateInterval,
		searchVessels,
		getVesselTrack,
		clearVesselData,
		UPDATE_INTERVAL_OPTIONS,
		type VesselTrackPoint
	} from '$lib/services/vessel-stream';
	import type { Vessel } from '$lib/services/vessel-stream';
	import { HOTSPOTS, CHOKEPOINTS, CONFLICT_ZONES } from '$lib/config/map';
	import { allNewsItems, correlationResults, narrativeResults, setSelectedVesselTrack, clearSelectedVesselTrack } from '$lib/stores';
	import type { CorrelationResult, NarrativeResult } from '$lib/types';

	// Props for external data
	interface Props {
		predictions?: Array<{ id: string; question: string; yes: number; category: string }>;
		onFlyToVessel?: (lat: number, lon: number, zoom?: number) => void;
	}

	let { predictions = [], onFlyToVessel }: Props = $props();

	// UI State
	let searchQuery = $state('');
	let searchResults = $state<Vessel[]>([]);
	let selectedVessel = $state<Vessel | null>(null);
	let selectedVesselTrack = $state<VesselTrackPoint[]>([]);
	let showStreamControls = $state(false);

	// Stream control state
	const isPaused = $derived($streamPaused);
	const updateIntervalMs = $derived($streamUpdateInterval);
	const stats = $derived($streamStats);

	// Handle search
	function handleSearch(query: string) {
		searchQuery = query;
		if (query.trim().length >= 2) {
			searchResults = searchVessels(query);
		} else {
			searchResults = [];
		}
	}

	// Select a vessel and show its track
	function selectVessel(vessel: Vessel) {
		selectedVessel = vessel;
		selectedVesselTrack = getVesselTrack(vessel.mmsi);
		searchQuery = '';
		searchResults = [];
		// Push to global store for map visualization
		setSelectedVesselTrack(vessel, selectedVesselTrack);
	}

	// Navigate to vessel on map
	function navigateToVessel(vessel: Vessel) {
		if (onFlyToVessel) {
			onFlyToVessel(vessel.lat, vessel.lon, 8);
		}
	}

	// Clear selected vessel
	function clearSelectedVessel() {
		selectedVessel = null;
		selectedVesselTrack = [];
		// Clear from global store
		clearSelectedVesselTrack();
	}

	// Handle clearing all vessel data
	function handleClearVessels() {
		clearVesselData();
		selectedVessel = null;
		selectedVesselTrack = [];
		// Clear from global store
		clearSelectedVesselTrack();
	}

	// Maritime zones to monitor - combining hotspots and chokepoints
	interface MonitoredZone {
		name: string;
		lat: number;
		lon: number;
		baseRadius: number; // Base radius in km
		dynamicRadius: number; // Adjusted based on threat intel
		type: 'hotspot' | 'chokepoint';
		level: 'critical' | 'high' | 'elevated' | 'low';
		threatMultiplier: number; // Boost from analysis signals
		activeSignals: string[]; // Which signals are boosting this zone
	}

	// Alert when vessel enters a monitored zone
	interface VesselAlert {
		id: string;
		vessel: Vessel;
		zone: MonitoredZone;
		distance: number; // km
		timestamp: number;
		type: 'entered' | 'near' | 'transiting';
		priority: 'critical' | 'high' | 'medium' | 'low';
	}

	// Threat assessment from analysis systems
	interface ThreatAssessment {
		level: 'critical' | 'high' | 'elevated' | 'low';
		signals: ThreatSignal[];
		hotZones: string[];
		overallMultiplier: number;
	}

	interface ThreatSignal {
		source: 'correlation' | 'narrative' | 'prediction';
		id: string;
		name: string;
		strength: 'critical' | 'high' | 'medium';
		region?: string;
	}

	// Strategic ship type names for display
	const STRATEGIC_TYPE_NAMES: Record<number, string> = {
		35: 'Military',
		55: 'Law Enforcement',
		59: 'Naval Auxiliary',
		51: 'Search & Rescue',
		80: 'Tanker',
		81: 'Tanker (Haz-A)',
		82: 'Tanker (Haz-B)',
		83: 'Tanker (Haz-C)',
		84: 'Tanker (Haz-D)',
		89: 'Tanker'
	};

	// Zone-to-correlation topic mapping
	const ZONE_CORRELATION_MAP: Record<string, string[]> = {
		'Taipei': ['china-tensions', 'military-deployment'],
		'Taiwan Strait': ['china-tensions', 'military-deployment'],
		'Kyiv': ['russia-ukraine', 'military-deployment'],
		'Tel Aviv': ['israel-gaza', 'iran', 'military-deployment'],
		'Tehran': ['iran', 'nuclear', 'military-deployment'],
		'Pyongyang': ['north-korea', 'nuclear', 'military-deployment'],
		'Hormuz': ['iran', 'oil-energy', 'military-deployment'],
		'Bab el-M': ['iran', 'military-deployment'],
		'Suez': ['israel-gaza', 'military-deployment'],
		'Malacca': ['china-tensions', 'military-deployment'],
		'Singapore': ['china-tensions'],
		'Black Sea': ['russia-ukraine', 'military-deployment']
	};

	// Calculate distance between two points (Haversine)
	function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 6371;
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	// Get ship type display name
	function getShipTypeDisplay(type: number | undefined): string {
		if (!type) return 'Unknown';
		return STRATEGIC_TYPE_NAMES[type] || `Type ${type}`;
	}

	// Badge variant based on ship type
	function getShipTypeBadgeVariant(type: number | undefined): 'danger' | 'warning' | 'info' | 'default' {
		if (!type) return 'default';
		if (type === 35 || type === 59) return 'danger';
		if (type === 55) return 'warning';
		if (type >= 80 && type <= 89) return 'info';
		return 'default';
	}

	// Get vessels from store
	const vessels = $derived(Array.from($vesselStore.values()));
	const connectionStatus = $derived($vesselConnectionStatus);

	// Analyze threat signals from correlation engine
	function analyzeCorrelationSignals(correlations: CorrelationResult[]): ThreatSignal[] {
		const signals: ThreatSignal[] = [];
		const militaryTopics = ['military-deployment', 'china-tensions', 'russia-ukraine', 'israel-gaza', 'iran', 'north-korea', 'nuclear'];

		for (const corr of correlations) {
			const topicId = corr.topic?.toLowerCase().replace(/\s+/g, '-') || '';
			if (militaryTopics.some(t => topicId.includes(t) || corr.topic?.toLowerCase().includes(t.replace('-', ' ')))) {
				// Map momentum to strength: rising = high, stable/falling = medium
				const strength: 'critical' | 'high' | 'medium' = corr.momentum === 'rising' ? 'high' : 'medium';
				signals.push({
					source: 'correlation',
					id: topicId,
					name: corr.topic || 'Unknown',
					strength,
					region: getRegionFromTopic(topicId)
				});
			}
		}
		return signals;
	}

	// Analyze threat signals from narratives
	function analyzeNarrativeSignals(narratives: NarrativeResult[]): ThreatSignal[] {
		const signals: ThreatSignal[] = [];
		const threatNarratives = ['china-threat', 'nato-russia', 'world-war', 'energy-crisis', 'cyber-threat'];

		for (const narr of narratives) {
			const narrId = narr.narrative?.toLowerCase().replace(/\s+/g, '-') || '';
			if (threatNarratives.some(t => narrId.includes(t) || narr.narrative?.toLowerCase().includes(t.replace('-', ' ')))) {
				// Map trend to strength: emerging = high, established/fading = medium
				const strength: 'critical' | 'high' | 'medium' = narr.trend === 'emerging' ? 'high' : 'medium';
				signals.push({
					source: 'narrative',
					id: narrId,
					name: narr.narrative || 'Unknown',
					strength,
					region: getRegionFromNarrative(narrId)
				});
			}
		}
		return signals;
	}

	// Analyze prediction market signals
	function analyzePredictionSignals(preds: typeof predictions): ThreatSignal[] {
		const signals: ThreatSignal[] = [];
		const warKeywords = ['war', 'attack', 'invade', 'strike', 'conflict', 'military'];

		for (const pred of preds) {
			const question = pred.question.toLowerCase();
			if (warKeywords.some(kw => question.includes(kw)) && pred.yes >= 20) {
				// Only include predictions that map to a recognized maritime/geopolitical region
				const region = getRegionFromPrediction(question);
				if (!region) continue;

				const strength = pred.yes >= 50 ? 'critical' : pred.yes >= 30 ? 'high' : 'medium';
				signals.push({
					source: 'prediction',
					id: pred.id,
					name: pred.question.slice(0, 60) + (pred.question.length > 60 ? '...' : ''),
					strength,
					region
				});
			}
		}
		return signals;
	}

	// Get region from topic ID
	function getRegionFromTopic(topicId: string): string | undefined {
		if (topicId.includes('china') || topicId.includes('taiwan')) return 'Taipei';
		if (topicId.includes('russia') || topicId.includes('ukraine')) return 'Kyiv';
		if (topicId.includes('israel') || topicId.includes('gaza')) return 'Tel Aviv';
		if (topicId.includes('iran')) return 'Hormuz';
		if (topicId.includes('korea')) return 'Pyongyang';
		return undefined;
	}

	// Get region from narrative
	function getRegionFromNarrative(narrId: string): string | undefined {
		if (narrId.includes('china')) return 'Taipei';
		if (narrId.includes('russia') || narrId.includes('nato')) return 'Kyiv';
		return undefined;
	}

	// Get region from prediction
	function getRegionFromPrediction(question: string): string | undefined {
		if (question.includes('taiwan') || question.includes('china')) return 'Taipei';
		if (question.includes('ukraine') || question.includes('russia')) return 'Kyiv';
		if (question.includes('israel') || question.includes('gaza')) return 'Tel Aviv';
		if (question.includes('iran')) return 'Hormuz';
		return undefined;
	}

	// Build comprehensive threat assessment
	const threatAssessment = $derived.by((): ThreatAssessment => {
		const correlations = $correlationResults || [];
		const narratives = $narrativeResults || [];

		const correlationSignals = analyzeCorrelationSignals(correlations);
		const narrativeSignals = analyzeNarrativeSignals(narratives);
		const predictionSignals = analyzePredictionSignals(predictions);

		const allSignals = [...correlationSignals, ...narrativeSignals, ...predictionSignals];

		// Determine hot zones
		const hotZones = new Set<string>();
		for (const signal of allSignals) {
			if (signal.region && signal.strength !== 'medium') {
				hotZones.add(signal.region);
			}
		}

		// Calculate overall threat level
		const criticalCount = allSignals.filter(s => s.strength === 'critical').length;
		const highCount = allSignals.filter(s => s.strength === 'high').length;

		let level: ThreatAssessment['level'] = 'low';
		let overallMultiplier = 1.0;

		if (criticalCount >= 2) {
			level = 'critical';
			overallMultiplier = 2.0;
		} else if (criticalCount >= 1 || highCount >= 3) {
			level = 'high';
			overallMultiplier = 1.5;
		} else if (highCount >= 1) {
			level = 'elevated';
			overallMultiplier = 1.25;
		}

		return {
			level,
			signals: allSignals.slice(0, 8),
			hotZones: Array.from(hotZones),
			overallMultiplier
		};
	});

	// Build monitored zones with dynamic radius based on threat intel
	const monitoredZones = $derived.by((): MonitoredZone[] => {
		const assessment = threatAssessment;
		const zones: MonitoredZone[] = [];

		// Maritime-relevant hotspots
		const maritimeHotspots = HOTSPOTS.filter(h =>
			['Taipei', 'Kyiv', 'Tel Aviv', 'Tehran', 'Pyongyang', 'Singapore'].includes(h.name)
		);

		for (const h of maritimeHotspots) {
			// Base radius by threat level
			const baseRadius = h.level === 'critical' ? 300 :
				h.level === 'high' ? 250 :
				h.level === 'elevated' ? 200 : 150;

			// Check for active signals for this zone
			const activeSignals: string[] = [];
			let threatMultiplier = 1.0;

			// Check correlations
			const zoneCorrelations = ZONE_CORRELATION_MAP[h.name] || [];
			for (const signal of assessment.signals) {
				if (signal.region === h.name || zoneCorrelations.some(c => signal.id.includes(c))) {
					activeSignals.push(`${signal.source}: ${signal.name}`);
					if (signal.strength === 'critical') threatMultiplier = Math.max(threatMultiplier, 1.5);
					else if (signal.strength === 'high') threatMultiplier = Math.max(threatMultiplier, 1.25);
				}
			}

			// If this zone is in the hot zones list, boost it
			if (assessment.hotZones.includes(h.name)) {
				threatMultiplier = Math.max(threatMultiplier, 1.5);
			}

			zones.push({
				name: h.name,
				lat: h.lat,
				lon: h.lon,
				baseRadius,
				dynamicRadius: Math.round(baseRadius * threatMultiplier),
				type: 'hotspot',
				level: h.level,
				threatMultiplier,
				activeSignals
			});
		}

		// All chokepoints are maritime-critical
		for (const c of CHOKEPOINTS) {
			const baseRadius = 100;
			const activeSignals: string[] = [];
			let threatMultiplier = 1.0;

			// Check for relevant signals
			const zoneCorrelations = ZONE_CORRELATION_MAP[c.name] || [];
			for (const signal of assessment.signals) {
				if (signal.region === c.name || zoneCorrelations.some(corr => signal.id.includes(corr))) {
					activeSignals.push(`${signal.source}: ${signal.name}`);
					if (signal.strength === 'critical') threatMultiplier = Math.max(threatMultiplier, 1.5);
					else if (signal.strength === 'high') threatMultiplier = Math.max(threatMultiplier, 1.25);
				}
			}

			zones.push({
				name: c.name,
				lat: c.lat,
				lon: c.lon,
				baseRadius,
				dynamicRadius: Math.round(baseRadius * threatMultiplier),
				type: 'chokepoint',
				level: 'high',
				threatMultiplier,
				activeSignals
			});
		}

		return zones;
	});

	// Detect vessels in monitored zones with priority based on analysis
	const vesselAlerts = $derived.by(() => {
		const alerts: VesselAlert[] = [];
		const now = Date.now();
		const assessment = threatAssessment;

		for (const vessel of vessels) {
			// Only track strategic vessels
			if (!vessel.shipType || ![35, 55, 59, 51, 80, 81, 82, 83, 84, 89].includes(vessel.shipType)) {
				continue;
			}

			for (const zone of monitoredZones) {
				const distance = calculateDistance(vessel.lat, vessel.lon, zone.lat, zone.lon);

				// Use dynamic radius for zone detection
				if (distance <= zone.dynamicRadius) {
					// Determine priority based on multiple factors
					let priority: VesselAlert['priority'] = 'low';

					// Military vessels get higher priority
					if (vessel.shipType === 35 || vessel.shipType === 55) {
						priority = 'high';
					}

					// Hot zones boost priority
					if (assessment.hotZones.includes(zone.name)) {
						priority = priority === 'high' ? 'critical' : 'high';
					}

					// Zone level affects priority
					if (zone.level === 'critical' && priority !== 'critical') {
						priority = priority === 'low' ? 'medium' : 'high';
					}

					// Distance affects alert type
					const type = distance < zone.dynamicRadius * 0.3 ? 'entered' :
						distance < zone.dynamicRadius * 0.7 ? 'near' : 'transiting';

					// Entered = boost priority
					if (type === 'entered' && priority !== 'critical') {
						priority = priority === 'low' ? 'medium' : priority === 'medium' ? 'high' : 'critical';
					}

					alerts.push({
						id: `${vessel.mmsi}-${zone.name}`,
						vessel,
						zone,
						distance: Math.round(distance),
						timestamp: now,
						type,
						priority
					});
				}
				// Military vessels approaching hot zones
				else if (distance <= zone.dynamicRadius * 1.5 && (vessel.shipType === 35 || vessel.shipType === 55) &&
					assessment.hotZones.includes(zone.name)) {
					alerts.push({
						id: `${vessel.mmsi}-${zone.name}`,
						vessel,
						zone,
						distance: Math.round(distance),
						timestamp: now,
						type: 'transiting',
						priority: 'medium'
					});
				}
			}
		}

		// Sort by priority, then by distance
		const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
		return alerts.sort((a, b) => {
			const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
			if (priorityDiff !== 0) return priorityDiff;
			return a.distance - b.distance;
		}).slice(0, 25);
	});

	// Military deployment news matching
	const MILITARY_KEYWORDS = [
		/naval\s*fleet/i, /carrier\s*group/i, /carrier\s*strike/i, /warship/i,
		/destroyer/i, /frigate/i, /submarine/i, /military\s*vessel/i,
		/navy\s*deploy/i, /naval\s*exercise/i, /maritime\s*patrol/i,
		/amphibious/i, /cruiser/i, /tanker\s*attack/i, /seized\s*vessel/i,
		/ship\s*attack/i, /maritime\s*security/i, /blockade/i
	];

	function matchesMilitaryPattern(title: string): boolean {
		return MILITARY_KEYWORDS.some(pattern => pattern.test(title));
	}

	const militaryNews = $derived.by(() => {
		const newsItems = $allNewsItems || [];
		return newsItems
			.filter(item => matchesMilitaryPattern(item.title))
			.slice(0, 8)
			.map(item => ({
				id: item.id,
				title: item.title,
				link: item.link,
				source: item.source,
				timestamp: item.timestamp
			}));
	});

	// Vessel counts by type
	const vesselCounts = $derived.by(() => {
		const counts = { military: 0, lawEnforcement: 0, auxiliary: 0, tankers: 0, total: vessels.length };
		for (const v of vessels) {
			if (v.shipType === 35) counts.military++;
			else if (v.shipType === 55) counts.lawEnforcement++;
			else if (v.shipType === 59 || v.shipType === 51) counts.auxiliary++;
			else if (v.shipType && v.shipType >= 80 && v.shipType <= 89) counts.tankers++;
		}
		return counts;
	});

	// Format vessel speed
	function formatSpeed(speed: number | undefined): string {
		if (!speed || speed < 0.5) return 'Stationary';
		return `${speed.toFixed(1)} kn`;
	}

	// Connection status indicator
	const statusText = $derived.by(() => {
		switch (connectionStatus) {
			case 'connected': return 'LIVE';
			case 'connecting': return 'CONNECTING';
			case 'no_api_key': return 'NO API KEY';
			case 'error': return 'ERROR';
			default: return 'OFFLINE';
		}
	});

	// Threat level colors
	function getThreatLevelColor(level: string): string {
		switch (level) {
			case 'critical': return 'var(--danger, rgb(239 68 68))';
			case 'high': return 'var(--warning, rgb(245 158 11))';
			case 'elevated': return 'var(--accent, rgb(6 182 212))';
			default: return 'var(--success, rgb(34 197 94))';
		}
	}
</script>

<Panel id="maritime" title="Maritime Intel" count={vesselAlerts.length} loading={connectionStatus === 'connecting'} status={statusText} statusClass={connectionStatus === 'connected' ? 'status-live' : connectionStatus === 'connecting' ? 'status-connecting' : 'status-error'}>
	{#snippet actions()}
		<button class="stream-toggle" class:paused={isPaused} onclick={() => toggleVesselStreamPause()} title={isPaused ? 'Resume stream' : 'Pause stream'}>
			{isPaused ? '▶' : '⏸'}
		</button>
		<button class="controls-toggle" class:active={showStreamControls} onclick={() => showStreamControls = !showStreamControls} title="Stream controls">
			⚙
		</button>
	{/snippet}

	<!-- Stream Controls Panel -->
	{#if showStreamControls}
		<div class="stream-controls">
			<div class="control-row">
				<span class="control-label">Update:</span>
				<div class="interval-btns">
					{#each UPDATE_INTERVAL_OPTIONS as opt}
						<button
							class="interval-btn"
							class:active={updateIntervalMs === opt.value}
							onclick={() => setUpdateInterval(opt.value)}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
			<div class="control-row">
				<span class="control-label">Status:</span>
				<span class="control-value">{isPaused ? 'PAUSED' : 'LIVE'}</span>
				<span class="control-sep">|</span>
				<span class="control-value">{stats.totalMessages} msgs</span>
				<button class="clear-btn" onclick={handleClearVessels} title="Clear all vessel data">
					Clear
				</button>
			</div>
		</div>
	{/if}

	<!-- Conflict Zones - Compact at top -->
	<div class="conflict-zones-compact">
		{#each CONFLICT_ZONES.filter(z => ['Ukraine', 'Gaza', 'Yemen'].includes(z.name)) as zone}
			<div class="zone-chip" style="--zone-color: {zone.color}">
				<span class="zone-dot"></span>
				<span class="zone-label">{zone.name}</span>
			</div>
		{/each}
	</div>

	<!-- Quick Stats Bar -->
	<div class="stats-bar">
		<span class="stat"><b>{vesselCounts.military}</b> MIL</span>
		<span class="stat"><b>{vesselCounts.lawEnforcement}</b> LAW</span>
		<span class="stat"><b>{vesselCounts.tankers}</b> TNK</span>
		<span class="stat-total"><b>{vesselCounts.total}</b> TOTAL</span>
		{#if isPaused}
			<span class="paused-indicator">PAUSED</span>
		{/if}
	</div>

	<!-- Vessel Search - Always visible -->
	<div class="search-bar">
		<input
			type="text"
			class="search-input"
			placeholder="Search vessels..."
			bind:value={searchQuery}
			oninput={(e) => handleSearch((e.target as HTMLInputElement).value)}
		/>
		{#if searchResults.length > 0}
			<div class="search-dropdown">
				{#each searchResults.slice(0, 5) as vessel (vessel.mmsi)}
					<button class="search-item" onclick={() => { selectVessel(vessel); navigateToVessel(vessel); }}>
						<span class="item-name">{vessel.name || vessel.mmsi}</span>
						<span class="item-type">{getShipTypeDisplay(vessel.shipType)}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Selected Vessel - Compact -->
	{#if selectedVessel}
		<div class="selected-compact">
			<div class="selected-row">
				<span class="selected-name">{selectedVessel.name || selectedVessel.mmsi}</span>
				<Badge text={getShipTypeDisplay(selectedVessel.shipType)} variant={getShipTypeBadgeVariant(selectedVessel.shipType)} />
				<button class="nav-btn" onclick={() => navigateToVessel(selectedVessel!)} title="Go to map">📍</button>
				<button class="close-btn" onclick={clearSelectedVessel}>✕</button>
			</div>
			<div class="selected-details">
				<span>{formatSpeed(selectedVessel.speed)}</span>
				<span>{selectedVessel.course?.toFixed(0) || '--'}°</span>
				{#if selectedVessel.destination}
					<span class="dest">→ {selectedVessel.destination}</span>
				{/if}
			</div>
			{#if selectedVesselTrack.length > 1}
				<div class="track-mini">TRACK: {selectedVesselTrack.length} pts</div>
			{/if}
		</div>
	{/if}

	<!-- Zone Alerts - Compact ship cards -->
	{#if vesselAlerts.length > 0}
		<div class="alerts-section">
			<div class="section-head">
				<span>ZONE ALERTS</span>
				<Badge text={`${vesselAlerts.length}`} variant="danger" />
			</div>
			<div class="ship-list">
				{#each vesselAlerts.slice(0, 10) as alert (alert.id)}
					<button class="ship-row" class:critical={alert.priority === 'critical'} class:high={alert.priority === 'high'} onclick={() => { selectVessel(alert.vessel); navigateToVessel(alert.vessel); }}>
						<span class="ship-name">{alert.vessel.name || alert.vessel.mmsi}</span>
						<span class="ship-zone">{alert.zone.name}</span>
						<span class="ship-dist">{alert.distance}km</span>
						<span class="ship-priority" class:crit={alert.priority === 'critical'} class:hi={alert.priority === 'high'}>{alert.priority.charAt(0).toUpperCase()}</span>
					</button>
				{/each}
			</div>
		</div>
	{:else if connectionStatus === 'connected'}
		<div class="no-alerts-compact">✓ No vessels in monitored zones</div>
	{/if}

	<!-- Threat Assessment - Compact -->
	{#if threatAssessment.signals.length > 0}
		<div class="threat-compact" style="border-color: {getThreatLevelColor(threatAssessment.level)}">
			<span class="threat-lvl">{threatAssessment.level.toUpperCase()}</span>
			{#each threatAssessment.hotZones.slice(0, 3) as zone}
				<span class="hot-zone">{zone}</span>
			{/each}
		</div>
	{/if}

	<!-- Military News - Compact -->
	{#if militaryNews.length > 0}
		<div class="news-compact">
			<div class="section-head">
				<span>NAVAL NEWS</span>
				<Badge text={`${militaryNews.length}`} variant="info" />
			</div>
			{#each militaryNews.slice(0, 3) as news (news.id)}
				<a href={news.link} target="_blank" rel="noopener noreferrer" class="news-link">
					{news.title.slice(0, 60)}{news.title.length > 60 ? '...' : ''}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Connection Status -->
	{#if connectionStatus === 'no_api_key'}
		<div class="status-msg">No API key - simulated data</div>
	{:else if connectionStatus === 'error'}
		<div class="status-msg error">Connection error</div>
	{/if}
</Panel>

<style>
	/* Stream toggle in header */
	.stream-toggle,
	.controls-toggle {
		padding: 0.125rem 0.375rem;
		background: var(--accent-bg, rgba(6, 182, 212, 0.15));
		border: 1px solid var(--accent);
		border-radius: 2px;
		color: var(--accent);
		cursor: pointer;
		font-size: 0.5rem;
	}
	.stream-toggle.paused {
		background: var(--warning-bg, rgba(245, 158, 11, 0.15));
		border-color: var(--warning);
		color: var(--warning);
	}
	.controls-toggle.active {
		background: var(--accent);
		color: var(--panel-bg, #0f172a);
	}

	/* Stream controls panel */
	.stream-controls {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.375rem;
		margin-bottom: 0.375rem;
		background: var(--panel-bg-alt, rgba(15, 23, 42, 0.7));
		border: 1px solid var(--accent);
		border-radius: 2px;
	}
	.control-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
	}
	.control-label {
		color: var(--text-dim);
		min-width: 3rem;
	}
	.control-value {
		color: var(--text);
	}
	.control-sep {
		color: var(--border-subtle);
	}
	.interval-btns {
		display: flex;
		gap: 0.25rem;
	}
	.interval-btn {
		padding: 0.125rem 0.375rem;
		background: var(--panel-bg-alt, rgba(15, 23, 42, 0.5));
		border: 1px solid var(--border-subtle);
		border-radius: 2px;
		color: var(--text-dim);
		cursor: pointer;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
	}
	.interval-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	.interval-btn.active {
		background: var(--accent-bg, rgba(6, 182, 212, 0.2));
		border-color: var(--accent);
		color: var(--accent);
	}
	.clear-btn {
		margin-left: auto;
		padding: 0.125rem 0.375rem;
		background: var(--danger-bg, rgba(239, 68, 68, 0.15));
		border: 1px solid var(--danger, rgb(239 68 68));
		border-radius: 2px;
		color: var(--danger, rgb(239 68 68));
		cursor: pointer;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
	}
	.clear-btn:hover {
		background: var(--danger, rgb(239 68 68));
		color: white;
	}

	/* Paused indicator in stats bar */
	.paused-indicator {
		padding: 0.0625rem 0.25rem;
		background: var(--warning-bg, rgba(245, 158, 11, 0.2));
		border: 1px solid var(--warning);
		border-radius: 2px;
		color: var(--warning);
		font-weight: 700;
		font-size: 0.4375rem;
		animation: pulse-warning 1.5s ease-in-out infinite;
	}
	@keyframes pulse-warning {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	/* Conflict zones - compact chips at top */
	.conflict-zones-compact {
		display: flex;
		gap: 0.375rem;
		margin-bottom: 0.375rem;
		flex-wrap: wrap;
	}
	.zone-chip {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.375rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid var(--zone-color, #ef4444);
		border-radius: 2px;
	}
	.zone-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--zone-color, #ef4444);
	}
	.zone-label {
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--zone-color, #ef4444);
		letter-spacing: 0.05em;
	}

	/* Stats bar */
	.stats-bar {
		display: flex;
		gap: 0.5rem;
		padding: 0.25rem 0.375rem;
		background: var(--panel-bg-alt, rgba(15, 23, 42, 0.5));
		border: 1px solid var(--border-subtle);
		border-radius: 2px;
		margin-bottom: 0.375rem;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
	}
	.stat {
		color: var(--text-dim);
	}
	.stat b {
		color: var(--accent);
		font-weight: 700;
	}
	.stat-total {
		margin-left: auto;
		color: var(--text-dim);
	}
	.stat-total b {
		color: var(--text);
	}

	/* Search bar - always visible */
	.search-bar {
		position: relative;
		margin-bottom: 0.375rem;
	}
	.search-input {
		width: 100%;
		padding: 0.25rem 0.375rem;
		background: var(--input-bg, rgba(30, 41, 59, 0.8));
		border: 1px solid var(--border-subtle);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
	}
	.search-input:focus {
		outline: none;
		border-color: var(--accent);
	}
	.search-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: rgb(15 23 42 / 0.98);
		border: 1px solid var(--accent);
		border-radius: 2px;
		z-index: 10;
		max-height: 120px;
		overflow-y: auto;
	}
	.search-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0.25rem 0.375rem;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border-divider);
		color: var(--text);
		cursor: pointer;
		text-align: left;
	}
	.search-item:last-child { border-bottom: none; }
	.search-item:hover { background: var(--accent-bg, rgba(6, 182, 212, 0.15)); }
	.item-name {
		font-size: 0.5625rem;
		font-weight: 600;
	}
	.item-type {
		font-size: 0.5rem;
		color: var(--text-dim);
		font-family: 'SF Mono', Monaco, monospace;
	}

	/* Selected vessel - compact */
	.selected-compact {
		padding: 0.375rem;
		margin-bottom: 0.375rem;
		background: var(--accent-bg, rgba(6, 182, 212, 0.1));
		border: 1px solid var(--accent);
		border-radius: 2px;
	}
	.selected-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}
	.selected-name {
		font-size: 0.625rem;
		font-weight: 700;
		color: var(--accent);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nav-btn, .close-btn {
		padding: 0.0625rem 0.25rem;
		background: none;
		border: 1px solid var(--border-subtle);
		border-radius: 2px;
		color: var(--text-dim);
		cursor: pointer;
		font-size: 0.5rem;
	}
	.nav-btn:hover { border-color: var(--accent); color: var(--accent); }
	.close-btn:hover { border-color: var(--danger); color: var(--danger); }
	.selected-details {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
	}
	.dest { color: var(--accent); }
	.track-mini {
		margin-top: 0.25rem;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--success, rgb(34 197 94));
	}

	/* Alerts section - compact ship list */
	.alerts-section {
		margin-bottom: 0.375rem;
	}
	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.125rem 0;
		border-bottom: 1px solid var(--border-subtle);
		margin-bottom: 0.25rem;
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
		letter-spacing: 0.1em;
	}
	.ship-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.ship-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.375rem;
		background: var(--panel-bg-alt, rgba(15, 23, 42, 0.5));
		border: none;
		border-left: 2px solid var(--border-subtle);
		cursor: pointer;
		width: 100%;
		text-align: left;
	}
	.ship-row:hover { background: var(--accent-bg, rgba(6, 182, 212, 0.1)); border-left-color: var(--accent); }
	.ship-row.critical { border-left-color: var(--danger, rgb(239 68 68)); background: rgba(239, 68, 68, 0.05); }
	.ship-row.high { border-left-color: var(--warning, rgb(245 158 11)); background: rgba(245, 158, 11, 0.03); }
	.ship-name {
		flex: 1;
		font-size: 0.5625rem;
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ship-zone {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
	}
	.ship-dist {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		min-width: 2.5rem;
		text-align: right;
	}
	.ship-priority {
		width: 14px;
		height: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		border-radius: 2px;
		background: var(--border-subtle);
		color: var(--text-dim);
	}
	.ship-priority.crit { background: var(--danger, rgb(239 68 68)); color: white; }
	.ship-priority.hi { background: var(--warning, rgb(245 158 11)); color: #000; }

	.no-alerts-compact {
		padding: 0.375rem;
		text-align: center;
		font-size: 0.5625rem;
		color: var(--success, rgb(34 197 94));
		background: var(--panel-bg-alt, rgba(15, 23, 42, 0.5));
		border-radius: 2px;
		margin-bottom: 0.375rem;
	}

	/* Threat compact */
	.threat-compact {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.375rem;
		margin-bottom: 0.375rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid;
		border-radius: 2px;
	}
	.threat-lvl {
		font-size: 0.5rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--danger, rgb(239 68 68));
	}
	.hot-zone {
		font-size: 0.5rem;
		padding: 0.0625rem 0.25rem;
		background: rgba(239, 68, 68, 0.2);
		border-radius: 2px;
		color: var(--danger, rgb(239 68 68));
		font-family: 'SF Mono', Monaco, monospace;
	}

	/* News compact */
	.news-compact {
		margin-bottom: 0.375rem;
	}
	.news-link {
		display: block;
		padding: 0.125rem 0;
		font-size: 0.5625rem;
		color: var(--text);
		text-decoration: none;
		border-bottom: 1px solid var(--border-divider);
	}
	.news-link:last-child { border-bottom: none; }
	.news-link:hover { color: var(--accent); }

	/* Status message */
	.status-msg {
		padding: 0.25rem;
		text-align: center;
		font-size: 0.5rem;
		color: var(--warning, rgb(245 158 11));
		background: rgba(245, 158, 11, 0.1);
		border-radius: 2px;
	}
	.status-msg.error {
		color: var(--danger, rgb(239 68 68));
		background: rgba(239, 68, 68, 0.1);
	}
</style>
