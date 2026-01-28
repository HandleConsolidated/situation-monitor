/**
 * Slow Fetcher - Gov Contracts, Layoffs, World Leaders data for Supabase Edge Functions
 *
 * These are "slow" data sources that don't need frequent updates.
 * Ported from src/lib/api/misc.ts and src/lib/api/leaders.ts
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GovContract {
	id: string;
	recipient: string;
	amount: number;
	agency: string;
	description: string;
	date: string;
	state?: string;
	naicsCode?: string;
	contractType?: string;
}

export interface Layoff {
	company: string;
	count: number;
	title: string;
	date: string;
}

export interface LeaderNews {
	source: string;
	title: string;
	link: string;
	pubDate: string;
}

export interface WorldLeader {
	id: string;
	name: string;
	title: string;
	country: string;
	flag: string;
	keywords: string[];
	since: string;
	party?: string;
	focus?: string[];
	news?: LeaderNews[];
}

interface USASpendingAward {
	Award_ID: string;
	Recipient_Name: string;
	Award_Amount: number;
	Awarding_Agency: string;
	Award_Description: string;
	Start_Date: string;
	Recipient_State_Code?: string;
	NAICS_Code?: string;
	Contract_Award_Type?: string;
}

interface USASpendingResponse {
	results: USASpendingAward[];
}

interface GdeltArticle {
	title: string;
	url: string;
	seendate: string;
	domain: string;
}

interface GdeltResponse {
	articles?: GdeltArticle[];
}

// ============================================================================
// WORLD LEADERS CONFIG
// ============================================================================

const WORLD_LEADERS: Omit<WorldLeader, 'news'>[] = [
	{
		id: 'trump',
		name: 'Donald Trump',
		title: 'President',
		country: 'United States',
		flag: 'US',
		keywords: ['trump', 'potus', 'white house'],
		since: 'Jan 2025',
		party: 'Republican',
		focus: ['tariffs', 'immigration', 'deregulation']
	},
	{
		id: 'xi',
		name: 'Xi Jinping',
		title: 'President',
		country: 'China',
		flag: 'CN',
		keywords: ['xi jinping', 'xi', 'chinese president'],
		since: 'Mar 2013',
		party: 'CCP',
		focus: ['taiwan', 'belt and road', 'tech dominance']
	},
	{
		id: 'putin',
		name: 'Vladimir Putin',
		title: 'President',
		country: 'Russia',
		flag: 'RU',
		keywords: ['putin', 'kremlin', 'russian president'],
		since: 'May 2012',
		party: 'United Russia',
		focus: ['ukraine war', 'nato expansion', 'energy']
	},
	{
		id: 'starmer',
		name: 'Keir Starmer',
		title: 'Prime Minister',
		country: 'United Kingdom',
		flag: 'GB',
		keywords: ['starmer', 'uk pm', 'british prime minister'],
		since: 'Jul 2024',
		party: 'Labour'
	},
	{
		id: 'macron',
		name: 'Emmanuel Macron',
		title: 'President',
		country: 'France',
		flag: 'FR',
		keywords: ['macron', 'french president', 'elysee'],
		since: 'May 2017',
		party: 'Renaissance'
	},
	{
		id: 'scholz',
		name: 'Olaf Scholz',
		title: 'Chancellor',
		country: 'Germany',
		flag: 'DE',
		keywords: ['scholz', 'german chancellor', 'berlin'],
		since: 'Dec 2021',
		party: 'SPD'
	},
	{
		id: 'meloni',
		name: 'Giorgia Meloni',
		title: 'Prime Minister',
		country: 'Italy',
		flag: 'IT',
		keywords: ['meloni', 'italian pm', 'italy prime minister'],
		since: 'Oct 2022',
		party: 'Brothers of Italy'
	},
	{
		id: 'netanyahu',
		name: 'Benjamin Netanyahu',
		title: 'Prime Minister',
		country: 'Israel',
		flag: 'IL',
		keywords: ['netanyahu', 'bibi', 'israeli pm'],
		since: 'Dec 2022',
		party: 'Likud',
		focus: ['gaza', 'iran', 'judicial reform']
	},
	{
		id: 'mbs',
		name: 'Mohammed bin Salman',
		title: 'Crown Prince',
		country: 'Saudi Arabia',
		flag: 'SA',
		keywords: ['mbs', 'saudi crown prince', 'bin salman'],
		since: 'Jun 2017',
		party: 'Royal Family',
		focus: ['vision 2030', 'oil', 'regional influence']
	},
	{
		id: 'khamenei',
		name: 'Ali Khamenei',
		title: 'Supreme Leader',
		country: 'Iran',
		flag: 'IR',
		keywords: ['khamenei', 'supreme leader', 'ayatollah'],
		since: 'Jun 1989',
		party: 'Islamic Republic',
		focus: ['nuclear program', 'proxies', 'sanctions']
	},
	{
		id: 'modi',
		name: 'Narendra Modi',
		title: 'Prime Minister',
		country: 'India',
		flag: 'IN',
		keywords: ['modi', 'indian pm', 'india prime minister'],
		since: 'May 2014',
		party: 'BJP',
		focus: ['economy', 'china border', 'technology']
	},
	{
		id: 'kim',
		name: 'Kim Jong Un',
		title: 'Supreme Leader',
		country: 'North Korea',
		flag: 'KP',
		keywords: ['kim jong un', 'north korea', 'pyongyang'],
		since: 'Dec 2011',
		party: 'Workers Party',
		focus: ['nuclear', 'missiles', 'russia alliance']
	},
	{
		id: 'zelensky',
		name: 'Volodymyr Zelensky',
		title: 'President',
		country: 'Ukraine',
		flag: 'UA',
		keywords: ['zelensky', 'ukraine president', 'kyiv'],
		since: 'May 2019',
		party: 'Servant of the People',
		focus: ['war', 'western aid', 'nato membership']
	},
	{
		id: 'milei',
		name: 'Javier Milei',
		title: 'President',
		country: 'Argentina',
		flag: 'AR',
		keywords: ['milei', 'argentina president', 'buenos aires'],
		since: 'Dec 2023',
		party: 'La Libertad Avanza',
		focus: ['dollarization', 'spending cuts', 'deregulation']
	},
	{
		id: 'lula',
		name: 'Luiz Inacio Lula da Silva',
		title: 'President',
		country: 'Brazil',
		flag: 'BR',
		keywords: ['lula', 'brazil president', 'brasilia'],
		since: 'Jan 2023',
		party: 'PT',
		focus: ['amazon', 'social programs', 'brics']
	}
];

// ============================================================================
// HELPERS
// ============================================================================

const FALLBACK_LAYOFFS: Layoff[] = [
	{
		company: 'Tech Industry',
		count: 0,
		title: 'Layoff data temporarily unavailable - API timeout',
		date: new Date().toISOString()
	}
];

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Fetch government contracts from USASpending API
 */
export async function fetchGovContracts(): Promise<GovContract[]> {
	try {
		console.log('Fetching government contracts from USASpending...');

		// Calculate date range for past 7 days
		const now = new Date();
		const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		const formatDate = (d: Date) => d.toISOString().split('T')[0];

		const requestBody = {
			filters: {
				time_period: [
					{
						start_date: formatDate(weekAgo),
						end_date: formatDate(now)
					}
				],
				award_type_codes: ['A', 'B', 'C', 'D'] // Contract types
			},
			fields: [
				'Award_ID',
				'Recipient_Name',
				'Award_Amount',
				'Awarding_Agency',
				'Award_Description',
				'Start_Date',
				'Recipient_State_Code',
				'NAICS_Code',
				'Contract_Award_Type'
			],
			page: 1,
			limit: 50,
			sort: 'Award_Amount',
			order: 'desc'
		};

		const response = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify(requestBody),
			signal: AbortSignal.timeout(20000)
		});

		if (!response.ok) {
			throw new Error(`USASpending API returned ${response.status}`);
		}

		const data: USASpendingResponse = await response.json();

		if (!data.results || !Array.isArray(data.results)) {
			console.warn('Invalid USASpending response');
			return [];
		}

		const contracts: GovContract[] = data.results.map((award) => ({
			id: award.Award_ID || `usa-${Math.random().toString(36).slice(2)}`,
			recipient: award.Recipient_Name || 'Unknown',
			amount: award.Award_Amount || 0,
			agency: award.Awarding_Agency || 'Unknown Agency',
			description: award.Award_Description || '',
			date: award.Start_Date || new Date().toISOString(),
			state: award.Recipient_State_Code,
			naicsCode: award.NAICS_Code,
			contractType: award.Contract_Award_Type
		}));

		// Filter for significant contracts (over $1M)
		const significantContracts = contracts.filter((c) => c.amount >= 1000000);

		console.log(`Processed ${significantContracts.length} significant contracts`);
		return significantContracts.slice(0, 25);
	} catch (error) {
		console.error('Error fetching government contracts:', error);
		return [];
	}
}

/**
 * Fetch layoffs data from Hacker News Algolia API
 */
export async function fetchLayoffs(): Promise<Layoff[]> {
	try {
		console.log('Fetching layoffs data...');

		// Get Unix timestamp for 30 days ago
		const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

		const response = await fetch(
			`https://hn.algolia.com/api/v1/search?query=layoffs&tags=story&numericFilters=created_at_i>${thirtyDaysAgo}&hitsPerPage=30`,
			{ signal: AbortSignal.timeout(12000) }
		);

		if (!response.ok) {
			console.warn(`HN Algolia API returned ${response.status}`);
			return FALLBACK_LAYOFFS;
		}

		const data = await response.json();
		const layoffs: Layoff[] = [];

		if (data.hits && Array.isArray(data.hits)) {
			for (const hit of data.hits) {
				const title = hit.title || '';
				const lowerTitle = title.toLowerCase();

				// Must contain layoff-related terms
				if (
					!lowerTitle.match(
						/layoff|laying off|laid off|job cut|workforce reduction|downsiz/i
					)
				) {
					continue;
				}

				// Extract company name
				let company = 'Company';
				const companyVerbMatch = title.match(
					/^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+(?:lays?|is laying|laying|to lay|will lay|cuts?|cutting|announces?)/i
				);
				const atCompanyMatch = title.match(/at\s+([A-Z][a-zA-Z0-9]+)/);
				const possessiveMatch = title.match(/([A-Z][a-zA-Z0-9]+)(?:'s)?\s+(?:layoffs?|job cuts)/i);

				if (companyVerbMatch) {
					company = companyVerbMatch[1].trim();
				} else if (possessiveMatch) {
					company = possessiveMatch[1];
				} else if (atCompanyMatch) {
					company = atCompanyMatch[1];
				}

				if (['The', 'This', 'More', 'Why', 'How', 'Tech', 'Big'].includes(company)) {
					company = 'Tech Company';
				}

				// Extract count
				let count = 0;
				const countMatch = title.match(
					/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:k|K|thousand)?\s*(?:employees?|workers?|jobs?|people|staff|positions?)/i
				);
				const percentMatch = title.match(/(\d+)%/);

				if (countMatch) {
					const numStr = countMatch[1].replace(/,/g, '');
					count = parseInt(numStr, 10);
					if (title.toLowerCase().includes('k ') || title.toLowerCase().includes('thousand')) {
						count = count * 1000;
					}
				} else if (percentMatch) {
					count = parseInt(percentMatch[1], 10) * 50;
				}

				layoffs.push({
					company,
					count: count || 0,
					title: title.substring(0, 100),
					date: hit.created_at || new Date().toISOString()
				});

				if (layoffs.length >= 8) break;
			}
		}

		layoffs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

		const result = layoffs.slice(0, 6);

		if (result.length === 0) {
			return FALLBACK_LAYOFFS;
		}

		console.log(`Processed ${result.length} layoffs`);
		return result;
	} catch (error) {
		console.error('Error fetching layoffs:', error);
		return FALLBACK_LAYOFFS;
	}
}

/**
 * Fetch news for a single world leader
 */
async function fetchLeaderNews(leader: Omit<WorldLeader, 'news'>): Promise<WorldLeader> {
	const query = leader.keywords.map((k) => `"${k}"`).join(' OR ');

	try {
		const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=5&format=json&sort=date`;

		const response = await fetch(gdeltUrl, { signal: AbortSignal.timeout(10000) });
		if (!response.ok) {
			return { ...leader, news: [] };
		}

		const contentType = response.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			return { ...leader, news: [] };
		}

		const text = await response.text();
		let data: GdeltResponse;
		try {
			data = JSON.parse(text);
		} catch {
			return { ...leader, news: [] };
		}

		const news: LeaderNews[] = (data.articles || []).map((article) => ({
			source: article.domain || 'Unknown',
			title: article.title || '',
			link: article.url || '',
			pubDate: article.seendate || ''
		}));

		return { ...leader, news };
	} catch {
		return { ...leader, news: [] };
	}
}

/**
 * Fetch news for all world leaders
 */
export async function fetchWorldLeaders(): Promise<WorldLeader[]> {
	console.log('Fetching world leaders news...');

	const batchSize = 5;
	const results: WorldLeader[] = [];

	for (let i = 0; i < WORLD_LEADERS.length; i += batchSize) {
		const batch = WORLD_LEADERS.slice(i, i + batchSize);
		const batchResults = await Promise.allSettled(batch.map(fetchLeaderNews));

		for (const result of batchResults) {
			if (result.status === 'fulfilled') {
				results.push(result.value);
			}
		}

		// Small delay between batches
		if (i + batchSize < WORLD_LEADERS.length) {
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
	}

	// Sort by news activity
	results.sort((a, b) => (b.news?.length || 0) - (a.news?.length || 0));

	console.log(`Processed ${results.length} world leaders`);
	return results;
}
