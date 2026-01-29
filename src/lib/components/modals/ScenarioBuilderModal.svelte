<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { Scenario } from '$lib/types/intelligence';
	import {
		SCENARIO_TEMPLATES,
		createScenario,
		getImpactSummary,
		getMostSimilarHistoricalEvent,
		exportScenarioAsMarkdown,
		calculateScenarioProbability
	} from '$lib/utils/scenario-builder';

	export let open = false;
	export let selectedScenario: Scenario | null = null;

	const dispatch = createEventDispatcher();

	let activeTab: 'browse' | 'details' | 'impacts' | 'history' = 'browse';
	let scenarios: Scenario[] = loadScenarios();

	function loadScenarios(): Scenario[] {
		const stored = localStorage.getItem('scenarios');
		return stored ? JSON.parse(stored) : SCENARIO_TEMPLATES.map(createScenario);
	}

	function saveScenarios() {
		localStorage.setItem('scenarios', JSON.stringify(scenarios));
	}

	function selectScenario(scenario: Scenario) {
		selectedScenario = scenario;
		activeTab = 'details';
	}

	function activateScenario(scenario: Scenario) {
		scenario.status = 'active';
		saveScenarios();
		scenarios = scenarios; // Trigger reactivity
	}

	function archiveScenario(scenario: Scenario) {
		scenario.status = 'archived';
		saveScenarios();
		scenarios = scenarios;
	}

	function exportScenario(scenario: Scenario) {
		const markdown = exportScenarioAsMarkdown(scenario);
		const blob = new Blob([markdown], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${scenario.name.replace(/\s+/g, '-')}.md`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function close() {
		open = false;
		selectedScenario = null;
		activeTab = 'browse';
	}

	$: impactSummary = selectedScenario ? getImpactSummary(selectedScenario) : null;
	$: similarEvent = selectedScenario ? getMostSimilarHistoricalEvent(selectedScenario) : null;
	$: probability = selectedScenario ? calculateScenarioProbability(selectedScenario) : 0;

	const categoryEmojis: Record<Scenario['category'], string> = {
		military: '⚔️',
		economic: '💰',
		natural_disaster: '🌋',
		cyber: '💻',
		political: '🗳️',
		pandemic: '🦠'
	};

	const impactEmojis: Record<string, string> = {
		extreme: '🚨',
		high: '⚠️',
		medium: '👁️',
		low: '✅'
	};
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
		on:click={close}
		transition:fade={{ duration: 150 }}
	>
		<div
			class="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
			on:click|stopPropagation
		>
			<!-- Header -->
			<div class="p-6 border-b border-slate-700 flex items-center justify-between">
				<div>
					<h2 class="text-2xl font-bold text-white">Scenario Builder</h2>
					<p class="text-slate-400 text-sm mt-1">"What If" Analysis & Impact Prediction</p>
				</div>
				<button
					on:click={close}
					class="text-slate-400 hover:text-white transition-colors"
				>
					<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Tabs -->
			<div class="px-6 pt-4 border-b border-slate-700">
				<div class="flex gap-4">
					<button
						class="pb-2 px-1 border-b-2 transition-colors {activeTab === 'browse'
							? 'border-blue-500 text-white'
							: 'border-transparent text-slate-400 hover:text-white'}"
						on:click={() => (activeTab = 'browse')}
					>
						Browse Scenarios
					</button>
					{#if selectedScenario}
						<button
							class="pb-2 px-1 border-b-2 transition-colors {activeTab === 'details'
								? 'border-blue-500 text-white'
								: 'border-transparent text-slate-400 hover:text-white'}"
							on:click={() => (activeTab = 'details')}
						>
							Details
						</button>
						<button
							class="pb-2 px-1 border-b-2 transition-colors {activeTab === 'impacts'
								? 'border-blue-500 text-white'
								: 'border-transparent text-slate-400 hover:text-white'}"
							on:click={() => (activeTab = 'impacts')}
						>
							Predicted Impacts
						</button>
						<button
							class="pb-2 px-1 border-b-2 transition-colors {activeTab === 'history'
								? 'border-blue-500 text-white'
								: 'border-transparent text-slate-400 hover:text-white'}"
							on:click={() => (activeTab = 'history')}
						>
							Historical Context
						</button>
					{/if}
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if activeTab === 'browse'}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each scenarios as scenario}
							<button
								class="p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-left transition-all"
								on:click={() => selectScenario(scenario)}
							>
								<div class="flex items-start justify-between mb-2">
									<div class="flex items-center gap-2">
										<span class="text-2xl">{categoryEmojis[scenario.category]}</span>
										<h3 class="font-semibold text-white">{scenario.name}</h3>
									</div>
									<span
										class="px-2 py-1 rounded text-xs font-medium {scenario.status === 'active'
											? 'bg-green-500/20 text-green-400'
											: scenario.status === 'draft'
												? 'bg-blue-500/20 text-blue-400'
												: 'bg-slate-600/20 text-slate-400'}"
									>
										{scenario.status}
									</span>
								</div>
								<p class="text-sm text-slate-300 mb-3">{scenario.description}</p>
								<div class="flex items-center gap-2 text-xs text-slate-400">
									<span>{scenario.triggers.length} triggers</span>
									<span>•</span>
									<span>{scenario.predictions.length} predictions</span>
								</div>
							</button>
						{/each}
					</div>
				{:else if activeTab === 'details' && selectedScenario}
					<div class="space-y-6">
						<div>
							<div class="flex items-center justify-between mb-4">
								<h3 class="text-xl font-bold text-white flex items-center gap-2">
									<span class="text-3xl">{categoryEmojis[selectedScenario.category]}</span>
									{selectedScenario.name}
								</h3>
								<div class="flex gap-2">
									{#if selectedScenario.status === 'draft'}
										<button
											on:click={() => activateScenario(selectedScenario)}
											class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
										>
											Activate
										</button>
									{:else if selectedScenario.status === 'active'}
										<button
											on:click={() => archiveScenario(selectedScenario)}
											class="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white rounded text-sm"
										>
											Archive
										</button>
									{/if}
									<button
										on:click={() => exportScenario(selectedScenario)}
										class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
									>
										Export
									</button>
								</div>
							</div>
							<p class="text-slate-300">{selectedScenario.description}</p>
						</div>

						<!-- Probability -->
						{#if selectedScenario.triggers.length > 0}
							<div class="p-4 bg-slate-800 border border-slate-700 rounded-lg">
								<div class="flex items-center justify-between mb-2">
									<span class="text-sm font-medium text-slate-400">Scenario Probability</span>
									<span class="text-2xl font-bold text-white">{Math.round(probability * 100)}%</span>
								</div>
								<div class="w-full bg-slate-700 rounded-full h-2">
									<div
										class="bg-gradient-to-r from-yellow-500 to-red-500 h-2 rounded-full transition-all"
										style="width: {probability * 100}%"
									></div>
								</div>
								<p class="text-xs text-slate-500 mt-2">
									Based on {selectedScenario.triggers.filter(t => t.met).length} of {selectedScenario.triggers.length} triggers met
								</p>
							</div>
						{/if}

						<!-- Triggers -->
						<div>
							<h4 class="text-lg font-semibold text-white mb-3">Triggers</h4>
							<div class="space-y-2">
								{#each selectedScenario.triggers as trigger}
									<div class="p-3 bg-slate-800 border border-slate-700 rounded-lg">
										<div class="flex items-start justify-between">
											<div class="flex-1">
												<div class="flex items-center gap-2 mb-1">
													<span class="text-lg">{trigger.met ? '✅' : '⏳'}</span>
													<span class="font-medium text-white">{trigger.description}</span>
												</div>
												<code class="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">
													{trigger.condition}
												</code>
											</div>
										</div>
										{#if trigger.met && trigger.metAt}
											<div class="mt-2 text-xs text-green-400">
												Met on {new Date(trigger.metAt).toLocaleString()}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					</div>
				{:else if activeTab === 'impacts' && selectedScenario}
					<div class="space-y-4">
						{#each selectedScenario.predictions as prediction}
							<div class="p-4 bg-slate-800 border border-slate-700 rounded-lg">
								<div class="flex items-start justify-between mb-3">
									<div>
										<h4 class="text-lg font-semibold text-white flex items-center gap-2">
											{impactEmojis[prediction.impact]}
											{prediction.domain.toUpperCase()}
										</h4>
										<span
											class="text-xs font-medium px-2 py-1 rounded {prediction.impact === 'extreme'
												? 'bg-red-500/20 text-red-400'
												: prediction.impact === 'high'
													? 'bg-orange-500/20 text-orange-400'
													: prediction.impact === 'medium'
														? 'bg-yellow-500/20 text-yellow-400'
														: 'bg-green-500/20 text-green-400'}"
										>
											{prediction.impact} impact
										</span>
									</div>
									<div class="text-right">
										<div class="text-sm text-slate-400">Probability</div>
										<div class="text-xl font-bold text-white">
											{Math.round(prediction.probability * 100)}%
										</div>
									</div>
								</div>

								<p class="text-slate-300 mb-3">{prediction.description}</p>

								<div class="text-sm text-slate-400 mb-3">
									<strong>Timeframe:</strong> {prediction.timeframe}
								</div>

								{#if prediction.indicators.length > 0}
									<div class="mb-3">
										<div class="text-sm font-medium text-slate-400 mb-2">Indicators to watch:</div>
										<ul class="list-disc list-inside space-y-1 text-sm text-slate-300">
											{#each prediction.indicators as indicator}
												<li>{indicator}</li>
											{/each}
										</ul>
									</div>
								{/if}

								{#if prediction.metrics}
									<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-700">
										{#each Object.entries(prediction.metrics) as [key, data]}
											<div class="text-center">
												<div class="text-xs text-slate-500 uppercase mb-1">{key}</div>
												<div class="text-sm">
													<span class="text-slate-400">{data.current}</span>
													<span class="text-red-400 mx-1">→</span>
													<span class="text-white font-semibold">{data.predicted}</span>
												</div>
												<div class="text-xs text-slate-500">{data.unit}</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else if activeTab === 'history' && selectedScenario}
					<div class="space-y-4">
						{#if selectedScenario.historicalComparisons.length === 0}
							<div class="text-center text-slate-400 py-8">
								No historical comparisons available for this scenario.
							</div>
						{:else}
							{#each selectedScenario.historicalComparisons as comparison}
								<div class="p-4 bg-slate-800 border border-slate-700 rounded-lg">
									<div class="flex items-start justify-between mb-3">
										<h4 class="text-lg font-semibold text-white">{comparison.event}</h4>
										<div class="text-right">
											<div class="text-xs text-slate-400">Similarity</div>
											<div class="text-xl font-bold text-blue-400">
												{Math.round(comparison.similarity * 100)}%
											</div>
										</div>
									</div>

									<div class="text-sm text-slate-400 mb-3">
										{new Date(comparison.date).toLocaleDateString('en-US', {
											year: 'numeric',
											month: 'long',
											day: 'numeric'
										})}
									</div>

									<div class="mb-3">
										<div class="text-sm font-medium text-slate-400 mb-1">Outcome:</div>
										<p class="text-slate-300">{comparison.outcome}</p>
									</div>

									<div>
										<div class="text-sm font-medium text-slate-400 mb-2">Lessons learned:</div>
										<ul class="list-disc list-inside space-y-1 text-sm text-slate-300">
											{#each comparison.lessons as lesson}
												<li>{lesson}</li>
											{/each}
										</ul>
									</div>

									{#if comparison.references && comparison.references.length > 0}
										<div class="mt-3 pt-3 border-t border-slate-700">
											<div class="text-xs text-slate-500 mb-1">References:</div>
											{#each comparison.references as ref}
												<a
													href={ref}
													target="_blank"
													rel="noopener noreferrer"
													class="text-xs text-blue-400 hover:text-blue-300 block"
												>
													{ref}
												</a>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="p-4 border-t border-slate-700 flex justify-end gap-2">
				<button
					on:click={close}
					class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
