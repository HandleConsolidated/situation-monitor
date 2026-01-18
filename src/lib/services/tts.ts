/**
 * Text-to-Speech Service
 * Supports multiple TTS providers: ElevenLabs, OpenAI, and browser native
 */

import { browser } from '$app/environment';
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
}

// ============================================================================
// Voice Definitions
// ============================================================================

export const ELEVENLABS_VOICES: TTSVoice[] = [
	{ id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', provider: 'elevenlabs', description: 'Calm, professional female' },
	{ id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', provider: 'elevenlabs', description: 'Confident female' },
	{ id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', provider: 'elevenlabs', description: 'Soft female' },
	{ id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', provider: 'elevenlabs', description: 'Mature male' },
	{ id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', provider: 'elevenlabs', description: 'Deep male' },
	{ id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', provider: 'elevenlabs', description: 'Strong male' },
	{ id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', provider: 'elevenlabs', description: 'Deep male narrator' },
	{ id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', provider: 'elevenlabs', description: 'Young male' }
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
	speed: 1.0
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
		const speed = options.speed || prefs.speed || 1.0;

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
					await this.speakWithElevenLabs(text, voice, speed);
					break;
				case 'openai':
					await this.speakWithOpenAI(text, voice, speed);
					break;
				case 'browser':
					await this.speakWithBrowser(text, voice, speed, options.pitch);
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
	private async speakWithElevenLabs(text: string, voiceId: string, speed: number): Promise<void> {
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
				model_id: 'eleven_monolingual_v1',
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.75,
					style: 0.0,
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
		await this.playAudioBlob(audioBlob, speed);
	}

	/**
	 * Speak using OpenAI TTS API
	 */
	private async speakWithOpenAI(text: string, voice: string, speed: number): Promise<void> {
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
		await this.playAudioBlob(audioBlob, 1.0); // Speed already applied via API
	}

	/**
	 * Speak using browser's built-in speech synthesis
	 */
	private speakWithBrowser(
		text: string,
		voiceName: string,
		speed: number,
		pitch?: number
	): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.browserSynth) {
				reject(new Error('Browser speech synthesis not available'));
				return;
			}

			// Cancel any ongoing speech
			this.browserSynth.cancel();

			const utterance = new SpeechSynthesisUtterance(text);

			const voice = this.browserVoices.find((v) => v.name === voiceName);
			if (voice) {
				utterance.voice = voice;
			}

			utterance.rate = Math.max(0.1, Math.min(10, speed));
			utterance.pitch = pitch !== undefined ? Math.max(0, Math.min(2, pitch)) : 1;

			utterance.onend = () => resolve();
			utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));

			this.browserSynth.speak(utterance);
		});
	}

	/**
	 * Play an audio blob
	 */
	private playAudioBlob(blob: Blob, playbackRate: number = 1.0): Promise<void> {
		return new Promise((resolve, reject) => {
			// Clean up previous audio
			this.cleanupAudio();

			this.audioUrl = URL.createObjectURL(blob);
			this.audioElement = new Audio(this.audioUrl);
			this.audioElement.playbackRate = playbackRate;

			this.audioElement.onended = () => {
				this.cleanupAudio();
				resolve();
			};

			this.audioElement.onerror = () => {
				this.cleanupAudio();
				reject(new Error('Audio playback failed'));
			};

			this.audioElement.play().catch((err) => {
				this.cleanupAudio();
				reject(err);
			});
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
