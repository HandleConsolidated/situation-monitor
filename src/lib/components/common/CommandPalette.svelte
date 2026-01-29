<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import type { Command } from '$lib/types/intelligence';

	export let open = false;
	export let commands: Command[] = [];

	let searchQuery = '';
	let selectedIndex = 0;
	let inputElement: HTMLInputElement;

	$: filteredCommands = filterCommands(commands, searchQuery);
	$: {
		// Reset selection when filtered results change
		if (selectedIndex >= filteredCommands.length) {
			selectedIndex = Math.max(0, filteredCommands.length - 1);
		}
	}

	function filterCommands(cmds: Command[], query: string): Command[] {
		if (!query.trim()) return cmds;

		const lowerQuery = query.toLowerCase();
		return cmds
			.filter((cmd) => {
				return (
					cmd.available &&
					(cmd.label.toLowerCase().includes(lowerQuery) ||
						cmd.description?.toLowerCase().includes(lowerQuery) ||
						cmd.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery)))
				);
			})
			.sort((a, b) => {
				// Prioritize exact label matches
				const aLabelMatch = a.label.toLowerCase().startsWith(lowerQuery);
				const bLabelMatch = b.label.toLowerCase().startsWith(lowerQuery);
				if (aLabelMatch && !bLabelMatch) return -1;
				if (!aLabelMatch && bLabelMatch) return 1;
				return 0;
			});
	}

	function executeCommand(command: Command) {
		command.action();
		close();
		saveRecentCommand(command.id);
	}

	function saveRecentCommand(commandId: string) {
		const recent = JSON.parse(localStorage.getItem('recentCommands') || '[]');
		const existing = recent.find((r: any) => r.commandId === commandId);
		
		if (existing) {
			existing.frequency++;
			existing.timestamp = new Date().toISOString();
		} else {
			recent.push({
				commandId,
				timestamp: new Date().toISOString(),
				frequency: 1
			});
		}

		// Keep only last 20
		const sorted = recent.sort((a: any, b: any) => b.frequency - a.frequency);
		localStorage.setItem('recentCommands', JSON.stringify(sorted.slice(0, 20)));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, 0);
				break;
			case 'Enter':
				e.preventDefault();
				if (filteredCommands[selectedIndex]) {
					executeCommand(filteredCommands[selectedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				close();
				break;
		}
	}

	function close() {
		open = false;
		searchQuery = '';
		selectedIndex = 0;
	}

	onMount(() => {
		const handleGlobalKeydown = (e: KeyboardEvent) => {
			// Cmd+K or Ctrl+K to open
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				open = !open;
				if (open) {
					setTimeout(() => inputElement?.focus(), 10);
				}
			}
		};

		window.addEventListener('keydown', handleGlobalKeydown);
		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleGlobalKeydown);
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	$: if (open && inputElement) {
		inputElement.focus();
	}

	// Group commands by category
	$: groupedCommands = filteredCommands.reduce(
		(acc, cmd) => {
			if (!acc[cmd.category]) acc[cmd.category] = [];
			acc[cmd.category].push(cmd);
			return acc;
		},
		{} as Record<string, Command[]>
	);

	const categoryLabels: Record<string, string> = {
		navigation: '🧭 Navigation',
		action: '⚡ Actions',
		filter: '🔍 Filters',
		view: '👁️ Views',
		data: '📊 Data'
	};
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
		on:click={close}
		transition:fade={{ duration: 150 }}
	/>

	<!-- Command Palette Modal -->
	<div class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] pointer-events-none">
		<div
			class="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-lg shadow-2xl pointer-events-auto"
			transition:fly={{ y: -20, duration: 200 }}
		>
			<!-- Search Input -->
			<div class="p-4 border-b border-slate-700">
				<input
					bind:this={inputElement}
					bind:value={searchQuery}
					type="text"
					placeholder="Type a command or search..."
					class="w-full bg-slate-800 text-white placeholder-slate-400 px-4 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none"
				/>
			</div>

			<!-- Results -->
			<div class="max-h-96 overflow-y-auto">
				{#if filteredCommands.length === 0}
					<div class="p-8 text-center text-slate-400">
						{#if searchQuery}
							No commands found for "{searchQuery}"
						{:else}
							No commands available
						{/if}
					</div>
				{:else}
					{#each Object.entries(groupedCommands) as [category, cmds]}
						<div class="px-2 py-2">
							<div class="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
								{categoryLabels[category] || category}
							</div>
							{#each cmds as command, i}
								{@const globalIndex = filteredCommands.indexOf(command)}
								<button
									class="w-full px-3 py-2 rounded text-left transition-colors flex items-center justify-between group {selectedIndex ===
									globalIndex
										? 'bg-blue-600 text-white'
										: 'hover:bg-slate-800 text-slate-200'}"
									on:click={() => executeCommand(command)}
									on:mouseenter={() => (selectedIndex = globalIndex)}
								>
									<div class="flex items-center gap-3 flex-1">
										{#if command.icon}
											<span class="text-lg">{command.icon}</span>
										{/if}
										<div class="flex-1">
											<div class="font-medium">{command.label}</div>
											{#if command.description}
												<div
													class="text-xs {selectedIndex === globalIndex
														? 'text-blue-200'
														: 'text-slate-400'}"
												>
													{command.description}
												</div>
											{/if}
										</div>
									</div>
									{#if command.shortcut}
										<kbd
											class="px-2 py-1 text-xs font-mono rounded {selectedIndex === globalIndex
												? 'bg-blue-700 text-blue-200'
												: 'bg-slate-700 text-slate-400'}"
										>
											{command.shortcut}
										</kbd>
									{/if}
								</button>
							{/each}
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-4 py-3 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
				<div class="flex gap-4">
					<span><kbd class="kbd">↑↓</kbd> Navigate</span>
					<span><kbd class="kbd">↵</kbd> Select</span>
					<span><kbd class="kbd">Esc</kbd> Close</span>
				</div>
				<div>
					<kbd class="kbd">⌘K</kbd> or <kbd class="kbd">Ctrl+K</kbd> to toggle
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.kbd {
		@apply px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono;
	}
</style>
