<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { AnalysisResponseModal } from '$lib/components/modals';
	import { timeAgo, exportToPDF } from '$lib/utils';
	import { marked } from 'marked';
	import {
		chat,
		activeSession,
		activeMessages,
		isLoading as isChatLoading,
		chatError,
		recentSessions
	} from '$lib/stores/chat';
	import {
		llmPreferences,
		enabledCategoryList,
		analysisDepth
	} from '$lib/stores/llmPreferences';
	import { buildIntelligenceContext, getContextSummary } from '$lib/services/context-builder';
	import {
		hasApiKey,
		getStoredApiKey,
		sendLLMRequestWithTools,
		continueWithToolResults,
		formatContextForLLM
	} from '$lib/services/llm';
	import {
		getAnthropicTools,
		executeToolCall,
		getToolsSystemPrompt,
		type ActionHandlers,
		type ToolResult
	} from '$lib/services/ai-actions';
	import {
		ttsState,
		ttsPreferences,
		speak,
		stopSpeaking
	} from '$lib/services/tts';
	import type { ExternalData } from '$lib/services/context-builder';
	import type { IntelligenceContext, ContextCategory, ChatMessage } from '$lib/types/llm';
	import { ALL_ANALYSIS_PROMPTS, PROMPT_CATEGORIES, COVE_VARIANT_DESCRIPTIONS, type AnalysisPromptConfig } from '$lib/config/prompts';

	// Configure marked
	marked.setOptions({ breaks: true, gfm: true });

	// Portal action - teleports element to document body to escape stacking contexts
	function portal(node: HTMLElement) {
		// Move the node to the body
		document.body.appendChild(node);

		return {
			destroy() {
				// Clean up - remove from body when component is destroyed
				if (node.parentNode === document.body) {
					document.body.removeChild(node);
				}
			}
		};
	}

	interface Props {
		loading?: boolean;
		error?: string | null;
		externalData?: ExternalData;
		onOpenSettings?: () => void;
		actionHandlers?: ActionHandlers;
		initialDataLoaded?: boolean;
	}

	let {
		loading = false,
		error = null,
		externalData = {},
		onOpenSettings,
		actionHandlers,
		initialDataLoaded = false
	}: Props = $props();

	// Local state
	let inputValue = $state('');
	let selectedPromptId = $state('custom');
	let messagesContainer: HTMLDivElement | undefined = $state();
	// Context is built per-request but kept for potential future debugging
	// @ts-expect-error - intentionally unused, kept for future debugging
	let _currentContext: IntelligenceContext | null = $state(null);
	let executingTools = $state<string[]>([]);
	let toolsEnabled = $derived(!!actionHandlers);

	// Modal state for full response view
	let modalOpen = $state(false);
	let modalContent = $state('');
	let modalTimestamp = $state<number | undefined>(undefined);

	// TTS state
	let speakingMessageId = $state<string | null>(null);
	let lastAutoPlayedMessageId = $state<string | null>(null);

	// Session dropdown state
	let showSessionDropdown = $state(false);
	const sessions = $derived($recentSessions);

	// Derived values
	const hasApiKeyConfigured = $derived(hasApiKey($llmPreferences.provider));
	const session = $derived($activeSession);
	const messages = $derived($activeMessages);
	const isProcessing = $derived($isChatLoading);
	const chatErrorMsg = $derived($chatError);
	const count = $derived(messages.length);
	const isTTSEnabled = $derived($ttsPreferences.enabled && $ttsPreferences.provider !== 'none');
	const isTTSSpeaking = $derived($ttsState.isSpeaking);

	// Get selected prompt template
	const selectedPrompt = $derived(
		ALL_ANALYSIS_PROMPTS.find((p) => p.id === selectedPromptId) as AnalysisPromptConfig | undefined
	);

	// Group prompts by category for the dropdown
	const groupedPrompts = $derived.by(() => {
		const groups: Record<string, AnalysisPromptConfig[]> = {};
		for (const cat of PROMPT_CATEGORIES) {
			groups[cat.id] = ALL_ANALYSIS_PROMPTS.filter(p => p.category === cat.id);
		}
		return groups;
	});

	// Build context summary - updates reactively when selectedPrompt changes
	const contextSummary = $derived.by(() => {
		// Build filtered preferences based on selected prompt's focus categories
		const promptCategories = selectedPrompt?.focusCategories || [];
		const filteredPreferences = promptCategories.length > 0
			? {
				...$llmPreferences,
				enabledCategories: Object.fromEntries(
					Object.keys($llmPreferences.enabledCategories).map(cat => [
						cat,
						promptCategories.includes(cat as ContextCategory)
					])
				) as Record<ContextCategory, boolean>
			}
			: $llmPreferences;

		const ctx = buildIntelligenceContext(filteredPreferences, externalData);
		return getContextSummary(ctx);
	});

	// Auto-scroll to bottom when messages change
	$effect(() => {
		if (messages.length > 0 && messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	});

	// Auto-apply suggested depth when a prompt is selected
	$effect(() => {
		if (selectedPrompt?.suggestedDepth && selectedPrompt.suggestedDepth !== $analysisDepth) {
			llmPreferences.setAnalysisDepth(selectedPrompt.suggestedDepth);
		}
	});

	/**
	 * Send a message to the LLM
	 */
	async function handleSendMessage() {
		if (!inputValue.trim() && selectedPromptId === 'custom') return;
		if (!hasApiKeyConfigured) {
			chat.setError('Please configure your API key in settings first.');
			return;
		}

		// Build context with filtered categories based on selected prompt
		const promptCategories = selectedPrompt?.focusCategories || [];
		const filteredPreferences = promptCategories.length > 0
			? {
				...$llmPreferences,
				enabledCategories: Object.fromEntries(
					Object.keys($llmPreferences.enabledCategories).map(cat => [
						cat,
						promptCategories.includes(cat as ContextCategory)
					])
				) as Record<ContextCategory, boolean>
			}
			: $llmPreferences;

		const context = buildIntelligenceContext(filteredPreferences, externalData);
		_currentContext = context;

		// Determine the prompt
		const userPrompt = selectedPromptId !== 'custom' && selectedPrompt?.prompt
			? selectedPrompt.prompt + (inputValue.trim() ? `\n\nAdditional context: ${inputValue.trim()}` : '')
			: inputValue.trim();

		if (!userPrompt) return;

		// Create or ensure session exists
		if (!session) {
			chat.createSession(undefined, $enabledCategoryList);
		}

		// Add user message
		chat.addMessage('user', userPrompt);

		// Clear input
		inputValue = '';

		// Set loading
		chat.setLoading(true);

		try {
			const apiKey = getStoredApiKey($llmPreferences.provider);
			if (!apiKey) {
				throw new Error('API key not found');
			}

			// Build system prompt with context
			// Convert depth to max context length
			const maxContextLength = $analysisDepth === 'detailed' ? 80000 : $analysisDepth === 'standard' ? 50000 : 30000;
			const contextContent = formatContextForLLM(context, maxContextLength);
			const toolsPrompt = toolsEnabled ? getToolsSystemPrompt() : '';
			const baseSystemPrompt = $llmPreferences.systemPrompt || 'You are ARTEMIS, an advanced intelligence analysis system. Analyze the provided context and give clear, actionable insights.';
			const systemPrompt = `${baseSystemPrompt}\n\n${toolsPrompt}\n\n## Current Intelligence Context\n${contextContent}`;

			// Get tools if handlers are provided
			const tools = toolsEnabled ? getAnthropicTools() : [];

			// Convert depth to max tokens
			const maxTokens = $analysisDepth === 'detailed' ? 4096 : $analysisDepth === 'standard' ? 2048 : 1024;

			// Call LLM with tools
			let response = await sendLLMRequestWithTools(
				$llmPreferences.provider,
				{
					systemPrompt,
					messages: [{ role: 'user', content: userPrompt }],
					maxTokens,
					temperature: 0.7
				},
				tools,
				{
					apiKey,
					model: $llmPreferences.model,
					customEndpoint: $llmPreferences.customEndpoint
				}
			);

			// Handle tool calls in a loop
			let iterations = 0;
			const maxIterations = 5; // Prevent infinite loops

			while (response.toolCalls && response.toolCalls.length > 0 && iterations < maxIterations && actionHandlers) {
				iterations++;

				// Execute all tool calls
				const toolResults: ToolResult[] = [];
				for (const toolCall of response.toolCalls) {
					executingTools = [...executingTools, toolCall.name];

					try {
						const result = await executeToolCall(toolCall, actionHandlers);
						toolResults.push(result);
					} catch (err) {
						toolResults.push({
							toolCallId: toolCall.id,
							success: false,
							error: err instanceof Error ? err.message : 'Tool execution failed'
						});
					}

					executingTools = executingTools.filter(t => t !== toolCall.name);
				}

				// Rebuild context after tool execution (data may have changed)
				const updatedContext = buildIntelligenceContext($llmPreferences, externalData);
				_currentContext = updatedContext;
				const updatedContextContent = formatContextForLLM(updatedContext, maxContextLength);
				const updatedSystemPrompt = `${baseSystemPrompt}\n\n${toolsPrompt}\n\n## Current Intelligence Context\n${updatedContextContent}`;

				// Convert tool calls to assistant content blocks format for Anthropic
				// Include any text content from the response along with tool_use blocks
				const assistantContentBlocks: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }> = [];

				// Add text content if present (the assistant may have said something before tool calls)
				if (response.content && response.content.trim()) {
					assistantContentBlocks.push({
						type: 'text' as const,
						text: response.content
					});
				}

				// Add all tool_use blocks
				for (const tc of response.toolCalls!) {
					assistantContentBlocks.push({
						type: 'tool_use' as const,
						id: tc.id,
						name: tc.name,
						input: tc.parameters
					});
				}

				// Convert tool results to Anthropic format
				const anthropicToolResults = toolResults.map(tr => ({
					tool_use_id: tr.toolCallId,
					content: tr.success ? (tr.result || 'Success') : (tr.error || 'Failed')
				}));

				// Continue conversation with tool results
				response = await continueWithToolResults(
					$llmPreferences.provider,
					[{ role: 'user', content: userPrompt }],
					assistantContentBlocks,
					anthropicToolResults,
					{
						apiKey,
						model: $llmPreferences.model,
						customEndpoint: $llmPreferences.customEndpoint,
						systemPrompt: updatedSystemPrompt,
						maxTokens,
						tools
					}
				);
			}

			// Add assistant response
			chat.addMessage('assistant', response.content, {
				tokenCount: response.tokenUsage?.total
			});
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to get analysis';
			chat.setError(errorMessage);
			chat.addMessage('assistant', '', { error: errorMessage });
		} finally {
			chat.setLoading(false);
			executingTools = [];
		}
	}

	/**
	 * Handle keyboard input
	 */
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	}

	/**
	 * Start a new session
	 */
	function handleNewSession() {
		chat.createSession(undefined, $enabledCategoryList);
	}

	/**
	 * Clear current session
	 */
	function handleClearSession() {
		if (session) {
			chat.clearSession(session.id);
		}
	}

	/**
	 * Format message content with markdown (using marked)
	 */
	function formatContent(content: string): string {
		return marked.parse(content) as string;
	}

	/**
	 * Open full response in modal
	 */
	function openModal(message: ChatMessage) {
		modalContent = message.content;
		modalTimestamp = message.timestamp;
		modalOpen = true;
	}

	/**
	 * Handle PDF export from modal
	 */
	function handleExportPDF() {
		exportToPDF(modalContent, {
			title: 'PROJECT ARTEMIS - Intelligence Analysis',
			subtitle: 'Situation Monitor Report',
			timestamp: modalTimestamp ? new Date(modalTimestamp) : new Date()
		});
	}

	/**
	 * Strip markdown formatting for TTS
	 */
	function stripMarkdownForTTS(content: string): string {
		return content
			// Remove headers
			.replace(/^#{1,6}\s+/gm, '')
			// Remove bold/italic
			.replace(/\*\*(.+?)\*\*/g, '$1')
			.replace(/\*(.+?)\*/g, '$1')
			.replace(/__(.+?)__/g, '$1')
			.replace(/_(.+?)_/g, '$1')
			// Remove code blocks
			.replace(/```[\s\S]*?```/g, '')
			.replace(/`(.+?)`/g, '$1')
			// Remove links, keep text
			.replace(/\[(.+?)\]\(.+?\)/g, '$1')
			// Remove bullet points
			.replace(/^[-*•]\s+/gm, '')
			// Remove numbered lists
			.replace(/^\d+\.\s+/gm, '')
			// Remove blockquotes
			.replace(/^>\s+/gm, '')
			// Remove horizontal rules
			.replace(/^---+$/gm, '')
			// Remove tables (simplistic)
			.replace(/\|.*\|/g, '')
			// Clean up multiple newlines
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}

	/**
	 * Handle TTS read aloud for a message
	 */
	async function handleReadAloud(message: ChatMessage) {
		if (speakingMessageId === message.id && isTTSSpeaking) {
			// Stop if already speaking this message
			stopSpeaking();
			speakingMessageId = null;
			return;
		}

		// Stop any current playback
		stopSpeaking();
		speakingMessageId = message.id;

		try {
			const textToSpeak = stripMarkdownForTTS(message.content);
			await speak(textToSpeak);
		} catch (e) {
			console.error('TTS failed:', e);
		} finally {
			speakingMessageId = null;
		}
	}

	/**
	 * Auto-play TTS for new assistant messages
	 */
	$effect(() => {
		// Only run if autoPlay is enabled and we have messages
		if (!$ttsPreferences.autoPlay || !isTTSEnabled || messages.length === 0) {
			return;
		}

		// Find the last assistant message
		const lastMessage = messages[messages.length - 1];

		// Check if it's a new assistant message that we haven't auto-played yet
		if (
			lastMessage &&
			lastMessage.role === 'assistant' &&
			lastMessage.content &&
			!lastMessage.error &&
			lastMessage.id !== lastAutoPlayedMessageId &&
			!isProcessing
		) {
			// Mark this message as auto-played
			lastAutoPlayedMessageId = lastMessage.id;

			// Auto-play the message
			handleReadAloud(lastMessage);
		}
	});
</script>

<!-- Full Response Modal - Portal to body to escape all stacking contexts -->
{#if modalOpen}
	<div class="analysis-modal-portal" use:portal>
		<AnalysisResponseModal
			open={modalOpen}
			content={modalContent}
			timestamp={modalTimestamp}
			onClose={() => modalOpen = false}
			onExportPDF={handleExportPDF}
		/>
	</div>
{/if}

<Panel id="analysis" title="AI Analysis" {count} loading={loading || isProcessing} {error} skeletonType="generic" skeletonCount={3}>
	{#snippet actions()}
		<!-- Session History Dropdown -->
		<div class="session-dropdown-container">
			<button
				class="action-btn text-[10px] sm:text-xs"
				onclick={() => showSessionDropdown = !showSessionDropdown}
				title="Session History"
			>
				H
			</button>
			{#if showSessionDropdown && sessions.length > 0}
				<div class="session-dropdown">
					<div class="session-dropdown-header text-[8px] sm:text-[9px]">RECENT SESSIONS</div>
					{#each sessions as sess (sess.id)}
						<button
							class="session-item text-[9px] sm:text-[10px]"
							class:active={sess.id === session?.id}
							onclick={() => { chat.setActiveSession(sess.id); showSessionDropdown = false; }}
						>
							<span class="session-title">{sess.title}</span>
							<span class="session-count">{sess.messages.length}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<button class="action-btn text-[10px] sm:text-xs" onclick={handleNewSession} title="New Session">
			+
		</button>
		{#if messages.length > 0}
			<button class="action-btn text-[10px] sm:text-xs" onclick={handleClearSession} title="Clear">
				C
			</button>
		{/if}
	{/snippet}

	<div class="analysis-content">
		<!-- Context Summary -->
		<div class="context-summary">
			<span class="context-label text-[9px] sm:text-[10px]">CONTEXT:</span>
			<span class="context-value text-[9px] sm:text-[10px]">{contextSummary}</span>
		</div>

		<!-- Initial Data Loading Warning -->
		{#if !initialDataLoaded}
			<div class="loading-warning">
				<div class="loading-spinner"></div>
				<p class="text-[10px] sm:text-xs">Loading intelligence data...</p>
				<p class="text-[9px] sm:text-[10px] text-muted">AI analysis will be available once data is loaded</p>
			</div>
		{:else if !hasApiKeyConfigured}
			<!-- API Key Warning -->
			<div class="api-warning">
				<p class="text-[10px] sm:text-xs">No API key configured</p>
				{#if onOpenSettings}
					<button class="settings-btn text-[10px] sm:text-xs" onclick={onOpenSettings}>
						CONFIGURE API KEY
					</button>
				{/if}
			</div>
		{/if}

		<!-- Error Display -->
		{#if chatErrorMsg}
			<div class="error-banner">
				<span class="text-[10px] sm:text-xs">{chatErrorMsg}</span>
				<button class="dismiss-btn" onclick={() => chat.setError(null)}>x</button>
			</div>
		{/if}

		<!-- Tool Execution Indicator -->
		{#if executingTools.length > 0}
			<div class="tool-indicator">
				<div class="tool-spinner"></div>
				<div class="tool-info">
					<span class="tool-label text-[9px] sm:text-[10px]">ARTEMIS ACTION</span>
					<span class="tool-text text-[10px] sm:text-xs">
						{#if executingTools.includes('refresh_all')}
							Gathering all intelligence data...
						{:else if executingTools.includes('refresh_news')}
							Refreshing news feeds...
						{:else if executingTools.includes('refresh_markets')}
							Updating market data...
						{:else if executingTools.includes('refresh_crypto')}
							Fetching crypto & whale data...
						{:else if executingTools.includes('refresh_geopolitical')}
							Scanning geopolitical sources...
						{:else if executingTools.includes('refresh_infrastructure')}
							Checking infrastructure status...
						{:else if executingTools.includes('refresh_environmental')}
							Monitoring environmental events...
						{:else if executingTools.includes('refresh_alternative')}
							Pulling alternative intel...
						{:else}
							{executingTools.join(', ')}
						{/if}
					</span>
				</div>
			</div>
		{/if}

		<!-- Messages Container -->
		<div class="messages-container" bind:this={messagesContainer}>
			{#if messages.length === 0}
				<div class="empty-state">
					<p class="text-[10px] sm:text-xs">Select a prompt or ask a question</p>
				</div>
			{:else}
				{#each messages.filter(m => m.role === 'user' || m.role === 'assistant') as message (message.id)}
					<div class="message" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'}>
						<div class="message-header">
							<span class="message-role text-[9px] sm:text-[10px]">
								{message.role === 'user' ? 'YOU' : 'ARTEMIS'}
							</span>
							<div class="message-header-right">
								{#if message.role === 'assistant' && message.content && isTTSEnabled}
									<button
										class="tts-btn"
										class:speaking={speakingMessageId === message.id && isTTSSpeaking}
										onclick={() => handleReadAloud(message)}
										title={speakingMessageId === message.id && isTTSSpeaking ? 'Stop reading' : 'Read aloud'}
									>
										{speakingMessageId === message.id && isTTSSpeaking ? '◼' : '▶'}
									</button>
								{/if}
								{#if message.role === 'assistant' && message.content}
									<button
										class="expand-btn"
										onclick={() => openModal(message)}
										title="View full response"
									>
										⤢
									</button>
								{/if}
								<span class="message-time text-[9px] sm:text-[10px]">
									{timeAgo(message.timestamp)}
								</span>
							</div>
						</div>
						<div class="message-content text-[10px] sm:text-xs">
							{#if message.error}
								<span class="error-text">{message.error}</span>
							{:else if message.content}
								{@html formatContent(message.content)}
							{:else if isProcessing && message.role === 'assistant'}
								<span class="typing-indicator">Analyzing...</span>
							{/if}
						</div>
						{#if message.tokenCount || (message.role === 'assistant' && message.content)}
							<div class="message-footer">
								{#if message.tokenCount}
									<span class="message-meta text-[8px] sm:text-[9px]">
										{message.tokenCount} tokens
									</span>
								{/if}
								{#if message.role === 'assistant' && message.content}
									<button
										class="export-inline-btn text-[8px] sm:text-[9px]"
										onclick={() => openModal(message)}
									>
										EXPAND / EXPORT
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>

		<!-- Prompt Selector -->
		<div class="prompt-selector">
			<select
				class="prompt-select text-[10px] sm:text-xs"
				bind:value={selectedPromptId}
				disabled={isProcessing || !initialDataLoaded}
			>
				<option value="custom">Custom Question...</option>
				{#each PROMPT_CATEGORIES as category}
					<optgroup label="{category.icon} {category.name}">
						{#each groupedPrompts[category.id] || [] as prompt}
							<option value={prompt.id}>{prompt.icon} {prompt.name}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
			{#if selectedPrompt}
				<div class="prompt-info">
					<span class="prompt-desc text-[9px] sm:text-[10px]">{selectedPrompt.description}</span>
					<div class="prompt-badges">
						{#if selectedPrompt.coveEnabled && selectedPrompt.coveVariant}
							{@const coveInfo = COVE_VARIANT_DESCRIPTIONS[selectedPrompt.coveVariant]}
							<span
								class="prompt-cove text-[8px] sm:text-[9px]"
								title="{coveInfo.description} Accuracy: {coveInfo.accuracyGain}"
							>
								✓ {coveInfo.name}
							</span>
						{:else}
							<span class="prompt-cove prompt-cove-disabled text-[8px] sm:text-[9px]" title="No verification - faster response">
								FAST
							</span>
						{/if}
						<span class="prompt-depth text-[8px] sm:text-[9px]">{selectedPrompt.suggestedDepth.toUpperCase()}</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Input Area -->
		<div class="input-area">
			<textarea
				class="message-input text-[10px] sm:text-xs"
				placeholder={!initialDataLoaded ? 'Waiting for data to load...' : selectedPromptId === 'custom' ? 'Ask about the current situation...' : 'Add context (optional)...'}
				bind:value={inputValue}
				onkeydown={handleKeyDown}
				disabled={isProcessing || !hasApiKeyConfigured || !initialDataLoaded}
				rows="2"
			></textarea>
			<button
				class="send-btn text-[10px] sm:text-xs"
				onclick={handleSendMessage}
				disabled={isProcessing || !hasApiKeyConfigured || !initialDataLoaded || (!inputValue.trim() && selectedPromptId === 'custom')}
			>
				{isProcessing ? '...' : !initialDataLoaded ? 'WAIT' : 'SEND'}
			</button>
		</div>
	</div>
</Panel>

<style>
	.analysis-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		min-height: 200px;
	}

	.context-summary {
		display: flex;
		gap: 0.3rem;
		padding: 0.3rem 0.5rem;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		overflow: hidden;
	}

	.context-label {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--accent);
		letter-spacing: 0.1em;
		flex-shrink: 0;
	}

	.context-value {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.loading-warning {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 0.75rem;
		background: rgba(6, 182, 212, 0.08);
		border: 1px solid rgba(6, 182, 212, 0.3);
		border-radius: 2px;
		text-align: center;
	}

	.loading-warning p {
		color: var(--accent);
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.loading-warning .text-muted {
		color: var(--text-muted);
	}

	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid rgba(6, 182, 212, 0.2);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.api-warning {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.5rem;
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.3);
		border-radius: 2px;
		text-align: center;
	}

	.api-warning p {
		color: var(--warning);
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.05em;
	}

	.settings-btn {
		padding: 0.3rem 0.6rem;
		background: transparent;
		border: 1px solid var(--warning);
		border-radius: 2px;
		color: var(--warning);
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s;
	}

	.settings-btn:hover {
		background: rgba(245, 158, 11, 0.1);
	}

	.error-banner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0.5rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 2px;
		color: var(--danger);
	}

	.dismiss-btn {
		background: none;
		border: none;
		color: var(--danger);
		cursor: pointer;
		padding: 0 0.25rem;
	}

	.tool-indicator {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
		background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%);
		border: 1px solid rgba(6, 182, 212, 0.4);
		border-radius: 2px;
		animation: pulse-glow 2s ease-in-out infinite;
	}

	@keyframes pulse-glow {
		0%, 100% {
			opacity: 1;
			box-shadow: 0 0 8px rgba(6, 182, 212, 0.3);
		}
		50% {
			opacity: 0.9;
			box-shadow: 0 0 16px rgba(6, 182, 212, 0.5);
		}
	}

	.tool-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(6, 182, 212, 0.3);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	.tool-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.tool-label {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--accent);
		letter-spacing: 0.15em;
		text-transform: uppercase;
		font-weight: 700;
	}

	.tool-text {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text);
		letter-spacing: 0.02em;
	}

	.messages-container {
		flex: 1;
		min-height: 100px;
		max-height: 300px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-right: 0.25rem;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-dim);
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.message {
		padding: 0.4rem 0.5rem;
		border-radius: 2px;
	}

	.message.user {
		background: var(--interactive-bg);
		border: 1px solid var(--border);
		margin-left: 1rem;
	}

	.message.assistant {
		background: var(--card-bg);
		border: 1px solid var(--accent-border);
		margin-right: 1rem;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.2rem;
	}

	.message-role {
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
	}

	.message.user .message-role {
		color: var(--text-dim);
	}

	.message.assistant .message-role {
		color: var(--accent);
	}

	.message-time {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
	}

	.message-content {
		color: var(--text);
		line-height: 1.4;
		word-break: break-word;
	}

	.message-content :global(.msg-h2) {
		font-size: var(--fs-sm);
		font-weight: 700;
		color: var(--accent);
		margin: 0.5rem 0 0.25rem;
	}

	.message-content :global(.msg-h3) {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--text-primary);
		margin: 0.4rem 0 0.2rem;
	}

	.message-content :global(.msg-h4) {
		font-size: var(--fs-xs);
		font-weight: 600;
		color: var(--text);
		margin: 0.3rem 0 0.15rem;
	}

	.message-content :global(.msg-list) {
		margin: 0.25rem 0;
		padding-left: 1rem;
		list-style: none;
	}

	.message-content :global(.msg-list li) {
		position: relative;
		margin: 0.1rem 0;
	}

	.message-content :global(.msg-list li::before) {
		content: '•';
		position: absolute;
		left: -0.75rem;
		color: var(--accent);
	}

	.error-text {
		color: var(--danger);
		font-style: italic;
	}

	.typing-indicator {
		color: var(--text-muted);
		font-style: italic;
	}

	.message-meta {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
	}

	.message-header-right {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.expand-btn {
		padding: 0.1rem 0.25rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.7rem;
		line-height: 1;
		transition: all 0.15s ease;
	}

	.expand-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	.tts-btn {
		padding: 0.1rem 0.25rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.6rem;
		line-height: 1;
		transition: all 0.15s ease;
		min-width: 1.2rem;
		text-align: center;
	}

	.tts-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	.tts-btn.speaking {
		background: rgba(34, 211, 238, 0.2);
		border-color: var(--accent);
		color: var(--accent);
		animation: pulse-tts 1.5s ease-in-out infinite;
	}

	@keyframes pulse-tts {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.message-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 0.3rem;
		padding-top: 0.25rem;
		border-top: 1px solid var(--border-subtle);
	}

	.export-inline-btn {
		padding: 0.15rem 0.4rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-muted);
		cursor: pointer;
		font-family: 'SF Mono', Monaco, monospace;
		letter-spacing: 0.05em;
		transition: all 0.15s ease;
	}

	.export-inline-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Markdown content styling */
	.message-content :global(h1) {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--accent);
		margin: 0.5rem 0 0.3rem;
	}

	.message-content :global(h2) {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0.4rem 0 0.25rem;
	}

	.message-content :global(h3) {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin: 0.35rem 0 0.2rem;
	}

	.message-content :global(p) {
		margin: 0 0 0.5rem;
	}

	.message-content :global(ul),
	.message-content :global(ol) {
		margin: 0.25rem 0 0.5rem;
		padding-left: 1.25rem;
	}

	.message-content :global(li) {
		margin: 0.15rem 0;
	}

	.message-content :global(li::marker) {
		color: var(--accent);
	}

	.message-content :global(strong) {
		font-weight: 600;
		color: var(--text-primary);
	}

	.message-content :global(code) {
		background: var(--card-bg);
		padding: 0.1rem 0.3rem;
		border-radius: 2px;
		font-family: 'SF Mono', Monaco, monospace;
		font-size: 0.85em;
		color: var(--accent);
	}

	.message-content :global(pre) {
		background: var(--card-bg);
		padding: 0.5rem;
		border-radius: 2px;
		overflow-x: auto;
		margin: 0.5rem 0;
		border: 1px solid var(--border);
	}

	.message-content :global(blockquote) {
		border-left: 3px solid var(--accent);
		margin: 0.5rem 0;
		padding: 0.4rem 0.6rem;
		color: var(--text);
		background: linear-gradient(90deg, rgba(6, 182, 212, 0.06) 0%, var(--card-bg) 100%);
		border-radius: 0 2px 2px 0;
		font-weight: 500;
	}

	.message-content :global(blockquote p) {
		margin-bottom: 0;
	}

	.message-content :global(blockquote strong) {
		color: var(--accent);
	}

	.message-content :global(hr) {
		border: none;
		height: 1px;
		background: linear-gradient(to right, transparent, var(--accent), transparent);
		margin: 0.75rem 0;
	}

	.message-content :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.5rem 0;
		font-size: 0.7rem;
	}

	.message-content :global(th) {
		padding: 0.3rem 0.4rem;
		border: 1px solid var(--border);
		background: var(--surface);
		font-weight: 600;
		color: var(--accent);
		text-transform: uppercase;
		font-size: 0.6rem;
		letter-spacing: 0.03em;
		text-align: left;
	}

	.message-content :global(td) {
		padding: 0.25rem 0.4rem;
		border: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}

	.message-content :global(tbody tr:nth-child(even)) {
		background: rgba(255, 255, 255, 0.02);
	}

	.prompt-selector {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.prompt-select {
		width: 100%;
		padding: 0.3rem 0.5rem;
		/* Use solid dark background for cross-browser dropdown compatibility */
		background-color: #1e293b; /* slate-800 solid */
		border: 1px solid var(--border);
		border-radius: 2px;
		color: #e2e8f0; /* slate-200 - light text */
		font-family: 'SF Mono', Monaco, monospace;
		cursor: pointer;
		/* Custom dropdown arrow */
		-webkit-appearance: none;
		-moz-appearance: none;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.5rem center;
		padding-right: 1.75rem;
		transition: all 0.15s ease;
	}

	.prompt-select:hover:not(:disabled) {
		background-color: #334155; /* slate-700 */
		border-color: var(--accent-border);
	}

	.prompt-select:focus {
		border-color: var(--accent);
		background-color: #334155; /* slate-700 */
	}

	.prompt-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background-color: #0f172a; /* slate-900 */
	}

	/* Optgroup and option styling - solid colors for cross-browser support */
	.prompt-select optgroup {
		font-weight: 700;
		color: #22d3ee; /* cyan-400 accent */
		background-color: #0f172a; /* slate-900 - darker for contrast */
		padding: 0.25rem 0;
	}

	.prompt-select option {
		font-weight: 400;
		color: #e2e8f0; /* slate-200 - light text */
		background-color: #1e293b; /* slate-800 solid */
		padding: 0.2rem 0.5rem;
	}

	.prompt-select option:hover,
	.prompt-select option:focus,
	.prompt-select option:checked {
		background-color: #334155; /* slate-700 */
		color: #22d3ee; /* cyan-400 accent */
	}

	.prompt-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.2rem 0.4rem;
		background: rgba(6, 182, 212, 0.05);
		border: 1px solid rgba(6, 182, 212, 0.15);
		border-radius: 2px;
		gap: 0.5rem;
	}

	.prompt-desc {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-dim);
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.prompt-badges {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.prompt-depth {
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--accent);
		letter-spacing: 0.1em;
		padding: 0.1rem 0.3rem;
		background: rgba(6, 182, 212, 0.15);
		border-radius: 2px;
	}

	.prompt-cove {
		font-family: 'SF Mono', Monaco, monospace;
		color: #10b981;
		letter-spacing: 0.05em;
		padding: 0.1rem 0.3rem;
		background: rgba(16, 185, 129, 0.15);
		border-radius: 2px;
		cursor: help;
	}

	.prompt-cove-disabled {
		color: var(--text-muted);
		background: rgba(100, 116, 139, 0.15);
	}

	.input-area {
		display: flex;
		gap: 0.3rem;
	}

	.message-input {
		flex: 1;
		padding: 0.4rem 0.5rem;
		background: var(--interactive-bg);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text);
		font-family: 'SF Mono', Monaco, monospace;
		resize: none;
	}

	.message-input::placeholder {
		color: var(--text-muted);
	}

	.message-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.message-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.send-btn {
		padding: 0.4rem 0.8rem;
		background: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 2px;
		color: var(--bg);
		font-family: 'SF Mono', Monaco, monospace;
		font-weight: 700;
		letter-spacing: 0.1em;
		cursor: pointer;
		transition: all 0.15s;
	}

	.send-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn {
		width: 1.2rem;
		height: 1.2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-dim);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.action-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	/* Session dropdown */
	.session-dropdown-container {
		position: relative;
	}

	.session-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 0.25rem;
		min-width: 160px;
		max-width: 220px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 2px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
		z-index: 100;
		overflow: hidden;
	}

	.session-dropdown-header {
		padding: 0.3rem 0.5rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--accent);
		letter-spacing: 0.1em;
		background: var(--card-bg);
		border-bottom: 1px solid var(--border);
	}

	.session-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0.4rem 0.5rem;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border-subtle);
		color: var(--text);
		font-family: 'SF Mono', Monaco, monospace;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}

	.session-item:last-child {
		border-bottom: none;
	}

	.session-item:hover {
		background: var(--surface-hover);
		color: var(--accent);
	}

	.session-item.active {
		background: rgba(6, 182, 212, 0.1);
		border-left: 2px solid var(--accent);
	}

	.session-title {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-right: 0.5rem;
	}

	.session-count {
		flex-shrink: 0;
		padding: 0.1rem 0.3rem;
		background: var(--card-bg);
		border-radius: 2px;
		font-size: 0.65rem;
		color: var(--text-muted);
	}

	/* Modal portal wrapper - teleported to body to escape all stacking contexts */
	.analysis-modal-portal {
		position: fixed;
		inset: 0;
		z-index: 99999;
	}
</style>
