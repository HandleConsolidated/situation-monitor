<script lang="ts">
	import { marked } from 'marked';

	interface Props {
		open: boolean;
		content: string;
		timestamp?: number;
		onClose: () => void;
		onExportPDF: () => void;
	}

	let { open, content, timestamp, onClose, onExportPDF }: Props = $props();

	// Configure marked for safe rendering
	marked.setOptions({
		breaks: true,
		gfm: true
	});

	const renderedContent = $derived(marked.parse(content || '') as string);
	const formattedTime = $derived(
		timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()
	);

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={handleBackdropClick}>
		<div class="modal-container">
			<!-- Header -->
			<div class="modal-header">
				<div class="header-left">
					<span class="header-icon">◆</span>
					<h2 class="header-title">ARTEMIS ANALYSIS</h2>
					<span class="header-time">{formattedTime}</span>
				</div>
				<div class="header-actions">
					<button class="action-btn export-btn" onclick={onExportPDF} title="Export to PDF">
						<span class="btn-icon">📄</span>
						<span class="btn-label">EXPORT PDF</span>
					</button>
					<button class="action-btn close-btn" onclick={onClose} title="Close">
						<span class="btn-icon">✕</span>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="modal-content">
				<article class="markdown-content">
					{@html renderedContent}
				</article>
			</div>

			<!-- Footer -->
			<div class="modal-footer">
				<div class="footer-info">
					<span class="footer-label">PROJECT ARTEMIS</span>
					<span class="footer-divider">|</span>
					<span class="footer-text">Intelligence Analysis System</span>
				</div>
				<button class="close-text-btn" onclick={onClose}>CLOSE</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1rem;
		isolation: isolate;
	}

	.modal-container {
		width: 100%;
		max-width: 900px;
		max-height: 90vh;
		background: var(--surface-solid);
		border: 1px solid var(--border);
		border-radius: 4px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
	}

	/* Header */
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-icon {
		color: var(--accent);
		font-size: 1rem;
	}

	.header-title {
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--text-primary);
		margin: 0;
		font-family: 'Orbitron', sans-serif;
	}

	.header-time {
		font-size: 0.65rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		padding-left: 0.75rem;
		border-left: 1px solid var(--border);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.75rem;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-dim);
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: 'SF Mono', Monaco, monospace;
		font-size: 0.65rem;
		letter-spacing: 0.05em;
	}

	.action-btn:hover {
		background: var(--surface-hover);
		border-color: var(--accent);
		color: var(--accent);
	}

	.export-btn:hover {
		border-color: var(--success);
		color: var(--success);
	}

	.close-btn {
		padding: 0.4rem 0.5rem;
	}

	.btn-icon {
		font-size: 0.75rem;
	}

	.btn-label {
		text-transform: uppercase;
	}

	/* Content */
	.modal-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.markdown-content {
		color: var(--text);
		line-height: 1.7;
		font-size: 0.875rem;
	}

	.markdown-content :global(h1) {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--accent);
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
	}

	.markdown-content :global(h2) {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 1.5rem 0 0.75rem;
	}

	.markdown-content :global(h3) {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-secondary);
		margin: 1.25rem 0 0.5rem;
	}

	.markdown-content :global(h4) {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text);
		margin: 1rem 0 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.markdown-content :global(p) {
		margin: 0 0 1rem;
	}

	.markdown-content :global(ul),
	.markdown-content :global(ol) {
		margin: 0 0 1rem;
		padding-left: 1.5rem;
	}

	.markdown-content :global(li) {
		margin: 0.25rem 0;
	}

	.markdown-content :global(li::marker) {
		color: var(--accent);
	}

	.markdown-content :global(strong) {
		color: var(--text-primary);
		font-weight: 600;
	}

	.markdown-content :global(em) {
		color: var(--text-secondary);
		font-style: italic;
	}

	.markdown-content :global(code) {
		background: var(--card-bg);
		padding: 0.15rem 0.4rem;
		border-radius: 2px;
		font-family: 'SF Mono', Monaco, monospace;
		font-size: 0.8em;
		color: var(--accent);
	}

	.markdown-content :global(pre) {
		background: var(--card-bg);
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		margin: 1rem 0;
		border: 1px solid var(--border);
	}

	.markdown-content :global(pre code) {
		background: none;
		padding: 0;
	}

	.markdown-content :global(blockquote) {
		border-left: 4px solid var(--accent);
		margin: 1.25rem 0;
		padding: 1rem 1.25rem;
		background: linear-gradient(90deg, rgba(6, 182, 212, 0.08) 0%, var(--card-bg) 100%);
		color: var(--text);
		border-radius: 0 4px 4px 0;
		font-weight: 500;
	}

	.markdown-content :global(blockquote p) {
		margin-bottom: 0;
	}

	.markdown-content :global(blockquote strong) {
		color: var(--accent);
	}

	.markdown-content :global(hr) {
		border: none;
		height: 2px;
		background: linear-gradient(to right, transparent, var(--accent), transparent);
		margin: 2rem 0;
	}

	.markdown-content :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1.25rem 0;
		font-size: 0.8125rem;
		border-radius: 4px;
		overflow: hidden;
	}

	.markdown-content :global(thead) {
		background: linear-gradient(180deg, var(--surface) 0%, var(--card-bg) 100%);
	}

	.markdown-content :global(th) {
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--border);
		text-align: left;
		font-weight: 700;
		color: var(--accent);
		text-transform: uppercase;
		font-size: 0.6875rem;
		letter-spacing: 0.05em;
	}

	.markdown-content :global(td) {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}

	.markdown-content :global(tbody tr:nth-child(odd)) {
		background: rgba(255, 255, 255, 0.02);
	}

	.markdown-content :global(tbody tr:nth-child(even)) {
		background: var(--card-bg);
	}

	.markdown-content :global(tbody tr:hover) {
		background: rgba(6, 182, 212, 0.05);
	}

	/* Footer */
	.modal-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--surface);
		border-top: 1px solid var(--border);
	}

	.footer-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.625rem;
		font-family: 'SF Mono', Monaco, monospace;
		color: var(--text-muted);
		letter-spacing: 0.1em;
	}

	.footer-label {
		color: var(--accent);
		font-weight: 700;
	}

	.footer-divider {
		color: var(--border);
	}

	.close-text-btn {
		padding: 0.4rem 1rem;
		background: transparent;
		border: 1px solid var(--accent);
		border-radius: 2px;
		color: var(--accent);
		cursor: pointer;
		font-family: 'SF Mono', Monaco, monospace;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		transition: all 0.15s ease;
	}

	.close-text-btn:hover {
		background: var(--accent);
		color: var(--bg);
	}

	/* Scrollbar */
	.modal-content::-webkit-scrollbar {
		width: 6px;
	}

	.modal-content::-webkit-scrollbar-track {
		background: var(--surface);
	}

	.modal-content::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 3px;
	}

	.modal-content::-webkit-scrollbar-thumb:hover {
		background: var(--border-strong);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.modal-container {
			max-height: 95vh;
		}

		.header-time {
			display: none;
		}

		.btn-label {
			display: none;
		}
	}
</style>
