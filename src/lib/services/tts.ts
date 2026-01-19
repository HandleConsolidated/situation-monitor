/**
 * Text-to-Speech Service
 * Supports multiple TTS providers: ElevenLabs, OpenAI, and browser native
 */

import { browser } from '$app/environment';
import { base } from '$app/paths';
import { writable, get } from 'svelte/store';

// ============================================================================
// Types
// ============================================================================

export type TTSProvider = 'elevenlabs' | 'openai' | 'browser' | 'none';

export interface TTSVoice {
	id: string;
	name: string;
	provider: TTSProvider;
	description?: string;
}

export interface TTSOptions {
	voice?: string;
	speed?: number; // 0.25 - 4.0 for OpenAI, 0.5 - 2.0 for ElevenLabs
	pitch?: number; // Only for browser TTS
	skipAlertSound?: boolean; // Skip playing alert.mp3 before this utterance
}

export interface TTSState {
	isSpeaking: boolean;
	currentProvider: TTSProvider | null;
	currentVoice: string | null;
	error: string | null;
}

export interface TTSPreferences {
	provider: TTSProvider;
	voice: string;
	enabled: boolean;
	autoPlay: boolean;
	speed: number;
	volume: number; // 0.0 to 1.0
	playAlertSound: boolean; // Play alert.mp3 before TTS speech
}

// ============================================================================
// Voice Definitions
// ============================================================================

// Optimized voices for Turbo v2.5 model
export const ELEVENLABS_VOICES: TTSVoice[] = [
	// Recommended for Turbo v2.5
	{ id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', provider: 'elevenlabs', description: 'Expressive female, great for audiobooks & podcasts' },
	{ id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', provider: 'elevenlabs', description: 'Natural conversational female' },
	{ id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', provider: 'elevenlabs', description: 'Professional male, ideal for news & ads' },
	{ id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', provider: 'elevenlabs', description: 'Confident male, social media style' },
	{ id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', provider: 'elevenlabs', description: 'Warm British male, narration' },
	{ id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', provider: 'elevenlabs', description: 'Friendly female narrator' },
	{ id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', provider: 'elevenlabs', description: 'Expressive conversational female' },
	{ id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', provider: 'elevenlabs', description: 'Warm British female narrator' },
	{ id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', provider: 'elevenlabs', description: 'Confident non-binary voice' },
	{ id: 'bIHbv24MWmeRgasZH58o', name: 'Will', provider: 'elevenlabs', description: 'Friendly young male' }
];

export const OPENAI_VOICES: TTSVoice[] = [
	{ id: 'alloy', name: 'Alloy', provider: 'openai', description: 'Neutral, balanced' },
	{ id: 'echo', name: 'Echo', provider: 'openai', description: 'Male voice' },
	{ id: 'fable', name: 'Fable', provider: 'openai', description: 'British accent' },
	{ id: 'onyx', name: 'Onyx', provider: 'openai', description: 'Deep male' },
	{ id: 'nova', name: 'Nova', provider: 'openai', description: 'Female voice' },
	{ id: 'shimmer', name: 'Shimmer', provider: 'openai', description: 'Soft female' }
];

export const DEFAULT_TTS_PREFERENCES: TTSPreferences = {
	provider: 'none',
	voice: '',
	enabled: false,
	autoPlay: false,
	speed: 1.0,
	volume: 0.7, // Default to 70% volume
	playAlertSound: true // Play alert sound before TTS by default
};

// ============================================================================
// Storage
// ============================================================================

const TTS_STORAGE_KEY = 'aegis_tts_preferences';
const TTS_ELEVENLABS_KEY = 'aegis_tts_elevenlabs_key';
const TTS_OPENAI_KEY = 'aegis_tts_openai_key';

function loadTTSPreferences(): TTSPreferences {
	if (!browser) return DEFAULT_TTS_PREFERENCES;

	try {
		const stored = localStorage.getItem(TTS_STORAGE_KEY);
		if (stored) {
			return { ...DEFAULT_TTS_PREFERENCES, ...JSON.parse(stored) };
		}
	} catch (e) {
		console.warn('Failed to load TTS preferences:', e);
	}
	return DEFAULT_TTS_PREFERENCES;
}

function saveTTSPreferences(prefs: TTSPreferences): void {
	if (!browser) return;
	try {
		localStorage.setItem(TTS_STORAGE_KEY, JSON.stringify(prefs));
	} catch (e) {
		console.warn('Failed to save TTS preferences:', e);
	}
}

export function storeTTSApiKey(provider: 'elevenlabs' | 'openai', key: string): void {
	if (!browser) return;
	try {
		const storageKey = provider === 'elevenlabs' ? TTS_ELEVENLABS_KEY : TTS_OPENAI_KEY;
		if (key.trim()) {
			localStorage.setItem(storageKey, key.trim());
		} else {
			localStorage.removeItem(storageKey);
		}
	} catch (e) {
		console.warn('Failed to store TTS API key:', e);
	}
}

export function getTTSApiKey(provider: 'elevenlabs' | 'openai'): string | null {
	if (!browser) return null;
	try {
		const storageKey = provider === 'elevenlabs' ? TTS_ELEVENLABS_KEY : TTS_OPENAI_KEY;
		return localStorage.getItem(storageKey);
	} catch (e) {
		console.warn('Failed to get TTS API key:', e);
		return null;
	}
}

export function hasTTSApiKey(provider: 'elevenlabs' | 'openai'): boolean {
	const key = getTTSApiKey(provider);
	return key !== null && key.trim().length > 0;
}

export function removeTTSApiKey(provider: 'elevenlabs' | 'openai'): void {
	if (!browser) return;
	try {
		const storageKey = provider === 'elevenlabs' ? TTS_ELEVENLABS_KEY : TTS_OPENAI_KEY;
		localStorage.removeItem(storageKey);
	} catch (e) {
		console.warn('Failed to remove TTS API key:', e);
	}
}

// ============================================================================
// TTS Service Class
// ============================================================================

class TTSService {
	private audioElement: HTMLAudioElement | null = null;
	private audioUrl: string | null = null;
	private abortController: AbortController | null = null;
	private browserSynth: SpeechSynthesis | null = null;
	private browserVoices: SpeechSynthesisVoice[] = [];
	private alertSoundCache: HTMLAudioElement | null = null;

	// Stores
	public state = writable<TTSState>({
		isSpeaking: false,
		currentProvider: null,
		currentVoice: null,
		error: null
	});

	public preferences = writable<TTSPreferences>(loadTTSPreferences());

	constructor() {
		if (browser) {
			// Initialize browser TTS
			if ('speechSynthesis' in window) {
				this.browserSynth = window.speechSynthesis;
				this.loadBrowserVoices();

				if (this.browserSynth.onvoiceschanged !== undefined) {
					this.browserSynth.onvoiceschanged = () => this.loadBrowserVoices();
				}
			}

			// Subscribe to preferences changes
			this.preferences.subscribe((prefs) => {
				saveTTSPreferences(prefs);
			});
		}
	}

	private loadBrowserVoices(): void {
		if (!this.browserSynth) return;
		this.browserVoices = this.browserSynth.getVoices();
	}

	/**
	 * Preload the alert sound for faster playback
	 */
	private preloadAlertSound(): void {
		if (!browser || this.alertSoundCache) return;

		try {
			const alertPath = `${base}/alert.mp3`;
			this.alertSoundCache = new Audio(alertPath);
			this.alertSoundCache.preload = 'auto';
			// Trigger load without playing
			this.alertSoundCache.load();
			console.log('[TTS] Alert sound preloaded from:', alertPath);
		} catch (e) {
			console.warn('[TTS] Failed to preload alert sound:', e);
		}
	}

	/**
	 * Play the alert sound before TTS speech (internal method)
	 * Returns a promise that resolves when the sound finishes or errors
	 */
	private playAlertSoundInternal(volume: number): Promise<void> {
		return new Promise((resolve) => {
			// Preload if not already done
			if (!this.alertSoundCache) {
				this.preloadAlertSound();
			}

			if (!this.alertSoundCache) {
				console.warn('[TTS] Alert sound not available, skipping');
				resolve();
				return;
			}

			const alertAudio = this.alertSoundCache.cloneNode() as HTMLAudioElement;
			const safeVolume = Math.max(0, Math.min(1, volume));
			alertAudio.volume = safeVolume;

			console.log(`[TTS] Playing alert sound with volume: ${safeVolume}`);

			alertAudio.onended = () => {
				console.log('[TTS] Alert sound finished');
				resolve();
			};

			alertAudio.onerror = (e) => {
				console.warn('[TTS] Alert sound playback error:', e);
				// Resolve anyway to continue with TTS
				resolve();
			};

			alertAudio.play().catch((err) => {
				console.warn('[TTS] Alert sound play failed:', err);
				// Resolve anyway to continue with TTS
				resolve();
			});
		});
	}

	/**
	 * Play the alert sound once (public method for external use)
	 * Respects the playAlertSound preference and volume settings
	 * Returns a promise that resolves when the sound finishes or is skipped
	 */
	async playAlertSoundOnce(): Promise<void> {
		const prefs = get(this.preferences);

		// Skip if alert sound is disabled in preferences
		if (!prefs.playAlertSound) {
			console.log('[TTS] Alert sound disabled in preferences, skipping');
			return;
		}

		// Ensure volume is a valid number between 0 and 1
		const rawVolume = prefs.volume ?? 0.7;
		const volume = Math.max(0, Math.min(1, typeof rawVolume === 'number' && !isNaN(rawVolume) ? rawVolume : 0.7));

		console.log('[TTS] Playing alert sound once at start of alert sequence');
		await this.playAlertSoundInternal(volume);
	}

	/**
	 * Get available voices for a provider
	 */
	getVoices(provider: TTSProvider): TTSVoice[] {
		switch (provider) {
			case 'elevenlabs':
				return ELEVENLABS_VOICES;
			case 'openai':
				return OPENAI_VOICES;
			case 'browser':
				return this.browserVoices.map((v) => ({
					id: v.name,
					name: v.name,
					provider: 'browser' as TTSProvider,
					description: v.lang
				}));
			default:
				return [];
		}
	}

	/**
	 * Get default voice for a provider
	 */
	getDefaultVoice(provider: TTSProvider): string {
		switch (provider) {
			case 'elevenlabs':
				return ELEVENLABS_VOICES[0].id; // Rachel
			case 'openai':
				return 'nova'; // Nova
			case 'browser':
				const englishVoice = this.browserVoices.find((v) => v.lang.startsWith('en'));
				return englishVoice?.name || this.browserVoices[0]?.name || '';
			default:
				return '';
		}
	}

	/**
	 * Speak text using the configured provider
	 */
	async speak(text: string, options: TTSOptions = {}): Promise<void> {
		const prefs = get(this.preferences);

		if (!prefs.enabled || prefs.provider === 'none') {
			return;
		}

		// Stop any current playback
		this.stop();

		const voice = options.voice || prefs.voice || this.getDefaultVoice(prefs.provider);
		// Ensure speed is a valid number between 0.25 and 4.0
		const rawSpeed = options.speed ?? prefs.speed ?? 1.0;
		const speed = Math.max(0.25, Math.min(4.0, typeof rawSpeed === 'number' && !isNaN(rawSpeed) ? rawSpeed : 1.0));
		// Ensure volume is a valid number between 0 and 1
		const rawVolume = prefs.volume ?? 0.7;
		const volume = Math.max(0, Math.min(1, typeof rawVolume === 'number' && !isNaN(rawVolume) ? rawVolume : 0.7));
		// Check if we should skip the alert sound (e.g., for subsequent items in a sequence)
		const skipAlertSound = options.skipAlertSound ?? false;

		console.log(`[TTS] Speaking with speed: ${speed}, volume: ${volume}, provider: ${prefs.provider}, skipAlertSound: ${skipAlertSound}`);

		this.state.update((s) => ({
			...s,
			isSpeaking: true,
			currentProvider: prefs.provider,
			currentVoice: voice,
			error: null
		}));

		try {
			switch (prefs.provider) {
				case 'elevenlabs':
					await this.speakWithElevenLabs(text, voice, speed, volume, skipAlertSound);
					break;
				case 'openai':
					await this.speakWithOpenAI(text, voice, speed, volume, skipAlertSound);
					break;
				case 'browser':
					await this.speakWithBrowser(text, voice, speed, volume, options.pitch, skipAlertSound);
					break;
				default:
					throw new Error('No TTS provider configured');
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'TTS failed';
			this.state.update((s) => ({ ...s, error: errorMessage }));
			throw error;
		} finally {
			this.state.update((s) => ({
				...s,
				isSpeaking: false,
				currentProvider: null,
				currentVoice: null
			}));
		}
	}

	/**
	 * Speak using ElevenLabs API
	 */
	private async speakWithElevenLabs(text: string, voiceId: string, speed: number, volume: number, skipAlertSound: boolean): Promise<void> {
		const apiKey = getTTSApiKey('elevenlabs');
		if (!apiKey) {
			throw new Error('ElevenLabs API key not configured');
		}

		this.abortController = new AbortController();

		const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
			method: 'POST',
			headers: {
				Accept: 'audio/mpeg',
				'Content-Type': 'application/json',
				'xi-api-key': apiKey
			},
			body: JSON.stringify({
				text,
				model_id: 'eleven_turbo_v2_5',
				voice_settings: {
					// Optimal settings for Turbo v2.5
					stability: 0.7, // 0.6-0.8 recommended (lower = more expressive, higher = more consistent)
					similarity_boost: 0.75, // 0.7-0.75 recommended (maintains voice consistency)
					style: 0.4, // 0.3-0.5 recommended (adds natural emotion)
					use_speaker_boost: true
				}
			}),
			signal: this.abortController.signal
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
		}

		const audioBlob = await response.blob();
		await this.playAudioBlob(audioBlob, speed, volume, skipAlertSound);
	}

	/**
	 * Speak using OpenAI TTS API
	 */
	private async speakWithOpenAI(text: string, voice: string, speed: number, volume: number, skipAlertSound: boolean): Promise<void> {
		const apiKey = getTTSApiKey('openai');
		if (!apiKey) {
			throw new Error('OpenAI TTS API key not configured');
		}

		this.abortController = new AbortController();

		const response = await fetch('https://api.openai.com/v1/audio/speech', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: 'tts-1',
				input: text,
				voice: voice,
				speed: Math.max(0.25, Math.min(4.0, speed)),
				response_format: 'mp3'
			}),
			signal: this.abortController.signal
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OpenAI TTS API error: ${response.status} - ${errorText}`);
		}

		const audioBlob = await response.blob();
		await this.playAudioBlob(audioBlob, 1.0, volume, skipAlertSound); // Speed already applied via API
	}

	/**
	 * Speak using browser's built-in speech synthesis
	 */
	private async speakWithBrowser(
		text: string,
		voiceName: string,
		speed: number,
		volume: number,
		pitch?: number,
		skipAlertSound: boolean = false
	): Promise<void> {
		if (!this.browserSynth) {
			throw new Error('Browser speech synthesis not available');
		}

		// Cancel any ongoing speech
		this.browserSynth.cancel();

		const safeVolume = Math.max(0, Math.min(1, volume));
		const prefs = get(this.preferences);

		// Play alert sound first (if enabled and not skipped)
		if (!skipAlertSound && prefs.playAlertSound) {
			console.log('[TTS] Playing alert sound before browser TTS');
			await this.playAlertSoundInternal(safeVolume);
		} else if (skipAlertSound) {
			console.log('[TTS] Skipping alert sound for this utterance (skipAlertSound=true)');
		}

		console.log(`[TTS] Playing browser TTS with speed: ${speed}, volume: ${safeVolume}`);

		return new Promise((resolve, reject) => {
			const utterance = new SpeechSynthesisUtterance(text);

			const voice = this.browserVoices.find((v) => v.name === voiceName);
			if (voice) {
				utterance.voice = voice;
			}

			utterance.rate = Math.max(0.1, Math.min(10, speed));
			utterance.volume = safeVolume;
			utterance.pitch = pitch !== undefined ? Math.max(0, Math.min(2, pitch)) : 1;

			utterance.onend = () => resolve();
			utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));

			this.browserSynth!.speak(utterance);
		});
	}

	/**
	 * Play an audio blob (with optional alert sound first)
	 */
	private async playAudioBlob(blob: Blob, playbackRate: number = 1.0, volume: number = 0.7, skipAlertSound: boolean = false): Promise<void> {
		// Clean up previous audio
		this.cleanupAudio();

		// Clamp values to valid ranges
		const safeRate = Math.max(0.25, Math.min(4.0, playbackRate));
		const safeVolume = Math.max(0, Math.min(1, volume));
		const prefs = get(this.preferences);

		// Play alert sound first (if enabled and not skipped)
		if (!skipAlertSound && prefs.playAlertSound) {
			console.log('[TTS] Playing alert sound before TTS audio');
			await this.playAlertSoundInternal(safeVolume);
		} else if (skipAlertSound) {
			console.log('[TTS] Skipping alert sound for this utterance (skipAlertSound=true)');
		}

		console.log(`[TTS] Playing TTS audio with playbackRate: ${safeRate}, volume: ${safeVolume}`);

		return new Promise((resolve, reject) => {
			this.audioUrl = URL.createObjectURL(blob);
			this.audioElement = new Audio(this.audioUrl);

			// Set volume immediately
			this.audioElement.volume = safeVolume;

			// Wait for audio to be ready before setting playbackRate and playing
			this.audioElement.oncanplaythrough = () => {
				if (this.audioElement) {
					this.audioElement.playbackRate = safeRate;
					console.log(`[TTS] Audio ready, playbackRate set to: ${this.audioElement.playbackRate}`);
					this.audioElement.play().catch((err) => {
						this.cleanupAudio();
						reject(err);
					});
				}
			};

			this.audioElement.onended = () => {
				this.cleanupAudio();
				resolve();
			};

			this.audioElement.onerror = () => {
				this.cleanupAudio();
				reject(new Error('Audio playback failed'));
			};

			// Start loading the audio
			this.audioElement.load();
		});
	}

	/**
	 * Clean up audio resources
	 */
	private cleanupAudio(): void {
		if (this.audioElement) {
			this.audioElement.pause();
			this.audioElement.src = '';
			this.audioElement = null;
		}

		if (this.audioUrl) {
			URL.revokeObjectURL(this.audioUrl);
			this.audioUrl = null;
		}
	}

	/**
	 * Stop any current playback
	 */
	stop(): void {
		// Abort any pending requests
		if (this.abortController) {
			this.abortController.abort();
			this.abortController = null;
		}

		// Stop audio playback
		this.cleanupAudio();

		// Stop browser speech synthesis
		if (this.browserSynth) {
			this.browserSynth.cancel();
		}

		this.state.update((s) => ({
			...s,
			isSpeaking: false,
			currentProvider: null,
			currentVoice: null
		}));
	}

	/**
	 * Check if currently speaking
	 */
	isSpeaking(): boolean {
		return get(this.state).isSpeaking;
	}

	/**
	 * Check if TTS is available for a provider
	 */
	isProviderAvailable(provider: TTSProvider): boolean {
		switch (provider) {
			case 'elevenlabs':
				return hasTTSApiKey('elevenlabs');
			case 'openai':
				return hasTTSApiKey('openai');
			case 'browser':
				return this.browserSynth !== null;
			case 'none':
				return true;
			default:
				return false;
		}
	}

	/**
	 * Update preferences
	 */
	setProvider(provider: TTSProvider): void {
		this.preferences.update((p) => ({
			...p,
			provider,
			voice: this.getDefaultVoice(provider)
		}));
	}

	setVoice(voice: string): void {
		this.preferences.update((p) => ({ ...p, voice }));
	}

	setEnabled(enabled: boolean): void {
		this.preferences.update((p) => ({ ...p, enabled }));
	}

	setAutoPlay(autoPlay: boolean): void {
		this.preferences.update((p) => ({ ...p, autoPlay }));
	}

	setSpeed(speed: number): void {
		this.preferences.update((p) => ({
			...p,
			speed: Math.max(0.25, Math.min(4.0, speed))
		}));
	}

	setVolume(volume: number): void {
		this.preferences.update((p) => ({
			...p,
			volume: Math.max(0, Math.min(1.0, volume))
		}));
	}

	setPlayAlertSound(enabled: boolean): void {
		this.preferences.update((p) => ({ ...p, playAlertSound: enabled }));
	}

	/**
	 * Test TTS with a sample message
	 */
	async test(message: string = 'This is a test of the text-to-speech system.'): Promise<void> {
		const prefs = get(this.preferences);

		// Temporarily enable for testing
		const wasEnabled = prefs.enabled;
		if (!wasEnabled) {
			this.preferences.update((p) => ({ ...p, enabled: true }));
		}

		try {
			await this.speak(message);
		} finally {
			// Restore enabled state
			if (!wasEnabled) {
				this.preferences.update((p) => ({ ...p, enabled: wasEnabled }));
			}
		}
	}
}

// ============================================================================
// Export Singleton
// ============================================================================

export const tts = new TTSService();

// Convenience exports
export const ttsState = tts.state;
export const ttsPreferences = tts.preferences;

export function speak(text: string, options?: TTSOptions): Promise<void> {
	return tts.speak(text, options);
}

export function stopSpeaking(): void {
	tts.stop();
}

export function isSpeaking(): boolean {
	return tts.isSpeaking();
}

export function getVoicesForProvider(provider: TTSProvider): TTSVoice[] {
	return tts.getVoices(provider);
}

export function getDefaultVoiceForProvider(provider: TTSProvider): string {
	return tts.getDefaultVoice(provider);
}

export function testTTS(message?: string): Promise<void> {
	return tts.test(message);
}

export function setPlayAlertSound(enabled: boolean): void {
	tts.setPlayAlertSound(enabled);
}

export function playAlertSoundOnce(): Promise<void> {
	return tts.playAlertSoundOnce();
}
