/**
 * Automatic Analysis Service
 * Periodically analyzes intelligence data and alerts user to significant changes
 */

import { browser } from '$app/environment';
import { base } from '$app/paths';
import { get, writable, derived } from 'svelte/store';
import { buildIntelligenceContext, type ExternalData } from './context-builder';
import { sendLLMRequest, hasApiKey, formatContextForLLM } from './llm';
import { llmPreferences } from '$lib/stores/llmPreferences';
import { chat } from '$lib/stores/chat';
import { alerts as newsAlerts } from '$lib/stores/news';
import { getAutoTriggerPrompts } from '$lib/config/prompts';
import type { IntelligenceContext } from '$lib/types/llm';
import { tts, ttsPreferences } from './tts';

// Storage keys
const STORAGE_KEY_PREFERENCES = 'aegis_auto_analysis_prefs';
const STORAGE_KEY_HISTORY = 'aegis_auto_analysis_history';

// ============================================================================
// Types
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertTrigger =
	| 'new_alert_news'
	| 'threat_level_change'
	| 'market_volatility'
	| 'whale_activity'
	| 'infrastructure_issue'
	| 'pattern_detected'
	| 'scheduled_briefing'
	| 'manual';

export interface AnalysisAlert {
	id: string;
	timestamp: number;
	severity: AlertSeverity;
	trigger: AlertTrigger;
	title: string;
	summary: string;
	fullAnalysis?: string;
	acknowledged: boolean;
	ttsPlayed: boolean;
}

export interface AutoAnalysisPreferences {
	enabled: boolean;
	intervalMinutes: number;
	enableTTS: boolean;
	ttsVoice: string;
	ttsSeverityThreshold: AlertSeverity;

	// Trigger settings
	triggers: {
		newAlertNews: boolean;
		threatLevelChange: boolean;
		marketVolatility: boolean;
		whaleActivity: boolean;
		infrastructureIssue: boolean;
		patternDetected: boolean;
	};

	// Thresholds
	thresholds: {
		minAlertCount: number; // Min new alerts to trigger
		marketVolatilityPercent: number; // VIX change threshold
		whaleTransactionUSD: number; // Min whale tx size
	};

	// Quiet hours (no TTS)
	quietHours: {
		enabled: boolean;
		start: number; // Hour (0-23)
		end: number;
	};
}

export interface AnalysisHistoryEntry {
	timestamp: number;
	contextHash: string;
	alertCount: number;
	threatLevel: string;
	marketTrend: string;
	keyFindings: string[];
}

export interface AutoAnalysisState {
	isRunning: boolean;
	lastAnalysis: number | null;
	nextScheduledAnalysis: number | null;
	alerts: AnalysisAlert[];
	history: AnalysisHistoryEntry[];
	error: string | null;
}

// ============================================================================
// Default Preferences
// ============================================================================

export const DEFAULT_AUTO_ANALYSIS_PREFERENCES: AutoAnalysisPreferences = {
	enabled: false,
	intervalMinutes: 30,
	enableTTS: true,
	ttsVoice: 'default',
	ttsSeverityThreshold: 'warning',
	triggers: {
		newAlertNews: true,
		threatLevelChange: true,
		marketVolatility: true,
		whaleActivity: false,
		infrastructureIssue: true,
		patternDetected: true
	},
	thresholds: {
		minAlertCount: 3,
		marketVolatilityPercent: 5,
		whaleTransactionUSD: 50000000
	},
	quietHours: {
		enabled: false,
		start: 22,
		end: 7
	}
};

// ============================================================================
// Text-to-Speech Service
// ============================================================================

class TTSService {
	private synth: SpeechSynthesis | null = null;
	private voices: SpeechSynthesisVoice[] = [];
	private selectedVoice: SpeechSynthesisVoice | null = null;
	private alertSoundCache: HTMLAudioElement | null = null;

	constructor() {
		if (browser && 'speechSynthesis' in window) {
			this.synth = window.speechSynthesis;
			this.loadVoices();

			// Voices may load asynchronously
			if (this.synth.onvoiceschanged !== undefined) {
				this.synth.onvoiceschanged = () => this.loadVoices();
			}

			// Preload alert sound
			this.preloadAlertSound();
		}
	}

	private loadVoices(): void {
		if (!this.synth) return;
		this.voices = this.synth.getVoices();

		// Prefer English voices
		const englishVoices = this.voices.filter(v => v.lang.startsWith('en'));
		this.selectedVoice = englishVoices.find(v => v.name.includes('Premium') || v.name.includes('Enhanced'))
			|| englishVoices[0]
			|| this.voices[0]
			|| null;
	}

	private preloadAlertSound(): void {
		if (!browser || this.alertSoundCache) return;

		try {
			const alertPath = `${base}/alert.mp3`;
			this.alertSoundCache = new Audio(alertPath);
			this.alertSoundCache.preload = 'auto';
			this.alertSoundCache.load();
			console.log('[AutoAnalysis TTS] Alert sound preloaded from:', alertPath);
		} catch (e) {
			console.warn('[AutoAnalysis TTS] Failed to preload alert sound:', e);
		}
	}

	private playAlertSound(): Promise<void> {
		return new Promise((resolve) => {
			// Check if alert sound is enabled via ttsPreferences
			const prefs = get(ttsPreferences);
			if (!prefs.playAlertSound) {
				console.log('[AutoAnalysis TTS] Alert sound disabled, skipping');
				resolve();
				return;
			}

			if (!this.alertSoundCache) {
				this.preloadAlertSound();
			}

			if (!this.alertSoundCache) {
				console.warn('[AutoAnalysis TTS] Alert sound not available, skipping');
				resolve();
				return;
			}

			const alertAudio = this.alertSoundCache.cloneNode() as HTMLAudioElement;
			// Use the volume from TTS preferences
			alertAudio.volume = Math.max(0, Math.min(1, prefs.volume ?? 0.7));

			console.log(`[AutoAnalysis TTS] Playing alert sound with volume: ${alertAudio.volume}`);

			alertAudio.onended = () => {
				console.log('[AutoAnalysis TTS] Alert sound finished');
				resolve();
			};

			alertAudio.onerror = (e) => {
				console.warn('[AutoAnalysis TTS] Alert sound playback error:', e);
				resolve();
			};

			alertAudio.play().catch((err) => {
				console.warn('[AutoAnalysis TTS] Alert sound play failed:', err);
				resolve();
			});
		});
	}

	getAvailableVoices(): SpeechSynthesisVoice[] {
		return this.voices;
	}

	setVoice(voiceName: string): void {
		const voice = this.voices.find(v => v.name === voiceName);
		if (voice) {
			this.selectedVoice = voice;
		}
	}

	async speak(text: string, priority: AlertSeverity = 'info'): Promise<void> {
		if (!this.synth) {
			throw new Error('Speech synthesis not available');
		}

		// Cancel any ongoing speech for critical alerts
		if (priority === 'critical') {
			this.synth.cancel();
		}

		// Play alert sound first (if enabled)
		await this.playAlertSound();

		console.log(`[AutoAnalysis TTS] Speaking with priority: ${priority}`);

		return new Promise((resolve, reject) => {
			const utterance = new SpeechSynthesisUtterance(text);

			if (this.selectedVoice) {
				utterance.voice = this.selectedVoice;
			}

			// Adjust rate and pitch based on severity
			switch (priority) {
				case 'critical':
					utterance.rate = 1.1;
					utterance.pitch = 1.1;
					break;
				case 'warning':
					utterance.rate = 1.0;
					utterance.pitch = 1.0;
					break;
				default:
					utterance.rate = 0.95;
					utterance.pitch = 0.95;
			}

			utterance.onend = () => resolve();
			utterance.onerror = (event) => reject(event.error);

			this.synth!.speak(utterance);
		});
	}

	stop(): void {
		if (this.synth) {
			this.synth.cancel();
		}
	}

	isAvailable(): boolean {
		return this.synth !== null;
	}
}

// Singleton TTS service
export const ttsService = new TTSService();

// ============================================================================
// Auto Analysis Store
// ============================================================================

function loadPreferences(): AutoAnalysisPreferences {
	if (!browser) return DEFAULT_AUTO_ANALYSIS_PREFERENCES;

	try {
		const stored = localStorage.getItem(STORAGE_KEY_PREFERENCES);
		if (stored) {
			return { ...DEFAULT_AUTO_ANALYSIS_PREFERENCES, ...JSON.parse(stored) };
		}
	} catch (e) {
		console.warn('Failed to load auto-analysis preferences:', e);
	}
	return DEFAULT_AUTO_ANALYSIS_PREFERENCES;
}

function savePreferences(prefs: AutoAnalysisPreferences): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(prefs));
	} catch (e) {
		console.warn('Failed to save auto-analysis preferences:', e);
	}
}

function loadHistory(): AnalysisHistoryEntry[] {
	if (!browser) return [];

	try {
		const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch (e) {
		console.warn('Failed to load analysis history:', e);
	}
	return [];
}

function saveHistory(history: AnalysisHistoryEntry[]): void {
	if (!browser) return;
	try {
		// Keep only last 50 entries
		const trimmed = history.slice(-50);
		localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
	} catch (e) {
		console.warn('Failed to save analysis history:', e);
	}
}

function createAutoAnalysisStore() {
	const preferences = writable<AutoAnalysisPreferences>(loadPreferences());
	const state = writable<AutoAnalysisState>({
		isRunning: false,
		lastAnalysis: null,
		nextScheduledAnalysis: null,
		alerts: [],
		history: loadHistory(),
		error: null
	});

	let analysisInterval: ReturnType<typeof setInterval> | null = null;
	let previousAlertCount = 0;

	// Subscribe to preferences changes
	preferences.subscribe(prefs => {
		savePreferences(prefs);

		// Restart interval if enabled state changes
		if (prefs.enabled) {
			startInterval(prefs.intervalMinutes);
		} else {
			stopInterval();
		}
	});

	function startInterval(minutes: number): void {
		stopInterval();
		if (!browser) return;

		const ms = minutes * 60 * 1000;
		state.update(s => ({
			...s,
			nextScheduledAnalysis: Date.now() + ms
		}));

		analysisInterval = setInterval(() => {
			runScheduledAnalysis();
		}, ms);
	}

	function stopInterval(): void {
		if (analysisInterval) {
			clearInterval(analysisInterval);
			analysisInterval = null;
		}
		state.update(s => ({
			...s,
			nextScheduledAnalysis: null
		}));
	}

	async function runScheduledAnalysis(): Promise<void> {
		const prefs = get(preferences);
		if (!prefs.enabled) return;

		await runAnalysis('scheduled_briefing');
	}

	async function runAnalysis(
		trigger: AlertTrigger,
		externalData: ExternalData = {},
		customPrompt?: string
	): Promise<AnalysisAlert | null> {
		const prefs = get(preferences);
		const llmPrefs = get(llmPreferences);

		// Check if API key is configured
		if (!hasApiKey(llmPrefs.provider)) {
			state.update(s => ({
				...s,
				error: 'API key not configured'
			}));
			return null;
		}

		state.update(s => ({
			...s,
			isRunning: true,
			error: null
		}));

		try {
			// Build context
			const context = buildIntelligenceContext(llmPrefs, externalData);

			// Determine prompt based on trigger
			let prompt = customPrompt;
			if (!prompt) {
				const autoPrompts = getAutoTriggerPrompts();
				const relevantPrompt = autoPrompts.find(p => {
					switch (trigger) {
						case 'new_alert_news':
							return p.id === 'flash-update';
						case 'threat_level_change':
							return p.id === 'escalation-watch';
						case 'market_volatility':
						case 'whale_activity':
							return p.id === 'whale-alert' || p.id === 'market-intelligence';
						default:
							return p.id === 'flash-update';
					}
				});
				prompt = relevantPrompt?.prompt || 'Provide a brief analysis of the current situation, focusing on any urgent matters.';
			}

			// Add context awareness
			prompt = `${prompt}\n\nIMPORTANT: This is an automated analysis triggered by: ${trigger.replace(/_/g, ' ')}. Be concise and focus on what's most urgent.`;

			// Call LLM
			const response = await sendLLMRequest(
				llmPrefs.provider,
				{
					messages: [{ role: 'user', content: `${prompt}\n\n---\n\n${formatContextForLLM(context)}` }],
					maxTokens: 1000,
					systemPrompt: 'You are an intelligence analyst assistant. Provide concise, actionable analysis. Identify the most critical information first.'
				},
				{
					model: llmPrefs.model,
					customEndpoint: llmPrefs.customEndpoint
				}
			);

			// Determine severity based on content
			const severity = determineSeverity(response.content, context);

			// Create alert
			const alert: AnalysisAlert = {
				id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				timestamp: Date.now(),
				severity,
				trigger,
				title: generateAlertTitle(trigger, severity),
				summary: extractSummary(response.content),
				fullAnalysis: response.content,
				acknowledged: false,
				ttsPlayed: false
			};

			// Update state
			state.update(s => {
				const newAlerts = [alert, ...s.alerts].slice(0, 100); // Keep last 100

				// Add to history
				const historyEntry: AnalysisHistoryEntry = {
					timestamp: Date.now(),
					contextHash: hashContext(context),
					alertCount: context.news?.alertCount || 0,
					threatLevel: severity,
					marketTrend: context.markets?.trend || 'unknown',
					keyFindings: extractKeyFindings(response.content)
				};
				const newHistory = [...s.history, historyEntry];
				saveHistory(newHistory);

				return {
					...s,
					isRunning: false,
					lastAnalysis: Date.now(),
					nextScheduledAnalysis: get(preferences).enabled
						? Date.now() + (get(preferences).intervalMinutes * 60 * 1000)
						: null,
					alerts: newAlerts,
					history: newHistory
				};
			});

			// Play TTS if enabled and meets threshold
			if (prefs.enableTTS && shouldPlayTTS(severity, prefs)) {
				await playAlertTTS(alert);
				state.update(s => ({
					...s,
					alerts: s.alerts.map(a =>
						a.id === alert.id ? { ...a, ttsPlayed: true } : a
					)
				}));
			}

			// Add to chat history
			chat.addMessage('assistant', response.content, {
				tokenCount: response.tokenUsage?.total
			});

			return alert;

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Analysis failed';
			state.update(s => ({
				...s,
				isRunning: false,
				error: errorMsg
			}));
			return null;
		}
	}

	function determineSeverity(content: string, context: IntelligenceContext): AlertSeverity {
		const lowerContent = content.toLowerCase();

		// Critical indicators
		const criticalTerms = ['critical', 'urgent', 'immediate', 'emergency', 'severe', 'high alert', 'escalation imminent'];
		if (criticalTerms.some(term => lowerContent.includes(term))) {
			return 'critical';
		}

		// Check hotspot levels
		const criticalHotspots = context.geopolitical?.hotspots.filter(h => h.level === 'critical') || [];
		if (criticalHotspots.length >= 2) {
			return 'critical';
		}

		// Warning indicators
		const warningTerms = ['warning', 'elevated', 'concern', 'monitor closely', 'heightened risk'];
		if (warningTerms.some(term => lowerContent.includes(term))) {
			return 'warning';
		}

		// High alert count
		if ((context.news?.alertCount || 0) >= 10) {
			return 'warning';
		}

		return 'info';
	}

	function generateAlertTitle(trigger: AlertTrigger, severity: AlertSeverity): string {
		const severityPrefix = severity === 'critical' ? '🔴 CRITICAL: ' : severity === 'warning' ? '🟡 WARNING: ' : '🔵 ';

		const titles: Record<AlertTrigger, string> = {
			new_alert_news: 'New Alert-Level News Detected',
			threat_level_change: 'Threat Level Change',
			market_volatility: 'Market Volatility Alert',
			whale_activity: 'Significant Whale Activity',
			infrastructure_issue: 'Infrastructure Issue Detected',
			pattern_detected: 'Pattern Detected',
			scheduled_briefing: 'Scheduled Intelligence Briefing',
			manual: 'Manual Analysis'
		};

		return severityPrefix + (titles[trigger] || 'Intelligence Update');
	}

	function extractSummary(content: string): string {
		// Get first paragraph or first 200 chars
		const firstPara = content.split('\n\n')[0];
		if (firstPara.length <= 200) return firstPara;
		return firstPara.substring(0, 200) + '...';
	}

	function extractKeyFindings(content: string): string[] {
		const findings: string[] = [];

		// Look for bullet points
		const bulletMatches = content.match(/^[-•*]\s*(.+)$/gm);
		if (bulletMatches) {
			findings.push(...bulletMatches.slice(0, 5).map(b => b.replace(/^[-•*]\s*/, '')));
		}

		// Look for numbered items
		const numberedMatches = content.match(/^\d+\.\s*(.+)$/gm);
		if (numberedMatches) {
			findings.push(...numberedMatches.slice(0, 5).map(n => n.replace(/^\d+\.\s*/, '')));
		}

		return findings.slice(0, 5);
	}

	function shouldPlayTTS(severity: AlertSeverity, prefs: AutoAnalysisPreferences): boolean {
		if (!prefs.enableTTS) return false;

		// Check quiet hours
		if (prefs.quietHours.enabled) {
			const now = new Date().getHours();
			const { start, end } = prefs.quietHours;

			if (start < end) {
				// Normal range (e.g., 22:00 - 07:00 doesn't wrap)
				if (now >= start && now < end) return false;
			} else {
				// Wraps around midnight (e.g., 22:00 - 07:00)
				if (now >= start || now < end) return false;
			}
		}

		// Check severity threshold
		const severityOrder: AlertSeverity[] = ['info', 'warning', 'critical'];
		const currentIndex = severityOrder.indexOf(severity);
		const thresholdIndex = severityOrder.indexOf(prefs.ttsSeverityThreshold);

		return currentIndex >= thresholdIndex;
	}

	async function playAlertTTS(alert: AnalysisAlert): Promise<void> {
		// Use the proper multi-provider TTS service from tts.ts
		const prefs = get(ttsPreferences);
		if (!prefs.enabled || prefs.provider === 'none') {
			// Fall back to browser TTS if no provider configured
			if (!ttsService.isAvailable()) return;
		}

		// Construct TTS message
		let message = '';

		switch (alert.severity) {
			case 'critical':
				message = 'Attention. Critical intelligence alert. ';
				break;
			case 'warning':
				message = 'Intelligence warning. ';
				break;
			default:
				message = 'Intelligence update. ';
		}

		message += alert.summary;

		try {
			// Use the multi-provider TTS service (ElevenLabs, OpenAI, or Browser)
			await tts.speak(message);
		} catch (e) {
			console.warn('TTS failed:', e);
			// If the configured provider fails, don't fall back to browser TTS
			// The user has explicitly chosen a provider
		}
	}

	function hashContext(context: IntelligenceContext): string {
		const str = JSON.stringify({
			timestamp: context.timestamp,
			categories: context.metadata.enabledCategories,
			itemCount: context.metadata.totalItems
		});
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(16).substring(0, 8);
	}

	// Check for changes that should trigger analysis
	function checkTriggers(externalData: ExternalData): AlertTrigger | null {
		const prefs = get(preferences);
		if (!prefs.enabled) return null;

		const currentAlerts = get(newsAlerts);

		// Check new alert news
		if (prefs.triggers.newAlertNews) {
			const newCount = currentAlerts.length;
			if (newCount >= previousAlertCount + prefs.thresholds.minAlertCount) {
				previousAlertCount = newCount;
				return 'new_alert_news';
			}
			previousAlertCount = newCount;
		}

		// Check whale activity
		if (prefs.triggers.whaleActivity && externalData.whaleTransactions) {
			const largeWhales = externalData.whaleTransactions.filter(
				w => w.usd >= prefs.thresholds.whaleTransactionUSD
			);
			if (largeWhales.length > 0) {
				return 'whale_activity';
			}
		}

		// Check infrastructure issues
		// GridStressData uses percent (0-100) where higher = more grid stress
		if (prefs.triggers.infrastructureIssue && externalData.gridStress) {
			const criticalGrid = externalData.gridStress.filter(
				g => g.percent >= 80 // High grid stress when emissions percentile is >= 80%
			);
			if (criticalGrid.length > 0) {
				return 'infrastructure_issue';
			}
		}

		return null;
	}

	return {
		preferences: {
			subscribe: preferences.subscribe,
			update: (fn: (p: AutoAnalysisPreferences) => AutoAnalysisPreferences) => {
				preferences.update(fn);
			},
			set: (prefs: AutoAnalysisPreferences) => {
				preferences.set(prefs);
			}
		},
		state: {
			subscribe: state.subscribe
		},

		// Actions
		runAnalysis,
		checkTriggers,

		acknowledgeAlert(alertId: string): void {
			state.update(s => ({
				...s,
				alerts: s.alerts.map(a =>
					a.id === alertId ? { ...a, acknowledged: true } : a
				)
			}));
		},

		clearAlerts(): void {
			state.update(s => ({
				...s,
				alerts: []
			}));
		},

		clearHistory(): void {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY_HISTORY);
			}
			state.update(s => ({
				...s,
				history: []
			}));
		},

		stopTTS(): void {
			// Stop the multi-provider TTS service
			tts.stop();
		},

		testTTS(message: string = 'This is a test of the intelligence alert system.'): Promise<void> {
			// Use the multi-provider TTS service (ElevenLabs, OpenAI, or Browser)
			return tts.test(message);
		}
	};
}

// Export singleton
export const autoAnalysis = createAutoAnalysisStore();

// Derived stores
export const isAutoAnalysisEnabled = derived(
	autoAnalysis.preferences,
	$prefs => $prefs.enabled
);

export const unacknowledgedAlerts = derived(
	autoAnalysis.state,
	$state => $state.alerts.filter(a => !a.acknowledged)
);

export const criticalAlerts = derived(
	autoAnalysis.state,
	$state => $state.alerts.filter(a => a.severity === 'critical' && !a.acknowledged)
);

