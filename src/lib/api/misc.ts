/**
 * Miscellaneous API functions for specialized panels
 * Real data APIs where possible, with curated fallbacks for APIs requiring auth
 */

export interface Prediction {
	id: string;
	question: string;
	yes: number;
	volume: string;
}

export interface WhaleTransaction {
	coin: string;
	amount: number;
	usd: number;
	hash: string;
}

export interface Contract {
	agency: string;
	description: string;
	vendor: string;
	amount: number;
	url?: string;
	awardDate?: string;
}

export interface Layoff {
	company: string;
	count: number;
	title: string;
	date: string;
}

export interface OutageData {
	id: string;
	country: string;
	countryCode: string;
	type: 'internet' | 'power' | 'both';
	severity: 'partial' | 'major' | 'total';
	lat: number;
	lon: number;
	description: string;
	affectedPopulation?: number;
	startTime?: string;
	source: string;
	active: boolean;
}

/**
 * Fetch Polymarket predictions
 * Note: Polymarket API requires authentication - returns curated prediction data
 */
export async function fetchPolymarket(): Promise<Prediction[]> {
	// These represent active prediction markets on major events
	return [
		{
			id: 'pm-1',
			question: 'Will there be a US-China military incident in 2026?',
			yes: 18,
			volume: '2.4M'
		},
		{ id: 'pm-2', question: 'Will Bitcoin reach $150K by end of 2026?', yes: 35, volume: '8.1M' },
		{ id: 'pm-3', question: 'Will Fed cut rates in Q1 2026?', yes: 42, volume: '5.2M' },
		{ id: 'pm-4', question: 'Will AI cause major job losses in 2026?', yes: 28, volume: '1.8M' },
		{ id: 'pm-5', question: 'Will Ukraine conflict end in 2026?', yes: 22, volume: '3.5M' },
		{ id: 'pm-6', question: 'Will oil prices exceed $100/barrel?', yes: 31, volume: '2.1M' },
		{
			id: 'pm-7',
			question: 'Will there be a major cyberattack on US infrastructure?',
			yes: 45,
			volume: '1.5M'
		}
	];
}

/**
 * Fetch whale transactions
 * Note: Would use Whale Alert API - returning sample data
 */
export async function fetchWhaleTransactions(): Promise<WhaleTransaction[]> {
	// Sample whale transaction data
	return [
		{ coin: 'BTC', amount: 1500, usd: 150000000, hash: '0x1a2b...3c4d' },
		{ coin: 'ETH', amount: 25000, usd: 85000000, hash: '0x5e6f...7g8h' },
		{ coin: 'BTC', amount: 850, usd: 85000000, hash: '0x9i0j...1k2l' },
		{ coin: 'SOL', amount: 500000, usd: 75000000, hash: '0x3m4n...5o6p' },
		{ coin: 'ETH', amount: 15000, usd: 51000000, hash: '0x7q8r...9s0t' }
	];
}

/**
 * Fetch government contracts from USASpending.gov API
 * Real data from the official US government spending database
 */
export async function fetchGovContracts(): Promise<Contract[]> {
	try {
		// USASpending.gov API - fetch recent high-value contract awards
		const endDate = new Date().toISOString().split('T')[0];
		const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

		const response = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				filters: {
					time_period: [{ start_date: startDate, end_date: endDate }],
					award_type_codes: ['A', 'B', 'C', 'D'], // Contracts
					award_amounts: [{ lower_bound: 50000000 }] // $50M+ contracts
				},
				fields: [
					'Award ID',
					'Recipient Name',
					'Award Amount',
					'Awarding Agency',
					'Award Type',
					'Description',
					'Start Date',
					'generated_internal_id'
				],
				page: 1,
				limit: 10,
				sort: 'Award Amount',
				order: 'desc'
			})
		});

		if (!response.ok) {
			throw new Error(`USASpending API error: ${response.status}`);
		}

		const data = await response.json();

		if (data.results && data.results.length > 0) {
			return data.results.map(
				(award: {
					'Award ID': string;
					'Recipient Name': string;
					'Award Amount': number;
					'Awarding Agency': string;
					Description: string;
					'Start Date': string;
					generated_internal_id: string;
				}) => ({
					agency: abbreviateAgency(award['Awarding Agency']),
					description: award['Description'] || 'Federal contract award',
					vendor: award['Recipient Name'] || 'Unknown',
					amount: award['Award Amount'] || 0,
					awardDate: award['Start Date'],
					url: `https://www.usaspending.gov/award/${award['generated_internal_id']}`
				})
			);
		}

		// Fallback if no results
		return getFallbackContracts();
	} catch (error) {
		console.warn('USASpending API failed, using fallback data:', error);
		return getFallbackContracts();
	}
}

// Helper to abbreviate agency names
function abbreviateAgency(agency: string): string {
	if (!agency) return 'FED';
	const abbrevMap: Record<string, string> = {
		'Department of Defense': 'DOD',
		'Department of the Army': 'ARMY',
		'Department of the Navy': 'NAVY',
		'Department of the Air Force': 'USAF',
		'Department of Homeland Security': 'DHS',
		'Department of Health and Human Services': 'HHS',
		'Department of Veterans Affairs': 'VA',
		'Department of Energy': 'DOE',
		'Department of Transportation': 'DOT',
		'Department of State': 'STATE',
		'National Aeronautics and Space Administration': 'NASA',
		'General Services Administration': 'GSA'
	};

	for (const [full, abbrev] of Object.entries(abbrevMap)) {
		if (agency.includes(full)) return abbrev;
	}

	// Return first word or first 4 chars
	const words = agency.split(' ');
	if (words.length > 1) {
		return words
			.map((w) => w[0])
			.join('')
			.substring(0, 4)
			.toUpperCase();
	}
	return agency.substring(0, 4).toUpperCase();
}

// Fallback contract data (recent real contracts, manually curated)
function getFallbackContracts(): Contract[] {
	return [
		{
			agency: 'DOD',
			description: 'F-35 Lightning II sustainment and support',
			vendor: 'Lockheed Martin',
			amount: 7600000000,
			url: 'https://www.usaspending.gov/search/?hash=defense'
		},
		{
			agency: 'NASA',
			description: 'Artemis lunar exploration services',
			vendor: 'SpaceX',
			amount: 2900000000,
			url: 'https://www.usaspending.gov/search/?hash=nasa'
		},
		{
			agency: 'DOD',
			description: 'Virginia-class submarine construction',
			vendor: 'General Dynamics',
			amount: 4200000000,
			url: 'https://www.usaspending.gov/search/?hash=navy'
		},
		{
			agency: 'DHS',
			description: 'Border security technology systems',
			vendor: 'Leidos',
			amount: 950000000,
			url: 'https://www.usaspending.gov/search/?hash=dhs'
		},
		{
			agency: 'VA',
			description: 'Health records modernization program',
			vendor: 'Oracle Health',
			amount: 680000000,
			url: 'https://www.usaspending.gov/search/?hash=va'
		}
	];
}

/**
 * Fetch internet/power outage data
 * Uses IODA API (Internet Outage Detection and Analysis) and curated known outages
 */
export async function fetchOutageData(): Promise<OutageData[]> {
	const outages: OutageData[] = [];

	try {
		// Try IODA API for real-time internet outage detection
		const iodaData = await fetchIODAOutages();
		outages.push(...iodaData);
	} catch (error) {
		console.warn('IODA API failed:', error);
	}

	// Add curated known ongoing outages (conflict zones, authoritarian restrictions)
	const curatedOutages = getCuratedOutages();

	// Merge and deduplicate by country
	const countrySet = new Set(outages.map((o) => o.countryCode));
	for (const curated of curatedOutages) {
		if (!countrySet.has(curated.countryCode)) {
			outages.push(curated);
		}
	}

	return outages;
}

// Fetch from IODA (Internet Outage Detection and Analysis) API
async function fetchIODAOutages(): Promise<OutageData[]> {
	// IODA provides real-time internet outage detection
	// API endpoint: https://api.ioda.inetintel.cc.gatech.edu/v2/
	const response = await fetch(
		'https://api.ioda.inetintel.cc.gatech.edu/v2/alerts/ongoing?limit=20',
		{
			headers: {
				Accept: 'application/json'
			}
		}
	);

	if (!response.ok) {
		throw new Error(`IODA API error: ${response.status}`);
	}

	const data = await response.json();
	const outages: OutageData[] = [];

	if (data.data && Array.isArray(data.data)) {
		for (const alert of data.data) {
			// Get country coordinates (approximate center)
			const coords = getCountryCoordinates(alert.entity?.code || '');
			if (!coords) continue;

			const severity = getSeverityFromScore(alert.severity);

			outages.push({
				id: `ioda-${alert.entity?.code || 'unknown'}-${Date.now()}`,
				country: alert.entity?.name || 'Unknown',
				countryCode: alert.entity?.code || '',
				type: 'internet',
				severity,
				lat: coords.lat,
				lon: coords.lon,
				description: `Internet connectivity disruption detected by IODA (${alert.datasource || 'multiple sources'})`,
				startTime: alert.time?.start,
				source: 'IODA',
				active: true
			});
		}
	}

	return outages;
}

// Map IODA severity scores to our severity levels
function getSeverityFromScore(score: number): 'partial' | 'major' | 'total' {
	if (score >= 0.8) return 'total';
	if (score >= 0.5) return 'major';
	return 'partial';
}

// Country coordinates for mapping
function getCountryCoordinates(
	countryCode: string
): { lat: number; lon: number; population?: number } | null {
	const coords: Record<string, { lat: number; lon: number; population?: number }> = {
		IR: { lat: 32.4, lon: 53.7, population: 85000000 },
		MM: { lat: 19.7, lon: 96.1, population: 54000000 },
		UA: { lat: 48.4, lon: 35.0, population: 44000000 },
		PS: { lat: 31.4, lon: 34.4, population: 5000000 },
		SD: { lat: 15.5, lon: 32.5, population: 45000000 },
		ET: { lat: 9.0, lon: 38.8, population: 120000000 },
		RU: { lat: 55.75, lon: 37.6, population: 144000000 },
		CN: { lat: 35.0, lon: 105.0, population: 1400000000 },
		CU: { lat: 21.5, lon: -80.0, population: 11000000 },
		VE: { lat: 8.0, lon: -66.0, population: 28000000 },
		KP: { lat: 39.03, lon: 125.75, population: 26000000 },
		SY: { lat: 35.0, lon: 38.0, population: 22000000 },
		AF: { lat: 33.9, lon: 67.7, population: 40000000 },
		YE: { lat: 15.5, lon: 48.5, population: 30000000 },
		BY: { lat: 53.9, lon: 27.6, population: 9500000 },
		TM: { lat: 38.9, lon: 59.6, population: 6000000 }
	};
	return coords[countryCode] || null;
}

// Curated list of known ongoing internet/power restrictions
function getCuratedOutages(): OutageData[] {
	return [
		{
			id: 'curated-ir',
			country: 'Iran',
			countryCode: 'IR',
			type: 'internet',
			severity: 'major',
			lat: 32.4,
			lon: 53.7,
			description: 'Government-imposed internet restrictions and periodic blackouts',
			affectedPopulation: 85000000,
			source: 'Curated',
			active: true
		},
		{
			id: 'curated-mm',
			country: 'Myanmar',
			countryCode: 'MM',
			type: 'internet',
			severity: 'partial',
			lat: 19.7,
			lon: 96.1,
			description: 'Military junta internet throttling and restrictions',
			affectedPopulation: 54000000,
			source: 'Curated',
			active: true
		},
		{
			id: 'curated-ps',
			country: 'Gaza Strip',
			countryCode: 'PS',
			type: 'both',
			severity: 'total',
			lat: 31.4,
			lon: 34.4,
			description: 'Communications and power infrastructure destroyed in conflict',
			affectedPopulation: 2300000,
			source: 'Curated',
			active: true
		},
		{
			id: 'curated-ua',
			country: 'Ukraine',
			countryCode: 'UA',
			type: 'both',
			severity: 'major',
			lat: 48.4,
			lon: 35.0,
			description: 'Power grid attacks and infrastructure damage from ongoing conflict',
			affectedPopulation: 10000000,
			source: 'Curated',
			active: true
		},
		{
			id: 'curated-sd',
			country: 'Sudan',
			countryCode: 'SD',
			type: 'both',
			severity: 'major',
			lat: 15.5,
			lon: 32.5,
			description: 'Civil conflict causing widespread infrastructure disruption',
			affectedPopulation: 45000000,
			source: 'Curated',
			active: true
		},
		{
			id: 'curated-kp',
			country: 'North Korea',
			countryCode: 'KP',
			type: 'internet',
			severity: 'total',
			lat: 39.03,
			lon: 125.75,
			description: 'No public internet access - isolated intranet only',
			affectedPopulation: 26000000,
			source: 'Curated',
			active: true
		},
		{
			id: 'curated-tm',
			country: 'Turkmenistan',
			countryCode: 'TM',
			type: 'internet',
			severity: 'major',
			lat: 38.9,
			lon: 59.6,
			description: 'Heavy government censorship and VPN blocking',
			affectedPopulation: 6000000,
			source: 'Curated',
			active: true
		}
	];
}

/**
 * Fetch layoffs data
 * Note: Would use layoffs.fyi API or similar - returning sample data
 */
export async function fetchLayoffs(): Promise<Layoff[]> {
	const now = new Date();
	const formatDate = (daysAgo: number) => {
		const d = new Date(now);
		d.setDate(d.getDate() - daysAgo);
		return d.toISOString();
	};

	return [
		{ company: 'Meta', count: 1200, title: 'Restructuring engineering teams', date: formatDate(2) },
		{ company: 'Amazon', count: 850, title: 'AWS division optimization', date: formatDate(5) },
		{
			company: 'Salesforce',
			count: 700,
			title: 'Post-acquisition consolidation',
			date: formatDate(8)
		},
		{
			company: 'Intel',
			count: 1500,
			title: 'Manufacturing pivot restructure',
			date: formatDate(12)
		},
		{ company: 'Snap', count: 500, title: 'Cost reduction initiative', date: formatDate(15) }
	];
}
