<script lang="ts">
	import Modal from './Modal.svelte';
	import { weather, alertCount, zoneCount, weatherLoading } from '$lib/stores/weather';
	import { US_STATES, PREDEFINED_REGIONS, ALERT_SEVERITY_COLORS } from '$lib/config/weather';
	import type { WeatherAlert, AlertSeverity } from '$lib/types';

	interface Props {
		open: boolean;
		onClose: () => void;
		onAlertSelect?: (alert: WeatherAlert) => void;
	}

	let { open = false, onClose, onAlertSelect }: Props = $props();

	// Tab state
	let activeTab = $state<'alerts' | 'zones' | 'briefing'>('alerts');

	// Zones tab state
	let showStateSelector = $state(false);
	let newPointName = $state('');
	let newPointLat = $state('');
	let newPointLon = $state('');

	// Briefing tab state
	let briefingFormat = $state<'text' | 'markdown' | 'json'>('text');
	let generatedBriefing = $state<string | null>(null);
	let copySuccess = $state(false);

	// Derived values from store
	let alerts = $derived($weather.alerts);
	let zones = $derived($weather.zones);
	let isLoading = $derived($weatherLoading);
	let alertsLastUpdated = $derived($weather.alertsLastUpdated);

	/**
	 * Get severity color classes for an alert
	 */
	function getSeverityColors(severity: AlertSeverity) {
		return ALERT_SEVERITY_COLORS[severity] || ALERT_SEVERITY_COLORS.Unknown;
	}

	/**
	 * Format timestamp for display
	 */
	function formatTime(timestamp: string | number | null): string {
		if (!timestamp) return 'N/A';
		const date = new Date(timestamp);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Handle clicking on an alert
	 */
	function handleAlertClick(alert: WeatherAlert) {
		if (onAlertSelect) {
			onAlertSelect(alert);
		}
		onClose();
	}

	/**
	 * Add a state zone
	 */
	function addState(code: string) {
		const state = US_STATES.find((s) => s.code === code);
		if (state) {
			weather.addStateZone(state.code, state.name);
		}
		showStateSelector = false;
	}

	/**
	 * Add a predefined region
	 */
	function addRegion(id: string) {
		weather.addRegion(id);
	}

	/**
	 * Add a custom point zone
	 */
	function addCustomPoint() {
		const lat = parseFloat(newPointLat);
		const lon = parseFloat(newPointLon);

		if (isNaN(lat) || isNaN(lon)) {
			return;
		}

		if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
			return;
		}

		const name = newPointName.trim() || `Point ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
		weather.addPointZone(name, lat, lon);

		// Reset form
		newPointName = '';
		newPointLat = '';
		newPointLon = '';
	}

	/**
	 * Refresh weather data
	 */
	async function refreshData() {
		await weather.refresh();
	}

	/**
	 * Generate a briefing
	 */
	function generateBriefing() {
		const briefing = weather.generateBriefing(briefingFormat);
		generatedBriefing = briefing.content;
	}

	/**
	 * Copy briefing to clipboard
	 */
	async function copyBriefing() {
		if (!generatedBriefing) return;

		try {
			await navigator.clipboard.writeText(generatedBriefing);
			copySuccess = true;
			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch (e) {
			console.error('Failed to copy to clipboard:', e);
		}
	}

	/**
	 * Check if a state is already added
	 */
	function isStateAdded(code: string): boolean {
		return zones.some((z) => z.type === 'state' && z.code === code);
	}
</script>

<Modal {open} title="Weather Command Center" {onClose} size="large">
	<div class="weather-modal">
		<!-- Tab Navigation -->
		<div class="tabs">
			<button
				class="tab"
				class:active={activeTab === 'alerts'}
				onclick={() => (activeTab = 'alerts')}
			>
				ALERTS
				{#if $alertCount > 0}
					<span class="tab-badge">{$alertCount}</span>
				{/if}
			</button>
			<button
				class="tab"
				class:active={activeTab === 'zones'}
				onclick={() => (activeTab = 'zones')}
			>
				ZONES
				{#if $zoneCount > 0}
					<span class="tab-badge">{$zoneCount}</span>
				{/if}
			</button>
			<button
				class="tab"
				class:active={activeTab === 'briefing'}
				onclick={() => (activeTab = 'briefing')}
			>
				BRIEFING
			</button>

			<!-- Refresh Button -->
			<button class="refresh-btn" onclick={refreshData} disabled={isLoading}>
				{isLoading ? 'LOADING...' : 'REFRESH'}
			</button>
		</div>

		<!-- Alerts Tab -->
		{#if activeTab === 'alerts'}
			<div class="tab-content">
				{#if alertsLastUpdated}
					<div class="last-updated">
						Last updated: {formatTime(alertsLastUpdated)}
					</div>
				{/if}

				{#if zones.filter((z) => z.type === 'state' && z.enabled).length === 0}
					<div class="empty-state">
						<p>No zones configured</p>
						<p class="hint">Add zones in the Zones tab to receive alerts</p>
					</div>
				{:else if alerts.length === 0}
					<div class="empty-state">
						<p>No active alerts</p>
						<p class="hint">No weather alerts in monitored zones</p>
					</div>
				{:else}
					<div class="alerts-list">
						{#each alerts as alert (alert.id)}
							{@const colors = getSeverityColors(alert.severity)}
							<button
								class="alert-item {colors.bg} {colors.border}"
								onclick={() => handleAlertClick(alert)}
							>
								<div class="alert-header">
									<span class="severity-badge {colors.text}">{alert.severity}</span>
									<span class="event-type">{alert.event}</span>
								</div>
								<div class="alert-area">{alert.areaDesc}</div>
								{#if alert.headline}
									<div class="alert-headline">{alert.headline}</div>
								{/if}
								<div class="alert-times">
									<span>Effective: {formatTime(alert.effective)}</span>
									<span>Expires: {formatTime(alert.expires)}</span>
								</div>
								{#if alert.instruction}
									<div class="alert-instruction">{alert.instruction}</div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Zones Tab -->
		{#if activeTab === 'zones'}
			<div class="tab-content">
				<!-- Quick Region Add -->
				<section class="zone-section">
					<h4 class="zone-section-title">Quick Add Region</h4>
					<div class="region-buttons">
						{#each PREDEFINED_REGIONS as region}
							<button class="region-btn" onclick={() => addRegion(region.id)} title={region.description}>
								{region.name}
							</button>
						{/each}
					</div>
				</section>

				<!-- State Selector -->
				<section class="zone-section">
					<div class="section-header">
						<h4 class="zone-section-title">Add State</h4>
						<button
							class="toggle-selector-btn"
							onclick={() => (showStateSelector = !showStateSelector)}
						>
							{showStateSelector ? 'HIDE' : 'SHOW'} STATES
						</button>
					</div>

					{#if showStateSelector}
						<div class="state-grid">
							{#each US_STATES as state}
								<button
									class="state-btn"
									class:added={isStateAdded(state.code)}
									onclick={() => addState(state.code)}
									disabled={isStateAdded(state.code)}
									title={state.name}
								>
									{state.code}
								</button>
							{/each}
						</div>
					{/if}
				</section>

				<!-- Custom Point -->
				<section class="zone-section">
					<h4 class="zone-section-title">Add Custom Point</h4>
					<div class="point-form">
						<input
							type="text"
							class="point-input"
							placeholder="Name (optional)"
							bind:value={newPointName}
						/>
						<div class="coord-inputs">
							<input
								type="text"
								class="point-input coord"
								placeholder="Latitude"
								bind:value={newPointLat}
							/>
							<input
								type="text"
								class="point-input coord"
								placeholder="Longitude"
								bind:value={newPointLon}
							/>
						</div>
						<button
							class="add-point-btn"
							onclick={addCustomPoint}
							disabled={!newPointLat || !newPointLon}
						>
							ADD POINT
						</button>
					</div>
				</section>

				<!-- Zone List -->
				<section class="zone-section">
					<h4 class="zone-section-title">Active Zones ({zones.length})</h4>
					{#if zones.length === 0}
						<div class="empty-state small">
							<p>No zones configured</p>
						</div>
					{:else}
						<div class="zone-list">
							{#each zones as zone (zone.id)}
								<div class="zone-item" class:disabled={!zone.enabled}>
									<button
										class="zone-toggle"
										class:enabled={zone.enabled}
										onclick={() => weather.toggleZone(zone.id)}
										title={zone.enabled ? 'Disable zone' : 'Enable zone'}
									>
										{zone.enabled ? 'ON' : 'OFF'}
									</button>
									<div class="zone-info">
										<span class="zone-name">{zone.name}</span>
										<span class="zone-type">{zone.type.toUpperCase()}</span>
										{#if zone.type === 'point' && zone.lat !== undefined && zone.lon !== undefined}
											<span class="zone-coords">{zone.lat.toFixed(2)}, {zone.lon.toFixed(2)}</span>
										{/if}
									</div>
									<button
										class="zone-remove"
										onclick={() => weather.removeZone(zone.id)}
										title="Remove zone"
									>
										X
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			</div>
		{/if}

		<!-- Briefing Tab -->
		{#if activeTab === 'briefing'}
			<div class="tab-content">
				<section class="briefing-section">
					<h4 class="zone-section-title">Briefing Format</h4>
					<div class="format-options">
						<label class="format-option" class:active={briefingFormat === 'text'}>
							<input
								type="radio"
								name="format"
								value="text"
								bind:group={briefingFormat}
							/>
							<span>Text</span>
						</label>
						<label class="format-option" class:active={briefingFormat === 'markdown'}>
							<input
								type="radio"
								name="format"
								value="markdown"
								bind:group={briefingFormat}
							/>
							<span>Markdown</span>
						</label>
						<label class="format-option" class:active={briefingFormat === 'json'}>
							<input
								type="radio"
								name="format"
								value="json"
								bind:group={briefingFormat}
							/>
							<span>JSON</span>
						</label>
					</div>

					<button
						class="generate-btn"
						onclick={generateBriefing}
						disabled={zones.filter((z) => z.enabled).length === 0}
					>
						GENERATE BRIEFING
					</button>
				</section>

				{#if generatedBriefing}
					<section class="briefing-section">
						<div class="briefing-header">
							<h4 class="zone-section-title">Generated Briefing</h4>
							<button
								class="copy-btn"
								class:success={copySuccess}
								onclick={copyBriefing}
							>
								{copySuccess ? 'COPIED!' : 'COPY'}
							</button>
						</div>
						<pre class="briefing-output">{generatedBriefing}</pre>
					</section>
				{/if}
			</div>
		{/if}
	</div>
</Modal>

<style>
	.weather-modal {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 400px;
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.5rem;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 2px;
		color: var(--text-muted);
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tab:hover {
		color: var(--text);
		background: var(--surface-hover);
	}

	.tab.active {
		color: var(--accent);
		border-color: var(--accent-border);
		background: rgba(34, 211, 238, 0.1);
	}

	.tab-badge {
		font-size: 0.5rem;
		font-weight: 700;
		background: var(--accent);
		color: #000;
		padding: 0.1rem 0.3rem;
		border-radius: 2px;
		min-width: 1.2rem;
		text-align: center;
	}

	.refresh-btn {
		margin-left: auto;
		padding: 0.4rem 0.6rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		letter-spacing: 0.05em;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.refresh-btn:hover:not(:disabled) {
		border-color: var(--accent-border);
		color: var(--accent);
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Tab Content */
	.tab-content {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.last-updated {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		text-align: right;
	}

	/* Empty State */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		color: var(--text-muted);
		text-align: center;
	}

	.empty-state.small {
		padding: 1rem;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.625rem;
	}

	.empty-state .hint {
		font-size: 0.5rem;
		opacity: 0.7;
		margin-top: 0.25rem;
	}

	/* Alerts List */
	.alerts-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.alert-item {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.75rem;
		border: 1px solid;
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
		width: 100%;
	}

	.alert-item:hover {
		filter: brightness(1.1);
	}

	.alert-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.severity-badge {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.event-type {
		font-size: 0.625rem;
		font-weight: 600;
		color: var(--text);
	}

	.alert-area {
		font-size: 0.5625rem;
		color: var(--text);
	}

	.alert-headline {
		font-size: 0.5rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.alert-times {
		display: flex;
		gap: 1rem;
		font-size: 0.45rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
	}

	.alert-instruction {
		font-size: 0.5rem;
		color: var(--text-muted);
		line-height: 1.4;
		border-top: 1px solid var(--border);
		padding-top: 0.35rem;
		margin-top: 0.25rem;
	}

	/* Zone Sections */
	.zone-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.zone-section-title {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--accent);
		margin: 0;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.toggle-selector-btn {
		font-size: 0.45rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		color: var(--text-muted);
		background: transparent;
		border: 1px solid var(--border);
		padding: 0.2rem 0.4rem;
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-selector-btn:hover {
		color: var(--accent);
		border-color: var(--accent-border);
	}

	/* Region Buttons */
	.region-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.region-btn {
		padding: 0.35rem 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.region-btn:hover {
		border-color: var(--accent-border);
		color: var(--accent);
		background: rgba(34, 211, 238, 0.1);
	}

	/* State Grid */
	.state-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
		gap: 0.25rem;
		padding: 0.5rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
		max-height: 150px;
		overflow-y: auto;
	}

	.state-btn {
		padding: 0.3rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.state-btn:hover:not(:disabled) {
		border-color: var(--accent-border);
		color: var(--accent);
	}

	.state-btn.added {
		border-color: var(--success);
		color: var(--success);
		background: rgba(16, 185, 129, 0.1);
	}

	.state-btn:disabled {
		cursor: not-allowed;
	}

	/* Point Form */
	.point-form {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.point-input {
		padding: 0.4rem 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		outline: none;
		transition: all 0.15s ease;
	}

	.point-input:focus {
		border-color: var(--accent);
		background: rgba(34, 211, 238, 0.05);
	}

	.point-input::placeholder {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.coord-inputs {
		display: flex;
		gap: 0.35rem;
	}

	.coord-inputs .coord {
		flex: 1;
	}

	.add-point-btn {
		padding: 0.4rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.add-point-btn:hover:not(:disabled) {
		border-color: var(--accent-border);
		color: var(--accent);
		background: rgba(34, 211, 238, 0.1);
	}

	.add-point-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Zone List */
	.zone-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 200px;
		overflow-y: auto;
	}

	.zone-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		transition: all 0.15s ease;
	}

	.zone-item.disabled {
		opacity: 0.5;
	}

	.zone-toggle {
		padding: 0.2rem 0.35rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-muted);
		font-size: 0.45rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.zone-toggle.enabled {
		border-color: var(--success);
		color: var(--success);
		background: rgba(16, 185, 129, 0.1);
	}

	.zone-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.zone-name {
		font-size: 0.5625rem;
		color: var(--text);
	}

	.zone-type {
		font-size: 0.45rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		background: rgba(0, 0, 0, 0.3);
		padding: 0.1rem 0.25rem;
		border-radius: 2px;
	}

	.zone-coords {
		font-size: 0.45rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--accent);
	}

	.zone-remove {
		padding: 0.2rem 0.35rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-muted);
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.zone-remove:hover {
		border-color: var(--danger);
		color: var(--danger);
		background: rgba(239, 68, 68, 0.1);
	}

	/* Briefing Section */
	.briefing-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.format-options {
		display: flex;
		gap: 0.5rem;
	}

	.format-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.6rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.5625rem;
		color: var(--text);
	}

	.format-option:hover {
		background: var(--surface-hover);
		border-color: var(--accent-border);
	}

	.format-option.active {
		border-color: var(--accent);
		background: rgba(34, 211, 238, 0.1);
		color: var(--accent);
	}

	.format-option input {
		accent-color: var(--accent);
	}

	.generate-btn {
		padding: 0.5rem 1rem;
		background: rgba(34, 211, 238, 0.1);
		border: 1px solid var(--accent-border);
		border-radius: 2px;
		color: var(--accent);
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.generate-btn:hover:not(:disabled) {
		background: rgba(34, 211, 238, 0.2);
		border-color: var(--accent);
	}

	.generate-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.briefing-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.copy-btn {
		padding: 0.3rem 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.45rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.copy-btn:hover {
		border-color: var(--accent-border);
		color: var(--accent);
	}

	.copy-btn.success {
		border-color: var(--success);
		color: var(--success);
		background: rgba(16, 185, 129, 0.1);
	}

	.briefing-output {
		margin: 0;
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border);
		border-radius: 2px;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text);
		white-space: pre-wrap;
		word-wrap: break-word;
		max-height: 300px;
		overflow-y: auto;
		line-height: 1.5;
	}
</style>
