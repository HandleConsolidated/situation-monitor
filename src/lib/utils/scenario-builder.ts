/**
 * Scenario Builder
 * Create and analyze "what if" scenarios with predicted impacts
 */

import type {
	Scenario,
	ScenarioTrigger,
	ScenarioPrediction,
	HistoricalComparison
} from '$lib/types/intelligence';

// Pre-defined scenario templates
export const SCENARIO_TEMPLATES: Partial<Scenario>[] = [
	{
		name: 'China Invades Taiwan',
		category: 'military',
		description: 'Full-scale military invasion of Taiwan by the PRC',
		triggers: [
			{
				type: 'threshold',
				description: 'Chinese naval vessels in Taiwan Strait',
				condition: 'military_ships.country=CN AND location=Taiwan_Strait > 10',
				met: false
			},
			{
				type: 'event',
				description: 'Major amphibious deployment detected',
				condition: 'ship_type=amphibious > 5',
				met: false
			}
		],
		predictions: [
			{
				domain: 'markets',
				impact: 'extreme',
				description: 'Global stock market crash, semiconductor supply crisis',
				probability: 0.95,
				timeframe: 'immediate',
				indicators: ['TSMC halts production', 'Chip shortage worsens', 'Tech stocks plummet'],
				metrics: {
					sp500: { current: 5000, predicted: 3500, unit: 'points' },
					oil: { current: 75, predicted: 150, unit: 'USD/barrel' },
					semiconductors: { current: 100, predicted: 20, unit: '% of supply' }
				}
			},
			{
				domain: 'military',
				impact: 'extreme',
				description: 'US military intervention likely, risk of great power war',
				probability: 0.85,
				timeframe: 'within 48 hours',
				indicators: ['Carrier groups deploy', 'DEFCON level raised', 'Allies mobilize']
			},
			{
				domain: 'supply_chain',
				impact: 'extreme',
				description: 'Critical disruption to global tech supply chain',
				probability: 0.99,
				timeframe: 'immediate',
				indicators: ['TSMC offline', 'Shipping halted', 'Apple/NVIDIA/AMD production stops']
			},
			{
				domain: 'diplomatic',
				impact: 'high',
				description: 'International sanctions on China, trade war escalation',
				probability: 0.90,
				timeframe: 'within 72 hours',
				indicators: ['UN Security Council meeting', 'Sanctions announced', 'Diplomatic expulsions']
			}
		],
		historicalComparisons: [
			{
				event: 'Russia invades Ukraine (2022)',
				date: '2022-02-24',
				similarity: 0.75,
				outcome: 'International isolation of Russia, economic sanctions, military aid to Ukraine',
				lessons: [
					'Swift international response likely',
					'Economic warfare precedes military engagement',
					'Supply chain disruptions amplify impact'
				]
			}
		]
	},
	{
		name: 'Major Earthquake in California',
		category: 'natural_disaster',
		description: 'Magnitude 8.0+ earthquake on San Andreas Fault',
		triggers: [
			{
				type: 'threshold',
				description: 'Seismic activity increase',
				condition: 'earthquakes.location=California AND magnitude > 8.0',
				met: false
			}
		],
		predictions: [
			{
				domain: 'humanitarian',
				impact: 'extreme',
				description: 'Massive casualties, infrastructure collapse',
				probability: 0.90,
				timeframe: 'immediate',
				indicators: ['Building collapses', 'Fires spread', 'Rescue operations begin']
			},
			{
				domain: 'markets',
				impact: 'high',
				description: 'Tech sector disruption (Silicon Valley), insurance industry crisis',
				probability: 0.85,
				timeframe: 'within 24 hours',
				indicators: ['Tech stocks drop', 'Insurance stocks crash', 'Gold rises'],
				metrics: {
					nasdaq: { current: 16000, predicted: 13000, unit: 'points' },
					insurance_sector: { current: 100, predicted: 60, unit: 'index' }
				}
			},
			{
				domain: 'supply_chain',
				impact: 'high',
				description: 'Port of Los Angeles/Long Beach disrupted, West Coast shipping halted',
				probability: 0.80,
				timeframe: 'immediate',
				indicators: ['Ports closed', 'Rail lines damaged', 'Truck routes blocked']
			}
		],
		historicalComparisons: [
			{
				event: '1906 San Francisco Earthquake',
				date: '1906-04-18',
				similarity: 0.85,
				outcome: 'City destroyed, 3,000+ dead, rebuilt over decades',
				lessons: ['Modern building codes reduce casualties', 'Fire often worse than shaking']
			},
			{
				event: '2011 Japan Earthquake & Tsunami',
				date: '2011-03-11',
				similarity: 0.70,
				outcome: 'Fukushima nuclear disaster, 15,000+ dead, global supply chain impact',
				lessons: ['Secondary disasters amplify damage', 'Global economic ripple effects']
			}
		]
	},
	{
		name: 'Iran-Israel Conflict Escalation',
		category: 'military',
		description: 'Direct military confrontation between Iran and Israel',
		predictions: [
			{
				domain: 'markets',
				impact: 'extreme',
				description: 'Oil price spike, Middle East instability premium',
				probability: 0.95,
				timeframe: 'immediate',
				indicators: ['Strait of Hormuz threatened', 'Oil production at risk'],
				metrics: {
					oil: { current: 75, predicted: 180, unit: 'USD/barrel' },
					gold: { current: 2000, predicted: 2800, unit: 'USD/oz' }
				}
			},
			{
				domain: 'military',
				impact: 'extreme',
				description: 'Regional war, US involvement likely',
				probability: 0.80,
				timeframe: 'within 48 hours',
				indicators: ['US carriers deploy', 'Missile strikes', 'Proxy forces activate']
			}
		]
	},
	{
		name: 'Global Pandemic (H5N1 Bird Flu)',
		category: 'pandemic',
		description: 'H5N1 mutates to human-to-human transmission',
		predictions: [
			{
				domain: 'humanitarian',
				impact: 'extreme',
				description: 'High mortality rate, healthcare system collapse',
				probability: 0.75,
				timeframe: 'within weeks',
				indicators: ['Human cases surge', 'Hospital capacity exceeded', 'Travel bans']
			},
			{
				domain: 'markets',
				impact: 'extreme',
				description: 'Economic shutdown, supply chain paralysis',
				probability: 0.90,
				timeframe: 'within 2 weeks',
				indicators: ['Lockdowns implemented', 'Markets crash', 'Airlines grounded']
			}
		],
		historicalComparisons: [
			{
				event: 'COVID-19 Pandemic (2020)',
				date: '2020-03-11',
				similarity: 0.80,
				outcome: 'Global lockdowns, 7M+ deaths, economic crisis',
				lessons: ['Early action critical', 'Supply chain fragility exposed', 'Remote work accelerates']
			}
		]
	},
	{
		name: 'Massive Cyberattack on US Grid',
		category: 'cyber',
		description: 'State-sponsored attack on US power infrastructure',
		predictions: [
			{
				domain: 'humanitarian',
				impact: 'extreme',
				description: 'Power outages affecting millions, critical infrastructure failure',
				probability: 0.70,
				timeframe: 'immediate',
				indicators: ['Blackouts spread', 'Water systems fail', 'Communications down']
			},
			{
				domain: 'markets',
				impact: 'high',
				description: 'Trading halted, economic paralysis in affected regions',
				probability: 0.85,
				timeframe: 'within hours',
				indicators: ['Stock exchanges close', 'Banks offline', 'Payment systems fail']
			},
			{
				domain: 'military',
				impact: 'high',
				description: 'Attribution and retaliation, potential military response',
				probability: 0.60,
				timeframe: 'within 72 hours',
				indicators: ['Investigation launched', 'Cyber command activated', 'Countermeasures prepared']
			}
		]
	}
];

/**
 * Create a new scenario from template
 */
export function createScenario(template: Partial<Scenario>): Scenario {
	return {
		id: `scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		name: template.name || 'Untitled Scenario',
		description: template.description || '',
		category: template.category || 'political',
		triggers: template.triggers || [],
		predictions: template.predictions || [],
		historicalComparisons: template.historicalComparisons || [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		status: 'draft'
	};
}

/**
 * Check if scenario triggers are met
 */
export function evaluateScenarioTriggers(
	scenario: Scenario,
	currentData: {
		militaryShips?: any[];
		earthquakes?: any[];
		news?: any[];
		[key: string]: any;
	}
): Scenario {
	const updatedTriggers = scenario.triggers.map(trigger => {
		// Simple evaluation (in real implementation, would parse condition properly)
		let met = false;

		if (trigger.type === 'threshold') {
			// Check military ship thresholds
			if (trigger.condition.includes('military_ships') && currentData.militaryShips) {
				const count = currentData.militaryShips.length;
				met = count > 10; // Simplified logic
			}

			// Check earthquake thresholds
			if (trigger.condition.includes('earthquakes') && currentData.earthquakes) {
				const hasLarge = currentData.earthquakes.some((eq: any) => eq.magnitude > 8.0);
				met = hasLarge;
			}
		}

		return {
			...trigger,
			met,
			metAt: met ? new Date().toISOString() : undefined
		};
	});

	return {
		...scenario,
		triggers: updatedTriggers,
		updatedAt: new Date().toISOString()
	};
}

/**
 * Calculate scenario probability based on triggers
 */
export function calculateScenarioProbability(scenario: Scenario): number {
	if (scenario.triggers.length === 0) return 0;

	const metCount = scenario.triggers.filter(t => t.met).length;
	return metCount / scenario.triggers.length;
}

/**
 * Get impact summary for scenario
 */
export function getImpactSummary(scenario: Scenario): {
	overall: 'extreme' | 'high' | 'medium' | 'low';
	byDomain: Record<string, { impact: string; probability: number }>;
} {
	const impacts = scenario.predictions.map(p => p.impact);
	const hasExtreme = impacts.includes('extreme');
	const hasHigh = impacts.includes('high');

	const overall = hasExtreme ? 'extreme' : hasHigh ? 'high' : 'medium';

	const byDomain = scenario.predictions.reduce(
		(acc, pred) => {
			acc[pred.domain] = {
				impact: pred.impact,
				probability: pred.probability
			};
			return acc;
		},
		{} as Record<string, { impact: string; probability: number }>
	);

	return { overall, byDomain };
}

/**
 * Get most similar historical event
 */
export function getMostSimilarHistoricalEvent(
	scenario: Scenario
): HistoricalComparison | null {
	if (scenario.historicalComparisons.length === 0) return null;

	return scenario.historicalComparisons.reduce((best, current) =>
		current.similarity > best.similarity ? current : best
	);
}

/**
 * Export scenario as markdown report
 */
export function exportScenarioAsMarkdown(scenario: Scenario): string {
	let md = `# Scenario: ${scenario.name}\n\n`;
	md += `**Category:** ${scenario.category}\n\n`;
	md += `${scenario.description}\n\n`;

	md += `## Triggers\n\n`;
	scenario.triggers.forEach(trigger => {
		const status = trigger.met ? '✅ MET' : '⏳ Pending';
		md += `- **${status}** ${trigger.description}\n`;
		if (trigger.met && trigger.metAt) {
			md += `  - Met at: ${new Date(trigger.metAt).toLocaleString()}\n`;
		}
	});

	md += `\n## Predicted Impacts\n\n`;
	scenario.predictions.forEach(pred => {
		const emoji = pred.impact === 'extreme' ? '🚨' : pred.impact === 'high' ? '⚠️' : '👁️';
		md += `### ${emoji} ${pred.domain.toUpperCase()} - ${pred.impact.toUpperCase()}\n\n`;
		md += `**Probability:** ${Math.round(pred.probability * 100)}%\n\n`;
		md += `**Timeframe:** ${pred.timeframe}\n\n`;
		md += `${pred.description}\n\n`;

		if (pred.indicators.length > 0) {
			md += `**Indicators to watch:**\n`;
			pred.indicators.forEach(ind => md += `- ${ind}\n`);
			md += '\n';
		}

		if (pred.metrics) {
			md += `**Predicted Metrics:**\n`;
			Object.entries(pred.metrics).forEach(([key, data]) => {
				md += `- ${key}: ${data.current} → ${data.predicted} ${data.unit}\n`;
			});
			md += '\n';
		}
	});

	if (scenario.historicalComparisons.length > 0) {
		md += `## Historical Comparisons\n\n`;
		scenario.historicalComparisons.forEach(comp => {
			md += `### ${comp.event} (${new Date(comp.date).toLocaleDateString()})\n\n`;
			md += `**Similarity:** ${Math.round(comp.similarity * 100)}%\n\n`;
			md += `**Outcome:** ${comp.outcome}\n\n`;
			md += `**Lessons:**\n`;
			comp.lessons.forEach(lesson => md += `- ${lesson}\n`);
			md += '\n';
		});
	}

	md += `\n---\n`;
	md += `*Generated: ${new Date().toLocaleString()}*\n`;

	return md;
}
