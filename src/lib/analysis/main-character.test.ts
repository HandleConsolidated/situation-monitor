/**
 * Tests for main character analysis
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	calculateMainCharacter,
	getMainCharacterSummary,
	calculateDominance,
	clearPatternCache,
	clearMentionHistory
} from './main-character';
import type { NewsItem } from '$lib/types';

describe('Main Character Analysis', () => {
	beforeEach(() => {
		// Clear caches before each test for isolation
		clearPatternCache();
		clearMentionHistory();
	});

	it('should return empty results for empty news', () => {
		const results = calculateMainCharacter([]);
		expect(results.characters).toEqual([]);
		expect(results.topCharacter).toBeNull();
	});

	it('should count mentions correctly', () => {
		const news: NewsItem[] = [
			{
				id: '1',
				title: 'Trump announces policy',
				source: 'BBC',
				link: 'a',
				timestamp: Date.now(),
				category: 'politics'
			},
			{
				id: '2',
				title: 'Trump speaks at rally',
				source: 'CNN',
				link: 'b',
				timestamp: Date.now(),
				category: 'politics'
			},
			{
				id: '3',
				title: 'Biden meets with leaders',
				source: 'NYT',
				link: 'c',
				timestamp: Date.now(),
				category: 'politics'
			}
		];

		const results = calculateMainCharacter(news);

		expect(results.characters.length).toBeGreaterThan(0);
		// Pattern now uses full name "Donald Trump" but detects "trump" keyword
		expect(results.topCharacter?.name).toBe('Donald Trump');
		expect(results.topCharacter?.count).toBe(2);
	});

	it('should rank characters by mention count', () => {
		const news: NewsItem[] = [
			{
				id: '1',
				title: 'Musk buys company',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'tech'
			},
			{
				id: '2',
				title: 'Musk announces feature',
				source: 'B',
				link: 'b',
				timestamp: Date.now(),
				category: 'tech'
			},
			{
				id: '3',
				title: 'Trump rally today',
				source: 'D',
				link: 'd',
				timestamp: Date.now(),
				category: 'politics'
			}
		];

		const results = calculateMainCharacter(news);

		expect(results.characters[0].name).toBe('Elon Musk');
		expect(results.characters[0].count).toBe(2);
		expect(results.characters[0].rank).toBe(1);
	});

	it('should limit results to top 15', () => {
		// Create news mentioning many different people (more than 15)
		const names = [
			'Trump',
			'Biden',
			'Musk',
			'Putin',
			'Zelensky',
			'Xi Jinping',
			'Netanyahu',
			'Sam Altman',
			'Zuckerberg',
			'Bezos',
			'Tim Cook',
			'Powell',
			'Lagarde',
			'Macron',
			'Scholz',
			'Starmer',
			'Modi',
			'Meloni'
		];

		const news: NewsItem[] = names.map((name, i) => ({
			id: String(i),
			title: `${name} in the news`,
			source: 'Source',
			link: `link${i}`,
			timestamp: Date.now(),
			category: 'politics' as const
		}));

		const results = calculateMainCharacter(news);

		// Current implementation limits to 15 characters
		expect(results.characters.length).toBeLessThanOrEqual(15);
	});

	it('should match multiple patterns for same person', () => {
		const news: NewsItem[] = [
			{
				id: '1',
				title: 'Elon Musk announces',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'tech'
			},
			{
				id: '2',
				title: 'Musk speaks out',
				source: 'B',
				link: 'b',
				timestamp: Date.now(),
				category: 'tech'
			}
		];

		const results = calculateMainCharacter(news);

		// Both headlines match the pattern for Elon Musk
		expect(results.topCharacter?.name).toBe('Elon Musk');
		expect(results.topCharacter?.count).toBe(2);
	});

	it('should return correct summary', () => {
		const emptyResults = calculateMainCharacter([]);
		const emptySummary = getMainCharacterSummary(emptyResults);
		expect(emptySummary.name).toBe('');
		expect(emptySummary.count).toBe(0);
		expect(emptySummary.status).toBe('NO DATA');
		expect(emptySummary.sentiment).toBe('neutral');
		expect(emptySummary.momentum).toBe('stable');

		const news: NewsItem[] = [
			{
				id: '1',
				title: 'Putin addresses nation',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'politics'
			},
			{
				id: '2',
				title: 'Putin speaks on economy',
				source: 'B',
				link: 'b',
				timestamp: Date.now(),
				category: 'politics'
			}
		];

		const results = calculateMainCharacter(news);
		const summary = getMainCharacterSummary(results);

		expect(summary.name).toBe('Vladimir Putin');
		expect(summary.count).toBe(2);
		expect(summary.status).toContain('Vladimir Putin');
		expect(summary.status).toContain('2');
	});

	it('should calculate dominance correctly', () => {
		// Single character = 100% dominance
		const singleNews: NewsItem[] = [
			{
				id: '1',
				title: 'Trump news',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'politics'
			}
		];
		expect(calculateDominance(calculateMainCharacter(singleNews))).toBe(100);

		// Empty returns 100 (no competition = full dominance, edge case)
		expect(calculateDominance(calculateMainCharacter([]))).toBe(100);

		// Two characters with same count = 0% dominance
		const evenNews: NewsItem[] = [
			{
				id: '1',
				title: 'Trump speaks',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'politics'
			},
			{
				id: '2',
				title: 'Biden responds',
				source: 'B',
				link: 'b',
				timestamp: Date.now(),
				category: 'politics'
			}
		];
		expect(calculateDominance(calculateMainCharacter(evenNews))).toBe(0);

		// Clear leader = high dominance (capped at 100)
		const dominantNews: NewsItem[] = [
			{
				id: '1',
				title: 'Musk announcement',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'tech'
			},
			{
				id: '2',
				title: 'Elon tweets',
				source: 'B',
				link: 'b',
				timestamp: Date.now(),
				category: 'tech'
			},
			{
				id: '3',
				title: 'Musk company news',
				source: 'C',
				link: 'c',
				timestamp: Date.now(),
				category: 'tech'
			},
			{
				id: '4',
				title: 'Trump rally',
				source: 'D',
				link: 'd',
				timestamp: Date.now(),
				category: 'politics'
			}
		];
		const dominance = calculateDominance(calculateMainCharacter(dominantNews));
		expect(dominance).toBe(100); // Dominance is capped at 100
	});

	it('should handle case insensitivity', () => {
		const news: NewsItem[] = [
			{
				id: '1',
				title: 'TRUMP announces policy',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'politics'
			},
			{
				id: '2',
				title: 'trump speaks today',
				source: 'B',
				link: 'b',
				timestamp: Date.now(),
				category: 'politics'
			}
		];

		const results = calculateMainCharacter(news);
		expect(results.topCharacter?.name).toBe('Donald Trump');
		expect(results.topCharacter?.count).toBe(2);
	});

	it('should detect world leaders from WORLD_LEADERS config', () => {
		const news: NewsItem[] = [
			{
				id: '1',
				title: 'Milei announces reforms in Argentina',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'politics'
			},
			{
				id: '2',
				title: 'Lula meets with BRICS leaders',
				source: 'B',
				link: 'b',
				timestamp: Date.now(),
				category: 'politics'
			},
			{
				id: '3',
				title: 'Ishiba speaks on Japan defense policy',
				source: 'C',
				link: 'c',
				timestamp: Date.now(),
				category: 'politics'
			}
		];

		const results = calculateMainCharacter(news);

		// Should detect world leaders from the WORLD_LEADERS config
		const names = results.characters.map((c) => c.name);
		expect(names).toContain('Javier Milei');
		expect(names).toContain('Luiz Inacio Lula da Silva');
		expect(names).toContain('Shigeru Ishiba');
	});

	it('should detect central bankers and international leaders', () => {
		const news: NewsItem[] = [
			{
				id: '1',
				title: 'Lagarde announces ECB rate decision',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'finance'
			},
			{
				id: '2',
				title: 'IMF chief Georgieva warns of recession',
				source: 'B',
				link: 'b',
				timestamp: Date.now(),
				category: 'finance'
			},
			{
				id: '3',
				title: 'NATO Secretary General Rutte addresses alliance',
				source: 'C',
				link: 'c',
				timestamp: Date.now(),
				category: 'politics'
			}
		];

		const results = calculateMainCharacter(news);
		const names = results.characters.map((c) => c.name);

		expect(names).toContain('Christine Lagarde');
		expect(names).toContain('Kristalina Georgieva');
		expect(names).toContain('Mark Rutte');

		// Check roles are correctly assigned
		const lagarde = results.characters.find((c) => c.name === 'Christine Lagarde');
		expect(lagarde?.role).toBe('central_bank');

		const georgieva = results.characters.find((c) => c.name === 'Kristalina Georgieva');
		expect(georgieva?.role).toBe('international');

		const rutte = results.characters.find((c) => c.name === 'Mark Rutte');
		expect(rutte?.role).toBe('international');
	});

	it('should include new roles in roleBreakdown', () => {
		const news: NewsItem[] = [
			{
				id: '1',
				title: 'Lagarde speaks at ECB conference',
				source: 'A',
				link: 'a',
				timestamp: Date.now(),
				category: 'finance'
			},
			{
				id: '2',
				title: 'UN Secretary General Guterres addresses climate',
				source: 'B',
				link: 'b',
				timestamp: Date.now(),
				category: 'politics'
			}
		];

		const results = calculateMainCharacter(news);

		// New roles should be present in roleBreakdown
		expect(results.roleBreakdown).toHaveProperty('central_bank');
		expect(results.roleBreakdown).toHaveProperty('international');
		expect(results.roleBreakdown.central_bank).toBeGreaterThanOrEqual(0);
		expect(results.roleBreakdown.international).toBeGreaterThanOrEqual(0);
	});
});
