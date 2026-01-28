<script lang="ts">
	import { Panel } from '$lib/components/common';
	import { markets } from '$lib/stores';
	import { onMount } from 'svelte';

	interface StressIndicator {
		name: string;
		value: number;
		threshold: number;
		weight: number;
		description: string;
	}

	let stressIndex = $state(0);
	let indicators = $state<StressIndicator[]>([]);
	let loading = $state(true);
	let lastUpdated = $state<Date | null>(null);

	const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

	function calculateStressIndex() {
		loading = true;

		try {
			// Get market data from store
			const marketData = $markets;

			// Define stress indicators with weights
			const rawIndicators: StressIndicator[] = [
				{
					name: 'VIX (Fear Index)',
					value: marketData.indices.find(i => i.symbol === 'VIX')?.price ?? 15,
					threshold: 20, // VIX > 20 indicates elevated fear
					weight: 0.25,
					description: 'Market volatility and fear gauge'
				},
				{
					name: 'Credit Spreads',
					value: 3.5, // TODO: Get real credit spread data
					threshold: 5, // High-yield spread > 5% indicates stress
					weight: 0.20,
					description: 'Corporate bond risk premium'
				},
				{
					name: '10Y Treasury Yield',
					value: 4.2, // TODO: Get real treasury data
					threshold: 5, // Rapid yield changes indicate stress
					weight: 0.15,
					description: 'Government bond yield movements'
				},
				{
					name: 'Dollar Index',
					value: 105, // TODO: Get real DXY data
					threshold: 110, // Strong dollar can signal flight to safety
					weight: 0.15,
					description: 'US Dollar strength vs basket'
				},
				{
					name: 'Gold/SPY Ratio',
					value: 0.85, // TODO: Calculate from real data
					threshold: 1.0, // Gold outperforming stocks = risk-off
					weight: 0.15,
					description: 'Safe haven vs risk assets'
				},
				{
					name: 'Put/Call Ratio',
					value: 1.1, // TODO: Get real options data
					threshold: 1.2, // High put/call = bearish sentiment
					weight: 0.10,
					description: 'Options market sentiment'
				}
			];

			indicators = rawIndicators;

			// Calculate weighted stress score (0-100)
			let totalStress = 0;
			for (const indicator of indicators) {
				const normalizedStress = Math.min((indicator.value / indicator.threshold) * 100, 100);
				totalStress += normalizedStress * indicator.weight;
			}

			stressIndex = Math.round(totalStress);
			lastUpdated = new Date();
		} catch (error) {
			console.error('Failed to calculate stress index:', error);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		calculateStressIndex();
		const interval = setInterval(calculateStressIndex, REFRESH_INTERVAL);
		return () => clearInterval(interval);
	});

	// Recalculate when markets data changes
	$effect(() => {
		if ($markets) {
			calculateStressIndex();
		}
	});

	const stressLevel = $derived(() => {
		if (stressIndex >= 80) return { label: 'EXTREME', color: '#dc2626' };
		if (stressIndex >= 60) return { label: 'HIGH', color: '#f97316' };
		if (stressIndex >= 40) return { label: 'ELEVATED', color: '#eab308' };
		if (stressIndex >= 20) return { label: 'MODERATE', color: '#10b981' };
		return { label: 'LOW', color: '#06b6d4' };
	});

	function getIndicatorColor(value: number, threshold: number): string {
		const ratio = value / threshold;
		if (ratio >= 1.2) return '#dc2626';
		if (ratio >= 1.0) return '#f97316';
		if (ratio >= 0.8) return '#eab308';
		return '#10b981';
	}
</script>

<Panel 
	id="financial-stress" 
	title="Financial Stress Index" 
	{loading}
>
	<div class="stress-content">
		<!-- Main Stress Gauge -->
		<div class="stress-gauge">
			<div class="gauge-circle" style="--stress-angle: {stressIndex * 1.8}deg; --stress-color: {stressLevel().color}">
				<div class="gauge-inner">
					<div class="stress-value">{stressIndex}</div>
					<div class="stress-label">{stressLevel().label}</div>
				</div>
			</div>
			<div class="gauge-scale">
				<span class="scale-mark low">0</span>
				<span class="scale-mark mid">50</span>
				<span class="scale-mark high">100</span>
			</div>
		</div>

		<!-- Indicators Breakdown -->
		<div class="indicators-list">
			<div class="indicators-header">Component Indicators</div>
			{#each indicators as indicator}
				<div class="indicator-item">
					<div class="indicator-header">
						<span class="indicator-name">{indicator.name}</span>
						<span 
							class="indicator-value"
							style="color: {getIndicatorColor(indicator.value, indicator.threshold)}"
						>
							{indicator.value.toFixed(2)}
						</span>
					</div>
					<div class="indicator-bar-container">
						<div 
							class="indicator-bar"
							style="width: {Math.min((indicator.value / indicator.threshold) * 100, 100)}%; 
								   background: {getIndicatorColor(indicator.value, indicator.threshold)}"
						></div>
						<div 
							class="threshold-line"
							style="left: {(indicator.threshold / (indicator.threshold * 1.5)) * 100}%"
						></div>
					</div>
					<div class="indicator-description">{indicator.description}</div>
				</div>
			{/each}
		</div>

		{#if lastUpdated}
			<div class="footer-info">
				Updated {lastUpdated.toLocaleTimeString()}
			</div>
		{/if}
	</div>
</Panel>

<style>
	.stress-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.stress-gauge {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
	}

	.gauge-circle {
		position: relative;
		width: 180px;
		height: 180px;
		border-radius: 50%;
		background: conic-gradient(
			from 0deg,
			var(--stress-color) 0deg,
			var(--stress-color) var(--stress-angle),
			rgba(255, 255, 255, 0.1) var(--stress-angle),
			rgba(255, 255, 255, 0.1) 360deg
		);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1rem;
	}

	.gauge-inner {
		width: 140px;
		height: 140px;
		border-radius: 50%;
		background: rgba(5, 5, 5, 0.95);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.stress-value {
		font-size: 3rem;
		font-weight: bold;
		font-family: var(--font-mono);
		color: var(--stress-color);
	}

	.stress-label {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.9;
	}

	.gauge-scale {
		display: flex;
		justify-content: space-between;
		width: 180px;
		font-size: 0.75rem;
		opacity: 0.6;
		font-family: var(--font-mono);
	}

	.indicators-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.indicators-header {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		opacity: 0.7;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.indicator-item {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.75rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}

	.indicator-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.indicator-name {
		font-size: 0.8rem;
		font-weight: 500;
	}

	.indicator-value {
		font-size: 0.875rem;
		font-weight: bold;
		font-family: var(--font-mono);
	}

	.indicator-bar-container {
		position: relative;
		height: 6px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 3px;
		overflow: visible;
	}

	.indicator-bar {
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease, background 0.3s ease;
	}

	.threshold-line {
		position: absolute;
		top: -2px;
		height: 10px;
		width: 2px;
		background: rgba(255, 255, 255, 0.5);
	}

	.indicator-description {
		font-size: 0.7rem;
		opacity: 0.6;
	}

	.footer-info {
		padding-top: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		opacity: 0.5;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
</style>
