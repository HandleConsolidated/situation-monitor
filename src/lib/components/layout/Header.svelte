<script lang="ts">
	import { isRefreshing, lastRefresh, alerts as newsAlerts } from '$lib/stores';
	import { autoAnalysis, type AnalysisAlert } from '$lib/services/auto-analysis';
	import { tts, ttsPreferences, playAlertSoundOnce } from '$lib/services/tts';
	import { get } from 'svelte/store';

	interface Props {
		onSettingsClick?: () => void;
		onRefreshClick?: () => void;
		onScenarioBuilderClick?: () => void;
		onNetworkGraphClick?: () => void;
	}

	let { onSettingsClick, onRefreshClick, onScenarioBuilderClick, onNetworkGraphClick }: Props = $props();

	// Alert playback state
	let isPlayingAlerts = $state(false);
	let playbackError = $state<string | null>(null);

	// Subscribe to autoAnalysis state
	const autoAnalysisState = autoAnalysis.state;

	// Get recent analysis alerts (up to 3)
	const analysisAlerts = $derived(
		$autoAnalysisState.alerts
			.filter((a: AnalysisAlert) => !a.acknowledged)
			.slice(0, 3)
	);

	// Get recent news alerts as fallback (up to 3)
	const recentNewsAlerts = $derived($newsAlerts.slice(0, 3));

	// Combined alert count - prefer analysis alerts, fall back to news alerts
	const alertCount = $derived(analysisAlerts.length > 0 ? analysisAlerts.length : recentNewsAlerts.length);
	const hasAlerts = $derived(alertCount > 0);

	// Check if TTS is properly configured
	function isTTSConfigured(): boolean {
		const prefs = get(ttsPreferences);
		return prefs.enabled && prefs.provider !== 'none';
	}

	// Helper for pauses between speech segments
	function pause(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	// Convert number to ordinal word for natural speech
	function getOrdinalWord(n: number): string {
		const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
		return ordinals[n - 1] || `Number ${n}`;
	}

	// Clean and format text for better TTS pronunciation
	function formatForTTS(text: string): string {
		return text
			// Remove markdown formatting
			.replace(/\*\*/g, '')
			.replace(/\*/g, '')
			.replace(/_/g, ' ')
			.replace(/`/g, '')
			.replace(/#{1,6}\s/g, '')
			// Remove URLs
			.replace(/https?:\/\/\S+/g, '')
			// Fix common abbreviations for pronunciation
			.replace(/U\.S\./g, 'U.S.')
			.replace(/U\.K\./g, 'U.K.')
			.replace(/E\.U\./g, 'E.U.')
			.replace(/vs\./g, 'versus')
			.replace(/etc\./g, 'etcetera')
			.replace(/govt\./gi, 'government')
			.replace(/approx\./gi, 'approximately')
			// Handle common news abbreviations
			.replace(/GOP/g, 'G.O.P.')
			.replace(/GDP/g, 'G.D.P.')
			.replace(/CEO/g, 'C.E.O.')
			.replace(/AI(?![a-z])/g, 'A.I.')
			// Clean up punctuation for better pacing
			.replace(/\.{2,}/g, '.')
			.replace(/!{2,}/g, '!')
			.replace(/\?{2,}/g, '?')
			.replace(/—/g, ', ')
			.replace(/–/g, ', ')
			.replace(/\s*-\s*/g, ' ')
			// Clean whitespace
			.replace(/\s+/g, ' ')
			.trim();
	}

	// Format current time for speech
	function getSpokenTime(): string {
		return new Date().toLocaleTimeString([], {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	// Play alerts with TTS - Professional briefing format
	async function playRecentAlerts() {
		if (isPlayingAlerts) {
			tts.stop();
			isPlayingAlerts = false;
			return;
		}

		if (!isTTSConfigured()) {
			playbackError = 'TTS not enabled - configure in Settings';
			setTimeout(() => playbackError = null, 4000);
			return;
		}

		isPlayingAlerts = true;
		playbackError = null;

		try {
			const spokenTime = getSpokenTime();

			// Play the alert sound ONCE at the beginning of the sequence
			console.log('[Header] Playing alert sound once at start of alert sequence');
			await playAlertSoundOnce();
			await pause(300); // Brief pause after alert sound before speech begins

			if (analysisAlerts.length > 0) {
				// === INTELLIGENCE BRIEFING FORMAT ===
				const alertWord = analysisAlerts.length === 1 ? 'item' : 'items';
				const hasCritical = analysisAlerts.some(a => a.severity === 'critical');
				const hasWarning = analysisAlerts.some(a => a.severity === 'warning');

				// Opening with severity context
				let opening = `Artemis intelligence briefing, ${spokenTime}. `;
				if (hasCritical) {
					opening += `Attention: ${analysisAlerts.length} priority ${alertWord} requiring immediate review.`;
				} else if (hasWarning) {
					opening += `${analysisAlerts.length} elevated priority ${alertWord} for your attention.`;
				} else {
					opening += `${analysisAlerts.length} ${alertWord} in the queue.`;
				}

				// Skip alert sound for all speak calls since we already played it once
				await tts.speak(opening, { skipAlertSound: true });
				await pause(600);

				// Read each alert with structure
				for (let i = 0; i < analysisAlerts.length; i++) {
					if (!isPlayingAlerts) break;

					const alert = analysisAlerts[i];
					const position = getOrdinalWord(i + 1);
					const cleanSummary = formatForTTS(alert.summary);

					// Build the alert script
					let alertScript = `${position}. `;

					if (alert.severity === 'critical') {
						alertScript += 'Critical priority. ';
					} else if (alert.severity === 'warning') {
						alertScript += 'Elevated concern. ';
					}

					alertScript += cleanSummary;

					await tts.speak(alertScript, { skipAlertSound: true });

					// Longer pause after critical alerts
					await pause(alert.severity === 'critical' ? 800 : 500);
				}

				// Closing
				await pause(300);
				await tts.speak('End of briefing. Artemis standing by.', { skipAlertSound: true });

			} else if (recentNewsAlerts.length > 0) {
				// === NEWS HEADLINES FORMAT ===
				const headlineWord = recentNewsAlerts.length === 1 ? 'headline' : 'headlines';

				await tts.speak(
					`Artemis news update, ${spokenTime}. ` +
					`No active intelligence alerts. ` +
					`Reading ${recentNewsAlerts.length} priority ${headlineWord}.`,
					{ skipAlertSound: true }
				);
				await pause(600);

				for (let i = 0; i < recentNewsAlerts.length; i++) {
					if (!isPlayingAlerts) break;

					const newsItem = recentNewsAlerts[i];
					const position = getOrdinalWord(i + 1);
					const cleanTitle = formatForTTS(newsItem.title);

					// Include source if available
					let newsScript = `${position}. `;
					if (newsItem.source) {
						newsScript += `From ${newsItem.source}: `;
					}
					newsScript += cleanTitle;

					await tts.speak(newsScript, { skipAlertSound: true });
					await pause(500);
				}

				await pause(300);
				await tts.speak('End of headlines.', { skipAlertSound: true });

			} else {
				// === STATUS REPORT FORMAT ===
				await tts.speak(
					`Artemis status report, ${spokenTime}. ` +
					`All clear. No active intelligence alerts. No priority headlines detected. ` +
					`All monitored systems are nominal. Standing by for updates.`,
					{ skipAlertSound: true }
				);
			}
		} catch (e) {
			console.error('TTS playback error:', e);
			const errorMsg = e instanceof Error ? e.message : 'Playback failed';
			playbackError = errorMsg;
			setTimeout(() => playbackError = null, 4000);
		} finally {
			isPlayingAlerts = false;
		}
	}

	const lastRefreshText = $derived(
		$lastRefresh
			? new Date($lastRefresh).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
			: '--:--'
	);

	let currentTime = $state(
		new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	);

	// Update time every second
	$effect(() => {
		const interval = setInterval(() => {
			currentTime = new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
		}, 1000);
		return () => clearInterval(interval);
	});
</script>

<header class="header">
	<!-- Tech Corner Decorations -->
	<div class="tech-corner top-left"></div>
	<div class="tech-corner top-right"></div>

	<div class="header-left">
		<div class="logo-container">
			<span class="logo-icon">◇</span>
			<h1 class="logo"><span class="logo-project">PROJECT</span> <span class="logo-name">ARTEMIS</span></h1>
			<span class="logo-subtitle">SITUATION MONITOR</span>
		</div>
	</div>

	<div class="header-center">
		<div class="status-bar">
			<!-- System Time -->
			<div class="status-item">
				<span class="status-label">SYS</span>
				<span class="status-value">{currentTime}</span>
			</div>

			<div class="status-divider"></div>

			<!-- Refresh Status -->
			<div class="status-item">
				<span class="status-label">SYNC</span>
				{#if $isRefreshing}
					<span class="status-dot active"></span>
					<span class="status-value active">UPDATING</span>
				{:else}
					<span class="status-dot"></span>
					<span class="status-value">{lastRefreshText}</span>
				{/if}
			</div>

			<div class="status-divider"></div>

			<!-- System Status -->
			<div class="status-item">
				<span class="status-label">STATUS</span>
				<span class="status-dot online"></span>
				<span class="status-value online">ONLINE</span>
			</div>
		</div>
	</div>

	<div class="header-right">
		<!-- Play Alerts Button -->
		<button
			class="header-btn alerts-btn"
			class:playing={isPlayingAlerts}
			class:has-alerts={hasAlerts}
			class:error={playbackError}
			onclick={playRecentAlerts}
			title={playbackError || (isPlayingAlerts ? 'Stop Playback' : hasAlerts ? `Play ${alertCount} Alert${alertCount > 1 ? 's' : ''}` : 'No Active Alerts')}
		>
			{#if isPlayingAlerts}
				<span class="btn-icon stop-icon">◼</span>
				<span class="btn-label">STOP</span>
			{:else}
				<span class="btn-icon play-icon">▶</span>
				{#if hasAlerts}
					<span class="alert-badge">{alertCount}</span>
				{/if}
				<span class="btn-label">ALERTS</span>
			{/if}
		</button>

		{#if onNetworkGraphClick}
			<button
				class="header-btn"
				onclick={onNetworkGraphClick}
				title="Network Graph (Cmd+K → 'graph')"
			>
				<span class="btn-icon">🌐</span>
				<span class="btn-label">GRAPH</span>
			</button>
		{/if}
		{#if onScenarioBuilderClick}
			<button
				class="header-btn"
				onclick={onScenarioBuilderClick}
				title="Scenario Builder (Cmd+K → 'scenario')"
			>
				<span class="btn-icon">🎯</span>
				<span class="btn-label">SCENARIOS</span>
			</button>
		{/if}
		{#if onRefreshClick}
			<button
				class="header-btn refresh-btn"
				onclick={onRefreshClick}
				title="Refresh Data (Cmd+R)"
				disabled={$isRefreshing}
			>
				<span class="btn-icon" class:spinning={$isRefreshing}>↻</span>
			</button>
		{/if}
		<button class="header-btn settings-btn" onclick={onSettingsClick} title="Settings (Cmd+,)">
			<span class="btn-icon">⚙</span>
			<span class="btn-label">CONFIG</span>
		</button>
	</div>

	<!-- Gradient accent line -->
	<div class="accent-line"></div>
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: clamp(0.375rem, 1vw, 0.5rem) clamp(0.5rem, 2vw, 1rem);
		background: var(--surface);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 100;
		gap: clamp(0.5rem, 2vw, 1rem);
		isolation: isolate;
		position: relative;
		min-height: clamp(40px, 8vw, 48px);
	}

	/* Gradient accent line at the bottom */
	.accent-line {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(to right, transparent, var(--accent), transparent);
		opacity: 0.6;
	}

	/* Tech Corner Decorations */
	.tech-corner {
		position: absolute;
		width: clamp(6px, 1.5vw, 8px);
		height: clamp(6px, 1.5vw, 8px);
		pointer-events: none;
		z-index: 10;
	}

	.tech-corner.top-left {
		top: 0;
		left: 0;
		border-top: 2px solid var(--accent-border);
		border-left: 2px solid var(--accent-border);
	}

	.tech-corner.top-right {
		top: 0;
		right: 0;
		border-top: 2px solid var(--accent-border);
		border-right: 2px solid var(--accent-border);
	}

	.header-left {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.logo-container {
		display: flex;
		align-items: center;
		gap: clamp(0.25rem, 1vw, 0.5rem);
	}

	.logo-icon {
		color: var(--accent);
		font-size: clamp(0.875rem, 2.5vw, 1.125rem);
		text-shadow: 0 0 10px var(--accent-glow);
		transition: all 0.2s ease;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.35em;
		margin: 0;
	}

	.logo-project {
		font-size: clamp(0.6rem, 1.5vw, 0.7rem);
		font-weight: 500;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--text-muted);
		font-family: 'SF Mono', Monaco, monospace;
	}

	.logo-name {
		font-size: clamp(1rem, 3vw, 1.35rem);
		font-weight: 700;
		letter-spacing: 0.25em;
		text-transform: uppercase;
		color: var(--text-primary);
		font-family: 'Orbitron', 'Rajdhani', 'Share Tech Mono', 'SF Pro Display', system-ui, sans-serif;
		text-shadow: 0 0 20px rgba(6, 182, 212, 0.3);
	}

	.logo-subtitle {
		font-size: clamp(0.5rem, 1.25vw, 0.625rem);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
		padding-left: clamp(0.25rem, 1vw, 0.5rem);
		border-left: 1px solid var(--border);
		margin-left: clamp(0.25rem, 1vw, 0.5rem);
	}

	.header-center {
		display: flex;
		align-items: center;
		flex: 1;
		justify-content: center;
		min-width: 0;
	}

	.status-bar {
		display: flex;
		align-items: center;
		gap: clamp(0.5rem, 1.5vw, 1rem);
		padding: clamp(0.125rem, 0.5vw, 0.25rem) clamp(0.5rem, 1.5vw, 0.75rem);
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid var(--border);
		border-radius: 2px;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: clamp(0.25rem, 0.75vw, 0.375rem);
	}

	.status-label {
		font-size: clamp(0.5rem, 1.25vw, 0.625rem);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.status-value {
		font-size: clamp(0.5625rem, 1.35vw, 0.6875rem);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.05em;
		color: var(--text);
		text-transform: uppercase;
	}

	.status-value.active {
		color: var(--accent);
	}

	.status-value.online {
		color: var(--success);
	}

	.status-divider {
		width: 1px;
		height: clamp(12px, 2.5vw, 16px);
		background: var(--border);
	}

	.status-dot {
		width: clamp(5px, 1vw, 6px);
		height: clamp(5px, 1vw, 6px);
		border-radius: 50%;
		background: var(--text-muted);
		transition:
			background-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.status-dot.active {
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent-glow);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.status-dot.online {
		background: var(--success);
		box-shadow: 0 0 8px var(--success);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: clamp(0.25rem, 0.75vw, 0.375rem);
		flex-shrink: 0;
	}

	.header-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0.25rem, 0.75vw, 0.375rem);
		min-height: clamp(28px, 5vw, 32px);
		min-width: clamp(28px, 5vw, 32px);
		padding: clamp(0.25rem, 0.75vw, 0.375rem) clamp(0.5rem, 1.25vw, 0.625rem);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-dim);
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: clamp(0.5625rem, 1.35vw, 0.6875rem);
		font-family: 'SF Mono', Monaco, monospace;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.header-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	.header-btn:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 2px;
	}

	.header-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.refresh-btn {
		padding: clamp(0.25rem, 0.75vw, 0.375rem);
	}

	/* Alerts Button */
	.alerts-btn {
		position: relative;
		gap: clamp(0.125rem, 0.5vw, 0.25rem);
	}

	.alerts-btn .play-icon {
		font-size: clamp(0.5rem, 1.5vw, 0.625rem);
	}

	.alerts-btn .stop-icon {
		font-size: clamp(0.5rem, 1.5vw, 0.625rem);
	}

	.alerts-btn.has-alerts {
		border-color: var(--warning);
		color: var(--warning);
	}

	.alerts-btn.has-alerts:hover {
		background: rgba(251, 191, 36, 0.1);
		border-color: var(--warning);
		color: var(--warning);
	}

	.alerts-btn.playing {
		border-color: var(--accent);
		color: var(--accent);
		background: rgba(34, 211, 238, 0.1);
	}

	.alerts-btn.error {
		border-color: var(--danger);
		color: var(--danger);
	}

	.alert-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		background: var(--warning);
		color: black;
		font-size: 9px;
		font-weight: 700;
		font-family: 'SF Mono', Monaco, monospace;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 0 8px var(--warning);
	}

	.btn-icon {
		font-size: clamp(0.75rem, 2vw, 0.9375rem);
	}

	.btn-icon.spinning {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.btn-label {
		display: none;
	}

	/* Extra small screens (mobile portrait) */
	@media (max-width: 480px) {
		.logo-subtitle {
			display: none;
		}

		.status-bar {
			display: none;
		}
	}

	/* Small screens (mobile landscape / small tablet) */
	@media (min-width: 481px) and (max-width: 768px) {
		.logo-subtitle {
			display: none;
		}

		.status-bar {
			display: none;
		}
	}

	/* Medium screens (tablet) */
	@media (min-width: 769px) and (max-width: 1024px) {
		.btn-label {
			display: inline;
		}

		.logo-subtitle {
			display: inline;
		}

		.status-bar {
			display: flex;
		}
	}

	/* Large screens (desktop) */
	@media (min-width: 1025px) {
		.btn-label {
			display: inline;
		}

		.logo-subtitle {
			display: inline;
		}

		.status-bar {
			display: flex;
		}
	}
</style>
