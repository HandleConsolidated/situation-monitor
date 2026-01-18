/**
 * Chat Store - manages chat sessions and messages for LLM analysis
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type {
	ChatState,
	ChatSession,
	ChatMessage,
	ChatRole,
	ContextCategory
} from '$lib/types/llm';
import { generateMessageId, generateSessionId } from '$lib/services/llm';

// Storage key
const STORAGE_KEY = 'aegis_chat_sessions';

// Maximum sessions to retain
const MAX_SESSIONS = 20;

// Maximum messages per session
const MAX_MESSAGES_PER_SESSION = 100;

/**
 * Load chat state from localStorage
 */
function loadFromStorage(): ChatSession[] {
	if (!browser) return [];

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const sessions = JSON.parse(stored);
			// Validate and return
			if (Array.isArray(sessions)) {
				return sessions;
			}
		}
	} catch (e) {
		console.warn('Failed to load chat sessions from localStorage:', e);
	}
	return [];
}

/**
 * Save chat state to localStorage
 */
function saveToStorage(sessions: ChatSession[]): void {
	if (!browser) return;

	try {
		// Keep only the most recent sessions
		const toStore = sessions.slice(0, MAX_SESSIONS);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
	} catch (e) {
		console.warn('Failed to save chat sessions to localStorage:', e);
	}
}

/**
 * Create initial state
 */
function createInitialState(): ChatState {
	const savedSessions = loadFromStorage();

	return {
		sessions: savedSessions,
		activeSessionId: savedSessions.length > 0 ? savedSessions[0].id : null,
		isLoading: false,
		error: null,
		initialized: browser
	};
}

/**
 * Create the chat store
 */
function createChatStore() {
	const initialState = createInitialState();
	const { subscribe, set, update } = writable<ChatState>(initialState);

	return {
		subscribe,

		/**
		 * Create a new chat session
		 */
		createSession(
			title?: string,
			contextCategories: ContextCategory[] = []
		): ChatSession {
			const session: ChatSession = {
				id: generateSessionId(),
				title: title || `Analysis ${new Date().toLocaleDateString()}`,
				messages: [],
				createdAt: Date.now(),
				lastActiveAt: Date.now(),
				contextCategories
			};

			update((state) => {
				const newSessions = [session, ...state.sessions].slice(0, MAX_SESSIONS);
				saveToStorage(newSessions);

				return {
					...state,
					sessions: newSessions,
					activeSessionId: session.id
				};
			});

			return session;
		},

		/**
		 * Set the active session
		 */
		setActiveSession(sessionId: string | null): void {
			update((state) => ({
				...state,
				activeSessionId: sessionId
			}));
		},

		/**
		 * Add a message to the active session
		 */
		addMessage(
			role: ChatRole,
			content: string,
			options: {
				sessionId?: string;
				contextSnapshot?: string;
				tokenCount?: number;
				error?: string;
			} = {}
		): ChatMessage {
			const message: ChatMessage = {
				id: generateMessageId(),
				role,
				content,
				timestamp: Date.now(),
				contextSnapshot: options.contextSnapshot,
				tokenCount: options.tokenCount,
				error: options.error
			};

			update((state) => {
				const targetSessionId = options.sessionId || state.activeSessionId;

				if (!targetSessionId) {
					// Create new session if none exists
					const newSession: ChatSession = {
						id: generateSessionId(),
						title: `Analysis ${new Date().toLocaleDateString()}`,
						messages: [message],
						createdAt: Date.now(),
						lastActiveAt: Date.now(),
						contextCategories: []
					};

					const newSessions = [newSession, ...state.sessions].slice(0, MAX_SESSIONS);
					saveToStorage(newSessions);

					return {
						...state,
						sessions: newSessions,
						activeSessionId: newSession.id
					};
				}

				const newSessions = state.sessions.map((session) => {
					if (session.id === targetSessionId) {
						const newMessages = [...session.messages, message].slice(
							-MAX_MESSAGES_PER_SESSION
						);
						return {
							...session,
							messages: newMessages,
							lastActiveAt: Date.now()
						};
					}
					return session;
				});

				saveToStorage(newSessions);

				return {
					...state,
					sessions: newSessions
				};
			});

			return message;
		},

		/**
		 * Update the last message (for streaming or corrections)
		 */
		updateLastMessage(
			sessionId: string,
			updates: Partial<Pick<ChatMessage, 'content' | 'tokenCount' | 'error'>>
		): void {
			update((state) => {
				const newSessions = state.sessions.map((session) => {
					if (session.id === sessionId && session.messages.length > 0) {
						const lastIndex = session.messages.length - 1;
						const newMessages = [...session.messages];
						newMessages[lastIndex] = {
							...newMessages[lastIndex],
							...updates
						};
						return {
							...session,
							messages: newMessages,
							lastActiveAt: Date.now()
						};
					}
					return session;
				});

				saveToStorage(newSessions);

				return {
					...state,
					sessions: newSessions
				};
			});
		},

		/**
		 * Delete a message from a session
		 */
		deleteMessage(sessionId: string, messageId: string): void {
			update((state) => {
				const newSessions = state.sessions.map((session) => {
					if (session.id === sessionId) {
						return {
							...session,
							messages: session.messages.filter((m) => m.id !== messageId)
						};
					}
					return session;
				});

				saveToStorage(newSessions);

				return {
					...state,
					sessions: newSessions
				};
			});
		},

		/**
		 * Delete a session
		 */
		deleteSession(sessionId: string): void {
			update((state) => {
				const newSessions = state.sessions.filter((s) => s.id !== sessionId);
				saveToStorage(newSessions);

				// Update active session if needed
				let newActiveId = state.activeSessionId;
				if (state.activeSessionId === sessionId) {
					newActiveId = newSessions.length > 0 ? newSessions[0].id : null;
				}

				return {
					...state,
					sessions: newSessions,
					activeSessionId: newActiveId
				};
			});
		},

		/**
		 * Rename a session
		 */
		renameSession(sessionId: string, title: string): void {
			update((state) => {
				const newSessions = state.sessions.map((session) => {
					if (session.id === sessionId) {
						return { ...session, title };
					}
					return session;
				});

				saveToStorage(newSessions);

				return {
					...state,
					sessions: newSessions
				};
			});
		},

		/**
		 * Clear all messages in a session
		 */
		clearSession(sessionId: string): void {
			update((state) => {
				const newSessions = state.sessions.map((session) => {
					if (session.id === sessionId) {
						return { ...session, messages: [] };
					}
					return session;
				});

				saveToStorage(newSessions);

				return {
					...state,
					sessions: newSessions
				};
			});
		},

		/**
		 * Set loading state
		 */
		setLoading(loading: boolean): void {
			update((state) => ({
				...state,
				isLoading: loading,
				error: loading ? null : state.error
			}));
		},

		/**
		 * Set error state
		 */
		setError(error: string | null): void {
			update((state) => ({
				...state,
				error,
				isLoading: false
			}));
		},

		/**
		 * Get a session by ID
		 */
		getSession(sessionId: string): ChatSession | undefined {
			const state = get({ subscribe });
			return state.sessions.find((s) => s.id === sessionId);
		},

		/**
		 * Get the active session
		 */
		getActiveSession(): ChatSession | undefined {
			const state = get({ subscribe });
			if (!state.activeSessionId) return undefined;
			return state.sessions.find((s) => s.id === state.activeSessionId);
		},

		/**
		 * Get messages from active session
		 */
		getActiveMessages(): ChatMessage[] {
			const session = this.getActiveSession();
			return session?.messages || [];
		},

		/**
		 * Clear all sessions
		 */
		clearAllSessions(): void {
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
			set({
				sessions: [],
				activeSessionId: null,
				isLoading: false,
				error: null,
				initialized: true
			});
		},

		/**
		 * Export sessions as JSON
		 */
		exportSessions(): string {
			const state = get({ subscribe });
			return JSON.stringify(state.sessions, null, 2);
		},

		/**
		 * Import sessions from JSON
		 */
		importSessions(json: string): boolean {
			try {
				const sessions = JSON.parse(json);
				if (!Array.isArray(sessions)) {
					throw new Error('Invalid sessions format');
				}

				update((state) => {
					const merged = [...sessions, ...state.sessions]
						.reduce((acc: ChatSession[], session: ChatSession) => {
							// Dedupe by ID
							if (!acc.find((s: ChatSession) => s.id === session.id)) {
								acc.push(session);
							}
							return acc;
						}, [] as ChatSession[])
						.slice(0, MAX_SESSIONS);

					saveToStorage(merged);

					return {
						...state,
						sessions: merged,
						activeSessionId: merged.length > 0 ? merged[0].id : null
					};
				});

				return true;
			} catch (e) {
				console.error('Failed to import sessions:', e);
				return false;
			}
		}
	};
}

// Export singleton store
export const chat = createChatStore();

// Derived stores
export const activeSession = derived(chat, ($chat) =>
	$chat.activeSessionId
		? $chat.sessions.find((s) => s.id === $chat.activeSessionId)
		: undefined
);

export const activeMessages = derived(activeSession, ($session) =>
	$session?.messages || []
);

export const sessionCount = derived(chat, ($chat) => $chat.sessions.length);

export const isLoading = derived(chat, ($chat) => $chat.isLoading);

export const chatError = derived(chat, ($chat) => $chat.error);

export const recentSessions = derived(chat, ($chat) =>
	$chat.sessions
		.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
		.slice(0, 5)
);

// Re-export types
export type { ChatState, ChatSession, ChatMessage };
