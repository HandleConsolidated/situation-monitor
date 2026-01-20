<script lang="ts">
	import { onMount } from 'svelte';
	import { Header } from '$lib/components/layout';
	import { SettingsModal, MonitorFormModal, MonitorMatchesModal, OnboardingModal } from '$lib/components/modals';
	import {
		NewsPanel,
		MarketsPanel,
		HeatmapPanel,
		CommoditiesPanel,
		CryptoPanel,
		MainCharPanel,
		CorrelationPanel,
		NarrativePanel,
		MonitorsPanel,
		MapPanel,
		GlobePanel,
		WhalePanel,
		PolymarketPanel,
		ContractsPanel,
		LayoffsPanel,
		IntelPanel,
		SituationPanel,
		WorldLeadersPanel,
		PrinterPanel,
		GridStressPanel,
		EarthquakePanel,
		RadiationPanel,
		DiseaseOutbreakPanel,
		AnalysisChatPanel,
		AircraftPanel
	} from '$lib/components/panels';
	import {
		news,
		markets,
		monitors,
		settings,
		refresh,
		allNewsItems,
		categorizedNewsItems,
		layoutSettings,
		leftPanels,
		rightPanels,
		bottomPanels,
		correlationResults,
		narrativeResults,
		mainCharacterResults
	} from '$lib/stores';
	import { seenItems } from '$lib/services/seen-items';
	import { DropZone } from '$lib/components/common';
	import { cachedApi } from '$lib/api';
	import type { Prediction, WhaleTransaction, Contract, Layoff, GridStressData, RadiationReading, OutageData, FedBalanceData } from '$lib/api';
	import type { EarthquakeData, DiseaseOutbreak, Aircraft } from '$lib/types';
	import type { CustomMonitor, WorldLeader } from '$lib/types';
	import type { PanelId } from '$lib/config';
	import { HOTSPOTS } from '$lib/config/map';
	import type { ActionHandlers } from '$lib/services/ai-actions';

	// Derived layout styles
	const layoutStyle = $derived(() => {
		const left = $layoutSettings.leftColumnWidth;
		const right = $layoutSettings.rightColumnWidth;
		const center = 100 - left - right;
		return `--left-col: ${left}%; --center-col: ${center}%; --right-col: ${right}%; --bottom-height: ${$layoutSettings.bottomPanelHeight}px;`;
	});

	const isCompact = $derived($layoutSettings.compactMode);

	// Modal state
	let settingsOpen = $state(false);
	let monitorFormOpen = $state(false);
	let monitorMatchesOpen = $state(false);
	let onboardingOpen = $state(false);
	let editingMonitor = $state<CustomMonitor | null>(null);
	let viewingMonitor = $state<CustomMonitor | null>(null);

	// Misc panel data
	let predictions = $state<Prediction[]>([]);
	let whales = $state<WhaleTransaction[]>([]);
	let contracts = $state<Contract[]>([]);
	let layoffs = $state<Layoff[]>([]);
	let leaders = $state<WorldLeader[]>([]);
	let leadersLoading = $state(false);
	let gridStress = $state<GridStressData[]>([]);
	let gridStressLoading = $state(false);
	let earthquakes = $state<EarthquakeData[]>([]);
	let earthquakesLoading = $state(false);
	let radiationReadings = $state<RadiationReading[]>([]);
	let radiationLoading = $state(false);
	let diseaseOutbreaks = $state<DiseaseOutbreak[]>([]);
	let outbreaksLoading = $state(false);
	let outages = $state<OutageData[]>([]);
	// @ts-expect-error - outagesLoading is set for UI state but not currently used in template
	let outagesLoading = $state(false);
	let fedData = $state<FedBalanceData | null>(null);
	let fedLoading = $state(false);

	// Aircraft tracker state (data comes from GlobePanel)
	interface AircraftSnapshot {
		timestamp: number;
		aircraft: Aircraft[];
		region: string;
	}
	interface AircraftTrackPoint {
		lat: number;
		lon: number;
		timestamp: number;
		altitude: number | null;
	}
	let aircraftData = $state<Aircraft[]>([]);
	let aircraftHistory = $state<AircraftSnapshot[]>([]);
	let selectedAircraftTrack = $state<{ aircraft: Aircraft; track: AircraftTrackPoint[] } | null>(null);

	// ADS-B control state (controlled from AircraftPanel)
	let adsbEnabled = $state(false);
	let selectedAircraftRegions = $state<Set<string>>(new Set(['viewport']));

	// Track when initial data load is complete for AI panel
	let initialDataLoaded = $state(false);

	// Data freshness tracking for AI actions
	let dataFreshness = $state<Record<string, number | null>>({
		news: null,
		markets: null,
		crypto: null,
		geopolitical: null,
		infrastructure: null,
		environmental: null,
		alternative: null
	});

	// Panel highlight state for AI actions (reserved for future panel highlighting feature)
	// @ts-expect-error - intentionally unused, reserved for future feature
	let highlightedPanelId = $state<string | null>(null);

	// Globe navigation target - when set, the globe flies to these coordinates
	// Includes _ts timestamp to force reactivity on every click
	let globeFlyToTarget = $state<{ lat: number; lon: number; zoom?: number; _ts?: number } | null>(null);

	// Handler for grid stress region clicks - navigates globe to the region
	function handleGridRegionClick(lat: number, lon: number, _region: string) {
		// Set target with a unique reference to ensure reactivity even if same coords
		globeFlyToTarget = { lat, lon, zoom: 4, _ts: Date.now() };
	}

	// Handler for earthquake clicks - navigates globe to the earthquake location
	function handleEarthquakeClick(lat: number, lon: number, _place: string) {
		globeFlyToTarget = { lat, lon, zoom: 5, _ts: Date.now() };
	}

	// Handler for radiation reading clicks - navigates globe to the reading location
	function handleRadiationClick(lat: number, lon: number, _location: string) {
		console.log('[Radiation Click] Flying to:', { lat, lon, location: _location });
		globeFlyToTarget = { lat, lon, zoom: 5, _ts: Date.now() };
	}

	// Handler for disease outbreak clicks - navigates globe to the outbreak location
	function handleOutbreakClick(lat: number, lon: number, _disease: string) {
		globeFlyToTarget = { lat, lon, zoom: 4, _ts: Date.now() };
	}

	// Handler for aircraft data changes from GlobePanel
	function handleAircraftDataChange(aircraft: Aircraft[], history: AircraftSnapshot[]) {
		aircraftData = aircraft;
		aircraftHistory = history;
	}

	// Handler for aircraft selection from AircraftPanel
	function handleAircraftSelect(aircraft: Aircraft, trackHistory: AircraftTrackPoint[]) {
		selectedAircraftTrack = { aircraft, track: trackHistory };
	}

	// Handler for ADS-B toggle from AircraftPanel - also enables aircraft panel when ADS-B is enabled
	function handleAdsbToggle(enabled: boolean) {
		adsbEnabled = enabled;
		// Auto-enable aircraft panel when ADS-B is enabled
		if (enabled && !settings.isPanelEnabled('aircraft')) {
			settings.enablePanel('aircraft');
		}
	}

	// Handler for ADS-B region changes from AircraftPanel
	function handleAircraftRegionsChange(regions: Set<string>) {
		selectedAircraftRegions = regions;
	}

	// Force refresh flag - when true, bypasses cache
	let forceRefresh = $state(false);

	// Data fetching - all functions use cachedApi with forceRefresh support
	async function loadNews(force = forceRefresh) {
		const categories = ['politics', 'tech', 'finance', 'gov', 'ai', 'intel'] as const;
		categories.forEach((cat) => news.setLoading(cat, true));

		try {
			const result = await cachedApi.fetchAllNewsWithErrors(force);

			// Set items for each category
			Object.entries(result.data).forEach(([category, items]) => {
				news.setItems(category as keyof typeof result.data, items);
			});

			// Set errors for categories that failed
			Object.entries(result.errors).forEach(([category, errorMsg]) => {
				if (errorMsg && result.data[category as keyof typeof result.data].length === 0) {
					news.setError(category as keyof typeof result.data, errorMsg);
				}
			});

			// Track freshness
			dataFreshness = { ...dataFreshness, news: Date.now(), geopolitical: Date.now() };
		} catch (error) {
			categories.forEach((cat) => news.setError(cat, String(error)));
		}
	}

	async function loadMarkets(force = forceRefresh) {
		try {
			const data = await cachedApi.fetchAllMarkets(force);
			markets.setIndices(data.indices);
			markets.setSectors(data.sectors);
			markets.setCommodities(data.commodities);
			markets.setCrypto(data.crypto);
			// Track freshness
			dataFreshness = { ...dataFreshness, markets: Date.now(), crypto: Date.now() };
		} catch (error) {
			console.error('Failed to load markets:', error);
		}
	}

	async function loadMiscData(force = forceRefresh) {
		try {
			const [predictionsData, whalesData, contractsData, layoffsData] = await Promise.all([
				cachedApi.fetchPolymarket(force),
				cachedApi.fetchWhaleTransactions(force),
				cachedApi.fetchGovContracts(force),
				cachedApi.fetchLayoffs(force)
			]);
			predictions = predictionsData;
			whales = whalesData;
			contracts = contractsData;
			layoffs = layoffsData;
			// Track freshness
			dataFreshness = { ...dataFreshness, alternative: Date.now() };
		} catch (error) {
			console.error('Failed to load misc data:', error);
		}
	}

	async function loadWorldLeaders(force = forceRefresh) {
		leadersLoading = true;
		try {
			leaders = await cachedApi.fetchWorldLeaders(force);
		} catch (error) {
			console.error('Failed to load world leaders:', error);
		} finally {
			leadersLoading = false;
		}
	}

	async function loadGridStress(force = forceRefresh) {
		gridStressLoading = true;
		try {
			gridStress = await cachedApi.fetchAllGridStress(force);
			// Track freshness
			dataFreshness = { ...dataFreshness, infrastructure: Date.now() };
		} catch (error) {
			console.error('Failed to load grid stress data:', error);
		} finally {
			gridStressLoading = false;
		}
	}

	async function loadEarthquakes(force = forceRefresh) {
		earthquakesLoading = true;
		try {
			earthquakes = await cachedApi.fetchEarthquakes(4.0, force);
			// Track freshness
			dataFreshness = { ...dataFreshness, environmental: Date.now() };
		} catch (error) {
			console.error('Failed to load earthquake data:', error);
		} finally {
			earthquakesLoading = false;
		}
	}

	async function loadRadiation(force = forceRefresh) {
		radiationLoading = true;
		try {
			radiationReadings = await cachedApi.fetchRadiationData(force);
		} catch (error) {
			console.error('Failed to load radiation data:', error);
		} finally {
			radiationLoading = false;
		}
	}

	async function loadDiseaseOutbreaks(force = forceRefresh) {
		outbreaksLoading = true;
		try {
			diseaseOutbreaks = await cachedApi.fetchDiseaseOutbreaks(force);
		} catch (error) {
			console.error('Failed to load disease outbreak data:', error);
		} finally {
			outbreaksLoading = false;
		}
	}

	async function loadOutages(force = forceRefresh) {
		outagesLoading = true;
		try {
			outages = await cachedApi.fetchOutageData(force);
		} catch (error) {
			console.error('Failed to load outage data:', error);
		} finally {
			outagesLoading = false;
		}
	}

	async function loadFedData(force = forceRefresh) {
		fedLoading = true;
		try {
			fedData = await cachedApi.fetchFedBalanceData(force);
		} catch (error) {
			console.error('Failed to load Fed balance sheet data:', error);
		} finally {
			fedLoading = false;
		}
	}

	// Combined infrastructure data loading for AI actions
	async function loadInfrastructureData(force = forceRefresh) {
		await Promise.all([
			loadGridStress(force),
			loadOutages(force)
		]);
		dataFreshness = { ...dataFreshness, infrastructure: Date.now() };
	}

	// Combined environmental data loading for AI actions
	async function loadEnvironmentalData(force = forceRefresh) {
		await Promise.all([
			loadEarthquakes(force),
			loadRadiation(force),
			loadDiseaseOutbreaks(force)
		]);
		dataFreshness = { ...dataFreshness, environmental: Date.now() };
	}

	// Combined crypto loading for AI actions
	async function loadCryptoData(force = forceRefresh) {
		try {
			const data = await cachedApi.fetchAllMarkets(force);
			markets.setCrypto(data.crypto);
			// Also refresh whales which is crypto-related
			const whalesData = await cachedApi.fetchWhaleTransactions(force);
			whales = whalesData;
			dataFreshness = { ...dataFreshness, crypto: Date.now() };
		} catch (error) {
			console.error('Failed to load crypto data:', error);
		}
	}

	// Panel highlight function for AI actions
	function highlightPanel(panelId: string) {
		highlightedPanelId = panelId;
		// Auto-clear highlight after 3 seconds
		setTimeout(() => {
			highlightedPanelId = null;
		}, 3000);
	}

	// Action handlers for AI tool execution - always force refresh for AI actions
	const actionHandlers: ActionHandlers = {
		refreshNews: () => loadNews(true),
		refreshMarkets: () => loadMarkets(true),
		refreshCrypto: () => loadCryptoData(true),
		refreshGeopolitical: () => loadNews(true), // Geopolitical data comes from news feeds
		refreshInfrastructure: () => loadInfrastructureData(true),
		refreshEnvironmental: () => loadEnvironmentalData(true),
		refreshAlternative: () => loadMiscData(true),
		refreshAll: async () => {
			await Promise.all([
				loadNews(true),
				loadMarkets(true),
				loadMiscData(true),
				loadInfrastructureData(true),
				loadEnvironmentalData(true)
			]);
		},
		highlightPanel,
		getDataFreshness: () => dataFreshness
	};

	/**
	 * Handle manual refresh - bypasses cache for fresh data
	 * This is triggered by the refresh button in the header
	 */
	async function handleRefresh() {
		refresh.startRefresh();
		try {
			// Force refresh all data (bypass cache)
			await Promise.all([
				loadNews(true),
				loadMarkets(true),
				loadMiscData(true),
				loadWorldLeaders(true),
				loadGridStress(true),
				loadEarthquakes(true),
				loadRadiation(true),
				loadDiseaseOutbreaks(true),
				loadOutages(true),
				loadFedData(true)
			]);
			refresh.endRefresh();
		} catch (error) {
			refresh.endRefresh([String(error)]);
		}
	}

	function handleCreateMonitor() {
		editingMonitor = null;
		monitorFormOpen = true;
	}

	function handleEditMonitor(monitor: CustomMonitor) {
		editingMonitor = monitor;
		monitorFormOpen = true;
	}

	function handleDeleteMonitor(id: string) {
		monitors.deleteMonitor(id);
	}

	function handleToggleMonitor(id: string) {
		monitors.toggleMonitor(id);
	}

	function handleViewMatches(monitor: CustomMonitor) {
		viewingMonitor = monitor;
		monitorMatchesOpen = true;
	}

	function isPanelVisible(id: PanelId): boolean {
		return $settings.enabled[id] !== false;
	}

	// Get panels for each column from the layout store, filtered by visibility
	const leftColumnPanels = $derived($leftPanels.filter((id) => isPanelVisible(id)));
	const rightColumnPanels = $derived($rightPanels.filter((id) => isPanelVisible(id)));
	const bottomRowPanels = $derived($bottomPanels.filter((id) => isPanelVisible(id)));

	function handleSelectPreset(presetId: string) {
		settings.applyPreset(presetId);
		onboardingOpen = false;
		handleRefresh();
	}

	function handleReconfigure() {
		settingsOpen = false;
		settings.resetOnboarding();
		onboardingOpen = true;
	}

	// Scan for monitor matches whenever news items change
	// IMPORTANT: Do NOT read $monitors inside this effect - scanForMatches updates it, causing infinite loop!
	let lastScannedNewsCount = 0;
	$effect(() => {
		const items = $allNewsItems;
		const newsCount = items.length;

		// Only scan when news count changes (new items arrived)
		if (newsCount > 0 && newsCount !== lastScannedNewsCount) {
			lastScannedNewsCount = newsCount;
			// Check monitors count without subscribing to changes
			const monitorsState = monitors.getMonitors();
			if (monitorsState.length > 0) {
				monitors.scanForMatches(items);
			}
		}
	});

	onMount(() => {
		// Initialize the seen items tracker for persistent NEW indicator state
		seenItems.init();

		if (!settings.isOnboardingComplete()) {
			onboardingOpen = true;
		}

		async function initialLoad() {
			refresh.startRefresh();
			try {
				// Initial load uses cache (forceRefresh = false)
				// This provides immediate data if cached, reducing API calls on page load
				await Promise.all([
					loadNews(false),
					loadMarkets(false),
					loadMiscData(false),
					loadWorldLeaders(false),
					loadGridStress(false),
					loadEarthquakes(false),
					loadRadiation(false),
					loadDiseaseOutbreaks(false),
					loadOutages(false),
					loadFedData(false)
				]);
				refresh.endRefresh();
				initialDataLoaded = true;
			} catch (error) {
				refresh.endRefresh([String(error)]);
				// Still mark as loaded even on error - we have partial data
				initialDataLoaded = true;
			}
		}
		initialLoad();
		refresh.setupAutoRefresh(handleRefresh);

		return () => {
			refresh.stopAutoRefresh();
		};
	});
</script>

<svelte:head>
	<title>Situation Monitor</title>
	<meta name="description" content="Real-time global situation monitoring dashboard" />
</svelte:head>

<div class="app" class:compact={isCompact} style={layoutStyle()}>
	<!-- Visual Effects Overlays -->
	<div class="vignette-overlay"></div>
	<div class="noise-overlay"></div>
	<div class="gradient-overlay"></div>

	<Header onSettingsClick={() => (settingsOpen = true)} onRefreshClick={handleRefresh} />

	<main class="main-layout">
		<!-- Left Panel Column -->
		<aside class="panel-column left-column">
			<DropZone zone="left" panels={leftColumnPanels} class="column-scroll">
				{#each leftColumnPanels as panelId (panelId)}
					{#if panelId === 'politics'}
						<NewsPanel category="politics" panelId="politics" title="Politics" />
					{:else if panelId === 'tech'}
						<NewsPanel category="tech" panelId="tech" title="Tech" />
					{:else if panelId === 'finance'}
						<NewsPanel category="finance" panelId="finance" title="Finance" />
					{:else if panelId === 'intel'}
						<IntelPanel />
					{:else if panelId === 'correlation'}
						<CorrelationPanel news={$allNewsItems} />
					{:else if panelId === 'narrative'}
						<NarrativePanel news={$allNewsItems} />
					{:else if panelId === 'gov'}
						<NewsPanel category="gov" panelId="gov" title="Government" />
					{:else if panelId === 'ai'}
						<NewsPanel category="ai" panelId="ai" title="AI" />
					{:else if panelId === 'leaders'}
						<WorldLeadersPanel {leaders} loading={leadersLoading} />
					{:else if panelId === 'markets'}
						<MarketsPanel />
					{:else if panelId === 'heatmap'}
						<HeatmapPanel />
					{:else if panelId === 'crypto'}
						<CryptoPanel />
					{:else if panelId === 'commodities'}
						<CommoditiesPanel />
					{:else if panelId === 'whales'}
						<WhalePanel {whales} />
					{:else if panelId === 'polymarket'}
						<PolymarketPanel {predictions} />
					{:else if panelId === 'contracts'}
						<ContractsPanel {contracts} />
					{:else if panelId === 'layoffs'}
						<LayoffsPanel {layoffs} />
					{:else if panelId === 'printer'}
						<PrinterPanel data={fedData} loading={fedLoading} />
					{:else if panelId === 'monitors'}
						<MonitorsPanel
							monitors={$monitors.monitors}
							matches={$monitors.matches}
							onCreateMonitor={handleCreateMonitor}
							onEditMonitor={handleEditMonitor}
							onDeleteMonitor={handleDeleteMonitor}
							onToggleMonitor={handleToggleMonitor}
							onViewMatches={handleViewMatches}
						/>
					{:else if panelId === 'venezuela'}
						<SituationPanel
							panelId="venezuela"
							config={{
								title: 'Venezuela Watch',
								subtitle: 'Humanitarian crisis monitoring',
								criticalKeywords: ['maduro', 'caracas', 'venezuela', 'guaido']
							}}
							news={$allNewsItems.filter(
								(n) =>
									n.title.toLowerCase().includes('venezuela') ||
									n.title.toLowerCase().includes('maduro')
							)}
						/>
					{:else if panelId === 'greenland'}
						<SituationPanel
							panelId="greenland"
							config={{
								title: 'Greenland Watch',
								subtitle: 'Arctic geopolitics monitoring',
								criticalKeywords: ['greenland', 'arctic', 'nuuk', 'denmark']
							}}
							news={$allNewsItems.filter(
								(n) =>
									n.title.toLowerCase().includes('greenland') ||
									n.title.toLowerCase().includes('arctic')
							)}
						/>
					{:else if panelId === 'iran'}
						<SituationPanel
							panelId="iran"
							config={{
								title: 'Iran Crisis',
								subtitle: 'Revolution protests, regime instability & nuclear program',
								criticalKeywords: [
									'protest',
									'uprising',
									'revolution',
									'crackdown',
									'killed',
									'nuclear',
									'strike',
									'attack',
									'irgc',
									'khamenei'
								]
							}}
							news={$allNewsItems.filter(
								(n) =>
									n.title.toLowerCase().includes('iran') ||
									n.title.toLowerCase().includes('tehran') ||
									n.title.toLowerCase().includes('irgc')
							)}
						/>
					{:else if panelId === 'gridstress'}
						<GridStressPanel gridData={gridStress} loading={gridStressLoading} onRegionClick={handleGridRegionClick} />
					{:else if panelId === 'earthquakes'}
						<EarthquakePanel {earthquakes} loading={earthquakesLoading} onEarthquakeClick={handleEarthquakeClick} />
					{:else if panelId === 'radiation'}
						<RadiationPanel readings={radiationReadings} loading={radiationLoading} onReadingClick={handleRadiationClick} />
					{:else if panelId === 'outbreaks'}
						<DiseaseOutbreakPanel outbreaks={diseaseOutbreaks} loading={outbreaksLoading} onOutbreakClick={handleOutbreakClick} />
					{:else if panelId === 'aircraft'}
						<AircraftPanel
							aircraft={aircraftData}
							history={aircraftHistory}
							{adsbEnabled}
							selectedRegions={selectedAircraftRegions}
							onSelectAircraft={handleAircraftSelect}
							onRegionsChange={handleAircraftRegionsChange}
							onAdsbToggle={handleAdsbToggle}
						/>
					{:else if panelId === 'analysis'}
						<AnalysisChatPanel
							externalData={{
								earthquakes,
								radiation: radiationReadings,
								diseaseOutbreaks,
								whaleTransactions: whales,
								govContracts: contracts,
								layoffs,
								predictions,
								gridStress,
								outages,
								correlations: $correlationResults,
								narratives: $narrativeResults,
								mainCharacters: $mainCharacterResults,
								worldLeaders: leaders
							}}
							onOpenSettings={() => settingsOpen = true}
							{actionHandlers}
							{initialDataLoaded}
						/>
					{/if}
				{/each}
			</DropZone>
		</aside>

		<!-- Center Globe Column -->
		<div class="globe-column">
			<!-- Globe as main centerpiece -->
			{#if isPanelVisible('map')}
				<div class="globe-wrapper">
					<!-- Tech corner decorations (bottom) -->
					<div class="corner-bl"></div>
					<div class="corner-br"></div>

					<GlobePanel
						monitors={$monitors.monitors}
						news={$allNewsItems}
						categorizedNews={$categorizedNewsItems}
						flyToTarget={globeFlyToTarget}
						radiationReadings={radiationReadings}
						diseaseOutbreaks={diseaseOutbreaks}
						earthquakes={earthquakes}
						onAircraftDataChange={handleAircraftDataChange}
						selectedAircraftTrack={selectedAircraftTrack}
						{adsbEnabled}
						{selectedAircraftRegions}
						onAdsbToggle={handleAdsbToggle}
					/>

					<!-- Globe overlay controls and info -->
					<div class="globe-info-overlay">
						<div class="globe-title">
							<span class="title-icon">◆</span>
							<span class="title-text">GLOBAL OVERVIEW</span>
						</div>
					</div>

					<!-- Alert overlay at bottom -->
					<div class="alert-overlay">
						<div class="alert-content">
							<span class="alert-text">MONITORING {HOTSPOTS.length} ACTIVE REGIONS</span>
						</div>
						<div class="accent-line"></div>
					</div>
				</div>
			{:else}
				<!-- Fallback to 2D map if globe is disabled -->
				<div class="map-wrapper">
					<MapPanel monitors={$monitors.monitors} />
				</div>
			{/if}

			<!-- Sub-panels below globe -->
			<div class="sub-panels">
				{#if isPanelVisible('mainchar')}
					<MainCharPanel />
				{/if}
			</div>
		</div>

		<!-- Right Panel Column -->
		<aside class="panel-column right-column">
			<DropZone zone="right" panels={rightColumnPanels} class="column-scroll">
				{#each rightColumnPanels as panelId (panelId)}
					{#if panelId === 'politics'}
						<NewsPanel category="politics" panelId="politics" title="Politics" />
					{:else if panelId === 'tech'}
						<NewsPanel category="tech" panelId="tech" title="Tech" />
					{:else if panelId === 'finance'}
						<NewsPanel category="finance" panelId="finance" title="Finance" />
					{:else if panelId === 'intel'}
						<IntelPanel />
					{:else if panelId === 'correlation'}
						<CorrelationPanel news={$allNewsItems} />
					{:else if panelId === 'narrative'}
						<NarrativePanel news={$allNewsItems} />
					{:else if panelId === 'gov'}
						<NewsPanel category="gov" panelId="gov" title="Government" />
					{:else if panelId === 'ai'}
						<NewsPanel category="ai" panelId="ai" title="AI" />
					{:else if panelId === 'leaders'}
						<WorldLeadersPanel {leaders} loading={leadersLoading} />
					{:else if panelId === 'markets'}
						<MarketsPanel />
					{:else if panelId === 'heatmap'}
						<HeatmapPanel />
					{:else if panelId === 'crypto'}
						<CryptoPanel />
					{:else if panelId === 'commodities'}
						<CommoditiesPanel />
					{:else if panelId === 'whales'}
						<WhalePanel {whales} />
					{:else if panelId === 'polymarket'}
						<PolymarketPanel {predictions} />
					{:else if panelId === 'contracts'}
						<ContractsPanel {contracts} />
					{:else if panelId === 'layoffs'}
						<LayoffsPanel {layoffs} />
					{:else if panelId === 'printer'}
						<PrinterPanel data={fedData} loading={fedLoading} />
					{:else if panelId === 'monitors'}
						<MonitorsPanel
							monitors={$monitors.monitors}
							matches={$monitors.matches}
							onCreateMonitor={handleCreateMonitor}
							onEditMonitor={handleEditMonitor}
							onDeleteMonitor={handleDeleteMonitor}
							onToggleMonitor={handleToggleMonitor}
							onViewMatches={handleViewMatches}
						/>
					{:else if panelId === 'venezuela'}
						<SituationPanel
							panelId="venezuela"
							config={{
								title: 'Venezuela Watch',
								subtitle: 'Humanitarian crisis monitoring',
								criticalKeywords: ['maduro', 'caracas', 'venezuela', 'guaido']
							}}
							news={$allNewsItems.filter(
								(n) =>
									n.title.toLowerCase().includes('venezuela') ||
									n.title.toLowerCase().includes('maduro')
							)}
						/>
					{:else if panelId === 'greenland'}
						<SituationPanel
							panelId="greenland"
							config={{
								title: 'Greenland Watch',
								subtitle: 'Arctic geopolitics monitoring',
								criticalKeywords: ['greenland', 'arctic', 'nuuk', 'denmark']
							}}
							news={$allNewsItems.filter(
								(n) =>
									n.title.toLowerCase().includes('greenland') ||
									n.title.toLowerCase().includes('arctic')
							)}
						/>
					{:else if panelId === 'iran'}
						<SituationPanel
							panelId="iran"
							config={{
								title: 'Iran Crisis',
								subtitle: 'Revolution protests, regime instability & nuclear program',
								criticalKeywords: [
									'protest',
									'uprising',
									'revolution',
									'crackdown',
									'killed',
									'nuclear',
									'strike',
									'attack',
									'irgc',
									'khamenei'
								]
							}}
							news={$allNewsItems.filter(
								(n) =>
									n.title.toLowerCase().includes('iran') ||
									n.title.toLowerCase().includes('tehran') ||
									n.title.toLowerCase().includes('irgc')
							)}
						/>
					{:else if panelId === 'gridstress'}
						<GridStressPanel gridData={gridStress} loading={gridStressLoading} onRegionClick={handleGridRegionClick} />
					{:else if panelId === 'earthquakes'}
						<EarthquakePanel {earthquakes} loading={earthquakesLoading} onEarthquakeClick={handleEarthquakeClick} />
					{:else if panelId === 'radiation'}
						<RadiationPanel readings={radiationReadings} loading={radiationLoading} onReadingClick={handleRadiationClick} />
					{:else if panelId === 'outbreaks'}
						<DiseaseOutbreakPanel outbreaks={diseaseOutbreaks} loading={outbreaksLoading} onOutbreakClick={handleOutbreakClick} />
					{:else if panelId === 'aircraft'}
						<AircraftPanel
							aircraft={aircraftData}
							history={aircraftHistory}
							{adsbEnabled}
							selectedRegions={selectedAircraftRegions}
							onSelectAircraft={handleAircraftSelect}
							onRegionsChange={handleAircraftRegionsChange}
							onAdsbToggle={handleAdsbToggle}
						/>
					{:else if panelId === 'analysis'}
						<AnalysisChatPanel
							externalData={{
								earthquakes,
								radiation: radiationReadings,
								diseaseOutbreaks,
								whaleTransactions: whales,
								govContracts: contracts,
								layoffs,
								predictions,
								gridStress,
								outages,
								correlations: $correlationResults,
								narratives: $narrativeResults,
								mainCharacters: $mainCharacterResults,
								worldLeaders: leaders
							}}
							onOpenSettings={() => settingsOpen = true}
							{actionHandlers}
							{initialDataLoaded}
						/>
					{/if}
				{/each}
			</DropZone>
		</aside>
	</main>

	<!-- Bottom Panels Row (situational awareness) -->
	<DropZone zone="bottom" panels={bottomRowPanels} class="bottom-panels">
		{#each bottomRowPanels as panelId (panelId)}
			{#if panelId === 'politics'}
				<NewsPanel category="politics" panelId="politics" title="Politics" />
			{:else if panelId === 'tech'}
				<NewsPanel category="tech" panelId="tech" title="Tech" />
			{:else if panelId === 'finance'}
				<NewsPanel category="finance" panelId="finance" title="Finance" />
			{:else if panelId === 'intel'}
				<IntelPanel />
			{:else if panelId === 'correlation'}
				<CorrelationPanel news={$allNewsItems} />
			{:else if panelId === 'narrative'}
				<NarrativePanel news={$allNewsItems} />
			{:else if panelId === 'gov'}
				<NewsPanel category="gov" panelId="gov" title="Government" />
			{:else if panelId === 'ai'}
				<NewsPanel category="ai" panelId="ai" title="AI" />
			{:else if panelId === 'leaders'}
				<WorldLeadersPanel {leaders} loading={leadersLoading} />
			{:else if panelId === 'markets'}
				<MarketsPanel />
			{:else if panelId === 'heatmap'}
				<HeatmapPanel />
			{:else if panelId === 'crypto'}
				<CryptoPanel />
			{:else if panelId === 'commodities'}
				<CommoditiesPanel />
			{:else if panelId === 'whales'}
				<WhalePanel {whales} />
			{:else if panelId === 'polymarket'}
				<PolymarketPanel {predictions} />
			{:else if panelId === 'contracts'}
				<ContractsPanel {contracts} />
			{:else if panelId === 'layoffs'}
				<LayoffsPanel {layoffs} />
			{:else if panelId === 'printer'}
				<PrinterPanel data={fedData} loading={fedLoading} />
			{:else if panelId === 'monitors'}
				<MonitorsPanel
					monitors={$monitors.monitors}
					matches={$monitors.matches}
					onCreateMonitor={handleCreateMonitor}
					onEditMonitor={handleEditMonitor}
					onDeleteMonitor={handleDeleteMonitor}
					onToggleMonitor={handleToggleMonitor}
					onViewMatches={handleViewMatches}
				/>
			{:else if panelId === 'venezuela'}
				<SituationPanel
					panelId="venezuela"
					config={{
						title: 'Venezuela Watch',
						subtitle: 'Humanitarian crisis monitoring',
						criticalKeywords: ['maduro', 'caracas', 'venezuela', 'guaido']
					}}
					news={$allNewsItems.filter(
						(n) =>
							n.title.toLowerCase().includes('venezuela') ||
							n.title.toLowerCase().includes('maduro')
					)}
				/>
			{:else if panelId === 'greenland'}
				<SituationPanel
					panelId="greenland"
					config={{
						title: 'Greenland Watch',
						subtitle: 'Arctic geopolitics monitoring',
						criticalKeywords: ['greenland', 'arctic', 'nuuk', 'denmark']
					}}
					news={$allNewsItems.filter(
						(n) =>
							n.title.toLowerCase().includes('greenland') ||
							n.title.toLowerCase().includes('arctic')
					)}
				/>
			{:else if panelId === 'iran'}
				<SituationPanel
					panelId="iran"
					config={{
						title: 'Iran Crisis',
						subtitle: 'Revolution protests, regime instability & nuclear program',
						criticalKeywords: [
							'protest',
							'uprising',
							'revolution',
							'crackdown',
							'killed',
							'nuclear',
							'strike',
							'attack',
							'irgc',
							'khamenei'
						]
					}}
					news={$allNewsItems.filter(
						(n) =>
							n.title.toLowerCase().includes('iran') ||
							n.title.toLowerCase().includes('tehran') ||
							n.title.toLowerCase().includes('irgc')
					)}
				/>
			{:else if panelId === 'gridstress'}
				<GridStressPanel gridData={gridStress} loading={gridStressLoading} onRegionClick={handleGridRegionClick} />
			{:else if panelId === 'earthquakes'}
				<EarthquakePanel {earthquakes} loading={earthquakesLoading} onEarthquakeClick={handleEarthquakeClick} />
			{:else if panelId === 'radiation'}
				<RadiationPanel readings={radiationReadings} loading={radiationLoading} onReadingClick={handleRadiationClick} />
			{:else if panelId === 'outbreaks'}
				<DiseaseOutbreakPanel outbreaks={diseaseOutbreaks} loading={outbreaksLoading} onOutbreakClick={handleOutbreakClick} />
			{:else if panelId === 'aircraft'}
				<AircraftPanel
					aircraft={aircraftData}
					history={aircraftHistory}
					{adsbEnabled}
					selectedRegions={selectedAircraftRegions}
					onSelectAircraft={handleAircraftSelect}
					onRegionsChange={handleAircraftRegionsChange}
					onAdsbToggle={handleAdsbToggle}
				/>
			{:else if panelId === 'analysis'}
				<AnalysisChatPanel
					externalData={{
						earthquakes,
						radiation: radiationReadings,
						diseaseOutbreaks,
						whaleTransactions: whales,
						govContracts: contracts,
						layoffs,
						predictions,
						gridStress,
						outages,
						correlations: $correlationResults,
						narratives: $narrativeResults,
						mainCharacters: $mainCharacterResults,
						worldLeaders: leaders
					}}
					onOpenSettings={() => settingsOpen = true}
					{initialDataLoaded}
				/>
			{/if}
		{/each}
	</DropZone>

	<!-- Modals -->
	<SettingsModal
		open={settingsOpen}
		onClose={() => (settingsOpen = false)}
		onReconfigure={handleReconfigure}
	/>
	<MonitorFormModal
		open={monitorFormOpen}
		onClose={() => (monitorFormOpen = false)}
		editMonitor={editingMonitor}
	/>
	<MonitorMatchesModal
		open={monitorMatchesOpen}
		onClose={() => (monitorMatchesOpen = false)}
		monitor={viewingMonitor}
		matches={$monitors.matches}
		onEdit={handleEditMonitor}
	/>
	<OnboardingModal open={onboardingOpen} onSelectPreset={handleSelectPreset} />
</div>

<style>
	.app {
		position: relative;
		width: 100vw;
		height: 100vh;
		background: #050505;
		color: rgb(226 232 240);
		overflow: hidden;
		font-family: 'Geist Sans', 'SF Pro Display', system-ui, sans-serif;
		display: flex;
		flex-direction: column;
	}

	/* Visual Effect Overlays */
	.vignette-overlay {
		position: fixed;
		inset: 0;
		background: radial-gradient(circle at center, transparent 0%, #000000 120%);
		pointer-events: none;
		z-index: 1;
	}

	.noise-overlay {
		position: fixed;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
		opacity: 0.03;
		pointer-events: none;
		z-index: 2;
	}

	.gradient-overlay {
		position: fixed;
		inset: 0;
		background: linear-gradient(
			45deg,
			transparent 25%,
			rgba(6, 182, 212, 0.02) 50%,
			transparent 75%
		);
		pointer-events: none;
		z-index: 2;
	}

	/* Main Layout - 12-column grid per design system */
	.main-layout {
		flex: 1;
		display: grid;
		grid-template-columns:
			minmax(220px, var(--left-col, 25%))
			minmax(400px, var(--center-col, 50%))
			minmax(220px, var(--right-col, 25%));
		gap: 0.75rem;
		padding: 0.75rem;
		overflow: hidden;
		position: relative;
		z-index: 10;
	}

	/* Compact mode adjustments */
	.app.compact .main-layout {
		gap: 0.375rem;
		padding: 0.375rem;
	}

	.app.compact .panel-column {
		gap: 0.25rem;
	}

	.app.compact :global(.column-scroll) {
		gap: 0.25rem;
	}

	.app.compact .globe-column {
		gap: 0.25rem;
	}

	.app.compact :global(.bottom-panels) {
		gap: 0.25rem;
		padding: 0 0.375rem 0.375rem;
	}

	/* Panel Columns */
	.panel-column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
		pointer-events: auto;
	}

	:global(.column-scroll) {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
		padding-right: 4px;
	}

	/* Globe Column */
	.globe-column {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
		position: relative;
	}

	.globe-wrapper {
		flex: 1;
		position: relative;
		background: rgb(2 6 23 / 0.8);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
		overflow: hidden;
		min-height: 450px;
		/* Tech corners */
		isolation: isolate;
		box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
	}

	/* Bottom corners for globe wrapper */
	.globe-wrapper .corner-bl,
	.globe-wrapper .corner-br {
		position: absolute;
		width: 8px;
		height: 8px;
		border-color: rgb(6 182 212 / 0.5);
		pointer-events: none;
		z-index: 20;
	}

	.globe-wrapper::before,
	.globe-wrapper::after {
		content: '';
		position: absolute;
		width: 8px;
		height: 8px;
		border-color: rgb(6 182 212 / 0.5);
		pointer-events: none;
		z-index: 20;
	}

	.globe-wrapper::before {
		top: 0;
		left: 0;
		border-top: 2px solid;
		border-left: 2px solid;
	}

	.globe-wrapper::after {
		top: 0;
		right: 0;
		border-top: 2px solid;
		border-right: 2px solid;
	}

	/* Additional corners via pseudo elements on inner div */
	.globe-wrapper .corner-bl {
		bottom: 0;
		left: 0;
		border-bottom: 2px solid rgb(6 182 212 / 0.5);
		border-left: 2px solid rgb(6 182 212 / 0.5);
	}

	.globe-wrapper .corner-br {
		bottom: 0;
		right: 0;
		border-bottom: 2px solid rgb(6 182 212 / 0.5);
		border-right: 2px solid rgb(6 182 212 / 0.5);
	}

	.map-wrapper {
		flex: 1;
		min-height: 400px;
	}

	/* Globe Info Overlay */
	.globe-info-overlay {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 15;
		pointer-events: none;
	}

	.globe-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgb(15 23 42 / 0.9);
		backdrop-filter: blur(8px);
		padding: 0.5rem 0.75rem;
		border: 1px solid rgb(51 65 85 / 0.5);
		border-radius: 2px;
	}

	.title-icon {
		color: rgb(34 211 238);
		font-size: 0.75rem;
	}

	.title-text {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.15em;
		color: white;
		text-transform: uppercase;
	}

	/* Alert Overlay */
	.alert-overlay {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 15;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 300px;
		pointer-events: none;
	}

	.alert-content {
		background: rgb(15 23 42 / 0.95);
		backdrop-filter: blur(8px);
		border: 1px solid rgb(51 65 85 / 0.5);
		padding: 0.5rem 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		border-radius: 2px;
	}

	.alert-text {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: white;
		font-family: 'SF Mono', Monaco, monospace;
	}

	.accent-line {
		height: 1px;
		width: 100%;
		background: linear-gradient(to right, transparent, rgb(6 182 212), transparent);
		margin-top: 0.5rem;
	}

	/* Sub Panels */
	.sub-panels {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.sub-panels > :global(*) {
		flex: 1;
	}

	/* Bottom Panels - horizontal scrollable row */
	:global(.bottom-panels) {
		display: flex;
		gap: 0.5rem;
		padding: 0 0.75rem 0.75rem;
		position: relative;
		z-index: 10;
		overflow-x: auto;
		overflow-y: hidden;
		flex-shrink: 0;
		min-height: var(--bottom-height, 220px);
	}

	:global(.bottom-panels) > :global(*) {
		flex: 0 0 auto;
		width: 320px;
		min-width: 200px;
		max-width: 600px;
		min-height: var(--bottom-height, 200px);
		max-height: var(--bottom-height, 280px);
		overflow: hidden;
	}

	/* Allow panel's explicit width to take precedence when resized */
	:global(.bottom-panels) > :global([style*="width"]) {
		flex-basis: auto !important;
	}

	/* Custom scrollbar for bottom panels */
	:global(.bottom-panels)::-webkit-scrollbar {
		height: 4px;
	}

	:global(.bottom-panels)::-webkit-scrollbar-track {
		background: rgb(15 23 42);
	}

	:global(.bottom-panels)::-webkit-scrollbar-thumb {
		background: rgb(51 65 85);
		border-radius: 2px;
	}

	:global(.bottom-panels)::-webkit-scrollbar-thumb:hover {
		background: rgb(71 85 105);
	}

	/* Responsive */
	@media (max-width: 1400px) {
		.main-layout {
			grid-template-columns: minmax(240px, 1fr) minmax(400px, 2fr) minmax(240px, 1fr);
		}
	}

	@media (max-width: 1200px) {
		.main-layout {
			grid-template-columns: 1fr 2fr;
			gap: 0.5rem;
			padding: 0.5rem;
		}

		.right-column {
			display: none;
		}

		:global(.bottom-panels) > :global(*) {
			width: 260px;
			min-width: 180px;
		}
	}

	@media (max-width: 900px) {
		.main-layout {
			grid-template-columns: 1fr;
			padding: 0.5rem;
		}

		.left-column {
			max-height: 200px;
		}

		.globe-wrapper {
			min-height: 350px;
		}

		:global(.bottom-panels) {
			padding: 0.5rem;
		}

		:global(.bottom-panels) > :global(*) {
			width: 240px;
			min-width: 160px;
		}
	}

	@media (max-width: 600px) {
		.left-column {
			display: none;
		}

		.globe-wrapper {
			min-height: 280px;
		}
	}

	/* Custom Scrollbar for columns */
	:global(.column-scroll)::-webkit-scrollbar {
		width: 4px;
	}

	:global(.column-scroll)::-webkit-scrollbar-track {
		background: rgb(15 23 42);
	}

	:global(.column-scroll)::-webkit-scrollbar-thumb {
		background: rgb(51 65 85);
		border-radius: 2px;
	}

	:global(.column-scroll)::-webkit-scrollbar-thumb:hover {
		background: rgb(71 85 105);
	}
</style>
