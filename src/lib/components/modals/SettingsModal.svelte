<script lang="ts">
	import Modal from './Modal.svelte';
	import { settings, llmPreferences } from '$lib/stores';
	import { PANELS, type PanelId } from '$lib/config';
	import { storeApiKey, getStoredApiKey, removeApiKey, hasApiKey } from '$lib/services';
	import { autoAnalysis, type AlertSeverity } from '$lib/services/auto-analysis';
	import {
		tts,
		ttsPreferences,
		storeTTSApiKey,
		getTTSApiKey,
		hasTTSApiKey,
		getVoicesForProvider,
		getDefaultVoiceForProvider,
		type TTSProvider
	} from '$lib/services/tts';
	import type { LLMProvider } from '$lib/types/llm';

	interface Props {
		open: boolean;
		onClose: () => void;
		onReconfigure?: () => void;
	}

	let { open = false, onClose, onReconfigure }: Props = $props();

	// API Key state
	let anthropicKey = $state(getStoredApiKey('anthropic') || '');
	let openaiKey = $state(getStoredApiKey('openai') || '');
	let customEndpoint = $state($llmPreferences.customEndpoint || '');
	let customKey = $state(getStoredApiKey('custom') || '');
	let selectedModel = $state($llmPreferences.model || '');
	let showApiKeys = $state(false);

	// Auto-analysis state - get initial values from autoAnalysis
	let autoEnabled = $state(false);
	let autoInterval = $state(30);
	let ttsEnabled = $state(true);
	let ttsSeverity = $state<AlertSeverity>('warning');

	// TTS state - get initial values from ttsPreferences
	let ttsProvider = $state<TTSProvider>('none');
	let ttsVoice = $state('');
	let ttsAutoPlay = $state(false);
	let ttsSpeed = $state(1.0);
	let elevenLabsKey = $state(getTTSApiKey('elevenlabs') || '');
	let openaiTtsKey = $state(getTTSApiKey('openai') || '');
	let showTtsApiKeys = $state(false);
	let ttsTesting = $state(false);

	// Track which provider has keys
	let hasAnthropicKey = $derived(hasApiKey('anthropic'));
	let hasOpenaiKey = $derived(hasApiKey('openai'));
	let hasCustomKey = $derived(hasApiKey('custom'));

	// Track TTS API keys
	let hasElevenLabsKey = $derived(hasTTSApiKey('elevenlabs'));
	let hasOpenaiTtsKey = $derived(hasTTSApiKey('openai'));

	// Get available voices for current TTS provider
	let availableTtsVoices = $derived(getVoicesForProvider(ttsProvider));

	// Initialize auto-analysis state from store
	$effect(() => {
		// Subscribe to the preferences store to get initial values
		const unsub = autoAnalysis.preferences.subscribe((prefs) => {
			autoEnabled = prefs.enabled;
			autoInterval = prefs.intervalMinutes;
			ttsEnabled = prefs.enableTTS;
			ttsSeverity = prefs.ttsSeverityThreshold;
		});
		return unsub;
	});

	// Initialize TTS state from store
	$effect(() => {
		const unsub = ttsPreferences.subscribe((prefs) => {
			ttsProvider = prefs.provider;
			ttsVoice = prefs.voice;
			ttsAutoPlay = prefs.autoPlay;
			ttsSpeed = prefs.speed;
		});
		return unsub;
	});

	// Provider options
	const PROVIDERS: { id: LLMProvider; name: string; description: string }[] = [
		{ id: 'anthropic', name: 'Anthropic (Claude)', description: 'Best for analysis tasks' },
		{ id: 'openai', name: 'OpenAI (GPT)', description: 'General purpose' },
		{ id: 'custom', name: 'Custom Endpoint', description: 'OpenAI-compatible API' }
	];

	// Model options per provider
	const MODELS: Record<LLMProvider, { id: string; name: string; description?: string }[]> = {
		anthropic: [
			{ id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus', description: 'Most capable, best for complex analysis' },
			{ id: 'claude-sonnet-4-5-20251101', name: 'Claude 4.5 Sonnet', description: 'Balanced performance and speed' },
			{ id: 'claude-sonnet-4-20250514', name: 'Claude 4 Sonnet', description: 'Fast and efficient' },
			{ id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku', description: 'Fastest response times' }
		],
		openai: [
			{ id: 'gpt-5.2-turbo', name: 'GPT-5.2 Turbo', description: 'Latest and most capable' },
			{ id: 'gpt-4.1-turbo', name: 'GPT-4.1 Turbo', description: 'Stable and reliable' },
			{ id: 'gpt-4o', name: 'GPT-4o', description: 'Optimized for speed' },
			{ id: 'o1', name: 'o1', description: 'Advanced reasoning model' },
			{ id: 'o1-mini', name: 'o1-mini', description: 'Fast reasoning model' }
		],
		custom: []
	};

	// TTS Provider options
	const TTS_PROVIDERS: { id: TTSProvider; name: string; description: string }[] = [
		{ id: 'none', name: 'Disabled', description: 'No TTS' },
		{ id: 'elevenlabs', name: 'ElevenLabs', description: 'High-quality voices' },
		{ id: 'openai', name: 'OpenAI TTS', description: 'Fast and reliable' },
		{ id: 'browser', name: 'Browser', description: 'Built-in (free)' }
	];

	function handleTogglePanel(panelId: PanelId) {
		settings.togglePanel(panelId);
	}

	function handleResetPanels() {
		settings.reset();
	}

	function handleLayoutChange(
		key: 'leftColumnWidth' | 'rightColumnWidth' | 'bottomPanelHeight',
		value: number
	) {
		settings.updateLayout({ [key]: value });
	}

	function handleCompactModeToggle() {
		settings.updateLayout({ compactMode: !$settings.layout.compactMode });
	}

	function handleSaveApiKey(provider: LLMProvider, key: string) {
		if (key.trim()) {
			storeApiKey(provider, key.trim());
		} else {
			removeApiKey(provider);
		}
	}

	function handleProviderChange(provider: LLMProvider) {
		llmPreferences.setProvider(provider);
		// Set default model for provider
		const models = MODELS[provider];
		if (models.length > 0) {
			llmPreferences.setModel(models[0].id);
			selectedModel = models[0].id;
		}
	}

	function handleModelChange(model: string) {
		llmPreferences.setModel(model);
		selectedModel = model;
	}

	function handleCustomEndpointChange(endpoint: string) {
		llmPreferences.setCustomEndpoint(endpoint);
		customEndpoint = endpoint;
	}

	function handleAutoAnalysisToggle() {
		autoEnabled = !autoEnabled;
		autoAnalysis.preferences.update(p => ({ ...p, enabled: autoEnabled }));
	}

	function handleAutoIntervalChange(minutes: number) {
		autoInterval = minutes;
		autoAnalysis.preferences.update(p => ({ ...p, intervalMinutes: minutes }));
	}

	function handleTTSToggle() {
		ttsEnabled = !ttsEnabled;
		autoAnalysis.preferences.update(p => ({ ...p, enableTTS: ttsEnabled }));
	}

	function handleTTSSeverityChange(severity: AlertSeverity) {
		ttsSeverity = severity;
		autoAnalysis.preferences.update(p => ({ ...p, ttsSeverityThreshold: severity }));
	}

	async function handleTestTTS() {
		try {
			await autoAnalysis.testTTS('This is a test of the Aegis intelligence alert system.');
		} catch (e) {
			console.error('TTS test failed:', e);
		}
	}

	// TTS Configuration Handlers
	function handleTTSProviderChange(provider: TTSProvider) {
		tts.setProvider(provider);
		ttsProvider = provider;
		// Set default voice for the new provider
		const defaultVoice = getDefaultVoiceForProvider(provider);
		tts.setVoice(defaultVoice);
		ttsVoice = defaultVoice;
		// Enable TTS when a provider is selected
		if (provider !== 'none') {
			tts.setEnabled(true);
		} else {
			tts.setEnabled(false);
		}
	}

	function handleTTSVoiceChange(voice: string) {
		tts.setVoice(voice);
		ttsVoice = voice;
	}

	function handleTTSAutoPlayToggle() {
		ttsAutoPlay = !ttsAutoPlay;
		tts.setAutoPlay(ttsAutoPlay);
	}

	function handleTTSSpeedChange(speed: number) {
		ttsSpeed = speed;
		tts.setSpeed(speed);
	}

	function handleSaveTTSApiKey(provider: 'elevenlabs' | 'openai', key: string) {
		storeTTSApiKey(provider, key);
		if (provider === 'elevenlabs') {
			elevenLabsKey = key;
		} else {
			openaiTtsKey = key;
		}
	}

	async function handleTestTTSProvider() {
		ttsTesting = true;
		try {
			await tts.test('This is a test of the Aegis text-to-speech system.');
		} catch (e) {
			console.error('TTS test failed:', e);
		} finally {
			ttsTesting = false;
		}
	}

</script>

<Modal {open} title="Settings" {onClose}>
	<div class="settings-sections">
		<!-- AI Analysis Section -->
		<section class="settings-section">
			<h3 class="section-title">AI Analysis Configuration</h3>
			<p class="section-desc">Configure your LLM provider for intelligence analysis</p>

			<div class="api-config">
				<!-- Provider Selection -->
				<div class="provider-select">
					<label class="field-label">Provider</label>
					<div class="provider-options">
						{#each PROVIDERS as provider}
							<button
								class="provider-btn"
								class:active={$llmPreferences.provider === provider.id}
								onclick={() => handleProviderChange(provider.id)}
							>
								<span class="provider-name">{provider.name}</span>
								{#if (provider.id === 'anthropic' && hasAnthropicKey) ||
									(provider.id === 'openai' && hasOpenaiKey) ||
									(provider.id === 'custom' && hasCustomKey)}
									<span class="key-indicator">KEY SET</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- API Key Input -->
				<div class="api-key-section">
					<div class="key-header">
						<label class="field-label">
							{#if $llmPreferences.provider === 'anthropic'}
								Anthropic API Key
							{:else if $llmPreferences.provider === 'openai'}
								OpenAI API Key
							{:else}
								Custom API Key
							{/if}
						</label>
						<button class="toggle-visibility" onclick={() => (showApiKeys = !showApiKeys)}>
							{showApiKeys ? 'HIDE' : 'SHOW'}
						</button>
					</div>

					{#if $llmPreferences.provider === 'anthropic'}
						<div class="input-group">
							<input
								type={showApiKeys ? 'text' : 'password'}
								class="api-input"
								placeholder="sk-ant-..."
								bind:value={anthropicKey}
								onblur={() => handleSaveApiKey('anthropic', anthropicKey)}
							/>
							{#if hasAnthropicKey}
								<span class="status-badge success">Configured</span>
							{/if}
						</div>
					{:else if $llmPreferences.provider === 'openai'}
						<div class="input-group">
							<input
								type={showApiKeys ? 'text' : 'password'}
								class="api-input"
								placeholder="sk-..."
								bind:value={openaiKey}
								onblur={() => handleSaveApiKey('openai', openaiKey)}
							/>
							{#if hasOpenaiKey}
								<span class="status-badge success">Configured</span>
							{/if}
						</div>
					{:else}
						<div class="input-group">
							<input
								type="text"
								class="api-input"
								placeholder="https://api.example.com/v1"
								bind:value={customEndpoint}
								onblur={() => handleCustomEndpointChange(customEndpoint)}
							/>
						</div>
						<div class="input-group" style="margin-top: 0.5rem">
							<input
								type={showApiKeys ? 'text' : 'password'}
								class="api-input"
								placeholder="API Key (optional)"
								bind:value={customKey}
								onblur={() => handleSaveApiKey('custom', customKey)}
							/>
						</div>
					{/if}

					<p class="key-hint">API keys are stored securely in your browser's local storage</p>
				</div>

				<!-- Model Selection -->
				{#if MODELS[$llmPreferences.provider].length > 0}
					<div class="model-select">
						<label class="field-label">Model</label>
						<select
							class="model-dropdown"
							value={selectedModel || $llmPreferences.model}
							onchange={(e) => handleModelChange(e.currentTarget.value)}
						>
							{#each MODELS[$llmPreferences.provider] as model}
								<option value={model.id}>{model.name}{model.description ? ` - ${model.description}` : ''}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>
		</section>

		<!-- Auto Analysis Section -->
		<section class="settings-section">
			<h3 class="section-title">Automatic Analysis</h3>
			<p class="section-desc">Configure periodic AI analysis with alerts</p>

			<div class="auto-analysis-config">
				<label class="toggle-control" class:enabled={autoEnabled}>
					<input type="checkbox" checked={autoEnabled} onchange={handleAutoAnalysisToggle} />
					<span>Enable Auto-Analysis</span>
					<span class="toggle-hint">Periodically analyze intelligence data</span>
				</label>

				{#if autoEnabled}
					<div class="interval-control">
						<label class="field-label">Analysis Interval</label>
						<div class="interval-options">
							{#each [15, 30, 60, 120] as minutes}
								<button
									class="interval-btn"
									class:active={autoInterval === minutes}
									onclick={() => handleAutoIntervalChange(minutes)}
								>
									{minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
								</button>
							{/each}
						</div>
					</div>

					<label class="toggle-control" class:enabled={ttsEnabled}>
						<input type="checkbox" checked={ttsEnabled} onchange={handleTTSToggle} />
						<span>Text-to-Speech Alerts</span>
						<span class="toggle-hint">Audible alerts for urgent findings</span>
					</label>

					{#if ttsEnabled}
						<div class="tts-config">
							<label class="field-label">TTS Severity Threshold</label>
							<div class="severity-options">
								{#each ['info', 'warning', 'critical'] as severity}
									<button
										class="severity-btn {severity}"
										class:active={ttsSeverity === severity}
										onclick={() => handleTTSSeverityChange(severity as AlertSeverity)}
									>
										{severity.toUpperCase()}
									</button>
								{/each}
							</div>

							<button class="test-tts-btn" onclick={handleTestTTS}> TEST TTS </button>
						</div>
					{/if}
				{/if}
			</div>
		</section>

		<!-- TTS Provider Configuration Section -->
		<section class="settings-section">
			<h3 class="section-title">Text-to-Speech (Read Aloud)</h3>
			<p class="section-desc">Configure TTS for reading AI responses aloud</p>

			<div class="tts-provider-config">
				<!-- Provider Selection -->
				<div class="provider-select">
					<label class="field-label">TTS Provider</label>
					<div class="provider-options tts-providers">
						{#each TTS_PROVIDERS as provider}
							<button
								class="provider-btn"
								class:active={ttsProvider === provider.id}
								onclick={() => handleTTSProviderChange(provider.id)}
							>
								<span class="provider-name">{provider.name}</span>
								{#if provider.id === 'elevenlabs' && hasElevenLabsKey}
									<span class="key-indicator">KEY SET</span>
								{:else if provider.id === 'openai' && hasOpenaiTtsKey}
									<span class="key-indicator">KEY SET</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				{#if ttsProvider !== 'none'}
					<!-- API Key for ElevenLabs -->
					{#if ttsProvider === 'elevenlabs'}
						<div class="api-key-section">
							<div class="key-header">
								<label class="field-label">ElevenLabs API Key</label>
								<button class="toggle-visibility" onclick={() => (showTtsApiKeys = !showTtsApiKeys)}>
									{showTtsApiKeys ? 'HIDE' : 'SHOW'}
								</button>
							</div>
							<div class="input-group">
								<input
									type={showTtsApiKeys ? 'text' : 'password'}
									class="api-input"
									placeholder="xi-..."
									bind:value={elevenLabsKey}
									onblur={() => handleSaveTTSApiKey('elevenlabs', elevenLabsKey)}
								/>
								{#if hasElevenLabsKey}
									<span class="status-badge success">Configured</span>
								{/if}
							</div>
							<p class="key-hint">Get your API key from elevenlabs.io</p>
						</div>
					{/if}

					<!-- API Key for OpenAI TTS -->
					{#if ttsProvider === 'openai'}
						<div class="api-key-section">
							<div class="key-header">
								<label class="field-label">OpenAI TTS API Key</label>
								<button class="toggle-visibility" onclick={() => (showTtsApiKeys = !showTtsApiKeys)}>
									{showTtsApiKeys ? 'HIDE' : 'SHOW'}
								</button>
							</div>
							<div class="input-group">
								<input
									type={showTtsApiKeys ? 'text' : 'password'}
									class="api-input"
									placeholder="sk-..."
									bind:value={openaiTtsKey}
									onblur={() => handleSaveTTSApiKey('openai', openaiTtsKey)}
								/>
								{#if hasOpenaiTtsKey}
									<span class="status-badge success">Configured</span>
								{/if}
							</div>
							<p class="key-hint">Uses OpenAI TTS API (separate from chat models)</p>
						</div>
					{/if}

					<!-- Voice Selection -->
					{#if availableTtsVoices.length > 0}
						<div class="voice-select">
							<label class="field-label">Voice</label>
							<select
								class="model-dropdown"
								value={ttsVoice}
								onchange={(e) => handleTTSVoiceChange(e.currentTarget.value)}
							>
								{#each availableTtsVoices as voice}
									<option value={voice.id}>
										{voice.name}{voice.description ? ` - ${voice.description}` : ''}
									</option>
								{/each}
							</select>
						</div>
					{/if}

					<!-- Speed Control -->
					<div class="speed-control">
						<div class="slider-label">
							<span class="field-label">Speed</span>
							<span class="slider-value">{ttsSpeed.toFixed(1)}x</span>
						</div>
						<input
							type="range"
							min="0.5"
							max="2.0"
							step="0.1"
							value={ttsSpeed}
							oninput={(e) => handleTTSSpeedChange(parseFloat(e.currentTarget.value))}
							class="range-slider"
						/>
					</div>

					<!-- Auto-play Toggle -->
					<label class="toggle-control" class:enabled={ttsAutoPlay}>
						<input type="checkbox" checked={ttsAutoPlay} onchange={handleTTSAutoPlayToggle} />
						<span>Auto-play Responses</span>
						<span class="toggle-hint">Automatically read AI responses</span>
					</label>

					<!-- Test Button -->
					<button
						class="test-tts-btn"
						onclick={handleTestTTSProvider}
						disabled={ttsTesting || (ttsProvider === 'elevenlabs' && !hasElevenLabsKey) || (ttsProvider === 'openai' && !hasOpenaiTtsKey)}
					>
						{ttsTesting ? 'PLAYING...' : 'TEST VOICE'}
					</button>
				{/if}
			</div>
		</section>

		<!-- Layout Section -->
		<section class="settings-section">
			<h3 class="section-title">Layout</h3>
			<p class="section-desc">Adjust column widths and panel sizes</p>

			<div class="layout-controls">
				<label class="slider-control">
					<div class="slider-label">
						<span>Left Column</span>
						<span class="slider-value">{$settings.layout.leftColumnWidth}%</span>
					</div>
					<input
						type="range"
						min="15"
						max="40"
						value={$settings.layout.leftColumnWidth}
						oninput={(e) => handleLayoutChange('leftColumnWidth', parseInt(e.currentTarget.value))}
						class="range-slider"
					/>
				</label>

				<label class="slider-control">
					<div class="slider-label">
						<span>Right Column</span>
						<span class="slider-value">{$settings.layout.rightColumnWidth}%</span>
					</div>
					<input
						type="range"
						min="15"
						max="40"
						value={$settings.layout.rightColumnWidth}
						oninput={(e) => handleLayoutChange('rightColumnWidth', parseInt(e.currentTarget.value))}
						class="range-slider"
					/>
				</label>

				<label class="slider-control">
					<div class="slider-label">
						<span>Bottom Panel Height</span>
						<span class="slider-value">{$settings.layout.bottomPanelHeight}px</span>
					</div>
					<input
						type="range"
						min="150"
						max="350"
						step="10"
						value={$settings.layout.bottomPanelHeight}
						oninput={(e) =>
							handleLayoutChange('bottomPanelHeight', parseInt(e.currentTarget.value))}
						class="range-slider"
					/>
				</label>

				<label class="compact-toggle" class:enabled={$settings.layout.compactMode}>
					<input
						type="checkbox"
						checked={$settings.layout.compactMode}
						onchange={handleCompactModeToggle}
					/>
					<span>Compact Mode</span>
					<span class="toggle-hint">Reduce padding and spacing</span>
				</label>
			</div>
		</section>

		<!-- Panels Section -->
		<section class="settings-section">
			<h3 class="section-title">Enabled Panels</h3>
			<p class="section-desc">Toggle panels on/off to customize your dashboard</p>

			<div class="panels-grid">
				{#each Object.entries(PANELS) as [id, config]}
					{@const panelId = id as PanelId}
					{@const isEnabled = $settings.enabled[panelId]}
					<label class="panel-toggle" class:enabled={isEnabled}>
						<input
							type="checkbox"
							checked={isEnabled}
							onchange={() => handleTogglePanel(panelId)}
						/>
						<span class="panel-name">{config.name}</span>
						<span class="panel-priority">P{config.priority}</span>
					</label>
				{/each}
			</div>
		</section>

		<section class="settings-section">
			<h3 class="section-title">Dashboard</h3>
			{#if onReconfigure}
				<button class="reconfigure-btn" onclick={onReconfigure}> RECONFIGURE DASHBOARD </button>
				<p class="btn-hint">Choose a preset profile for your panels</p>
			{/if}
			<button class="reset-btn" onclick={handleResetPanels}> RESET ALL SETTINGS </button>
		</section>
	</div>
</Modal>

<style>
	.settings-sections {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.section-title {
		font-size: 0.625rem;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: var(--accent);
		margin: 0;
	}

	.section-desc {
		font-size: 0.625rem;
		color: var(--text-muted);
		margin: 0;
	}

	/* Layout Controls */
	.layout-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.slider-control {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.slider-label {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.625rem;
		color: var(--text);
	}

	.slider-value {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--accent);
		font-weight: 700;
	}

	.range-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		outline: none;
	}

	.range-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		background: var(--accent);
		border-radius: 2px;
		cursor: pointer;
		transition: box-shadow 0.15s ease;
	}

	.range-slider::-webkit-slider-thumb:hover {
		box-shadow: 0 0 8px var(--accent-glow);
	}

	.range-slider::-moz-range-thumb {
		width: 12px;
		height: 12px;
		background: var(--accent);
		border-radius: 2px;
		cursor: pointer;
		border: none;
	}

	.compact-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.625rem;
		color: var(--text);
	}

	.compact-toggle:hover {
		background: var(--surface-hover);
		border-color: var(--accent-border);
	}

	.compact-toggle.enabled {
		border-color: var(--accent-border);
		background: rgba(34, 211, 238, 0.1);
	}

	.compact-toggle input {
		accent-color: var(--accent);
	}

	.toggle-hint {
		margin-left: auto;
		font-size: 0.5rem;
		color: var(--text-muted);
	}

	.panels-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.panel-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.6rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.panel-toggle:hover {
		background: var(--surface-hover);
		border-color: var(--accent-border);
	}

	.panel-toggle.enabled {
		border-color: var(--accent-border);
		background: rgba(34, 211, 238, 0.1);
	}

	.panel-toggle input {
		accent-color: var(--accent);
	}

	.panel-name {
		flex: 1;
		font-size: 0.625rem;
		color: var(--text);
	}

	.panel-priority {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		background: var(--interactive-bg);
		padding: 0.1rem 0.25rem;
		border-radius: 2px;
		border: 1px solid var(--border);
	}

	.reconfigure-btn {
		padding: 0.5rem 1rem;
		background: rgba(34, 211, 238, 0.1);
		border: 1px solid var(--accent-border);
		border-radius: 2px;
		color: var(--accent);
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s ease;
		margin-bottom: 0.25rem;
	}

	.reconfigure-btn:hover {
		background: rgba(34, 211, 238, 0.2);
		border-color: var(--accent);
	}

	.btn-hint {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		margin: 0 0 0.75rem;
	}

	.reset-btn {
		padding: 0.5rem 1rem;
		background: var(--critical-bg);
		border: 1px solid var(--critical-border);
		border-radius: 2px;
		color: var(--danger);
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.reset-btn:hover {
		background: rgba(239, 68, 68, 0.2);
		border-color: var(--danger);
	}

	/* API Configuration Styles */
	.api-config {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field-label {
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		margin-bottom: 0.25rem;
		display: block;
	}

	.provider-options {
		display: flex;
		gap: 0.5rem;
	}

	.provider-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.provider-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent-border);
	}

	.provider-btn.active {
		border-color: var(--accent);
		background: rgba(34, 211, 238, 0.1);
	}

	.provider-name {
		font-size: 0.5625rem;
		color: var(--text);
		font-weight: 500;
	}

	.key-indicator {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--success);
		background: rgba(16, 185, 129, 0.1);
		padding: 0.1rem 0.25rem;
		border-radius: 2px;
	}

	.api-key-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.key-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.toggle-visibility {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		background: transparent;
		border: 1px solid var(--border);
		padding: 0.15rem 0.35rem;
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-visibility:hover {
		color: var(--accent);
		border-color: var(--accent-border);
	}

	.input-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.api-input {
		flex: 1;
		padding: 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		outline: none;
		transition: all 0.15s ease;
	}

	.api-input:focus {
		border-color: var(--accent);
		background: rgba(34, 211, 238, 0.05);
	}

	.api-input::placeholder {
		color: var(--text-muted);
		opacity: 0.6;
	}

	.status-badge {
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		padding: 0.15rem 0.35rem;
		border-radius: 2px;
		white-space: nowrap;
	}

	.status-badge.success {
		color: var(--success);
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.key-hint {
		font-size: 0.5rem;
		color: var(--text-muted);
		margin: 0.25rem 0 0 0;
		opacity: 0.7;
	}

	.model-select {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.model-dropdown {
		padding: 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		outline: none;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.model-dropdown:focus {
		border-color: var(--accent);
	}

	.model-dropdown option {
		background: var(--card-bg);
		color: var(--text);
	}

	/* Auto Analysis Styles */
	.auto-analysis-config {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.toggle-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.625rem;
		color: var(--text);
	}

	.toggle-control:hover {
		background: var(--surface-hover);
		border-color: var(--accent-border);
	}

	.toggle-control.enabled {
		border-color: var(--accent-border);
		background: rgba(34, 211, 238, 0.1);
	}

	.toggle-control input {
		accent-color: var(--accent);
	}

	.interval-control {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.interval-options {
		display: flex;
		gap: 0.5rem;
	}

	.interval-btn {
		flex: 1;
		padding: 0.4rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.5625rem;
		font-family: 'SF Mono', Monaco, monospace;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.interval-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent-border);
	}

	.interval-btn.active {
		border-color: var(--accent);
		background: rgba(34, 211, 238, 0.1);
		color: var(--accent);
	}

	.tts-config {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
	}

	.severity-options {
		display: flex;
		gap: 0.5rem;
	}

	.severity-btn {
		flex: 1;
		padding: 0.4rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.severity-btn.info {
		color: var(--accent);
	}

	.severity-btn.warning {
		color: var(--warning);
	}

	.severity-btn.critical {
		color: var(--danger);
	}

	.severity-btn:hover {
		background: var(--surface-hover);
	}

	.severity-btn.active {
		background: rgba(34, 211, 238, 0.1);
	}

	.severity-btn.active.info {
		border-color: var(--accent);
	}

	.severity-btn.active.warning {
		border-color: var(--warning);
		background: rgba(245, 158, 11, 0.1);
	}

	.severity-btn.active.critical {
		border-color: var(--danger);
		background: rgba(239, 68, 68, 0.1);
	}

	.test-tts-btn {
		margin-top: 0.25rem;
		padding: 0.4rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-size: 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.test-tts-btn:hover:not(:disabled) {
		background: var(--surface-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	.test-tts-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* TTS Provider Configuration Styles */
	.tts-provider-config {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tts-providers {
		flex-wrap: wrap;
	}

	.voice-select {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.speed-control {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
</style>
